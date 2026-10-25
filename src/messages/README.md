# Editing interface text

- Edit values in `<language>.json`. Keep keys stable when changing wording.
- Add a new key to Persian (`fa.json`) and every supported catalogue together.
- Use `t('key', {p0: value})` in components; never put visible UI labels directly
  in JSX, placeholders, titles, accessibility names, buttons or UI helper strings.
- Preserve interpolation names/counts in every locale. Text is rendered through
  React, never as HTML. Do not put HTML in messages.
- `languages.json` lists selectable UI locales; `regions.json` is a coarse fallback
  mapping, not a claim that a country has only one language.
- Persian is the default/fallback. Source book titles, people, Quran passages and
  source translations are content: keep their verified source text separately in
  the data registry, not in UI message rewriting.
- Initial locale catalogues were machine translated and structurally checked;
  corrections from native speakers can be made directly in these files.
- Run `bun test src/lib/i18n.test.ts` after edits. The test checks all keys,
  placeholders, language matching and imported translation coverage.
