# Lincoln AI meetup deck: how LSPC Weather was developed with AI agents

- `CONTRACT.md`: the agreed scope, sources and identifier rules (2026-11-10).
- `claims.md`: every date, count, quote and claim on a slide, with where it
  comes from and how it was read. Slides mark their claims as small grey
  `C<n>` references.
- `talk.qmd`: the deck's source, Quarto reveal.js. Its own stylesheet is in
  a `<style>` block at the top of the first content slide, so pandoc and
  Quarto render it alike.
- `talk.html`: the rendered deck, one self-contained file (reveal.js 5.1.0
  embedded, about 4 MB).
- `review.md`: a fresh reviewer agent's check of every claim against the
  repository, and of the identifier rules.
- `img/dashboard-1280.png`: the live site on 2026-11-11, at 1280 px.

## Rendering

Quarto is not installed in the sandbox, so drafts there are rendered with
pandoc's reveal.js writer, which reads the same source:

```
pandoc -f markdown talk.qmd -t revealjs -s --embed-resources \
  -V revealjs-url=<unpacked reveal.js 5.1.0> -V theme=black \
  -V width=1280 -V height=800 -V margin=0.06 -V slideNumber=true -V transition=none -V controls=false \
  -o talk.html
```

With Quarto installed, `quarto render talk.qmd` gives the same deck from
the YAML header. For the final render, the claim references can be dropped
by `scripts/renderTalk.sh`, which renders the site's copy,
`public/talk/index.html`, without them (and the draft here with `--draft`).

The site's copy is `public/talk/index.html`, linked from the dashboard's
footer as "How this was built" (the maintainer, 2026-11-11) and loaded by
the live-site check with the other pages. Re-run `scripts/renderTalk.sh`
after any change to the source, and `--draft` for the copy here.

## Kept up to date

The deck is kept in step with the dashboard at the maintainer's word (2026-11-23), not frozen as given. The deck as given at the meetup is in the history at commit 60e8b95, the last change to the source before this one. Changed since: 2026-11-23, the sources slide and the "more than one station" slide, after the winds-aloft fallback was dropped (claims C29 and C34). `review.md` is the reviewer's check of the deck as given and is not revised.
