package handlers

import (
	"github.com/LingByte/ling-base/apidocs/humax"
	"errors"
	"fmt"
	auth "github.com/LingByte/CloudStepsGo/pkg/middlewares"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/stores"
	response "github.com/LingByte/ling-base/common/response/gin"
	lbstores "github.com/LingByte/ling-base/stores"
	"github.com/gin-gonic/gin"
)

const maxPreviewBytes int64 = 32 << 20

func (h *Handlers) registerStorageAdminRoutes(r *humax.Group) {
	admin := r.Group("admin")
	admin.Use(auth.Required, auth.AdminRequired)
	st := admin.Group("storage")
	{
		st.GET("", h.handleStorageInfo)
		st.GET("/buckets", h.handleStorageListBuckets)
		st.GET("/files", h.handleStorageListFiles)
		st.POST("/files", h.handleStorageUploadFile)
		st.GET("/files/info", h.handleStorageFileInfo)
		st.GET("/files/url", h.handleStorageFileURL)
		st.GET("/files/raw", h.handleStorageFileRaw)
		st.DELETE("/files", h.handleStorageDeleteFile)
		st.POST("/files/batch-delete", h.handleStorageBatchDelete)

		// 统计 & 监控
		st.GET("/stats/bucket", h.handleStorageBucketStats)
		st.GET("/stats/cdn", h.handleStorageCDNStats)
		st.GET("/stats/api", h.handleStorageAPIStats)
		st.GET("/stats/origin", h.handleStorageOriginStats)
	}
}

func requireStorageManager(c *gin.Context) stores.ObjectStorageManager {
	m := stores.DefaultManager()
	if m == nil {
		response.FailI18n(c, "storage.no_admin_api", "")
		return nil
	}
	return m
}

func (h *Handlers) handleStorageInfo(c *gin.Context) {
	s := stores.Default()
	response.SuccessI18n(c, "common.ok", gin.H{
		"kind":               stores.DefaultStoreKind,
		"supportsManagement": stores.SupportsManagement(s),
		"supportsMultipart":  lbstores.SupportsMultipart(s),
		"supportsStats":      stores.SupportsStats(s),
		"defaultBucket":      stores.DefaultBucketName(),
		"defaultDomain":      stores.DefaultDomain(),
	})
}

func (h *Handlers) handleStorageListBuckets(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	resp, err := m.ListBuckets(&lbstores.ListBucketsRequest{
		Prefix:  strings.TrimSpace(c.Query("prefix")),
		Region:  strings.TrimSpace(c.Query("region")),
		MaxKeys: queryInt(c, "maxKeys", 0),
	})
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", resp)
}

func (h *Handlers) handleStorageListFiles(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	bucket := strings.TrimSpace(c.Query("bucket"))
	delimiter := c.Query("delimiter")
	if _, ok := c.GetQuery("delimiter"); !ok {
		delimiter = "/"
	}
	limit := queryInt(c, "limit", 20)
	if limit < 1 || limit > 1000 {
		limit = 20
	}
	resp, err := m.ListFiles(bucket, &lbstores.ListFilesRequest{
		Prefix:    strings.TrimSpace(c.Query("prefix")),
		Marker:    strings.TrimSpace(c.Query("marker")),
		Limit:     limit,
		Delimiter: delimiter,
	})
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", resp)
}

const maxStorageUploadBytes int64 = 64 << 20 // 64 MiB

func (h *Handlers) handleStorageUploadFile(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}

	file, header, err := c.Request.FormFile("file")
	if err != nil {
		response.FailI18n(c, "storage.select_file", err.Error())
		return
	}
	defer file.Close()

	if header.Size > maxStorageUploadBytes {
		response.FailI18n(c, "storage.file_too_large", nil, maxStorageUploadBytes>>20)
		return
	}

	bucket := strings.TrimSpace(c.PostForm("bucket"))
	key := strings.TrimSpace(c.PostForm("key"))
	if key == "" {
		name := path.Base(strings.ReplaceAll(header.Filename, "\\", "/"))
		if name == "" || name == "." || name == "/" {
			response.FailI18n(c, "storage.key_infer_failed", "")
			return
		}
		prefix := strings.TrimSpace(c.PostForm("prefix"))
		if prefix != "" && !strings.HasSuffix(prefix, "/") {
			prefix += "/"
		}
		key = prefix + name
	}
	key = strings.TrimLeft(key, "/")
	if key == "" || strings.Contains(key, "..") {
		response.FailI18n(c, "storage.invalid_key", "")
		return
	}

	limited := io.LimitReader(file, maxStorageUploadBytes+1)
	size := header.Size
	if size < 0 {
		size = 0
	}
	if err := m.UploadFile(bucket, key, limited, size); err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}

	response.SuccessI18n(c, "storage.uploaded", gin.H{
		"bucket": bucket,
		"key":    key,
		"size":   header.Size,
		"name":   header.Filename,
	})
}

