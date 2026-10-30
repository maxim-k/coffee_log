// A chord diagram of parentage in each figure[data-chord], after
// https://observablehq.com/@d3/directed-chord-diagram. Each arc is a variety,
// as long as its links to parents and offspring together, and each ribbon
// runs from a parent to its offspring, the arrow at the offspring. Hovering
// an arc keeps only its ribbons, and clicking it opens its note.
for (const figure of document.querySelectorAll("figure[data-chord]")) {
  const { names, groups, hrefs, matrix } = JSON.parse(figure.dataset.chord);
  const width = 928;
  const outer = width / 2 - 130; // the rest is room for the names
  const inner = outer - 12;
  // Varieties come sorted by group, so each group's arcs form one band.
  const color = d3.scaleOrdinal([...new Set(groups)], d3.schemeTableau10);
  const chords = d3.chordDirected().padAngle(4 / inner).sortSubgroups(d3.descending)(matrix);
  const related = (i, row) => names.filter((_, j) => (row ? matrix[i][j] : matrix[j][i])).join(", ") || "none";

  const svg = d3.create("svg")
    .attr("viewBox", [-width / 2, -width / 2, width, width])
    .attr("width", width)
    .attr("height", width);
  svg.append("title").text(figure.dataset.title);

  const ribbons = svg.append("g").attr("fill-opacity", 0.6).selectAll("path").data(chords).join("path")
    .attr("d", d3.ribbonArrow().radius(inner - 1).padAngle(1 / inner))
    .attr("fill", (d) => color(groups[d.source.index]));
  ribbons.append("title").text((d) => `${names[d.source.index]} is a parent of ${names[d.target.index]}`);

  const arcs = svg.append("g").selectAll("a").data(chords.groups).join("a")
    .attr("href", (d) => hrefs[d.index])
    .style("text-decoration", "none");
  arcs.append("path")
    .attr("d", d3.arc().innerRadius(inner).outerRadius(outer))
    .attr("fill", (d) => color(groups[d.index]));
  arcs.append("text")
    .each((d) => (d.angle = (d.startAngle + d.endAngle) / 2))
    .attr("dy", "0.35em")
    .attr("transform", (d) => `rotate(${(d.angle * 180) / Math.PI - 90}) translate(${outer + 6})${d.angle > Math.PI ? " rotate(180)" : ""}`)
    .attr("text-anchor", (d) => (d.angle > Math.PI ? "end" : null))
    .text((d) => names[d.index]);
  arcs.append("title").text((d) =>
    `${names[d.index]}, ${groups[d.index]}\nParents: ${related(d.index, false)}\nOffspring: ${related(d.index, true)}`);
  arcs.on("mouseenter", (event, d) => ribbons.attr("fill-opacity", (r) =>
    (r.source.index === d.index || r.target.index === d.index ? 0.9 : 0.05)))
    .on("mouseleave", () => ribbons.attr("fill-opacity", null));

  const legend = svg.append("g").attr("transform", `translate(${-width / 2},${-width / 2 + 6})`)
    .selectAll("g").data(color.domain()).join("g")
    .attr("transform", (d, i) => `translate(0,${i * 20})`);
  legend.append("rect").attr("width", 12).attr("height", 12).attr("fill", color);
  legend.append("text").attr("x", 18).attr("y", 6).attr("dy", "0.35em").text((d) => d);

  figure.append(svg.node());
}
