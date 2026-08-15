package notification

import (
	"fmt"
	"strconv"
	"time"

	"github.com/LingByte/ling-base/notification/inbox"
	"gorm.io/gorm"
)

// InternalNotification is kept as a gorm-registered alias for the
// ling-base inbox.GormMessage so existing AutoMigrate calls and legacy
// table rows continue to work. The table name is preserved.
type InternalNotification = inbox.GormMessage

// InternalNotificationService wraps an inbox.GormStore to provide the
// same API the old pkg/notification.InternalNotificationService
// exposed, so handlers don't need to change their call sites beyond
// the import path.
type InternalNotificationService struct {
	store *inbox.GormStore
}

// NewInternalNotificationService creates a service backed by a
// GormStore on the given DB.
func NewInternalNotificationService(db *gorm.DB) *InternalNotificationService {
	return &InternalNotificationService{store: inbox.NewGormStore(db)}
}

// Send creates a new inbox message for the user.
func (s *InternalNotificationService) Send(userID uint, title, content string) error {
	return s.store.Create(inbox.Message{
		UserID:  strconv.FormatUint(uint64(userID), 10),
		Title:   title,
		Content: content,
	})
}

// GetUnreadNotifications returns the user's unread notifications.
func (s *InternalNotificationService) GetUnreadNotifications(userID uint) ([]inbox.Message, error) {
	res, err := s.store.List(
		strconv.FormatUint(uint64(userID), 10),
		1, 1<<31-1,
		inbox.FilterUnread, "", "",
		time.Time{}, time.Time{},
	)
	if err != nil {
		return nil, err
	}
	return res.List, nil
}

// GetUnreadNotificationsCount returns the count of unread notifications.
func (s *InternalNotificationService) GetUnreadNotificationsCount(userID uint) (int64, error) {
	return s.store.UnreadCount(strconv.FormatUint(uint64(userID), 10))
}

// MarkAsRead marks a single notification as read by ID.
func (s *InternalNotificationService) MarkAsRead(notificationID uint) error {
	return s.store.MarkRead("", strconv.FormatUint(uint64(notificationID), 10))
}

// MarkAllAsRead marks all of the user's notifications as read.
func (s *InternalNotificationService) MarkAllAsRead(userID uint) error {
	return s.store.MarkAllRead(strconv.FormatUint(uint64(userID), 10))
}

// GetPaginatedNotifications returns a paginated, filtered list plus
// total/unread/read counts.
func (s *InternalNotificationService) GetPaginatedNotifications(
	userID uint, page, size int,
	filter, titleKeyword, contentKeyword string,
	startTime, endTime time.Time,
) ([]inbox.Message, int64, int64, int64, error) {
	res, err := s.store.List(
		strconv.FormatUint(uint64(userID), 10),
		page, size,
		filter, titleKeyword, contentKeyword,
		startTime, endTime,
	)
	if err != nil {
		return nil, 0, 0, 0, err
	}
	return res.List, res.Total, res.TotalUnread, res.TotalRead, nil
}

// GetOne returns a single notification by user and ID.
func (s *InternalNotificationService) GetOne(userID uint, notificationID uint) (inbox.Message, error) {
	msg, err := s.store.GetByID(
		strconv.FormatUint(uint64(userID), 10),
		strconv.FormatUint(uint64(notificationID), 10),
	)
	if err != nil {
		return inbox.Message{}, err
	}
	return *msg, nil
}

// Delete removes a single notification by user and ID.
func (s *InternalNotificationService) Delete(userID uint, notificationID uint) error {
	return s.store.Delete(
		strconv.FormatUint(uint64(userID), 10),
		strconv.FormatUint(uint64(notificationID), 10),
	)
}

// BatchDelete removes multiple notifications by ID.
func (s *InternalNotificationService) BatchDelete(userID uint, notificationIDs []uint) (int64, error) {
	if len(notificationIDs) == 0 {
		return 0, nil
	}
	ids := make([]string, 0, len(notificationIDs))
	for _, id := range notificationIDs {
		ids = append(ids, strconv.FormatUint(uint64(id), 10))
	}
	removed, err := s.store.BatchDelete(strconv.FormatUint(uint64(userID), 10), ids)
	if err != nil {
		return 0, err
	}
	return removed, nil
}

// GetAllNotificationIds returns all notification IDs matching the
// filter, for the select-all feature.
func (s *InternalNotificationService) GetAllNotificationIds(
	userID uint,
	filter, titleKeyword, contentKeyword string,
	startTime, endTime time.Time,
) ([]uint, error) {
	// Fetch a large page to collect all IDs. This mirrors the old
	// implementation which used Pluck under the hood.
	res, err := s.store.List(
		strconv.FormatUint(uint64(userID), 10),
		1, 1<<31-1,
		filter, titleKeyword, contentKeyword,
		startTime, endTime,
	)
	if err != nil {
		return nil, err
	}
	ids := make([]uint, 0, len(res.List))
	for _, msg := range res.List {
		id, err := strconv.ParseUint(msg.ID, 10, 64)
		if err != nil {
			continue
		}
		ids = append(ids, uint(id))
	}
	return ids, nil
}

// CleanOldUnread deletes unread notifications older than `before` for
// all users. Used by the email_cleaner task.
func CleanOldUnread(db *gorm.DB, before time.Time) (int64, error) {
	store := inbox.NewGormStore(db)
	return store.CleanOldUnread(before)
}

// FormatID converts a uint notification ID to the string form used by
// the inbox store.
func FormatID(id uint) string {
	return fmt.Sprintf("%d", id)
}