func (h *Handlers) handleStorageFileInfo(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	key := strings.TrimSpace(c.Query("key"))
	if key == "" {
		response.FailI18n(c, "storage.key_required", "")
		return
	}
	info, err := m.GetFileInfo(strings.TrimSpace(c.Query("bucket")), key)
	if err != nil {
		if errors.Is(err, stores.ErrAttachmentNotExist) {
			response.FailI18n(c, "cloze.not_found", err.Error())
			return
		}
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", info)
}

func (h *Handlers) handleStorageFileURL(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	key := strings.TrimSpace(c.Query("key"))
	if key == "" {
		response.FailI18n(c, "storage.key_required", "")
		return
	}
	sec := queryInt(c, "expires", 3600)
	if sec < 60 {
		sec = 60
	}
	if sec > 86400 {
		sec = 86400
	}
	url, err := m.GetFileURL(strings.TrimSpace(c.Query("bucket")), key, time.Duration(sec)*time.Second)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", gin.H{"url": url, "expires": sec})
}

func (h *Handlers) handleStorageFileRaw(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	key := strings.TrimSpace(c.Query("key"))
	if key == "" {
		response.FailI18n(c, "storage.key_required", "")
		return
	}
	bucket := strings.TrimSpace(c.Query("bucket"))
	download := c.Query("download") == "1"

	info, err := m.GetFileInfo(bucket, key)
	if err != nil && !errors.Is(err, stores.ErrAttachmentNotExist) {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	ctype := "application/octet-stream"
	var size int64
	if info != nil {
		size = info.Size
		if info.ContentType != "" {
			ctype = info.ContentType
		}
	}
	if !download && size > maxPreviewBytes {
		response.FailI18n(c, "common.file_too_large", "")
		return
	}

	body, n, err := openStorageObject(m, bucket, key)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	defer body.Close()
	if n > 0 {
		size = n
	}
	if !download && size > maxPreviewBytes {
		response.FailI18n(c, "common.file_too_large", "")
		return
	}

	filename := strings.ReplaceAll(path.Base(key), `"`, "")
	disp := "inline"
	if download {
		disp = "attachment"
	}
	c.Header("Content-Type", ctype)
	c.Header("Content-Disposition", fmt.Sprintf(`%s; filename="%s"`, disp, filename))
	if size > 0 {
		c.Header("Content-Length", strconv.FormatInt(size, 10))
	}
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, body)
}

func openStorageObject(m stores.ObjectStorageManager, bucket, key string) (io.ReadCloser, int64, error) {
	def := stores.DefaultBucketName()
	if bucket == "" || bucket == def {
		return stores.Default().Read(key)
	}
	u, err := m.GetFileURL(bucket, key, 10*time.Minute)
	if err != nil || !(strings.HasPrefix(u, "http://") || strings.HasPrefix(u, "https://")) {
		return stores.Default().Read(key)
	}
	req, err := http.NewRequest(http.MethodGet, u, nil)
	if err != nil {
		return nil, 0, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, 0, err
	}
	if resp.StatusCode >= 400 {
		_ = resp.Body.Close()
		return nil, 0, fmt.Errorf("fetch object: %s", resp.Status)
	}
	return resp.Body, resp.ContentLength, nil
}

func (h *Handlers) handleStorageDeleteFile(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	key := strings.TrimSpace(c.Query("key"))
	if key == "" {
		response.FailI18n(c, "storage.key_required", "")
		return
	}
	if err := m.DeleteFile(strings.TrimSpace(c.Query("bucket")), key); err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.deleted", gin.H{"key": key})
}

type storageBatchDeleteReq struct {
	Bucket   string   `json:"bucket"`
	Keys     []string `json:"keys"`
	Prefixes []string `json:"prefixes"`
}

func (h *Handlers) handleStorageBatchDelete(c *gin.Context) {
	m := requireStorageManager(c)
	if m == nil {
		return
	}
	var req storageBatchDeleteReq
	if err := c.ShouldBindJSON(&req); err != nil {
		response.FailI18n(c, "common.invalid_params", err.Error())
		return
	}
	bucket := strings.TrimSpace(req.Bucket)
	if len(req.Keys) == 0 && len(req.Prefixes) == 0 {
		response.FailI18n(c, "storage.keys_or_prefixes_required", "")
		return
	}

	prefixes := normalizeStoragePrefixes(req.Prefixes)
	keySet := make(map[string]struct{})

	for _, p := range prefixes {
		keys, err := listAllObjectKeys(m, bucket, p)
		if err != nil {
			response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
			return
		}
		for _, k := range keys {
			keySet[k] = struct{}{}
		}
	}

	for _, raw := range req.Keys {
		k := strings.TrimSpace(raw)
		if k == "" {
			continue
		}
		if coveredByStoragePrefix(k, prefixes) {
			continue
		}
		keySet[k] = struct{}{}
	}

	if len(keySet) == 0 {
		response.SuccessI18n(c, "common.deleted", gin.H{"deleted": 0, "failed": 0})
		return
	}

	deleted, failed := 0, 0
	for k := range keySet {
		if err := m.DeleteFile(bucket, k); err != nil {
			failed++
			continue
		}
		deleted++
	}
	response.SuccessI18n(c, "common.deleted", gin.H{"deleted": deleted, "failed": failed})
}

func normalizeStoragePrefixes(prefixes []string) []string {
	seen := make(map[string]struct{})
	var out []string
	for _, raw := range prefixes {
		p := strings.TrimSpace(raw)
		if p == "" {
			continue
		}
		if _, ok := seen[p]; ok {
			continue
		}
		seen[p] = struct{}{}
		out = append(out, p)
	}
	return out
}

func coveredByStoragePrefix(key string, prefixes []string) bool {
	for _, p := range prefixes {
		if strings.HasPrefix(key, p) {
			return true
		}
	}
	return false
}

func listAllObjectKeys(m stores.ObjectStorageManager, bucket, prefix string) ([]string, error) {
	var keys []string
	marker := ""
	for {
		resp, err := m.ListFiles(bucket, &lbstores.ListFilesRequest{
			Prefix: prefix,
			Marker: marker,
			Limit:  1000,
		})
		if err != nil {
			return nil, err
		}
		for _, f := range resp.Files {
			if f.Key != "" {
				keys = append(keys, f.Key)
			}
		}
		if !resp.IsTruncated || resp.Marker == "" {
			break
		}
		marker = resp.Marker
	}
	return keys, nil
}

func queryInt(c *gin.Context, name string, fallback int) int {
	raw := strings.TrimSpace(c.Query(name))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

// ──────────────────────────────────────────────
// Storage statistics endpoints
// ──────────────────────────────────────────────

func requireStatsProvider(c *gin.Context) stores.StorageStatsProvider {
	p := stores.DefaultStatsProvider()
	if p == nil {
		response.FailI18n(c, "storage.no_stats_api", "")
		return nil
	}
	return p
}

// parseTimeRange 从 query 参数解析时间范围（start/end 为 RFC3339 或 unix 秒）。
func parseTimeRange(c *gin.Context) (lbstores.TimeRange, error) {
	startStr := strings.TrimSpace(c.Query("start"))
	endStr := strings.TrimSpace(c.Query("end"))
	var tr lbstores.TimeRange
	if startStr == "" || endStr == "" {
		// 默认最近 7 天
		tr.End = time.Now()
		tr.Start = tr.End.AddDate(0, 0, -7)
		return tr, nil
	}
	start, err := parseTimeFlexible(startStr)
	if err != nil {
		return tr, fmt.Errorf("invalid start: %w", err)
	}
	end, err := parseTimeFlexible(endStr)
	if err != nil {
		return tr, fmt.Errorf("invalid end: %w", err)
	}
	tr.Start = start
	tr.End = end
	return tr, nil
}

func parseTimeFlexible(s string) (time.Time, error) {
	// 先试 unix 秒
	if n, err := strconv.ParseInt(s, 10, 64); err == nil {
		return time.Unix(n, 0), nil
	}
	// 再试 RFC3339
	return time.Parse(time.RFC3339, s)
}

func parseGranularity(c *gin.Context) lbstores.Granularity {
	g := strings.TrimSpace(c.Query("granularity"))
	switch lbstores.Granularity(g) {
	case lbstores.Granularity5Min, lbstores.GranularityHour, lbstores.GranularityMonth:
		return lbstores.Granularity(g)
	default:
		return lbstores.GranularityDay
	}
}

// resolveDomains 从 query 参数解析域名列表；如果客户端未传，则自动从当前存储后端的环境变量配置中获取。
// 返回的域名已去除协议前缀（http:// / https://）和末尾斜杠。
func resolveDomains(c *gin.Context) []string {
	domains := strings.TrimSpace(c.Query("domains"))
	if domains != "" {
		return splitAndCleanDomains(domains)
	}
	// 自动从环境变量获取当前后端配置的域名
	cfgDomain := strings.TrimSpace(stores.DefaultDomain())
	if cfgDomain == "" {
		return nil
	}
	return splitAndCleanDomains(cfgDomain)
}

// resolveBucket 从 query 参数解析 bucket 名；如果客户端未传，则自动使用当前存储后端的默认 bucket。
func resolveBucket(c *gin.Context) string {
	bucket := strings.TrimSpace(c.Query("bucket"))
	if bucket != "" {
		return bucket
	}
	return stores.DefaultBucketName()
}

func splitAndCleanDomains(s string) []string {
	parts := strings.Split(s, ",")
	var result []string
	for _, p := range parts {
		d := strings.TrimSpace(p)
		d = strings.TrimPrefix(d, "https://")
		d = strings.TrimPrefix(d, "http://")
		d = strings.TrimSuffix(d, "/")
		if d != "" {
			result = append(result, d)
		}
	}
	return result
}

// handleStorageBucketStats GET /admin/storage/stats/bucket?bucket=xxx
func (h *Handlers) handleStorageBucketStats(c *gin.Context) {
	p := requireStatsProvider(c)
	if p == nil {
		return
	}
	bucket := strings.TrimSpace(c.Query("bucket"))
	if bucket == "" {
		bucket = stores.DefaultBucketName()
	}
	stats, err := p.GetBucketStats(bucket)
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", stats)
}

// handleStorageCDNStats GET /admin/storage/stats/cdn?bucket=&domains=&start=&end=&granularity=
func (h *Handlers) handleStorageCDNStats(c *gin.Context) {
	p := requireStatsProvider(c)
	if p == nil {
		return
	}
	tr, err := parseTimeRange(c)
	if err != nil {
		response.FailI18n(c, "common.invalid_params", err.Error())
		return
	}
	domainList := resolveDomains(c)
	resp, err := p.GetCDNStats(&lbstores.CDNStatsRequest{
		Bucket:      resolveBucket(c),
		Domains:     domainList,
		Range:       tr,
		Granularity: parseGranularity(c),
	})
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", resp)
}

// handleStorageAPIStats GET /admin/storage/stats/api?bucket=&start=&end=&granularity=
func (h *Handlers) handleStorageAPIStats(c *gin.Context) {
	p := requireStatsProvider(c)
	if p == nil {
		return
	}
	tr, err := parseTimeRange(c)
	if err != nil {
		response.FailI18n(c, "common.invalid_params", err.Error())
		return
	}
	resp, err := p.GetAPIRequestStats(&lbstores.APIStatsRequest{
		Bucket:      resolveBucket(c),
		Range:       tr,
		Granularity: parseGranularity(c),
	})
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", resp)
}

// handleStorageOriginStats GET /admin/storage/stats/origin?bucket=&domains=&start=&end=&granularity=
func (h *Handlers) handleStorageOriginStats(c *gin.Context) {
	p := requireStatsProvider(c)
	if p == nil {
		return
	}
	tr, err := parseTimeRange(c)
	if err != nil {
		response.FailI18n(c, "common.invalid_params", err.Error())
		return
	}
	domainList := resolveDomains(c)
	resp, err := p.GetOriginFetchStats(&lbstores.OriginStatsRequest{
		Bucket:      resolveBucket(c),
		Domains:     domainList,
		Range:       tr,
		Granularity: parseGranularity(c),
	})
	if err != nil {
		response.AbortWithStatusJSON(c, http.StatusBadGateway, err)
		return
	}
	response.SuccessI18n(c, "common.ok", resp)
}
