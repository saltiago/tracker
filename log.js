// ── STATE ──
let program      = [];
let exerciseList = [];
let sessionSets  = [];
let history      = {};

let currentExIdx = 0;
let currentRound = 1;
let currentMod   = 'bw';
let stateHistory = [];   // back stack: {exIdx, round, sessionSetsBefore, entered}
let advanceTimer = null;
const ADVANCE_DELAY = 800;

// ── INIT ──
window.addEventListener('DOMContentLoaded', function() {
  program      = getProgram();
  exerciseList = program.flatMap(function(p) { return p.exercises; });
  setupAutoAdvance();
  show('screen-start');
});

// ── ROUND LABEL HELPER ──
function roundLabel() {
  return currentRound === 0 ? 'warmup' : 'round ' + currentRound;
}

// ── FIELD VALUE HELPERS ──
function repsVal()    { return document.getElementById('input-reps').value.trim(); }
function weightVal()  { return document.getElementById('input-weight').value.trim(); }
function secondsVal() { return document.getElementById('input-seconds').value.trim(); }
function band1Val()   { return document.getElementById('input-band1').value; }
function band2Val()   { return document.getElementById('input-band2').value; }

// ── AUTO-ADVANCE (debounce) ──
function clearAdvance() {
  if (advanceTimer) { clearTimeout(advanceTimer); advanceTimer = null; }
}

function setupAutoAdvance() {
  ['input-reps','input-weight','input-seconds'].forEach(function(id) {
    document.getElementById(id).addEventListener('input', function() {
      clearAdvance();
      advanceTimer = setTimeout(maybeAutoAdvance, ADVANCE_DELAY);
    });
  });
}

function requiredFilled() {
  var ex = exerciseList[currentExIdx];
  if (ex.type === 'timed')  return !!secondsVal();
  if (ex.type === 'check')  return false; // committed by tap
  if (ex.type === 'bodyweight') {
    if (currentMod === 'weighted') return !!(repsVal() && weightVal());
    return !!repsVal();
  }
  if (ex.type === 'band') return !!repsVal();
  // weighted
  return !!(repsVal() && weightVal());
}

function maybeAutoAdvance() {
  if (requiredFilled()) commitAndAdvance();
}

