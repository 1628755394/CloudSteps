package voice

import (
	"context"
	"sync"
	"time"

	"github.com/LingByte/ling-base/realtime"
	aliyunomni "github.com/LingByte/ling-base/realtime/aliyunomni"
)

func init() {
	// Override aliyunomni registration so every Omni session greets first.
	realtime.Register(newAutoGreetAliyun, aliyunomni.ProviderSlug, "qwen_omni", "dashscope_omni")
}

func newAutoGreetAliyun(cfg map[string]any, opts realtime.Options) (realtime.Agent, error) {
	inner, err := aliyunomni.New(cfg, opts)
	if err != nil {
		return nil, err
	}
	return &autoGreetAgent{Agent: inner}, nil
}

// autoGreetAgent triggers response.create shortly after Start so the model
// speaks first (greeting) instead of waiting for user audio.
type autoGreetAgent struct {
	realtime.Agent
	once sync.Once
}

func (a *autoGreetAgent) Start(ctx context.Context) error {
	if err := a.Agent.Start(ctx); err != nil {
		return err
	}
	go a.once.Do(func() {
		// Wait for session.updated handshake on the Omni wire.
		time.Sleep(700 * time.Millisecond)
		// Use the typed CreateResponse method instead of reflection.
		if inner, ok := a.Agent.(*aliyunomni.Agent); ok {
			_ = inner.CreateResponse("")
		}
	})
	return nil
}
