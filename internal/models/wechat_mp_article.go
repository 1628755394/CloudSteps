package models

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	common "github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

const (
	WechatMpArticleStatusDraft      = "draft"
	WechatMpArticleStatusSynced     = "synced"
	WechatMpArticleStatusPublishing = "publishing"
	WechatMpArticleStatusPublished  = "published"
	WechatMpArticleStatusFailed     = "failed"
)

// WechatMpArticle 微信公众号图文（本地草稿 + 同步/发布状态）。
type WechatMpArticle struct {
	common.BaseModel
	Title            string     `json:"title" gorm:"size:64;not null;comment:标题"`
	Author           string     `json:"author" gorm:"size:32;comment:作者"`
	Digest           string     `json:"digest" gorm:"size:256;comment:摘要"`
	Content          string     `json:"content" gorm:"type:longtext;not null;comment:正文 Markdown"`
	ContentSourceURL string     `json:"contentSourceUrl" gorm:"size:512;comment:原文链接"`
	ThumbMediaID     string     `json:"thumbMediaId" gorm:"size:128;comment:微信封面 media_id"`
	ThumbPreviewURL  string     `json:"thumbPreviewUrl" gorm:"size:512;comment:封面预览 URL"`
	Status           string     `json:"status" gorm:"size:16;not null;default:draft;index"`
	WechatMediaID    string     `json:"wechatMediaId" gorm:"size:128;index;comment:微信草稿 media_id"`
	WechatPublishID  string     `json:"wechatPublishId" gorm:"size:128;comment:微信发布任务 publish_id"`
	WechatArticleID  string     `json:"wechatArticleId" gorm:"size:128;index;comment:微信已发布 article_id"`
	WechatArticleIndex int      `json:"wechatArticleIndex" gorm:"default:0;comment:多图文索引"`
	WechatArticleURL string     `json:"wechatArticleUrl" gorm:"size:512;comment:微信文章链接"`
	ContentFormat    string     `json:"contentFormat" gorm:"size:16;default:markdown;comment:markdown|html"`
	SyncedAt         *time.Time `json:"syncedAt,omitempty"`
	PublishedAt      *time.Time `json:"publishedAt,omitempty"`
	LastError        string     `json:"lastError,omitempty" gorm:"size:512"`
}

func (WechatMpArticle) TableName() string { return constants.TABLE_WECHAT_MP_ARTICLES }

func CreateWechatMpArticle(db *gorm.DB, row *WechatMpArticle) error {
	if db == nil || row == nil {
		return errors.New("invalid article")
	}
	title := strings.TrimSpace(row.Title)
	if title == "" {
		return errors.New("title required")
	}
	row.Title = title
	row.Author = strings.TrimSpace(row.Author)
	row.Digest = strings.TrimSpace(row.Digest)
	row.Content = strings.TrimSpace(row.Content)
	row.ContentSourceURL = strings.TrimSpace(row.ContentSourceURL)
	if row.Status == "" {
		row.Status = WechatMpArticleStatusDraft
	}
	if row.ContentFormat == "" {
		row.ContentFormat = "markdown"
	}
	return db.Create(row).Error
}

func FindWechatMpArticleByRemoteKey(db *gorm.DB, articleID string, index int) (*WechatMpArticle, error) {
	articleID = strings.TrimSpace(articleID)
	if articleID == "" {
		return nil, gorm.ErrRecordNotFound
	}
	var row WechatMpArticle
	err := db.Where("wechat_article_id = ? AND wechat_article_index = ?", articleID, index).
		First(&row).Error
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func ListImportedWechatArticleKeys(db *gorm.DB, keys []struct {
	ArticleID string
	Index     int
}) map[string]uint {
	out := map[string]uint{}
	if len(keys) == 0 {
		return out
	}
	var rows []WechatMpArticle
	q := db.Model(&WechatMpArticle{}).Where("wechat_article_id != ''")
	if len(keys) == 1 {
		q = q.Where("wechat_article_id = ? AND wechat_article_index = ?", keys[0].ArticleID, keys[0].Index)
	} else {
		ids := make([]string, 0, len(keys))
		for _, k := range keys {
			ids = append(ids, k.ArticleID)
		}
		q = q.Where("wechat_article_id IN ?", ids)
	}
	_ = q.Find(&rows).Error
	for _, row := range rows {
		out[remoteArticleKey(row.WechatArticleID, row.WechatArticleIndex)] = row.ID
	}
	return out
}

func remoteArticleKey(articleID string, index int) string {
	return fmt.Sprintf("%s#%d", articleID, index)
}

func GetWechatMpArticleByID(db *gorm.DB, id uint) (*WechatMpArticle, error) {
	var row WechatMpArticle
	if err := db.Where("id = ?", id).First(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func ListWechatMpArticlesAdmin(db *gorm.DB, status string, page, pageSize int) ([]WechatMpArticle, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	q := db.Model(&WechatMpArticle{})
	if status != "" {
		q = q.Where("status = ?", status)
	}
	var total int64
	if err := q.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []WechatMpArticle
	err := q.Order("id DESC").Offset((page - 1) * pageSize).Limit(pageSize).Find(&list).Error
	return list, total, err
}

func UpdateWechatMpArticle(db *gorm.DB, id uint, vals map[string]any) error {
	return db.Model(&WechatMpArticle{}).Where("id = ?", id).Updates(vals).Error
}

func DeleteWechatMpArticle(db *gorm.DB, id uint, operator string) error {
	var row WechatMpArticle
	if err := db.Where("id = ?", id).First(&row).Error; err != nil {
		return err
	}
	row.SoftDelete(operator)
	return db.Save(&row).Error
}
