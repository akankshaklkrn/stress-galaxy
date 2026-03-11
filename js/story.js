import {
  zoomToCluster, zoomOut, highlightCluster, highlightWorker,
  clearHighlights, morphLayout, showAnnotation, clearAnnotations
} from "./galaxy.js";

const CLUSTER_COLORS = { 0: "#FFD166", 1: "#FF6B9D", 2: "#00D4FF" };

const ARCHETYPES = {
  0: {
    name: "Priya Sharma",
    age: "36-45", industry: "Healthcare", location: "Onsite",
    stress: 2.8, burnout: 4.3, wellbeing: 3.5,
    caption: `Priya has been a hospital administrator for 9 years.
She has a good manager and decent support — but the demands never stop.
She doesn't call it burnout. She calls it Tuesday.`
  },
  1: {
    name: "Marcus Cole",
    age: "18-25", industry: "Consulting", location: "Onsite",
    stress: 3.2, burnout: 2.6, wellbeing: 2.3,
    caption: `Marcus is 18 months into his first job.
His stress is high but burnout hasn't peaked yet — he's still running on ambition.
He has no mentor. No one told him this pace isn't normal.`
  },
  2: {
    name: "Linda Okafor",
    age: "46-55", industry: "Education", location: "Remote",
    stress: 1.7, burnout: 5.4, wellbeing: 4.6,
    caption: `Linda has been teaching for 26 years.
She rarely feels acute stress anymore — she's learned to absorb it.
Her burnout score is the highest of anyone we profile.
She describes her job as "fine." Her body disagrees.`
  },
  extra1: {
    name: "Riya Desai",
    age: "18-25", industry: "Finance", location: "Onsite",
    stress: 3.5, burnout: 2.4, wellbeing: 2.1,
    caption: `Riya is two years into investment banking.
Her stress is the highest of our profiles.
She has not accessed mental health resources —
not because they don't exist, but because she doesn't think she's allowed to.`
  },
  extra2: {
    name: "James Whitfield",
    age: "36-45", industry: "Manufacturing", location: "Hybrid",
    stress: 2.5, burnout: 4.0, wellbeing: 3.8,
    caption: `James manages a team of 12.
He has access to an EAP program he has never used.
He considers himself fine.
His burnout index suggests otherwise. He is the median of his cluster.`
  }
};

let storyActive  = false;
let storyTimeout = null;
let actIndex     = 0;

export function startStory() {
  if (storyActive) return;
  storyActive = true;
  actIndex    = 0;

  lockInteractions(true);
  showStoryOverlay(true);
  runAct1();
}

export function stopStory() {
  storyActive = false;
  clearTimeout(storyTimeout);
  clearAnnotations();
  clearHighlights();
  zoomOut();
  morphLayout("similarity");
  lockInteractions(false);
  showStoryOverlay(false);
  hideArchetypeCard();
  document.getElementById("story-progress")?.remove();
}

function lockInteractions(locked) {
  const overlay = document.getElementById("interaction-lock");
  if (overlay) overlay.style.display = locked ? "block" : "none";

  document.querySelectorAll("[data-layout]").forEach(btn => {
    if (!btn) return;
    btn.disabled = locked;
    btn.style.opacity = locked ? "0.3" : "1";
  });

  const hint = document.getElementById("lasso-hint");
  if (hint) hint.style.opacity = locked ? "0" : "1";
}

function showStoryOverlay(show) {
  let overlay = document.getElementById("story-caption-overlay");
  if (!overlay && show) {
    overlay = document.createElement("div");
    overlay.id = "story-caption-overlay";
    overlay.style.cssText = `
      position:absolute; bottom:80px; left:50%; transform:translateX(-50%);
      background:rgba(7,8,15,0.88); border:1px solid rgba(255,255,255,0.1);
      border-radius:10px; padding:16px 24px; max-width:520px; width:90%;
      font-family:'Space Mono',monospace; color:#e8e8f0; font-size:12px;
      line-height:1.7; text-align:center; pointer-events:none; z-index:500;
      transition: opacity 0.5s;
    `;
    document.getElementById("galaxy-container").appendChild(overlay);
  }
  if (overlay) overlay.style.opacity = show ? "1" : "0";
}

function setCaption(html) {
  const el = document.getElementById("story-caption-overlay");
  if (!el) return;
  el.style.opacity = "0";
  setTimeout(() => {
    el.innerHTML = html;
    el.style.opacity = "1";
  }, 300);
}

