// design-system page.js, cut to path breaking and data tables: this site has no fingerprint and no
// table of contents. When the skill's page.js changes, copy it again and make the same cut.

// Code wraps at spaces like text; a path may also break after each slash, and a
// comma-separated list after each comma.
function breakPaths() {
  for (const code of document.querySelectorAll("code")) {
    if (code.children.length || code.closest("pre")) continue;
    if (!/[\/,]/.test(code.textContent)) continue;
    const parts = code.textContent.split(/(?<=[\/,])/);
    code.replaceChildren(...parts.flatMap((part, i) => (i ? [document.createElement("wbr"), part] : [part])));
  }
}

// Data tables: a table longer than one screen or wider than its column gets search, column
// visibility, sorting and pagination. Without this script the full table shows as it is.
const PAGE_ROWS = 25;
const PLAIN_MAX_ROWS = 15;

function makeDataTables() {
  for (const table of document.querySelectorAll("main table")) {
    const head = table.tHead && table.tHead.rows[0];
    const body = table.tBodies[0];
    if (!head || !body) continue;
    const tooWide = table.offsetWidth > maxWidthPx(table) + 1;
    const dataRows = [...body.rows].filter((r) => !r.classList.contains("group"));
    if (dataRows.length <= PLAIN_MAX_ROWS && !tooWide) continue;
    dataTable(table, head, body);
  }
}

// The width a table may take: its max-width in px, or a percentage of its container.
function maxWidthPx(el) {
  const value = getComputedStyle(el).maxWidth;
  if (value.endsWith("%")) return (parseFloat(value) / 100) * el.parentElement.clientWidth;
  return parseFloat(value);
}

function dataTable(table, head, body) {
  const original = [...body.rows];
  const text = new Map(original.map((r) => [r, r.textContent.toLowerCase()]));
  const columns = [...head.cells];
  const state = { query: "", sortCol: -1, sortDir: 0, page: 0 };

  const wrap = document.createElement("div");
  wrap.className = "data-table";
  wrap.innerHTML =
    `<div class="data-table-tools"><input type="search" placeholder="Search" aria-label="Search table">` +
    `<button type="button" aria-expanded="false">Columns</button><div class="data-table-menu" hidden></div></div>` +
    `<div class="data-table-scroll"></div>` +
    `<div class="data-table-pager"><span></span><button type="button">Previous</button><button type="button">Next</button></div>`;
  table.replaceWith(wrap);
  wrap.querySelector(".data-table-scroll").append(table);
  const [search] = wrap.getElementsByTagName("input");
  const [columnsButton, previous, next] = wrap.querySelectorAll("button");
  const menu = wrap.querySelector(".data-table-menu");
  const status = wrap.querySelector(".data-table-pager span");

  // Long text gets a readable width; the table scrolls sideways instead of stacking single words.
  for (const cell of table.querySelectorAll("td")) if (cell.textContent.length > 60) cell.style.minWidth = "24rem";

  // Column visibility: everything starts visible.
  columns.forEach((th, i) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = true;
    label.append(checkbox, ` ${th.textContent.trim() || `Column ${i + 1}`}`);
    checkbox.addEventListener("change", (e) => {
      for (const row of table.rows) {
        if (row.cells.length === columns.length) row.cells[i].hidden = !e.target.checked;
      }
    });
    menu.append(label);
  });
  columnsButton.addEventListener("click", () => {
    menu.hidden = !menu.hidden;
    columnsButton.setAttribute("aria-expanded", String(!menu.hidden));
  });
  document.addEventListener("click", (e) => {
    if (!wrap.querySelector(".data-table-tools").contains(e.target)) menu.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") menu.hidden = true; });

  // Sorting: ascending, descending, then back to the original order.
  columns.forEach((th, i) => {
    const button = document.createElement("button");
    button.type = "button";
    button.append(...th.childNodes);
    th.append(button);
    button.addEventListener("click", () => {
      state.sortDir = state.sortCol === i ? (state.sortDir + 1) % 3 : 1;
      state.sortCol = state.sortDir ? i : -1;
      columns.forEach((c) => c.removeAttribute("aria-sort"));
      if (state.sortDir) th.setAttribute("aria-sort", state.sortDir === 1 ? "ascending" : "descending");
      state.page = 0;
      render();
    });
  });

  search.addEventListener("input", () => { state.query = search.value.trim().toLowerCase(); state.page = 0; render(); });
  previous.addEventListener("click", () => { state.page--; render(); });
  next.addEventListener("click", () => { state.page++; render(); });

  function render() {
    let rows = original.filter((r) => !r.classList.contains("group"));
    if (state.query) rows = rows.filter((r) => text.get(r).includes(state.query));
    if (state.sortDir) {
      const sign = state.sortDir === 1 ? 1 : -1;
      rows = rows.map((r) => [sortKey(r.cells[state.sortCol]), r])
        .sort((a, b) => sign * compareKeys(a[0], b[0]))
        .map(([, r]) => r);
    }
    const pages = Math.max(1, Math.ceil(rows.length / PAGE_ROWS));
    state.page = Math.min(Math.max(state.page, 0), pages - 1);
    const start = state.page * PAGE_ROWS;
    const shown = new Set(rows.slice(start, start + PAGE_ROWS));
    // Group rows keep their place only in the original order; sorting or searching hides them.
    const ordered = state.sortDir || state.query ? rows : original;
    for (const r of original) r.hidden = true;
    body.append(...ordered);
    let group = null;
    for (const r of ordered) {
      if (r.classList.contains("group")) { group = r; continue; }
      if (shown.has(r)) { r.hidden = false; if (group) group.hidden = false; }
    }
    status.textContent = rows.length
      ? `Rows ${start + 1} to ${start + shown.size} of ${rows.length}`
      : "No rows match";
    previous.disabled = state.page === 0;
    next.disabled = state.page >= pages - 1;
  }
  render();
}

// A cell sorts by its number when it holds only a number, and by its text otherwise.
function sortKey(cell) {
  const text = cell ? cell.textContent.trim() : "";
  const num = /^[↑↓\-−+]?[\d,.]+%?$/.test(text) ? parseFloat(text.replace(/[,%↑↓]/g, "").replace("−", "-")) : NaN;
  return { text, num };
}

function compareKeys(x, y) {
  if (!x.text || !y.text) return x.text ? -1 : y.text ? 1 : 0;  // empty cells last
  if (!isNaN(x.num) && !isNaN(y.num)) return x.num - y.num;
  return x.text.localeCompare(y.text, undefined, { numeric: true });
}

breakPaths();
makeDataTables();
