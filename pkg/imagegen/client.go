package imagegen

import (
	"context"
	"encoding/base64"
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	relay "github.com/LingByte/ling-base/relay"
	"github.com/LingByte/ling-base/relay/channel/openai"
	"github.com/LingByte/ling-base/relay/meter"
	"github.com/LingByte/CloudStepsGo/pkg/config"
)

// Config is the runtime image-generation configuration.
type Config struct {
	APIKey  string
	BaseURL string
	Model   string
}

// FromGlobal reads image generation settings from loaded app config.
func FromGlobal() Config {
	if config.GlobalConfig == nil {
		return Config{}
	}
	c := config.GlobalConfig.Services.ImageGen
	return Config{
		APIKey:  strings.TrimSpace(c.APIKey),
		BaseURL: normalizeBaseURL(c.BaseURL),
		Model:   strings.TrimSpace(c.Model),
	}
}

func normalizeBaseURL(raw string) string {
	u := strings.TrimSpace(raw)
	u = strings.TrimSuffix(u, "/")
	// OpenAI adaptor appends /v1/images/... to base URL.
	u = strings.TrimSuffix(u, "/v1")
	return u
}

func (c Config) enabled() bool {
	return c.APIKey != "" && c.BaseURL != "" && c.Model != ""
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
		ResponseHeaderTimeout: 3 * time.Minute,
		ExpectContinueTimeout: 1 * time.Second,
	}
	httpClient := &http.Client{
		Timeout:   5 * time.Minute,
		Transport: transport,
	}
	return relay.New(
		relay.WithProvider(provider),
		relay.WithMeter(meter.NewMemoryMeter()),
		relay.WithHTTPClient(httpClient),
	)
}

// GenerateRequest is a text-to-image or image-edit request.
type GenerateRequest struct {
	Prompt         string
	Size           string
	ReferenceImage []byte // optional; uses /v1/images/edits when set
}

// Result holds raw image bytes returned by the provider.
type Result struct {
	Data       []byte
	Ext        string
	RevisedPrompt string
}

// Generate calls the configured OpenAI-compatible image API via ling-base/relay.
func Generate(ctx context.Context, cfg Config, req GenerateRequest) (*Result, error) {
	if !cfg.enabled() {
		return nil, fmt.Errorf("image generation is not configured (IMAGE_GEN_API_KEY / BASE_URL / MODEL)")
	}
	if strings.TrimSpace(req.Prompt) == "" {
		return nil, fmt.Errorf("prompt is required")
	}
	size := NormalizeCoverSize(req.Size)

	client := cfg.relayClient()
	n := 1

	if len(req.ReferenceImage) > 0 {
		editResp, err := client.ImageEdit(ctx, &relay.ImageEditRequest{
			Model:  cfg.Model,
			Prompt: req.Prompt,
			Image:  req.ReferenceImage,
			N:      &n,
			Size:   size,
		})
		if err != nil {
			return nil, fmt.Errorf("image edit: %w", err)
		}
		return decodeImageResponse(editResp)
	}

	resp, err := client.Image(ctx, &relay.ImageRequest{
		Model:          cfg.Model,
		Prompt:         req.Prompt,
		N:              &n,
		Size:           size,
		ResponseFormat: "b64_json",
	})
	if err != nil {
		return nil, fmt.Errorf("image generation: %w", err)
	}
	return decodeImageResponse(resp)
}

func decodeImageResponse(resp *relay.ImageResponse) (*Result, error) {
	if resp == nil || len(resp.Data) == 0 {
		return nil, fmt.Errorf("empty image response")
	}
	item := resp.Data[0]
	if item.B64JSON != "" {
		raw, err := base64.StdEncoding.DecodeString(item.B64JSON)
		if err != nil {
			return nil, fmt.Errorf("decode b64_json: %w", err)
		}
		ext := sniffImageExt(raw)
		return &Result{Data: raw, Ext: ext, RevisedPrompt: item.RevisedPrompt}, nil
	}
	if item.URL != "" {
		return nil, fmt.Errorf("provider returned url only; configure b64_json or download url support needed")
	}
	return nil, fmt.Errorf("no image data in response")
}

func sniffImageExt(data []byte) string {
	if len(data) >= 3 && data[0] == 0xFF && data[1] == 0xD8 && data[2] == 0xFF {
		return ".jpg"
	}
	if len(data) >= 8 && string(data[0:8]) == "\x89PNG\r\n\x1a\n" {
		return ".png"
	}
	if len(data) >= 12 && string(data[0:4]) == "RIFF" && string(data[8:12]) == "WEBP" {
		return ".webp"
	}
	return ".png"
}
