// Package synthesizer 是 CloudSteps 对 ling-base/synthesizer 的统一工厂封装。
//
// 实际各厂商实现位于 ling-base/synthesizer/* 子模块；本包负责：
//  1. 注册全部厂商到工厂
//  2. 按 CloudSteps 环境变量拼装 Config
//  3. 提供统一的 Service（Synthesize → PCM 字节）
package synthesizer

import (
	"fmt"
	"strings"
	"sync"

	base "github.com/LingByte/ling-base/synthesizer"
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
)

// 再导出常用类型，调用方可不直接依赖 ling-base 核心包。
type (
	Provider          = base.Provider
	Engine            = base.Engine
	Config            = base.Config
	Handler           = base.Handler
	StreamFormat      = base.StreamFormat
	SynthesisBuffer   = base.SynthesisBuffer
	SentenceTimestamp = base.SentenceTimestamp
)

const (
	ProviderQiniu           = base.ProviderQiniu
	ProviderXunfei          = base.ProviderXunfei
	ProviderAliyun          = base.ProviderAliyun
	ProviderTencent         = base.ProviderTencent // "qcloud"
	ProviderBaidu           = base.ProviderBaidu
	ProviderAzure           = base.ProviderAzure
	ProviderGoogle          = base.ProviderGoogle
	ProviderAWS             = base.ProviderAWS
	ProviderOpenAI          = base.ProviderOpenAI
	ProviderElevenLabs      = base.ProviderElevenLabs
	ProviderLocal           = base.ProviderLocal
	ProviderLocalGoSpeech   = base.ProviderLocalGoSpeech
	ProviderFishSpeech      = base.ProviderFishSpeech
	ProviderFishAudio       = base.ProviderFishAudio
	ProviderCoqui           = base.ProviderCoqui
	ProviderVolcengine      = base.ProviderVolcengine
	ProviderVolcengineClone = base.ProviderVolcengineClone
	ProviderVolcengineLLM   = base.ProviderVolcengineLLM
	ProviderMinimax         = base.ProviderMinimax
)

// DefaultProvider 默认厂商（可用 TTS_PROVIDER 覆盖）。
const DefaultProvider = ProviderTencent

var (
	factoryOnce sync.Once
	factory     *base.DefaultFactory
)

// Factory 返回已注册全部厂商的全局工厂（懒加载、线程安全）。
func Factory() *base.DefaultFactory {
	factoryOnce.Do(func() {
		factory = base.NewFactory()
		registerAll(factory)
	})
	return factory
}

// CreateEngine 按 Config.GetProvider() 创建引擎。
func CreateEngine(cfg Config) (Engine, error) {
	return Factory().CreateEngine(cfg)
}

// SupportedProviders 返回已注册厂商列表。
func SupportedProviders() []Provider {
	return Factory().GetSupportedProviders()
}

// NormalizeProvider 解析厂商字符串（兼容 tts.qcloud / qcloud / tencent 等别名）。
func NormalizeProvider(raw string) Provider {
	s := strings.ToLower(strings.TrimSpace(raw))
	s = strings.TrimPrefix(s, "tts.")
	switch s {
	case "", "qcloud", "tencent", "tencentcloud":
		return ProviderTencent
	case "qiniu":
		return ProviderQiniu
	case "xunfei", "xfyun":
		return ProviderXunfei
	case "aliyun", "dashscope":
		return ProviderAliyun
	case "baidu":
		return ProviderBaidu
	case "azure":
		return ProviderAzure
	case "google":
		return ProviderGoogle
	case "aws", "polly", "amazon":
		return ProviderAWS
	case "openai":
		return ProviderOpenAI
	case "elevenlabs":
		return ProviderElevenLabs
	case "local":
		return ProviderLocal
	case "local_gospeech", "gospeech":
		return ProviderLocalGoSpeech
	case "fishspeech":
		return ProviderFishSpeech
	case "fishaudio":
		return ProviderFishAudio
	case "coqui":
		return ProviderCoqui
	case "volcengine", "volc", "doubao":
		return ProviderVolcengine
	case "volcengine_clone", "volc_clone":
		return ProviderVolcengineClone
	case "volcengine_llm", "volc_llm":
		return ProviderVolcengineLLM
	case "minimax":
		return ProviderMinimax
	default:
		return Provider(s)
	}
}

