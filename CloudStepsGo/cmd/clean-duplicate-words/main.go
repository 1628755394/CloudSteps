// 清理 words 表中同一词库内重复的单词（按 word_book_id + 不区分大小写的 word 判定）。
//
// 用法（在项目根目录）:
//
//	cd CloudStepsGo && go run ./cmd/clean-duplicate-words --dry-run
//	cd CloudStepsGo && go run ./cmd/clean-duplicate-words --execute
//	cd CloudStepsGo && go run ./cmd/clean-duplicate-words --execute --word-book-id=12
package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"sort"
	"strings"

	"github.com/LingByte/CloudStepsGo/internal/models"
	"github.com/LingByte/CloudStepsGo/pkg/config"
	"github.com/LingByte/CloudStepsGo/pkg/constants"
	"github.com/LingByte/CloudStepsGo/pkg/utils"
	"gorm.io/gorm"
)

const operator = "script:clean-duplicate-words"

type dupGroup struct {
	WordBookID uint
	WordKey    string
	WordIDs    []uint
}

func main() {
	dryRun := flag.Bool("dry-run", true, "仅预览，不写入数据库（默认 true）")
	execute := flag.Bool("execute", false, "执行清理（软删除重复项并修正关联表）")
	wordBookID := flag.Uint("word-book-id", 0, "仅处理指定词库 ID，0 表示全部词库")
	flag.Parse()

	if *execute {
		*dryRun = false
	}
	if !*dryRun && !*execute {
		log.Fatal("请显式指定 --execute 才会写入数据库；预览请加 --dry-run（默认）")
	}

	if err := config.Load(); err != nil {
		log.Fatalf("加载配置失败: %v", err)
	}

	db, err := utils.InitDatabase(io.Discard, config.GlobalConfig.Database.Driver, config.GlobalConfig.Database.DSN)
	if err != nil {
		log.Fatalf("连接数据库失败: %v", err)
	}

	groups, err := findDuplicateGroups(db, uint(*wordBookID))
	if err != nil {
		log.Fatalf("查询重复单词失败: %v", err)
	}
	if len(groups) == 0 {
		fmt.Println("未发现重复单词（is_deleted=0，按词库内 LOWER(TRIM(word)) 分组）")
		return
	}

	var totalDup int
	for _, g := range groups {
		totalDup += len(g.WordIDs) - 1
	}
	fmt.Printf("发现 %d 组重复，将处理 %d 条冗余记录\n", len(groups), totalDup)
	if *dryRun {
		fmt.Println("【预览模式】以下不会写入数据库，确认后请使用 --execute")
	}

	affectedBooks := map[uint]struct{}{}
	removed := 0

	for i, g := range groups {
		words, err := loadWordsByIDs(db, g.WordIDs)
		if err != nil {
			log.Fatalf("加载词组失败 book=%d key=%q: %v", g.WordBookID, g.WordKey, err)
		}
		keeper, dupes := pickKeeperAndDuplicates(words)
		fmt.Printf("\n[%d/%d] 词库=%d 单词=%q 保留 id=%d，删除 %d 条: %v\n",
			i+1, len(groups), g.WordBookID, g.WordKey, keeper.ID, len(dupes), wordIDs(dupes))

		if *dryRun {
			continue
		}

		if err := db.Transaction(func(tx *gorm.DB) error {
			for _, dup := range dupes {
				if err := reassignWordReferences(tx, keeper.ID, dup.ID); err != nil {
					return fmt.Errorf("重定向关联 word_id %d -> %d: %w", dup.ID, keeper.ID, err)
				}
				if err := softDeleteWord(tx, dup.ID); err != nil {
					return err
				}
				removed++
			}
			return nil
		}); err != nil {
			log.Fatalf("处理词库=%d word=%q 失败: %v", g.WordBookID, g.WordKey, err)
		}
		affectedBooks[g.WordBookID] = struct{}{}
	}

	if *dryRun {
		fmt.Printf("\n预览结束：共 %d 组、%d 条可删除。执行: cd CloudStepsGo && go run ./cmd/clean-duplicate-words --execute\n", len(groups), totalDup)
		return
	}

	for bookID := range affectedBooks {
		if err := models.SyncWordBookCount(db, bookID); err != nil {
			log.Printf("同步词库 %d word_count 失败: %v", bookID, err)
		}
	}
	fmt.Printf("\n完成：软删除 %d 条重复单词，已同步 %d 个词库的 word_count\n", removed, len(affectedBooks))
}

