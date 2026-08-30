package models

import (
	"errors"
	"fmt"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	common "github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 签到奖励（分钟，写入老师授课池）。
// 第 1–2 天各 60；第 3 天 70，此后每天 +10，上限 CheckInMaxDailyMinutes。
const (
	CheckInDailyMinutes      = 60
	CheckInStreakStepMinutes = 10
	CheckInMaxDailyMinutes   = 180
)

// CheckInRewardForStreak 连续第 streak 天签到当天应得分钟数。
func CheckInRewardForStreak(streak int) int {
	if streak <= 0 {
		return 0
	}
	if streak <= 2 {
		return CheckInDailyMinutes
	}
	m := CheckInDailyMinutes + (streak-2)*CheckInStreakStepMinutes
	if m > CheckInMaxDailyMinutes {
		return CheckInMaxDailyMinutes
	}
	return m
}

// CheckInRewardTier 签到奖励预览档位。
type CheckInRewardTier struct {
	Days    int `json:"days"`
	Minutes int `json:"minutes"`
}

// CheckInRewardPreview 前端展示用阶梯（与 CheckInRewardForStreak 一致）。
func CheckInRewardPreview() []CheckInRewardTier {
	days := []int{1, 3, 5, 7, 14, 30}
	out := make([]CheckInRewardTier, 0, len(days))
	for _, d := range days {
		out = append(out, CheckInRewardTier{Days: d, Minutes: CheckInRewardForStreak(d)})
	}
	return out
}

// TeacherCheckIn 老师每日签到一行（用户量小，直接用日期行记录即可）。
type TeacherCheckIn struct {
	common.BaseModel
	TeacherID      uint      `json:"teacherId" gorm:"uniqueIndex:idx_teacher_checkin_day;not null"`
	CheckInDate    time.Time `json:"checkInDate" gorm:"type:date;uniqueIndex:idx_teacher_checkin_day;not null"`
	GrantedMinutes int       `json:"grantedMinutes" gorm:"not null;default:0"`
	Streak         int       `json:"streak" gorm:"not null;default:1;comment:签到后连续天数"`
}

func (TeacherCheckIn) TableName() string { return constants.TABLE_TEACHER_CHECKINS }

// CheckInStatus 签到页展示状态。
type CheckInStatus struct {
	CheckedInToday    bool                `json:"checkedInToday"`
	CurrentStreak     int                 `json:"currentStreak"`
	LongestStreak     int                 `json:"longestStreak"`
	YearCheckIns      int                 `json:"yearCheckIns"`
	DailyReward       int                 `json:"dailyReward"`
	NextStreakBonus   *int                `json:"nextStreakBonusDays,omitempty"`
	NextStreakMinutes *int                `json:"nextStreakBonusMinutes,omitempty"`
	PoolRemaining     int                 `json:"poolRemainingMinutes"`
	MonthMask         []bool              `json:"monthMask"`
	MonthStartWeekday int                 `json:"monthStartWeekday"`
	RecentMask        []bool              `json:"recentMask"`
	RecentStartWeekday int               `json:"recentStartWeekday"`
	RecentDays        int                 `json:"recentDays"`
	RecentStartDate   string              `json:"recentStartDate"`
	RewardPreview     []CheckInRewardTier `json:"rewardPreview"`
}

// CheckInResult 签到结果。
type CheckInResult struct {
	AlreadyCheckedIn bool `json:"alreadyCheckedIn"`
	GrantedMinutes   int  `json:"grantedMinutes"`
	DailyMinutes     int  `json:"dailyMinutes"`
	BonusMinutes     int  `json:"bonusMinutes"`
	CurrentStreak    int  `json:"currentStreak"`
	LongestStreak    int  `json:"longestStreak"`
	PoolRemaining    int  `json:"poolRemainingMinutes"`
}

func localDateOnly(t time.Time) time.Time {
	y, m, d := t.In(time.Local).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.Local)
}

func streakAfterCheckIn(last *time.Time, today time.Time, prevStreak int) int {
	if last == nil {
		return 1
	}
	lastDay := localDateOnly(*last)
	diff := int(today.Sub(lastDay).Hours() / 24)
	if diff == 0 {
		return prevStreak
	}
	if diff == 1 {
		return prevStreak + 1
	}
	return 1
}

func nextRewardStep(streak int, checkedToday bool) (*int, *int) {
	proj := streak
	if !checkedToday {
		if streak == 0 {
			proj = 1
		} else {
			proj = streak + 1
		}
	}
	for _, d := range []int{3, 5, 7, 14, 30} {
		if proj <= d {
			mins := CheckInRewardForStreak(d)
			dd, mm := d, mins
			return &dd, &mm
		}
	}
	return nil, nil
}

