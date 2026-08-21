package main

import (
	"fmt"
	"io"
	"log"
	"sort"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/audio"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/ling-base/common"
	"gorm.io/gorm"
)

func main() {
	if err := config.Load(); err != nil {
		log.Fatal(err)
	}
	db, err := common.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatal(err)
	}

	printScalar(db, "active_words", `SELECT COUNT(*) FROM words WHERE is_deleted=0`)
	printScalar(db, "soft_deleted_words", `SELECT COUNT(*) FROM words WHERE is_deleted=1`)
	printScalar(db, "active_with_audio", `SELECT COUNT(*) FROM words WHERE is_deleted=0 AND audio_url IS NOT NULL AND TRIM(audio_url)<>''`)
	printScalar(db, "active_no_audio", `SELECT COUNT(*) FROM words WHERE is_deleted=0 AND (audio_url IS NULL OR TRIM(audio_url)='')`)
	printScalar(db, "active_books", `SELECT COUNT(*) FROM word_books WHERE is_deleted=0`)
	printScalar(db, "distinct_spellings", `SELECT COUNT(DISTINCT LOWER(TRIM(word))) FROM words WHERE is_deleted=0`)
	printScalar(db, "distinct_audio_url", `SELECT COUNT(DISTINCT audio_url) FROM words WHERE is_deleted=0 AND audio_url IS NOT NULL AND TRIM(audio_url)<>''`)

	fmt.Println("\n=== within-book spelling dups ===")
	groups, err := findDuplicateGroups(db)
	if err != nil {
		log.Fatal(err)
	}
	var extra int
	for _, g := range groups {
		extra += len(g.ids) - 1
	}
	fmt.Printf("dup_groups=%d extra_rows=%d\n", len(groups), extra)

	type bookAgg struct {
		name   string
		groups int
		extra  int
	}
	byBook := map[uint]*bookAgg{}
	bookIDs := make([]uint, 0)
	for _, g := range groups {
		if _, ok := byBook[g.bookID]; !ok {
			byBook[g.bookID] = &bookAgg{}
			bookIDs = append(bookIDs, g.bookID)
		}
		byBook[g.bookID].groups++
		byBook[g.bookID].extra += len(g.ids) - 1
	}
	names := map[uint]string{}
	if len(bookIDs) > 0 {
		type nb struct {
			ID   uint
			Name string
		}
		var rows []nb
		if err := db.Table("word_books").Select("id, name").Where("id IN ?", bookIDs).Find(&rows).Error; err != nil {
			log.Fatal(err)
		}
		for _, r := range rows {
			names[r.ID] = r.Name
			if a := byBook[r.ID]; a != nil {
				a.name = r.Name
			}
		}
	}
	type ranked struct {
		id uint
		a  *bookAgg
	}
	rank := make([]ranked, 0, len(byBook))
	for id, a := range byBook {
		rank = append(rank, ranked{id, a})
	}
	sort.Slice(rank, func(i, j int) bool { return rank[i].a.extra > rank[j].a.extra })
	fmt.Println("top books:")
	for i, r := range rank {
		if i >= 15 {
			break
		}
		fmt.Printf("  book=%d extra=%d groups=%d %s\n", r.id, r.a.extra, r.a.groups, r.a.name)
	}

	extraWithAudio := 0
	extraNoAudio := 0
	keeperAlsoHasAudio := 0
	orphanAudioCandidates := 0 // extra has audio AND keeper already has a different URL
	sameAudioAsKeeper := 0
	slotDupWords := 0
	fmt.Println("\n=== sample groups (first 12) ===")
	shown := 0
	for _, g := range groups {
		var words []models.Word
		if err := db.Select("id, word_book_id, word, translation, audio_url, phonetic, definition").
			Where("id IN ?", g.ids).Order("id ASC").Find(&words).Error; err != nil {
			log.Fatal(err)
		}
		keeper, dupes := pick(words)
		keeperAudio := strings.TrimSpace(keeper.AudioURL)
		for _, d := range dupes {
			au := strings.TrimSpace(d.AudioURL)
			if au == "" {
				extraNoAudio++
				continue
			}
			extraWithAudio++
			if keeperAudio == "" {
				continue
			}
			keeperAlsoHasAudio++
			if audioEqual(keeperAudio, au) {
				sameAudioAsKeeper++
			} else {
				orphanAudioCandidates++
			}
		}
		if audio.DeduplicateSlots(keeper.AudioURL) != strings.TrimSpace(keeper.AudioURL) {
			slotDupWords++
		}
		for _, d := range dupes {
			if audio.DeduplicateSlots(d.AudioURL) != strings.TrimSpace(d.AudioURL) {
				slotDupWords++
			}
		}
		if shown < 12 {
			fmt.Printf("  book=%d %s word=%q keep=%d dupes=%v keepAudio=%dB\n",
				g.bookID, names[g.bookID], g.key, keeper.ID, idsOf(dupes), len(keeperAudio))
			for _, d := range dupes {
				fmt.Printf("      extra id=%d trans=%d audio=%dB sameURL=%v\n",
					d.ID, len(strings.TrimSpace(d.Translation)), len(strings.TrimSpace(d.AudioURL)),
					audioEqual(keeperAudio, strings.TrimSpace(d.AudioURL)))
			}
			shown++
		}
	}

	fmt.Println("\n=== extra-row audio vs keeper ===")
	fmt.Printf("extra_with_audio=%d extra_without_audio=%d\n", extraWithAudio, extraNoAudio)
	fmt.Printf("both_have_audio=%d same_url_as_keeper=%d different_url_than_keeper=%d\n",
		keeperAlsoHasAudio, sameAudioAsKeeper, orphanAudioCandidates)
	fmt.Printf("rows_in_dup_groups_with_in-slot_duplicate_urls=%d (scanned keepers+dupes)\n", slotDupWords)
}

