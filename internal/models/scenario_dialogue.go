package models

import (
	"fmt"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/constants"
	common "github.com/LingByte/ling-base/common"
)

const (
	ScenarioSessionStatusPending   = "pending"
	ScenarioSessionStatusActive    = "active"
	ScenarioSessionStatusCompleted = "completed"
)

// ScenarioDialogueScenario 预设对话场景
type ScenarioDialogueScenario struct {
	common.BaseModel
	Slug        string `json:"slug" gorm:"size:64;uniqueIndex;not null;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Name        string `json:"name" gorm:"size:128;not null;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Description string `json:"description" gorm:"size:512;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Icon        string `json:"icon" gorm:"size:32;charset:utf8mb4;collate:utf8mb4_unicode_ci"` // lucide icon name
	Difficulty  string `json:"difficulty" gorm:"size:16;default:'medium';charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	AIRole      string `json:"aiRole" gorm:"size:256;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Prompt      string `json:"-" gorm:"type:longtext;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`
	SortOrder   int    `json:"sortOrder" gorm:"default:0"`
}

func (ScenarioDialogueScenario) TableName() string { return constants.TABLE_SCENARIO_DIALOGUE_SCENARIOS }

// BuildScenarioSystemPrompt composes the full realtime system prompt for a scenario.
func BuildScenarioSystemPrompt(s *ScenarioDialogueScenario) string {
	if s == nil {
		return defaultScenarioBasePrompt("English conversation partner", "General practice", "")
	}
	specific := strings.TrimSpace(s.Prompt)
	if specific == "" {
		specific = fmt.Sprintf("Guide the learner through a realistic \"%s\" conversation.", s.Name)
	}
	return defaultScenarioBasePrompt(s.AIRole, s.Name, s.Description) + "\n\n# Scenario flow\n" + specific
}

func defaultScenarioBasePrompt(role, sceneName, description string) string {
	desc := strings.TrimSpace(description)
	if desc == "" {
		desc = "Help the learner practice spoken English in this situation."
	}
	return fmt.Sprintf(`# Identity
You are %s. The learner is a Chinese student practicing spoken English in the "%s" scenario.
%s

# Language rules (mandatory)
- Speak in English for all in-character dialogue and questions.
- Use simple, natural English (CEFR A2–B1). Short sentences only.
- Do NOT switch to Chinese unless the user is completely stuck; then give one brief Chinese hint and continue in English.
- Start the session by greeting in English and briefly setting the scene IMMEDIATELY when the call connects — do not wait for the learner to speak first.

# Your responsibilities
1. Stay in character at all times.
2. Lead the conversation step by step (one question at a time).
3. Correct grammar inline when needed: "Better: [corrected sentence]"
4. Give pronunciation tips when needed: "Pronunciation: [phonetic tip]"
5. Keep each reply under 3 sentences — this is a voice call, not an essay.
6. Be warm and encouraging after each user attempt.`,
		role, sceneName, desc)
}

// ScenarioDialogueSession 用户场景对话会话
type ScenarioDialogueSession struct {
	common.BaseModel
	UserID      uint       `json:"userId" gorm:"index;not null"`
	ScenarioID  uint       `json:"scenarioId" gorm:"index;not null"`
	Status      string     `json:"status" gorm:"size:20;default:'pending';index;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	StartedAt   *time.Time `json:"startedAt"`
	EndedAt     *time.Time `json:"endedAt"`
	DurationSec int        `json:"durationSec" gorm:"default:0"`

	FluencyScore       int `json:"fluencyScore" gorm:"default:0"`
	AccuracyScore      int `json:"accuracyScore" gorm:"default:0"`
	PronunciationScore int `json:"pronunciationScore" gorm:"default:0"`
	OverallScore       int `json:"overallScore" gorm:"default:0"`
	TurnCount          int `json:"turnCount" gorm:"default:0"`
	UserWordCount      int `json:"userWordCount" gorm:"default:0"`
	CorrectionCount    int `json:"correctionCount" gorm:"default:0"`
	PronunciationHints int `json:"pronunciationHints" gorm:"default:0"`

	ReviewSummary string `json:"reviewSummary" gorm:"type:mediumtext;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	ReviewDetail  string `json:"reviewDetail" gorm:"type:mediumtext;charset:utf8mb4;collate:utf8mb4_unicode_ci"`

	Scenario *ScenarioDialogueScenario `json:"scenario,omitempty" gorm:"foreignKey:ScenarioID"`
	Turns    []ScenarioDialogueTurn    `json:"turns,omitempty" gorm:"foreignKey:SessionID"`
}

func (ScenarioDialogueSession) TableName() string { return constants.TABLE_SCENARIO_DIALOGUE_SESSIONS }

// ScenarioDialogueTurn 对话轮次记录
type ScenarioDialogueTurn struct {
	common.BaseModel
	SessionID        uint   `json:"sessionId" gorm:"index;not null"`
	Role             string `json:"role" gorm:"size:16;not null;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	Content          string `json:"content" gorm:"type:longtext;charset:utf8mb4;collate:utf8mb4_unicode_ci"`
	HasCorrection    bool   `json:"hasCorrection" gorm:"default:false"`
	HasPronunciation bool   `json:"hasPronunciation" gorm:"default:false"`
	TurnIndex        int    `json:"turnIndex" gorm:"default:0"`
}

