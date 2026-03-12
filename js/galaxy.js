const CLUSTER_COLORS = { 0: "#FFD166", 1: "#FF6B9D", 2: "#00D4FF" };
const CLUSTER_NAMES  = {
  0: "Burning Mid-Career Professionals",
  1: "Overworked Young & Unsupported",
  2: "Stable Seniors, Hidden Exhaustion"
};

const X_EXTENT = [-0.764, 9.883];
const Y_EXTENT = [-1.384, 5.025];

let workers   = [];
let clusters  = [];
let similarity = {};

let svg, g, zoom;
let starfieldG;
let labelLayer;
let clusterLabelNodes = new Map();
let xScale, yScale;
let currentLayout = "similarity";
let lassoActive   = false;
let selectedIds   = new Set();

const W = () => document.getElementById("galaxy-container").clientWidth;
const H = () => document.getElementById("galaxy-container").clientHeight;

export async function initGalaxy() {
  [workers, clusters] = await Promise.all([
    fetch("data/processed/workers.json").then(r => r.json()),
    fetch("data/processed/clusters.json").then(r => r.json()),
  ]);
  similarity = await fetch("data/processed/similarity.json").then(r => r.json());

  buildScales();
  buildSVG();
  drawStars();
  drawClusterLabels();
  buildStatsBar();
  buildTooltip();
  bindZoom();
  bindLasso();
  bindLayoutButtons();
  bindClearButton();

  window.galaxyAPI = {
    morphLayout,
    highlightWorker,
    highlightCluster,
    clearHighlights,
    clearSelection,
    zoomToCluster,
    zoomOut,
    getWorkers: () => workers,
    getClusters: () => clusters,
    setLassoCallback,
    hideStarfield: () => { if (starfieldG) starfieldG.style("opacity", 0); },
    showStarfield: () => { if (starfieldG) starfieldG.style("opacity", 1); },
  };
}

function buildScales() {
  const pad = 60;
  xScale = d3.scaleLinear().domain(X_EXTENT).range([pad, W() - pad]);
  yScale = d3.scaleLinear().domain(Y_EXTENT).range([H() - pad, pad]);
}

function buildSVG() {
  d3.select("#galaxy-container svg").remove();

  svg = d3.select("#galaxy-container")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .style("background", "#07080f");

  starfieldG = svg.append("g").attr("class", "starfield");
  d3.range(200).forEach(() => {
    starfieldG.append("circle")
      .attr("cx", Math.random() * W())
      .attr("cy", Math.random() * H())
      .attr("r", Math.random() * 1.2)
      .attr("fill", "white")
      .attr("opacity", Math.random() * 0.4 + 0.1);
  });

  g = svg.append("g").attr("class", "galaxy-g");
  labelLayer = svg.append("g")
    .attr("class", "cluster-label-layer")
    .style("pointer-events", "none");
}

function drawStars() {
  const node = g.selectAll(".star")
    .data(workers, d => d.id)
    .join(
      enter => enter.append("circle")
        .attr("class", d => `star cluster-${d.cluster}`)
        .attr("cx", d => xScale(d.x))
        .attr("cy", d => yScale(d.y))
        .attr("r", 0)
        .attr("fill", d => CLUSTER_COLORS[d.cluster])
        .attr("opacity", 0)
        .attr("stroke", "none")
        .call(e => e.transition().duration(1200)
          .delay((_, i) => i * 0.15)
          .attr("r", d => nodeRadius(d))
          .attr("opacity", d => nodeOpacity(d)))
    );

  node
    .on("mouseover", onStarHover)
    .on("mouseout",  onStarOut)
    .on("click",     onStarClick);

  workers.forEach(w => {
    if (w.burnout > 5.5) {
      d3.select(`.star[data-id='${w.id}']`).classed("pulse-fast", true);
    } else if (w.burnout > 4.0) {
      d3.select(`.star[data-id='${w.id}']`).classed("pulse-med", true);
    }
  });
}

function nodeRadius(d) {
  return d3.scaleLinear().domain([1, 4]).range([2, 6])(d.stress);
}

function nodeOpacity(d) {
  return d3.scaleLinear().domain([1, 5]).range([0.55, 1])(d.resources);
}

function nodeShape(d) {
  return d.work_location;
}

