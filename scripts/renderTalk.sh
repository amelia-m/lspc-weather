#!/usr/bin/env bash
# Render the Lincoln AI meetup deck (docs/talks/lincoln-ai-meetup/talk.qmd)
# as the site's page, public/talk/index.html: one self-contained HTML file
# with reveal.js 5.1.0 embedded and the claim references (the small grey
# C-numbers that tie each slide to docs/talks/lincoln-ai-meetup/claims.md)
# stripped. The draft beside the source, talk.html, keeps them.
#
# Quarto is the source's native renderer and is not installed in the
# sandbox; pandoc's reveal.js writer reads the same file and gives the
# same deck from the stylesheet in its first slide. reveal.js comes from
# the npm registry, which the sandbox and the runners can reach.
#
#   scripts/renderTalk.sh            # writes public/talk/index.html
#   scripts/renderTalk.sh --draft    # writes docs/talks/lincoln-ai-meetup/talk.html, references kept
set -euo pipefail
cd "$(dirname "$0")/.."
src=docs/talks/lincoln-ai-meetup/talk.qmd
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
(cd "$work" && npm pack reveal.js@5.1.0 --silent > /dev/null && mkdir reveal && tar -xzf reveal.js-5.1.0.tgz -C reveal --strip-components=1)
if [ "${1:-}" = "--draft" ]; then
  out=docs/talks/lincoln-ai-meetup/talk.html
  cp "$src" "$work/talk.md"
else
  out=public/talk/index.html
  mkdir -p public/talk
  sed -E 's/ ?\[C[0-9C, to]+\]\{\.ref\}//g' "$src" > "$work/talk.md"
fi
# The site's icon, embedded like everything else (the resource path finds
# it in public/), so the page asks for no file of its own.
printf '<link rel="icon" type="image/svg+xml" href="favicon.svg">\n' > "$work/head.html"
pandoc -f markdown "$work/talk.md" -t revealjs -s --embed-resources \
  --resource-path="docs/talks/lincoln-ai-meetup:public" \
  --include-in-header "$work/head.html" \
  -V revealjs-url="$work/reveal" -V theme=black -V width=1280 -V height=800 -V margin=0.06 \
  -V slideNumber=true -V transition=none -V controls=false \
  -o "$out"
echo "$out: $(wc -c < "$out") bytes"
