/* Handicap Cup Scorer
   - 3v3 roster editable
   - 9 pairings (Hi vs Aj), 4 games each
   - enter points per game (0..11) for both sides
   - totals = handicap headstart + points scored (+ optional adjustments)
   - persists to localStorage
*/

const STORAGE_KEY = "handicap-cup-v1";

const clampInt = (v, min, max) => {
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) return "";
  return Math.max(min, Math.min(max, n));
};

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
  homeAdj: 0,
  awayAdj: 0,
  // scores[pairIndex][gameIndex] = { h: number|"", a: number|"" }
  scores: Array.from({ length: 9 }, () =>
    Array.from({ length: 4 }, () => ({ h: "", a: "" }))
  ),
});

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // very light validation
    if (!parsed?.home || !parsed?.away || !parsed?.scores) return defaultState();
    return parsed;
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

const homeAdjEl = document.getElementById("homeAdj");
const awayAdjEl = document.getElementById("awayAdj");

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

// --- Pairing helpers
// Pair order: H1 v A1, H1 v A2, H1 v A3, H2 v A1, ...
function getPairing(pairIndex) {
  const hi = Math.floor(pairIndex / 3); // 0..2
  const ai = pairIndex % 3; // 0..2
  return { hi, ai };
}

function sumHandicaps(team) {
  return team.reduce((acc, p) => acc + (Number(p.hcap) || 0), 0);
}

function sumPointsScored() {
  let home = 0;
  let away = 0;
  for (let p = 0; p < state.scores.length; p++) {
    for (let g = 0; g < state.scores[p].length; g++) {
      const cell = state.scores[p][g];
      const h = Number(cell.h);
      const a = Number(cell.a);
      if (!Number.isNaN(h)) home += h;
      if (!Number.isNaN(a)) away += a;
    }
  }
  return { home, away };
}

function computeTotals() {
  const homeHcap = sumHandicaps(state.home);
  const awayHcap = sumHandicaps(state.away);
  const pts = sumPointsScored();

  const homeAdj = Number(state.homeAdj) || 0;
  const awayAdj = Number(state.awayAdj) || 0;

  const grandHome = homeHcap + pts.home + homeAdj;
  const grandAway = awayHcap + pts.away + awayAdj;

  return { homeHcap, awayHcap, ...pts, homeAdj, awayAdj, grandHome, grandAway };
}

// --- Render
function renderRoster(teamKey, mountEl) {
  mountEl.innerHTML = "";
  state[teamKey].forEach((p, idx) => {
    const row = document.createElement("div");
    row.className = "rosterRow";

    const nameField = document.createElement("label");
    nameField.className = "field";
    nameField.innerHTML = `<span>Player ${idx + 1} name</span>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.value = p.name ?? "";
    nameInput.addEventListener("input", (e) => {
      state[teamKey][idx].name = e.target.value;
      saveState();
      renderMatchesOnly(); // pairing titles depend on names
    });
    nameField.appendChild(nameInput);

    const hcapField = document.createElement("label");
    hcapField.className = "field";
    hcapField.innerHTML = `<span>Handicap</span>`;
    const hcapInput = document.createElement("input");
    hcapInput.type = "number";
    hcapInput.step = "1";
    hcapInput.value = p.hcap ?? 0;
    hcapInput.addEventListener("input", (e) => {
      const v = clampInt(e.target.value, 0, 999);
      state[teamKey][idx].hcap = v === "" ? 0 : v;
      saveState();
      renderTotalsOnly();
    });
    hcapField.appendChild(hcapInput);

    row.appendChild(nameField);
    row.appendChild(hcapField);
    mountEl.appendChild(row);
  });
}

function renderMatchesOnly() {
  // Single table, 9 rows, columns: Pairing | G1 H/A | G2 H/A | G3 H/A | G4 H/A
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr>
      <th>Pairing</th>
      <th colspan="2">Game 1</th>
      <th colspan="2">Game 2</th>
      <th colspan="2">Game 3</th>
      <th colspan="2">Game 4</th>
    </tr>
    <tr>
      <th></th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
      <th>H</th><th>A</th>
    </tr>
  `;
  table.appendChild(thead);

  const tbody = document.createElement("tbody");

  for (let p = 0; p < 9; p++) {
    const { hi, ai } = getPairing(p);
    const hName = state.home[hi]?.name ?? `Home ${hi + 1}`;
    const aName = state.away[ai]?.name ?? `Away ${ai + 1}`;

    const tr = document.createElement("tr");
    const pairingTd = document.createElement("td");
    pairingTd.className = "pairingTitle";
    pairingTd.textContent = `${hName} vs ${aName}`;
    tr.appendChild(pairingTd);

    for (let g = 0; g < 4; g++) {
      const cell = state.scores[p][g];

      const tdH = document.createElement("td");
      const inH = document.createElement("input");
      inH.className = "mini";
      inH.type = "number";
      inH.min = "0";
      inH.max = "11";
      inH.step = "1";
      inH.value = cell.h;
      inH.addEventListener("input", (e) => {
        const v = clampInt(e.target.value, 0, 11);
        state.scores[p][g].h = v;
        saveState();
        renderTotalsOnly();
      });
      tdH.appendChild(inH);

      const tdA = document.createElement("td");
      const inA = document.createElement("input");
      inA.className = "mini";
      inA.type = "number";
      inA.min = "0";
      inA.max = "11";
      inA.step = "1";
      inA.value