func registerAll(f *base.DefaultFactory) {
	must := func(p Provider, c base.Creator) { f.RegisterCreator(p, c) }

	must(ProviderTencent, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*qcloudtts.QCloudTTSConfig)
		if !ok {
			return nil, fmt.Errorf("qcloud: invalid config type %T", cfg)
		}
		return qcloudtts.NewQCloudService(*c), nil
	})
	must(ProviderAliyun, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*aliyuntts.AliyunTTSConfig)
		if !ok {
			return nil, fmt.Errorf("aliyun: invalid config type %T", cfg)
		}
		return aliyuntts.NewAliyunService(*c), nil
	})
	must(ProviderAWS, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*awstts.AmazonTTSConfig)
		if !ok {
			return nil, fmt.Errorf("aws: invalid config type %T", cfg)
		}
		return awstts.NewAmazonService(*c), nil
	})
	must(ProviderAzure, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*azuretts.AzureConfig)
		if !ok {
			return nil, fmt.Errorf("azure: invalid config type %T", cfg)
		}
		return azuretts.NewAzureService(*c), nil
	})
	must(ProviderBaidu, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*baidutts.BaiduTTSConfig)
		if !ok {
			return nil, fmt.Errorf("baidu: invalid config type %T", cfg)
		}
		return baidutts.NewBaiduService(*c), nil
	})
	must(ProviderCoqui, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*coquitts.CoquiTTSOption)
		if !ok {
			return nil, fmt.Errorf("coqui: invalid config type %T", cfg)
		}
		return coquitts.NewCoquiService(*c), nil
	})
	must(ProviderElevenLabs, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*elevenlabs.ElevenLabsConfig)
		if !ok {
			return nil, fmt.Errorf("elevenlabs: invalid config type %T", cfg)
		}
		return elevenlabs.NewElevenLabsService(*c), nil
	})
	must(ProviderFishAudio, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*fishaudio.FishAudioConfig)
		if !ok {
			return nil, fmt.Errorf("fishaudio: invalid config type %T", cfg)
		}
		return fishaudio.NewFishAudioService(*c), nil
	})
	must(ProviderFishSpeech, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*fishspeech.FishSpeechConfig)
		if !ok {
			return nil, fmt.Errorf("fishspeech: invalid config type %T", cfg)
		}
		return fishspeech.NewFishSpeechService(*c), nil
	})
	must(ProviderGoogle, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*googletts.GoogleTTSOption)
		if !ok {
			return nil, fmt.Errorf("google: invalid config type %T", cfg)
		}
		return googletts.NewGoogleService(*c), nil
	})
	must(ProviderLocal, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*localtts.LocalTTSConfig)
		if !ok {
			return nil, fmt.Errorf("local: invalid config type %T", cfg)
		}
		return localtts.NewLocalService(*c), nil
	})
	must(ProviderLocalGoSpeech, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*localtts.LocalGoSpeechConfig)
		if !ok {
			return nil, fmt.Errorf("local_gospeech: invalid config type %T", cfg)
		}
		return localtts.NewLocalGoSpeechService(c)
	})
	must(ProviderMinimax, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*minimaxes.MinimaxOption)
		if !ok {
			return nil, fmt.Errorf("minimax: invalid config type %T", cfg)
		}
		return minimaxes.NewMinimaxService(*c), nil
	})
	must(ProviderOpenAI, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*openaitts.OpenAIConfig)
		if !ok {
			return nil, fmt.Errorf("openai: invalid config type %T", cfg)
		}
		return openaitts.NewOpenAIService(*c), nil
	})
	must(ProviderQiniu, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*qiniutts.QiniuTTSConfig)
		if !ok {
			return nil, fmt.Errorf("qiniu: invalid config type %T", cfg)
		}
		return qiniutts.NewQiniuService(*c), nil
	})
	must(ProviderXunfei, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*xunfeitts.XunfeiTTSConfig)
		if !ok {
			return nil, fmt.Errorf("xunfei: invalid config type %T", cfg)
		}
		return xunfeitts.NewXunfeiService(*c), nil
	})
	must(ProviderVolcengine, func(cfg Config) (Engine, error) {
		c, ok := cfg.(*volctts.VolcengineTTSOption)
		if !ok {
			return nil, fmt.Errorf("volcengine: invalid config type %T", cfg)
		}
		return volctts.NewVolcengineService(*c), nil
	})
	// clone / llm 共用火山实现，按 cluster 区分
	must(ProviderVolcengineClone, func(cfg Config) (Engine, error) {
		opt, err := asVolcOption(cfg)
		if err != nil {
			return nil, err
		}
		opt.Cluster = volctts.VolcengineCloneCluster
		return volctts.NewVolcengineService(opt), nil
	})
	must(ProviderVolcengineLLM, func(cfg Config) (Engine, error) {
		opt, err := asVolcOption(cfg)
		if err != nil {
			return nil, err
		}
		opt.Cluster = volctts.VolcengineLLMCluster
		return volctts.NewVolcengineService(opt), nil
	})
}

func asVolcOption(cfg Config) (volctts.VolcengineTTSOption, error) {
	switch c := cfg.(type) {
	case *volctts.VolcengineTTSOption:
		return *c, nil
	case *volcProviderConfig:
		return c.VolcengineTTSOption, nil
	default:
		return volctts.VolcengineTTSOption{}, fmt.Errorf("volcengine: invalid config type %T", cfg)
	}
}

// volcProviderConfig 让 clone/llm 在工厂里用独立 Provider 标识。
type volcProviderConfig struct {
	volctts.VolcengineTTSOption
	provider Provider
}

func (c *volcProviderConfig) GetProvider() Provider { return c.provider }
