/* Handicap Cup Scorer — Spreadsheet-mirroring version (Set Totals)
   - 3v3 roster editable + handicap totals
   - Fixed match row order to match your Excel
   - Each row: 4 games (Home/Away points)
   - "Set total" columns show summed points for that row (read-only)
   - Running totals displayed per row (handicap base + cumulative points)
   - Persists to localStorage
*/

const STORAGE_KEY = "handicap-cup-v3";

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
    nameInput.addEve
