# CloudSteps 维护脚本

本目录存放数据库维护、数据清洗等一次性脚本说明与入口。

## clean-duplicate-words — 清理重复单词

针对 `words` 表：在同一词库（`word_book_id`）内，按 **不区分大小写** 的 `word` 字段识别重复，保留信息更完整的一条，对其余记录做软删除，并修正学习进度等关联表中的 `word_id`。

### 判定规则

- 表：`words`（`is_deleted = 0` 的有效记录）
- 重复定义：相同的 `word_book_id` + `LOWER(TRIM(word))`
- 保留策略：释义/音频/例句等字段越全越好；得分相同则保留 **最小 id**

### 运行前

1. 确保 `CloudStepsGo/.env` 中 `DB_DRIVER`、`DSN` 配置正确  
2. 建议先备份数据库  
3. 先用预览模式确认将删除的记录

### 命令

在项目根目录执行：

```bash
# 预览（默认，不写库）
./scripts/clean-duplicate-words.sh

# 或
cd CloudStepsGo && go run ./cmd/clean-duplicate-words --dry-run

# 真正执行清理
./scripts/clean-duplicate-words.sh --execute

# 仅清理某个词库
cd CloudStepsGo && go run ./cmd/clean-duplicate-words --execute --word-book-id=12
```

### 关联表处理

脚本会将以下表中指向「待删单词 id」的记录改指向保留 id；若同一用户已存在保留 id 的记录，则软删除重复侧关联行，避免唯一索引冲突：

- `user_word_states`
- `review_queue`
- `user_word_progress`
- `session_words`

执行结束后会按词库调用 `SyncWordBookCount` 更新 `word_books.word_count`。
