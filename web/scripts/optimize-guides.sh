#!/usr/bin/env bash
# Rename Chinese flow folders → English under web/public/guides and recompress JPEGs.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/流程"
DEST="${ROOT}/web/public/guides"
MAX_WIDTH="${GUIDES_MAX_WIDTH:-1400}"
JPEG_QUALITY="${GUIDES_JPEG_QUALITY:-72}"

if [[ ! -d "$SRC" ]]; then
  echo "Source folder not found: $SRC" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required (macOS)" >&2
  exit 1
fi

compress_one() {
  local src="$1"
  local dest="$2"
  mkdir -p "$(dirname "$dest")"
  # Copy first, then resample width + recompress in place (sips mutates dest).
  cp "$src" "$dest"
  local w
  w="$(sips -g pixelWidth "$dest" 2>/dev/null | awk '/pixelWidth:/{print $2}')"
  if [[ -n "$w" && "$w" -gt "$MAX_WIDTH" ]]; then
    sips --resampleWidth "$MAX_WIDTH" "$dest" >/dev/null
  fi
  sips -s format jpeg -s formatOptions "$JPEG_QUALITY" "$dest" >/dev/null
  # Normalize extension if sips rewrote format
  if [[ "$dest" != *.jpg && "$dest" != *.jpeg ]]; then
    mv "$dest" "${dest%.*}.jpg"
  fi
}

echo "→ guides → $DEST (maxWidth=${MAX_WIDTH}, quality=${JPEG_QUALITY})"
rm -rf "$DEST"
mkdir -p "$DEST/word-training" "$DEST/student-management"

# Overview long-strip images are intentionally skipped (steps only).

# Word training steps: Group 1..19 → step-01..step-19
for i in $(seq 1 19); do
  src="$SRC/单词训练/Group ${i}.jpg"
  printf -v name "step-%02d.jpg" "$i"
  if [[ -f "$src" ]]; then
    compress_one "$src" "$DEST/word-training/$name"
  else
    echo "missing: $src" >&2
  fi
done

# Student management: Group 20..25 → step-01..step-06
step=1
for i in $(seq 20 25); do
  src="$SRC/学员管理/Group ${i}.jpg"
  printf -v name "step-%02d.jpg" "$step"
  if [[ -f "$src" ]]; then
    compress_one "$src" "$DEST/student-management/$name"
  else
    echo "missing: $src" >&2
  fi
  step=$((step + 1))
done

echo "done. sizes:"
du -sh "$DEST" "$DEST"/* 2>/dev/null
find "$DEST" -type f | sort | while read -r f; do
  printf "  %6s  %s\n" "$(du -h "$f" | awk '{print $1}')" "${f#$DEST/}"
done

# Remove original Chinese-named source after successful export
rm -rf "$SRC"
echo "removed source: $SRC"
