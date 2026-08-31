package wechat_test

import (
	"encoding/xml"
	"testing"

	"github.com/LingByte/CloudStepsGo/pkg/wechat"
)

func TestPlainURLVerifySignature(t *testing.T) {
	token := "heathcetide"
	ts := "1710000001"
	nonce := "abc123"
	sig := wechat.ComputePlainSignature(token, ts, nonce)
	if !wechat.VerifySignature(token, ts, nonce, sig) {
		t.Fatal("plain URL signature should verify")
	}
	if wechat.VerifySignature(token, ts, nonce, "bad") {
		t.Fatal("invalid signature should fail")
	}
}

func TestEncryptedMessageRoundTrip(t *testing.T) {
	token := "heathcetide"
	key := "9kzzvCyvgDLS890mB0AYSS5rcK8UaKBsd85nPk6Owp5"
	crypt, err := wechat.NewMessageCrypt(token, key, "")
	if err != nil {
		t.Fatal(err)
	}

	plain := []byte("hello-wechat")
	ts := "1710000001"
	nonce := "nonce123"

	replyXML, err := crypt.EncryptReply(plain, ts, nonce)
	if err != nil {
		t.Fatal(err)
	}
	var env struct {
		Encrypt string `xml:"Encrypt"`
	}
	if err := xml.Unmarshal(replyXML, &env); err != nil || env.Encrypt == "" {
		t.Fatal("missing encrypt in reply xml")
	}

	msgSig := wechat.ComputeMsgSignature(token, ts, nonce, env.Encrypt)
	body, err := crypt.DecryptRequestBody(replyXML, msgSig, ts, nonce)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != string(plain) {
		t.Fatalf("body=%q want %q", body, plain)
	}
}
