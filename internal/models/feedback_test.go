package models

import (
	"strings"
	"testing"
)

func TestNormalizeFeedbackContent(t *testing.T) {
	if _, err := NormalizeFeedbackContent("  hi  "); err != ErrFeedbackContentInvalid {
		t.Fatalf("short content: got %v", err)
	}
	got, err := NormalizeFeedbackContent("  课程显示不对  ")
	if err != nil {
		t.Fatal(err)
	}
	if got != "课程显示不对" {
		t.Fatalf("got %q", got)
	}
	if _, err := NormalizeFeedbackContent(strings.Repeat("啊", FeedbackContentMaxRunes+1)); err != ErrFeedbackContentInvalid {
		t.Fatalf("too long: got %v", err)
	}
}

func TestPreviewFeedback(t *testing.T) {
	if got := PreviewFeedback("  a\n b  c ", 10); got != "a b c" {
		t.Fatalf("got %q", got)
	}
	long := strings.Repeat("字", 10)
	if got := PreviewFeedback(long, 4); got != "字字字字…" {
		t.Fatalf("got %q", got)
	}
}

func TestNewFeedbackTicketAndReply(t *testing.T) {
	ticket, err := NewFeedbackTicket(7, "课表周六滑不动", "wechat:abc", "7")
	if err != nil {
		t.Fatal(err)
	}
	if ticket.Status != FeedbackStatusOpen || ticket.LastReplierRole != FeedbackRoleUser {
		t.Fatalf("ticket %+v", ticket)
	}
	if !ticket.CanReply() {
		t.Fatal("open ticket should accept replies")
	}
	reply, err := NewFeedbackReply(ticket.ID, 1, FeedbackRoleAdmin, "已在看，稍后修", "1")
	if err != nil {
		t.Fatal(err)
	}
	if reply.Role != FeedbackRoleAdmin || reply.Content != "已在看，稍后修" {
		t.Fatalf("reply %+v", reply)
	}
	ticket.Status = FeedbackStatusClosed
	if ticket.CanReply() {
		t.Fatal("closed ticket should reject replies")
	}
}
