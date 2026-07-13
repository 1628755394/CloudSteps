#!/usr/bin/env bash
# 清理 words 表重复单词 — 入口脚本
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/CloudStepsGo"

ARGS=("$@")
if [[ ${#ARGS[@]} -eq 0 ]]; then
  ARGS=(--dry-run)
fi

echo "==> CloudSteps 清理重复单词"
echo "    工作目录: $(pwd)"
echo "    参数: ${ARGS[*]}"
echo ""

go run ./cmd/clean-duplicate-words "${ARGS[@]}"
