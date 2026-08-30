package models

import (
	"testing"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func testUserDevicesDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("file:userdevices_"+t.Name()+"?mode=memory&cache=shared"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&UserDevice{}, &LoginHistory{}, &AccountLock{}); err != nil {
		t.Fatalf("migrate: %v", err)
	}
	return db
}

func TestUserDevice_TableName(t *testing.T) {
	if (UserDevice{}).TableName() != constants.USER_DEVICE_TABLE_NAME {
		t.Fatalf("UserDevice table name = %q, want %q",
			(UserDevice{}).TableName(), constants.USER_DEVICE_TABLE_NAME)
	}
}

func TestLoginHistory_TableName(t *testing.T) {
	if (LoginHistory{}).TableName() != constants.LOGIN_HISTORY_TABLE_NAME {
		t.Fatalf("LoginHistory table name = %q, want %q",
			(LoginHistory{}).TableName(), constants.LOGIN_HISTORY_TABLE_NAME)
	}
}

func TestAccountLock_TableName(t *testing.T) {
	if (AccountLock{}).TableName() != constants.ACCOUNT_LOCK_TABLE_NAME {
		t.Fatalf("AccountLock table name = %q, want %q",
			(AccountLock{}).TableName(), constants.ACCOUNT_LOCK_TABLE_NAME)
	}
}

func TestAccountLock_IsLocked(t *testing.T) {
	// Active and unlock time in future -> locked
	al := &AccountLock{IsActive: true, UnlockAt: time.Now().Add(time.Hour)}
	if !al.IsLocked() {
		t.Fatal("expected active lock with future unlock to be locked")
	}
	// Inactive -> not locked even if unlock in future
	al.IsActive = false
	if al.IsLocked() {
		t.Fatal("inactive lock should not be locked")
	}
	// Active but unlock time in past -> not locked
	al.IsActive = true
	al.UnlockAt = time.Now().Add(-time.Hour)
	if al.IsLocked() {
		t.Fatal("expired lock should not be locked")
	}
}

func TestCreateOrUpdateAccountLock_createAndIncrement(t *testing.T) {
	db := testUserDevicesDB(t)
	lock, err := CreateOrUpdateAccountLock(db, "a@b.com", 1, "1.2.3.4", 3)
	if err != nil {
		t.Fatalf("create lock: %v", err)
	}
	if lock == nil || lock.Email != "a@b.com" || lock.FailedAttempts != 3 || !lock.IsActive {
		t.Fatalf("unexpected lock: %+v", lock)
	}
	if !lock.IsLocked() {
		t.Fatal("expected newly created lock to be locked")
	}

	// Update existing: increments failed attempts and resets unlock time
	lock2, err := CreateOrUpdateAccountLock(db, "a@b.com", 1, "5.6.7.8", 5)
	if err != nil {
		t.Fatalf("update lock: %v", err)
	}
	if lock2.ID != lock.ID {
		t.Fatalf("expected same lock id, got %d vs %d", lock2.ID, lock.ID)
	}
	if lock2.FailedAttempts != 5 {
		t.Fatalf("expected failed attempts 5, got %d", lock2.FailedAttempts)
	}
	if lock2.IPAddress != "5.6.7.8" {
		t.Fatalf("expected ip updated, got %q", lock2.IPAddress)
	}
}

func TestCreateOrUpdateAccountLockByUsername(t *testing.T) {
	db := testUserDevicesDB(t)
	lock, err := CreateOrUpdateAccountLockByUsername(db, "user1", 2, "9.9.9.9", 2)
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if lock.Username != "user1" || lock.UserID != 2 {
		t.Fatalf("unexpected: %+v", lock)
	}
	// Update
	lock2, err := CreateOrUpdateAccountLockByUsername(db, "user1", 2, "8.8.8.8", 4)
	if err != nil {
		t.Fatal(err)
	}
	if lock2.ID != lock.ID || lock2.FailedAttempts != 4 {
		t.Fatalf("unexpected update: %+v", lock2)
	}
}

