package synthesizer

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync/atomic"

	"github.com/LingByte/ling-base/common"
	aliyuntts "github.com/LingByte/ling-base/synthesizer/aliyun"
	awstts "github.com/LingByte/ling-base/synthesizer/aws"
	azuretts "github.com/LingByte/ling-base/synthesizer/azure"
	baidutts "github.com/LingByte/ling-base/synthesizer/baidu"
	coquitts "github.com/LingByte/ling-base/synthesizer/coqui"
	elevenlabs "github.com/LingByte/ling-base/synthesizer/elevenlabs"
	fishaudio "github.com/LingByte/ling-base/synthesizer/fishaudio"
	fishspeech "github.com/LingByte/ling-base/synthesizer/fishspeech"
	googletts "github.com/LingByte/ling-base/synthesizer/google"
	localtts "github.com/LingByte/ling-base/synthesizer/local"
	minimaxes "github.com/LingByte/ling-base/synthesizer/minimax"
	openaitts "github.com/LingByte/ling-base/synthesizer/openai"
	qcloudtts "github.com/LingByte/ling-base/synthesizer/qcloud"
	qiniutts "github.com/LingByte/ling-base/synthesizer/qiniu"
	volctts "github.com/LingByte/ling-base/synthesizer/volcengine"
	xunfeitts "github.com/LingByte/ling-base/synthesizer/xunfei"
	pollytypes "github.com/aws/aws-sdk-go-v2/service/polly/types"
)

// DefaultQCloudVoiceType 腾讯云默认音色（智莉），不从环境变量读取。
const DefaultQCloudVoiceType int64 = 1005

// QCloudAccount 腾讯云 TTS 账号凭证（来自 QCLOUD_TTS_ACCOUNTS JSON 数组）。
type QCloudAccount struct {
	AppID     string `json:"appId"`
	SecretID  string `json:"secretId"`
	SecretKey string `json:"secret"`
}

var qcloudAccountCursor atomic.Uint64

