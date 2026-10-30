// A zoomable sunburst in each figure[data-tree], after
// https://observablehq.com/@d3/zoomable-sunburst. Clicking an arc zooms into
// it, the centre zooms out, and a leaf with an href opens its note. The centre
// names the arc zoomed into and links its note when it has one.
for (const figure of document.querySelectorAll("figure[data-tree]")) {
  const data = JSON.parse(figure.dataset.tree);
  const width = 928;
  const radius = width / 8;
  // Each top-level arc takes a hue, in the order data-hues gives when the
  // figure has one; its descendants are tints of it.
  const hues = figure.dataset.hues ? JSON.parse(figure.dataset.hues) : data.children.map((d) => d.name);
  const color = d3.scaleOrdinal(hues, d3.quantize(d3.interpolateRainbow, hues.length + 1));
  const hierarchy = d3.hierarchy(data).count();
  const root = d3.partition().size([2 * Math.PI, hierarchy.height + 1])(hierarchy);
  root.each((d) => (d.current = d));

  const arc = d3.arc()
    .startAngle((d) => d.x0)
    .endAngle((d) => d.x1)
    .padAngle((d) => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius * 1.5)
    .innerRadius((d) => d.y0 * radius)
    .outerRadius((d) => Math.max(d.y0 * radius, d.y1 * radius - 1));
  // Three rings show at a time, one more than the original: the whole wheel.
  const arcVisible = (d) => d.y1 <= 4 && d.y0 >= 1 && d.x1 > d.x0;
  const labelVisible = (d) => arcVisible(d) && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  const labelTransform = (d) => {
    const x = (((d.x0 + d.x1) / 2) * 180) / Math.PI;
    const y = ((d.y0 + d.y1) / 2) * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  };
  const opacity = (d) => (arcVisible(d) ? (d.children ? 0.6 : 0.4) : 0);

  const svg = d3.create("svg")
    .attr("viewBox", [-width / 2, -width / 2, width, width])
    .attr("width", width)
    .attr("height", width);
  svg.append("title").text(figure.dataset.title);

  const nodes = root.descendants().slice(1);
  const path = svg.append("g").selectAll("a").data(nodes).join("a")
    .attr("href", (d) => (d.children ? null : d.data.href ?? null))
    .append("path")
    .attr("fill", (d) => {
      while (d.depth > 1) d = d.parent;
      return color(d.data.name);
    })
    .attr("fill-opacity", (d) => opacity(d.current))
    .attr("pointer-events", (d) => (arcVisible(d.current) ? "auto" : "none"))
    .attr("d", (d) => arc(d.current));
  path.filter((d) => d.children).style("cursor", "pointer").on("click", clicked);
  path.append("title").text((d) => d.ancestors().map((a) => a.data.name).reverse().slice(1).join(" / "));

  const label = svg.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text").data(nodes).join("text")
    .attr("dy", "0.35em")
    .attr("fill-opacity", (d) => +labelVisible(d.current))
    .attr("transform", (d) => labelTransform(d.current))
    .text((d) => d.data.name);

  const parent = svg.append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);
  const centre = svg.append("a").append("text").attr("text-anchor", "middle").attr("dy", "0.35em");

  function clicked(event, p) {
    parent.datum(p.parent || root);
    centre.text(p.data.name);
    d3.select(centre.node().parentNode).attr("href", p.data.href ?? null);
    root.each((d) => (d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth),
    }));
    const t = svg.transition().duration(750);
    // Transition only the arcs that are, or will be, visible.
    path.transition(t)
      .tween("data", (d) => {
        const i = d3.interpolate(d.current, d.target);
        return (t) => (d.current = i(t));
      })
      .filter(function (d) { return +this.getAttribute("fill-opacity") || arcVisible(d.target); })
      .attr("fill-opacity", (d) => opacity(d.target))
      .attr("pointer-events", (d) => (arcVisible(d.target) ? "auto" : "none"))
      .attrTween("d", (d) => () => arc(d.current));
    label.filter(function (d) { return +this.getAttribute("fill-opacity") || labelVisible(d.target); })
      .transition(t)
      .attr("fill-opacity", (d) => +labelVisible(d.target))
      .attrTween("transform", (d) => () => labelTransform(d.current));
  }

  figure.append(svg.node());
}
