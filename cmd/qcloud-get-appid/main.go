// qcloud-get-appid：用 SecretId / SecretKey 调用 CAM GetUserAppId，反查账号 AppId。
//
// 文档：https://cloud.tencent.com/document/api/598/70416
//
// 用法：
//
//	go run ./cmd/qcloud-get-appid -secret-id AKIDxxx -secret-key yyy
//	TENCENTCLOUD_SECRET_ID=... TENCENTCLOUD_SECRET_KEY=... go run ./cmd/qcloud-get-appid
package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	host    = "cam.tencentcloudapi.com"
	service = "cam"
	action  = "GetUserAppId"
	version = "2019-01-16"
	region  = "" // 该接口可不传 Region
)

func main() {
	secretID := flag.String("secret-id", "", "腾讯云 SecretId（也可用环境变量 TENCENTCLOUD_SECRET_ID）")
	secretKey := flag.String("secret-key", "", "腾讯云 SecretKey（也可用环境变量 TENCENTCLOUD_SECRET_KEY）")
	flag.Parse()

	sid := strings.TrimSpace(firstNonEmpty(*secretID, os.Getenv("TENCENTCLOUD_SECRET_ID"), os.Getenv("QCLOUD_SECRET_ID")))
	sk := strings.TrimSpace(firstNonEmpty(*secretKey, os.Getenv("TENCENTCLOUD_SECRET_KEY"), os.Getenv("QCLOUD_SECRET_KEY")))
	if sid == "" || sk == "" {
		log.Fatal("请提供 -secret-id / -secret-key，或设置 TENCENTCLOUD_SECRET_ID / TENCENTCLOUD_SECRET_KEY")
	}

	payload := "{}"
	now := time.Now().UTC()
	authorization, timestamp, err := tc3Sign(sid, sk, service, host, action, payload, now)
	if err != nil {
		log.Fatalf("签名失败: %v", err)
	}

	req, err := http.NewRequest(http.MethodPost, "https://"+host, bytes.NewBufferString(payload))
	if err != nil {
		log.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Host", host)
	req.Header.Set("X-TC-Action", action)
	req.Header.Set("X-TC-Version", version)
	req.Header.Set("X-TC-Timestamp", timestamp)
	req.Header.Set("Authorization", authorization)
	if region != "" {
		req.Header.Set("X-TC-Region", region)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Fatalf("请求失败: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)

	var parsed struct {
		Response struct {
			AppId     uint64 `json:"AppId"`
			Uin       string `json:"Uin"`
			OwnerUin  string `json:"OwnerUin"`
			RequestId string `json:"RequestId"`
			Error     *struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"Response"`
	}
	if err := json.Unmarshal(body, &parsed); err != nil {
		log.Fatalf("解析响应失败: %v\n原始: %s", err, string(body))
	}
	if parsed.Response.Error != nil {
		log.Fatalf("API 错误 [%s]: %s (RequestId=%s)",
			parsed.Response.Error.Code, parsed.Response.Error.Message, parsed.Response.RequestId)
	}

	fmt.Printf("AppId:    %d\n", parsed.Response.AppId)
	fmt.Printf("Uin:      %s\n", parsed.Response.Uin)
	fmt.Printf("OwnerUin: %s\n", parsed.Response.OwnerUin)
	fmt.Printf("RequestId:%s\n", parsed.Response.RequestId)
	fmt.Printf("\n可写入 QCLOUD_TTS_ACCOUNTS 的片段:\n")
	fmt.Printf(`{"appId":"%d","secretId":"%s","secret":"%s"}`+"\n", parsed.Response.AppId, sid, sk)
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// tc3Sign 腾讯云 API 3.0 签名（TC3-HMAC-SHA256）。
// 参考：https://cloud.tencent.com/document/api/598/70416 与公共签名文档。
func tc3Sign(secretID, secretKey, service, host, action, payload string, t time.Time) (authorization, timestamp string, err error) {
	timestamp = fmt.Sprintf("%d", t.Unix())
	date := t.Format("2006-01-02")

	hashedPayload := sha256Hex([]byte(payload))
	canonicalHeaders := fmt.Sprintf("content-type:application/json; charset=utf-8\nhost:%s\nx-tc-action:%s\n",
		strings.ToLower(host), strings.ToLower(action))
	signedHeaders := "content-type;host;x-tc-action"
	canonicalRequest := strings.Join([]string{
		"POST",
		"/",
		"",
		canonicalHeaders,
		signedHeaders,
		hashedPayload,
	}, "\n")

	credentialScope := fmt.Sprintf("%s/%s/tc3_request", date, service)
	stringToSign := strings.Join([]string{
		"TC3-HMAC-SHA256",
		timestamp,
		credentialScope,
		sha256Hex([]byte(canonicalRequest)),
	}, "\n")

	secretDate := hmacSHA256([]byte("TC3"+secretKey), date)
	secretService := hmacSHA256(secretDate, service)
	secretSigning := hmacSHA256(secretService, "tc3_request")
	signature := hex.EncodeToString(hmacSHA256(secretSigning, stringToSign))

	authorization = fmt.Sprintf(
		"TC3-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s",
		secretID, credentialScope, signedHeaders, signature,
	)
	return authorization, timestamp, nil
}

func sha256Hex(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

func hmacSHA256(key []byte, msg string) []byte {
	m := hmac.New(sha256.New, key)
	_, _ = m.Write([]byte(msg))
	return m.Sum(nil)
}
