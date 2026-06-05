// ── STATE ──
let program     = [];
let exerciseList = [];
let sessionSets  = [];
let history      = {};

let currentExIdx  = 0;
let currentRound  = 1;
let currentField  = 'reps'; // 'reps' | 'weight' | 'seconds'
let currentType   = 'weighted'; // exercise type at render time
let currentMod    = 'bw';       // bodyweight modifier
let pendingReps   = null;
let stateHistory  = [];

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  program      = getProgram();
  exerciseList = program.flatMap(p => p.exercises);
  show('screen-start');
});

// ── SCREEN MANAGEMENT ──
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function pushState(state) {
  stateHistory.push(state);
  document.getElementById('back-btn').classList.remove('hidden');
}

function goBack() {
  if (!stateHistory.length) return;
  const prev = stateHistory.pop();
  if (!stateHistory.length) document.getElementById('back-btn').classList.add('hidden');
  applyState(prev);
}

function applyState(state) {
  currentExIdx = state.exIdx;
  currentRound = state.round;
  currentField = state.field;
  currentMod   = state.mod || 'bw';
  pendingReps  = state.pendingReps;
  sessionSets  = state.sessionSets.slice();
  const ex = exerciseList[currentExIdx];
  if (ex.type === 'check') renderCheck(ex);
  else renderExercise(ex, state.field);
}

// ── SESSION START ──
function startSession() {
  sessionSets  = [];
  stateHistory = [];
  currentRound = 1;
  currentExIdx = 0;
  history = {};
  exerciseList.forEach(ex => { history[ex.id] = getLastSets(ex.id); });
  document.getElementById('back-btn').classList.remove('hidden');
  goToExercise(0, 'reps');
}

// ── NAVIGATE ──
function goToExercise(idx, field) {
  currentExIdx = idx;
  currentField = field;
  const ex = exerciseList[idx];
  if (ex.type === 'check') renderCheck(ex);
  else renderExercise(ex, field);
}

// ── RENDER EXERCISE (weighted / bodyweight / timed) ──
function renderExercise(ex, field) {
  currentType = ex.type;

  // meta
  document.getElementById('ex-name').textContent = ex.name;
  const setsThisRound = sessionSets.filter(
    s => s.exerciseId === ex.id && s.round === currentRound && !s.skipped
  ).length;
  document.getElementById('ex-set-label').textContent =
    `round ${currentRound}  ·  set ${setsThisRound + 1}`;

  // ghost
  const last = history[ex.id];
  if (last && last.length) {
    const ls = last[Math.min(setsThisRound, last.length - 1)];
    let ghost = 'last: ';
    if (ls.seconds !== undefined) ghost += `${ls.seconds}s`;
    else if (ls.weight)           ghost += `${ls.weight} × ${ls.reps}`;
    else                          ghost += `${ls.reps} reps`;
    if (ls.modifier && ls.modifier !== 'weighted') ghost += ` (${ls.modifier})`;
    document.getElementById('ex-last').textContent = ghost;
  } else {
    document.getElementById('ex-last').textContent = '';
  }

  // reset all fields
  hideAll();
  document.getElementById('input-reps').value    = '';
  document.getElementById('input-weight').value  = '';
  document.getElementById('input-seconds').value = '';

  if (ex.type === 'timed') {
    // ── TIMED ──
    document.getElementById('field-seconds').classList.remove('hidden');
    show('screen-exercise');
    setTimeout(() => document.getElementById('input-seconds').focus(), 80);

  } else if (ex.type === 'bodyweight') {
    // ── BODYWEIGHT ──
    document.getElementById('field-modifier').classList.remove('hidden');
    // restore modifier if re-rendering same exercise
    document.getElementById('input-modifier').value = currentMod;
    applyModifierVisibility(field);
    show('screen-exercise');
    // focus appropriate field
    setTimeout(() => {
      if (field === 'reps') document.getElementById('input-reps').focus();
      else if (field === 'weight') document.getElementById('input-weight').focus();
    }, 80);

  } else {
    // ── WEIGHTED ──
    if (field === 'reps') {
      document.getElementById('field-reps').classList.remove('hidden');
      show('screen-exercise');
      setTimeout(() => document.getElementById('input-reps').focus(), 80);
    } else {
      document.getElementById('field-weight').classList.remove('hidden');
      show('screen-exercise');
      setTimeout(() => document.getElementById('input-weight').focus(), 80);
    }
  }
}

function hideAll() {
  ['field-modifier','field-reps','field-weight','field-seconds'].forEach(id => {
    document.getElementById(id).classList.add('hidden');
  });
}

// ── MODIFIER LOGIC ──
function onModifierChange() {
  currentMod = document.getElementById('input-modifier').value;
  applyModifierVisibility('reps');
  document.getElementById('input-reps').value = '';
  document.getElementById('input-weight').value = '';
  setTimeout(() => document.getElementById('input-reps').focus(), 80);
}

function applyModifierVisibility(field) {
  const mod = document.getElementById('input-modifier').value;
  currentMod = mod;
  if (field === 'reps' || field === 'seconds') {
    document.getElementById('field-reps').classList.remove('hidden');
    document.getElementById('field-weight').classList.add('hidden');
  } else if (field === 'weight') {
    if (mod === 'weighted') {
      document.getElementById('field-reps').classList.add('hidden');
      document.getElementById('field-weight').classList.remove('hidden');
    } else {
      // BW / assisted: no weight field — shouldn't reach here, but safe fallback
      document.getElementById('field-reps').classList.remove('hidden');
    }
  }
}

