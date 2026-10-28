# Coffee Log

A personal Obsidian vault: plain Markdown notes with YAML properties, no code.
Domain terms live in `GLOSSARY.md` and decisions in `docs/adr/`; read both
before changing how a note kind is structured, and keep them current.

## Layout

One folder per note kind, one template per kind in `Templates/`. A new note
starts from its template. Photos and PDFs are saved into `Attachments/`, never
hot-linked. `00_Meta/` holds upkeep tools: open `00_Meta/Unfilled fields.base`
to see which notes still have empty properties, and add a property there when
a template gains one.

Every push to `main` publishes a read-only site at
https://maxim-k.github.io/coffee_log/ (`.github/workflows/pages.yml`).
`.site/build.mjs` writes one static HTML page per note plus a home page
("Last bags" tiles and an "All bags" table); `.site/style.css` holds the
shadcn-style CSS. No framework and no browser JavaScript: the user rejected
Quartz and a React app as far too heavy for one template. A new note folder
must be added to `FOLDERS` in `build.mjs`. Before pushing a site change,
serve `.site/dist` under a `/coffee_log/` path and check it in a browser.

## Conventions

- Property names are snake_case with the unit in the name: `dose_g`,
  `hardness_caco3_mg_l`.
- Roaster text is copied as written: no normalization, no conflict notes.
- Brew notes stay uncluttered: one `grind` field as dialed (`1-2-1`), nothing
  derived from it. The user feels strongly about this.
- Where a Water's numbers came from (published, calculated, measured) goes in
  the note body, not a property.

## Skills

- `add-bag` for every new Bag.
- `conventional-commit` for every commit; no scope until a `SCOPES.md` exists.

## Not now

- Bases views for analysis: the user is collecting data first. Bases, not
  Dataview, when the time comes. The `00_Meta` report is the one exception.
- Normalizing roaster text into numbers (elevation ranges, prices).
- Water notes beyond NYC Tap and Distilled.

## Open items

- NYC Tap values are unverified figures from NYC DEP's 2025 report. Check them
  if the PDF lands in `Attachments/`.
- Before relying on Bases reading fields across linked notes, check that it
  can.

## Working with the user

They often work by voice from a phone and answer loosely: map their answers
to your questions. Act directly, without repeated confirmations or recaps.
