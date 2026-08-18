# 云阶 CloudSteps

> 陪练与词汇训练平台 — coaching、单词训练、情景口语一站式服务。

云阶 CloudSteps 是 LingByte 旗下的英语陪练与词汇训练产品，覆盖**单词识记 / 复习 / 快闪 / 抗遗忘**完整训练闭环，并集成**情景口语实时对话**、**多引擎 TTS 合成**、**对象存储**与**后台管理**能力。后端 Go + Gin，前端 React + Vite，基础能力复用 [ling-base](https://github.com/LingByte/ling-base) 多 module 工具库。

- 后端仓库：[LingByte/CloudSteps](https://github.com/LingByte/CloudSteps)
- 基础库：[LingByte/ling-base](https://github.com/LingByte/ling-base)
- LLM 能力：[LingByte/lingllm](https://github.com/LingByte/lingllm)

## 功能概览

### 训练闭环
- **单词训练**：词库选择 → 训前检测 → 单词练习（5 词一组）→ 单词复习 → 快闪 → 训后检测 → 创建抗遗忘任务
- **智能记忆灯塔**：九宫格灯泡可视化学习进度
- **抗遗忘复习**：按日期分组调度，自动安排复习任务
- **词汇测试 / 语法 / 阅读理解 / 完形填空**：多题型配套

### 陪练 & 口语
- **教练排课**：预约训练、训练时长统计、教练-学员词库协同
- **情景口语**：基于 `ling-base/realtime` 的实时对话（阿里云 Omni / 火山引擎 Volcdialogue 等多 provider）
- **自动问候**：`internal/voice/auto_greet` 自动开场白

### TTS & 音频
- **统一 TTS 工厂** `pkg/synthesizer`：聚合 16+ 引擎（腾讯云 / 阿里云 / 火山 / 百度 / 讯飞 / Google / Azure / AWS / OpenAI / ElevenLabs / MiniMax / FishAudio / FishSpeech / Coqui / Qiniu / 本地）
- **词库批量音频**：多账号并发 + 排队（`ling-base/queue`）+ 失败重试退避
- **音频清理 / 重新生成**：`cmd/purge-vocab-audio`、`cmd/wordbook-purge-audio`

### 后台 & 运营
- **admin 后台**：词库 / 词汇 / 题目 / 用户 / 教练管理、批量音频任务监控
- **通知**：邮件（SMTP）+ 站内信（`ling-base/notification`）
- **验证码**：滑块 / 点选 / 拼图 / 算术 / 旋转（`ling-base/captcha`）
- **对象存储**：七牛 / 阿里云 OSS / 腾讯云 COS / 华为 OBS / AWS S3 / MinIO / 本地 等（`ling-base/stores`）

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Go 1.26 · Gin · GORM（MySQL / SQLite） |
| 基础库 | [ling-base](https://github.com/LingByte/ling-base)（多 module：bootstrap / cache / common / captcha / stores / synthesizer / realtime / queue / notification …） |
| LLM | [lingllm](https://github.com/LingByte/lingllm) |
| web 前端 | React 18 · Vite 6 · TypeScript · Tailwind · shadcn/ui · Zustand · React Router 7 |
| admin 后台 | React 18 · Vite · TypeScript · Arco Design · Tailwind · Zustand |
| CI | GitHub Actions（go test / vet + web & admin 构建 + GitHub Pages 部署） |
| 设计规范 | 见 [DESIGN.md](./DESIGN.md)（Warm Mint 主题） |

## 仓库结构

```
CloudSteps/
├─ cmd/                       # 后端入口
│  ├─ server/                 # 主服务（API + 静态资源）
│  ├─ bootstrap/              # 启动装配
│  ├─ migrate-seed/           # 数据库迁移与种子
│  ├─ tts-gen/                # TTS 批量生成工具
│  ├─ iciba-scrape/           # 词库抓取
│  ├─ ddjdc-import/           # 词典导入
│  ├─ clean-duplicate-words/  # 重复词清理
│  ├─ purge-vocab-audio/      # 音频清理
│  └─ qcloud-get-appid/       # 腾讯云 AppID 工具
├─ internal/
│  ├─ handlers/               # HTTP 路由处理器（auth/coaching/study/tts/wordbooks …）
│  ├─ listeners/              # 事件监听
│  ├─ models/                 # GORM 数据模型
│  ├─ task/                   # 后台任务
│  └─ voice/                  # 语音 / 自动问候 / realtime 工厂
├─ pkg/
│  ├─ synthesizer/            # 统一 TTS 工厂 + 配置
│  ├─ stores/                 # 对象存储适配
│  ├─ llm/                    # LLM 客户端
│  ├─ middleware/             # Gin 中间件（CSRF / 鉴权 …）
│  ├─ audio/                  # 音频处理
│  ├─ config/                 # 配置加载
│  ├─ constants/              # 常量
│  └─ utils/                  # 工具
├─ web/                       # 学员端 H5 前端（React + Vite）
├─ admin/                     # 运营后台前端（React + Arco）
├─ templates/                 # 邮件模板 / favicon
├─ i18n/                      # 国际化翻译
├─ scripts/                   # 运维脚本
├─ docs/                      # 设计 / 实现文档
├─ .github/workflows/         # CI（ci.yml + deploy-pages.yml）
├─ .devcontainer/             # Dev Container 配置
├─ Makefile                   # 构建 / 测试 / 交叉编译 / 发版
├─ example.env                # 环境变量模板
├─ go.mod / go.sum
└── DESIGN.md                 # 设计系统规范
```

## 快速开始

### 环境要求
- Go **1.26.2+**
- Node.js **20+** + pnpm **9+**（前端）
- MySQL（生产）或 SQLite（开发，`DB_DRIVER=sqlite`）
- 可选：FFmpeg（视频处理）、CGO（SQLite 驱动）

### 1. 克隆

```bash
git clone git@github.com:LingByte/CloudSteps.git
cd CloudSteps
```

### 2. 配置环境变量

```bash
cp example.env .env
# 按需填写 DB / SMTP / LLM / TTS / 对象存储 等 key
```

关键字段（完整见 [example.env](./example.env)）：

| 变量 | 说明 |
|---|---|
| `MODE` | `development` / `test` / `production` |
| `ADDR` | 监听端口，默认 `:7080` |
| `DB_DRIVER` / `DSN` | 数据库驱动与连接串 |
| `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` | 文本 / 复盘 LLM |
| `TTS_PROVIDER` | 默认 TTS 引擎，如 `qcloud` |
| `QCLOUD_TTS_ACCOUNTS` | 腾讯云 TTS 多账号 JSON 数组 |
| `REALTIME_PROVIDER` / `REALTIME_API_KEY` | 情景口语 realtime 引擎 |
| `STORAGE_KIND` | 对象存储类型（七牛 / OSS / COS …） |
| `SESSION_SECRET` | 会话签名密钥 |

### 3. 安装依赖

```bash
# 后端
go mod download

# 前端（web + admin）
cd web && pnpm install
cd ../admin && pnpm install
```

或一键：

```bash
make deps            # 需本地有 npm/pnpm
```

### 4. 初始化数据库

```bash
go run ./cmd/server --init            # 建表
go run ./cmd/server --seed            # 种子数据（可选）
# 或指定 init SQL：
go run ./cmd/server --init --init-sql=./path/to/schema.sql
```

### 5. 启动开发

```bash
# 后端（:7080）
make dev-server        # 等价于 go run ./cmd/server

# web 学员端（:3000）
make dev-web

# admin 后台（:5174）
make dev-admin
```

或在 Dev Container / Codespaces 中直接打开，端口已自动转发。

## 构建

```bash
make help            # 查看所有命令

# 当前平台
make backend         # 后端 → dist/cloudsteps-server-<os>-<arch>
make frontend        # web + admin 构建
make tools           # cmd/* 工具
make all             # 前端 + 后端 + 工具

# 全平台交叉编译 + 打包
make backend-all-zip

# Docker
make docker
```

构建产物统一输出到 `dist/`，版本信息通过 `-ldflags` 注入（`main.Version` / `main.Commit` / `main.BuildDate`）。

## 测试

```bash
make test            # go + web + admin
make test-go         # 仅后端：go test ./... -v -count=1
go vet ./...         # 静态检查（CI 同款）
```

## CI

[`.github/workflows/ci.yml`](./.github/workflows/ci.yml) 在 `main` 分支 push / PR 时运行：

- **go-test**：`go vet ./...` + `go test ./... -count=1`
- **web-build**：`pnpm install --frozen-lockfile` + `pnpm run build`
- **admin-build**：同上

[`deploy-pages.yml`](./.github/workflows/deploy-pages.yml) 在 `web/**` 变更时把学员端部署到 GitHub Pages。

> 依赖说明：后端通过 Go module proxy 拉取 `github.com/LingByte/ling-base/*` 各子 module（已发版，见 [ling-base tags](https://github.com/LingByte/ling-base/tags)），**不再依赖任何本地路径 replace**。

## 常用工具命令

```bash
# TTS 批量生成
go run ./cmd/tts-gen --help

# 清理词库内重复单词
go run ./cmd/clean-duplicate-words --dry-run
go run ./cmd/clean-duplicate-words --execute

# 词典 / 词库导入
go run ./cmd/ddjdc-import --help
go run ./cmd/ddjdc-dict-import --help
go run ./cmd/iciba-scrape --help

# 数据库迁移 / 种子
go run ./cmd/migrate-seed --help

# 清理词汇音频
go run ./cmd/purge-vocab-audio --help
```

## 相关文档

- [DESIGN.md](./DESIGN.md) — Warm Mint 设计系统（配色 / 字体 / 组件规范）
- [APP_OVERVIEW.md](./APP_OVERVIEW.md) — 产品功能与页面流程概览
- [docs/](./docs/) — 实现笔记（如教练排课配额方案）

## 贡献

- 提 PR 前请确保 `make test-go` 与 `go vet ./...` 通过，前端 `pnpm run build` 通过。
- 遵循 [DESIGN.md](./DESIGN.md) 的视觉规范。

## License

[MIT](./LICENSE) © LingByte
