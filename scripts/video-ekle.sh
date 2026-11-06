#!/usr/bin/env bash
# Flow'dan gelen ham videoyu scroll-scrub için hazırlar.
#   ./scripts/video-ekle.sh ~/Downloads/Falanca.mp4 05-ortodonti
set -euo pipefail

SRC="${1:?kullanim: video-ekle.sh <kaynak.mp4> <ad>}"
NAME="${2:?kullanim: video-ekle.sh <kaynak.mp4> <ad>}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

mkdir -p "$ROOT/raw" "$ROOT/media"
cp "$SRC" "$ROOT/raw/$NAME.mp4"

# Her kare keyframe (-g 1) → tarayıcı ileri-geri sararken takılmaz.
ffmpeg -v error -i "$ROOT/raw/$NAME.mp4" \
  -c:v libx264 -preset slow -crf 27 -g 1 -keyint_min 1 -sc_threshold 0 \
  -vf "scale=540:-2:flags=lanczos" -pix_fmt yuv420p -movflags +faststart -an \
  -y "$ROOT/media/$NAME.mp4"

ffmpeg -v error -i "$ROOT/raw/$NAME.mp4" -vf "scale=540:-2" -frames:v 1 -q:v 4 \
  -y "$ROOT/media/$NAME-poster.jpg"

printf 'hazir: media/%s.mp4 (%s)\n' "$NAME" "$(du -h "$ROOT/media/$NAME.mp4" | cut -f1)"
