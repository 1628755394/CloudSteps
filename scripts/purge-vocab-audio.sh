#!/bin/bash
# Clear all vocab-question audio via object-store Delete, then empty audio_url.
# Usage:
#   ./scripts/purge-vocab-audio.sh --dry-run
#   ./scripts/purge-vocab-audio.sh --execute
set -euo pipefail
cd "$(dirname "$0")/.."
export GOMODCACHE="${HOME}/go/pkg/mod"
export GOPROXY="${GOPROXY:-https://proxy.golang.org,direct}"

MODE="${1:---dry-run}"
DB_HOST_IP="${DB_HOST_IP:-}"

# Optional: replace DSN hostname with IP when DNS fails (leave empty to use .env as-is).
DSN_FLAG=()
if [[ -n "$DB_HOST_IP" ]]; then
  # shellcheck disable=SC1091
  set -a
  # Load only DSN from .env without sourcing whole file into shell history noise
  DSN_LINE=$(grep -E '^DSN=' .env | head -1 | sed 's/^DSN=//')
  set +a
  DSN_OVERRIDE=$(python3 - "$DSN_LINE" "$DB_HOST_IP" <<'PY'
import re, sys
dsn, ip = sys.argv[1], sys.argv[2]
# mysql DSN: user:pass@tcp(host:port)/db?...
out = re.sub(r'@tcp\(([^:]+):(\d+)\)', lambda m: f'@tcp({ip}:{m.group(2)})', dsn, count=1)
print(out)
PY
)
  DSN_FLAG=(-dsn "$DSN_OVERRIDE")
fi

LOG=/tmp/purge-vocab-audio.log
{
  echo "==== $(date) mode=$MODE db_host_ip=${DB_HOST_IP:-<from-.env>} ===="
  go run ./cmd/purge-vocab-audio "$MODE" "${DSN_FLAG[@]}"
} 2>&1 | tee "$LOG"
