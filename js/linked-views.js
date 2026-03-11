// ============================================================
// linked-views.js — Person 3 deliverable
// Three charts: Bubble, Age Ring, Burnout by Industry
// All respond to window.linkedViewsAPI.filterToWorkers(subset)
// ============================================================

const COLORS  = { 0: "#FFD166", 1: "#FF6B9D", 2: "#00D4FF" };
const NAMES   = {
  0: "Burning Mid-Career",
  1: "Overworked Young",
  2: "Stable Seniors"
};
const AGES      = ["18-25", "26-35", "36-45", "46-55", "56+"];
const INDUSTRIES = ["Consulting","Education","Finance","Healthcare","IT","Manufacturing","Retail"];

let allWorkers = [];

// ── Boot ─────────────────────────────────────────────────────
export function initLinkedViews(workers) {
  allWorkers = workers;

  initBubbleChart(workers);
  initAgeRing(workers);
  initBurnoutBars(workers);

  // Expose global API for galaxy lasso callback
  window.linkedViewsAPI = {
    filterToWorkers(subset) {
      updateBubbleChart(subset);
      updateAgeRing(subset);
      updateBurnoutBars(subset);
    }
  };
}

// ════════════════════════════════════════════════════════════
// CHART 1 — Stress × Wellbeing Bubble Chart
// X = wellbeing, Y = stress, size = burnout, color = cluster
// ════════════════════════════════════════════════════════════

let bsvg, bg, bxScale, byScale, brScale;
const BM = { top: 36, right: 16, bottom: 44, left: 44 };

function initBubbleChart(workers) {
  const el = document.getElementById("bubble-chart");
  if (!el) return;

  const W = el.clientWidth  || 340;
  const H = el.clientHeight || 240;
  const iW = W - BM.left - BM.right;
  const iH = H - BM.top  - BM.bottom;

  d3.select("#bubble-chart svg").remove();

  bsvg = d3.select("#bubble-chart").append("svg")
    .attr("width", W).attr("height", H)
    .style("background", "transparent");

  bg = bsvg.append("g").attr("transform", `translate(${BM.left},${BM.top})`);

  bxScale = d3.scaleLinear().domain([1, 6]).range([0, iW]);
  byScale = d3.scaleLinear().domain([1, 4]).range([iH, 0]);
  brScale = d3.scaleSqrt().domain([1, 7]).range([2, 11]);

  // Quadrant lines + labels
  const midX = bxScale(3.5), midY = byScale(2.5);

  bg.append("line")
    .attr("x1", midX).attr("x2", midX).attr("y1", 0).attr("y2", iH)
    .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

  bg.append("line")
    .attr("x1", 0).attr("x2", iW).attr("y1", midY).attr("y2", midY)
    .attr("stroke", "rgba(255,255,255,0.07)").attr("stroke-width", 1).attr("stroke-dasharray", "4,3");

  const qlabels = [
    { x: iW * 0.08, y: 10,      text: "HIGH STRESS",    sub: "low wellbeing" },
    { x: iW * 0.75, y: 10,      text: "CRISIS ZONE",    sub: "high stress + low wellbeing" },
    { x: iW * 0.08, y: iH - 8,  text: "STRUGGLING",     sub: "low stress, low wellbeing" },
    { x: iW * 0.7,  y: iH - 8,  text: "THRIVING",       sub: "calm + high wellbeing" },
  ];
  qlabels.forEach(q => {
    bg.append("text").attr("x", q.x).attr("y", q.y)
      .attr("fill", "rgba(255,255,255,0.18)").attr("font-size", "7.5px")
      .attr("font-family", "'Space Mono',monospace").attr("letter-spacing", "0.06em")
      .text(q.text);
  });

  // Axes
  const xAxis = d3.axisBottom(bxScale).ticks(5)
    .tickFormat(d => d.toFixed(0)).tickSize(-iH);
  const yAxis = d3.axisLeft(byScale).ticks(4)
    .tickFormat(d => d.toFixed(0)).tickSize(-iW);

  bg.append("g").attr("class", "b-xaxis").attr("transform", `translate(0,${iH})`)
    .call(xAxis)
    .call(styleAxis)
    .append("text").attr("x", iW / 2).attr("y", 36)
    .attr("fill", "rgba(255,255,255,0.45)").attr("font-size", "9px")
    .attr("font-family", "'Space Mono',monospace").attr("text-anchor", "middle")
    .text("WELLBEING →");

  bg.append("g").attr("class", "b-yaxis").call(yAxis).call(styleAxis)
    .append("text").attr("transform", "rotate(-90)")
    .attr("x", -iH / 2).attr("y", -34)
    .attr("fill", "rgba(255,255,255,0.45)").attr("font-size", "9px")
    .attr("font-family", "'Space Mono',monospace").attr("text-anchor", "middle")
    .text("← STRESS");

  // Axis label
  bg.append("text").attr("x", iW / 2).attr("y", -20)
    .attr("text-anchor", "middle").attr("fill", "rgba(255,255,255,0.3)")
    .attr("font-size", "8px").attr("font-family", "'Space Mono',monospace")
    .attr("letter-spacing", "0.08em")
    .text("BUBBLE SIZE = BURNOUT SEVERITY");

  renderBubbles(workers, 1);
}

