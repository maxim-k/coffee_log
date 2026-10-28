// Build the Coffee Log site: one HTML page per note, plus a home page with
// the three most recently added bags. Usage: node build.mjs [VAULT] [OUT]
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse } from "yaml";

const vault = path.resolve(process.argv[2] ?? "..");
const out = path.resolve(process.argv[3] ?? "dist");
const FOLDERS = ["Bags", "Brews", "Roasters", "Producers", "Grinders", "Brewers", "Waters"];
const WIKILINK = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const url = (p) => p.split("/").map(encodeURIComponent).join("/");

// Read every note: its properties, its body, and the path of its page.
const notes = new Map();
for (const folder of FOLDERS) {
  const dir = path.join(vault, folder);
  if (!fs.existsSync(dir)) continue;
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    const [, yaml = "", body = text] = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/) ?? [];
    const name = file.slice(0, -3);
    notes.set(name, { name, folder, file, props: parse(yaml) ?? {}, body, page: `${folder}/${name}.html` });
  }
}

// From the page at `from`, the relative URL of a note or an attachment.
const href = (from, name) => {
  const target = notes.get(name)?.page ?? `Attachments/${name}`;
  return url(path.posix.relative(path.posix.dirname(from), target));
};
const isEmpty = (v) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
const links = (v) => [...String(v).matchAll(WIKILINK)].map((m) => m[1]);

// Incoming links from properties: Regalia Coffee gets the bags that name it.
const incoming = new Map();
for (const note of notes.values())
  for (const v of Object.values(note.props).flat())
    for (const target of links(v)) {
      if (!incoming.has(target)) incoming.set(target, []);
      incoming.get(target).push(note);
    }

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

// Drop the H1 (the page prints the name), embeds, comments, and empty sections.
function body(from, md) {
  md = md
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/^# .*\n/m, "")
    .replace(/!\[\[[^\]]+\]\]\n?/g, "")
    .replace(WIKILINK, (_, n, alias) => `[${alias ?? n}](${href(from, n)})`);
  const lines = md.split("\n");
  const kept = lines.filter((line, i) => {
    const level = line.match(/^(#+) /)?.[1].length;
    if (!level) return true;
    const next = lines.slice(i + 1).find((l) => l.trim());
    const nextLevel = next?.match(/^(#+) /)?.[1].length;
    return next !== undefined && !(nextLevel && nextLevel <= level);
  });
  return marked.parse(kept.join("\n"));
}

const table = (head, rows) =>
  `<div class="table"><table>${head ? `<thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>` : ""}` +
  `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;

const layout = (from, title, main) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="${url(path.posix.relative(path.posix.dirname(from), "style.css"))}">
</head>
<body>
<header><a href="${url(path.posix.relative(path.posix.dirname(from), "index.html"))}">Coffee Log</a></header>
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
  if (rows.length) html += table(null, rows);
  html += `<div class="prose">${body(page, note.body)}</div>`;
  const byFolder = Object.groupBy(incoming.get(note.name) ?? [], (n) => n.folder);
  for (const [folder, list] of Object.entries(byFolder)) {
    html += `<h2>${esc(folder)}</h2>`;
    html += folder === "Bags"
      ? bagTable(page, list, ["country", "process", "rating"])
      : table(null, list.map((n) => [`<a href="${href(page, n.name)}">${esc(n.props.name ?? n.name)}</a>`]));
  }
  return layout(page, note.name, html);
}

// A table of bags: the coffee name links to the bag, `columns` are properties.
// A column that no bag fills is left out.
function bagTable(from, bags, columns) {
  columns = columns.filter((k) => bags.some((n) => !isEmpty(n.props[k])));
  const head = ["Coffee", ...columns.map((k) => k[0].toUpperCase() + k.slice(1))];
  return table(head, bags.map((n) => [
    `<a href="${href(from, n.name)}">${esc(n.props.name ?? n.name)}</a>`,
    ...columns.map((k) => value(from, n.props[k] ?? "")),
  ]));
}

// When a bag note was first committed; a bag not yet in git counts as newest.
function added(note) {
  const file = path.join(note.folder, note.file);
  try {
    const log = execFileSync("git", ["log", "--follow", "--diff-filter=A", "--format=%cI", "--", file],
      { cwd: vault, encoding: "utf8" }).trim().split("\n").at(-1);
    return log || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function homePage() {
  const bags = [...notes.values()].filter((n) => n.folder === "Bags")
    .map((n) => ({ n, date: added(n) }))
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.n.props.roast_date ?? "").localeCompare(String(a.n.props.roast_date ?? "")))
    .map(({ n }) => n);
  const cards = bags.slice(0, 3).map((n) => {
    const photo = links(n.props.photo ?? "")[0];
    const roaster = links(n.props.roaster ?? "")[0] ?? "";
    return `<a class="card" href="${href("index.html", n.name)}">` +
      (photo ? `<img src="${href("index.html", photo)}" alt="">` : "") +
      `<div class="card-body"><div class="card-title">${esc(n.props.name ?? n.name)}</div>` +
      `<div class="card-description">${esc(roaster)}</div></div></a>`;
  });
  // Without the full table, a bag that is not among the last three and
  // shares no roaster with them has no link to it.
  return layout("index.html", "Coffee Log",
    `<h1>Last bags</h1><div class="cards">${cards.join("")}</div>` +
    `<h2>All bags</h2>${bagTable("index.html", bags, ["roaster", "country", "process", "rating"])}`);
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
fs.cpSync(path.join(vault, "Attachments"), path.join(out, "Attachments"), { recursive: true, filter: (s) => !path.basename(s).startsWith(".") });
fs.copyFileSync(new URL("style.css", import.meta.url), path.join(out, "style.css"));
checkLinks();
console.log(`Wrote ${notes.size} notes and the home page to ${out}`);
