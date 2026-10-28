// Build the Coffee Log site into .site/dist: one HTML page per note, plus a
// home page with the three most recently added bags and a table of all bags.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse } from "yaml";

const vault = path.resolve(import.meta.dirname, "..");
const out = path.resolve(import.meta.dirname, "dist");
const FOLDERS = ["Bags", "Brews", "Roasters", "Producers", "Grinders", "Brewers", "Waters"];
// The properties shown as columns when a table lists notes of a folder.
const COLUMNS = { Bags: ["roaster", "country", "process", "rating"], Brews: ["date", "bag", "rating"] };
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;
const IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const links = (v) => [...String(v).matchAll(WIKILINK)].map((m) => m[1]);
const title = (note) => note.props.name ?? note.name;

// Read every note: its properties, its body, and the path of its page.
const notes = new Map();
for (const folder of FOLDERS) {
  const dir = path.join(vault, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const [, yaml = "", body = text] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
    const name = file.slice(0, -3);
    notes.set(name, { name, folder, props: parse(yaml) ?? {}, body, page: `${folder}/${name}.html` });
  }
}

// The URL of `target` relative to the page at `from`.
const rel = (from, target) =>
  path.posix.relative(path.posix.dirname(from), target).split("/").map(encodeURIComponent).join("/");
// The URL of a note's page, or of a file in Attachments.
const href = (from, name) => rel(from, notes.get(name)?.page ?? `Attachments/${name}`);
const noteLink = (from, note) => `<a href="${href(from, note.name)}">${esc(title(note))}</a>`;

// For each note, the notes whose properties link to it, and through which key.
const incoming = new Map();
for (const note of notes.values())
  for (const [key, v] of Object.entries(note.props))
    for (const target of [v].flat().flatMap(links)) {
      if (!incoming.has(target)) incoming.set(target, []);
      incoming.get(target).push({ note, key });
    }

// Escape the text around wikilinks, not the link targets: escaping first
// would turn [[S&W Craft Roasting]] into a name no note has.
function value(from, v) {
  if (Array.isArray(v)) return v.map((x) => value(from, x)).join(", ");
  const s = String(v);
  if (/^https?:\/\/\S+$/.test(s)) return `<a href="${esc(s)}">${esc(s)}</a>`;
  let html = "";
  let last = 0;
  for (const m of s.matchAll(WIKILINK)) {
    html += esc(s.slice(last, m.index)) + `<a href="${href(from, m[1])}">${esc(m[2] ?? m[1])}</a>`;
    last = m.index + m[0].length;
  }
  return html + esc(s.slice(last));
}

// Render the body without the leading H1 (the page prints the name), the
// embed of the photo the page already shows, comments, and empty sections.
function body(from, md, photo) {
  md = md
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, n) =>
      n === photo ? "" : IMAGE.test(n) ? `![](${href(from, n)})` : `[${n}](${href(from, n)})`)
    .replace(WIKILINK, (_, n, alias) => `[${alias ?? n}](${href(from, n)})`);
  const tokens = marked.lexer(md);
  const blocks = tokens.filter((t) => t.type !== "space");
  if (blocks[0]?.type === "heading" && blocks[0].depth === 1) blocks.shift();
  // Walk backwards, so a section emptied by dropping its subsection goes too.
  const kept = [];
  for (const t of blocks.reverse()) {
    const next = kept[0];
    if (t.type === "heading" && (!next || (next.type === "heading" && next.depth <= t.depth))) continue;
    kept.unshift(t);
  }
  kept.links = tokens.links;
  return marked.parser(kept);
}

const table = (head, rows, cls = "") =>
  `<div class="table"><table${cls && ` class="${cls}"`}>` +
  (head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : "") +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

// A table of notes: the name links to the note, `columns` are properties.
// A column that no note fills is left out.
function noteTable(from, list, columns) {
  columns = columns.filter((k) => list.some((n) => !isEmpty(n.props[k])));
  const head = ["Name", ...columns.map((k) => esc(k[0].toUpperCase() + k.slice(1).replaceAll("_", " ")))];
  return table(head, list.map((n) => [noteLink(from, n), ...columns.map((k) => value(from, n.props[k] ?? ""))]));
}

