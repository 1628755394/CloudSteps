package models

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	AnnouncementStatusDraft     = "draft"
	AnnouncementStatusPublished = "published"
)

// Announcement 系统公告（后台发布，全体登录用户可见）。
type Announcement struct {
	BaseModel
	Title       string     `json:"title" gorm:"size:200;not null;comment:公告标题"`
	Content     string     `json:"content" gorm:"type:text;not null;comment:公告正文 Markdown"`
	Status      string     `json:"status" gorm:"size:16;not null;default:draft;index;comment:draft|published"`
	PublishedAt *time.Time `json:"publishedAt,omitempty" gorm:"index;comment:发布时间"`
	Priority    int        `json:"priority" gorm:"default:0;comment:越大越优先弹出"`
}

func (Announcement) TableName() string { return "announcements" }

// AnnouncementRead 用户已读公告记录；有记录则不再主动弹窗。
type AnnouncementRead struct {
	BaseModel
	AnnouncementID uint      `json:"announcementId" gorm:"uniqueIndex:idx_announcement_read_pair;not null"`
	UserID         uint      `json:"userId" gorm:"uniqueIndex:idx_announcement_read_pair;not null;index"`
	ReadAt         time.Time `json:"readAt" gorm:"not null"`
}

func (AnnouncementRead) TableName() string { return "announcement_reads" }

func CreateAnnouncement(db *gorm.DB, row *Announcement) error {
	if db == nil || row == nil {
		return errors.New("invalid announcement")
	}
	title := strings.TrimSpace(row.Title)
	if title == "" {
		return errors.New("title required")
	}
	row.Title = title
	row.Content = strings.TrimSpace(row.Content)
	if row.Status == "" {
		row.Status = AnnouncementStatusDraft
	}
	return db.Create(row).Error
}

func GetAnnouncementByID(db *gorm.DB, id uint) (*Announcement, error) {
	var row Announcement
	if err := db.Where("id = ? AND is_deleted = ?", id, SoftDeleteStatusActive).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func ListAnnouncementsAdmin(db *gorm.DB, status string, page, pageSize int) ([]Announcement, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := db.Model(&Announcement{}).Where("is_deleted = ?", SoftDeleteStatusActive)
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []Announcement
	err := q.Order("priority DESC, id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

// ListPublishedAnnouncementsForUser 已发布公告列表，附带当前用户是否已读。
func ListPublishedAnnouncementsForUser(db *gorm.DB, userID uint, page, pageSize int) ([]Announcement, map[uint]bool, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := db.Model(&Announcement{}).
		Where("is_deleted = ? AND status = ?", SoftDeleteStatusActive, AnnouncementStatusPublished)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, nil, 0, err
	}
	var list []Announcement
	if err := q.Order("priority DESC, published_at DESC, id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error; err != nil {
		return nil, nil, 0, err
	}
	readMap := map[uint]bool{}
	if userID == 0 || len(list) == 0 {
		return list, readMap, total, nil
	}
	ids := make([]uint, 0, len(list))
	for _, a := range list {
		ids = append(ids, a.ID)
	}
	var reads []AnnouncementRead
	_ = db.Where("user_id = ? AND announcement_id IN ? AND is_deleted = ?", userID, ids, SoftDeleteStatusActive).
		Find(&reads).Error
	for _, r := range reads {
		readMap[r.AnnouncementID] = true
	}
	return list, readMap, total, nil
}

// LatestUnreadPublishedAnnouncement 取一条应主动弹出的未读公告（优先高 priority、新发布）。
func LatestUnreadPublishedAnnouncement(db *gorm.DB, userID uint) (*Announcement, error) {
	list, err := ListUnreadPublishedAnnouncements(db, userID, 1)
	if err != nil || len(list) == 0 {
		return nil, err
	}
	return &list[0], nil
}

// ListUnreadPublishedAnnouncements 未读已发布公告（优先高 priority、新发布），limit<=0 时默认 20、上限 50。
func ListUnreadPublishedAnnouncements(db *gorm.DB, userID uint, limit int) ([]Announcement, error) {
	if db == nil || userID == 0 {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	var list []Announcement
	err := db.Raw(`
SELECT a.* FROM announcements a
WHERE a.is_deleted = ? AND a.status = ?
AND NOT EXISTS (
  SELECT 1 FROM announcement_reads r
  WHERE r.announcement_id = a.id AND r.user_id = ? AND r.is_deleted = ?
)
ORDER BY a.priority DESC, a.published_at DESC, a.id DESC
LIMIT ?
`, SoftDeleteStatusActive, AnnouncementStatusPublished, userID, SoftDeleteStatusActive, limit).
		Scan(&list).Error
	return list, err
}

func MarkAnnouncementRead(db *gorm.DB, announcementID, userID uint) error {
	if db == nil || announcementID == 0 || userID == 0 {
		return errors.New("invalid read")
	}
	var existing AnnouncementRead
	err := db.Where("announcement_id = ? AND user_id = ? AND is_deleted = ?",
		announcementID, userID, SoftDeleteStatusActive).First(&existing).Error
	if err == nil {
		return nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	row := AnnouncementRead{
		AnnouncementID: announcementID,
		UserID:         userID,
		ReadAt:         time.Now(),
	}
	return db.Create(&row).Error
}

func ListAnnouncementReaders(db *gorm.DB, announcementID uint, page, pageSize int) ([]AnnouncementRead, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 50
	}
	q := db.Model(&AnnouncementRead{}).
		Where("announcement_id = ? AND is_deleted = ?", announcementID, SoftDeleteStatusActive)
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []AnnouncementRead
	err := q.Order("read_at DESC, id DESC").
		Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func CountAnnouncementReaders(db *gorm.DB, announcementIDs []uint) map[uint]int64 {
	out := map[uint]int64{}
	if len(announcementIDs) == 0 {
		return out
	}
	type row struct {
		AnnouncementID uint
		Cnt            int64
	}
	var rows []row
	_ = db.Model(&AnnouncementRead{}).
		Select("announcement_id, COUNT(*) as cnt").
		Where("announcement_id IN ? AND is_deleted = ?", announcementIDs, SoftDeleteStatusActive).
		Group("announcement_id").
		Scan(&rows).Error
	for _, r := range rows {
		out[r.AnnouncementID] = r.Cnt
	}
	return out
}

func PublishAnnouncement(db *gorm.DB, id uint, operator string) error {
	now := time.Now()
	return db.Model(&Announcement{}).Where("id = ? AND is_deleted = ?", id, SoftDeleteStatusActive).
		Updates(map[string]any{
			"status":       AnnouncementStatusPublished,
			"published_at": now,
			"update_by":    operator,
		}).Error
}

func UnpublishAnnouncement(db *gorm.DB, id uint, operator string) error {
	return db.Model(&Announcement{}).Where("id = ? AND is_deleted = ?", id, SoftDeleteStatusActive).
		Updates(map[string]any{
			"status":    AnnouncementStatusDraft,
			"update_by": operator,
		}).Error
}

func UpdateAnnouncement(db *gorm.DB, id uint, vals map[string]any) error {
	return db.Model(&Announcement{}).Where("id = ? AND is_deleted = ?", id, SoftDeleteStatusActive).
		Updates(vals).Error
}

func DeleteAnnouncement(db *gorm.DB, id uint, operator string) error {
	return db.Model(&Announcement{}).Where("id = ?", id).Updates(map[string]any{
		"is_deleted": SoftDeleteStatusDeleted,
		"update_by":  operator,
	}).Error
}