function drawClusterLabels() {
  clusterLabelNodes = new Map();
  labelLayer?.selectAll?.(".cluster-label")?.remove?.();

  clusters.forEach(c => {
    const labelG = labelLayer.append("g")
      .attr("class", "cluster-label")
      .attr("data-cluster", c.id)
      .attr("opacity", 1);

    // connector (updated on zoom/layout)
    labelG.append("line")
      .attr("class", "cluster-label-connector")
      .attr("stroke", "rgba(255,255,255,0.22)")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4,4");

    const bg = labelG.append("rect")
      .attr("class", "cluster-label-bg")
      .attr("rx", 10)
      .attr("fill", "rgba(7,8,15,0.92)")
      .attr("stroke", "rgba(255,255,255,0.14)")
      .attr("stroke-width", 1)
      .attr("filter", "drop-shadow(0 10px 28px rgba(0,0,0,0.55))");

    const contentG = labelG.append("g").attr("class", "cluster-label-content");

    contentG.append("text")
      .attr("class", "cluster-label-name")
      .attr("x", 0)
      .attr("y", 0)
      .attr("text-anchor", "middle")
      .attr("fill", CLUSTER_COLORS[c.id])
      .attr("font-size", "11px")
      .attr("font-family", "'Space Mono', monospace")
      .attr("letter-spacing", "0.08em")
      .attr("font-weight", "700")
      .text(c.name.toUpperCase());

    contentG.append("text")
      .attr("class", "cluster-label-count")
      .attr("x", 0)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.55)")
      .attr("font-size", "9px")
      .attr("font-family", "'Space Mono', monospace")
      .text(`n = ${c.count.toLocaleString()}`);

    sizeClusterLabel(labelG);

    clusterLabelNodes.set(c.id, labelG);
  });

  positionClusterLabels();
}

function sizeClusterLabel(labelG) {
  const contentG = labelG.select(".cluster-label-content");
  const bg = labelG.select(".cluster-label-bg");
  if (contentG.empty() || bg.empty()) return;

  const padX = 14;
  const padY = 10;
  const bbox = contentG.node().getBBox();
  const rx = bbox.x - padX;
  const ry = bbox.y - padY;
  const rw = bbox.width + padX * 2;
  const rh = bbox.height + padY * 2;
  bg.attr("x", rx).attr("y", ry).attr("width", rw).attr("height", rh);
}

function buildStatsBar() {
  const bar = document.getElementById("stats-bar");
  if (!bar) return;
  updateStatsBar(workers);
}

export function updateStatsBar(subset) {
  const bar = document.getElementById("stats-bar");
  if (!bar) return;

  const n    = subset.length;
  const avg  = key => (subset.reduce((a, w) => a + w[key], 0) / n).toFixed(2);
  const mode = key => {
    const freq = {};
    subset.forEach(w => freq[w[key]] = (freq[w[key]] || 0) + 1);
    return Object.entries(freq).sort((a, b) => b[1] - a[1])[0][0];
  };

  bar.innerHTML = `
    <span>Selected: <strong>${n.toLocaleString()}</strong></span>
    <span>Avg Stress: <strong>${avg("stress")}</strong></span>
    <span>Avg Burnout: <strong>${avg("burnout")}</strong></span>
    <span>Avg Wellbeing: <strong>${avg("wellbeing")}</strong></span>
    <span>Top Industry: <strong>${mode("industry")}</strong></span>
    <span>Common Age: <strong>${mode("age")}</strong></span>
  `;
}