// ── SCREEN MANAGEMENT ──
function show(id) {
  document.querySelectorAll('.screen').forEach(function(s) { s.classList.add('hidden'); });
  document.getElementById(id).classList.remove('hidden');

  // toggle end button on active session screens
  var active = ['screen-exercise','screen-check','screen-round-end'].indexOf(id) !== -1;
  document.getElementById('end-btn').classList.toggle('hidden', !active);

  // dismiss keyboard when changing screens (no autofocus anywhere)
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

// ── SESSION START ──
function startSession() {
  sessionSets  = [];
  stateHistory = [];
  currentRound = 0;  // 0 = warmup
  currentExIdx = 0;
  currentMod   = 'bw';
  history = {};  // cleared; ghost now queried live per exercise + round
  renderCurrent();
}

// ── RENDER CURRENT EXERCISE ──
function renderCurrent(prefill) {
  var ex = exerciseList[currentExIdx];
  if (ex.type === 'check') renderCheck(ex, prefill);
  else renderExercise(ex, prefill);
}

function renderExercise(ex, prefill) {
  clearAdvance();
  prefill = prefill || {};
  // pre-populate modifier from last session if no prefill and no current mod set
  if (prefill.modifier) {
    currentMod = prefill.modifier;
  } else if (ex.type === 'bodyweight') {
    var lastRef0 = getLastSetForRound(ex.id, currentRound);
    if (lastRef0 && lastRef0.set.modifier) currentMod = lastRef0.set.modifier;
    else currentMod = currentMod || 'bw';
  }

  // meta
  document.getElementById('ex-name').textContent = ex.name;
  document.getElementById('ex-set-label').textContent = roundLabel();

  // ghost — round-specific: shows what you did in this exact round last session
  var lastRef = getLastSetForRound(ex.id, currentRound);
  if (lastRef) {
    var ls = lastRef.set;
    var fr    = lastRef.fromRound;
    var ghost = fr !== currentRound
      ? (fr === 0 ? 'last warmup: ' : 'last r' + fr + ': ')
      : (fr === 0 ? 'last warmup: ' : 'last: ');
    if (ls.seconds !== undefined)                     ghost += ls.seconds + 's';
    else if (ls.weight)                               ghost += ls.weight + ' lbs × ' + ls.reps;
    else                                              ghost += ls.reps + ' reps';
    if (ls.modifier && ls.modifier !== 'weighted')    ghost += ' (' + ls.modifier + ')';
    document.getElementById('ex-last').textContent = ghost;
  } else {
    document.getElementById('ex-last').textContent = '';
  }

  // reset + prefill fields
  hideAll();
  document.getElementById('input-reps').value    = prefill.reps    || '';
  document.getElementById('input-weight').value  = prefill.weight  || '';
  document.getElementById('input-seconds').value = prefill.seconds || '';

  if (ex.type === 'timed') {
    document.getElementById('field-seconds').classList.remove('hidden');

  } else if (ex.type === 'bodyweight') {
    document.getElementById('field-modifier').classList.remove('hidden');
    document.getElementById('input-modifier').value = currentMod;
    document.getElementById('field-reps').classList.remove('hidden');
    if (currentMod === 'weighted') document.getElementById('field-weight').classList.remove('hidden');

  } else if (ex.type === 'band') {
    document.getElementById('field-band1').classList.remove('hidden');
    document.getElementById('field-band2').classList.remove('hidden');
    document.getElementById('field-reps').classList.remove('hidden');
    // prefill band selects — from prefill, then last session
    var lastBandRef = getLastSetForRound(ex.id, currentRound);
    var lastBand = lastBandRef ? lastBandRef.set : null;
    document.getElementById('input-band1').value = prefill.band1 !== undefined ? prefill.band1 : (lastBand && lastBand.band1 || '');
    document.getElementById('input-band2').value = prefill.band2 !== undefined ? prefill.band2 : (lastBand && lastBand.band2 || '');

  } else {
    // weighted — reps AND weight on one screen
    document.getElementById('field-reps').classList.remove('hidden');
    document.getElementById('field-weight').classList.remove('hidden');
  }

  show('screen-exercise');  // no autofocus — user taps the field
}

function hideAll() {
  ['field-modifier','field-reps','field-weight','field-seconds','field-band1','field-band2'].forEach(function(id) {
    document.getElementById(id).classList.add('hidden');
  });
}

// ── MODIFIER CHANGE (bodyweight) ──
function onModifierChange() {
  currentMod = document.getElementById('input-modifier').value;
  // re-render preserving any reps already typed; no autofocus
  renderExercise(exerciseList[currentExIdx], { reps: repsVal(), modifier: currentMod });
}

// ── RENDER CHECK ──
function renderCheck(ex, prefill) {
  clearAdvance();
  document.getElementById('check-name').textContent = ex.name;
  document.getElementById('check-set-label').textContent = roundLabel();
  document.querySelector('.check-area').classList.remove('done');
  document.querySelector('.check-tap').textContent = 'tap';
  show('screen-check');
}

function completeCheck() {
  document.querySelector('.check-area').classList.add('done');
  document.querySelector('.check-tap').textContent = '\u2713';
  setTimeout(commitAndAdvance, 300);
}

// ── SAME (fill from last session) ──
function fillSame() {
  var ex = exerciseList[currentExIdx];
  var lastRef = getLastSetForRound(ex.id, currentRound);
  if (!lastRef) return;
  var ls = lastRef.set;

  if (ex.type === 'timed') {
    document.getElementById('input-seconds').value = ls.seconds || '';
  } else if (ex.type === 'band') {
    document.getElementById('input-band1').value = ls.band1 || '';
    document.getElementById('input-band2').value = ls.band2 || '';
    document.getElementById('input-reps').value  = ls.reps  || '';
  } else {
    document.getElementById('input-reps').value   = ls.reps   || '';
    document.getElementById('input-weight').value = ls.weight || '';
  }
}

// ── SKIP ──
function skipExercise() {
  clearAdvance();
  var ex = exerciseList[currentExIdx];
  pushBack({});
  sessionSets.push({ exerciseId: ex.id, round: currentRound, skipped: true });
  currentMod = 'bw';
  goNext();
}

// ── MANUAL ARROW → (commit whatever is present) ──
function manualAdvance() {
  commitAndAdvance();
}

// ── COMMIT CURRENT EXERCISE + ADVANCE ──
function commitAndAdvance() {
  clearAdvance();
  var ex = exerciseList[currentExIdx];

  var entered = {
    reps:     repsVal(),
    weight:   weightVal(),
    seconds:  secondsVal(),
    modifier: currentMod,
    band1:    band1Val(),
    band2:    band2Val()
  };

  var set = { exerciseId: ex.id, round: currentRound, skipped: false };
  var meaningful = false;

  if (ex.type === 'timed') {
    if (entered.seconds) { set.seconds = entered.seconds; meaningful = true; }
  } else if (ex.type === 'band') {
    if (entered.reps) {
      set.reps = entered.reps;
      if (entered.band1) set.band1 = entered.band1;
      if (entered.band2) set.band2 = entered.band2;
      meaningful = true;
    }
  } else if (ex.type === 'check') {
    set.check = true; meaningful = true;
  } else if (ex.type === 'bodyweight') {
    if (entered.reps) {
      set.reps = entered.reps;
      set.modifier = currentMod;
      if (currentMod === 'weighted' && entered.weight) set.weight = entered.weight;
      meaningful = true;
    }
  } else { // weighted
    if (entered.reps && entered.weight) {
      set.reps = entered.reps; set.weight = entered.weight; meaningful = true;
    } else if (entered.reps) {
      set.reps = entered.reps; meaningful = true;
    }
  }

  if (!meaningful) set.skipped = true;

  pushBack(entered);
  sessionSets.push(set);
  currentMod = 'bw';
  goNext();
}

// ── BACK STACK ──
function pushBack(entered) {
  stateHistory.push({
    exIdx: currentExIdx,
    round: currentRound,
    sessionSetsBefore: sessionSets.slice(),
    entered: entered
  });
}

function goBack() {
  clearAdvance();
  if (!stateHistory.length) return;
  var s = stateHistory.pop();
  currentExIdx = s.exIdx;
  currentRound = s.round;
  currentMod   = (s.entered && s.entered.modifier) || 'bw';
  sessionSets  = s.sessionSetsBefore.slice();
  renderCurrent(s.entered);  // restores previously typed values
}

// ── ADVANCE TO NEXT EXERCISE / ROUND END ──
function goNext() {
  var ni = currentExIdx + 1;
  if (ni >= exerciseList.length) {
    showRoundEnd();
  } else {
    currentExIdx = ni;
    renderCurrent();
  }
}

// ── ROUND END ──
function showRoundEnd() {
  var endLabel = currentRound === 0 ? 'warmup complete' : 'round ' + currentRound + ' complete';
  document.getElementById('round-end-label').textContent = endLabel;
  show('screen-round-end');
}

function nextRound() {
  currentRound = currentRound === 0 ? 1 : currentRound + 1;
  currentExIdx = 0;
  currentMod   = 'bw';
  stateHistory = [];
  renderCurrent();
}

// ── EDIT EXERCISE POPUP ──
var editingExIdx = null;
var editingSelectedType = null;
var TYPES = ['weighted','bodyweight','timed','check','band'];
var TYPE_LABELS = { weighted:'wt', bodyweight:'bw', timed:'time', check:'check', band:'band' };

function openEditExercise() {
  editingExIdx = currentExIdx;
  var ex = exerciseList[editingExIdx];
  editingSelectedType = ex.type;

  document.getElementById('edit-ex-name').value = ex.name;
  renderTypeButtons();
  document.getElementById('edit-ex-popup').classList.remove('hidden');
}

function renderTypeButtons() {
  var row = document.getElementById('edit-ex-types');
  row.innerHTML = '';
  TYPES.forEach(function(t) {
    var btn = document.createElement('button');
    btn.className = 'popup-type-btn' + (t === editingSelectedType ? ' selected' : '');
    btn.textContent = TYPE_LABELS[t];
    btn.onclick = function() {
      editingSelectedType = t;
      renderTypeButtons();
    };
    row.appendChild(btn);
  });
}

function closeEditExercise() {
  document.getElementById('edit-ex-popup').classList.add('hidden');
  editingExIdx = null;
}

function saveEditExercise() {
  if (editingExIdx === null) return;
  var newName = document.getElementById('edit-ex-name').value.trim();
  if (!newName) return;

  // Update in-memory exerciseList
  exerciseList[editingExIdx].name = newName;
  exerciseList[editingExIdx].type = editingSelectedType;

  // Update program and persist
  var prog = getProgram();
  var flat = prog.flatMap(function(p) { return p.exercises; });
  var target = flat.find(function(e) { return e.id === exerciseList[editingExIdx].id; });
  if (target) {
    target.name = newName;
    target.type = editingSelectedType;
    saveProgram(prog);
  }

  closeEditExercise();
  // Re-render current screen with updated info, preserving entered values
  var entered = {
    reps: repsVal(), weight: weightVal(), seconds: secondsVal(),
    modifier: currentMod, band1: band1Val(), band2: band2Val()
  };
  renderCurrent(entered);
}

// ── WARMUP POPUP ──
function onRoundLabelTap() {
  if (currentRound === 0) {
    document.getElementById('warmup-popup').classList.remove('hidden');
  }
}
function closeWarmupPopup() {
  document.getElementById('warmup-popup').classList.add('hidden');
}
function skipWarmup() {
  closeWarmupPopup();
  clearAdvance();
  // discard any warmup sets already logged this round and jump to round 1
  sessionSets = sessionSets.filter(function(s) { return s.round !== 0; });
  stateHistory = [];
  currentRound = 1;
  currentExIdx = 0;
  currentMod   = 'bw';
  renderCurrent();
}

// ── END WORKOUT (save / discard) ──
function endWorkout()  { document.getElementById('end-popup').classList.remove('hidden'); }
function endSave()     { document.getElementById('end-popup').classList.add('hidden'); finishSession(true); }
function endDiscard()  { document.getElementById('end-popup').classList.add('hidden'); resetToStart(); }
function endCancel()   { document.getElementById('end-popup').classList.add('hidden'); }

// ── FINISH ──
function finishSession(save) {
  if (save && sessionSets.length) saveSession(sessionSets);

  var weighted = sessionSets.filter(function(s) { return !s.skipped && s.weight; });
  var bwSets   = sessionSets.filter(function(s) { return !s.skipped && s.reps && !s.weight; });
  var timed    = sessionSets.filter(function(s) { return !s.skipped && s.seconds; });
  var checks   = sessionSets.filter(function(s) { return !s.skipped && s.check; });
  var skips    = sessionSets.filter(function(s) { return s.skipped; });

  var total   = weighted.length + bwSets.length + timed.length;
  var workRounds = currentRound === 0 ? 0 : currentRound;
  var hasWarmup  = sessionSets.some(function(s) { return s.round === 0 && !s.skipped; });
  var summary    = (hasWarmup ? 'warmup + ' : '') +
                   workRounds + ' round' + (workRounds !== 1 ? 's' : '');
  summary += '  \u00b7  ' + total + ' sets logged';
  if (checks.length) summary += '  \u00b7  ' + checks.length + ' checks';
  if (skips.length)  summary += '  \u00b7  ' + skips.length + ' skipped';
  if (!save)         summary  = 'session discarded';

  document.getElementById('done-summary').textContent = summary;
  show('screen-done');
}

function resetToStart() {
  sessionSets  = [];
  stateHistory = [];
  currentRound = 0;
  currentExIdx = 0;
  currentMod   = 'bw';
  show('screen-start');
}