function renderBubbles(subset, opacity) {
  const tip = document.getElementById("tooltip");
  // Sample for perf — max 600 bubbles
  const sample = subset.length > 600
    ? subset.filter((_, i) => i % Math.ceil(subset.length / 600) === 0)
    : subset;

  bg.selectAll(".bubble").remove();

  bg.selectAll(".bubble")
    .data(sample.sort(() => Math.random() - 0.5)) // shuffle so clusters mix
    .join("circle")
    .attr("class", "bubble")
    .attr("cx", d => bxScale(d.wellbeing))
    .attr("cy", d => byScale(d.stress))
    .attr("r", 0)
    .attr("fill", d => COLORS[d.cluster])
    .attr("opacity", 0)
    .attr("stroke", "none")
    .transition().duration(500).delay((_, i) => i * 0.4)
    .attr("r", d => brScale(d.burnout))
    .attr("opacity", d => opacity * 0.55);

  bg.selectAll(".bubble")
    .on("mouseover", function(event, d) {
      d3.select(this).raise()
        .transition().duration(100)
        .attr("r", brScale(d.burnout) * 1.8)
        .attr("opacity", 1)
        .attr("stroke", "white").attr("stroke-width", 1);
      if (tip) {
        tip.style.opacity = "1";
        tip.style.left = `${event.clientX + 12}px`;
        tip.style.top  = `${event.clientY - 8}px`;
        tip.innerHTML = `
          <div style="color:${COLORS[d.cluster]};font-weight:700;margin-bottom:6px;font-size:10px">
            ${NAMES[d.cluster]}
          </div>
          <div style="font-size:9px;line-height:1.7;opacity:0.85">
            ${d.industry} · ${d.age}<br>
            Stress: <strong>${d.stress.toFixed(2)}</strong> /4<br>
            Wellbeing: <strong>${d.wellbeing.toFixed(2)}</strong> /6<br>
            Burnout: <strong>${d.burnout.toFixed(2)}</strong> /7
          </div>`;
      }
    })
    .on("mouseout", function(event, d) {
      d3.select(this).transition().duration(150)
        .attr("r", brScale(d.burnout))
        .attr("opacity", opacity * 0.55)
        .attr("stroke", "none");
      if (tip) tip.style.opacity = "0";
    });
}

function updateBubbleChart(subset) {
  renderBubbles(subset, subset.length === allWorkers.length ? 1 : 0.85);
}

// ════════════════════════════════════════════════════════════
// CHART 2 — Age Distribution Ring
// Concentric donut: each ring = age group
// Each segment colored by cluster proportion
// ════════════════════════════════════════════════════════════

let rsvg, rg;

function initAgeRing(workers) {
  const el = document.getElementById("age-ring");
  if (!el) return;

  const W = el.clientWidth  || 260;
  const H = el.clientHeight || 240;

  d3.select("#age-ring svg").remove();

  rsvg = d3.select("#age-ring").append("svg")
    .attr("width", W).attr("height", H)
    .style("background", "transparent");

  rg = rsvg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);

  renderRing(workers);
  drawRingLabels(W, H);
}

