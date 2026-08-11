// Command ddjdc-dict-import 从 ddjdc OSS 拉取单词词典详情并更新 CloudSteps Word 表的扩展字段。
//
// ddjdc 词典数据存储在阿里云 OSS：
//   - URL:  https://ddjdc.oss-cn-beijing.aliyuncs.com/common/word/dict/{hash}
//   - hash: HmacSHA256(word, "DDJDC") 的 hex
//   - 内容: Base64 编码的 CryptoJS AES 加密数据（OpenSSL Salted 格式）
//   - 密钥: hash + "DDJDC"（即 HmacSHA256 结果拼接 "DDJDC"）
//   - 算法: AES-256-CBC，EVP_BytesToKey(MD5, 1 次迭代) 派生 key+iv
//
// 解密后的 JSON 包含：meanings, sentences, collins, oxford(变形), phrases,
// derive(派生词), synonyms, relatedWords, shitai(词形), story(词源), phonics 等。
//
// 用法：
//
//	# 全量更新（从数据库读取所有去重单词）
//	go run ./cmd/ddjdc-dict-import
//
//	# 限制前 N 个单词（测试用）
//	go run ./cmd/ddjdc-dict-import -limit 10
//
//	# 指定并发数和批量大小
//	go run ./cmd/ddjdc-dict-import -workers 16 -batch-size 50
//
//	# 仅预览不写入
//	go run ./cmd/ddjdc-dict-import -dry-run
//
//	# 跳过已有详情的单词（只更新 ExampleSentences 为空的）
//	go run ./cmd/ddjdc-dict-import -skip-existing
package main

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"gorm.io/gorm"
)

const (
	ossBase    = "https://ddjdc.oss-cn-beijing.aliyuncs.com"
	hmacKey    = "DDJDC"
	httpTimeout = 15 * time.Second
	operator    = "script:ddjdc-dict-import"
)

// ----- ddjdc 词典 JSON 结构（只取需要的字段） -----

type dictMeaning struct {
	Pos     string   `json:"pos"`
	Meaning []string `json:"meaning"`
}

type dictSentence struct {
	Pos         string `json:"pos"`
	Paraphrases string `json:"paraphrases"`
	Sentence    string `json:"sentence"`
	Meaning     string `json:"meaning"`
	UKAudio     string `json:"uk_audio"`
}

type dictCollinsExample struct {
	Ex      string `json:"ex"`
	Tran    string `json:"tran"`
	TtsMP3  string `json:"tts_mp3"`
}

type dictCollins struct {
	Def     string              `json:"def"`
	Posp    string              `json:"posp"`
	Tran    string              `json:"tran"`
	Example []dictCollinsExample `json:"example"`
}

type dictOxfordInf struct {
	Tag     string `json:"tag"`
	Type    string `json:"type"`
	Content string `json:"content"`
}

type dictOxfordMeaning struct {
	Cn      string   `json:"cn"`
	En      []string `json:"en"`
	Example []any    `json:"example"`
}

type dictOxfordPos struct {
	Inf     []dictOxfordInf     `json:"inf"`
	Pos     []string            `json:"pos"`
	Meaning []dictOxfordMeaning `json:"meaning"`
}

type dictOxford struct {
	Type     string           `json:"type"`
	PosList  []dictOxfordPos  `json:"posList"`
	Variant  any              `json:"variant"`
	HeadWord []string         `json:"headWord"`
	SubEntry []any            `json:"subEntry"`
}

type dictPhrase struct {
	Phrase   string   `json:"phrase"`
	Meanings []string `json:"meanings"`
}

type dictDeriveMeaning struct {
	Pos     string `json:"pos"`
	Meaning string `json:"meaning"`
}

type dictDerive struct {
	Word     string              `json:"word"`
	Meanings []dictDeriveMeaning `json:"meanings"`
}

type dictSynonym struct {
	Pos   string `json:"pos"`
	Trans string `json:"trans"`
	Word  string `json:"word"`
}

type dictRelatedWord struct {
	Pos     string `json:"pos"`
	Word    string `json:"word"`
	Meaning string `json:"meaning"`
}

