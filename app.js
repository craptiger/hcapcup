/* Handicap Cup Scorer — Spreadsheet-mirroring version (Set Totals)
   - 3v3 roster editable + handicap totals
   - Fixed match row order to match your Excel
   - Each row: 4 games (Home/Away points)
   - "Set total" columns show summed points for that row (read-only)
   - Running totals displayed per row (handicap base + cumulative points)
   - Persists to localStorage
*/
const APP_VERSION = "1.0.0";

const STORAGE_KEY = `handicap-cup-${APP_VERSION}`;


const clampIntOrBlank = (v, min, max) => {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return "";
  return Math.max(min, Math.min(max, n));
};

const clampInt = (v, min, max) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
};

/**
 * Match order mirrors your sheet:
 * "2 v 1", "1 v 3", "3 v 2", "2 v 3", "3 v 1", "1 v 2", "3 v 3", "2 v 2", "1 v 1"
 * Interpretation: HomePlayerNumber v AwayPlayerNumber (1-based indices)
 */
const MATCH_ORDER = [
  { h: 2, a: 1 },
  { h: 1, a: 3 },
  { h: 3, a: 2 },
  { h: 2, a: 3 },
  { h: 3, a: 1 },
  { h: 1, a: 2 },
  { h: 3, a: 3 },
  { h: 2, a: 2 },
  { h: 1, a: 1 },
];

