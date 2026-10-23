# Search links

`/q` is the canonical advanced search page; `/search` is also accepted. For example `/q?q=علم&m=r` searches root علم. Defaults are omitted; no refresh token or opaque JSON blob is needed.

Parameters: `q` query; `m=r|l` root/lemma (omitted for text); `s` comma-separated surah numbers; repeated `l` lemma facets and `b` form facets; `h=0` disables related roots; `p=0` disables partial matches; `n=1` enables spelling tolerance; `t=1` shows translation; `tr` selects a non-default translator (Safavi is omitted).

Exact occurrence filters additionally retain `o=type.surah.ayah.position` (`r`, `f`, `w`), `r` root, `w` source text, `f` source form and `px=1` for a prefix. This preserves the underlying corpus lemma/form identity rather than guessing it from display text.

Typing and filter changes replace the search entry; entering search creates an entry so browser Back and Forward can traverse reading and search. Result links clear search parameters. Native clients use `/?search=1&...` locally; copied links always use the public `/q` route.