type dictData struct {
	MeaningsStr  string           `json:"meanings_str"`
	ID           int              `json:"id"`
	Word         string           `json:"word"`
	Image        string           `json:"image"`
	UK           string           `json:"uk"`
	US           string           `json:"us"`
	Meanings     []dictMeaning    `json:"meanings"`
	Sentences    []dictSentence   `json:"sentences"`
	Collins      []dictCollins    `json:"collins"`
	Oxford       dictOxford       `json:"oxford"`
	Phrases      []dictPhrase     `json:"phrases"`
	Derive       []dictDerive     `json:"derive"`
	Synonyms     []dictSynonym    `json:"synonyms"`
	RelatedWords []dictRelatedWord `json:"relatedWords"`
	Shitai       []string         `json:"shitai"`
	Story        string           `json:"story"`
	SplitWord    []string         `json:"splitWord"`
}

// ----- CryptoJS AES 解密 -----

// evpBytesToKey 模拟 OpenSSL EVP_BytesToKey（MD5，1 次迭代）
func evpBytesToKey(password, salt []byte, keyLen, ivLen int) ([]byte, []byte) {
	total := keyLen + ivLen
	var d, dPrev []byte
	for len(d) < total {
		h := md5.New()
		h.Write(dPrev)
		h.Write(password)
		h.Write(salt)
		dPrev = h.Sum(nil)
		d = append(d, dPrev...)
	}
	return d[:keyLen], d[keyLen : keyLen+ivLen]
}

// cryptoJSDecrypt 解密 CryptoJS AES 加密的数据（OpenSSL Salted 格式）
func cryptoJSDecrypt(ciphertextB64 string, passphrase string) ([]byte, error) {
	raw, err := base64.StdEncoding.DecodeString(ciphertextB64)
	if err != nil {
		// 可能不是 base64，直接当二进制
		raw = []byte(ciphertextB64)
	}
	if len(raw) < 16 || !bytes.Equal(raw[:8], []byte("Salted__")) {
		return nil, fmt.Errorf("not Salted__ format")
	}
	salt := raw[8:16]
	ct := raw[16:]
	key, iv := evpBytesToKey([]byte(passphrase), salt, 32, 16)
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	if len(ct)%block.BlockSize() != 0 {
		return nil, fmt.Errorf("ciphertext not multiple of block size")
	}
	plaintext := make([]byte, len(ct))
	cipher.NewCBCDecrypter(block, iv).CryptBlocks(plaintext, ct)
	// PKCS7 unpad
	pad := int(plaintext[len(plaintext)-1])
	if pad <= 0 || pad > 16 || pad > len(plaintext) {
		return nil, fmt.Errorf("invalid padding %d", pad)
	}
	return plaintext[:len(plaintext)-pad], nil
}

// wordHash 计算 ddjdc 的 OSS 文件名 hash
func wordHash(word string) string {
	mac := hmac.New(sha256.New, []byte(hmacKey))
	mac.Write([]byte(word))
	return hex.EncodeToString(mac.Sum(nil))
}

