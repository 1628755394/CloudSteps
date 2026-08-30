package handlers

import (
	"net/http"
	"os/exec"
	"runtime/debug"
	"strings"
	"time"

	"github.com/LingByte/ling-base/apidocs/humax"
	response "github.com/LingByte/ling-base/common/response/gin"
	"github.com/gin-gonic/gin"
)

// AppInfo 进程元信息（对齐 demo）。
type AppInfo struct {
	Name      string
	Version   string
	BuildTime string
	GitCommit string
}

func isBuildPlaceholder(v string) bool {
	switch strings.TrimSpace(v) {
	case "", "dev", "none", "unknown":
		return true
	default:
		return false
	}
}

// EnrichAppInfo 补齐未通过 ldflags 注入的版本元数据（build info → 本地 git）。
func EnrichAppInfo(info *AppInfo) {
	if info == nil {
		return
	}
	fillAppInfoFromBuildInfo(info)
	fillAppInfoFromGit(info)
}

func fillAppInfoFromBuildInfo(info *AppInfo) {
	bi, ok := debug.ReadBuildInfo()
	if !ok {
		return
	}
	for _, s := range bi.Settings {
		switch s.Key {
		case "vcs.revision":
			if isBuildPlaceholder(info.GitCommit) {
				rev := s.Value
				if len(rev) > 7 {
					rev = rev[:7]
				}
				info.GitCommit = rev
			}
		case "vcs.time":
			if isBuildPlaceholder(info.BuildTime) {
				info.BuildTime = s.Value
			}
		}
	}
}

func fillAppInfoFromGit(info *AppInfo) {
	needVersion := isBuildPlaceholder(info.Version)
	needCommit := isBuildPlaceholder(info.GitCommit)
	needTime := isBuildPlaceholder(info.BuildTime)
	if !needVersion && !needCommit && !needTime {
		return
	}
	if needCommit {
		if out, err := exec.Command("git", "rev-parse", "--short", "HEAD").Output(); err == nil {
			if v := strings.TrimSpace(string(out)); v != "" {
				info.GitCommit = v
			}
		}
	}
	if needVersion {
		if out, err := exec.Command("git", "describe", "--tags", "--always", "--dirty").Output(); err == nil {
			if v := strings.TrimSpace(string(out)); v != "" {
				info.Version = v
			}
		}
		if isBuildPlaceholder(info.Version) && !isBuildPlaceholder(info.GitCommit) {
			info.Version = "dev-" + info.GitCommit
		}
	}
	if needTime {
		if out, err := exec.Command("git", "log", "-1", "--format=%cI").Output(); err == nil {
			if v := strings.TrimSpace(string(out)); v != "" {
				info.BuildTime = v
			}
		}
		if isBuildPlaceholder(info.BuildTime) {
			info.BuildTime = time.Now().UTC().Format(time.RFC3339)
		}
	}
}

// RegisterSystem 注册健康检查 / 版本（根路径，写入 OpenAPI）。
func (h *Handlers) RegisterSystem(r *humax.Group, info AppInfo) {
	EnrichAppInfo(&info)

	r.GET("/health", func(c *gin.Context) {
		response.Success(c, gin.H{
			"status": "up",
			"time":   time.Now().UTC().Format(time.RFC3339),
		})
	})
	r.GET("/live", func(c *gin.Context) {
		response.Success(c, gin.H{"status": "alive"})
	})
	r.GET("/ready", func(c *gin.Context) {
		if h.db == nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"code": http.StatusServiceUnavailable,
				"msg":  "not ready",
				"data": gin.H{"status": "not_ready"},
			})
			return
		}
		sqlDB, err := h.db.DB()
		if err != nil || sqlDB.Ping() != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"code": http.StatusServiceUnavailable,
				"msg":  "not ready",
				"data": gin.H{"status": "not_ready"},
			})
			return
		}
		response.Success(c, gin.H{"status": "ready"})
	})

	r.GET("/api/version", func(c *gin.Context) {
		response.Success(c, VersionData{
			Name:      info.Name,
			Version:   info.Version,
			BuildTime: info.BuildTime,
			GitCommit: info.GitCommit,
		})
	})
}
