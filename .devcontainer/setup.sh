#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> 生成 .env（默认 sqlite，开箱即用，无需额外数据库）"
if [ ! -f .env ]; then
  cp example.env .env
fi

echo "==> 下载 Go 依赖"
go mod download

echo "==> 安装 web 前端依赖 (pnpm)"
(cd web && pnpm install)

echo "==> 安装 admin 后台依赖 (pnpm)"
(cd admin && pnpm install)

cat <<'EOF'

环境准备完成！常用命令：
  go run ./cmd/server        # 启动后端 (http://localhost:7080)
  cd web && pnpm dev         # 启动 web 前端 (http://localhost:3000)
  cd admin && pnpm dev       # 启动 admin 后台 (http://localhost:5174)
  make test                  # 运行全部测试

默认使用 sqlite（DB_DRIVER=sqlite，DSN=./ling.db），无需额外配置数据库即可跑通。
如需连接 MySQL 等外部服务，请编辑 .env 中的 DB_DRIVER / DSN 及其他密钥项。
EOF