function renderRing(subset) {
  rg.selectAll(".ring-arc").remove();
  rg.selectAll(".ring-label-inner").remove();

  const el = document.getElementById("age-ring");
  if (!el) return;
  const W = el.clientWidth || 260;

  const maxR  = Math.min(W, 260) / 2 - 8;
  const rings = [
    { age: "18-25", inner: maxR * 0.22, outer: maxR * 0.38 },
    { age: "26-35", inner: maxR * 0.40, outer: maxR * 0.55 },
    { age: "36-45", inner: maxR * 0.57, outer: maxR * 0.70 },
    { age: "46-55", inner: maxR * 0.72, outer: maxR * 0.84 },
    { age: "56+",   inner: maxR * 0.86, outer: maxR * 0.99 },
  ];

  rings.forEach(ring => {
    const ageWorkers = subset.filter(w => w.age === ring.age);
    if (ageWorkers.length === 0) return;

    // Count by cluster
    const counts = { 0: 0, 1: 0, 2: 0 };
    ageWorkers.forEach(w => counts[w.cluster]++);
    const total = ageWorkers.length;

    // Build pie segments
    const pieData = [0, 1, 2]
      .map(c => ({ cluster: c, value: counts[c] }))
      .filter(d => d.value > 0);

    const pie = d3.pie().value(d => d.value).sort(null)(pieData);
    const arc = d3.arc().innerRadius(ring.inner).outerRadius(ring.outer).padAngle(0.025);

    const tip = document.getElementById("tooltip");

    rg.selectAll(`.ring-arc-${ring.age.replace("+", "p")}`)
      .data(pie)
      .join("path")
      .attr("class", `ring-arc ring-arc-${ring.age.replace("+", "p")}`)
      .attr("d", arc)
      .attr("fill", d => COLORS[d.data.cluster])
      .attr("opacity", 0)
      .transition().duration(600).delay((_, i) => i * 60)
      .attr("opacity", 0.75);

    // Hover on arcs
    rg.selectAll(`.ring-arc-${ring.age.replace("+", "p")}`)
      .on("mouseover", function(event, d) {
        d3.select(this).transition().duration(100).attr("opacity", 1);
        const pct = ((d.data.value / total) * 100).toFixed(1);
        if (tip) {
          tip.style.opacity = "1";
          tip.style.left = `${event.clientX + 12}px`;
          tip.style.top  = `${event.clientY - 8}px`;
          tip.innerHTML = `
            <div style="color:${COLORS[d.data.cluster]};font-weight:700;margin-bottom:5px;font-size:10px">
              ${NAMES[d.data.cluster]}
            </div>
            <div style="font-size:9px;opacity:0.85;line-height:1.6">
              Age: <strong>${ring.age}</strong><br>
              Count: <strong>${d.data.value.toLocaleString()}</strong><br>
              Share of age group: <strong>${pct}%</strong>
            </div>`;
        }
      })
      .on("mouseout", function() {
        d3.select(this).transition().duration(150).attr("opacity", 0.75);
        if (tip) tip.style.opacity = "0";
      });
  });
}

function drawRingLabels(W, H) {
  const maxR  = Math.min(W, 260) / 2 - 8;
  const rings = [
    { age: "18-25", r: maxR * 0.30 },
    { age: "26-35", r: maxR * 0.475 },
    { age: "36-45", r: maxR * 0.635 },
    { age: "46-55", r: maxR * 0.78 },
    { age: "56+",   r: maxR * 0.925 },
  ];

  // Labels at 12 o'clock position
  rings.forEach(ring => {
    rg.append("text")
      .attr("x", 0).attr("y", -ring.r)
      .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
      .attr("fill", "rgba(255,255,255,0.35)").attr("font-size", "7px")
      .attr("font-family", "'Space Mono',monospace")
      .text(ring.age);
  });

  // Center label
  rg.append("text").attr("text-anchor", "middle").attr("y", -6)
    .attr("fill", "rgba(255,255,255,0.5)").attr("font-size", "8px")
    .attr("font-family", "'Space Mono',monospace").attr("font-weight", "700")
    .text("AGE");
  rg.append("text").attr("text-anchor", "middle").attr("y", 7)
    .attr("fill", "rgba(255,255,255,0.3)").attr("font-size", "7px")
    .attr("font-family", "'Space Mono',monospace")
    .text("GROUPS");
}

function updateAgeRing(subset) {
  renderRing(subset);
}

// ════════════════════════════════════════════════════════════
// CHART 3 — Burnout by Industry (Grouped Horizontal Bars)
// Each industry has 3 bars (one per cluster)
// Sorted by cluster 2 burnout descending (highest burnout = Education)
// ════════════════════════════════════════════════════════════

let isvg, ig, ixScale, iyScale;
const IM = { top: 28, right: 20, bottom: 16, left: 88 };