func TestGetAccountLock_notFoundReturnsNil(t *testing.T) {
	db := testUserDevicesDB(t)
	got, err := GetAccountLock(db, "nobody@x.com", 0)
	if err != nil {
		t.Fatalf("expected nil error for not found, got: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for not found, got %+v", got)
	}
}

func TestGetAccountLockByUsername_notFoundReturnsNil(t *testing.T) {
	db := testUserDevicesDB(t)
	got, err := GetAccountLockByUsername(db, "ghost", 0)
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %+v", got)
	}
}

func TestUnlockAccount(t *testing.T) {
	db := testUserDevicesDB(t)
	lock, err := CreateOrUpdateAccountLock(db, "u@x.com", 1, "1.1.1.1", 3)
	if err != nil {
		t.Fatal(err)
	}
	if !lock.IsLocked() {
		t.Fatal("expected locked")
	}
	if err := UnlockAccount(db, "u@x.com", 1); err != nil {
		t.Fatalf("unlock: %v", err)
	}
	got, err := GetAccountLock(db, "u@x.com", 1)
	if err != nil {
		t.Fatal(err)
	}
	if got != nil {
		t.Fatalf("expected no active lock after unlock, got %+v", got)
	}
	// Unscoped record still exists but inactive
	var raw AccountLock
	if err := db.Unscoped().First(&raw, lock.ID).Error; err != nil {
		t.Fatal(err)
	}
	if raw.IsActive {
		t.Fatal("expected is_active=false after unlock")
	}
}

func TestRecordLoginHistory_andGetRecentLocations(t *testing.T) {
	db := testUserDevicesDB(t)
	if err := RecordLoginHistory(db, 1, "a@b.com", "1.1.1.1", "Beijing", "CN", "Beijing",
		"UA", "dev1", "password", true, "", false); err != nil {
		t.Fatalf("record: %v", err)
	}
	if err := RecordLoginHistory(db, 1, "a@b.com", "2.2.2.2", "Shanghai", "CN", "Shanghai",
		"UA", "dev2", "password", true, "", true); err != nil {
		t.Fatal(err)
	}
	// Failed login should not be returned by GetRecentLoginLocations
	if err := RecordLoginHistory(db, 1, "a@b.com", "3.3.3.3", "Guangzhou", "CN", "Guangzhou",
		"UA", "dev3", "password", false, "bad password", false); err != nil {
		t.Fatal(err)
	}

	histories, err := GetRecentLoginLocations(db, 1, 10)
	if err != nil {
		t.Fatalf("get recent: %v", err)
	}
	if len(histories) != 2 {
		t.Fatalf("expected 2 successful login histories, got %d", len(histories))
	}
	// Ordered by created_at DESC; most recent first
	if histories[0].IPAddress != "2.2.2.2" {
		t.Fatalf("expected most recent first, got %q", histories[0].IPAddress)
	}
}

func TestCreateOrUpdateUserDevice_createAndUpdate(t *testing.T) {
	db := testUserDevicesDB(t)
	dev, err := CreateOrUpdateUserDevice(db, 1, "dev-1", "Chrome", "browser", "macOS", "Chrome", "UA", "1.1.1.1", "Beijing")
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if dev == nil || !dev.IsActive || dev.IsTrusted {
		t.Fatalf("unexpected new device: %+v", dev)
	}

	// Update existing
	dev2, err := CreateOrUpdateUserDevice(db, 1, "dev-1", "Firefox", "browser", "Linux", "Firefox", "UA2", "2.2.2.2", "Shanghai")
	if err != nil {
		t.Fatalf("update: %v", err)
	}
	if dev2.ID != dev.ID {
		t.Fatalf("expected same device id, got %d vs %d", dev2.ID, dev.ID)
	}
	if dev2.DeviceName != "Firefox" || dev2.OS != "Linux" || dev2.IPAddress != "2.2.2.2" {
		t.Fatalf("unexpected updated device: %+v", dev2)
	}
}