func (ScenarioDialogueTurn) TableName() string { return constants.TABLE_SCENARIO_DIALOGUE_TURNS }

// DefaultScenarios 内置场景（迁移后种子写入）
var DefaultScenarios = []ScenarioDialogueScenario{
	{
		Slug:        "restaurant",
		Name:        "餐厅点餐",
		Description: "在餐厅与服务员自然交流，练习点餐、询问菜品和结账。",
		Icon:        "utensils",
		Difficulty:  "easy",
		AIRole:      "a friendly restaurant waiter in an English-speaking country",
		SortOrder:   1,
		Prompt: `Flow: greet → show to table → take order → ask about drinks/sides → handle special requests → offer dessert → bring bill.
Open with: "Good evening! Welcome to our restaurant. Table for how many?"`,
	},
	{
		Slug:        "airport",
		Name:        "机场出行",
		Description: "模拟机场值机、安检、问路等真实出行场景。",
		Icon:        "plane",
		Difficulty:  "medium",
		AIRole:      "an airport check-in staff member",
		SortOrder:   2,
		Prompt: `Flow: check-in → passport & baggage → security directions → gate info → boarding time.
Open with: "Hello! May I see your passport and booking confirmation, please?"`,
	},
	{
		Slug:        "job-interview",
		Name:        "求职面试",
		Description: "模拟英文求职面试，练习自我介绍和常见面试问答。",
		Icon:        "briefcase",
		Difficulty:  "hard",
		AIRole:      "a professional HR interviewer at a tech company",
		SortOrder:   3,
		Prompt: `Flow: welcome → self-introduction → strengths → past experience → why this role → candidate questions → close.
Open with: "Thank you for coming in today. Please tell me a little about yourself."`,
	},
	{
		Slug:        "hotel",
		Name:        "酒店入住",
		Description: "练习酒店预订、入住登记和客房服务沟通。",
		Icon:        "building",
		Difficulty:  "easy",
		AIRole:      "a hotel front desk clerk",
		SortOrder:   4,
		Prompt: `Flow: greeting → reservation check → ID → room key → wifi/breakfast info → checkout time.
Open with: "Good afternoon! Do you have a reservation with us?"`,
	},
	{
		Slug:        "shopping",
		Name:        "商场购物",
		Description: "在商店询问价格、尺码、退换货等日常购物用语。",
		Icon:        "shopping-bag",
		Difficulty:  "easy",
		AIRole:      "a helpful shop assistant in a clothing store",
		SortOrder:   5,
		Prompt: `Flow: greet → what they're looking for → sizes/colors → fitting room → price → payment/returns policy.
Open with: "Hi there! Can I help you find anything today?"`,
	},
}
