# Coffee Log site

`build.mjs` writes one static HTML page per note into `dist/`, a page per
folder listing all its notes, and a home page with the last three Brews and
Bags as cards. Every page comes from one layout and follows the
`design-system` skill: `base.css` goes inline in a `<style>`, and `page.js`
(vanilla, it makes long tables searchable and sortable) in a `<script>`.
No framework: the user rejected Quartz and a React app as far too heavy for
one template. The only build dependency is `marked`.

- `base.css` is a verbatim copy of the skill's file: never edit it here, and
  copy it again when the skill changes. `page.js` is the skill's file without
  the fingerprint and the table-of-contents scroll tracking, which this site
  doesn't use; when the skill changes, copy it again and make the same cut.
- The favicon is `favicon.gif`: a looping 1-bit pixel-art V60 with steam on a
  transparent ground, 64 px, 12 frames. Chrome and Safari show its first
  frame only.
- Two departures from the skill, both the user's choice: `nav.index` lists
  the home page and the folders instead of a table of contents, and the home
  page adds `card.css`, a Card after shadcn/ui's, cut to an image, a title
  and a description.
- This folder and `.github/` exist only on the `site` branch, which
  `.github/workflows/pages.yml` deploys on every push. Vault changes come
  from `main` by merge (see the root `CLAUDE.md`).
- A new note folder must be added to `FOLDERS` in `build.mjs`.
- Property names carry their unit in parentheses, `Bag size (g)`; the page
  shows the unit once in the label, `Bag size, g`, and the value bare, `150`.
- Before pushing, run `node build.mjs`, then
  `python3 ~/.claude/skills/design-system/lint.py` on every page in `dist`:
  only `index.html` may report, and only its card. Serve `dist` under a
  `/coffee_log/` path and check the pages in a browser at full and phone
  width.
