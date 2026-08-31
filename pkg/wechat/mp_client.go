package wechat

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/yuin/goldmark"
)

// TokenStore 用于缓存 access_token。
type TokenStore interface {
	Get(ctx context.Context, key string) (string, bool)
	Set(ctx context.Context, key, value string, ttl time.Duration)
}

// DraftArticle 微信公众号草稿图文（单篇）。
type DraftArticle struct {
	Title            string `json:"title"`
	Author           string `json:"author,omitempty"`
	Digest           string `json:"digest,omitempty"`
	Content          string `json:"content"`
	ContentSourceURL string `json:"content_source_url,omitempty"`
	ThumbMediaID     string `json:"thumb_media_id"`
}

// MPClient 公众号服务端 API 客户端。
type MPClient struct {
	AppID     string
	AppSecret string
	Store     TokenStore
	HTTP      *http.Client
}

func (c *MPClient) httpClient() *http.Client {
	if c.HTTP != nil {
		return c.HTTP
	}
	return http.DefaultClient
}

func (c *MPClient) AccessToken(ctx context.Context) (string, error) {
	if c.AppID == "" || c.AppSecret == "" {
		return "", fmt.Errorf("wechat appId/appSecret missing")
	}
	cacheKey := "wechat:access_token:" + c.AppID
	if c.Store != nil {
		if token, ok := c.Store.Get(ctx, cacheKey); ok && token != "" {
			return token, nil
		}
	}
	url := fmt.Sprintf(
		"https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=%s&secret=%s",
		c.AppID, c.AppSecret,
	)
	resp, err := c.httpClient().Get(url)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var parsed struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
		ErrCode     int    `json:"errcode"`
		ErrMsg      string `json:"errmsg"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return "", err
	}
	if parsed.AccessToken == "" {
		if parsed.ErrCode == 40164 {
			return "", fmt.Errorf("IP 未加入微信公众平台白名单，请在 mp.weixin.qq.com → 设置与开发 → 基本配置 → IP白名单 中添加服务器出口 IP")
		}
		if parsed.ErrMsg != "" {
			if parsed.ErrCode != 0 {
				return "", fmt.Errorf("wechat token (%d): %s", parsed.ErrCode, parsed.ErrMsg)
			}
			return "", fmt.Errorf("wechat token: %s", parsed.ErrMsg)
		}
		return "", fmt.Errorf("wechat token empty")
	}
	if c.Store != nil {
		ttl := time.Duration(parsed.ExpiresIn-120) * time.Second
		if ttl < time.Minute {
			ttl = time.Minute
		}
		c.Store.Set(ctx, cacheKey, parsed.AccessToken, ttl)
	}
	return parsed.AccessToken, nil
}

type apiError struct {
	ErrCode int    `json:"errcode"`
	ErrMsg  string `json:"errmsg"`
}

func (e apiError) Error() string {
	if e.ErrMsg == "" {
		return fmt.Sprintf("wechat api errcode=%d", e.ErrCode)
	}
	return fmt.Sprintf("wechat api: %s (%d)", e.ErrMsg, e.ErrCode)
}

// HumanizeAPIError maps WeChat API errors to operator-facing messages.
func HumanizeAPIError(err error) string {
	if err == nil {
		return ""
	}
	var ae apiError
	if errors.As(err, &ae) {
		switch ae.ErrCode {
		case 40164:
			return "IP 未加入微信公众平台白名单，请在 mp.weixin.qq.com → 设置与开发 → 基本配置 → IP白名单 中添加服务器出口 IP"
		case 48001:
			return "公众号无此接口调用权限（api unauthorized）。拉取/发布已发布图文需要 freepublish 相关接口：服务号通常可用；订阅号需完成企业认证，个人订阅号无法使用"
		case 40001:
			return "access_token 无效，请检查 AppSecret 或稍后重试"
		case 40013:
			return "无效的 AppID，请检查配置中的 wechat.appId"
		case 40125:
			return "无效的 AppSecret，请检查配置中的 wechat.appSecret"
		case 40004:
			return "媒体文件类型或大小不符合微信要求（封面图请使用 JPG/PNG，不超过 2MB）"
		case 45002:
			return "媒体文件大小超过微信限制"
		case 45003:
			return "媒体文件类型不符合微信要求"
		}
		if ae.ErrMsg != "" {
			return fmt.Sprintf("%s (%d)", ae.ErrMsg, ae.ErrCode)
		}
	}
	msg := err.Error()
	if strings.Contains(msg, "40164") || strings.Contains(msg, "invalid ip") {
		return "IP 未加入微信公众平台白名单，请在 mp.weixin.qq.com → 设置与开发 → 基本配置 → IP白名单 中添加服务器出口 IP"
	}
	return msg
}

func decodeAPIResponse(body []byte, out any) error {
	if out == nil {
		var base apiError
		if err := json.Unmarshal(body, &base); err != nil {
			return err
		}
		if base.ErrCode != 0 {
			return base
		}
		return nil
	}
	if err := json.Unmarshal(body, out); err != nil {
		return err
	}
	type errCarrier struct {
		ErrCode int    `json:"errcode"`
		ErrMsg  string `json:"errmsg"`
	}
	var base errCarrier
	_ = json.Unmarshal(body, &base)
	if base.ErrCode != 0 {
		return apiError{ErrCode: base.ErrCode, ErrMsg: base.ErrMsg}
	}
	return nil
}

func (c *MPClient) postJSON(ctx context.Context, path string, payload any, out any) error {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return err
	}
	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	url := fmt.Sprintf("https://api.weixin.qq.com%s?access_token=%s", path, token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	return decodeAPIResponse(raw, out)
}

// AddDraft 新增草稿，返回 media_id。
func (c *MPClient) AddDraft(ctx context.Context, article DraftArticle) (string, error) {
	var out struct {
		MediaID string `json:"media_id"`
	}
	err := c.postJSON(ctx, "/cgi-bin/draft/add", map[string]any{
		"articles": []DraftArticle{article},
	}, &out)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(out.MediaID) == "" {
		return "", fmt.Errorf("wechat draft add: empty media_id")
	}
	return out.MediaID, nil
}

// UpdateDraft 更新草稿中的单篇文章（index 从 0 起）。
func (c *MPClient) UpdateDraft(ctx context.Context, mediaID string, index int, article DraftArticle) error {
	return c.postJSON(ctx, "/cgi-bin/draft/update", map[string]any{
		"media_id": mediaID,
		"index":    index,
		"articles": article,
	}, nil)
}

// SubmitPublish 发布草稿。
func (c *MPClient) SubmitPublish(ctx context.Context, mediaID string) (string, error) {
	var out struct {
		PublishID string `json:"publish_id"`
	}
	err := c.postJSON(ctx, "/cgi-bin/freepublish/submit", map[string]string{
		"media_id": mediaID,
	}, &out)
	if err != nil {
		return "", err
	}
	return out.PublishID, nil
}

// PublishedNewsItem 已发布图文条目。
type PublishedNewsItem struct {
	Title            string `json:"title"`
	Author           string `json:"author"`
	Digest           string `json:"digest"`
	Content          string `json:"content"`
	ContentSourceURL string `json:"content_source_url"`
	ThumbMediaID     string `json:"thumb_media_id"`
	ThumbURL         string `json:"thumb_url"`
	URL              string `json:"url"`
	IsDeleted        bool   `json:"is_deleted"`
}

// PublishedArticleBatch 一次发布任务（可含多图文）。
type PublishedArticleBatch struct {
	ArticleID  string              `json:"article_id"`
	UpdateTime int64               `json:"update_time"`
	NewsItems  []PublishedNewsItem `json:"news_items"`
}

type publishedBatchRaw struct {
	ArticleID  string `json:"article_id"`
	UpdateTime int64  `json:"update_time"`
	Content    struct {
		NewsItems []PublishedNewsItem `json:"news_item"`
	} `json:"content"`
}

func parsePublishedBatches(items []publishedBatchRaw) []PublishedArticleBatch {
	out := make([]PublishedArticleBatch, 0, len(items))
	for _, item := range items {
		out = append(out, PublishedArticleBatch{
			ArticleID:  item.ArticleID,
			UpdateTime: item.UpdateTime,
			NewsItems:  item.Content.NewsItems,
		})
	}
	return out
}

// BatchGetPublished 获取已发布图文列表。
func (c *MPClient) BatchGetPublished(ctx context.Context, offset, count int, noContent bool) (int, []PublishedArticleBatch, error) {
	if count < 1 {
		count = 10
	}
	if count > 20 {
		count = 20
	}
	noContentVal := 0
	if noContent {
		noContentVal = 1
	}
	var out struct {
		TotalCount int                 `json:"total_count"`
		ItemCount  int                 `json:"item_count"`
		Items      []publishedBatchRaw `json:"item"`
	}
	err := c.postJSON(ctx, "/cgi-bin/freepublish/batchget", map[string]any{
		"offset":     offset,
		"count":      count,
		"no_content": noContentVal,
	}, &out)
	if err != nil {
		return 0, nil, err
	}
	return out.TotalCount, parsePublishedBatches(out.Items), nil
}

// GetPublishedArticle 获取单条已发布图文详情。
func (c *MPClient) GetPublishedArticle(ctx context.Context, articleID string) (*PublishedArticleBatch, error) {
	articleID = strings.TrimSpace(articleID)
	if articleID == "" {
		return nil, fmt.Errorf("article_id required")
	}
	var out struct {
		NewsItems []PublishedNewsItem `json:"news_item"`
	}
	err := c.postJSON(ctx, "/cgi-bin/freepublish/getarticle", map[string]string{
		"article_id": articleID,
	}, &out)
	if err != nil {
		return nil, err
	}
	return &PublishedArticleBatch{
		ArticleID: articleID,
		NewsItems: out.NewsItems,
	}, nil
}

// UploadPermanentThumb 上传图文封面永久图片素材，返回 media_id（用作 thumb_media_id）。
// 微信草稿封面应使用 type=image（≤2MB），而非 type=thumb（≤64KB 仅 JPG）。
func (c *MPClient) UploadPermanentThumb(ctx context.Context, filename string, r io.Reader) (string, error) {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return "", err
	}
	filename = strings.TrimSpace(filename)
	if filename == "" {
		filename = "cover.jpg"
	}
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("media", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, r); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/material/add_material?access_token=%s&type=image", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var out struct {
		MediaID string `json:"media_id"`
		apiError
	}
	if err := decodeAPIResponse(raw, &out); err != nil {
		return "", err
	}
	mediaID := strings.TrimSpace(out.MediaID)
	if mediaID == "" {
		return "", fmt.Errorf("wechat cover upload: empty media_id")
	}
	return mediaID, nil
}

// UploadArticleImage 上传图文内图片，返回可在 content HTML 中使用的 URL。
func (c *MPClient) UploadArticleImage(ctx context.Context, filename string, r io.Reader) (string, error) {
	token, err := c.AccessToken(ctx)
	if err != nil {
		return "", err
	}
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("media", filename)
	if err != nil {
		return "", err
	}
	if _, err := io.Copy(part, r); err != nil {
		return "", err
	}
	if err := writer.Close(); err != nil {
		return "", err
	}
	url := fmt.Sprintf("https://api.weixin.qq.com/cgi-bin/media/uploadimg?access_token=%s", token)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := c.httpClient().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	var out struct {
		URL string `json:"url"`
		apiError
	}
	if err := decodeAPIResponse(raw, &out); err != nil {
		return "", err
	}
	if strings.TrimSpace(out.URL) == "" {
		return "", fmt.Errorf("wechat image upload: empty url")
	}
	return out.URL, nil
}

// MarkdownToHTML 将 Markdown 转为微信公众号可用的 HTML。
func MarkdownToHTML(markdown string) (string, error) {
	var buf bytes.Buffer
	if err := goldmark.Convert([]byte(markdown), &buf); err != nil {
		return "", err
	}
	html := strings.TrimSpace(buf.String())
	if html == "" {
		return "<p></p>", nil
	}
	return html, nil
}