func findCheckInOn(db *gorm.DB, teacherID uint, day time.Time) (*TeacherCheckIn, error) {
	var row TeacherCheckIn
	err := db.Where("teacher_id = ? AND check_in_date = ?",
		teacherID, localDateOnly(day)).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func latestCheckIn(db *gorm.DB, teacherID uint) (*TeacherCheckIn, error) {
	var row TeacherCheckIn
	err := db.Where("teacher_id = ?", teacherID).
		Order("check_in_date DESC, id DESC").First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func currentStreakFromLatest(latest *TeacherCheckIn, today time.Time, checkedToday bool) int {
	if latest == nil {
		return 0
	}
	last := localDateOnly(latest.CheckInDate)
	diff := int(today.Sub(last).Hours() / 24)
	if checkedToday || diff == 0 {
		return latest.Streak
	}
	if diff == 1 {
		return latest.Streak
	}
	return 0
}

func countYearCheckIns(db *gorm.DB, teacherID uint, year int) (int, error) {
	start := time.Date(year, 1, 1, 0, 0, 0, 0, time.Local)
	end := time.Date(year+1, 1, 1, 0, 0, 0, 0, time.Local)
	var n int64
	err := db.Model(&TeacherCheckIn{}).
		Where("teacher_id = ? AND check_in_date >= ? AND check_in_date < ?",
			teacherID, start, end).
		Count(&n).Error
	return int(n), err
}

func longestCheckInStreak(db *gorm.DB, teacherID uint) (int, error) {
	var maxStreak int
	err := db.Model(&TeacherCheckIn{}).
		Select("COALESCE(MAX(streak), 0)").
		Where("teacher_id = ?", teacherID).
		Scan(&maxStreak).Error
	return maxStreak, err
}

func monthCheckInMask(db *gorm.DB, teacherID uint, monthStart time.Time, days int) ([]bool, error) {
	mask := make([]bool, days)
	if days <= 0 {
		return mask, nil
	}
	monthEnd := monthStart.AddDate(0, 1, 0)
	var rows []TeacherCheckIn
	if err := db.Where("teacher_id = ? AND check_in_date >= ? AND check_in_date < ?",
		teacherID, monthStart, monthEnd).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		d := localDateOnly(r.CheckInDate).Day()
		if d >= 1 && d <= days {
			mask[d-1] = true
		}
	}
	return mask, nil
}

// recentCheckInMask 返回从 startDate（含）到 today（含）的签到布尔掩码。
// startDate 到 today 之间的每一天对应 mask 的一个元素（索引 0 = startDate）。
func recentCheckInMask(db *gorm.DB, teacherID uint, startDate, today time.Time) ([]bool, error) {
	days := int(today.Sub(startDate).Hours()/24) + 1
	if days <= 0 {
		return []bool{}, nil
	}
	mask := make([]bool, days)
	var rows []TeacherCheckIn
	if err := db.Where("teacher_id = ? AND check_in_date >= ? AND check_in_date <= ?",
		teacherID, startDate, today).
		Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, r := range rows {
		d := int(localDateOnly(r.CheckInDate).Sub(startDate).Hours()/24) + 1
		if d >= 1 && d <= days {
			mask[d-1] = true
		}
	}
	return mask, nil
}

// GetTeacherCheckInStatus 查询签到状态（不签到）。
func GetTeacherCheckInStatus(db *gorm.DB, teacherID uint, now time.Time) (*CheckInStatus, error) {
	if db == nil || teacherID == 0 {
		return nil, errors.New("invalid teacher")
	}
	now = now.In(time.Local)
	today := localDateOnly(now)

	todayRow, err := findCheckInOn(db, teacherID, today)
	if err != nil {
		return nil, err
	}
	checkedToday := todayRow != nil

	latest, err := latestCheckIn(db, teacherID)
	if err != nil {
		return nil, err
	}
	streak := currentStreakFromLatest(latest, today, checkedToday)

	yearCount, err := countYearCheckIns(db, teacherID, today.Year())
	if err != nil {
		return nil, err
	}
	longest, err := longestCheckInStreak(db, teacherID)
	if err != nil {
		return nil, err
	}

	pool, err := EnsureTeacherTeachingPool(db, teacherID)
	if err != nil {
		return nil, err
	}

	monthStart := time.Date(today.Year(), today.Month(), 1, 0, 0, 0, 0, time.Local)
	daysInMonth := time.Date(today.Year(), today.Month()+1, 0, 0, 0, 0, 0, time.Local).Day()
	mask, err := monthCheckInMask(db, teacherID, monthStart, daysInMonth)
	if err != nil {
		return nil, err
	}

	// 最近 90 天的签到掩码，用于热力图展示
	recentDays := 90
	recentStart := today.AddDate(0, 0, -(recentDays - 1))
	recentMask, err := recentCheckInMask(db, teacherID, recentStart, today)
	if err != nil {
		return nil, err
	}

	var dailyReward int
	if checkedToday {
		dailyReward = CheckInRewardForStreak(streak)
	} else {
		var lastDate *time.Time
		prevStreak := 0
		if latest != nil {
			ld := localDateOnly(latest.CheckInDate)
			lastDate = &ld
			prevStreak = latest.Streak
		}
		nextStreak := streakAfterCheckIn(lastDate, today, prevStreak)
		dailyReward = CheckInRewardForStreak(nextStreak)
	}

	nbDays, nbMins := nextRewardStep(streak, checkedToday)
	return &CheckInStatus{
		CheckedInToday:     checkedToday,
		CurrentStreak:      streak,
		LongestStreak:      longest,
		YearCheckIns:       yearCount,
		DailyReward:        dailyReward,
		NextStreakBonus:    nbDays,
		NextStreakMinutes:  nbMins,
		PoolRemaining:      pool.RemainingMinutes,
		MonthMask:          mask,
		MonthStartWeekday:  int(monthStart.Weekday()),
		RecentMask:         recentMask,
		RecentStartWeekday: int(recentStart.Weekday()),
		RecentDays:         len(recentMask),
		RecentStartDate:    recentStart.Format("2006-01-02"),
		RewardPreview:      CheckInRewardPreview(),
	}, nil
}

// DoTeacherCheckIn 今日签到：插入日期行 + 发放授课池分钟。幂等：已签则 AlreadyCheckedIn。
func DoTeacherCheckIn(db *gorm.DB, teacherID uint, now time.Time) (*CheckInResult, error) {
	if db == nil || teacherID == 0 {
		return nil, errors.New("invalid teacher")
	}
	now = now.In(time.Local)
	today := localDateOnly(now)

	var result CheckInResult
	err := db.Transaction(func(tx *gorm.DB) error {
		existing, err := findCheckInOn(tx, teacherID, today)
		if err != nil {
			return err
		}
		if existing != nil {
			pool, e := EnsureTeacherTeachingPool(tx, teacherID)
			if e != nil {
				return e
			}
			longest, e := longestCheckInStreak(tx, teacherID)
			if e != nil {
				return e
			}
			result = CheckInResult{
				AlreadyCheckedIn: true,
				CurrentStreak:    existing.Streak,
				LongestStreak:    longest,
				PoolRemaining:    pool.RemainingMinutes,
			}
			return nil
		}

		latest, err := latestCheckIn(tx, teacherID)
		if err != nil {
			return err
		}
		var lastDate *time.Time
		prevStreak := 0
		if latest != nil {
			ld := localDateOnly(latest.CheckInDate)
			lastDate = &ld
			prevStreak = latest.Streak
		}
		newStreak := streakAfterCheckIn(lastDate, today, prevStreak)
		grant := CheckInRewardForStreak(newStreak)
		bonus := grant - CheckInDailyMinutes
		if bonus < 0 {
			bonus = 0
		}

		row := TeacherCheckIn{
			TeacherID:      teacherID,
			CheckInDate:    today,
			GrantedMinutes: grant,
			Streak:         newStreak,
		}
		// 唯一索引兜底并发双签
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&row).Error; err != nil {
			return err
		}
		if row.ID == 0 {
			// 并发下未插入：当作已签
			existing, e := findCheckInOn(tx, teacherID, today)
			if e != nil {
				return e
			}
			pool, e := EnsureTeacherTeachingPool(tx, teacherID)
			if e != nil {
				return e
			}
			longest, e := longestCheckInStreak(tx, teacherID)
			if e != nil {
				return e
			}
			streak := newStreak
			if existing != nil {
				streak = existing.Streak
			}
			result = CheckInResult{
				AlreadyCheckedIn: true,
				CurrentStreak:    streak,
				LongestStreak:    longest,
				PoolRemaining:    pool.RemainingMinutes,
			}
			return nil
		}

		if err := AddTeacherTeachingPoolMinutes(tx, teacherID, grant); err != nil {
			return err
		}
		pool, err := EnsureTeacherTeachingPool(tx, teacherID)
		if err != nil {
			return err
		}
		longest, err := longestCheckInStreak(tx, teacherID)
		if err != nil {
			return err
		}

		result = CheckInResult{
			AlreadyCheckedIn: false,
			GrantedMinutes:   grant,
			DailyMinutes:     CheckInDailyMinutes,
			BonusMinutes:     bonus,
			CurrentStreak:    newStreak,
			LongestStreak:    longest,
			PoolRemaining:    pool.RemainingMinutes,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return &result, nil
}

// AddTeacherTeachingPoolMinutes 向老师授课池增加分钟（签到/活动发放）。
func AddTeacherTeachingPoolMinutes(db *gorm.DB, teacherID uint, minutes int) error {
	if minutes <= 0 {
		return nil
	}
	pool, err := EnsureTeacherTeachingPool(db, teacherID)
	if err != nil {
		return err
	}
	res := db.Model(&TeacherTeachingPool{}).
		Where("id = ?", pool.ID).
		Updates(map[string]any{
			"remaining_minutes":       gorm.Expr("remaining_minutes + ?", minutes),
			"total_allocated_minutes": gorm.Expr("total_allocated_minutes + ?", minutes),
		})
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("teacher pool not updated")
	}
	return nil
}