type dupGroup struct {
	bookID uint
	key    string
	ids    []uint
}

func findDuplicateGroups(db *gorm.DB) ([]dupGroup, error) {
	type row struct {
		WordBookID uint   `gorm:"column:word_book_id"`
		WordKey    string `gorm:"column:word_key"`
	}
	var rows []row
	err := db.Table(constants.TABLE_WORDS).
		Select("word_book_id, LOWER(TRIM(word)) AS word_key").
		Where("is_deleted = ?", models.SoftDeleteStatusActive).
		Group("word_book_id, LOWER(TRIM(word))").
		Having("COUNT(*) > 1").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	out := make([]dupGroup, 0, len(rows))
	for _, r := range rows {
		var ids []uint
		err := db.Model(&models.Word{}).Select("id").
			Where("word_book_id = ? AND is_deleted = ? AND LOWER(TRIM(word)) = ?",
				r.WordBookID, models.SoftDeleteStatusActive, r.WordKey).
			Order("id ASC").Pluck("id", &ids).Error
		if err != nil {
			return nil, err
		}
		out = append(out, dupGroup{bookID: r.WordBookID, key: r.WordKey, ids: ids})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].bookID != out[j].bookID {
			return out[i].bookID < out[j].bookID
		}
		return out[i].key < out[j].key
	})
	return out, nil
}

func pick(words []models.Word) (models.Word, []models.Word) {
	best := words[0]
	bestScore := score(best)
	for _, w := range words[1:] {
		s := score(w)
		if s > bestScore || (s == bestScore && w.ID < best.ID) {
			best, bestScore = w, s
		}
	}
	var dupes []models.Word
	for _, w := range words {
		if w.ID != best.ID {
			dupes = append(dupes, w)
		}
	}
	return best, dupes
}

func score(w models.Word) int {
	n := 0
	if strings.TrimSpace(w.Translation) != "" {
		n += 4
	}
	if strings.TrimSpace(w.AudioURL) != "" {
		n += 3
	}
	if strings.TrimSpace(w.Phonetic) != "" {
		n += 2
	}
	if strings.TrimSpace(w.Definition) != "" {
		n += 1
	}
	return n
}

func idsOf(words []models.Word) []uint {
	ids := make([]uint, len(words))
	for i, w := range words {
		ids[i] = w.ID
	}
	return ids
}

func audioEqual(a, b string) bool {
	if a == "" || b == "" {
		return a == b
	}
	ka := strings.Split(a, ";")
	kb := strings.Split(b, ";")
	if len(ka) != len(kb) {
		return false
	}
	for i := range ka {
		if audio.DedupKey(ka[i]) != audio.DedupKey(kb[i]) {
			return false
		}
	}
	return true
}

func printScalar(db *gorm.DB, label, q string) {
	var n int64
	if err := db.Raw(q).Scan(&n).Error; err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%s=%d\n", label, n)
}