// ── CONFIRM HANDLERS ──
function confirmReps() {
  const val = document.getElementById('input-reps').value.trim();
  if (!val) return;
  pendingReps = val;

  const ex = exerciseList[currentExIdx];

  if (ex.type === 'bodyweight' && currentMod === 'weighted') {
    // need weight next
    pushState({
      exIdx: currentExIdx, round: currentRound,
      field: 'reps', mod: currentMod, pendingReps: null,
      sessionSets: sessionSets.slice()
    });
    currentField = 'weight';
    hideAll();
    document.getElementById('field-modifier').classList.remove('hidden');
    document.getElementById('field-weight').classList.remove('hidden');
    document.getElementById('input-weight').value = '';
    setTimeout(() => document.getElementById('input-weight').focus(), 80);
  } else {
    // BW / assisted / plain bodyweight with no weight — log directly
    sessionSets.push({
      exerciseId: ex.id,
      round: currentRound,
      reps: pendingReps,
      modifier: currentMod,
      skipped: false
    });
    advance();
  }
}

function confirmWeight() {
  const val = document.getElementById('input-weight').value.trim();
  if (!val) return;
  const ex = exerciseList[currentExIdx];
  sessionSets.push({
    exerciseId: ex.id,
    round: currentRound,
    reps: pendingReps,
    weight: val,
    modifier: currentType === 'bodyweight' ? currentMod : undefined,
    skipped: false
  });
  advance();
}

function confirmSeconds() {
  const val = document.getElementById('input-seconds').value.trim();
  if (!val) return;
  const ex = exerciseList[currentExIdx];
  sessionSets.push({
    exerciseId: ex.id,
    round: currentRound,
    seconds: val,
    skipped: false
  });
  advance();
}

// manual → button: commit whatever is currently filled, or just advance if nothing
function manualAdvance() {
  const ex = exerciseList[currentExIdx];
  if (ex && ex.type === 'check') { skipExercise(); return; }

  if (currentType === 'timed') {
    const v = document.getElementById('input-seconds').value.trim();
    if (v) confirmSeconds(); else skipExercise();
  } else if (currentField === 'reps') {
    const v = document.getElementById('input-reps').value.trim();
    if (v) confirmReps(); else skipExercise();
  } else {
    const v = document.getElementById('input-weight').value.trim();
    if (v) confirmWeight(); else skipExercise();
  }
}

// ── RENDER CHECK ──
function renderCheck(ex) {
  document.getElementById('check-name').textContent = ex.name;
  document.getElementById('check-set-label').textContent = `round ${currentRound}`;
  document.querySelector('.check-area').classList.remove('done');
  document.querySelector('.check-tap').textContent = 'tap';
  show('screen-check');
}

function completeCheck() {
  document.querySelector('.check-area').classList.add('done');
  document.querySelector('.check-tap').textContent = '✓';
  const ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, check: true, skipped: false });
  setTimeout(() => advance(), 320);
}

// ── SAME ──
function fillSame() {
  const ex  = exerciseList[currentExIdx];
  const last = history[ex.id];
  if (!last || !last.length) return;
  const setsLogged = sessionSets.filter(
    s => s.exerciseId === ex.id && s.round === currentRound && !s.skipped
  ).length;
  const ls = last[Math.min(setsLogged, last.length - 1)];

  if (currentType === 'timed') {
    document.getElementById('input-seconds').value = ls.seconds || '';
  } else if (currentField === 'reps') {
    document.getElementById('input-reps').value = ls.reps || '';
  } else {
    document.getElementById('input-weight').value = ls.weight || '';
  }
}

// ── SKIP ──
function skipExercise() {
  const ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, skipped: true });
  advance();
}

// ── ADVANCE ──
function advance() {
  const nextIdx = currentExIdx + 1;
  if (nextIdx >= exerciseList.length) {
    showRoundEnd();
  } else {
    pushState({
      exIdx: currentExIdx, round: currentRound,
      field: currentField, mod: currentMod, pendingReps,
      sessionSets: sessionSets.slice()
    });
    currentMod = 'bw'; // reset modifier for next exercise
    goToExercise(nextIdx, 'reps');
  }
}

// ── ROUND END ──
function showRoundEnd() {
  document.getElementById('round-end-label').textContent = `round ${currentRound} complete`;
  show('screen-round-end');
  document.getElementById('back-btn').classList.remove('hidden');
}

function nextRound() {
  currentRound++;
  currentExIdx = 0;
  currentMod   = 'bw';
  stateHistory = [];
  goToExercise(0, 'reps');
}

// ── FINISH ──
function finishSession() {
  if (sessionSets.length) saveSession(sessionSets);
  const weighted = sessionSets.filter(s => !s.skipped && s.weight);
  const bwSets   = sessionSets.filter(s => !s.skipped && s.reps && !s.weight);
  const timed    = sessionSets.filter(s => !s.skipped && s.seconds);
  const checks   = sessionSets.filter(s => !s.skipped && s.check);
  const skips    = sessionSets.filter(s => s.skipped);

  let summary = `${currentRound} round${currentRound > 1 ? 's' : ''}`;
  const total = weighted.length + bwSets.length + timed.length;
  summary += `  ·  ${total} sets logged`;
  if (checks.length) summary += `  ·  ${checks.length} checks`;
  if (skips.length)  summary += `  ·  ${skips.length} skipped`;

  document.getElementById('done-summary').textContent = summary;
  document.getElementById('back-btn').classList.add('hidden');
  show('screen-done');
}

function resetToStart() {
  sessionSets  = [];
  stateHistory = [];
  currentRound = 1;
  currentExIdx = 0;
  currentMod   = 'bw';
  document.getElementById('back-btn').classList.add('hidden');
  show('screen-start');
}
