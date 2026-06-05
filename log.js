// ── STATE ──
let program     = [];
let exerciseList = [];
let sessionSets  = [];
let history      = {};

let currentExIdx  = 0;
let currentRound  = 1;
let currentField  = 'reps'; // 'reps' | 'weight' | 'seconds'
let currentType   = 'weighted';
let currentMod    = 'bw';
let pendingReps   = null;
let stateHistory  = [];
let advanceTimer  = null;
const ADVANCE_DELAY = 800; // ms after last keystroke before auto-advancing

// ── INIT ──
window.addEventListener('DOMContentLoaded', () => {
  program      = getProgram();
  exerciseList = program.flatMap(p => p.exercises);
  setupAutoAdvance();
  show('screen-start');
});

// ── AUTO-ADVANCE (debounce) ──
function clearAdvance() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
}

function setupAutoAdvance() {
  const reps    = document.getElementById('input-reps');
  const weight  = document.getElementById('input-weight');
  const seconds = document.getElementById('input-seconds');

  reps.addEventListener('input', () => {
    clearAdvance();
    if (reps.value.trim()) advanceTimer = setTimeout(confirmReps, ADVANCE_DELAY);
  });
  weight.addEventListener('input', () => {
    clearAdvance();
    if (weight.value.trim()) advanceTimer = setTimeout(confirmWeight, ADVANCE_DELAY);
  });
  seconds.addEventListener('input', () => {
    clearAdvance();
    if (seconds.value.trim()) advanceTimer = setTimeout(confirmSeconds, ADVANCE_DELAY);
  });
}

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
  clearAdvance();
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

// ── RENDER EXERCISE ──
function renderExercise(ex, field) {
  clearAdvance();
  currentType = ex.type;

  document.getElementById('ex-name').textContent = ex.name;
  const setsThisRound = sessionSets.filter(
    s => s.exerciseId === ex.id && s.round === currentRound && !s.skipped
  ).length;
  document.getElementById('ex-set-label').textContent =
    'round ' + currentRound + '  \u00b7  set ' + (setsThisRound + 1);

  // ghost
  const last = history[ex.id];
  if (last && last.length) {
    const ls = last[Math.min(setsThisRound, last.length - 1)];
    let ghost = 'last: ';
    if (ls.seconds !== undefined)             ghost += ls.seconds + 's';
    else if (ls.weight)                       ghost += ls.weight + ' x ' + ls.reps;
    else                                      ghost += ls.reps + ' reps';
    if (ls.modifier && ls.modifier !== 'weighted') ghost += ' (' + ls.modifier + ')';
    document.getElementById('ex-last').textContent = ghost;
  } else {
    document.getElementById('ex-last').textContent = '';
  }

  hideAll();
  document.getElementById('input-reps').value    = '';
  document.getElementById('input-weight').value  = '';
  document.getElementById('input-seconds').value = '';

  if (ex.type === 'timed') {
    document.getElementById('field-seconds').classList.remove('hidden');
    show('screen-exercise');
    setTimeout(function() { document.getElementById('input-seconds').focus(); }, 80);

  } else if (ex.type === 'bodyweight') {
    document.getElementById('field-modifier').classList.remove('hidden');
    document.getElementById('input-modifier').value = currentMod;
    if (field === 'weight') {
      document.getElementById('field-weight').classList.remove('hidden');
    } else {
      document.getElementById('field-reps').classList.remove('hidden');
    }
    show('screen-exercise');
    setTimeout(function() {
      if (field === 'reps') document.getElementById('input-reps').focus();
      else document.getElementById('input-weight').focus();
    }, 80);

  } else {
    // weighted
    if (field === 'weight') {
      document.getElementById('field-weight').classList.remove('hidden');
    } else {
      document.getElementById('field-reps').classList.remove('hidden');
    }
    show('screen-exercise');
    setTimeout(function() {
      if (field === 'reps') document.getElementById('input-reps').focus();
      else document.getElementById('input-weight').focus();
    }, 80);
  }
}

function hideAll() {
  ['field-modifier','field-reps','field-weight','field-seconds'].forEach(function(id) {
    document.getElementById(id).classList.add('hidden');
  });
}

// ── MODIFIER CHANGE ──
function onModifierChange() {
  currentMod = document.getElementById('input-modifier').value;
  document.getElementById('input-reps').value   = '';
  document.getElementById('input-weight').value = '';
  document.getElementById('field-reps').classList.remove('hidden');
  document.getElementById('field-weight').classList.add('hidden');
  setTimeout(function() { document.getElementById('input-reps').focus(); }, 80);
}

