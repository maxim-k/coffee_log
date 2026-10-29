# Coffee Log site

`build.mjs` writes one static HTML page per note into `dist/`, a page per
folder listing all its notes, and a home page with the last three Brews and
Bags as cards. Every page has a menu on the left: the site name, then each
folder that has notes, with its count. On a phone the menu sits on top.
`style.css` holds shadcn's tokens and Card and Table styles as plain CSS,
typeset after *The Elements of Typographic Style* and *Words into Type*. No
framework and no browser JavaScript: the user rejected Quartz and a React app
as far too heavy for one template.

- This folder and `.github/` exist only on the `site` branch, which
  `.github/workflows/pages.yml` deploys on every push. Vault changes come
  from `main` by merge (see the root `CLAUDE.md`).
- A new note folder must be added to `FOLDERS` in `build.mjs`.
- Property names carry their unit in parentheses, `Bag size (g)`; the page
  shows the label without it and the value with it, `150 g`.
- Before pushing, run `node build.mjs`, serve `dist` under a `/coffee_log/`
  path, and check the pages in a browser at full and phone width.
