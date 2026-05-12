/**
 * App Module — Main Orchestrator
 * Initializes the application, wires UI controls to API calls,
 * and coordinates between graph renderer, simulation, and API.
 */

import * as api from './api.js';
import * as graph from './graph.js';
import * as sim from './simulation.js';

let fsm = null;
let analysisResult = null;

/* ═══════════════════════════════════════════════════════════
   INITIALIZATION
   ═══════════════════════════════════════════════════════════ */

async function init() {
  try {
    const data = await api.getFsm();
    fsm = data.fsm;
    analysisResult = null;
    sim.stopSimulation();
    graph.resetNodePositions();
    graph.layoutNodes(fsm.states);
    graph.initToolbar();
    buildControls();
    render();
  } catch (err) {
    console.error('Failed to initialize:', err);
    alert('Could not connect to the backend server. Make sure it is running on port 5000.');
  }
}

function render() {
  graph.renderGraph(fsm, analysisResult, sim.getSimState());
  renderAnalysis();
}

/* ═══════════════════════════════════════════════════════════
   BUILDER CONTROLS
   ═══════════════════════════════════════════════════════════ */

function buildControls() {
  const lp = document.getElementById('builder-controls');
  lp.innerHTML = `
    <div class="ctrl-group"><label>Add State</label>
      <div class="ctrl-row"><input type="text" id="inp-state" placeholder="StateName"><button id="btn-add-state">Add</button></div></div>
    <div class="ctrl-group"><label>Remove State</label>
      <div class="ctrl-row"><select id="sel-rm-state"></select><button id="btn-rm-state" class="danger">Remove</button></div></div>
    <div class="ctrl-group"><label>Add Transition</label>
      <select id="sel-from" style="margin-bottom:4px"></select>
      <select id="sel-to" style="margin-bottom:4px"></select>
      <div class="ctrl-row"><input type="text" id="inp-action" placeholder="actionName"><button id="btn-add-trans">Add</button></div></div>
    <div class="ctrl-group"><label>Remove Transition</label>
      <div class="ctrl-row"><select id="sel-rm-trans" style="font-size:.72rem"></select><button id="btn-rm-trans" class="danger">Rm</button></div></div>
    <div class="ctrl-group"><label>Start State</label>
      <div class="ctrl-row"><select id="sel-start"></select><button id="btn-set-start">Set</button></div></div>
    <button class="primary full" id="btn-analyze">⚙ Analyze FSM</button>
    <button class="full" id="btn-simulate">▶ Simulate</button>
    <button class="full" id="btn-export">↗ Export JSON</button>
    <div class="ctrl-group" style="margin-top:10px"><label>Import JSON</label>
      <textarea id="ta-import" placeholder='Paste JSON here...'></textarea>
      <button class="full" id="btn-import">Load JSON</button></div>
    <button class="danger full" id="btn-reset" style="margin-top:8px">⟳ Reset</button>
  `;
  populateSelects();

  document.getElementById('btn-add-state').onclick = handleAddState;
  document.getElementById('btn-rm-state').onclick = handleRemoveState;
  document.getElementById('btn-add-trans').onclick = handleAddTransition;
  document.getElementById('btn-rm-trans').onclick = handleRemoveTransition;
  document.getElementById('btn-set-start').onclick = handleSetStart;
  document.getElementById('btn-analyze').onclick = handleAnalyze;
  document.getElementById('btn-simulate').onclick = handleToggleSimulation;
  document.getElementById('btn-export').onclick = handleExport;
  document.getElementById('btn-import').onclick = handleImport;
  document.getElementById('btn-reset').onclick = () => init();
}

function populateSelects() {
  const opts = fsm.states.map(s => `<option value="${s}">${s}</option>`).join('');
  ['sel-rm-state', 'sel-from', 'sel-to', 'sel-start'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = opts;
  });
  const sel = document.getElementById('sel-start');
  if (sel) sel.value = fsm.startState;

  const tOpts = fsm.transitions.map((t, i) =>
    `<option value="${i}">${t.from}→${t.to} [${t.action}]</option>`
  ).join('');
  const rt = document.getElementById('sel-rm-trans');
  if (rt) rt.innerHTML = tOpts;
}

/* ═══════════════════════════════════════════════════════════
   EVENT HANDLERS — Each calls the backend API
   ═══════════════════════════════════════════════════════════ */

async function handleAddState() {
  const inp = document.getElementById('inp-state');
  const name = inp.value.trim();
  if (!name) return;
  try {
    const data = await api.addState(name);
    fsm = data.fsm;
    graph.addNodePosition(name);
    inp.value = '';
    populateSelects();
    render();
  } catch (err) { alert(err.message); }
}

async function handleRemoveState() {
  const s = document.getElementById('sel-rm-state').value;
  if (!s) return;
  try {
    const data = await api.removeState(s);
    fsm = data.fsm;
    graph.removeNodePosition(s);
    populateSelects();
    render();
  } catch (err) { alert(err.message); }
}

async function handleAddTransition() {
  const from = document.getElementById('sel-from').value;
  const to = document.getElementById('sel-to').value;
  const action = document.getElementById('inp-action').value.trim();
  if (!from || !to || !action) return;
  try {
    const data = await api.addTransition(from, to, action);
    fsm = data.fsm;
    document.getElementById('inp-action').value = '';
    populateSelects();
    render();
  } catch (err) { alert(err.message); }
}

