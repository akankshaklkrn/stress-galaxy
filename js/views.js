const CLUSTER_COLORS = { 0: "#FFD166", 1: "#FF6B9D", 2: "#00D4FF" };
const CLUSTER_NAMES = {
  0: "Burning Mid-Career",
  1: "Overworked Young",
  2: "Stable Seniors"
};

const AXES = [
  { key: "stress",      label: "Stress",    domain: [1, 4], note: "DASS scale (1-4)" },
  { key: "burnout",     label: "Burnout",   domain: [1, 7], note: "Maslach EE (1-7)" },
  { key: "wellbeing",   label: "Wellbeing", domain: [1, 6], note: "MHI-5 (1-6)" },
  { key: "demands",     label: "Demands",   domain: [1, 5], note: "JD-R composite" },
  { key: "resources",   label: "Resources", domain: [1, 5], note: "JD-R composite" },
];

let pcSvg, pcG;
let yScales  = {};
let xScale;
let allWorkers = [];
let currentSubset = [];

const MARGIN = { top: 40, right: 10, bottom: 40, left: 10 };

export function initParallelCoords(workers) {
  allWorkers    = workers;
  currentSubset = workers;

  const container = document.getElementById("parallel-coords");
  if (!container) return;

  const W = container.clientWidth  || 600;
  const H = container.clientHeight || 260;

  d3.select("#parallel-coords svg").remove();

  pcSvg = d3.select("#parallel-coords")
    .append("svg")
    .attr("width", W)
    .attr("height", H)
    .style("background", "transparent");

  pcG = pcSvg.append("g")
    .attr("transform", `translate(${MARGIN.left},${MARGIN.top})`);

  const innerW = W - MARGIN.left - MARGIN.right;
  const innerH = H - MARGIN.top  - MARGIN.bottom;

  xScale = d3.scalePoint()
    .domain(AXES.map(a => a.key))
    .range([0, innerW])
    .padding(0.1);

  AXES.forEach(axis => {
    yScales[axis.key] = d3.scaleLinear()
      .domain(axis.domain)
      .range([innerH, 0]);
  });

  drawLines(workers, "all-lines", 0.12);

  AXES.forEach(axis => {
    const axisG = pcG.append("g")
      .attr("class", "pc-axis")
      .attr("transform", `translate(${xScale(axis.key)},0)`);

    axisG.append("line")
      .attr("y1", 0).attr("y2", innerH)
      .attr("stroke", "rgba(255,255,255,0.15)")
      .attr("stroke-width", 1);

    const ticks = yScales[axis.key].ticks(4);
    ticks.forEach(t => {
      axisG.append("text")
        .attr("y", yScales[axis.key](t))
        .attr("x", -6)
        .attr("text-anchor", "end")
        .attr("fill", "rgba(255,255,255,0.35)")
        .attr("font-size", "9.5px")
        .attr("font-family", "'Space Mono', monospace")
        .attr("dominant-baseline", "middle")
        .text(t);

      axisG.append("line")
        .attr("x1", -3).attr("x2", 3)
        .attr("y1", yScales[axis.key](t))
        .attr("y2", yScales[axis.key](t))
        .attr("stroke", "rgba(255,255,255,0.2)")
        .attr("stroke-width", 0.5);
    });
  });

  window.parallelCoordsAPI = {
    filterToWorkers,
    highlightWorker,
    clearHighlight,
  };
}

function linePath(d) {
  return d3.line()(
    AXES.map(axis => [xScale(axis.key), yScales[axis.key](d[axis.key])])
  );
}

function getTooltipEl() {
  return window.__getActiveTooltip?.()
    || document.getElementById("tooltip-modal")
    || document.getElementById("tooltip");
}

function positionTooltip(tip, x, y) {
  const pad = 8;
  const offX = 12;
  const offY = -8;
  const w = tip.offsetWidth || 220;
  const h = tip.offsetHeight || 120;

  let left = x + offX;
  let top = y + offY;

  if (left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
  if (top + h > window.innerHeight - pad) top = window.innerHeight - h - pad;
  if (left < pad) left = pad;
  if (top < pad) top = pad;

  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
}

function drawLines(subset, className, baseOpacity) {
  pcG.selectAll(`.${className}`).remove();

  const sample = subset.length > 800
    ? subset.filter((_, i) => i % Math.ceil(subset.length / 800) === 0)
    : subset;

  pcG.append("g")
    .attr("class", className)
    .selectAll("path")
    .data(sample)
    .join("path")
    .attr("d", linePath)
    .attr("fill", "none")
    .attr("stroke", d => CLUSTER_COLORS[d.cluster])
    .attr("stroke-width", 0.8)
    .attr("opacity", baseOpacity)
    .on("mouseover", function(event, d) {
      if (window.__tooltipPinned) return;
      const tip = getTooltipEl();
      d3.select(this)
        .raise()
        .transition().duration(100)
        .attr("stroke-width", 2)
        .attr("opacity", 0.95);

      if (!tip) return;
      tip.style.opacity = "1";
      tip.innerHTML = `
        <div style="color:${CLUSTER_COLORS[d.cluster]};font-weight:700;margin-bottom:6px;font-size:10px">
          ${CLUSTER_NAMES[d.cluster]}
        </div>
        <div style="font-size:9px;line-height:1.7;opacity:0.85">
          ${d.industry} · ${d.age} · ${d.work_location}<br>
          Stress: <strong>${d.stress.toFixed(2)}</strong> /4<br>
          Burnout: <strong>${d.burnout.toFixed(2)}</strong> /7<br>
          Wellbeing: <strong>${d.wellbeing.toFixed(2)}</strong> /6<br>
          Demands: <strong>${d.demands.toFixed(2)}</strong> /5<br>
          Resources: <strong>${d.resources.toFixed(2)}</strong> /5
        </div>`;
      positionTooltip(tip, event.clientX, event.clientY);
    })
    .on("mousemove", function(event) {
      if (window.__tooltipPinned) return;
      const tip = getTooltipEl();
      if (tip && tip.style.opacity === "1") {
        positionTooltip(tip, event.clientX, event.clientY);
      }
    })
    .on("mouseout", function() {
      if (window.__tooltipPinned) return;
      const tip = getTooltipEl();
      d3.select(this)
        .transition().duration(120)
        .attr("stroke-width", 0.8)
        .attr("opacity", baseOpacity);
      if (tip) tip.style.opacity = "0";
    });
}

export function filterToWorkers(subset) {
  currentSubset = subset;

  pcG.selectAll(".all-lines path")
    .transition().duration(400)
    .attr("opacity", 0.04);

  drawLines(subset, "selected-lines", 0.65);

  pcG.selectAll(".selected-lines path")
    .attr("opacity", 0)
    .transition().duration(500)
    .attr("opacity", 0.65);
}

export function resetFilter() {
  pcG.selectAll(".selected-lines").remove();
  pcG.selectAll(".all-lines path")
    .transition().duration(400)
    .attr("opacity", 0.12);
}

export function highlightWorker(workerId) {
  const w = allWorkers.find(w => w.id === workerId);
  if (!w) return;

  pcG.selectAll(".highlight-line").remove();

  pcG.append("path")
    .attr("class", "highlight-line")
    .attr("d", linePath(w))
    .attr("fill", "none")
    .attr("stroke", "white")
    .attr("stroke-width", 2)
    .attr("opacity", 0.9);
}

export function clearHighlight() {
  pcG.selectAll(".highlight-line").remove();
}
