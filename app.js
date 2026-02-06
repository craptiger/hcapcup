/* Handicap Cup Scorer — Spreadsheet-mirroring version (Set Totals)
   - 3v3 roster editable + handicap totals
   - Fixed match row order to match your Excel
   - Each row: 4 games (Home/Away points)
   - "Set total" columns show summed points for that row (read-only)
   - Running totals displayed per row (handicap base + cumulative points)
   - Persists to localStorage
*/

const APP_VERSION = "1.0.5";
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

    if (!s.scores) return defaultState();
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

document.getElementById("btnReset")?.addEventListener("click", () => {
  if (!confirm("Reset everything for a new night?")) return;
  state = defaultState();
  saveState();
  renderAll();
});

// ---------- calculations ----------
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
  for (let r = 0; r < 9; r++) {
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

// ---------- navigation helpers ----------
function focusNextScoreInput(current) {
  // Only match inputs have class .mini
  const inputs = Array.from(document.querySelectorAll(".mini"));
  const i = inputs.indexOf(current);
  if (i === -1) return;

  const next = inputs[i + 1];
  if (next) {
    next.focus();
    // select after focus for mobile reliability
    setTimeout(() => next.select(), 0);
  }
}

// ---------- in-place UI updates (no table rebuild) ----------
function updateRowComputedCells(rowIndex) {
  const st = rowSetTotals(rowIndex);

  const setH = document.getElementById(`setH-${rowIndex}`);
  const setA = document.getElementById(`setA-${rowIndex}`);

  if (setH) setH.textContent = st.home;
  if (setA) setA.textContent = st.away;
}

function updateAllRunningTotalsCells() {
  const { rows: running } = computeRunningTotalsByRow();

  for (let r = 0; r < 9; r++) {
    updateRowComputedCells(r);

    const runH = document.getElementById(`runH-${r}`);
    const runA = document.getElementById(`runA-${r}`);

    if (runH) runH.textContent = running[r]?.totalHome ?? 0;
    if (runA) runA.textContent = running[r]?.totalAway ?? 0;
  }

  const last = running[running.length - 1];
  const totalHomeEl = document.getElementById("finalTotalHome");
  const totalAwayEl = document.getElementById("finalTotalAway");
  if (last && totalHomeEl && totalAwayEl) {
    totalHomeEl.textContent = last.totalHome;
    totalAwayEl.textContent = last.totalAway;
  }
}

// ---------- render ----------
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

      // IMPORTANT: do not rebuild table; update totals cells in-place
      updateAllRunningTotalsCells();
    });
    hcapField.appendChild(hcapInput);

    row.appendChild(nameField);
    row.appendChild(hcapField);
    mountEl.appendChild(row);
  });
}

function wireScoreInputCommon(inputEl, rowIndex, onEnter) {
  inputEl.setAttribute("enterkeyhint", "next");

  // Select value on focus (overwrite-friendly)
  inputEl.addEventListener("focus", (e) => {
    setTimeout(() => e.target.select(), 0);
  });

  // ENTER -> next
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter(e.target);
    }
  });

  // When leaving a cell, update set totals + running totals (in-place)
  inputEl.addEventListener("blur", () => {
    updateRowComputedCells(rowIndex);
    updateAllRunningTotalsCells();
  });
}

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

      // IMPORTANT: on input, do not rebuild table (keeps focus)
      inH.addEventListener("input", (e) => {
        state.scores[r][g].h = clampIntOrBlank(e.target.value, 0, 11);
        saveState();
        renderTotalsOnly(); // header totals live
      });

      wireScoreInputCommon(inH, r, focusNextScoreInput);

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

      wireScoreInputCommon(inA, r, focusNextScoreInput);

      tdA.appendChild(inA);

      tr.appendChild(tdH);
      tr.appendChild(tdA);
    }

    // Set totals (computed, read-only)
    const st = rowSetTotals(r);

    const setH = document.createElement("td");
    setH.id = `setH-${r}`;
    setH.textContent = st.home;

    const setA = document.createElement("td");
    setA.id = `setA-${r}`;
    setA.textContent = st.away;

    tr.appendChild(setH);
    tr.appendChild(setA);

    // Running totals
    const totH = document.createElement("td");
    totH.id = `runH-${r}`;
    totH.textContent = running[r]?.totalHome ?? 0;

    const totA = document.createElement("td");
    totA.id = `runA-${r}`;
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
    <td><strong id="finalTotalHome">${last.totalHome}</strong></td>
    <td><strong id="finalTotalAway">${last.totalAway}</strong></td>
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
  renderMatchesOnly();   // full build once
  renderTotalsOnly();
}

// Service worker (versioned URL so SW updates automatically)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const swUrl = `./sw.js?v=${APP_VERSION}`;
      const reg = await navigator.serviceWorker.register(swUrl);

      // take over immediately if a new worker is waiting
      if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
      }
    } catch (err) {
      console.error("SW registration failed", err);
    }
  });
}

renderAll();
