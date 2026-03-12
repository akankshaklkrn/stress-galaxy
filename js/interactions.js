import { findYourStar, setLassoCallback, morphLayout } from "./galaxy.js";
import { filterToWorkers, resetFilter }                from "./views.js";
import { startStory, stopStory, skipToExplore }        from "./story.js";

const INDUSTRIES    = ["Consulting","Finance","Healthcare","IT","Manufacturing","Retail","Education"];
const AGE_GROUPS    = ["18-25","26-35","36-45","46-55","56+"];
const WORK_LOCS     = ["Onsite","Hybrid","Remote"];

export function initInteractions() {
  buildFindYourStarPanel();
  bindStoryControls();
  bindLassoToLinkedViews();
  bindClearSelection();
}

function buildFindYourStarPanel() {
  const panel = document.getElementById("find-your-star-panel");
  if (!panel) return;

  panel.innerHTML = `
    <div style="
      background:rgba(7,8,15,0.95);
      border:1px solid rgba(255,255,255,0.12);
      border-radius:10px; padding:20px;
      font-family:'Space Mono',monospace;
      font-size:11px; color:#e8e8f0;
    ">
      <div style="font-weight:700;font-size:12px;margin-bottom:14px;
        color:rgba(255,255,255,0.9);letter-spacing:0.08em;">
        ✦ FIND YOUR STAR
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;">

        <label style="display:flex;flex-direction:column;gap:4px;">
          <span style="opacity:0.55;font-size:9px;letter-spacing:0.06em">AGE GROUP</span>
          <select id="fys-age" ${selectStyle}>
            ${AGE_GROUPS.map(a => `<option value="${a}">${a}</option>`).join("")}
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:4px;">
          <span style="opacity:0.55;font-size:9px;letter-spacing:0.06em">INDUSTRY</span>
          <select id="fys-industry" ${selectStyle}>
            ${INDUSTRIES.map(i => `<option value="${i}">${i}</option>`).join("")}
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:4px;">
          <span style="opacity:0.55;font-size:9px;letter-spacing:0.06em">WORK LOCATION</span>
          <select id="fys-location" ${selectStyle}>
            ${WORK_LOCS.map(l => `<option value="${l}">${l}</option>`).join("")}
          </select>
        </label>

        <label style="display:flex;flex-direction:column;gap:4px;">
          <span style="opacity:0.55;font-size:9px;letter-spacing:0.06em">
            STRESS LEVEL <span style="opacity:0.4">(1 = low, 4 = high)</span>
          </span>
          <input id="fys-stress" type="range" min="1" max="4" step="0.1" value="2.5"
            style="accent-color:#FFD166;cursor:pointer;">
          <span id="fys-stress-val" style="opacity:0.6;font-size:9px">2.5</span>
        </label>

        <button id="fys-submit" style="
          margin-top:6px; padding:9px 0; border:none; border-radius:6px;
          background:#FFD166; color:#07080f; font-family:'Space Mono',monospace;
          font-size:10px; font-weight:700; letter-spacing:0.08em;
          cursor:pointer; transition:transform 0.15s,opacity 0.15s;
        ">PLACE MY STAR →</button>

        <button id="fys-reset" style="
          padding:6px 0; border:1px solid rgba(255,255,255,0.15); border-radius:6px;
          background:transparent; color:rgba(255,255,255,0.5);
          font-family:'Space Mono',monospace; font-size:9px;
          cursor:pointer; letter-spacing:0.05em;
        ">RESET</button>
      </div>
    </div>
  `;

  document.getElementById("fys-stress").addEventListener("input", e => {
    document.getElementById("fys-stress-val").textContent = (+e.target.value).toFixed(1);
  });

  document.getElementById("fys-submit").addEventListener("click", () => {
    const profile = {
      age:          document.getElementById("fys-age").value,
      industry:     document.getElementById("fys-industry").value,
      work_location:document.getElementById("fys-location").value,
      stress_guess: +document.getElementById("fys-stress").value,
    };
    const result = findYourStar(profile);
    if (result) {
      document.getElementById("fys-result")?.remove();
      const res = document.createElement("div");
      res.id = "fys-result";
      res.style.cssText = `
        margin-top:12px; padding:10px 12px;
        background:rgba(255,255,255,0.05); border-radius:6px;
        font-size:9.5px; line-height:1.7; color:rgba(255,255,255,0.8);
      `;
      const clusterCounts = { 0: 1497, 1: 1771, 2: 1732 };
      const clusterStory  = {
        0: 'Mid-career. Enough experience to see the pattern. Not enough leverage to change it.',
        1: 'First jobs. Nobody warned them this pace would cost them something.',
        2: 'Decades in. They know how to look fine. Their burnout score disagrees.'
      };
      res.innerHTML = `
        <div style="color:${clusterColor(result.cluster)};font-size:8px;
                    letter-spacing:0.12em;margin-bottom:6px;">
          YOUR CONSTELLATION
        </div>
        <div style="font-family:'Syne',sans-serif;font-size:13px;
                    font-weight:700;color:#e8e8f0;margin-bottom:6px;">
          ${result.cluster_name}
        </div>
        <div style="opacity:0.55;font-size:9px;margin-bottom:8px;">
          ${result.industry} · ${result.age} · ${result.work_location ?? ''}
        </div>
        <div style="opacity:0.75;font-size:9.5px;line-height:1.7;
                    border-left:2px solid ${clusterColor(result.cluster)};
                    padding-left:10px;">
          ${clusterStory[result.cluster]}
        </div>
        <div style="opacity:0.35;font-size:8px;margin-top:8px;">
          You share this constellation with 
          ${clusterCounts[result.cluster].toLocaleString()} workers.
        </div>
      `;
      panel.querySelector("div").appendChild(res);
    }
  });

  document.getElementById("fys-reset").addEventListener("click", () => {
    document.getElementById("fys-result")?.remove();
    document.querySelector(".your-star")?.remove();
    document.querySelectorAll(".your-star-ring").forEach(e => e.remove());
    window.galaxyAPI?.clearHighlights();
    window.galaxyAPI?.zoomOut();
  });

  const btn = document.getElementById("fys-submit");
  btn.addEventListener("mouseenter", () => btn.style.transform = "scale(1.02)");
  btn.addEventListener("mouseleave", () => btn.style.transform = "scale(1)");
}