async function handleRemoveTransition() {
  const idx = parseInt(document.getElementById('sel-rm-trans').value);
  if (isNaN(idx)) return;
  try {
    const data = await api.removeTransition(idx);
    fsm = data.fsm;
    populateSelects();
    render();
  } catch (err) { alert(err.message); }
}

async function handleSetStart() {
  const stateName = document.getElementById('sel-start').value;
  try {
    const data = await api.setStartState(stateName);
    fsm = data.fsm;
    render();
  } catch (err) { alert(err.message); }
}

async function handleAnalyze() {
  try {
    const data = await api.analyzeFsm();
    analysisResult = data.analysis;
    render();
  } catch (err) { alert(err.message); }
}

function handleToggleSimulation() {
  if (sim.isSimActive()) {
    sim.stopSimulation();
    render();
    return;
  }
  if (!fsm.startState) { alert('Set a start state first'); return; }
  // Run analysis first, then start simulation
  handleAnalyze().then(() => {
    sim.startSimulation(fsm.startState);
    render();
  });
}

async function handleExport() {
  try {
    const data = await api.exportFsm();
    document.getElementById('modal-content').textContent = JSON.stringify(data.fsm, null, 2);
    document.getElementById('modal-overlay').classList.remove('hidden');
  } catch (err) { alert(err.message); }
}

async function handleImport() {
  try {
    const raw = document.getElementById('ta-import').value;
    const parsed = JSON.parse(raw);
    const data = await api.importFsm(parsed);
    fsm = data.fsm;
    graph.resetNodePositions();
    graph.layoutNodes(fsm.states);
    analysisResult = null;
    populateSelects();
    render();
  } catch (err) { alert('Import failed: ' + err.message); }
}

/* ═══════════════════════════════════════════════════════════
   SIMULATION STEP (called from analysis panel buttons)
   ═══════════════════════════════════════════════════════════ */

window._simStep = function (to, action) {
  const from = sim.getCurrentState();
  graph.animateEdge(from, to, () => {
    sim.stepSimulation(to, action);
    render();
  });
};

window._stopSim = function () {
  sim.stopSimulation();
  render();
};

/* ═══════════════════════════════════════════════════════════
   ANALYSIS PANEL RENDERING
   ═══════════════════════════════════════════════════════════ */

function renderAnalysis() {
  const out = document.getElementById('analysis-output');
  if (!analysisResult) {
    out.innerHTML = '<p style="color:var(--text-muted);font-size:.82rem">Click "Analyze FSM" to validate.</p>';
    return;
  }
  const r = analysisResult;
  let html = `<div class="badge ${r.valid ? 'valid' : 'invalid'}">${r.valid ? '✓ Valid FSM' : '✗ Invalid FSM'}</div>`;
  html += `<div class="result-section"><h3>Dead-End States</h3><span class="count">${r.deadEnds.length} found</span><div class="chip-list">${r.deadEnds.map(s => `<span class="chip dead">${s}</span>`).join('') || '<span class="chip ok">None</span>'}</div></div>`;
  html += `<div class="result-section"><h3>Unreachable States</h3><span class="count">${r.unreachable.length} found</span><div class="chip-list">${r.unreachable.map(s => `<span class="chip unreachable">${s}</span>`).join('') || '<span class="chip ok">None</span>'}</div></div>`;

  const simState = sim.getSimState();
  if (simState.active) {
    html += `<div class="result-section"><h3>Simulation</h3><p style="font-size:.8rem">Current: <strong>${simState.current}</strong></p>`;
    const trans = fsm.transitions.filter(t => t.from === simState.current);
    if (trans.length) {
      html += `<div class="sim-actions">${trans.map(t => `<button onclick="window._simStep('${t.to}','${t.action}')">${t.action} → ${t.to}</button>`).join('')}</div>`;
    } else {
      html += `<div class="stuck-warn">⚠ STUCK — No transitions available</div>`;
    }
    html += `<div class="sim-trace">${simState.trace.map(s => `<div class="step">${s}</div>`).join('')}</div>`;
    html += `<button class="danger full" onclick="window._stopSim()">■ Stop Simulation</button></div>`;
  }
  out.innerHTML = html;
}

/* ═══════════════════════════════════════════════════════════
   MODAL HANDLERS
   ═══════════════════════════════════════════════════════════ */

document.getElementById('modal-close').onclick = () =>
  document.getElementById('modal-overlay').classList.add('hidden');

document.getElementById('modal-copy').onclick = () => {
  navigator.clipboard.writeText(document.getElementById('modal-content').textContent);
  document.getElementById('modal-copy').textContent = 'Copied!';
  setTimeout(() => document.getElementById('modal-copy').textContent = 'Copy to Clipboard', 1500);
};

document.getElementById('modal-overlay').onclick = e => {
  if (e.target === document.getElementById('modal-overlay'))
    document.getElementById('modal-overlay').classList.add('hidden');
};

/* ═══════════════════════════════════════════════════════════
   NODE DRAG RE-RENDER
   ═══════════════════════════════════════════════════════════ */

window.addEventListener('node-dragged', () => render());

/* ═══════════════════════════════════════════════════════════
   BOOT
   ═══════════════════════════════════════════════════════════ */

init();