func findDuplicateGroups(db *gorm.DB, onlyBookID uint) ([]dupGroup, error) {
	type row struct {
		WordBookID uint   `gorm:"column:word_book_id"`
		WordKey    string `gorm:"column:word_key"`
		Cnt        int64  `gorm:"column:cnt"`
	}
	q := db.Table(constants.TABLE_WORDS).
		Select("word_book_id, LOWER(TRIM(word)) AS word_key, COUNT(*) AS cnt").
		Where("is_deleted = ?", models.SoftDeleteStatusActive).
		Group("word_book_id, LOWER(TRIM(word))").
		Having("COUNT(*) > 1")
	if onlyBookID > 0 {
		q = q.Where("word_book_id = ?", onlyBookID)
	}
	var rows []row
	if err := q.Find(&rows).Error; err != nil {
		return nil, err
	}

	groups := make([]dupGroup, 0, len(rows))
	for _, r := range rows {
		var ids []uint
		err := db.Model(&models.Word{}).
			Select("id").
			Where("word_book_id = ? AND is_deleted = ? AND LOWER(TRIM(word)) = ?",
				r.WordBookID, models.SoftDeleteStatusActive, r.WordKey).
			Order("id ASC").
			Pluck("id", &ids).Error
		if err != nil {
			return nil, err
		}
		groups = append(groups, dupGroup{
			WordBookID: r.WordBookID,
			WordKey:    r.WordKey,
			WordIDs:    ids,
		})
	}
	sort.Slice(groups, func(i, j int) bool {
		if groups[i].WordBookID != groups[j].WordBookID {
			return groups[i].WordBookID < groups[j].WordBookID
		}
		return groups[i].WordKey < groups[j].WordKey
	})
	return groups, nil
}

func loadWordsByIDs(db *gorm.DB, ids []uint) ([]models.Word, error) {
	var words []models.Word
	err := db.Where("id IN ? AND is_deleted = ?", ids, models.SoftDeleteStatusActive).
		Order("id ASC").
		Find(&words).Error
	return words, err
}

// pickKeeperAndDuplicates 保留信息更完整的一条，相同则保留最小 id。
func pickKeeperAndDuplicates(words []models.Word) (models.Word, []models.Word) {
	if len(words) == 0 {
		return models.Word{}, nil
	}
	best := words[0]
	bestScore := completenessScore(best)
	for _, w := range words[1:] {
		s := completenessScore(w)
		if s > bestScore || (s == bestScore && w.ID < best.ID) {
			best = w
			bestScore = s
		}
	}
	dupes := make([]models.Word, 0, len(words)-1)
	for _, w := range words {
		if w.ID != best.ID {
			dupes = append(dupes, w)
		}
	}
	return best, dupes
}

func completenessScore(w models.Word) int {
	score := 0
	if strings.TrimSpace(w.Translation) != "" {
		score += 4
	}
	if strings.TrimSpace(w.AudioURL) != "" {
		score += 3
	}
	if strings.TrimSpace(w.Phonetic) != "" {
		score += 2
	}
	if strings.TrimSpace(w.ExampleSentence) != "" || strings.TrimSpace(w.ExampleSentences) != "" {
		score += 2
	}
	if strings.TrimSpace(w.Definition) != "" {
		score += 1
	}
	if strings.TrimSpace(w.ImageURL) != "" {
		score += 1
	}
	return score
}

func reassignWordReferences(tx *gorm.DB, keeperID, dupID uint) error {
	tables := []struct {
		name    string
		hasUser bool
	}{
		{constants.TABLE_USER_WORD_STATES, true},
		{constants.TABLE_REVIEW_QUEUE, true},
		{models.UserWordProgress{}.TableName(), true},
		{constants.TABLE_SESSION_WORDS, false},
	}

	for _, t := range tables {
		// 关联表可能未在当前库中建表，跳过不存在的表，避免 1146 报错。
		if !tx.Migrator().HasTable(t.name) {
			continue
		}
		if err := reassignTable(tx, t.name, t.hasUser, keeperID, dupID); err != nil {
			return err
		}
	}
	return nil
}

func reassignTable(tx *gorm.DB, table string, hasUserKey bool, keeperID, dupID uint) error {
	if !tx.Migrator().HasTable(table) {
		return nil
	}
	if hasUserKey {
		type uidRow struct {
			UserID uint `gorm:"column:user_id"`
		}
		var users []uidRow
		if err := tx.Table(table).Select("DISTINCT user_id").
			Where("word_id = ? AND is_deleted = ?", dupID, models.SoftDeleteStatusActive).
			Find(&users).Error; err != nil {
			return err
		}
		for _, u := range users {
			var keeperCnt int64
			tx.Table(table).Where("user_id = ? AND word_id = ? AND is_deleted = ?",
				u.UserID, keeperID, models.SoftDeleteStatusActive).Count(&keeperCnt)
			if keeperCnt > 0 {
				if err := tx.Table(table).Where("user_id = ? AND word_id = ? AND is_deleted = ?",
					u.UserID, dupID, models.SoftDeleteStatusActive).Updates(map[string]any{
					"is_deleted": models.SoftDeleteStatusDeleted,
					"update_by":  operator,
				}).Error; err != nil {
					return err
				}
			} else {
				if err := tx.Table(table).Where("user_id = ? AND word_id = ? AND is_deleted = ?",
					u.UserID, dupID, models.SoftDeleteStatusActive).
					Update("word_id", keeperID).Error; err != nil {
					return err
				}
			}
		}
		return nil
	}

	return tx.Table(table).Where("word_id = ? AND is_deleted = ?", dupID, models.SoftDeleteStatusActive).
		Update("word_id", keeperID).Error
}

func softDeleteWord(tx *gorm.DB, id uint) error {
	return tx.Model(&models.Word{}).Where("id = ? AND is_deleted = ?", id, models.SoftDeleteStatusActive).
		Updates(map[string]any{
			"is_deleted": models.SoftDeleteStatusDeleted,
			"update_by":  operator,
		}).Error
}

func wordIDs(words []models.Word) []uint {
	ids := make([]uint, len(words))
	for i, w := range words {
		ids[i] = w.ID
	}
	return ids
}
