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
with `sed -E 's/ ?\[C[0-9, to]+\]\{\.ref\}//g' talk.qmd > talk-final.qmd`
before rendering.

The deck is not part of the site: the deploy workflow publishes `dist/`,
which does not include `docs/`.