const layout = (from, pageTitle, main) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(pageTitle)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${rel(from, "style.css")}">
</head>
<body>
<header><a href="${rel(from, "index.html")}">Coffee Log</a></header>
<main>
${main}
</main>
</body>
</html>
`;

function notePage(note) {
  const { page, props } = note;
  const photo = links(props.photo ?? "")[0];
  const rows = Object.entries(props)
    .filter(([k, v]) => k !== "photo" && !isEmpty(v))
    .map(([k, v]) => [esc(k.replaceAll("_", " ")), value(page, v)]);
  let html = `<h1>${esc(note.name)}</h1>`;
  if (photo) html += `<img class="photo" src="${href(page, photo)}" alt="">`;
  if (rows.length) html += table(null, rows, "props");
  html += `<div class="prose">${body(page, note.body, photo)}</div>`;
  const byFolder = Object.groupBy(incoming.get(note.name) ?? [], ({ note: n }) => n.folder);
  for (const [folder, list] of Object.entries(byFolder)) {
    // The key that links here would repeat this page's name in every row.
    const keys = new Set(list.map(({ key }) => key));
    const columns = (COLUMNS[folder] ?? []).filter((k) => !keys.has(k));
    html += `<h2>${esc(folder)}</h2>${noteTable(page, list.map(({ note: n }) => n), columns)}`;
  }
  return layout(page, note.name, html);
}

// When each note file was first committed, keyed by its path in the vault.
// A rename keeps the original date, because the roast date gets added to a
// bag's file name later.
function addedDates() {
  let log = "";
  try {
    log = execFileSync("git", ["-c", "core.quotePath=false", "log", "--reverse", "--format=%x00%ct",
      "--name-status", "--diff-filter=AR"], { cwd: vault, encoding: "utf8" });
  } catch {} // Not a git checkout: every bag counts as new.
  const dates = new Map();
  for (const commit of log.split("\0").slice(1)) {
    const [date, ...changes] = commit.split("\n").filter(Boolean);
    for (const [status, from, to] of changes.map((c) => c.split("\t")))
      dates.set(status === "A" ? from : to, dates.get(from) ?? Number(date));
  }
  return dates;
}

function homePage() {
  const dates = addedDates();
  const bags = [...notes.values()].filter((n) => n.folder === "Bags")
    .map((n) => ({ n, added: dates.get(`Bags/${n.name}.md`) ?? Infinity, roast: String(n.props.roast_date ?? "") }))
    .sort((a, b) => b.added - a.added || b.roast.localeCompare(a.roast))
    .map(({ n }) => n);
  const cards = bags.slice(0, 3).map((n) => {
    const photo = links(n.props.photo ?? "")[0];
    return `<a class="card" href="${href("index.html", n.name)}">` +
      (photo ? `<img src="${href("index.html", photo)}" alt="">` : "") +
      `<div class="card-body"><div class="card-title">${esc(title(n))}</div>` +
      `<div class="card-description">${esc(links(n.props.roaster ?? "")[0] ?? "")}</div></div></a>`;
  });
  // Without the full table, a bag that is not among the last three and
  // shares no roaster with them has no link to it.
  return layout("index.html", "Coffee Log",
    `<h1>Last bags</h1><div class="cards">${cards.join("")}</div>` +
    `<h2>All bags</h2>${noteTable("index.html", bags, COLUMNS.Bags)}`);
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
for (const note of notes.values()) {
  fs.mkdirSync(path.join(out, note.folder), { recursive: true });
  fs.writeFileSync(path.join(out, note.page), notePage(note));
}
fs.writeFileSync(path.join(out, "index.html"), homePage());
fs.cpSync(path.join(vault, "Attachments"), path.join(out, "Attachments"),
  { recursive: true, filter: (s) => !path.basename(s).startsWith(".") });
fs.copyFileSync(path.join(import.meta.dirname, "style.css"), path.join(out, "style.css"));
checkLinks();
console.log(`Wrote ${notes.size} notes and the home page to ${out}`);
