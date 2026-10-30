# Coffee Log site

`build.mjs` writes one static HTML page per note into `dist/`, a page per
folder listing all its notes, and a home page with the last three Brews and
Bags as cards. Every page comes from one layout and follows the
`design-system` skill: `base.css` goes inline verbatim in a `<style>`, and
`page.js` (vanilla, it makes long tables searchable and sortable) in a
`<script>`. No framework: the user rejected Quartz and a React app as far
too heavy for one template. The only build dependency is `marked`.

- `base.css` and `page.js` are verbatim copies of the skill's files. Never
  edit them here; when the skill changes, copy them again.
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