// ConfigFromEnv 按厂商从环境变量拼装 ling-base Config（指针，满足 GetProvider）。
func ConfigFromEnv(provider Provider) (Config, error) {
	p := NormalizeProvider(string(provider))
	switch p {
	case ProviderTencent:
		return qcloudConfigFromEnv(), nil
	case ProviderAliyun:
		cfg := aliyuntts.NewAliyunTTSConfig(common.GetEnv("DASHSCOPE_API_KEY"))
		if v := common.GetEnv("ALIYUN_TTS_VOICE"); v != "" {
			cfg.Voice = v
		}
		if v := common.GetEnv("ALIYUN_TTS_MODEL"); v != "" {
			cfg.Model = v
		}
		return &cfg, nil
	case ProviderAWS:
		region := firstNonEmpty(common.GetEnv("AWS_REGION"), common.GetEnv("AWS_DEFAULT_REGION"), "us-east-1")
		format := firstNonEmpty(common.GetEnv("AWS_POLLY_OUTPUT_FORMAT"), "pcm")
		voice := firstNonEmpty(common.GetEnv("AWS_POLLY_VOICE_ID"), "Joanna")
		cfg := awstts.NewAmazonTTSOption(region, pollytypes.OutputFormat(format), pollytypes.VoiceId(voice))
		return &cfg, nil
	case ProviderAzure:
		cfg := azuretts.NewAzureConfig(common.GetEnv("AZURE_SUBSCRIPTION_KEY"), common.GetEnv("AZURE_REGION"))
		if v := common.GetEnv("AZURE_TTS_VOICE"); v != "" {
			cfg.Voice = v
		}
		return &cfg, nil
	case ProviderBaidu:
		cfg := baidutts.NewBaiduTTSOption(common.GetEnv("BAIDU_ACCESS_TOKEN"))
		return &cfg, nil
	case ProviderCoqui:
		cfg := coquitts.NewCoquiTTSOption(common.GetEnv("COQUI_URL"))
		return &cfg, nil
	case ProviderElevenLabs:
		cfg := elevenlabs.NewElevenLabsConfig(
			common.GetEnv("ELEVENLABS_API_KEY"),
			firstNonEmpty(common.GetEnv("ELEVENLABS_VOICE_ID"), ""),
		)
		return &cfg, nil
	case ProviderFishAudio:
		cfg := fishaudio.NewFishAudioConfig(
			common.GetEnv("FISHAUDIO_API_KEY"),
			common.GetEnv("FISHAUDIO_REFERENCE_ID"),
		)
		return &cfg, nil
	case ProviderFishSpeech:
		cfg := fishspeech.NewFishSpeechConfig(
			common.GetEnv("FISHSPEECH_API_KEY"),
			common.GetEnv("FISHSPEECH_REFERENCE_ID"),
		)
		return &cfg, nil
	case ProviderGoogle:
		cfg := googletts.NewGoogleTTSOption(firstNonEmpty(common.GetEnv("GOOGLE_TTS_LANGUAGE"), "en-US"))
		return &cfg, nil
	case ProviderLocal:
		cfg := localtts.NewLocalTTSConfig(firstNonEmpty(common.GetEnv("LOCAL_TTS_COMMAND"), "say"))
		if v := common.GetEnv("LOCAL_TTS_VOICE"); v != "" {
			cfg.Voice = v
		}
		return &cfg, nil
	case ProviderLocalGoSpeech:
		providerName := firstNonEmpty(common.GetEnv("LOCAL_GOSPEECH_PROVIDER"), "espeak")
		cfg := localtts.NewLocalGoSpeechConfig(localtts.LocalGoSpeechProvider(providerName), common.GetEnv("LOCAL_GOSPEECH_MODEL_PATH"))
		return cfg, nil
	case ProviderMinimax:
		cfg := minimaxes.NewMinimaxOption(common.GetEnv("MINIMAX_API_KEY"))
		if v := common.GetEnv("MINIMAX_VOICE_ID"); v != "" {
			cfg.VoiceID = v
		}
		return &cfg, nil
	case ProviderOpenAI:
		cfg := openaitts.NewOpenAIConfig(common.GetEnv("OPENAI_API_KEY"))
		if v := common.GetEnv("OPENAI_TTS_MODEL"); v != "" {
			cfg.Model = v
		}
		if v := common.GetEnv("OPENAI_TTS_VOICE"); v != "" {
			cfg.Voice = v
		}
		if v := common.GetEnv("OPENAI_BASE_URL"); v != "" {
			cfg.BaseURL = v
		}
		return &cfg, nil
	case ProviderQiniu:
		cfg := qiniutts.NewQiniuTTSConfig(common.GetEnv("QINIU_TTS_API_KEY"), common.GetEnv("QINIU_TTS_BASE_URL"))
		return &cfg, nil
	case ProviderXunfei:
		cfg := xunfeitts.NewXunfeiTTSConfig(
			common.GetEnv("XUNFEI_APP_ID"),
			common.GetEnv("XUNFEI_API_KEY"),
			common.GetEnv("XUNFEI_API_SECRET"),
		)
		if v := common.GetEnv("XUNFEI_TTS_VCN"); v != "" {
			cfg.Vcn = v
		}
		return &cfg, nil
	case ProviderVolcengine, ProviderVolcengineClone, ProviderVolcengineLLM:
		opt := volctts.NewVolcengineTTSOption(
			common.GetEnv("VOLCENGINE_TTS_APP_ID"),
			common.GetEnv("VOLCENGINE_TTS_ACCESS_TOKEN"),
			common.GetEnv("VOLCENGINE_TTS_CLUSTER"),
		)
		if v := common.GetEnv("VOLCENGINE_TTS_VOICE_TYPE"); v != "" {
			opt.VoiceType = v
		}
		switch p {
		case ProviderVolcengineClone:
			opt.Cluster = volctts.VolcengineCloneCluster
			return &volcProviderConfig{VolcengineTTSOption: opt, provider: ProviderVolcengineClone}, nil
		case ProviderVolcengineLLM:
			opt.Cluster = volctts.VolcengineLLMCluster
			return &volcProviderConfig{VolcengineTTSOption: opt, provider: ProviderVolcengineLLM}, nil
		default:
			return &opt, nil
		}
	default:
		return nil, fmt.Errorf("unsupported tts provider: %s", p)
	}
}

func qcloudConfigFromEnv() *qcloudtts.QCloudTTSConfig {
	acc := pickQCloudAccount()
	sample := DefaultSampleRate
	if v := strings.TrimSpace(common.GetEnv("QCLOUD_TTS_SAMPLE_RATE")); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			sample = n
		}
	}
	cfg := qcloudtts.NewQcloudTTSConfig(acc.AppID, acc.SecretID, acc.SecretKey, DefaultQCloudVoiceType, "pcm", sample)
	if v := common.GetEnv("QCLOUD_TTS_LANG"); v != "" {
		cfg.Language = v
	}
	if v := strings.TrimSpace(common.GetEnv("QCLOUD_TTS_SPEED")); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil {
			cfg.Speed = n
		}
	}
	return &cfg
}