func TestDeleteUserDevice_softDeactivate(t *testing.T) {
	db := testUserDevicesDB(t)
	_, err := CreateOrUpdateUserDevice(db, 1, "dev-1", "Chrome", "browser", "macOS", "Chrome", "UA", "1.1.1.1", "Beijing")
	if err != nil {
		t.Fatal(err)
	}
	if err := DeleteUserDevice(db, 1, "dev-1"); err != nil {
		t.Fatalf("delete: %v", err)
	}
	got, err := GetUserDevice(db, 1, "dev-1")
	if err != nil {
		t.Fatal(err)
	}
	if got != nil {
		t.Fatalf("expected device deactivated (not returned), got %+v", got)
	}
}

func TestTrustAndUntrustUserDevice(t *testing.T) {
	db := testUserDevicesDB(t)
	_, err := CreateOrUpdateUserDevice(db, 1, "dev-1", "Chrome", "browser", "macOS", "Chrome", "UA", "1.1.1.1", "Beijing")
	if err != nil {
		t.Fatal(err)
	}

	// Check trust initially false
	trusted, err := CheckDeviceTrust(db, 1, "dev-1")
	if err != nil {
		t.Fatal(err)
	}
	if trusted {
		t.Fatal("expected not trusted initially")
	}

	// Trust
	if err := TrustUserDevice(db, 1, "dev-1"); err != nil {
		t.Fatalf("trust: %v", err)
	}
	trusted, err = CheckDeviceTrust(db, 1, "dev-1")
	if err != nil {
		t.Fatal(err)
	}
	if !trusted {
		t.Fatal("expected trusted after TrustUserDevice")
	}

	// Untrust
	if err := UntrustUserDevice(db, 1, "dev-1"); err != nil {
		t.Fatalf("untrust: %v", err)
	}
	trusted, err = CheckDeviceTrust(db, 1, "dev-1")
	if err != nil {
		t.Fatal(err)
	}
	if trusted {
		t.Fatal("expected not trusted after UntrustUserDevice")
	}
}

func TestTrustUserDevice_createsIfMissing(t *testing.T) {
	db := testUserDevicesDB(t)
	// Trust a non-existent device -> should create it as trusted
	if err := TrustUserDevice(db, 1, "new-dev"); err != nil {
		t.Fatalf("trust missing: %v", err)
	}
	got, err := GetUserDevice(db, 1, "new-dev")
	if err != nil {
		t.Fatal(err)
	}
	if got == nil {
		t.Fatal("expected device created by trust")
	}
	if !got.IsTrusted {
		t.Fatal("expected created device to be trusted")
	}
}

func TestCheckDeviceTrust_notFoundReturnsFalse(t *testing.T) {
	db := testUserDevicesDB(t)
	trusted, err := CheckDeviceTrust(db, 1, "ghost")
	if err != nil {
		t.Fatal(err)
	}
	if trusted {
		t.Fatal("expected false for missing device")
	}
}

func TestGetUserLoginDevices_ordersByLastUsedDesc(t *testing.T) {
	db := testUserDevicesDB(t)
	now := time.Now()
	older := now.Add(-time.Hour)
	// Create two devices; the one with newer LastUsedAt should come first.
	d1 := &UserDevice{UserID: 1, DeviceID: "d1", IsActive: true, LastUsedAt: older}
	d2 := &UserDevice{UserID: 1, DeviceID: "d2", IsActive: true, LastUsedAt: now}
	if err := db.Create(d1).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(d2).Error; err != nil {
		t.Fatal(err)
	}
	// Inactive device should be excluded. Create as active then deactivate,
	// because GORM applies default:true when IsActive is the zero value.
	d3 := &UserDevice{UserID: 1, DeviceID: "d3", IsActive: true, LastUsedAt: now}
	if err := db.Create(d3).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Model(&UserDevice{}).Where("id = ?", d3.ID).Update("is_active", false).Error; err != nil {
		t.Fatal(err)
	}

	devs, err := GetUserLoginDevices(db, 1)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(devs) != 2 {
		t.Fatalf("expected 2 active devices, got %d", len(devs))
	}
	if devs[0].DeviceID != "d2" {
		t.Fatalf("expected newest device first, got %q", devs[0].DeviceID)
	}
}
