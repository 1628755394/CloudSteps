package voice

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
)

// ReadyStatus describes whether realtime voice can start.
type ReadyStatus struct {
	Ready    bool   `json:"ready"`
	Provider string `json:"provider"`
	Hint     string `json:"hint"`
}

// LoadRealtimeConfig resolves realtime credentials from env (multiple fallbacks).
func LoadRealtimeConfig() (map[string]any, error) {
	raw := strings.TrimSpace(utils.GetEnv("REALTIME_CONFIG_JSON"))
	if raw != "" {
		out := map[string]any{}
		if err := json.Unmarshal([]byte(raw), &out); err != nil {
			return nil, fmt.Errorf("REALTIME_CONFIG_JSON 格式错误: %w", err)
		}
		mergeAPIKeyFallbacks(out)
		return out, nil
	}

	// Flat env vars
	provider := strings.TrimSpace(utils.GetEnv("REALTIME_PROVIDER"))
	if provider == "" {
		provider = "aliyun_omni"
	}

	cfg := map[string]any{"provider": provider}

	if appID := strings.TrimSpace(utils.GetEnv("REALTIME_APP_ID")); appID != "" {
		cfg["provider"] = "volcengine_dialogue"
		cfg["appId"] = appID
		if ak := strings.TrimSpace(utils.GetEnv("REALTIME_ACCESS_KEY")); ak != "" {
			cfg["accessKey"] = ak
		}
	}

	apiKey := firstNonEmpty(
		utils.GetEnv("REALTIME_API_KEY"),
		utils.GetEnv("DASHSCOPE_API_KEY"),
		utils.GetEnv("LLM_API_KEY"),
		utils.GetEnv("OPENAI_API_KEY"),
	)
	if apiKey != "" {
		cfg["api_key"] = apiKey
	}

	if model := strings.TrimSpace(utils.GetEnv("REALTIME_MODEL")); model != "" {
		cfg["model"] = model
	}

	if baseURL := strings.TrimSpace(utils.GetEnv("REALTIME_BASE_URL")); baseURL != "" {
		cfg["base_url"] = baseURL
	}

	// GlobalConfig fallback (loaded at startup from .env)
	if config.GlobalConfig != nil {
		if apiKey == "" {
			if k := strings.TrimSpace(config.GlobalConfig.Services.LLM.APIKey); k != "" {
				cfg["api_key"] = k
			}
		}
		if _, ok := cfg["model"]; !ok {
			if m := strings.TrimSpace(config.GlobalConfig.Services.LLM.Model); m != "" {
				cfg["model"] = m
			}
		}
	}

	mergeAPIKeyFallbacks(cfg)

	if providerIsVolcengine(cfg) {
		if strings.TrimSpace(stringField(cfg, "appId")) == "" || strings.TrimSpace(stringField(cfg, "accessKey")) == "" {
			return cfg, nil // let provider return specific error
		}
		return cfg, nil
	}

	if strings.TrimSpace(stringField(cfg, "api_key")) == "" && strings.TrimSpace(stringField(cfg, "apiKey")) == "" {
		return map[string]any{}, nil
	}
	return cfg, nil
}

func mergeAPIKeyFallbacks(cfg map[string]any) {
	if cfg == nil {
		return
	}
	if v := strings.TrimSpace(utils.GetEnv("OPENAI_API_KEY")); v != "" {
		if existing := stringField(cfg, "api_key"); existing == "" {
			cfg["api_key"] = v
		}
	}
}

func providerIsVolcengine(cfg map[string]any) bool {
	p := strings.ToLower(stringField(cfg, "provider"))
	return p == "volcengine_dialogue" || p == "volcengine"
}

func stringField(m map[string]any, key string) string {
	if m == nil {
		return ""
	}
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}

// CheckReady returns whether realtime voice is configured.
func CheckReady() ReadyStatus {
	cfg, err := LoadRealtimeConfig()
	if err != nil {
		return ReadyStatus{Hint: err.Error()}
	}
	if len(cfg) == 0 {
		return ReadyStatus{
			Hint: "未配置语音模型。请设置 REALTIME_CONFIG_JSON 或 REALTIME_API_KEY（阿里云 DashScope sk- 密钥）后重启服务",
		}
	}
	provider := stringField(cfg, "provider")
	if provider == "" {
		provider = "aliyun_omni"
	}
	if providerIsVolcengine(cfg) {
		if stringField(cfg, "appId") == "" || stringField(cfg, "accessKey") == "" {
			return ReadyStatus{
				Provider: provider,
				Hint:     "火山引擎需配置 REALTIME_APP_ID 和 REALTIME_ACCESS_KEY",
			}
		}
	} else if stringField(cfg, "api_key") == "" && stringField(cfg, "apiKey") == "" {
		return ReadyStatus{
			Provider: provider,
			Hint:     "缺少 API Key，请设置 REALTIME_API_KEY 或 DASHSCOPE_API_KEY",
		}
	}
	return ReadyStatus{Ready: true, Provider: provider, Hint: "ok"}
}
