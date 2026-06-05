#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <feishu_doc_or_wiki_url> [output_dir]" >&2
  exit 2
fi

url="$1"
out_dir="${2:-工具/feishu-wiki-cache}"

if ! command -v lark-cli >/dev/null 2>&1; then
  echo "lark-cli is required. Install with: npm install -g @larksuite/cli" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required." >&2
  exit 1
fi

if ! command -v pandoc >/dev/null 2>&1; then
  echo "pandoc is required to convert HTML to Markdown." >&2
  exit 1
fi

token="$(printf '%s' "$url" | sed -E 's#.*(/wiki/|/docx/|/docs/)([A-Za-z0-9_-]+).*#\2#')"
if [[ -z "$token" || "$token" == "$url" ]]; then
  token="$(date +%Y%m%d%H%M%S)"
fi

mkdir -p "$out_dir/raw" "$out_dir/html" "$out_dir/markdown"

raw_path="$out_dir/raw/$token.json"
html_path="$out_dir/html/$token.html"
localized_html_path="$out_dir/html/$token.localized.html"
md_path="$out_dir/markdown/$token.md"
assets_dir="$out_dir/assets/$token"
md_assets_prefix="../assets/$token"

lark-cli docs +fetch --api-version v2 --doc "$url" --format json > "$raw_path"
jq -r '.data.document.content' "$raw_path" > "$html_path"
cp "$html_path" "$localized_html_path"

mkdir -p "$assets_dir"

media_preview() {
  lark-cli docs +media-preview "$@" >/dev/null 2>&1 &
  local pid="$!"
  local waited=0
  local timeout_seconds=25

  while kill -0 "$pid" >/dev/null 2>&1; do
    if (( waited >= timeout_seconds )); then
      kill "$pid" >/dev/null 2>&1 || true
      wait "$pid" >/dev/null 2>&1 || true
      return 124
    fi
    sleep 1
    waited=$((waited + 1))
  done

  wait "$pid"
}

unique_media_name() {
  local media_name="$1"
  local media_token="$2"
  local base="${media_name%.*}"
  local ext=""

  if [[ "$media_name" == *.* ]]; then
    ext=".${media_name##*.}"
  else
    base="$media_name"
  fi

  local suffix="${media_token:0:10}"
  printf '%s-%s%s' "$base" "$suffix" "$ext"
}

perl -0ne '
  while (/<img\b([^>]*?)\/?>/g) {
    my $attrs = $1;
    my ($src) = $attrs =~ /\bsrc="([^"]+)"/;
    my ($name) = $attrs =~ /\bname="([^"]+)"/;
    my ($mime) = $attrs =~ /\bmime="([^"]+)"/;
    next unless $src;
    print join("\t", $src, $name || "$src", $mime || ""), "\n";
  }
' "$html_path" | while IFS=$'\t' read -r media_token media_name media_mime; do
  if [[ "$media_name" != *.* ]]; then
    case "$media_mime" in
      image/jpeg) media_name="$media_name.jpg" ;;
      image/png) media_name="$media_name.png" ;;
      image/gif) media_name="$media_name.gif" ;;
      image/webp) media_name="$media_name.webp" ;;
      *) media_name="$media_name.bin" ;;
    esac
  fi

  media_name="$(unique_media_name "$media_name" "$media_token")"
  output_path="$assets_dir/$media_name"
  if media_preview --token "$media_token" --output "$output_path" --overwrite; then
    perl -0pi -e "s#src=\"\\Q$media_token\\E\"#src=\"$md_assets_prefix/$media_name\"#g" "$localized_html_path"
  else
    echo "Warning: failed to download image media $media_token" >&2
  fi
done

perl -0ne '
  my $i = 0;
  while (/<source\b([^>]*?)\/?>/g) {
    $i++;
    my $attrs = $1;
    my ($media_token) = $attrs =~ /\btoken="([^"]+)"/;
    my ($mime) = $attrs =~ /\bmime="([^"]+)"/;
    next unless $media_token;
    my $ext = "bin";
    $ext = "m4a" if ($mime || "") =~ m#audio/(x-)?m4a|audio/mp4#;
    $ext = "mp3" if ($mime || "") =~ m#audio/mpeg#;
    $ext = "mp4" if ($mime || "") =~ m#video/mp4#;
    print join("\t", $media_token, "media-$i.$ext"), "\n";
  }
' "$html_path" | while IFS=$'\t' read -r media_token media_name; do
  output_path="$assets_dir/$media_name"
  if media_preview --token "$media_token" --output "$output_path" --overwrite; then
    perl -0pi -e "s#<source\\b[^>]*token=\"\\Q$media_token\\E\"[^>]*/>#<video class=\"feishu-video\" controls playsinline preload=\"metadata\" src=\"$md_assets_prefix/$media_name\"></video>#g" "$localized_html_path"
  else
    echo "Warning: failed to download source media $media_token" >&2
  fi
done

perl -0pi -e '
  s#<figure\b[^>]*>\s*(<video\b.*?</video>)\s*</figure>#$1#gs;
  s#<grid\b[^>]*>#<div class="feishu-grid">#g;
  s#</grid>#</div>#g;
  s#<column\b([^>]*)>#my $attrs = $1; my ($ratio) = $attrs =~ /width-ratio="([^"]+)"/; $ratio ||= "1"; "<div class=\"feishu-column\" style=\"flex: $ratio 1 0;\">" #ge;
  s#</column>#</div>#g;
  s#<chat_card\b([^>]*)>\s*</chat_card>#my $attrs = $1; my ($name) = $attrs =~ /name="([^"]+)"/; $name ||= "飞书群"; "<div class=\"feishu-card\"><strong>$name</strong><span>飞书群卡片</span></div>" #ge;
' "$localized_html_path"

pandoc -f html -t gfm --wrap=none "$localized_html_path" -o "$md_path"

LOCALIZED_HTML_PATH="$localized_html_path" MD_PATH="$md_path" node <<'NODE'
const { readFileSync, writeFileSync } = require("node:fs");

const html = readFileSync(process.env.LOCALIZED_HTML_PATH, "utf8");
let markdown = readFileSync(process.env.MD_PATH, "utf8");
const videos = [...html.matchAll(/<p>([^<]*)<\/p>\s*(<video\b[^>]*><\/video>)/g)];

for (const [, caption, video] of videos) {
  const tableCell = `<td><p>${caption}</p></td>`;
  const replacement = `<td><p>${caption}</p>\n${video}</td>`;
  if (markdown.includes(tableCell)) {
    markdown = markdown.replace(tableCell, replacement);
  }
}

writeFileSync(process.env.MD_PATH, markdown);
NODE

printf '%s\n' "$md_path"