function buildTooltip() {
  if (!document.getElementById("galaxy-tooltip")) {
    const t = document.createElement("div");
    t.id = "galaxy-tooltip";
    t.style.cssText = `
      position:fixed; pointer-events:none; opacity:0;
      background:rgba(7,8,15,0.95); border:1px solid rgba(255,255,255,0.12);
      border-radius:8px; padding:14px 16px; max-width:240px;
      font-family:'Space Mono',monospace; font-size:11px;
      color:#e8e8f0; transition:opacity 0.15s; z-index:1000;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;
    document.body.appendChild(t);
  }
}

function onStarHover(event, d) {
  const tip = document.getElementById("galaxy-tooltip");
  const color = CLUSTER_COLORS[d.cluster];

  tip.innerHTML = `
    <div style="color:${color};font-weight:700;margin-bottom:8px;font-size:12px;">
      ${CLUSTER_NAMES[d.cluster]}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;opacity:0.9;">
      <span style="opacity:0.6">Industry</span><span>${d.industry}</span>
      <span style="opacity:0.6">Age</span><span>${d.age}</span>
      <span style="opacity:0.6">Location</span><span>${d.work_location}</span>
      <span style="opacity:0.6">MH Access</span><span>${d.access_mh}</span>
    </div>
    <div style="margin-top:10px;display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">
      ${miniStat("Stress",      d.stress,      4,   color)}
      ${miniStat("Burnout",     d.burnout,     7,   "#FF6B9D")}
      ${miniStat("Wellbeing",   d.wellbeing,   6,   "#00D4FF")}
      ${miniStat("Resources",   d.resources,   5,   "#06D6A0")}
    </div>
  `;

  tip.style.opacity = "1";
  tip.style.left = `${event.clientX + 14}px`;
  tip.style.top  = `${event.clientY - 10}px`;

  d3.select(event.currentTarget)
    .raise()
    .transition().duration(120)
    .attr("r", nodeRadius(d) * 2.2)
    .attr("stroke", "white")
    .attr("stroke-width", 1.5)
    .attr("opacity", 1);

  if (window.parallelCoordsAPI) {
    window.parallelCoordsAPI.highlightWorker(d.id);
  }
}

function miniStat(label, val, max, color) {
  const pct = (val / max * 100).toFixed(0);
  return `
    <div style="grid-column:1/-1;margin-top:3px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
        <span style="opacity:0.6;font-size:10px">${label}</span>
        <span style="font-size:10px">${val.toFixed(2)}</span>
      </div>
      <div style="background:rgba(255,255,255,0.1);border-radius:2px;height:3px;">
        <div style="background:${color};width:${pct}%;height:100%;border-radius:2px;"></div>
      </div>
    </div>
  `;
}

function onStarOut(event, d) {
  document.getElementById("galaxy-tooltip").style.opacity = "0";
  d3.select(event.currentTarget)
    .transition().duration(200)
    .attr("r", nodeRadius(d))
    .attr("stroke", "none")
    .attr("opacity", nodeOpacity(d));

  if (window.parallelCoordsAPI) window.parallelCoordsAPI.clearHighlight();
}

function onStarClick(event, d) {
  event.stopPropagation();
  if (window.linkedViewsAPI) window.linkedViewsAPI.filterToWorkers([d]);
  updateStatsBar([d]);
}

function bindZoom() {
  zoom = d3.zoom()
    .scaleExtent([0.3, 20])
    .on("zoom", e => {
      g.attr("transform", e.transform);
      const k = e.transform.k;
      g.style("opacity", k > 2 ? 0.72 : 1);
      if (currentLayout === "similarity") positionClusterLabels();
    });

  svg.call(zoom);
  svg.on("mousedown.zoom", null);
  svg.on("touchstart.zoom", null);
  svg.on("touchmove.zoom", null);
  svg.on("touchend.zoom", null);
  svg.on("dblclick.zoom", null);
  svg.on("dblclick", () => zoomOut());
}

export function zoomToCluster(clusterId, duration = 900) {
  const c = clusters.find(cl => cl.id === clusterId);
  if (!c) return;

  const cx = xScale(c.centroid_x);
  const cy = yScale(c.centroid_y);
  const scale = 5;

  svg.transition().duration(duration).call(
    zoom.transform,
    d3.zoomIdentity
      .translate(W() / 2 - scale * cx, H() / 2 - scale * cy)
      .scale(scale)
  );
}

export function zoomOut(duration = 800) {
  svg.transition().duration(duration).call(
    zoom.transform,
    d3.zoomIdentity
  );
}

export function morphLayout(layout, duration = 900) {
  currentLayout = layout;
  const positions = computePositions(layout);

  g.selectAll(".star")
    .transition()
    .duration(duration)
    .ease(d3.easeCubicInOut)
    .attr("cx", d => positions[d.id].x)
    .attr("cy", d => positions[d.id].y);

  setTimeout(() => updateClusterLabelPositions(positions, layout), duration / 2);
}

function computePositions(layout) {
  const pos = {};
  const pad = 60;

  if (layout === "similarity") {
    workers.forEach(w => {
      pos[w.id] = { x: xScale(w.x), y: yScale(w.y) };
    });

  } else if (layout === "stress-spectrum") {
    const xS = d3.scaleLinear().domain([1, 4]).range([pad, W() - pad]);
    workers.forEach(w => {
      pos[w.id] = {
        x: xS(w.stress) + (Math.random() - 0.5) * 18,
        y: (H() / 4) * (w.cluster + 1) + (Math.random() - 0.5) * 40
      };
    });

  } else if (layout === "age-orbit") {
    const ageOrder = { "18-25": 0, "26-35": 1, "36-45": 2, "46-55": 3, "56+": 4 };
    const cx = W() / 2, cy = H() / 2;
    const radii = [80, 150, 220, 290, 360];
    const counts = {};
    workers.forEach(w => {
      const ring = ageOrder[w.age];
      counts[ring] = (counts[ring] || 0) + 1;
    });
    const angles = {};
    workers.forEach(w => {
      const ring = ageOrder[w.age];
      if (!angles[ring]) angles[ring] = 0;
      const r = radii[ring];
      const total = counts[ring];
      const angle = (angles[ring] / total) * 2 * Math.PI;
      angles[ring]++;
      pos[w.id] = {
        x: cx + r * Math.cos(angle) + (Math.random() - 0.5) * 12,
        y: cy + r * Math.sin(angle) + (Math.random() - 0.5) * 12
      };
    });

  } else if (layout === "work-hours-axis") {
    const xD = d3.scaleLinear().domain([1, 5]).range([pad, W() - pad]);
    const yB = d3.scaleLinear().domain([1, 7]).range([H() - pad, pad]);
    workers.forEach(w => {
      pos[w.id] = {
        x: xD(w.demands) + (Math.random() - 0.5) * 14,
        y: yB(w.burnout) + (Math.random() - 0.5) * 14
      };
    });
  }

  return pos;
}

function updateClusterLabelPositions(positions, layout) {
  if (layout !== "similarity") {
    labelLayer?.selectAll?.(".cluster-label").transition().duration(400).attr("opacity", 0);
    return;
  }
  labelLayer?.selectAll?.(".cluster-label").transition().duration(400).attr("opacity", 1);
  positionClusterLabels();
}

function positionClusterLabels() {
  if (!labelLayer || !svg) return;
  if (!clusters?.length) return;
  if (currentLayout !== "similarity") return;

  const t = d3.zoomTransform(svg.node());

  clusters.forEach(c => {
    const labelG = clusterLabelNodes.get(c.id);
    if (!labelG) return;

    // Ensure bg sizing is correct (e.g. after font load)
    sizeClusterLabel(labelG);

    const centroid = t.apply([xScale(c.centroid_x), yScale(c.centroid_y)]);
    const cx = centroid[0];
    const cy = centroid[1];

    // Compute on-screen bounds of the cluster dots
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < workers.length; i++) {
      const w = workers[i];
      if (w.cluster !== c.id) continue;
      const p = t.apply([xScale(w.x), yScale(w.y)]);
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    if (!isFinite(minX)) return;

    const bg = labelG.select(".cluster-label-bg");
    const rectX = +bg.attr("x") || 0;
    const rectY = +bg.attr("y") || 0;
    const rectW = +bg.attr("width") || 0;
    const rectH = +bg.attr("height") || 0;

    const margin = 18;
    const gap = 18;

    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

    // Candidate positions: above (preferred), below, side (fallback)
    const candidates = [];

    // Above
    candidates.push({
      x: (minX + maxX) / 2,
      y: minY - gap - (rectY + rectH / 2),
      score: 3
    });
    // Below
    candidates.push({
      x: (minX + maxX) / 2,
      y: maxY + gap - (rectY - rectH / 2),
      score: 2
    });
    // Side: left for left-ish clusters, right for right-ish clusters
    const centerX = (minX + maxX) / 2;
    const preferLeft = centerX > W() * 0.55;
    candidates.push({
      x: (preferLeft ? (minX - gap) : (maxX + gap)),
      y: (minY + maxY) / 2,
      side: preferLeft ? "left" : "right",
      score: 1
    });

    // Choose best candidate that stays inside viewport and does not overlap the cluster bounds.
    let chosen = null;
    for (const cand of candidates) {
      // Clamp so the full box stays in the viewport
      const x = clamp(cand.x, margin - rectX, W() - margin - (rectX + rectW));
      const y = clamp(cand.y, margin - rectY, H() - margin - (rectY + rectH));

      const left = x + rectX;
      const right = x + rectX + rectW;
      const top = y + rectY;
      const bottom = y + rectY + rectH;

      const overlapsCluster =
        !(right < (minX - 8) || left > (maxX + 8) || bottom < (minY - 8) || top > (maxY + 8));

      if (overlapsCluster) continue;

      chosen = { x, y };
      break;
    }

    // If all candidates overlap, force it to the top margin band.
    if (!chosen) {
      const x = clamp((minX + maxX) / 2, margin - rectX, W() - margin - (rectX + rectW));
      const y = clamp(margin - rectY, margin - rectY, H() - margin - (rectY + rectH));
      chosen = { x, y };
    }

    labelG.attr("transform", `translate(${chosen.x},${chosen.y})`);

    // Connector: from centroid to closest point on box border
    const left = chosen.x + rectX;
    const right = chosen.x + rectX + rectW;
    const top = chosen.y + rectY;
    const bottom = chosen.y + rectY + rectH;

    const nearestX = clamp(cx, left, right);
    const nearestY = clamp(cy, top, bottom);

    labelG.select(".cluster-label-connector")
      .attr("x1", cx - chosen.x)
      .attr("y1", cy - chosen.y)
      .attr("x2", nearestX - chosen.x)
      .attr("y2", nearestY - chosen.y)
      .attr("opacity", 0.9);
  });
}

export function highlightWorker(workerId, color = "white") {
  g.selectAll(".star")
    .transition().duration(200)
    .attr("opacity", d => d.id === workerId ? 1 : 0.08)
    .attr("r", d => d.id === workerId ? nodeRadius(d) * 3 : nodeRadius(d));

  const w = workers.find(w => w.id === workerId);
  if (w) {
    g.selectAll(".star")
      .filter(d => d.id === workerId)
      .attr("stroke", color)
      .attr("stroke-width", 2);
  }
}

export function highlightCluster(clusterId, duration = 400) {
  g.selectAll(".star")
    .transition().duration(duration)
    .attr("opacity", d => d.cluster === clusterId ? nodeOpacity(d) : 0.06)
    .attr("r",       d => d.cluster === clusterId ? nodeRadius(d) * 1.3 : nodeRadius(d) * 0.7);
}

export function clearHighlights(duration = 400) {
  g.selectAll(".star")
    .transition().duration(duration)
    .attr("opacity", d => selectedIds.size > 0
      ? (selectedIds.has(d.id) ? nodeOpacity(d) : 0.08)
      : nodeOpacity(d))
    .attr("r",       d => nodeRadius(d))
    .attr("stroke",  "none");
}

export function clearSelection(duration = 400) {
  selectedIds.clear();
  clearHighlights(duration);
  updateStatsBar(workers);
  if (lassoCallback) lassoCallback(workers);
}

let lassoCallback = null;
export function setLassoCallback(fn) { lassoCallback = fn; }

function bindLasso() {
  let path = [];
  let drawing = false;
  let lassoLine = null;

  svg.on("mousedown.lasso", function(event) {
    if (event.button !== 0) return;
    drawing = true;
    path = [d3.pointer(event, svg.node())];

    lassoLine = g.append("path")
      .attr("class", "lasso-path")
      .attr("fill", "rgba(255,255,255,0.04)")
      .attr("stroke", "rgba(255,255,255,0.5)")
      .attr("stroke-width", 1.5)
      .attr("stroke-dasharray", "4,3");
  });

  svg.on("mousemove.lasso", function(event) {
    if (!drawing) return;
    path.push(d3.pointer(event, svg.node()));
    if (lassoLine) {
      const transform = d3.zoomTransform(svg.node());
      const screenPath = path.map(p => transform.invert(p));
      lassoLine.attr("d", "M" + screenPath.map(p => p.join(",")).join("L") + "Z");
    }
  });

  svg.on("mouseup.lasso", function() {
    if (!drawing) return;
    drawing = false;
    if (lassoLine) lassoLine.remove();

    if (path.length < 3) {
      selectedIds.clear();
      clearHighlights();
      updateStatsBar(workers);
      if (lassoCallback) {
        console.log('[LASSO]', workers.length, 'workers selected');
        lassoCallback(workers);
      }
      return;
    }

    const transform = d3.zoomTransform(svg.node());
    const inside = workers.filter(w => {
      const [sx, sy] = transform.apply([xScale(w.x), yScale(w.y)]);
      return pointInPolygon([sx, sy], path);
    });

    selectedIds = new Set(inside.map(w => w.id));

    g.selectAll(".star")
      .transition().duration(300)
      .attr("opacity", d => selectedIds.has(d.id) ? nodeOpacity(d) : 0.07)
      .attr("r",       d => selectedIds.has(d.id) ? nodeRadius(d) * 1.4 : nodeRadius(d) * 0.7);

    updateStatsBar(inside.length > 0 ? inside : workers);
    if (lassoCallback) {
      const selected = inside.length > 0 ? inside : workers;
      console.log('[LASSO]', selected.length, 'workers selected');
      lassoCallback(selected);
    }
  });
}

function pointInPolygon([px, py], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersect = ((yi > py) !== (yj > py))
      && (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function bindLayoutButtons() {
  document.querySelectorAll("[data-layout]").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("[data-layout]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      morphLayout(btn.dataset.layout);
    });
  });
}

function bindClearButton() {
  const btn = document.getElementById("clear-selection-btn");
  if (!btn) return;
  btn.onclick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();

    window.__lastLassoSubset = null;

    // Remove any "find your star" markers
    g.select(".your-star")?.remove?.();
    g.selectAll(".your-star-ring")?.remove?.();

    clearSelection();
    zoomOut();

    // Return to the main "GALAXY" layout button state
    document.querySelectorAll("[data-layout]").forEach(b => b.classList.remove("active"));
    document.querySelector('[data-layout="similarity"]')?.classList.add("active");
    morphLayout("similarity");
  };
}

export function findYourStar(profile) {
  const scored = workers.map(w => {
    let score = 0;
    if (w.age === profile.age) score += 3;
    if (w.industry === profile.industry) score += 2;
    if (w.work_location === profile.work_location) score += 1;
    if (profile.stress_guess) {
      score -= Math.abs(w.stress - profile.stress_guess);
    }
    return { w, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0].w;

  const existing = g.select(".your-star");
  if (!existing.empty()) existing.remove();

  const starX = xScale(best.x);
  const starY = yScale(best.y);

  const scale = 6;
  svg.transition().duration(900).call(
    zoom.transform,
    d3.zoomIdentity
      .translate(W() / 2 - scale * starX, H() / 2 - scale * starY)
      .scale(scale)
  );

  setTimeout(() => {
    g.append("circle")
      .attr("class", "your-star")
      .attr("cx", starX)
      .attr("cy", starY)
      .attr("r", 0)
      .attr("fill", "white")
      .attr("stroke", CLUSTER_COLORS[best.cluster])
      .attr("stroke-width", 2)
      .transition().duration(600)
      .attr("r", 10)
      .transition().duration(400)
      .attr("r", 7);

    function pulseRing() {
      g.append("circle")
        .attr("class", "your-star-ring")
        .attr("cx", starX).attr("cy", starY)
        .attr("r", 7).attr("fill", "none")
        .attr("stroke", CLUSTER_COLORS[best.cluster])
        .attr("stroke-width", 1.5).attr("opacity", 0.9)
        .transition().duration(1200)
        .attr("r", 22).attr("opacity", 0)
        .remove();
    }
    pulseRing();
    const ringInterval = setInterval(pulseRing, 1400);
    setTimeout(() => clearInterval(ringInterval), 7000);

    showAnnotation(
      `You belong here — <strong>${CLUSTER_NAMES[best.cluster]}</strong>`,
      starX, starY - 20, CLUSTER_COLORS[best.cluster]
    );

    highlightCluster(best.cluster);

  }, 950);

  return best;
}

export function showAnnotation(html, x, y, color = "white", duration = 4000) {
  svg.selectAll(".annotation-callout").remove();

  const t = d3.zoomTransform(svg.node());
  const [sx, sy] = t.apply([x, y]);
  const boxW = 220;
  const boxH = 80;
  const pad = 8;
  const fx = Math.max(pad, Math.min(W() - boxW - pad, sx + 14));
  const fy = Math.max(pad, Math.min(H() - boxH - pad, sy - 24));

  const fo = svg.append("foreignObject")
    .attr("class", "annotation-callout")
    .attr("x", fx)
    .attr("y", fy)
    .attr("width", boxW)
    .attr("height", boxH)
    .attr("opacity", 0);

  fo.append("xhtml:div")
    .style("background", "rgba(7,8,15,0.92)")
    .style("border", `1px solid ${color}`)
    .style("border-radius", "6px")
    .style("padding", "8px 12px")
    .style("font-family", "'Space Mono', monospace")
    .style("font-size", "11px")
    .style("color", "#e8e8f0")
    .style("line-height", "1.5")
    .html(html);

  fo.transition().duration(400).attr("opacity", 1);

  if (duration > 0) {
    fo.transition().delay(duration).duration(500).attr("opacity", 0).remove();
  }

  return fo;
}

export function clearAnnotations() {
  g.selectAll(".annotation-callout").remove();
}
