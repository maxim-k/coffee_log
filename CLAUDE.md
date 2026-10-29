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

## Conventions

- Property names are human-readable, in sentence case, with the unit in
  parentheses: `Dose (g)`, `Hardness as CaCO3 (mg/L)`. Obsidian's own
  `aliases` stays lowercase.
- Roaster text is copied as written: no normalization, no conflict notes.
- `Varieties/` is the dictionary of varieties: a Bag's `Variety` links its
  canonical notes, and the roaster's own wording goes to Details.
- Brew notes stay uncluttered: one `Grind` field as dialed (`1-2-1`), nothing
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
