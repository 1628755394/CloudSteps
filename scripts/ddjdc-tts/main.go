// ddjdc-tts: 自动登录/注册 + 调用 TTS 生成音频
//
// 用法:
//   go run . -text "hello world"
//   go run . -text "hello world" -phone amaze -pass admin123
//   go run . -text "hello world" -audio-type us -oss-prefix common/word/audio_word -out out.mp3
//
// 流程:
//   1. 若指定 -phone/-pass，先尝试登录；失败则用该账号注册。
//   2. 若未指定账号，随机生成账号密码，直接注册。
//   3. 拿到 token 后调用 /api/getaudio 触发 TTS 合成。
//   4. 按服务端规则拼接 OSS URL，下载 MP3 到 -out 指定文件。
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/md5"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"
)

const (
	baseURL    = "https://ddjdc.com"
	ossBase    = "https://ddjdc.oss-cn-beijing.aliyuncs.com"
	aesPass    = "DDJDC" // 前端硬编码的 AES passphrase
	jarCharset = "abcdefghijklmnopqrstuvwxyz0123456789"
)

// ---------- CryptoJS 兼容的 AES 加密 ----------

// evpBytesToKey 复刻 OpenSSL EVP_BytesToKey（MD5，1 次迭代）。
func evpBytesToKey(pass, salt []byte) (key, iv []byte) {
	const keyLen, ivLen = 32, 16
	var dt, out []byte
	for len(out) < keyLen+ivLen {
		h := md5.New()
		h.Write(dt)
		h.Write(pass)
		h.Write(salt)
		dt = h.Sum(nil)
		out = append(out, dt...)
	}
	return out[:keyLen], out[keyLen : keyLen+ivLen]
}

// pkcs7Pad 实现 PKCS7 填充。
func pkcs7Pad(b []byte, blockSize int) []byte {
	n := blockSize - len(b)%blockSize
	pad := bytes.Repeat([]byte{byte(n)}, n)
	return append(b, pad...)
}

// aesEncrypt 对 payload 做 CryptoJS 字符串密钥模式的 AES 加密，返回 Base64 字符串。
func aesEncrypt(payload interface{}, passphrase string) (string, error) {
	plain, err := json.Marshal(payload)
	if err != nil {
		return "", err
	}
	salt := make([]byte, 8)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	key, iv := evpBytesToKey([]byte(passphrase), salt)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}
	padded := pkcs7Pad(plain, block.BlockSize())
	ct := make([]byte, len(padded))
	cipher.NewCBCEncrypter(block, iv).CryptBlocks(ct, padded)

	raw := append([]byte("Salted__"), salt...)
	raw = append(raw, ct...)
	return base64.StdEncoding.EncodeToString(raw), nil
}

// hmacSHA256Hex 计算 HmacSHA256(text, key) 的十六进制字符串，用于音频文件名。
func hmacSHA256Hex(text, key string) string {
	m := hmac.New(sha256.New, []byte(key))
	m.Write([]byte(text))
	return hex.EncodeToString(m.Sum(nil))
}

// ---------- 随机账号 ----------

func randString(n int) string {
	b := make([]byte, n)
	maxN := big.NewInt(int64(len(jarCharset)))
	for i := range b {
		r, _ := rand.Int(rand.Reader, maxN)
		b[i] = jarCharset[r.Int64()]
	}
	return string(b)
}

func randomAccount() (phone, password string) {
	phone = "go_" + randString(10)
	// 至少 8 位，且同时包含字母和数字（服务端校验）
	// 形如 G<4随机>x<3随机>1，保证有字母也有数字
	password = "G" + randString(4) + "x" + randString(3) + "1"
	return
}

// ---------- HTTP ----------

type apiResp struct {
	Code    int             `json:"code"`
	Message string          `json:"message"`
	Data    json.RawMessage `json:"data"`
}

type userData struct {
	Token string `json:"token"`
	Name  string `json:"name"`
}

