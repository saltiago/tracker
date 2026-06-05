// ── STATE ──
let program = [];
let exerciseList = []; // flat ordered list
let sessionSets = [];  // all sets logged this session
let history = {};      // exerciseId -> last sets

let currentExIdx = 0;  // index in exerciseList
let currentRound = 1;
let currentField = 'reps'; // 'reps' | 'weight'
let pendingReps = null;
let stateHistory = []; // for back button

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  program = getProgram();
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
  if (stateHistory.length === 0) return;
  const prev = stateHistory.pop();
  if (stateHistory.length === 0) {
    document.getElementById('back-btn').classList.add('hidden');
  }
  applyState(prev);
}

function applyState(state) {
  currentExIdx = state.exIdx;
  currentRound = state.round;
  currentField = state.field;
  pendingReps  = state.pendingReps;
  // restore session sets to the snapshot
  sessionSets  = state.sessionSets.slice();

  const ex = exerciseList[currentExIdx];
  if (ex.type === 'check') {
    renderCheck(ex);
  } else {
    renderExercise(ex, state.field);
  }
}

// ── SESSION START ──
function startSession() {
  sessionSets = [];
  stateHistory = [];
  currentRound = 1;
  currentExIdx = 0;
  // preload history
  history = {};
  exerciseList.forEach(ex => {
    history[ex.id] = getLastSets(ex.id);
  });
  document.getElementById('back-btn').classList.remove('hidden');
  goToExercise(0, 'reps');
}

// ── NAVIGATE TO EXERCISE ──
function goToExercise(idx, field) {
  currentExIdx = idx;
  currentField = field;
  const ex = exerciseList[idx];
  if (ex.type === 'check') {
    renderCheck(ex);
  } else {
    renderExercise(ex, field);
  }
}

// ── RENDER WEIGHTED EXERCISE ──
function renderExercise(ex, field) {
  document.getElementById('ex-name').textContent = ex.name;

  // count how many sets logged for this exercise this round
  const setsThisRound = sessionSets.filter(
    s => s.exerciseId === ex.id && s.round === currentRound && !s.skipped
  ).length;
  document.getElementById('ex-set-label').textContent =
    `round ${currentRound}  ·  set ${setsThisRound + 1}`;

  // last session ghost
  const last = history[ex.id];
  if (last && last.length > 0) {
    const lastSet = last[Math.min(setsThisRound, last.length - 1)];
    document.getElementById('ex-last').textContent =
      `last: ${lastSet.weight} × ${lastSet.reps}`;
  } else {
    document.getElementById('ex-last').textContent = '';
  }

  const repsField   = document.getElementById('field-reps');
  const weightField = document.getElementById('field-weight');
  const repsInput   = document.getElementById('input-reps');
  const weightInput = document.getElementById('input-weight');

  // reset inputs
  repsInput.value   = '';
  weightInput.value = '';

  if (field === 'reps') {
    repsField.classList.remove('hidden');
    weightField.classList.add('hidden');
    pendingReps = null;
  } else {
    repsField.classList.add('hidden');
    weightField.classList.remove('hidden');
  }

  show('screen-exercise');

  // focus after a tick so mobile keyboard opens
  setTimeout(() => {
    if (field === 'reps') repsInput.focus();
    else weightInput.focus();
  }, 80);


}

function confirmReps() {
  const val = document.getElementById('input-reps').value.trim();
  if (!val) return;
  pendingReps = val;

  // save state for back
  pushState({
    exIdx: currentExIdx, round: currentRound,
    field: 'reps', pendingReps: null,
    sessionSets: sessionSets.slice()
  });

  currentField = 'weight';
  const ex = exerciseList[currentExIdx];
  renderExercise(ex, 'weight');
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
    skipped: false
  });

  advance();
}

// ── RENDER CHECK EXERCISE ──
function renderCheck(ex) {
  document.getElementById('check-name').textContent = ex.name;
  document.getElementById('check-set-label').textContent = `round ${currentRound}`;
  const area = document.querySelector('.check-area');
  area.classList.remove('done');
  document.querySelector('.check-tap').textContent = 'tap';
  show('screen-check');
}

function completeCheck() {
  const area = document.querySelector('.check-area');
  area.classList.add('done');
  document.querySelector('.check-tap').textContent = '✓';
  const ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, check: true, skipped: false });
  setTimeout(() => advance(), 320);
}

// ── SAME / SKIP ──
function fillSame() {
  const ex = exerciseList[currentExIdx];
  const last = history[ex.id];
  if (!last || !last.length) return;

  const setsLogged = sessionSets.filter(
    s => s.exerciseId === ex.id && s.round === currentRound && !s.skipped
  ).length;
  const lastSet = last[Math.min(setsLogged, last.length - 1)];

  if (currentField === 'reps') {
    document.getElementById('input-reps').value = lastSet.reps;
  } else {
    document.getElementById('input-weight').value = lastSet.weight;
  }
}

function skipExercise() {
  const ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, skipped: true });
  advance();
}

// ── ADVANCE ──
function advance() {
  const nextIdx = currentExIdx + 1;
  if (nextIdx >= exerciseList.length) {
    // end of round
    showRoundEnd();
  } else {
    pushState({
      exIdx: currentExIdx, round: currentRound,
      field: currentField, pendingReps,
      sessionSets: sessionSets.slice()
    });
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
  stateHistory = [];
  goToExercise(0, 'reps');
}

// ── FINISH SESSION ──
function finishSession() {
  if (sessionSets.length > 0) {
    saveSession(sessionSets);
  }

  // build summary
  const weighted = sessionSets.filter(s => !s.skipped && s.weight);
  const checks   = sessionSets.filter(s => !s.skipped && s.check);
  const skips    = sessionSets.filter(s => s.skipped);

  let summary = `${currentRound} round${currentRound > 1 ? 's' : ''}`;
  summary += `  ·  ${weighted.length} sets logged`;
  if (checks.length)  summary += `  ·  ${checks.length} checks`;
  if (skips.length)   summary += `  ·  ${skips.length} skipped`;

  document.getElementById('done-summary').textContent = summary;
  document.getElementById('back-btn').classList.add('hidden');
  show('screen-done');
}

function resetToStart() {
  sessionSets = [];
  stateHistory = [];
  currentRound = 1;
  currentExIdx = 0;
  document.getElementById('back-btn').classList.add('hidden');
  show('screen-start');
}