// fetchDict 从 OSS 拉取并解密词典数据
func fetchDict(word string) (*dictData, error) {
	hash := wordHash(word)
	url := fmt.Sprintf("%s/common/word/dict/%s", ossBase, hash)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	client := &http.Client{Timeout: httpTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		return nil, nil // 该单词无词典数据
	}
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("OSS returned %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// 密钥 = hash + "DDJDC"
	dictKey := hash + hmacKey
	plaintext, err := cryptoJSDecrypt(string(body), dictKey)
	if err != nil {
		return nil, fmt.Errorf("decrypt failed: %w", err)
	}

	// 解密结果可能是 JSON 字符串，也可能需要二次 parse
	var obj any
	if err := json.Unmarshal(plaintext, &obj); err != nil {
		return nil, fmt.Errorf("json parse failed: %w", err)
	}

	// 如果 obj 是 string，再 parse 一次
	if s, ok := obj.(string); ok {
		var dd dictData
		if err := json.Unmarshal([]byte(s), &dd); err != nil {
			return nil, fmt.Errorf("second json parse failed: %w", err)
		}
		return &dd, nil
	}

	// 直接 unmarshal 到 dictData
	plaintext2, _ := json.Marshal(obj)
	var dd dictData
	if err := json.Unmarshal(plaintext2, &dd); err != nil {
		return nil, fmt.Errorf("struct parse failed: %w", err)
	}
	return &dd, nil
}

// ----- 将 dictData 映射到 Word 扩展字段 -----

func toJSONString(v any) string {
	b, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return string(b)
}

// mapDictToWord 将词典数据映射到 Word 的扩展字段
func mapDictToWord(dd *dictData, w *models.Word) {
	if dd == nil {
		return
	}

	// 音标：优先用 ddjdc 词典的 uk/us
	if dd.UK != "" {
		w.PhoneticUK = "/" + dd.UK + "/"
	}
	if dd.US != "" {
		w.PhoneticUS = "/" + dd.US + "/"
	}
	if dd.UK != "" && w.Phonetic == "" {
		w.Phonetic = "/" + dd.UK + "/"
	}

	// 释义：用 meanings 数组生成更结构化的 Translation
	if len(dd.Meanings) > 0 {
		trans := make([]string, 0, len(dd.Meanings))
		for _, m := range dd.Meanings {
			if len(m.Meaning) > 0 {
				prefix := ""
				if m.Pos != "" {
					prefix = m.Pos + " "
				}
				trans = append(trans, prefix+strings.Join(m.Meaning, "；"))
			}
		}
		if len(trans) > 0 {
			w.Translation = toJSONString(trans)
		}
	}

	// 词性：取第一个 meaning 的 pos
	if len(dd.Meanings) > 0 && dd.Meanings[0].Pos != "" {
		w.PartOfSpeech = dd.Meanings[0].Pos
	}

	// 英文释义：取 collins 第一个 def
	if len(dd.Collins) > 0 && dd.Collins[0].Def != "" {
		w.Definition = dd.Collins[0].Def
	}

	// 例句：sentences 数组
	if len(dd.Sentences) > 0 {
		examples := make([]map[string]string, 0, len(dd.Sentences))
		for _, s := range dd.Sentences {
			if s.Sentence == "" {
				continue
			}
			examples = append(examples, map[string]string{
				"en":   s.Sentence,
				"cn":   s.Meaning,
				"pos":  s.Pos,
				"para": s.Paraphrases,
			})
		}
		if len(examples) > 0 {
			w.ExampleSentences = toJSONString(examples)
		}
	}

	// 搭配/短语：phrases 数组
	if len(dd.Phrases) > 0 {
		w.Collocations = toJSONString(dd.Phrases)
	}

	// 同义词
	if len(dd.Synonyms) > 0 {
		w.Synonyms = toJSONString(dd.Synonyms)
	}

	// 词族：relatedWords + derive 合并
	family := make([]any, 0)
	for _, rw := range dd.RelatedWords {
		family = append(family, rw)
	}
	if len(family) > 0 {
		w.WordFamily = toJSONString(family)
	}

	// 派生词
	if len(dd.Derive) > 0 {
		w.Derivations = toJSONString(dd.Derive)
	}

	// 词形变化：oxford.posList[].inf + shitai
	morph := map[string]any{}
	if len(dd.Shitai) > 0 {
		morph["forms"] = dd.Shitai
	}
	if len(dd.Oxford.PosList) > 0 {
		forms := make([]string, 0)
		for _, pl := range dd.Oxford.PosList {
			for _, inf := range pl.Inf {
				if inf.Content != "" {
					forms = append(forms, inf.Content)
				}
			}
		}
		if len(forms) > 0 {
			morph["inflections"] = forms
		}
	}
	if len(morph) > 0 {
		w.Morphology = toJSONString(morph)
	}

	// 词源
	if dd.Story != "" {
		w.Etymology = dd.Story
	}

	// 音节划分
	if len(dd.SplitWord) > 0 {
		w.Syllables = strings.Join(dd.SplitWord, "-")
	}

	// 图片
	if dd.Image != "" {
		w.ImageURL = dd.Image
	}

	// 柯林斯释义（存到 GrammarPatterns 复用，或新增字段；这里存到 Notes）
	if len(dd.Collins) > 0 {
		w.UsageNotes = toJSONString(dd.Collins)
	}
}

// ----- 主流程 -----

func main() {
	var (
		limit        = flag.Int("limit", 0, "仅处理前 N 个单词（0=全部）")
		workers      = flag.Int("workers", 8, "并发拉取数")
		dryRun       = flag.Bool("dry-run", false, "仅预览不实际写入")
		skipExisting = flag.Bool("skip-existing", false, "跳过已有例句的单词")
		retry        = flag.Int("retry", 2, "OSS 拉取失败重试次数")
		offset       = flag.Int("offset", 0, "跳过前 N 个单词（从第 N+1 个开始）")
		sample       = flag.String("sample", "", "只处理包含此字符串的单词（测试用）")
		minLen       = flag.Int("min-len", 0, "只处理长度>=N 的单词")
		maxLen       = flag.Int("max-len", 0, "只处理长度<=N 的单词（0=不限）")
	)
	flag.Parse()

	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := utils.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(30)
		sqlDB.SetConnMaxLifetime(5 * time.Minute)
		sqlDB.SetConnMaxIdleTime(30 * time.Second)
	}

	// 1. 从数据库读取所有去重单词（只取 id + word）
	log.Println("读取数据库中的去重单词列表...")
	type wordRow struct {
		ID   uint
		Word string
	}
	var rows []wordRow
	// 用 DISTINCT word 避开 only_full_group_by 限制（id 仅用于调试，取任意一条即可）
	subQuery := db.Table("words").Select("word").Where("is_deleted = 0").Group("word")
	if *skipExisting {
		subQuery = subQuery.Where("example_sentences IS NULL OR example_sentences = '' OR example_sentences = '[]'")
	}
	if err := subQuery.Pluck("word", &rows).Error; err != nil {
		// Pluck 到 struct 不行，改用 []string
		var words []string
		if err2 := subQuery.Pluck("word", &words).Error; err2 != nil {
			log.Fatalf("查询单词失败: %v / %v", err, err2)
		}
		rows = make([]wordRow, 0, len(words))
		for _, w := range words {
			rows = append(rows, wordRow{Word: w})
		}
	}
	log.Printf("共 %d 个去重单词待处理", len(rows))

	// 过滤
	skipPhrase := flag.Bool("skip-phrase", true, "跳过含空格/括号/斜杠的短语（只处理单词）")
	_ = skipPhrase // 已在下方使用

	// 过滤
	{
		filtered := make([]wordRow, 0, len(rows))
		for _, r := range rows {
			if *sample != "" && !strings.Contains(r.Word, *sample) {
				continue
			}
			if *minLen > 0 && len(r.Word) < *minLen {
				continue
			}
			if *maxLen > 0 && len(r.Word) > *maxLen {
				continue
			}
			// 跳过短语：含空格、括号、斜杠等
			if *skipPhrase {
				w := r.Word
				if strings.ContainsAny(w, " ()/\\'\"") || strings.Contains(w, "..") {
					continue
				}
			}
			filtered = append(filtered, r)
		}
		log.Printf("过滤后 %d -> %d 个单词", len(rows), len(filtered))
		rows = filtered
	}

	if *offset > 0 && *offset < len(rows) {
		rows = rows[*offset:]
		log.Printf("跳过前 %d 个", *offset)
	}
	if *limit > 0 && *limit < len(rows) {
		rows = rows[:*limit]
		log.Printf("限制为前 %d 个", *limit)
	}

	// 2. 分批并发拉取 + 即时写入（避免内存爆炸 + 进度可见 + 可断点续传）
	type updateItem struct {
		Word string
		DD   *dictData
	}

	var (
		ok     int64
		fail   int64
		skip   int64
		updated int64
	)

	fetchBatchSize := *workers * 4 // 每批拉取量 = 并发数 × 4
	if fetchBatchSize < 20 {
		fetchBatchSize = 20
	}
	totalBatches := (len(rows) + fetchBatchSize - 1) / fetchBatchSize

	for batchStart := 0; batchStart < len(rows); batchStart += fetchBatchSize {
		batchEnd := batchStart + fetchBatchSize
		if batchEnd > len(rows) {
			batchEnd = len(rows)
		}
		batchRows := rows[batchStart:batchEnd]
		batchIdx := batchStart / fetchBatchSize

		// 并发拉取本批
		batchResults := make([]updateItem, 0, len(batchRows))
		var batchMu sync.Mutex
		var batchWg sync.WaitGroup
		sem := make(chan struct{}, *workers)

		for i, r := range batchRows {
			batchWg.Add(1)
			go func(idx int, row wordRow) {
				defer batchWg.Done()
				sem <- struct{}{}
				defer func() { <-sem }()

				var dd *dictData
				var err error
				for attempt := 0; attempt <= *retry; attempt++ {
					dd, err = fetchDict(row.Word)
					if err == nil {
						break
					}
					if attempt < *retry {
						time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
					}
				}
				if err != nil {
					atomic.AddInt64(&fail, 1)
					return
				}
				if dd == nil {
					atomic.AddInt64(&skip, 1)
					return
				}
				atomic.AddInt64(&ok, 1)
				batchMu.Lock()
				batchResults = append(batchResults, updateItem{Word: row.Word, DD: dd})
				batchMu.Unlock()
			}(i, r)
		}
		batchWg.Wait()

		// 即时写入数据库（每词一条 UPDATE，按 word 列批量更新所有匹配行）
		if !*dryRun && len(batchResults) > 0 {
			for _, b := range batchResults {
				dd := b.DD
				if dd == nil {
					continue
				}
				// 构建一个临时 Word 来生成字段值
				var tw models.Word
				tw.Word = b.Word
				mapDictToWord(dd, &tw)

				updates := map[string]any{
					"phonetic":          tw.Phonetic,
					"phonetic_uk":       tw.PhoneticUK,
					"phonetic_us":       tw.PhoneticUS,
					"translation":       tw.Translation,
					"part_of_speech":    tw.PartOfSpeech,
					"definition":        tw.Definition,
					"example_sentences": tw.ExampleSentences,
					"collocations":      tw.Collocations,
					"synonyms":          tw.Synonyms,
					"word_family":       tw.WordFamily,
					"derivations":       tw.Derivations,
					"morphology":        tw.Morphology,
					"etymology":         tw.Etymology,
					"syllables":         tw.Syllables,
					"image_url":         tw.ImageURL,
					"usage_notes":       tw.UsageNotes,
					"update_by":         operator,
				}

				// 带重试的 UPDATE（远程 DB 偶尔超时）
				var result *gorm.DB
				for attempt := 0; attempt < 3; attempt++ {
					result = db.Model(&models.Word{}).
						Where("word = ? AND is_deleted = 0", b.Word).
						Updates(updates)
					if result.Error == nil {
						break
					}
					if attempt < 2 {
						time.Sleep(time.Duration(attempt+1) * time.Second)
					}
				}
				if result.Error != nil {
					log.Printf("[batch %d] 更新 %s 失败: %v", batchIdx, b.Word, result.Error)
				} else {
					atomic.AddInt64(&updated, result.RowsAffected)
				}
			}
		}

		// 进度日志
		if (batchIdx+1)%50 == 0 || batchIdx == 0 || batchStart+fetchBatchSize >= len(rows) {
			log.Printf("[进度] batch %d/%d  已处理 %d/%d 词  成功=%d 跳过=%d 失败=%d 更新=%d",
				batchIdx+1, totalBatches, batchEnd, len(rows),
				atomic.LoadInt64(&ok), atomic.LoadInt64(&skip), atomic.LoadInt64(&fail), atomic.LoadInt64(&updated))
		}
	}

	log.Printf("全部完成! 成功拉取=%d 跳过(无数据)=%d 失败=%d 更新数据库=%d 条", ok, skip, fail, updated)
}
