// Command tts-gen 使用阿里云 DashScope Qwen-TTS realtime（WebSocket）合成语音并写出音频文件。
//
// 核心逻辑在 pkg/tts；本命令为离线/批量工具入口。
//
// 环境变量：
//
//	DASHSCOPE_API_KEY  必填（也可用 -api-key 覆盖）
//	REALTIME_API_KEY   DASHSCOPE_API_KEY 为空时回退使用
//	LLM_API_KEY        上一级回退
//
// 基本用法：
//
//	go run ./cmd/tts-gen -text "hello" -o out.mp3
//	go run ./cmd/tts-gen -batch -out-dir ./audio -voice Cherry < words.txt
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
	"time"

	"github.com/LingByte/CloudStepsGo/pkg/tts"
)

func main() {
	var (
		apiKey      = flag.String("api-key", "", "DashScope API Key；为空则按 DASHSCOPE_API_KEY → REALTIME_API_KEY → LLM_API_KEY 顺序回退")
		baseURL     = flag.String("base-url", tts.DefaultBaseURL, "WebSocket 端点")
		model       = flag.String("model", tts.DefaultModel, "模型")
		voice       = flag.String("voice", tts.DefaultVoice, "音色")
		lang        = flag.String("lang", tts.DefaultLang, "语言类型：Chinese / English / Auto / Japanese / Korean")
		mode        = flag.String("mode", tts.DefaultMode, "合成模式：server_commit / commit")
		sampleRate  = flag.Int("rate", tts.DefaultSampleRate, "采样率：16000 / 22050 / 24000")
		instruct    = flag.String("instructions", "", "风格指令")
		optInstruct = flag.Bool("optimize-instructions", false, "是否让服务端优化 instructions")
		text        = flag.String("text", "", "要合成的文本（单条模式）")
		outPath     = flag.String("o", "tts_out.pcm", "单条模式输出路径；后缀决定格式：.pcm/.wav/.mp3")
		batch       = flag.Bool("batch", false, "批量模式：从 stdin 读取每行一条文本，输出到 -out-dir")
		outDir      = flag.String("out-dir", "./tts_out", "批量模式输出目录")
		naming      = flag.String("naming", "index", "批量模式文件名规则：index / text")
		overwrite   = flag.Bool("overwrite", false, "批量模式：已存在文件是否覆盖（默认跳过）")
		dialTimeout = flag.Duration("dial-timeout", 10*time.Second, "WebSocket 握手超时")
		verbose     = flag.Bool("verbose", false, "打印每条事件")
	)
	flag.Parse()

	opt := tts.Options{
		APIKey:      tts.ResolveAPIKey(*apiKey),
		BaseURL:     strings.TrimSpace(*baseURL),
		Model:       strings.TrimSpace(*model),
		Voice:       strings.TrimSpace(*voice),
		Lang:        strings.TrimSpace(*lang),
		Mode:        *mode,
		SampleRate:  *sampleRate,
		Instruct:    strings.TrimSpace(*instruct),
		OptInstruct: *optInstruct,
		DialTimeout: *dialTimeout,
		Verbose:     *verbose,
		Logf:        log.Printf,
	}
	if err := opt.Normalize(); err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()

	if *batch {
		if err := runBatch(ctx, opt, *outDir, *naming, *overwrite); err != nil {
			log.Fatalf("批量合成失败: %v", err)
		}
		return
	}

	if strings.TrimSpace(*text) == "" {
		log.Fatal("单条模式需要 -text 参数；或使用 -batch 从 stdin 读取")
	}
	if err := runSingle(ctx, opt, *text, *outPath); err != nil {
		log.Fatalf("合成失败: %v", err)
	}
}

func runSingle(ctx context.Context, opt tts.Options, text, outPath string) error {
	pcm, err := tts.Synthesize(ctx, opt, text)
	if err != nil {
		return err
	}
	if err := tts.WriteAudioFile(outPath, pcm, opt.SampleRate); err != nil {
		return fmt.Errorf("写出 %s: %w", outPath, err)
	}
	log.Printf("✓ %s（%d 字节 PCM，%.2f 秒）→ %s", strings.TrimSpace(text), len(pcm),
		float64(len(pcm))/float64(opt.SampleRate*2), outPath)
	return nil
}

func runBatch(ctx context.Context, opt tts.Options, outDir, naming string, overwrite bool) error {
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
	log.Printf("批量模式：%d 条文本，输出目录 %s，命名规则 %s", len(lines), outDir, naming)

	ext := ".pcm"
	ok, skip, fail := 0, 0, 0
	for i, text := range lines {
		var fname string
		switch naming {
		case "text":
			fname = tts.SanitizeFilename(text, 40) + ext
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
		pcm, err := tts.Synthesize(ctx, opt, text)
		if err != nil {
			fail++
			log.Printf("[%d/%d] 失败: %s → %v", i+1, len(lines), text, err)
			continue
		}
		if err := tts.WriteAudioFile(outPath, pcm, opt.SampleRate); err != nil {
			fail++
			log.Printf("[%d/%d] 写出失败: %s → %v", i+1, len(lines), outPath, err)
			continue
		}
		ok++
		if opt.Verbose || (i+1)%10 == 0 || i+1 == len(lines) {
			log.Printf("[%d/%d] ok=%d skip=%d fail=%d → %s", i+1, len(lines), ok, skip, fail, outPath)
		}
	}
	log.Printf("完成：成功 %d，跳过 %d，失败 %d", ok, skip, fail)
	return nil
}
