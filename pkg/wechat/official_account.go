package wechat

import (
	"crypto/sha1"
	"encoding/xml"
	"fmt"
	"io"
	"sort"
	"strings"
)

// InboundMessage 公众号回调消息（精简字段）。
type InboundMessage struct {
	XMLName      xml.Name `xml:"xml"`
	ToUserName   string   `xml:"ToUserName"`
	FromUserName string   `xml:"FromUserName"`
	CreateTime   int64    `xml:"CreateTime"`
	MsgType      string   `xml:"MsgType"`
	Event        string   `xml:"Event"`
	Content      string   `xml:"Content"`
	MsgID        int64    `xml:"MsgId"`
}

// OutboundText 被动回复文本。
type OutboundText struct {
	XMLName      xml.Name `xml:"xml"`
	ToUserName   string   `xml:"ToUserName"`
	FromUserName string   `xml:"FromUserName"`
	CreateTime   int64    `xml:"CreateTime"`
	MsgType      string   `xml:"MsgType"`
	Content      string   `xml:"Content"`
}

func VerifySignature(token, timestamp, nonce, signature string) bool {
	if token == "" || signature == "" {
		return false
	}
	parts := []string{token, timestamp, nonce}
	sort.Strings(parts)
	sum := sha1.Sum([]byte(strings.Join(parts, "")))
	return fmt.Sprintf("%x", sum) == signature
}

func ParseInboundMessage(body []byte) (*InboundMessage, error) {
	var msg InboundMessage
	if err := xml.Unmarshal(body, &msg); err != nil {
		return nil, err
	}
	return &msg, nil
}

func ReadInboundMessage(r io.Reader) (*InboundMessage, error) {
	body, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	return ParseInboundMessage(body)
}

func BuildTextReply(toUser, fromUser, content string, ts int64) []byte {
	reply := OutboundText{
		ToUserName:   toUser,
		FromUserName: fromUser,
		CreateTime:   ts,
		MsgType:      "text",
		Content:      content,
	}
	out, _ := xml.Marshal(reply)
	return out
}
