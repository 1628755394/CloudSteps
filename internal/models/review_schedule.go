package models

import "time"

// EbbinghausReviewDays 艾宾浩斯复习间隔（天）；首项对应学完次日，后续为距上次复习的天数。
var EbbinghausReviewDays = []int{1, 2, 4, 7, 15, 30, 45, 60, 90, 120}

type ReviewCurvePreset string

const (
	ReviewCurveTimes3  ReviewCurvePreset = "times3"
	ReviewCurveTimes5  ReviewCurvePreset = "times5"
	ReviewCurveTimes7  ReviewCurvePreset = "times7"
	ReviewCurveTimes10 ReviewCurvePreset = "times10"
)

func intervalsForReviewTimes(n int) []int {
	if n < 1 {
		n = 5
	}
	if n > len(EbbinghausReviewDays) {
		n = len(EbbinghausReviewDays)
	}
	out := make([]int, n)
	copy(out, EbbinghausReviewDays[:n])
	return out
}

var reviewCurvePresets = map[ReviewCurvePreset][]int{
	ReviewCurveTimes3:  intervalsForReviewTimes(3),
	ReviewCurveTimes5:  intervalsForReviewTimes(5),
	ReviewCurveTimes7:  intervalsForReviewTimes(7),
	ReviewCurveTimes10: intervalsForReviewTimes(10),
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

func ReviewIntervalsForPreset(p string) []int {
	preset := NormalizeReviewCurvePreset(p)
	if v, ok := reviewCurvePresets[preset]; ok {
		return v
	}
	return reviewCurvePresets[ReviewCurveTimes5]
}

func ReviewIntervalsForUser(user *User) []int {
	if user == nil {
		return reviewCurvePresets[ReviewCurveTimes5]
	}
	return ReviewIntervalsForPreset(user.ReviewCurvePreset)
}

func ReviewTimesCount(p string) int {
	switch NormalizeReviewCurvePreset(p) {
	case ReviewCurveTimes3:
		return 3
	case ReviewCurveTimes5:
		return 5
	case ReviewCurveTimes7:
		return 7
	case ReviewCurveTimes10:
		return 10
	default:
		return 5
	}
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

// FirstReviewDueAt 学完后的首次复习：用户时区次日 0 点（UTC 存储）。
func FirstReviewDueAt(loc *time.Location) time.Time {
	if loc == nil {
		loc = time.FixedZone("CST", 8*3600)
	}
	now := time.Now().In(loc)
	tomorrow := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc).AddDate(0, 0, 1)
	return tomorrow.UTC()
}

func UserReviewLocation(user *User) *time.Location {
	// 后续可接用户时区字段；当前默认东八区
	return time.FixedZone("CST", 8*3600)
}

func ReviewDueAfterSuccess(now time.Time, currentStage int, preset string) (time.Time, int) {
	intervals := ReviewIntervalsForPreset(preset)
	newStage := currentStage + 1
	if newStage >= len(intervals) {
		return now, newStage
	}
	days := intervals[newStage]
	if days < 1 {
		days = 1
	}
	return now.AddDate(0, 0, days), newStage
}

func ReviewDueAfterFail(now time.Time, currentStage int, preset string) (time.Time, int) {
	intervals := ReviewIntervalsForPreset(preset)
	newStage := currentStage - 1
	if newStage < 0 {
		newStage = 0
	}
	dueDays := 1
	if newStage < len(intervals) && intervals[newStage] > 1 {
		dueDays = intervals[newStage]
	}
	if dueDays < 1 {
		dueDays = 1
	}
	return now.AddDate(0, 0, dueDays), newStage
}
