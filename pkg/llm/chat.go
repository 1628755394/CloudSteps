package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/config"
	relay "github.com/LingByte/ling-base/relay"
	"github.com/LingByte/ling-base/relay/channel/openai"
	"github.com/LingByte/ling-base/relay/meter"
)

// Config is the text LLM configuration used by scenario review, etc.
type Config struct {
	APIKey  string
	BaseURL string
	Model   string
}

// FromGlobal reads LLM settings from app config.
func FromGlobal() Config {
	if config.GlobalConfig == nil {
		return Config{}
	}
	c := config.GlobalConfig.Services.LLM
	return Config{
		APIKey:  strings.TrimSpace(c.APIKey),
		BaseURL: normalizeBaseURL(c.BaseURL),
		Model:   strings.TrimSpace(c.Model),
	}
}

func normalizeBaseURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimSuffix(u, "/")
	u = strings.TrimSuffix(u, "/v1")
	return u
}

func (c Config) enabled() bool {
	return c.APIKey != "" && c.BaseURL != ""
}

func (c Config) modelOrDefault() string {
	if c.Model != "" {
		return c.Model
	}
	return "gpt-4o-mini"
}

func (c Config) relayClient() *relay.Client {
	provider := openai.NewProvider(c.APIKey, openai.WithBaseURL(c.BaseURL))
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout:   30 * time.Second,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          100,
		IdleConnTimeout:       90 * time.Second,
		TLSHandshakeTimeout:   15 * time.Second,
		ResponseHeaderTimeout: 60 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	return relay.New(
		relay.WithProvider(provider),
		relay.WithMeter(meter.NewMemoryMeter()),
		relay.WithHTTPClient(&http.Client{Timeout: 60 * time.Second, Transport: transport}),
	)
}

// Chat sends a single-turn chat completion via ling-base/relay.
func Chat(ctx context.Context, cfg Config, systemPrompt, userText string) (string, error) {
	if !cfg.enabled() {
		return "", fmt.Errorf("LLM is not configured (LLM_API_KEY / LLM_BASE_URL)")
	}
	userText = strings.TrimSpace(userText)
	if userText == "" {
		return "", fmt.Errorf("prompt is required")
	}

	msgs := make([]relay.Message, 0, 2)
	if sp := strings.TrimSpace(systemPrompt); sp != "" {
		msgs = append(msgs, relay.Message{Role: "system", Content: sp})
	}
	msgs = append(msgs, relay.Message{Role: "user", Content: userText})

	resp, err := cfg.relayClient().Chat(ctx, &relay.ChatRequest{
		Model:    cfg.modelOrDefault(),
		Messages: msgs,
	})
	if err != nil {
		return "", err
	}
	if resp == nil || len(resp.Choices) == 0 {
		return "", fmt.Errorf("empty chat response")
	}
	msg := resp.Choices[0].Message
	text := strings.TrimSpace(msg.StringContent())
	if text == "" {
		switch v := msg.Content.(type) {
		case string:
			text = strings.TrimSpace(v)
		case json.RawMessage:
			_ = json.Unmarshal(v, &text)
			text = strings.TrimSpace(text)
		}
	}
	return text, nil
}
