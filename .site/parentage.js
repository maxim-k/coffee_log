// An arc diagram of parentage in each figure[data-parentage]: one row per
// variety, each genetic group one band, and an arc from a parent to its
// offspring with the arrow at the offspring. Hovering a name keeps only its
// arcs and relatives; on a touch screen the first tap does that and the
// second opens the note. The figure redraws to the width of the page.
for (const figure of document.querySelectorAll("figure[data-parentage]")) {
  const data = JSON.parse(figure.dataset.parentage);
  // Bands go in this order, most-linked groups adjacent; a group not listed
  // here goes after them. Colour follows the group's name.
  const ORDER = ["Bourbon-Typica group", "Introgressed", "F1 hybrid", "Ethiopian landrace", "Ungrouped", "Robusta"];
  const COLOR = { "Bourbon-Typica group": "#2a78d6", Introgressed: "#eb6834", "F1 hybrid": "#1baf7a",
    "Ethiopian landrace": "#eda100", Ungrouped: "#e87ba4", Robusta: "#008300" };
  const groups = [...ORDER, ...new Set(data.map((d) => d.group).filter((g) => !ORDER.includes(g)).sort())];
  const color = (g) => COLOR[g] ?? "#999";

  const byName = new Map(data.map((d) => [d.name, d]));
  const group = (n) => byName.get(n).group;
  const band = (n) => groups.indexOf(group(n));
  const edges = data.flatMap((d) => d.parents.map((p) => ({ p, c: d.name })));
  const childrenOf = d3.rollup(edges, (es) => es.map((e) => e.c), (e) => e.p);
  const parents = (n) => byName.get(n).parents;
  const children = (n) => childrenOf.get(n) ?? [];
  const nbrs = (n) => [...parents(n), ...children(n)];
  const same = (a, b) => group(a) === group(b);
  const kin = (n) => children(n).filter((c) => same(n, c));
  const kinParents = (n) => parents(n).filter((p) => same(n, p));

  // Sorted by family, in rhythm. A family is a root (no parent in its band)
  // and, depth first, its in-band descendants; a child with two in-band
  // parents joins the one walked last. Inside a family: the parent, then its
  // children's families, smallest first and, at equal size, the one whose
  // relatives in other bands lean furthest up first. A band then holds blocks
  // of like shape: singles whose relatives lean to a band above, pairs, fans
  // (fed from above first, feeding below last), singles whose relatives lean
  // below. A lean is the mean band offset of a family's relatives elsewhere;
  // singles then sort by their relatives' rows, one run at a time.
  function sorted() {
    const lean = (f) => d3.mean(f.flatMap((n) => nbrs(n).filter((m) => !same(n, m)).map((m) => band(m) - band(n)))) ?? 0;
    const seen = new Set();
    const walk = (n) => {
      seen.add(n);
      const kids = kin(n).filter((c) => !seen.has(c) && kinParents(c).every((p) => seen.has(p)));
      return [n, ...d3.sort(kids.map(walk), (f) => f.length, lean, (f) => f[0]).flat()];
    };
    const blocks = [], runs = [];
    for (const g of groups) {
      const ns = data.filter((d) => d.group === g).map((d) => d.name);
      const families = ns.filter((n) => !kinParents(n).length).map(walk);
      const singles = families.filter((f) => f.length === 1).flat();
      const up = singles.filter((n) => lean([n]) < 0), down = singles.filter((n) => lean([n]) >= 0);
      const pairs = d3.sort(families.filter((f) => f.length === 2), (f) => f[0]).flat();
      const fans = d3.sort(families.filter((f) => f.length > 2), lean, (f) => -f.length).flat();
      blocks.push(up, pairs, fans, down);
      runs.push(up, down);
    }
    for (const run of runs) {
      const pos = new Map(blocks.flat().map((n, i) => [n, i]));
      const key = (n) => d3.mean(nbrs(n).filter((m) => !same(n, m)), (m) => pos.get(m)) ?? pos.get(n);
      run.sort((a, b) => key(a) - key(b));
    }
    return blocks.flat();
  }
  const nodes = sorted();
  const touch = matchMedia("(hover: none)").matches;

  // One row per variety, a gap at each change of band, arcs on the right. The
  // name column and the arcs' reach shrink with the page; the type goes a
  // size down on a phone so the longest name still fits.
  let drawnAt = 0;
  function draw() {
    const W = Math.max(320, figure.parentElement.clientWidth);
    drawnAt = W;
    const narrow = W < 700;
    const step = narrow ? 16 : 18, gap = 40, x0 = Math.min(260, Math.round(W * 0.46)), maxRx = Math.min(330, W - x0 - 24);
    const Y = new Map();
    let yy = 40;
    nodes.forEach((n, i) => { if (i && !same(n, nodes[i - 1])) yy += gap; Y.set(n, yy); yy += step; });
    const y = (n) => Y.get(n), width = x0 + maxRx + 24, height = yy + 8;

    const svg = d3.create("svg").attr("viewBox", [0, 0, width, height]).attr("width", width).attr("height", height)
      .style("font-size", narrow ? "11px" : null);
    svg.append("title").text(figure.dataset.title);
    // One arrowhead per group colour: Safari doesn't support context-stroke.
    svg.append("defs").selectAll("marker").data(groups).join("marker").attr("id", (g, i) => `arrow${i}`)
      .attr("viewBox", "-4 -4 8 8").attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M-4,-3.5L2,0L-4,3.5Z").attr("fill", (g) => color(g));
    const bands = svg.append("g").selectAll("g").data(d3.groups(nodes, group)).join("g");
    bands.append("rect").attr("x", 0).attr("width", 3).attr("y", ([, ns]) => y(ns[0]) - 9)
      .attr("height", ([, ns]) => y(ns.at(-1)) - y(ns[0]) + 18).attr("fill", ([g]) => color(g));
    bands.append("text").attr("x", 10).attr("y", ([, ns]) => y(ns[0]) - 17).attr("letter-spacing", "0.04em")
      .text(([g]) => g.toUpperCase());
    const edge = svg.append("g").attr("fill", "none").attr("stroke-width", 1.3).attr("stroke-opacity", 0.55)
      .selectAll("path").data(edges).join("path")
      .attr("stroke", (d) => color(group(d.p))).attr("marker-end", (d) => `url(#arrow${band(d.p)})`)
      .attr("d", ({ p, c }) => {
        const a = y(p), b = y(c), ry = Math.abs(b - a) / 2, rx = Math.min(ry, maxRx);
        return `M${x0 + 4},${a}A${rx},${ry} 0 0,${b > a ? 1 : 0} ${x0 + 4},${b}`;
      });
    edge.append("title").text(({ p, c }) => `${p} is a parent of ${c}`);
    const node = svg.append("g").selectAll("a").data(nodes).join("a")
      .attr("href", (n) => byName.get(n).href).attr("transform", (n) => `translate(${x0},${y(n)})`)
      .style("color", "var(--foreground)").style("text-decoration", "none");
    node.append("circle").attr("r", 2.4).attr("fill", (n) => color(group(n)));
    node.append("text").attr("x", -8).attr("dy", "0.35em").attr("text-anchor", "end").attr("fill", "currentColor").text((n) => n);
    node.append("title").text((n) =>
      `${n}, ${group(n)}\nParents: ${parents(n).join(", ") || "none"}\nOffspring: ${children(n).join(", ") || "none"}`);

    // Keep one variety's arcs and relatives, fading the rest, the variety
    // itself in the link colour. On a touch
    // screen a tap on a name does this (mouseenter fires before click), and
    // only a second tap on the same name follows the link.
    let tapped = null;
    const keep = (n) => {
      if (!n) tapped = null;
      const set = n && new Set([n, ...nbrs(n)]);
      edge.attr("opacity", n ? ({ p, c }) => (p === n || c === n ? 1 : 0.06) : null);
      node.select("text").attr("opacity", n ? (o) => (set.has(o) ? 1 : 0.35) : null)
        .attr("font-weight", n ? (o) => (set.has(o) ? 600 : null) : null)
        .attr("fill", (o) => (o === n ? "var(--link)" : "currentColor"));
    };
    node.on("mouseenter", (e, n) => keep(n)).on("mouseleave", () => keep(null))
      .on("focusin", (e, n) => keep(n)).on("focusout", () => keep(null))
      .on("click", (e, n) => { if (touch && tapped !== n) { e.preventDefault(); keep(n); tapped = n; } });
    svg.on("click", (e) => { if (e.target === svg.node()) keep(null); });

    figure.replaceChildren(svg.node());
  }
  draw();
  addEventListener("resize", () => { if (figure.parentElement.clientWidth !== drawnAt) draw(); });
}
