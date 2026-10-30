// Build the Coffee Log site into .site/dist: one HTML page per note, a page
// per folder, and a home page with the last three brews and bags as cards.
// Pages follow the design-system skill: base.css and page.js go in verbatim.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

const site = import.meta.dirname;
const vault = path.resolve(site, "..");
const out = path.resolve(site, "dist");
const [BASE_CSS, PAGE_JS, CARD_CSS] = ["base.css", "page.js", "card.css"]
  .map((f) => fs.readFileSync(path.join(site, f), "utf8"));
const FOLDERS = ["Bags", "Brews", "Roasters", "Producers", "Varieties", "Flavors", "Grinders", "Brewers", "Waters"];
// The properties shown as columns when a table lists notes of a folder.
const COLUMNS = { Bags: ["Roaster", "Country", "Process", "Rating"], Brews: ["Date", "Bag", "Rating"],
  Roasters: ["City", "Country"], Producers: ["Country", "Region"], Varieties: ["Genetic group", "Parent"],
  Flavors: ["Parent"] };
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const NUMBER = /^[−-]?\d[\d,]*(\.\d+)?$/;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const links = (v) => [...String(v).matchAll(WIKILINK)].map((m) => m[1]);

// Typesetting for display only; the notes keep the text as written. A hyphen
// between two numbers becomes an en dash (2360–2480), but a chained grind
// setting such as 1-2-1 and a model such as V60-01 keep theirs. A hyphen
// before a lone number becomes a minus sign (−7).
const typo = (s) => String(s)
  .replace(/(?<![\w.-])(\d+(?:[.,]\d+)?) ?- ?(\d+(?:[.,]\d+)?)(?![\w-])/g, "$1–$2")
  .replace(/(^|[\s(])-(?=\d)/g, "$1−")
  .replace(/([\w.,!?%])'/g, "$1’").replace(/'/g, "‘")
  .replace(/(^|[\s(\[])"/g, "$1“").replace(/"/g, "”");
const text = (s) => esc(typo(s));
const typoToken = (t) => { if (t.type === "text" && !t.tokens) t.text = typo(t.text); };
// The design system keeps weight for headings, so bold and italic render as plain text.
marked.use({
  walkTokens: typoToken,
  renderer: {
    strong({ tokens }) { return this.parser.parseInline(tokens); },
    em({ tokens }) { return this.parser.parseInline(tokens); },
  },
});

// The notes' front matter is only `Key: value` lines, and `Key:` lines
// followed by `  - item` lines. Values stay the text written, without quotes:
// 21.50 stays 21.50, and lot 0012 stays 0012.
function frontMatter(yaml) {
  const props = {};
  const unquote = (s) => s.trim().replace(/^(["'])(.*)\1$/, "$2");
  let key;
  for (const line of yaml.split("\n")) {
    const item = line.match(/^\s*-\s+(.*)$/);
    const pair = line.match(/^([^\s:][^:]*):\s*(.*)$/);
    if (item && key) props[key] = [...[props[key]].flat().filter((v) => !isEmpty(v)), unquote(item[1])];
    else if (pair) props[(key = pair[1])] = unquote(pair[2]);
  }
  return props;
}

// Read every note: its properties, its body, and the path of its page.
const all = [];
for (const folder of FOLDERS) {
  const dir = path.join(vault, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const md = fs.readFileSync(path.join(dir, file), "utf8");
    const [, yaml = "", body = md] = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
    const name = file.slice(0, -3);
    all.push({ name, folder, props: frontMatter(yaml), body, page: `${folder}/${name}.html` });
  }
}
// Links name a note, not its folder. Two notes with one name both get a page,
// and a link to the name goes to the first in FOLDERS order. A link to an
// alias, such as [[Heirloom]], goes to the note that lists it, as in Obsidian.
const notes = new Map();
for (const note of all) if (!notes.has(note.name)) notes.set(note.name, note);
for (const note of all)
  for (const alias of [note.props.aliases ?? []].flat()) if (!notes.has(alias)) notes.set(alias, note);

// The URL of `target` relative to the page at `from`.
const rel = (from, target) =>
  path.posix.relative(path.posix.dirname(from), target).split("/").map(encodeURIComponent).join("/");
// The URL of a note's page or of a file in Attachments. Null when neither
// exists, such as a link to a note not written yet: it shows as plain text.
function href(from, name) {
  const target = notes.get(name)?.page ??
    (fs.existsSync(path.join(vault, "Attachments", name)) ? `Attachments/${name}` : null);
  return target && rel(from, target);
}
function link(from, name, label) {
  const url = href(from, name);
  return url ? `<a href="${url}">${text(label)}</a>` : text(label);
}
const noteLink = (from, note) => `<a href="${rel(from, note.page)}">${text(note.name)}</a>`;
const photoOf = (from, note) => {
  const photo = links(note.props.Photo ?? "")[0];
  return photo && href(from, photo);
};

const byFolder = Object.groupBy(all, (n) => n.folder);

// For each note, the notes whose properties link to it, and through which key.
const incoming = new Map();
for (const note of all)
  for (const [key, v] of Object.entries(note.props))
    for (const name of [v].flat().flatMap(links)) {
      const target = notes.get(name)?.name ?? name;
      if (!incoming.has(target)) incoming.set(target, []);
      incoming.get(target).push({ note, key });
    }

// A key such as `Bag size (g)` reads as "Bag size, g": the unit goes once in
// the label, and the value is bare.
function label(key) {
  const [, name = key, unit] = key.match(/^(.*?)\s*\(([^)]+)\)$/) ?? [];
  return (name === "aliases" ? "Also known as" : name) + (unit ? `, ${unit}` : "");
}

// Escape the text around wikilinks, not the link targets: escaping first
// would turn [[S&W Craft Roasting]] into a name no note has.
function value(from, v) {
  if (Array.isArray(v)) return v.map((x) => value(from, x)).join(", ");
  const s = String(v);
  if (/^https?:\/\/\S+$/.test(s)) return `<a href="${esc(s)}">${esc(new URL(s).hostname.replace(/^www\./, ""))}</a>`;
  let html = "";
  let last = 0;
  for (const m of s.matchAll(WIKILINK)) {
    html += text(s.slice(last, m.index)) + link(from, m[1], m[2] ?? m[1]);
    last = m.index + m[0].length;
  }
  return html + text(s.slice(last));
}

// A table of records when `head` is given; otherwise a table of fields, each
// row a field name in a th and its value. A column of numbers is right-aligned.
function table(head, rows) {
  const plain = (c) => c.replace(/<[^>]+>/g, "").trim();
  const num = (head ?? rows[0]).map((_, i) => {
    const cells = rows.map((r) => plain(r[i])).filter(Boolean);
    return cells.length > 0 && cells.every((c) => NUMBER.test(c));
  });
  const cell = (tag, c, i) => `<${tag}${num[i] ? " class=num" : ""}>${c}</${tag}>`;
  return "<table>" +
    (head ? `<thead><tr>${head.map((h, i) => cell("th", h, i)).join("")}</tr></thead>` : "") +
    `<tbody>${rows.map((r) => `<tr>${r.map((c, i) => cell(!head && i === 0 ? "th" : "td", c, i)).join("")}</tr>`).join("")}</tbody></table>`;
}

// A note's properties: up to five fields form one row, more form a table of
// fields. Empty when the note has none.
function fieldTable(from, props) {
  const fields = Object.entries(props).filter(([k, v]) => k !== "Photo" && !isEmpty(v));
  if (!fields.length) return "";
  const names = fields.map(([k]) => esc(label(k)));
  const values = fields.map(([, v]) => value(from, v));
  return fields.length <= 5 ? table(names, [values]) : table(null, names.map((n, i) => [n, values[i]]));
}

// A table of notes: the name links to the note, `columns` are properties.
// A column that no note fills is left out.
function noteTable(from, list, columns) {
  columns = columns.filter((k) => list.some((n) => !isEmpty(n.props[k])));
  return table(["Name", ...columns.map((k) => esc(label(k)))], list.map((n) =>
    [noteLink(from, n), ...columns.map((k) => isEmpty(n.props[k]) ? "" : value(from, n.props[k]))]));
}

// A page's content: HTML strings and sections, { title, items }. Empty
// sections go, and a lone section hands its items to its parent, because a
// level holds two or more sections. Each section's heading level is its depth.
const filled = (it) => (typeof it === "string" ? it !== "" : it.items.some(filled));
function render(items, depth = 2) {
  for (;;) {
    items = items.filter(filled);
    const sections = items.filter((it) => typeof it !== "string");
    if (sections.length !== 1) break;
    items = items.flatMap((it) => (it === sections[0] ? it.items : [it]));
  }
  return items.map((it) => typeof it === "string" ? it
    : `<section><h${depth}>${it.title}</h${depth}>\n${render(it.items, depth + 1)}\n</section>`)
    .join("\n");
}

// The body as content items, without its H1 (the page prints the name),
// embeds (the page shows the photo itself), and comments. Each heading opens
// a section that runs to the next heading of its level or higher.
function body(from, md) {
  md = md
    .replace(/%%[\s\S]*?%%/g, "")
    // ponytail: the only embeds are bag photos, so every embed goes; render them if notes start embedding other files.
    .replace(/!\[\[[^\]]*\]\]\n?/g, "")
    .replace(WIKILINK, (_, n, alias) => {
      const url = href(from, n);
      return url ? `[${alias ?? n}](${url})` : alias ?? n;
    });
  const tokens = marked.lexer(md);
  const top = { depth: 1, items: [] };
  const open = [top];
  for (const t of tokens) {
    if (t.type === "space" || (t.type === "heading" && t.depth === 1)) continue;
    if (t.type === "heading") {
      while (open.at(-1).depth >= t.depth) open.pop();
      const section = { title: marked.parseInline(t.text), depth: t.depth, items: [] };
      open.at(-1).items.push(section);
      open.push(section);
    } else {
      marked.walkTokens([t], typoToken);
      open.at(-1).items.push(marked.parser([t]));
    }
  }
  return top.items;
}

// The index: the home page, then each folder that has notes. `current` is
// the folder the page belongs to, or "" on the home page.
function index(from, current) {
  // "page" on the page itself, "true" on a note inside the folder.
  const item = (target, name, on) =>
    `<li><a href="${rel(from, target)}"${on ? ` aria-current="${target === from ? "page" : "true"}"` : ""}>${esc(name)}</a></li>`;
  const folders = FOLDERS.filter((f) => byFolder[f]).map((f) => item(`${f}/index.html`, f, f === current));
  return `<nav class=index><ol>${item("index.html", "Coffee Log", !current)}${folders.join("")}</ol></nav>`;
}

const layout = (from, title, main, current, css = "") => `<!doctype html>
<html lang=en>
<head>
<meta charset=utf-8>
<meta name=viewport content="width=device-width, initial-scale=1">
<title>${text(title)}</title>
<link rel=icon href="${rel(from, "favicon.gif")}">
<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&display=swap">
<style>${BASE_CSS}</style>${css && `\n<style>${css}</style>`}
</head>
<body>
${index(from, current)}
<main>
<header><h1>${text(title)}</h1></header>
${main}
</main>
<script>${PAGE_JS}</script>
</body>
</html>
`;

// A note: its photo, the body before the first heading, its properties, the
// body's sections, and the notes that link here, by folder.
function notePage(note) {
  const { page, props, folder } = note;
  const src = photoOf(page, note);
  const items = body(page, note.body);
  const first = items.findIndex((it) => typeof it !== "string");
  const intro = first < 0 ? items.splice(0) : items.splice(0, first);
  const linked = notes.get(note.name) === note ? incoming.get(note.name) ?? [] : [];
  const groups = Object.entries(Object.groupBy(linked, ({ note: n }) => n.folder)).map(([group, list]) => {
    // The key that links here would repeat this page's name in every row.
    const keys = new Set(list.map(({ key }) => key));
    const columns = (COLUMNS[group] ?? []).filter((k) => !keys.has(k));
    return { title: esc(group), items: [noteTable(page, list.map(({ note: n }) => n), columns)] };
  });
  const content = [
    src ? `<figure><img src="${src}" alt="The bag of ${text(note.name)}"></figure>` : "",
    ...intro,
    { title: "Properties", items: [fieldTable(page, props)] },
    ...items,
    ...groups,
  ];
  return layout(page, note.name, render(content), folder);
}

// When each note file was first committed, keyed by its path in the vault.
// A rename keeps the original date, because the roast date gets added to a
// bag's file name later.
function addedDates() {
  let log = "";
  try {
    log = execFileSync("git", ["-c", "core.quotePath=false", "log", "--reverse", "--format=%x00%ct",
      "--name-status", "--diff-filter=AR"], { cwd: vault, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {} // Not a git checkout: every note counts as new.
  const dates = new Map();
  for (const commit of log.split("\0").slice(1)) {
    const [date, ...changes] = commit.split("\n").filter(Boolean);
    for (const [status, from, to] of changes.map((c) => c.split("\t")))
      dates.set(status === "A" ? from : to, dates.get(from) ?? Number(date));
  }
  return dates;
}

const dates = addedDates();

// A folder's notes, newest first: by `key` (a date), then by date added.
function newest(folder, key) {
  return all.filter((n) => n.folder === folder)
    .map((n) => ({ n, added: dates.get(`${folder}/${n.name}.md`) ?? Infinity, date: String(n.props[key] ?? "") }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.added - a.added)
    .map(({ n }) => n);
}

// A card on the home page: the photo of `photoNote`, a title and a description.
const card = (note, photoNote, title, description) => {
  const src = photoOf("index.html", photoNote);
  return `<li><a href="${rel("index.html", note.page)}">` +
    (src ? `<img src="${src}" alt="The bag of ${text(photoNote.name)}">` : "") +
    `<p>${text(title)}</p><p>${description}</p></a></li>`;
};
const cards = (list) => (list.length ? `<ol class=cards>${list.join("")}</ol>` : "");

// A folder's page: every note in it, newest first for Bags and Brews and
// alphabetical for the rest.
function folderPage(folder) {
  const from = `${folder}/index.html`;
  const list = folder === "Bags" ? newest("Bags", "") : folder === "Brews" ? newest("Brews", "Date")
    : byFolder[folder].toSorted((a, b) => a.name.localeCompare(b.name));
  return layout(from, folder, noteTable(from, list, COLUMNS[folder] ?? []), folder);
}

function homePage() {
  const brews = newest("Brews", "Date").slice(0, 3).map((n) => {
    const bag = notes.get(links(n.props.Bag ?? "")[0]);
    const brewer = links(n.props.Brewer ?? "")[0];
    const when = n.props.Date || n.name;
    return card(n, bag ?? n, bag ? bag.name : n.name, text([when, brewer].filter(Boolean).join(", ")));
  });
  // Bags are ordered by date added only: most have no roast date.
  const bags = newest("Bags", "").slice(0, 3)
    .map((n) => card(n, n, n.name, text(links(n.props.Roaster ?? "")[0] ?? "")));
  const content = [{ title: "Last brews", items: [cards(brews)] }, { title: "Last bags", items: [cards(bags)] }];
  return layout("index.html", "Coffee Log", render(content), "", CARD_CSS);
}

// Fail the build when a page links to a file that the build did not write.
function checkLinks() {
  const missing = [];
  for (const file of fs.readdirSync(out, { recursive: true }).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(out, file), "utf8");
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|#|mailto:|data:)/.test(ref)) continue;
      const target = path.join(out, path.dirname(file), decodeURIComponent(ref));
      if (!fs.existsSync(target)) missing.push(`${file} -> ${ref}`);
    }
  }
  if (missing.length) throw new Error(`Pages link to files that do not exist:\n${missing.join("\n")}`);
}

fs.rmSync(out, { recursive: true, force: true });
for (const note of all) {
  fs.mkdirSync(path.join(out, note.folder), { recursive: true });
  fs.writeFileSync(path.join(out, note.page), notePage(note));
}
for (const folder of Object.keys(byFolder)) fs.writeFileSync(path.join(out, folder, "index.html"), folderPage(folder));
fs.writeFileSync(path.join(out, "index.html"), homePage());
fs.cpSync(path.join(vault, "Attachments"), path.join(out, "Attachments"),
  { recursive: true, filter: (s) => !path.basename(s).startsWith(".") });
fs.copyFileSync(path.join(site, "favicon.gif"), path.join(out, "favicon.gif"));
checkLinks();
console.log(`Wrote ${all.length} notes, ${Object.keys(byFolder).length} folder pages and the home page to ${out}`);
