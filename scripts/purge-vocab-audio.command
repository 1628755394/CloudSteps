#!/bin/bash
cd /Users/cetide/Desktop/LingByte/CloudSteps
export GOMODCACHE="$HOME/go/pkg/mod"
export GOPROXY=https://proxy.golang.org,direct
export DB_HOST_IP=43.141.193.58
LOG=/tmp/purge-vocab-audio.out
{
  echo "==== $(date) START ===="
  ./scripts/purge-vocab-audio.sh --dry-run
  echo "==== EXECUTE ===="
  ./scripts/purge-vocab-audio.sh --execute
  echo "==== DONE ===="
} 2>&1 | tee "$LOG"
echo
echo "Log written to $LOG"
read -r -p "Press Enter to close..."