function updateProgress(act) {
  let prog = document.getElementById("story-progress");
  if (!prog) {
    prog = document.createElement("div");
    prog.id = "story-progress";
    prog.style.cssText = `
      position:absolute; top:16px; left:50%; transform:translateX(-50%);
      display:flex; gap:8px; z-index:500; pointer-events:none;
    `;
    document.getElementById("galaxy-container").appendChild(prog);
  }
  prog.innerHTML = [1,2,3,4,5].map(i => `
    <div style="
      width:28px; height:3px; border-radius:2px;
      background:${i <= act ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)"};
      transition:background 0.4s;
    "></div>
  `).join("");
}

function showArchetypeCard(archetype, clusterId) {
  hideArchetypeCard();
  const color = CLUSTER_COLORS[clusterId];
  const card  = document.createElement("div");
  card.id     = "archetype-card";
  card.style.cssText = `
    position:absolute; top:50%; right:24px; transform:translateY(-50%);
    background:rgba(7,8,15,0.95); border:1px solid ${color};
    border-radius:10px; padding:18px 20px; width:220px;
    font-family:'Space Mono',monospace; color:#e8e8f0;
    font-size:10px; line-height:1.7; z-index:500;
    animation: fadeInRight 0.5s ease;
  `;
  card.innerHTML = `
    <div style="color:${color};font-weight:700;font-size:11px;margin-bottom:6px;">
      ${archetype.name}
    </div>
    <div style="opacity:0.6;margin-bottom:10px;font-size:9px;">
      ${archetype.age} · ${archetype.industry} · ${archetype.location}
    </div>
    <div style="
      display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;
      margin-bottom:12px;padding-bottom:10px;
      border-bottom:1px solid rgba(255,255,255,0.1);
    ">
      ${archetypeBar("Stress",    archetype.stress,    4, "#FFD166")}
      ${archetypeBar("Burnout",   archetype.burnout,   7, "#FF6B9D")}
      ${archetypeBar("Wellbeing", archetype.wellbeing, 6, "#00D4FF")}
    </div>
    <div style="opacity:0.75;font-size:9.5px;line-height:1.6;white-space:pre-line;">
      ${archetype.caption}
    </div>
  `;
  document.getElementById("galaxy-container").appendChild(card);
}

function archetypeBar(label, val, max, color) {
  const pct = (val / max * 100).toFixed(0);
  return `
    <div style="grid-column:1/-1;margin-top:3px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;font-size:9px;">
        <span style="opacity:0.5">${label}</span>
        <span>${val.toFixed(1)}</span>
      </div>
      <div style="background:rgba(255,255,255,0.08);border-radius:2px;height:2px;">
        <div style="background:${color};width:${pct}%;height:100%;border-radius:2px;"></div>
      </div>
    </div>
  `;
}

function hideArchetypeCard() {
  document.getElementById("archetype-card")?.remove();
}

function delay(ms) {
  return new Promise(resolve => {
    storyTimeout = setTimeout(resolve, ms);
  });
}

async function waitOrStop(ms) {
  if (!storyActive) return false;
  await delay(ms);
  return storyActive;
}

async function runAct1() {
  if (!storyActive) return;
  updateProgress(1);
  zoomOut(600);
  morphLayout("similarity", 600);
  clearAnnotations();
  clearHighlights();
  hideArchetypeCard();

  setCaption(`<span style="font-size:15px;font-weight:700;letter-spacing:0.1em">THE STRESS GALAXY</span>`);

  if (!await waitOrStop(1200)) return;

  setCaption(`5,000 workers. 160 variables. Every star is a human being.`);

  if (!await waitOrStop(3000)) return;

  setCaption(`Half of them carry a mental health condition.<br>
    <span style="opacity:0.6;font-size:10px">Research estimates suggest over 50% of workers experience significant stress symptoms.</span>`);

  if (!await waitOrStop(3500)) return;

  runAct2();
}

async function runAct2() {
  if (!storyActive) return;
  updateProgress(2);

  setCaption(`Patterns emerge from the chaos. Three constellations of experience.`);

  highlightCluster(0, 600);
  if (!await waitOrStop(1200)) return;

  clearHighlights(400);
  if (!await waitOrStop(600)) return;

  highlightCluster(1, 600);
  if (!await waitOrStop(1200)) return;

  clearHighlights(400);
  if (!await waitOrStop(600)) return;

  highlightCluster(2, 600);
  if (!await waitOrStop(1200)) return;

  clearHighlights(600);
  if (!await waitOrStop(800)) return;

  setCaption(`Meet <strong style="color:#FF6B9D">Cluster 1</strong> — the largest constellation.<br>
    Youngest workers. Highest stress. Lowest resources.`);

  zoomToCluster(1, 1000);
  if (!await waitOrStop(1400)) return;

  showArchetypeCard(ARCHETYPES[1], 1);
  if (!await waitOrStop(4500)) return;

  hideArchetypeCard();
  runAct3();
}