// LoadQCloudAccounts 解析 QCLOUD_TTS_ACCOUNTS JSON 数组。
// 示例：[{"appId":"123","secretId":"...","secret":"..."}]
// 字段兼容：appId/app_id、secretId/secret_id、secret/secretKey/secret_key。
func LoadQCloudAccounts() ([]QCloudAccount, error) {
	raw := strings.TrimSpace(common.GetEnv("QCLOUD_TTS_ACCOUNTS"))
	if raw == "" {
		return nil, nil
	}
	var loose []map[string]any
	if err := json.Unmarshal([]byte(raw), &loose); err != nil {
		return nil, fmt.Errorf("解析 QCLOUD_TTS_ACCOUNTS 失败: %w", err)
	}
	out := make([]QCloudAccount, 0, len(loose))
	for _, m := range loose {
		acc := QCloudAccount{
			AppID:     stringifyJSONField(m, "appId", "app_id", "AppId"),
			SecretID:  stringifyJSONField(m, "secretId", "secret_id", "SecretId"),
			SecretKey: stringifyJSONField(m, "secret", "secretKey", "secret_key", "SecretKey"),
		}
		if acc.AppID == "" || acc.SecretID == "" || acc.SecretKey == "" {
			continue
		}
		out = append(out, acc)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("QCLOUD_TTS_ACCOUNTS 无有效账号（需要 appId / secretId / secret）")
	}
	return out, nil
}

func pickQCloudAccount() QCloudAccount {
	accounts, err := LoadQCloudAccounts()
	if err != nil || len(accounts) == 0 {
		return QCloudAccount{}
	}
	if len(accounts) == 1 {
		return accounts[0]
	}
	idx := qcloudAccountCursor.Add(1) - 1
	return accounts[int(idx%uint64(len(accounts)))]
}

func stringifyJSONField(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if v, ok := m[k]; ok {
			switch t := v.(type) {
			case string:
				return strings.TrimSpace(t)
			case float64:
				// JSON 数字（appId 可能被写成数字）
				return strconv.FormatInt(int64(t), 10)
			case json.Number:
				return strings.TrimSpace(t.String())
			default:
				return strings.TrimSpace(fmt.Sprint(t))
			}
		}
	}
	return ""
}

// QCloudOverrides 覆盖腾讯云账号选择与合成参数（管理端 / CLI 用）。
// VoiceType 留空则始终使用 DefaultQCloudVoiceType。
type QCloudOverrides struct {
	AppID      string
	SecretID   string
	SecretKey  string
	VoiceType  string // 可选覆盖；空则默认 1005
	Lang       string
	SampleRate int
	Speed      int64
}

// NewQCloudConfig 从 QCLOUD_TTS_ACCOUNTS 轮询选取账号，并应用可选覆盖。
func NewQCloudConfig(o QCloudOverrides) (*qcloudtts.QCloudTTSConfig, error) {
	cfg := qcloudConfigFromEnv()
	if v := strings.TrimSpace(o.AppID); v != "" {
		if id, err := strconv.ParseInt(v, 10, 64); err == nil && id > 0 {
			cfg.AppID = id
		}
	}
	if v := strings.TrimSpace(o.SecretID); v != "" {
		cfg.SecretID = v
	}
	if v := strings.TrimSpace(o.SecretKey); v != "" {
		cfg.SecretKey = v
	}
	cfg.VoiceType = DefaultQCloudVoiceType
	if v := strings.TrimSpace(o.VoiceType); v != "" {
		if n, err := strconv.ParseInt(v, 10, 64); err == nil && n > 0 {
			cfg.VoiceType = n
		}
	}
	if v := strings.TrimSpace(o.Lang); v != "" {
		cfg.Language = v
	}
	if o.SampleRate > 0 {
		cfg.SampleRate = int64(o.SampleRate)
	}
	if o.Speed != 0 {
		cfg.Speed = o.Speed
	}
	if cfg.AppID == 0 || cfg.SecretID == "" || cfg.SecretKey == "" {
		return nil, fmt.Errorf("缺少腾讯云 TTS 凭证：请设置 QCLOUD_TTS_ACCOUNTS JSON 数组")
	}
	switch cfg.SampleRate {
	case 8000, 16000:
	default:
		return nil, fmt.Errorf("sampleRate 必须是 8000 或 16000，当前 %d", cfg.SampleRate)
	}
	return cfg, nil
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