const defaultState = () => ({
  home: [
    { name: "Home 1", hcap: 0 },
    { name: "Home 2", hcap: 0 },
    { name: "Home 3", hcap: 0 },
  ],
  away: [
    { name: "Away 1", hcap: 0 },
    { name: "Away 2", hcap: 0 },
    { name: "Away 3", hcap: 0 },
  ],
  // scores[rowIndex][gameIndex] = { h: number|"", a: number|"" }
  scores: Array.from({ length: 9 }, () =>
    Array.from({ length: 4 }, () => ({ h: "", a: "" }))
  ),
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);

    // If upgrading from previous versions (v2 had exchange), ignore it.
    if (!s.scores) return defaultState();

    // Basic shape safety
    if (!Array.isArray(s.home) || !Array.isArray(s.away)) return defaultState();
    if (!Array.isArray(s.scores) || s.scores.length !== 9) return defaultState();

    return s;
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

let state = loadState();

// --- DOM refs
const homeRosterEl = document.getElementById("homeRoster");
const awayRosterEl = document.getElementById("awayRoster");
const matchesEl = document.getElementById("matches");

const homeHcapTotalEl = document.getElementById("homeHcapTotal");
const awayHcapTotalEl = document.getElementById("awayHcapTotal");

const homePtsEl = document.getElementById("homePts");
const awayPtsEl = document.getElementById("awayPts");

const grandHomeEl = document.getElementById("grandHome");
const grandAwayEl = document.getElementById("grandAway");

const scoreHomeEl = document.getElementById("scoreHome");
const scoreAwayEl = document.getElementById("scoreAway");

const appVersionEl = document.getElementById("appVersion");
if (appVersionEl) appVersionEl.textContent = APP_VERSION;

document.getElementById("btnReset").addEventListener("click", () => {
  if (!confirm("Reset everything for a new night?")) return;
  state = defaultState();
  saveState();
  renderAll();
});

function sumHandicaps(team) {
  return team.reduce((acc, p) => acc + (Number(p.hcap) || 0), 0);
}

function rowSetTotals(rowIndex) {
  let home = 0;
  let away = 0;
  for (let g = 0; g < 4; g++) {
    const cell = state.scores[rowIndex][g];
    const h = Number(cell.h);
    const a = Number(cell.a);
    if (!Number.isNaN(h)) home += h;
    if (!Number.isNaN(a)) away += a;
  }
  return { home, away };
}

function sumPointsAll() {
  let home = 0;
  let away = 0;
  for (let r = 0; r < state.scores.length; r++) {
    const rt = rowSetTotals(r);
    home += rt.home;
    away += rt.away;
  }
  return { home, away };
}

function computeRunningTotalsByRow() {
  const baseHome = sumHandicaps(state.home);
  const baseAway = sumHandicaps(state.away);

  let runHome = baseHome;
  let runAway = baseAway;

  const rows = [];

  for (let r = 0; r < 9; r++) {
    const rt = rowSetTotals(r);
    runHome += rt.home;
    runAway += rt.away;
    rows.push({ totalHome: runHome, totalAway: runAway });
  }

  return { baseHome, baseAway, rows };
}

// --- Render roster
function renderRoster(teamKey, mountEl) {
  mountEl.innerHTML = "";
  state[teamKey].forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "rosterRow";

    const nameField = document.createElement("label");
    nameField.className = "field";
    nameField.innerHTML = `<span>${teamKey === "home" ? "HOME" : "AWAY"} player ${idx + 1}</span>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = p.name ?? "";
    nameInput.addEventListener("input", (e) => {
      state[teamKey][idx].name = e.target.value;
      saveState();
      // Names not displayed in grid yet, but keep for future
    });
    nameField.appendChild(nameInput);

    const hcapField = document.createElement("label");
    hcapField.className = "field";
    hcapField.innerHTML = `<span>HCap</span>`;
    const hcapInput = document.createElement("input");
    hcapInput.type = "number";
    hcapInput.step = "1";
    hcapInput.value = Number(p.hcap || 0);
    hcapInput.addEventListener("input", (e) => {
      state[teamKey][idx].hcap = clampInt(e.target.value, 0, 999);
      saveState();
      renderTotalsOnly();
      renderMatchesOnly(); // running totals base changes
    });
    hcapField.appendChild(hcapInput);

    row.appendChild(nameField);
    row.appendChild(hcapField);
    mountEl.appendChild(row);
  });
}

// --- Render spreadsheet-style matches table (with Set Totals)
function renderMatchesOnly() {
  const { rows: running } = computeRunningTotalsByRow();

  const table = document.createElement("table");

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Matches</th>
      <th colspan="2">Game 1</th>
      <th colspan="2">Game 2</th>
      <th colspan="2">Game 3</th>
      <th colspan="2">Game 4</th>
      <th colspan="2">Set total</th>
      <th>TOTAL HOME</th>
      <th>TOTAL AWAY</th>
    </tr>
    <tr>
      <th></th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
      <th>HOME</th><th>AWAY</th>
      <th></th>
      <th></th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let r = 0; r < 9; r++) {
    const tr = document.createElement("tr");

    const matchSpec = MATCH_ORDER[r];
    const hi = matchSpec.h - 1;
    const ai = matchSpec.a - 1;

    const matchTd = document.createElement("td");
    matchTd.className = "pairingTitle";
    matchTd.textContent = `${matchSpec.h} v ${matchSpec.a}`;
    tr.appendChild(matchTd);

    // 4 games: H/A inputs
    for (let g = 0; g < 4; g++) {
      const cell = state.scores[r][g];

      const tdH = document.createElement("td");
      const inH = document.createElement("input");
      inH.className = "mini";
      inH.type = "number";
      inH.min = "0";
      inH.max = "11";
      inH.step = "1";
      inH.value = cell.h;
      inH.title = `${state.home[hi]?.name || "Home"} vs ${state.away[ai]?.name || "Away"} — Game ${g + 1} (Home points)`;
      inH.addEventListener("input", (e) => {
        state.scores[r][g].h = clampIntOrBlank(e.target.value, 0, 11);
        saveState();
        renderTotalsOnly(); // update header totals only
      });
       inH.addEventListener("blur", () => {
  renderMatchesOnly();
});
// Auto-select the whole number when the field gains focus
inH.addEventListener("focus", (e) => {
  // Using a tiny timeout avoids some mobile/browser quirks
  setTimeout(() => e.target.select(), 0);
});


      tdH.appendChild(inH);

      const tdA = document.createElement("td");
      const inA = document.createElement("input");
      inA.className = "mini";
      inA.type = "number";
      inA.min = "0";
      inA.max = "11";
      inA.step = "1";
      inA.value = cell.a;
      inA.title = `${state.home[hi]?.name || "Home"} vs ${state.away[ai]?.name || "Away"} — Game ${g + 1} (Away points)`;
      inA.addEventListener("input", (e) => {
        state.scores[r][g].a = clampIntOrBlank(e.target.value, 0, 11);
        saveState();
        renderTotalsOnly();
      });
       inA.addEventListener("blur", () => {
  renderMatchesOnly();
});
       // Auto-select the whole number when the field gains focus
inA.addEventListener("focus", (e) => {
  // Using a tiny timeout avoids some mobile/browser quirks
  setTimeout(() => e.target.select(), 0);
});

      tdA.appendChild(inA);

      tr.appendChild(tdH);
      tr.appendChild(tdA);
    }

    // Set totals (computed, read-only)
    const st = rowSetTotals(r);

    const setH = document.createElement("td");
    setH.textContent = st.home;
    const setA = document.createElement("td");
    setA.textContent = st.away;

    tr.appendChild(setH);
    tr.appendChild(setA);

    // Running totals
    const totH = document.createElement("td");
    totH.textContent = running[r]?.totalHome ?? 0;
    const totA = document.createElement("td");
    totA.textContent = running[r]?.totalAway ?? 0;

    tr.appendChild(totH);
    tr.appendChild(totA);

    tbody.appendChild(tr);
  }

  // bottom totals row
  const last = running[running.length - 1] || { totalHome: sumHandicaps(state.home), totalAway: sumHandicaps(state.away) };
  const trBottom = document.createElement("tr");
  trBottom.innerHTML = `
    <td class="pairingTitle">TOTAL</td>
    <td colspan="10"></td>
    <td><strong>${last.totalHome}</strong></td>
    <td><strong>${last.totalAway}</strong></td>
  `;
  tbody.appendChild(trBottom);

  table.appendChild(tbody);

  matchesEl.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "matchGrid";
  wrap.appendChild(table);
  matchesEl.appendChild(wrap);
}

function renderTotalsOnly() {
  const homeHcap = sumHandicaps(state.home);
  const awayHcap = sumHandicaps(state.away);

  const pts = sumPointsAll();

  const grandHome = homeHcap + pts.home;
  const grandAway = awayHcap + pts.away;

  homeHcapTotalEl.textContent = homeHcap;
  awayHcapTotalEl.textContent = awayHcap;

  homePtsEl.textContent = pts.home;
  awayPtsEl.textContent = pts.away;

  grandHomeEl.textContent = grandHome;
  grandAwayEl.textContent = grandAway;

  scoreHomeEl.textContent = grandHome;
  scoreAwayEl.textContent = grandAway;
}

function renderAll() {
  renderRoster("home", homeRosterEl);
  renderRoster("away", awayRosterEl);
  renderMatchesOnly();
  renderTotalsOnly();
}

// Service worker
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {

      // Version injected into SW URL → forces update when changed
      const swUrl = `./sw.js?v=${APP_VERSION}`;

      const reg = await navigator.serviceWorker.register(swUrl);

      // Display version
      const appVersionEl = document.getElementById("appVersion");
      if (appVersionEl) appVersionEl.textContent = APP_VERSION;

      // Force activate new worker immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }

    } catch (err) {
      console.error("SW registration failed", err);
    }
  });
}


renderAll();