async function runAct3() {
  if (!storyActive) return;
  updateProgress(3);

  zoomOut(800);
  if (!await waitOrStop(1000)) return;

  setCaption(`Now look at the other side of the galaxy.`);
  zoomToCluster(2, 900);
  if (!await waitOrStop(1300)) return;

  setCaption(`
    <strong style="color:#00D4FF">Stable Seniors, Hidden Exhaustion</strong><br>
    Lowest acute stress of anyone — yet burnout score: <strong>5.19 / 7</strong>.<br>
    <span style="opacity:0.65;font-size:10px">These workers have learned to suppress the signal. The exhaustion runs deeper than the stress score reveals.</span>
  `);

  showArchetypeCard(ARCHETYPES[2], 2);
  highlightCluster(2, 600);
  if (!await waitOrStop(5000)) return;

  hideArchetypeCard();
  clearHighlights(500);
  zoomOut(700);
  if (!await waitOrStop(900)) return;

  setCaption(`Spread by stress level — the structural pattern becomes clear.`);
  morphLayout("stress-spectrum", 1000);
  if (!await waitOrStop(1500)) return;

  setCaption(`
    The workers with the fewest resources are the youngest.<br>
    This is not personal failure. <strong>This is a structural pattern.</strong><br>
    <span style="opacity:0.5;font-size:10px">Through-line: Stress concentrates in predictable human clusters.</span>
  `);

  lockInteractions(false);
  document.querySelectorAll("[data-layout]").forEach(btn => {
    btn.disabled = false;
    btn.style.opacity = "1";
  });

  if (!await waitOrStop(4500)) return;

  runAct4();
}

async function runAct4() {
  if (!storyActive) return;
  updateProgress(4);

  morphLayout("similarity", 800);
  zoomOut(700);
  if (!await waitOrStop(1000)) return;

  setCaption(`
    <strong>Where do you belong?</strong><br>
    <span style="opacity:0.7">Use the <em>Find Your Star</em> panel to enter your profile.</span><br>
    <span style="opacity:0.5;font-size:10px">Your star will appear in the galaxy. Your constellation will reveal itself.</span>
  `);

  const panel = document.getElementById("find-your-star-panel");
  if (panel) {
    panel.style.display = "block";
    panel.style.animation = "fadeInRight 0.5s ease";
  }

  if (!await waitOrStop(6000)) return;

  runAct5();
}

async function runAct5() {
  if (!storyActive) return;
  updateProgress(5);

  zoomOut(700);
  if (!await waitOrStop(900)) return;

  setCaption(`
    <strong>The galaxy has told its story.</strong><br>
    <span style="opacity:0.7">Workplace stress is not random.</span><br>
    <span style="opacity:0.7">It concentrates in predictable human clusters.</span><br>
    <span style="opacity:0.5;font-size:10px">Knowing where you belong is the first step toward change.</span>
  `);

  for (let i = 0; i < 3; i++) {
    if (!storyActive) return;
    highlightCluster(i, 500);
    if (!await waitOrStop(900)) return;
    clearHighlights(300);
    if (!await waitOrStop(400)) return;
  }

  if (!await waitOrStop(500)) return;

  setCaption(`
    <span style="font-size:13px;letter-spacing:0.06em">Now explore.</span><br>
    <span style="opacity:0.65">Lasso any region. Compare any cluster. The data is yours.</span>
  `);

  if (!await waitOrStop(3000)) return;

  storyActive = false;
  lockInteractions(false);
  showStoryOverlay(false);
  document.getElementById("story-progress")?.remove();

  const hint = document.getElementById("lasso-hint");
  if (hint) {
    hint.style.opacity = "1";
    hint.style.animation = "fadeIn 0.5s ease";
  }

  const btn = document.getElementById("story-btn");
  if (btn) btn.textContent = "↺ Replay Story";
}

export function skipToExplore() {
  stopStory();
  const hint = document.getElementById("lasso-hint");
  if (hint) hint.style.opacity = "1";
}
