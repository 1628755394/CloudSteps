package models

import (
	"strconv"
	"time"
)

// 抗遗忘排期：开课当日 = 第 1 天（与打印 PDF 工具一致，非 Day0 模型）。
// 数组每一项为「第 N 天」的 N，即相对开课日 0 点起的日历日序号。

type ReviewCurvePreset string

const (
	ReviewCurveTimes3  ReviewCurvePreset = "times3"
	ReviewCurveTimes5  ReviewCurvePreset = "times5"
	ReviewCurveTimes7  ReviewCurvePreset = "times7"
	ReviewCurveTimes10 ReviewCurvePreset = "times10"
)

var reviewScheduleByPreset = map[ReviewCurvePreset][]int{
	ReviewCurveTimes3:  {1, 2, 4},
	ReviewCurveTimes5:  {1, 2, 4, 7, 11},
	ReviewCurveTimes7:  {1, 2, 4, 7, 11, 15, 20},
	ReviewCurveTimes10: {1, 2, 3, 5, 7, 9, 12, 14, 17, 21},
}

func NormalizeReviewCurvePreset(p string) ReviewCurvePreset {
	switch ReviewCurvePreset(p) {
	case ReviewCurveTimes3, ReviewCurveTimes5, ReviewCurveTimes7, ReviewCurveTimes10:
		return ReviewCurvePreset(p)
	case "standard", "interval10":
		return ReviewCurveTimes10
	case "interval3":
		return ReviewCurveTimes3
	case "interval5":
		return ReviewCurveTimes5
	default:
		return ReviewCurveTimes5
	}
}

func ReviewScheduleDaysForPreset(p string) []int {
	preset := NormalizeReviewCurvePreset(p)
	if v, ok := reviewScheduleByPreset[preset]; ok {
		out := make([]int, len(v))
		copy(out, v)
		return out
	}
	out := make([]int, len(reviewScheduleByPreset[ReviewCurveTimes5]))
	copy(out, reviewScheduleByPreset[ReviewCurveTimes5])
	return out
}

// ReviewIntervalsForPreset 兼容旧名，值为「第 N 天」序号而非间隔天数。
func ReviewIntervalsForPreset(p string) []int {
	return ReviewScheduleDaysForPreset(p)
}

func ReviewIntervalsForUser(user *User) []int {
	if user == nil {
		return ReviewScheduleDaysForPreset(string(ReviewCurveTimes5))
	}
	return ReviewScheduleDaysForPreset(user.ReviewCurvePreset)
}

func ReviewScheduleDaysForUser(user *User) []int {
	return ReviewIntervalsForUser(user)
}

func ReviewTimesCount(p string) int {
	return len(ReviewScheduleDaysForPreset(p))
}

func ReviewCurvePresetLabel(p string) string {
	switch NormalizeReviewCurvePreset(p) {
	case ReviewCurveTimes3:
		return "3次抗遗忘"
	case ReviewCurveTimes5:
		return "5次抗遗忘"
	case ReviewCurveTimes7:
		return "7次抗遗忘"
	case ReviewCurveTimes10:
		return "10次抗遗忘"
	default:
		return "5次抗遗忘"
	}
}

// ReviewDayLabel 表格表头：第 X 天
func ReviewDayLabel(dayNum int) string {
	if dayNum < 1 {
		dayNum = 1
	}
	return "第" + strconv.Itoa(dayNum) + "天"
}

// LearnDayStart 开课日 0 点（用户时区）
func LearnDayStart(t time.Time, loc *time.Location) time.Time {
	if loc == nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	lt := t.In(loc)
	return time.Date(lt.Year(), lt.Month(), lt.Day(), 0, 0, 0, 0, loc)
}

// FirstReviewDueAt 学完后的首次复习：开课当日（第 1 天）本地 0 点。
func FirstReviewDueAt(loc *time.Location) time.Time {
	return LearnDayStart(time.Now(), loc).UTC()
}

func UserReviewLocation(user *User) *time.Location {
	return time.FixedZone("CST", 8*3600)
}

func ReviewAnchorFromState(state *UserWordState, fallback time.Time) time.Time {
	if state != nil && state.FirstLearnedAt != nil && !state.FirstLearnedAt.IsZero() {
		return *state.FirstLearnedAt
	}
	return fallback
}

// ReviewDueAtForStage 按开课日锚点与 stage 计算 due_at（stage 0 = 第 1 次复习）。
func ReviewDueAtForStage(anchor time.Time, stage int, preset string, loc *time.Location) time.Time {
	schedule := ReviewScheduleDaysForPreset(preset)
	if stage < 0 {
		stage = 0
	}
	if stage >= len(schedule) {
		stage = len(schedule) - 1
	}
	dayNum := schedule[stage]
	if dayNum < 1 {
		dayNum = 1
	}
	start := LearnDayStart(anchor, loc)
	return start.AddDate(0, 0, dayNum-1).UTC()
}

func ReviewDueAfterSuccess(now time.Time, currentStage int, preset string, anchor time.Time, loc *time.Location) (time.Time, int) {
	schedule := ReviewScheduleDaysForPreset(preset)
	newStage := currentStage + 1
	if newStage >= len(schedule) {
		return now, newStage
	}
	return ReviewDueAtForStage(anchor, newStage, preset, loc), newStage
}

func ReviewDueAfterFail(now time.Time, currentStage int, preset string, anchor time.Time, loc *time.Location) (time.Time, int) {
	newStage := currentStage - 1
	if newStage < 0 {
		newStage = 0
	}
	return ReviewDueAtForStage(anchor, newStage, preset, loc), newStage
}

// ReviewRemainingDueFallsOnDay 从当前 stage 起，剩余抗遗忘计划日是否落在 dayStart 所在自然日。
// 用于抗遗忘日历：一次性按曲线铺开，翻日期即可看到后续计划（不必等复习推进后才出现）。
func ReviewRemainingDueFallsOnDay(
	anchor time.Time,
	stage int,
	preset string,
	dayStart time.Time,
	loc *time.Location,
) bool {
	if loc == nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	if stage < 0 {
		stage = 0
	}
	schedule := ReviewScheduleDaysForPreset(preset)
	local := dayStart.In(loc)
	dayStartUTC := time.Date(local.Year(), local.Month(), local.Day(), 0, 0, 0, 0, loc).UTC()
	dayEndUTC := dayStartUTC.Add(24 * time.Hour)
	for i := stage; i < len(schedule); i++ {
		due := ReviewDueAtForStage(anchor, i, preset, loc)
		if !due.Before(dayStartUTC) && due.Before(dayEndUTC) {
			return true
		}
	}
	return false
}

