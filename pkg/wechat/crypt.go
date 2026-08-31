package wechat

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha1"
	"encoding/base64"
	"encoding/binary"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"
)

// MessageCrypt 公众号消息加解密（兼容 / 安全模式）。
type MessageCrypt struct {
	token          string
	encodingAESKey []byte
	appID          string
}

func NewMessageCrypt(token, encodingAESKey, appID string) (*MessageCrypt, error) {
	token = strings.TrimSpace(token)
	appID = strings.TrimSpace(appID)
	if token == "" {
		return nil, errors.New("empty token")
	}
	if encodingAESKey == "" {
		return nil, errors.New("empty encoding aes key")
	}
	key, err := base64.StdEncoding.DecodeString(encodingAESKey + "=")
	if err != nil || len(key) != 32 {
		return nil, errors.New("invalid EncodingAESKey")
	}
	return &MessageCrypt{token: token, encodingAESKey: key, appID: appID}, nil
}

func sign(parts ...string) string {
	sort.Strings(parts)
	sum := sha1.Sum([]byte(strings.Join(parts, "")))
	return fmt.Sprintf("%x", sum)
}

// VerifyMsgSignature 明文 / 兼容模式签名校验。
func VerifyMsgSignature(token, timestamp, nonce, signature string, encrypted ...string) bool {
	parts := []string{token, timestamp, nonce}
	parts = append(parts, encrypted...)
	return sign(parts...) == signature
}

// ComputePlainSignature URL 验证 / 明文消息：sha1(sort(token, timestamp, nonce))。
func ComputePlainSignature(token, timestamp, nonce string) string {
	return sign(token, timestamp, nonce)
}

// ComputeMsgSignature 加密消息体：sha1(sort(token, timestamp, nonce, encrypt))。
func ComputeMsgSignature(token, timestamp, nonce string, parts ...string) string {
	all := append([]string{token, timestamp, nonce}, parts...)
	return sign(all...)
}

func (m *MessageCrypt) VerifyURL(timestamp, nonce, msgSignature, echoStr string) bool {
	return VerifyMsgSignature(m.token, timestamp, nonce, msgSignature, echoStr)
}

func (m *MessageCrypt) DecryptEchoStr(echoStr string) (string, error) {
	plain, err := m.decryptCipherText(echoStr)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}

type encryptedEnvelope struct {
	XMLName      xml.Name `xml:"xml"`
	Encrypt      string   `xml:"Encrypt"`
	MsgSignature string   `xml:"MsgSignature"`
}

// DecryptRequestBody 解密 POST 消息体，返回明文 XML。
func (m *MessageCrypt) DecryptRequestBody(body []byte, msgSignature, timestamp, nonce string) ([]byte, error) {
	var env encryptedEnvelope
	if err := xml.Unmarshal(body, &env); err != nil {
		return nil, err
	}
	if env.Encrypt == "" {
		return body, nil
	}
	if !VerifyMsgSignature(m.token, timestamp, nonce, msgSignature, env.Encrypt) {
		return nil, errors.New("invalid msg_signature")
	}
	return m.decryptCipherText(env.Encrypt)
}

func (m *MessageCrypt) decryptCipherText(cipherText string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(cipherText)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(m.encodingAESKey)
	if err != nil {
		return nil, err
	}
	if len(raw)%block.BlockSize() != 0 {
		return nil, errors.New("invalid ciphertext block size")
	}
	iv := m.encodingAESKey[:16]
	mode := cipher.NewCBCDecrypter(block, iv)
	plain := make([]byte, len(raw))
	mode.CryptBlocks(plain, raw)
	plain, err = pkcs7Unpad(plain, block.BlockSize())
	if err != nil {
		return nil, err
	}
	if len(plain) < 20 {
		return nil, errors.New("plaintext too short")
	}
	msgLen := binary.BigEndian.Uint32(plain[16:20])
	if int(msgLen)+20 > len(plain) {
		return nil, errors.New("invalid msg length")
	}
	msg := plain[20 : 20+msgLen]
	if m.appID != "" {
		appID := string(plain[20+msgLen:])
		if appID != m.appID {
			return nil, errors.New("appid mismatch")
		}
	}
	return msg, nil
}

// EncryptReply 加密被动回复（兼容模式）。
func (m *MessageCrypt) EncryptReply(replyXML []byte, timestamp, nonce string) ([]byte, error) {
	encrypted, err := m.encryptPlain(replyXML)
	if err != nil {
		return nil, err
	}
	sig := sign(m.token, timestamp, nonce, encrypted)
	out := fmt.Sprintf(
		"<xml><Encrypt><![CDATA[%s]]></Encrypt><MsgSignature><![CDATA[%s]]></MsgSignature><TimeStamp>%s</TimeStamp><Nonce><![CDATA[%s]]></Nonce></xml>",
		encrypted, sig, timestamp, nonce,
	)
	return []byte(out), nil
}

func (m *MessageCrypt) encryptPlain(plain []byte) (string, error) {
	block, err := aes.NewCipher(m.encodingAESKey)
	if err != nil {
		return "", err
	}
	random := make([]byte, 16)
	if _, err := io.ReadFull(rand.Reader, random); err != nil {
		return "", err
	}
	msgLen := make([]byte, 4)
	binary.BigEndian.PutUint32(msgLen, uint32(len(plain)))
	buf := bytes.NewBuffer(nil)
	buf.Write(random)
	buf.Write(msgLen)
	buf.Write(plain)
	if m.appID != "" {
		buf.WriteString(m.appID)
	}
	padded, err := pkcs7Pad(buf.Bytes(), block.BlockSize())
	if err != nil {
		return "", err
	}
	iv := m.encodingAESKey[:16]
	mode := cipher.NewCBCEncrypter(block, iv)
	out := make([]byte, len(padded))
	mode.CryptBlocks(out, padded)
	return base64.StdEncoding.EncodeToString(out), nil
}

func pkcs7Pad(data []byte, blockSize int) ([]byte, error) {
	pad := blockSize - len(data)%blockSize
	if pad == 0 {
		pad = blockSize
	}
	out := make([]byte, len(data)+pad)
	copy(out, data)
	for i := len(data); i < len(out); i++ {
		out[i] = byte(pad)
	}
	return out, nil
}

func pkcs7Unpad(data []byte, blockSize int) ([]byte, error) {
	if len(data) == 0 || len(data)%blockSize != 0 {
		return nil, errors.New("invalid pkcs7 data")
	}
	pad := int(data[len(data)-1])
	if pad <= 0 || pad > blockSize {
		return nil, errors.New("invalid pkcs7 padding")
	}
	for i := 0; i < pad; i++ {
		if data[len(data)-1-i] != byte(pad) {
			return nil, errors.New("invalid pkcs7 padding")
		}
	}
	return data[:len(data)-pad], nil
}