func postJSON(url string, body interface{}, token string) (*apiResp, error) {
	buf, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	req, err := http.NewRequest("POST", url, bytes.NewReader(buf))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	client := &http.Client{Timeout: 60 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == 401 {
		return nil, fmt.Errorf("HTTP 401: 鉴权失败（token 无效或缺失）")
	}
	raw, _ := io.ReadAll(resp.Body)
	var r apiResp
	if err := json.Unmarshal(raw, &r); err != nil {
		return nil, fmt.Errorf("响应解析失败: %v, body=%s", err, string(raw))
	}
	return &r, nil
}

// login 尝试登录，成功返回 token。
func login(phone, pass string) (string, error) {
	r, err := postJSON(baseURL+"/api/loginpw", map[string]string{
		"phone_number": phone,
		"password":     pass,
		"app_type":     "",
		"host_name":    "ddjdc.com",
	}, "")
	if err != nil {
		return "", err
	}
	if r.Code != 0 {
		return "", fmt.Errorf("登录失败: %s", r.Message)
	}
	var u userData
	if err := json.Unmarshal(r.Data, &u); err != nil {
		return "", err
	}
	return u.Token, nil
}

// register 注册新账号，成功返回 token。
func register(phone, pass string) (string, error) {
	r, err := postJSON(baseURL+"/api/register", map[string]string{
		"phone_number": phone,
		"password":     pass,
		"password2":    pass,
		"app_type":     "",
	}, "")
	if err != nil {
		return "", err
	}
	if r.Code != 0 {
		return "", fmt.Errorf("注册失败: %s", r.Message)
	}
	var u userData
	if err := json.Unmarshal(r.Data, &u); err != nil {
		return "", err
	}
	return u.Token, nil
}

// passwordCompliant 检查密码是否同时包含字母和数字且至少 8 位。
func passwordCompliant(p string) bool {
	if len(p) < 8 {
		return false
	}
	hasLetter, hasDigit := false, false
	for _, c := range p {
		switch {
		case (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'):
			hasLetter = true
		case c >= '0' && c <= '9':
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}

// ensureToken: 优先登录，失败则注册。
//   - 指定了账号密码：先登录；失败则尝试注册（若密码不合规则换随机合规密码）。
//   - 未指定账号：随机生成账号密码直接注册。
func ensureToken(phone, pass string) (string, string, string, error) {
	if phone != "" && pass != "" {
		tok, err := login(phone, pass)
		if err == nil {
			return tok, phone, pass, nil
		}
		fmt.Printf("[login] %v → 尝试注册\n", err)
		// 若用户密码不合规（如纯字母），换一个合规的随机密码
		regPass := pass
		if !passwordCompliant(regPass) {
			_, regPass = randomAccount()
			fmt.Printf("[register] 用户密码不合规，改用随机密码: %s\n", regPass)
		}
		tok, err2 := register(phone, regPass)
		if err2 != nil {
			return "", "", "", fmt.Errorf("注册也失败: %v（若账号已存在，请提供正确密码）", err2)
		}
		return tok, phone, regPass, nil
	}
	// 未指定账号：随机注册
	phone, pass = randomAccount()
	tok, err := register(phone, pass)
	if err != nil {
		return "", "", "", err
	}
	return tok, phone, pass, nil
}

// ttsGenerate 调用 /api/getaudio 触发 TTS 合成。
func ttsGenerate(token, audioType, ossPrefix, text, voice string) error {
	payload := map[string]interface{}{
		"audio_type": audioType,
		"oss_prefix": ossPrefix,
		"text":       text,
	}
	if strings.TrimSpace(voice) != "" {
		payload["voice"] = strings.TrimSpace(voice)
	}
	t, err := aesEncrypt(payload, aesPass)
	if err != nil {
		return err
	}
	r, err := postJSON(baseURL+"/api/getaudio", map[string]string{"t": t}, token)
	if err != nil {
		return err
	}
	if r.Code != 0 {
		return fmt.Errorf("TTS 失败: %s", r.Message)
	}
	return nil
}

// audioSuffix 根据 audio_type 返回文件名后缀（uk / us）。
func audioSuffix(audioType string) string {
	switch audioType {
	case "uk", "1":
		return "uk"
	case "us", "2":
		return "us"
	}
	return audioType
}

// downloadAudio 下载 OSS 上的 MP3。getaudio 是异步落 OSS，失败时重试。
func downloadAudio(ossPrefix, text, audioType, outPath string) error {
	suffix := audioSuffix(audioType)
	hash := hmacSHA256Hex(text, aesPass)
	url := fmt.Sprintf("%s/%s/%s_%s.mp3", ossBase, strings.Trim(ossPrefix, "/"), hash, suffix)

	client := &http.Client{Timeout: 30 * time.Second}
	var lastErr error
	for attempt := 0; attempt < 10; attempt++ {
		if attempt > 0 {
			time.Sleep(time.Duration(500*(1<<attempt)) * time.Millisecond) // 指数退避
		}
		resp, err := client.Get(url)
		if err != nil {
			lastErr = err
			continue
		}
		if resp.StatusCode == 200 {
			defer resp.Body.Close()
			data, err := io.ReadAll(resp.Body)
			if err != nil {
				return err
			}
			if err := os.WriteFile(outPath, data, 0644); err != nil {
				return err
			}
			fmt.Printf("[download] %s → %s (%d bytes)\n", url, outPath, len(data))
			return nil
		}
		resp.Body.Close()
		lastErr = fmt.Errorf("HTTP %d", resp.StatusCode)
		if resp.StatusCode == 404 {
			continue // 还没生成完
		}
		break // 其他错误不再重试
	}
	return fmt.Errorf("下载失败: %v (url=%s)", lastErr, url)
}

func main() {
	var (
		text      = flag.String("text", "", "待合成文本（必须包含英文字母）")
		phone     = flag.String("phone", "", "登录账号（留空则随机注册）")
		pass      = flag.String("pass", "", "登录密码")
		audioType = flag.String("audio-type", "uk", "音色: uk/us/1/2")
		ossPrefix = flag.String("oss-prefix", "common/word/audio_word", "OSS 目录")
		voice     = flag.String("voice", "", "自定义音色（可选）")
		out       = flag.String("out", "output.mp3", "输出 MP3 文件路径")
	)
	flag.Parse()

	if strings.TrimSpace(*text) == "" {
		fmt.Fprintln(os.Stderr, "用法: go run . -text \"hello world\" [-phone amaze -pass admin123]")
		os.Exit(1)
	}

	// 1. 获取 token
	fmt.Println("[1/3] 获取 token...")
	token, usedPhone, usedPass, err := ensureToken(*phone, *pass)
	if err != nil {
		fmt.Fprintf(os.Stderr, "获取 token 失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("     账号=%s 密码=%s token=%s...\n", usedPhone, usedPass, token[:32])

	// 2. 调用 TTS
	fmt.Printf("[2/3] 调用 TTS: text=%q audio_type=%s oss_prefix=%s\n", *text, *audioType, *ossPrefix)
	if err := ttsGenerate(token, *audioType, *ossPrefix, *text, *voice); err != nil {
		fmt.Fprintf(os.Stderr, "TTS 调用失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("     服务端返回 ok")

	// 3. 下载音频
	fmt.Printf("[3/3] 下载音频 → %s\n", *out)
	if err := downloadAudio(*ossPrefix, *text, *audioType, *out); err != nil {
		fmt.Fprintf(os.Stderr, "下载失败: %v\n", err)
		os.Exit(1)
	}
	fmt.Println("完成 ✓")
}
