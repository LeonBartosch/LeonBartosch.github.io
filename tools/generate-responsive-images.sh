#!/usr/bin/env bash

set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_root="$project_root/assets/generated"
temporary_root="$(mktemp -d)"

trap 'rm -rf "$temporary_root"' EXIT

for command_name in sips cwebp avifenc; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Missing required image tool: $command_name" >&2
    exit 1
  fi
done

mkdir -p "$output_root/cards" "$output_root/hero"

generate_variant() {
  local source_path="$1"
  local destination_directory="$2"
  local output_name="$3"
  local width="$4"
  local temporary_jpeg="$temporary_root/${output_name}-${width}.jpg"
  local output_base="$destination_directory/${output_name}-${width}"

  sips \
    --resampleWidth "$width" \
    --setProperty format jpeg \
    --setProperty formatOptions 80 \
    "$source_path" \
    --out "$temporary_jpeg" >/dev/null

  cp "$temporary_jpeg" "${output_base}.jpg"
  cwebp -quiet -q 78 -metadata none "$temporary_jpeg" -o "${output_base}.webp"
  avifenc --qcolor 58 --speed 6 --ignore-exif --ignore-xmp \
    "$temporary_jpeg" "${output_base}.avif" >/dev/null
}

for source_path in "$project_root"/thumbnails/*.jpg; do
  output_name="$(basename "$source_path" .jpg)"

  for width in 320 640 960 1440; do
    generate_variant "$source_path" "$output_root/cards" "$output_name" "$width"
  done
done

for width in 768 1280 1920 2248; do
  generate_variant \
    "$project_root/assets/img/hero.jpg" \
    "$output_root/hero" \
    "hero" \
    "$width"
done

echo "Responsive images generated in $output_root"
