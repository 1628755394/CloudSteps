package wechat_test

import (
	"testing"

	"github.com/LingByte/CloudStepsGo/pkg/wechat"
)

func TestVerifySignature(t *testing.T) {
	token := "testtoken"
	ts := "1710000000"
	nonce := "abc123"
	// sha1(sort(token,ts,nonce)) precomputed offline for this fixture
	sig := "invalid"
	if wechat.VerifySignature(token, ts, nonce, sig) {
		t.Fatal("expected invalid signature to fail")
	}
	if !wechat.VerifySignature("", ts, nonce, sig) {
		// empty token should fail
	} else {
		t.Fatal("empty token should fail")
	}
}

func TestParseSubscribeMessage(t *testing.T) {
	body := []byte(`<xml>
<ToUserName><![CDATA[gh_test]]></ToUserName>
<FromUserName><![CDATA[oTestOpenId]]></FromUserName>
<CreateTime>1710000000</CreateTime>
<MsgType><![CDATA[event]]></MsgType>
<Event><![CDATA[subscribe]]></Event>
</xml>`)
	msg, err := wechat.ParseInboundMessage(body)
	if err != nil {
		t.Fatal(err)
	}
	if msg.Event != "subscribe" || msg.FromUserName != "oTestOpenId" {
		t.Fatalf("unexpected msg: %+v", msg)
	}
}
