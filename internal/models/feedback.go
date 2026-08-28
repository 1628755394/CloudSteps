package models

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"
)

const (
	FeedbackStatusOpen   = "open"
	FeedbackStatusClosed = "closed"

	FeedbackRoleUser  = "user"
	FeedbackRoleAdmin = "admin"

	FeedbackContentMinRunes = 4
	FeedbackContentMaxRunes = 2000
	FeedbackContactMaxRunes = 128
	FeedbackPreviewMaxRunes = 80
)

var (
	ErrFeedbackClosed         = errors.New("feedback ticket is closed")
	ErrFeedbackContentInvalid = errors.New("feedback content is invalid")
	ErrFeedbackContactInvalid = errors.New("feedback contact is invalid")
)

// FeedbackTicket is a support conversation opened by a signed-in user.
// The opening message lives on the ticket; later messages are FeedbackReply rows.
type FeedbackTicket struct {
	BaseModel
	UserID           uint            `json:"userId" gorm:"index;not null"`
	Content          string          `json:"content" gorm:"type:text;not null"`
	Contact          string          `json:"contact,omitempty" gorm:"size:128"`
	Status           string          `json:"status" gorm:"size:16;index;not null;default:open"`
	LastRepliedAt    *time.Time      `json:"lastRepliedAt,omitempty"`
	LastReplierRole  string          `json:"lastReplierRole,omitempty" gorm:"size:16"`
	LastReplyPreview string          `json:"lastReplyPreview,omitempty" gorm:"size:255"`
	ReplyCount       int             `json:"replyCount" gorm:"not null;default:0"`
	Replies          []FeedbackReply `json:"replies,omitempty" gorm:"foreignKey:TicketID"`
	User             *User           `json:"user,omitempty" gorm:"foreignKey:UserID"`
}

func (FeedbackTicket) TableName() string { return "feedback_tickets" }

func (t *FeedbackTicket) CanReply() bool {
	return t != nil && t.Status != FeedbackStatusClosed && !t.IsSoftDeleted()
}

// FeedbackReply is one message on a feedback ticket, from the user or an admin.
type FeedbackReply struct {
	BaseModel
	TicketID uint   `json:"ticketId" gorm:"index;not null"`
	AuthorID uint   `json:"authorId" gorm:"index;not null"`
	Role     string `json:"role" gorm:"size:16;not null"`
	Content  string `json:"content" gorm:"type:text;not null"`
}

func (FeedbackReply) TableName() string { return "feedback_replies" }

func NormalizeFeedbackContent(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	n := utf8.RuneCountInString(s)
	if n < FeedbackContentMinRunes || n > FeedbackContentMaxRunes {
		return "", ErrFeedbackContentInvalid
	}
	return s, nil
}

func NormalizeFeedbackContact(raw string) (string, error) {
	s := strings.TrimSpace(raw)
	if s == "" {
		return "", nil
	}
	if utf8.RuneCountInString(s) > FeedbackContactMaxRunes {
		return "", ErrFeedbackContactInvalid
	}
	return s, nil
}

func PreviewFeedback(raw string, maxRunes int) string {
	if maxRunes <= 0 {
		maxRunes = FeedbackPreviewMaxRunes
	}
	s := strings.Join(strings.Fields(raw), " ")
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	return string(runes[:maxRunes]) + "…"
}

func NewFeedbackTicket(userID uint, content, contact, operator string) (*FeedbackTicket, error) {
	body, err := NormalizeFeedbackContent(content)
	if err != nil {
		return nil, err
	}
	contactVal, err := NormalizeFeedbackContact(contact)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	ticket := &FeedbackTicket{
		UserID:           userID,
		Content:          body,
		Contact:          contactVal,
		Status:           FeedbackStatusOpen,
		LastRepliedAt:    &now,
		LastReplierRole:  FeedbackRoleUser,
		LastReplyPreview: PreviewFeedback(body, FeedbackPreviewMaxRunes),
	}
	ticket.SetCreateInfo(operator)
	return ticket, nil
}

func NewFeedbackReply(ticketID, authorID uint, role, content, operator string) (*FeedbackReply, error) {
	body, err := NormalizeFeedbackContent(content)
	if err != nil {
		return nil, err
	}
	if role != FeedbackRoleUser && role != FeedbackRoleAdmin {
		role = FeedbackRoleUser
	}
	reply := &FeedbackReply{
		TicketID: ticketID,
		AuthorID: authorID,
		Role:     role,
		Content:  body,
	}
	reply.SetCreateInfo(operator)
	return reply, nil
}
