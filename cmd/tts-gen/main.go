// Command tts-gen 使用 pkg/synthesizer 合成语音并写出音频文件。
//
// 环境变量：
//
//	TTS_PROVIDER          可选，默认 qcloud
//	QCLOUD_TTS_ACCOUNTS   腾讯云账号 JSON 数组，如
//	                      [{"appId":"...","secretId":"...","secret":"..."}]
//
// 基本用法：
//
//	go run ./cmd/tts-gen -text "hello" -o out.mp3
//	go run ./cmd/tts-gen -batch -out-dir ./audio < words.txt
package main

import (
	"bufio"
	"context"
	"errors"
	"flag"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/LingByte/CloudStepsGo/pkg/synthesizer"
)

func main() {
	var (
		provider   = flag.String("provider", "", "TTS 厂商；为空则读 TTS_PROVIDER，默认 qcloud")
		appID      = flag.String("app-id", "", "腾讯云 AppId；为空则从 QCLOUD_TTS_ACCOUNTS 轮询")
		secretID   = flag.String("secret-id", "", "腾讯云 SecretId；为空则从账号配置读取")
		secretKey  = flag.String("secret", "", "腾讯云 SecretKey；为空则从账号配置读取")
		voice      = flag.String("voice", "", "音色（腾讯云 VoiceType）；为空则用默认 1005")
		sampleRate = flag.Int("rate", synthesizer.DefaultSampleRate, "采样率：8000 / 16000（腾讯云）")
		speed      = flag.Int64("speed", 0, "语速（腾讯云；0 为默认）")
		text       = flag.String("text", "", "要合成的文本（单条模式）")
		outPath    = flag.String("o", "tts_out.pcm", "单条模式输出路径；后缀决定格式：.pcm/.wav/.mp3")
		batch      = flag.Bool("batch", false, "批量模式：从 stdin 读取每行一条文本，输出到 -out-dir")
		outDir     = flag.String("out-dir", "./tts_out", "批量模式输出目录")
		naming     = flag.String("naming", "index", "批量模式文件名规则：index / text")
		overwrite  = flag.Bool("overwrite", false, "批量模式：已存在文件是否覆盖（默认跳过）")
		verbose    = flag.Bool("verbose", false, "打印调试信息")
	)
	flag.Parse()

	svc, sample, voiceLabel, err := newTTSService(*provider, *appID, *secretID, *secretKey, *voice, *sampleRate, *speed)
	if err != nil {
		log.Fatal(err)
	}
	defer func() { _ = svc.Close() }()

	ctx := context.Background()
	if *batch {
		if err := runBatch(ctx, svc, sample, voiceLabel, *outDir, *naming, *overwrite, *verbose); err != nil {
			log.Fatalf("批量合成失败: %v", err)
		}
		return
	}

	if strings.TrimSpace(*text) == "" {
		log.Fatal("单条模式需要 -text 参数；或使用 -batch 从 stdin 读取")
	}
	if err := runSingle(ctx, svc, sample, voiceLabel, *text, *outPath); err != nil {
		log.Fatalf("合成失败: %v", err)
	}
}

func newTTSService(provider, appID, secretID, secretKey, voice string, sampleRate int, speed int64) (*synthesizer.Service, int, string, error) {
	p := synthesizer.NormalizeProvider(provider)
	if p == synthesizer.ProviderTencent || p == "" {
		cfg, err := synthesizer.NewQCloudConfig(synthesizer.QCloudOverrides{
			AppID:      appID,
			SecretID:   secretID,
			SecretKey:  secretKey,
			VoiceType:  voice,
			SampleRate: sampleRate,
			Speed:      speed,
		})
		if err != nil {
			return nil, 0, "", err
		}
		svc, err := synthesizer.NewWithConfig(cfg)
		if err != nil {
			return nil, 0, "", err
		}
		rate := int(cfg.SampleRate)
		if rate <= 0 {
			rate = synthesizer.DefaultSampleRate
		}
		return svc, rate, fmt.Sprintf("%d", cfg.VoiceType), nil
	}

	// 非腾讯云：走环境变量配置；-voice 仅作日志标签
	svc, err := synthesizer.New(string(p))
	if err != nil {
		return nil, 0, "", err
	}
	rate := svc.Format().SampleRate
	if rate <= 0 {
		rate = synthesizer.DefaultSampleRate
	}
	label := strings.TrimSpace(voice)
	if label == "" {
		label = string(p)
	}
	return svc, rate, label, nil
}

func runSingle(ctx context.Context, svc *synthesizer.Service, sampleRate int, voiceLabel, text, outPath string) error {
	pcm, err := svc.Synthesize(ctx, text)
	if err != nil {
		return err
	}
	if err := synthesizer.WriteAudioFile(outPath, pcm, sampleRate); err != nil {
		return fmt.Errorf("写出 %s: %w", outPath, err)
	}
	log.Printf("✓ %s（%d 字节，provider=%s voice=%s）→ %s",
		strings.TrimSpace(text), len(pcm), svc.Provider(), voiceLabel, outPath)
	return nil
}

func runBatch(
	ctx context.Context,
	svc *synthesizer.Service,
	sampleRate int,
	voiceLabel string,
	outDir, naming string,
	overwrite, verbose bool,
) error {
	if err := os.MkdirAll(outDir, 0o755); err != nil {
		return fmt.Errorf("创建输出目录: %w", err)
	}
	scanner := bufio.NewScanner(os.Stdin)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	var lines []string
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" {
			lines = append(lines, line)
		}
	}
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("读取 stdin: %w", err)
	}
	if len(lines) == 0 {
		return errors.New("stdin 无有效文本行")
	}
	log.Printf("批量模式：%d 条文本，输出目录 %s，命名规则 %s，provider=%s voice=%s",
		len(lines), outDir, naming, svc.Provider(), voiceLabel)

	ext := ".pcm"
	ok, skip, fail := 0, 0, 0
	for i, text := range lines {
		var fname string
		switch naming {
		case "text":
			fname = synthesizer.SanitizeFilename(text, 40) + ext
		default:
			fname = fmt.Sprintf("%04d%s", i+1, ext)
		}
		outPath := filepath.Join(outDir, fname)
		if !overwrite {
			if info, err := os.Stat(outPath); err == nil && info.Size() > 0 {
				skip++
				continue
			}
		}
		pcm, err := svc.Synthesize(ctx, text)
		if err != nil {
			fail++
			log.Printf("[%d/%d] 失败: %s → %v", i+1, len(lines), text, err)
			continue
		}
		if err := synthesizer.WriteAudioFile(outPath, pcm, sampleRate); err != nil {
			fail++
			log.Printf("[%d/%d] 写出失败: %s → %v", i+1, len(lines), outPath, err)
			continue
		}
		ok++
		if verbose || (i+1)%10 == 0 || i+1 == len(lines) {
			log.Printf("[%d/%d] ok=%d skip=%d fail=%d → %s", i+1, len(lines), ok, skip, fail, outPath)
		}
	}
	log.Printf("完成：成功 %d，跳过 %d，失败 %d", ok, skip, fail)
	return nil
}