function initBurnoutBars(workers) {
  const el = document.getElementById("burnout-bars");
  if (!el) return;

  const W = el.clientWidth  || 340;
  const H = el.clientHeight || 240;
  const iW = W - IM.left - IM.right;
  const iH = H - IM.top  - IM.bottom;

  d3.select("#burnout-bars svg").remove();

  isvg = d3.select("#burnout-bars").append("svg")
    .attr("width", W).attr("height", H)
    .style("background", "transparent");

  ig = isvg.append("g").attr("transform", `translate(${IM.left},${IM.top})`);

  ixScale = d3.scaleLinear().domain([0, 7]).range([0, iW]);
  iyScale = d3.scaleBand().domain(INDUSTRIES).range([0, iH]).padding(0.28);

  // X axis
  ig.append("g").attr("transform", `translate(0,${iH})`).call(
    d3.axisBottom(ixScale).ticks(5).tickSize(-iH)
  ).call(styleAxis);

  // X axis label
  ig.append("text").attr("x", iW / 2).attr("y", iH + 28)
    .attr("text-anchor", "middle").attr("fill", "rgba(255,255,255,0.4)")
    .attr("font-size", "8px").attr("font-family", "'Space Mono',monospace")
    .text("AVG BURNOUT SCORE (1-7)");

  // Y axis labels (custom — styled industry names)
  INDUSTRIES.forEach(ind => {
    ig.append("text")
      .attr("x", -8).attr("y", iyScale(ind) + iyScale.bandwidth() / 2)
      .attr("text-anchor", "end").attr("dominant-baseline", "middle")
      .attr("fill", "rgba(255,255,255,0.6)").attr("font-size", "8.5px")
      .attr("font-family", "'Space Mono',monospace")
      .text(ind.toUpperCase());
  });

  // Annotation: highest burnout bar
  ig.append("text").attr("x", iW * 0.55).attr("y", iyScale("Education") - 6)
    .attr("fill", "rgba(0,212,255,0.6)").attr("font-size", "7.5px")
    .attr("font-family", "'Space Mono',monospace").attr("font-style", "italic")
    .text("← highest burnout cluster in Education");

  renderBars(workers);
}

function computeBurnoutByIndustry(subset) {
  const data = {};
  INDUSTRIES.forEach(ind => {
    data[ind] = { 0: [], 1: [], 2: [] };
  });
  subset.forEach(w => {
    if (data[w.industry]) data[w.industry][w.cluster].push(w.burnout);
  });
  return data;
}

function renderBars(subset) {
  const data = computeBurnoutByIndustry(subset);
  const tip  = document.getElementById("tooltip");
  const bw   = iyScale.bandwidth() / 3.2;

  ig.selectAll(".bar-group").remove();

  INDUSTRIES.forEach(ind => {
    const grp = ig.append("g").attr("class", "bar-group");

    [0, 1, 2].forEach(cluster => {
      const vals = data[ind][cluster];
      if (vals.length === 0) return;
      const avg  = vals.reduce((a, b) => a + b, 0) / vals.length;
      const yOff = cluster * (bw + 1.5);

      const bar = grp.append("rect")
        .attr("x", 0)
        .attr("y", iyScale(ind) + yOff)
        .attr("height", bw)
        .attr("width", 0)
        .attr("rx", 2)
        .attr("fill", COLORS[cluster])
        .attr("opacity", 0.72);

      bar.transition().duration(600).delay(cluster * 80)
        .attr("width", ixScale(avg));

      // Value label at end of bar
      grp.append("text")
        .attr("class", "bar-val")
        .attr("x", ixScale(avg) + 3)
        .attr("y", iyScale(ind) + yOff + bw / 2)
        .attr("dominant-baseline", "middle")
        .attr("fill", "rgba(255,255,255,0.35)")
        .attr("font-size", "7px")
        .attr("font-family", "'Space Mono',monospace")
        .attr("opacity", 0)
        .text(avg.toFixed(2))
        .transition().duration(600).delay(cluster * 80 + 300)
        .attr("opacity", 1);

      bar.on("mouseover", function(event) {
        d3.select(this).transition().duration(100).attr("opacity", 1);
        if (tip) {
          tip.style.opacity = "1";
          tip.style.left = `${event.clientX + 12}px`;
          tip.style.top  = `${event.clientY - 8}px`;
          tip.innerHTML = `
            <div style="color:${COLORS[cluster]};font-weight:700;margin-bottom:5px;font-size:10px">
              ${NAMES[cluster]}
            </div>
            <div style="font-size:9px;opacity:0.85;line-height:1.6">
              Industry: <strong>${ind}</strong><br>
              Avg Burnout: <strong>${avg.toFixed(3)}</strong> /7<br>
              Workers: <strong>${vals.length.toLocaleString()}</strong>
            </div>`;
        }
      }).on("mouseout", function() {
        d3.select(this).transition().duration(150).attr("opacity", 0.72);
        if (tip) tip.style.opacity = "0";
      });
    });
  });
}

function updateBurnoutBars(subset) {
  ig.selectAll(".bar-group").remove();
  ig.selectAll(".bar-val").remove();
  renderBars(subset);
}

// ── Shared axis styler ────────────────────────────────────────
function styleAxis(g) {
  g.select(".domain").attr("stroke", "rgba(255,255,255,0.1)");
  g.selectAll(".tick line")
    .attr("stroke", "rgba(255,255,255,0.06)")
    .attr("stroke-dasharray", "3,3");
  g.selectAll(".tick text")
    .attr("fill", "rgba(255,255,255,0.35)")
    .attr("font-size", "8px")
    .attr("font-family", "'Space Mono',monospace");
}
