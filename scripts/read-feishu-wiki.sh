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
    perl -0pi -e "s#<figure[^>]*>\\s*<source[^>]*token=\"\\Q$media_token\\E\"[^>]*/>\\s*</figure>#<p><a href=\"$md_assets_prefix/$media_name\">$media_name</a></p>#g" "$localized_html_path"
  else
    echo "Warning: failed to download source media $media_token" >&2
  fi
done

pandoc -f html -t gfm --wrap=none "$localized_html_path" -o "$md_path"

printf '%s\n' "$md_path"