const selectStyle = `style="
  background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12);
  border-radius:5px; padding:6px 8px; color:#e8e8f0;
  font-family:'Space Mono',monospace; font-size:10px; cursor:pointer;
  outline:none; width:100%;
"`;

function clusterColor(id) {
  return { 0: "#FFD166", 1: "#FF6B9D", 2: "#00D4FF" }[id] ?? "white";
}

function bindStoryControls() {
  document.getElementById("story-btn")?.addEventListener("click", () => {
    startStory();
    document.getElementById("story-btn").textContent = "◼ Stop Story";
  });

  document.getElementById("skip-story-btn")?.addEventListener("click", () => {
    skipToExplore();
    document.getElementById("story-btn").textContent = "▶ Play Story";
  });

  document.querySelector('[data-layout="similarity"]')?.classList.add("active");
}

function bindLassoToLinkedViews() {
  if (!window.galaxyAPI) return;

  window.galaxyAPI.setLassoCallback(subset => {
    window.parallelCoordsAPI?.filterToWorkers(subset);
    if (subset.length === window.galaxyAPI.getWorkers().length) {
      resetFilter();
    } else {
      filterToWorkers(subset);
    }

    window.linkedViewsAPI?.filterToWorkers(subset);
  });
}

function bindClearSelection() {
  document.getElementById("clear-selection-btn")?.addEventListener("click", () => {
    window.parallelCoordsAPI?.filterToWorkers(null);
    window.linkedViewsAPI?.filterToWorkers(null);
  });
}
