package synthesizer

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"

	"github.com/LingByte/ling-base/common"
)

// Service 统一 TTS 服务：持有一个已创建的 Engine，对外返回完整 PCM。
type Service struct {
	provider Provider
	engine   Engine
}

var (
	defaultOnce sync.Once
	defaultSvc  *Service
	defaultErr  error
)

// New 按厂商名（或别名）从环境变量创建服务。
func New(provider string) (*Service, error) {
	p := NormalizeProvider(provider)
	cfg, err := ConfigFromEnv(p)
	if err != nil {
		return nil, err
	}
	return NewWithConfig(cfg)
}

// NewWithConfig 用已有 Config 创建服务（便于调用方覆盖音色等字段）。
func NewWithConfig(cfg Config) (*Service, error) {
	if cfg == nil {
		return nil, errors.New("tts config is nil")
	}
	eng, err := CreateEngine(cfg)
	if err != nil {
		return nil, err
	}
	return &Service{provider: cfg.GetProvider(), engine: eng}, nil
}

// Default 返回进程级默认服务（TTS_PROVIDER，缺省 qcloud）。
func Default() (*Service, error) {
	defaultOnce.Do(func() {
		defaultSvc, defaultErr = New(common.GetEnv("TTS_PROVIDER"))
	})
	return defaultSvc, defaultErr
}

// Provider 当前厂商。
func (s *Service) Provider() Provider {
	if s == nil {
		return ""
	}
	return s.provider
}

// Engine 底层 ling-base Engine（需要流式回调时可直接用）。
func (s *Service) Engine() Engine {
	if s == nil {
		return nil
	}
	return s.engine
}

// Format 输出音频格式。
func (s *Service) Format() StreamFormat {
	if s == nil || s.engine == nil {
		return StreamFormat{}
	}
	return s.engine.Format()
}

// CacheKey 缓存键。
func (s *Service) CacheKey(text string) string {
	if s == nil || s.engine == nil {
		return ""
	}
	return s.engine.CacheKey(text)
}

// Close 释放底层资源。
func (s *Service) Close() error {
	if s == nil || s.engine == nil {
		return nil
	}
	return s.engine.Close()
}

// Synthesize 合成整段音频，返回厂商输出的原始音频字节（多数为 PCM16LE）。
func (s *Service) Synthesize(ctx context.Context, text string) ([]byte, error) {
	if s == nil || s.engine == nil {
		return nil, errors.New("tts service is nil")
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("文本为空")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}

	buf := &SynthesisBuffer{}
	if err := s.engine.Synthesize(ctx, buf, text); err != nil {
		return nil, fmt.Errorf("tts(%s): %w", s.provider, err)
	}
	if len(buf.Data) == 0 {
		return nil, fmt.Errorf("tts(%s): 未收到音频数据", s.provider)
	}
	return buf.Data, nil
}

// SynthesizeWith 一次性：按厂商名从环境变量创建 → 合成 → 关闭。
func SynthesizeWith(ctx context.Context, provider, text string) ([]byte, error) {
	svc, err := New(provider)
	if err != nil {
		return nil, err
	}
	defer func() { _ = svc.Close() }()
	return svc.Synthesize(ctx, text)
}
