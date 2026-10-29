// Build the Coffee Log site into .site/dist: one HTML page per note, plus a
// home page with the last three brews and bags and a table of all bags.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse } from "yaml";

const vault = path.resolve(import.meta.dirname, "..");
const out = path.resolve(import.meta.dirname, "dist");
const FOLDERS = ["Bags", "Brews", "Roasters", "Producers", "Varieties", "Flavors", "Grinders", "Brewers", "Waters"];
// The properties shown as columns when a table lists notes of a folder.
const COLUMNS = { Bags: ["Roaster", "Country", "Process", "Rating"], Brews: ["Date", "Bag", "Rating"],
  Varieties: ["Genetic group"] };
// The property a page shows under its title instead of in its list.
const BYLINE = { Bags: "Roaster" };
const LABELS = { aliases: "Also known as" };
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const links = (v) => [...String(v).matchAll(WIKILINK)].map((m) => m[1]);

// Typesetting for display only; the notes keep the text as written. A hyphen
// between two numbers becomes an en dash (2360–2480), but a chained grind
// setting such as 1-2-1 and a model such as V60-01 keep theirs.
const typo = (s) => String(s)
  .replace(/(?<![\w.-])(\d+(?:[.,]\d+)?) ?- ?(\d+(?:[.,]\d+)?)(?![\w-])/g, "$1–$2")
  .replace(/([\w.,!?%])'/g, "$1’").replace(/'/g, "‘")
  .replace(/(^|[\s(\[])"/g, "$1“").replace(/"/g, "”");
const text = (s) => esc(typo(s));
const typoToken = (t) => { if (t.type === "text" && !t.tokens) t.text = typo(t.text); };
marked.use({ walkTokens: typoToken });

// Read every note: its properties, its body, and the path of its page.
// The failsafe schema keeps every value as the text written: 21.50 stays
// 21.50, and lot 0012 stays 0012.
const all = [];
for (const folder of FOLDERS) {
  const dir = path.join(vault, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const md = fs.readFileSync(path.join(dir, file), "utf8");
    const [, yaml = "", body = md] = md.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
    const name = file.slice(0, -3);
    all.push({ name, folder, props: parse(yaml, { schema: "failsafe" }) ?? {}, body, page: `${folder}/${name}.html` });
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
const noteLink = (from, note) => `<a href="${rel(from, note.page)}">${text(title(note))}</a>`;
const photoOf = (from, note) => {
  const photo = links(note.props.Photo ?? "")[0];
  return { photo, src: photo && href(from, photo) };
};

// For each note, the notes whose properties link to it, and through which key.
const incoming = new Map();
for (const note of all)
  for (const [key, v] of Object.entries(note.props))
    for (const name of [v].flat().flatMap(links)) {
      const target = notes.get(name)?.name ?? name;
      if (!incoming.has(target)) incoming.set(target, []);
      incoming.get(target).push({ note, key });
    }

// A key such as `Bag size (g)` reads as the label "Bag size" and the unit "g".
const split = (key) => {
  const [, label = key, unit] = key.match(/^(.*?)\s*\(([^)]+)\)$/) ?? [];
  return { label: LABELS[label] ?? label, unit };
};
// A brew is named by its date; its title spells the date out.
const title = (note) => note.props.Name || (DATE.test(note.name) ? longDate(note.name) : note.name);
function longDate(s) {
  return new Date(`${s}T00:00:00Z`)
    .toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

// Escape the text around wikilinks, not the link targets: escaping first
// would turn [[S&W Craft Roasting]] into a name no note has.
function value(from, v, unit) {
  if (Array.isArray(v)) return v.map((x) => value(from, x)).join(", ");
  const s = String(v);
  if (/^https?:\/\/\S+$/.test(s)) return `<a href="${esc(s)}">${esc(new URL(s).hostname.replace(/^www\./, ""))}</a>`;
  if (DATE.test(s)) return esc(longDate(s));
  let html = "";
  let last = 0;
  for (const m of s.matchAll(WIKILINK)) {
    html += text(s.slice(last, m.index)) + link(from, m[1], m[2] ?? m[1]);
    last = m.index + m[0].length;
  }
  html += text(s.slice(last));
  if (!unit) return html;
  return unit === "$" ? `$${html}` : `${html} ${esc(unit)}`;
}

// A definition list of label and value pairs.
const dl = (rows) =>
  `<dl class="props">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;

// Render the body without the leading H1 (the page prints the name), the
// embed of the photo the page already shows, comments, and empty sections.
// Details holds `Label: value` lines; they become the same list as the
// properties instead of running together into one paragraph.
function body(from, md, photo) {
  md = md
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, n) => {
      const url = n === photo ? "" : href(from, n);
      return !url ? "" : IMAGE.test(n) ? `![](${url})` : `[${n}](${url})`;
    })
    .replace(WIKILINK, (_, n, alias) => {
      const url = href(from, n);
      return url ? `[${alias ?? n}](${url})` : alias ?? n;
    });
  const tokens = marked.lexer(md);
  marked.walkTokens(tokens, typoToken);
  const blocks = tokens.filter((t) => t.type !== "space");
  if (blocks[0]?.type === "heading" && blocks[0].depth === 1) blocks.shift();
  // Walk backwards, so a section emptied by dropping its subsection goes too.
  const kept = [];
  for (const t of blocks.reverse()) {
    const next = kept[0];
    if (t.type === "heading" && (!next || (next.type === "heading" && next.depth <= t.depth))) continue;
    kept.unshift(t);
  }
  let section = "";
  const html = kept.map((t) => {
    if (t.type === "heading") section = t.text;
    const lines = t.type === "paragraph" ? t.text.split("\n") : [];
    if (section !== "Details" || !lines.length || !lines.every((l) => /^[^:]+:\s/.test(l))) return marked.parser([t]);
    return dl(lines.map((l) => {
      const at = l.indexOf(": ");
      return [text(l.slice(0, at)), marked.parseInline(l.slice(at + 2))];
    }));
  });
  return html.join("");
}

const table = (head, rows) =>
  `<div class="table"><table>` +
  `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// A table of notes: the name links to the note, `columns` are properties.
// A column that no note fills is left out.
function noteTable(from, list, columns) {
  columns = columns.filter((k) => list.some((n) => !isEmpty(n.props[k])));
  const head = ["Name", ...columns.map((k) => esc(split(k).label))];
  return table(head, list.map((n) =>
    [noteLink(from, n), ...columns.map((k) => isEmpty(n.props[k]) ? "" : value(from, n.props[k], split(k).unit))]));
}

const layout = (from, pageTitle, main) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${text(pageTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${rel(from, "style.css")}">
</head>
<body>
${from === "index.html" ? "" : `<header><a href="${rel(from, "index.html")}">Coffee Log</a></header>\n`}<main>
${main}
</main>
</body>
</html>
`;

function notePage(note) {
  const { page, props, folder } = note;
  const { photo, src } = photoOf(page, note);
  const byline = BYLINE[folder];
  const rows = Object.entries(props)
    .filter(([k, v]) => !["Name", "Photo", byline].includes(k) && !isEmpty(v))
    .map(([k, v]) => [esc(split(k).label), value(page, v, split(k).unit)]);
  let html = `<h1>${text(title(note))}</h1>`;
  if (byline && !isEmpty(props[byline])) html += `<p class="byline">${value(page, props[byline])}</p>`;
  if (src) html += `<img class="photo" src="${src}" alt="">`;
  if (rows.length) html += dl(rows);
  html += `<div class="prose">${body(page, note.body, photo)}</div>`;
  const linked = notes.get(note.name) === note ? incoming.get(note.name) ?? [] : [];
  const byFolder = Object.groupBy(linked, ({ note: n }) => n.folder);
  for (const [group, list] of Object.entries(byFolder)) {
    // The key that links here would repeat this page's name in every row.
    const keys = new Set(list.map(({ key }) => key));
    const columns = (COLUMNS[group] ?? []).filter((k) => !keys.has(k));
    html += `<h2>${esc(group)}</h2>${noteTable(page, list.map(({ note: n }) => n), columns)}`;
  }
  return layout(page, title(note), html);
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

// A folder's notes, newest first: by `key` (a date), then by date added.
function newest(folder, key, dates) {
  return all.filter((n) => n.folder === folder)
    .map((n) => ({ n, added: dates.get(`${folder}/${n.name}.md`) ?? Infinity, date: String(n.props[key] ?? "") }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.added - a.added)
    .map(({ n }) => n);
}

const card = (note, photoNote, cardTitle, description) => {
  const { src } = photoOf("index.html", photoNote);
  return `<a class="card" href="${rel("index.html", note.page)}">` +
    (src ? `<img src="${src}" alt="">` : "") +
    `<div class="card-body"><div class="card-title">${text(cardTitle)}</div>` +
    `<div class="card-description">${description}</div></div></a>`;
};

function homePage() {
  const dates = addedDates();
  const brews = newest("Brews", "Date", dates).slice(0, 3).map((n) => {
    const bag = notes.get(links(n.props.Bag ?? "")[0]);
    const brewer = links(n.props.Brewer ?? "")[0];
    const when = DATE.test(n.props.Date ?? "") ? longDate(n.props.Date) : n.name;
    return card(n, bag ?? n, bag ? title(bag) : n.name, text([when, brewer].filter(Boolean).join(", ")));
  });
  // Bags are ordered by date added only: most have no roast date.
  const bags = newest("Bags", "", dates);
  const bagCards = bags.slice(0, 3).map((n) => card(n, n, title(n), text(links(n.props.Roaster ?? "")[0] ?? "")));
  let html = `<h1>Coffee Log</h1>`;
  if (brews.length) html += `<h2>Last brews</h2><div class="cards">${brews.join("")}</div>`;
  // Without the full table, a bag that is not among the last three and
  // shares no roaster with them has no link to it.
  html += `<h2>Last bags</h2><div class="cards">${bagCards.join("")}</div>` +
    `<h2>All bags</h2>${noteTable("index.html", bags, COLUMNS.Bags)}`;
  return layout("index.html", "Coffee Log", html);
}

// Fail the build when a page links to a file that the build did not write.
function checkLinks() {
  const missing = [];
  for (const file of fs.readdirSync(out, { recursive: true }).filter((f) => f.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(out, file), "utf8");
    for (const [, ref] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|#|mailto:)/.test(ref)) continue;
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
fs.writeFileSync(path.join(out, "index.html"), homePage());
fs.cpSync(path.join(vault, "Attachments"), path.join(out, "Attachments"),
  { recursive: true, filter: (s) => !path.basename(s).startsWith(".") });
fs.copyFileSync(path.join(import.meta.dirname, "style.css"), path.join(out, "style.css"));
checkLinks();
console.log(`Wrote ${all.length} notes and the home page to ${out}`);