// ── CONFIRM REPS ──
function confirmReps() {
  clearAdvance();
  var val = document.getElementById('input-reps').value.trim();
  if (!val) return;
  pendingReps = val;

  var ex = exerciseList[currentExIdx];
  var needsWeight = (ex.type === 'weighted') || (ex.type === 'bodyweight' && currentMod === 'weighted');

  if (needsWeight) {
    pushState({
      exIdx: currentExIdx, round: currentRound,
      field: 'reps', mod: currentMod, pendingReps: null,
      sessionSets: sessionSets.slice()
    });
    currentField = 'weight';
    hideAll();
    if (ex.type === 'bodyweight') document.getElementById('field-modifier').classList.remove('hidden');
    document.getElementById('field-weight').classList.remove('hidden');
    document.getElementById('input-weight').value = '';
    setTimeout(function() { document.getElementById('input-weight').focus(); }, 80);
  } else {
    // BW / assisted — reps only
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

// ── CONFIRM WEIGHT ──
function confirmWeight() {
  clearAdvance();
  var val = document.getElementById('input-weight').value.trim();
  if (!val) return;
  var ex = exerciseList[currentExIdx];
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

// ── CONFIRM SECONDS ──
function confirmSeconds() {
  clearAdvance();
  var val = document.getElementById('input-seconds').value.trim();
  if (!val) return;
  var ex = exerciseList[currentExIdx];
  sessionSets.push({
    exerciseId: ex.id,
    round: currentRound,
    seconds: val,
    skipped: false
  });
  advance();
}

// ── MANUAL ARROW ──
function manualAdvance() {
  clearAdvance();
  var ex = exerciseList[currentExIdx];
  if (!ex || ex.type === 'check') { skipExercise(); return; }

  if (currentType === 'timed') {
    var sv = document.getElementById('input-seconds').value.trim();
    if (sv) confirmSeconds(); else skipExercise();
  } else if (currentField === 'weight') {
    var wv = document.getElementById('input-weight').value.trim();
    if (wv) confirmWeight(); else skipExercise();
  } else {
    var rv = document.getElementById('input-reps').value.trim();
    if (rv) confirmReps(); else skipExercise();
  }
}

// ── RENDER CHECK ──
function renderCheck(ex) {
  document.getElementById('check-name').textContent = ex.name;
  document.getElementById('check-set-label').textContent = 'round ' + currentRound;
  document.querySelector('.check-area').classList.remove('done');
  document.querySelector('.check-tap').textContent = 'tap';
  show('screen-check');
}

function completeCheck() {
  document.querySelector('.check-area').classList.add('done');
  document.querySelector('.check-tap').textContent = '\u2713';
  var ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, check: true, skipped: false });
  setTimeout(function() { advance(); }, 320);
}

// ── SAME ──
function fillSame() {
  var ex  = exerciseList[currentExIdx];
  var last = history[ex.id];
  if (!last || !last.length) return;
  var setsLogged = sessionSets.filter(function(s) {
    return s.exerciseId === ex.id && s.round === currentRound && !s.skipped;
  }).length;
  var ls = last[Math.min(setsLogged, last.length - 1)];

  if (currentType === 'timed') {
    document.getElementById('input-seconds').value = ls.seconds || '';
  } else if (currentField === 'weight') {
    document.getElementById('input-weight').value = ls.weight || '';
  } else {
    document.getElementById('input-reps').value = ls.reps || '';
  }
}

// ── SKIP ──
function skipExercise() {
  clearAdvance();
  var ex = exerciseList[currentExIdx];
  sessionSets.push({ exerciseId: ex.id, round: currentRound, skipped: true });
  advance();
}

// ── END WORKOUT (save or discard) ──
function endWorkout() {
  document.getElementById('end-popup').classList.remove('hidden');
}
function endSave() {
  document.getElementById('end-popup').classList.add('hidden');
  finishSession(true);
}
function endDiscard() {
  document.getElementById('end-popup').classList.add('hidden');
  resetToStart();
}
function endCancel() {
  document.getElementById('end-popup').classList.add('hidden');
}

// ── ADVANCE ──
function advance() {
  var nextIdx = currentExIdx + 1;
  if (nextIdx >= exerciseList.length) {
    showRoundEnd();
  } else {
    pushState({
      exIdx: currentExIdx, round: currentRound,
      field: currentField, mod: currentMod, pendingReps: pendingReps,
      sessionSets: sessionSets.slice()
    });
    currentMod = 'bw';
    goToExercise(nextIdx, 'reps');
  }
}

// ── ROUND END ──
function showRoundEnd() {
  document.getElementById('round-end-label').textContent = 'round ' + currentRound + ' complete';
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
function finishSession(save) {
  if (save && sessionSets.length) saveSession(sessionSets);
  var weighted = sessionSets.filter(function(s) { return !s.skipped && s.weight; });
  var bwSets   = sessionSets.filter(function(s) { return !s.skipped && s.reps && !s.weight; });
  var timed    = sessionSets.filter(function(s) { return !s.skipped && s.seconds; });
  var checks   = sessionSets.filter(function(s) { return !s.skipped && s.check; });
  var skips    = sessionSets.filter(function(s) { return s.skipped; });

  var total   = weighted.length + bwSets.length + timed.length;
  var summary = currentRound + ' round' + (currentRound > 1 ? 's' : '');
  summary += '  \u00b7  ' + total + ' sets logged';
  if (checks.length) summary += '  \u00b7  ' + checks.length + ' checks';
  if (skips.length)  summary += '  \u00b7  ' + skips.length + ' skipped';
  if (!save)         summary  = 'session discarded';

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
