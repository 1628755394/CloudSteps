package models

import (
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testAnnouncementDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:announcement_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&Announcement{}, &AnnouncementRead{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestAnnouncementPopupReadOnce(t *testing.T) {
	db := testAnnouncementDB(t)
	now := time.Now()
	a := &Announcement{
		Title:       "欢迎",
		Content:     "内容",
		Status:      AnnouncementStatusPublished,
		PublishedAt: &now,
		Priority:    1,
	}
	if err := CreateAnnouncement(db, a); err != nil {
		t.Fatal(err)
	}
	_ = PublishAnnouncement(db, a.ID, "t")

	got, err := LatestUnreadPublishedAnnouncement(db, 7)
	if err != nil || got == nil || got.ID != a.ID {
		t.Fatalf("expected unread popup, got=%v err=%v", got, err)
	}
	if err := MarkAnnouncementRead(db, a.ID, 7); err != nil {
		t.Fatal(err)
	}
	got2, err := LatestUnreadPublishedAnnouncement(db, 7)
	if err != nil {
		t.Fatal(err)
	}
	if got2 != nil {
		t.Fatalf("expected no popup after read, got id=%d", got2.ID)
	}
}
