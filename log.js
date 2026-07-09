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
  if (ex.type === 'timed') {
    var sv = secondsVal();
    if (!sv) return false;
    if (ex.bilateral) return sv.indexOf('/') !== -1;  // need both L and R
    return true;
  }
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
function openStartPopup() {
  document.getElementById('start-popup').classList.remove('hidden');
}

function startSession(withWarmup) {
  document.getElementById('start-popup').classList.add('hidden');
  sessionSets  = [];
  stateHistory = [];
  currentRound = withWarmup ? 0 : 1;
  currentExIdx = 0;
  currentMod   = 'bw';
  history = {};  // cleared; ghost now queried live per exercise + round
  startWorkoutTimer();
  renderCurrent();
}

// ── WORKOUT TIMER (runs from start to end, no pause/reset) ──
var workoutTimerInterval = null;
var workoutStartTime = null;

function startWorkoutTimer() {
  workoutStartTime = Date.now();
  document.getElementById('header-wordmark').classList.add('hidden');
  document.getElementById('header-timer').classList.remove('hidden');
  document.getElementById('header-timer').textContent = '0:00';
  if (workoutTimerInterval) clearInterval(workoutTimerInterval);
  workoutTimerInterval = setInterval(updateWorkoutTimer, 1000);
}

function updateWorkoutTimer() {
  var elapsed = Math.floor((Date.now() - workoutStartTime) / 1000);
  var h = Math.floor(elapsed / 3600);
  var m = Math.floor((elapsed % 3600) / 60);
  var s = elapsed % 60;
  var text;
  if (h > 0) {
    text = h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  } else {
    text = m + ':' + String(s).padStart(2, '0');
  }
  document.getElementById('header-timer').textContent = text;
}

function stopWorkoutTimer() {
  if (workoutTimerInterval) { clearInterval(workoutTimerInterval); workoutTimerInterval = null; }
  document.getElementById('header-timer').classList.add('hidden');
  document.getElementById('header-wordmark').classList.remove('hidden');
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
    if (ls.secondsL !== undefined || ls.secondsR !== undefined) {
      ghost += (ls.secondsL !== undefined ? ls.secondsL : '?') + 's (L) / ' +
               (ls.secondsR !== undefined ? ls.secondsR : '?') + 's (R)';
    }
    else if (ls.seconds !== undefined)                ghost += ls.seconds + 's';
    else if (ls.weight)                               ghost += ls.weight + ' lbs × ' + ls.reps;
    else if (ls.band1 || ls.band2) {
      var gbands = [ls.band1, ls.band2].filter(Boolean).join(' + ');
      ghost += ls.reps + ' reps (' + gbands + ')';
    }
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
    if (ls.secondsL !== undefined || ls.secondsR !== undefined) {
      document.getElementById('input-seconds').value = (ls.secondsL||0) + '/' + (ls.secondsR||0);
    } else {
      document.getElementById('input-seconds').value = ls.seconds || '';
    }
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
function commitAndAdvance(secondsOverride) {
  clearAdvance();
  var ex = exerciseList[currentExIdx];

  var entered = {
    reps:     repsVal(),
    weight:   weightVal(),
    seconds:  secondsOverride !== undefined ? secondsOverride : secondsVal(),
    modifier: currentMod,
    band1:    band1Val(),
    band2:    band2Val()
  };

  var set = { exerciseId: ex.id, round: currentRound, skipped: false };
  var meaningful = false;

  if (ex.type === 'timed') {
    if (entered.seconds) {
      if (ex.bilateral && entered.seconds.indexOf('/') !== -1) {
        var parts = entered.seconds.split('/');
        set.secondsL = parseInt(parts[0], 10);
        set.secondsR = parseInt(parts[1], 10);
      } else {
        set.seconds = entered.seconds;
      }
      meaningful = true;
    }
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
  stopWorkoutTimer();
  if (save && sessionSets.length) saveSession(sessionSets);

  if (!save) {
    document.getElementById('summary-title').textContent = 'session discarded';
    document.getElementById('summary-meta').textContent = '';
    document.getElementById('summary-list').innerHTML = '';
    show('screen-done');
    return;
  }

  // total elapsed time + clock start/end
  var endTime = Date.now();
  var elapsedSec = workoutStartTime ? Math.floor((endTime - workoutStartTime) / 1000) : 0;
  var h = Math.floor(elapsedSec / 3600);
  var m = Math.floor((elapsedSec % 3600) / 60);
  var s = elapsedSec % 60;
  var durStr = h > 0
    ? h + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0')
    : m + ':' + String(s).padStart(2,'0');

  function clockStr(ms) {
    var d = new Date(ms);
    var hrs = d.getHours();
    var mins = d.getMinutes();
    var ampm = hrs >= 12 ? 'pm' : 'am';
    hrs = hrs % 12; if (hrs === 0) hrs = 12;
    return hrs + ':' + String(mins).padStart(2,'0') + ampm;
  }
  var timeRange = workoutStartTime
    ? clockStr(workoutStartTime) + '\u2013' + clockStr(endTime) + ' (' + durStr + ')'
    : durStr;

  var workRounds = currentRound === 0 ? 0 : currentRound;
  var hasWarmup  = sessionSets.some(function(s) { return s.round === 0 && !s.skipped; });
  var roundsStr  = (hasWarmup ? 'warmup + ' : '') + workRounds + ' round' + (workRounds !== 1 ? 's' : '');

  document.getElementById('summary-title').textContent = 'workout complete';
  document.getElementById('summary-meta').textContent = roundsStr + '  \u00b7  ' + timeRange;

  // group sets by exercise, in program order, skip fully-skipped exercises
  var list = document.getElementById('summary-list');
  list.innerHTML = '';

  exerciseList.forEach(function(ex) {
    var sets = sessionSets.filter(function(s) { return s.exerciseId === ex.id && !s.skipped; });
    if (!sets.length) return;

    var parts = sets.map(function(s) {
      if (s.secondsL !== undefined || s.secondsR !== undefined) {
        return (s.secondsL !== undefined ? s.secondsL : '?') + '/' + (s.secondsR !== undefined ? s.secondsR : '?') + 's (L/R)';
      }
      if (s.seconds !== undefined) return s.seconds + 's';
      if (s.check) return '\u2713';
      if (s.weight) return s.weight + ' lbs \u00d7' + s.reps;
      if (s.band1 || s.band2) {
        var bands = [s.band1, s.band2].filter(Boolean).join('+');
        return s.reps + (bands ? ' (' + bands + ')' : '');
      }
      if (s.reps) {
        if (s.modifier === 'assisted') return 'assisted \u00d7' + s.reps;
        return 'BW\u00d7' + s.reps;
      }
      return '';
    }).filter(Boolean);

    var row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = '<span class="summary-ex-name">' + ex.name + '</span>' +
                     '<span class="summary-ex-sets">' + parts.join(', ') + '</span>';
    list.appendChild(row);
  });

  show('screen-done');
}

function resetToStart() {
  stopWorkoutTimer();
  sessionSets  = [];
  stateHistory = [];
  currentRound = 0;
  currentExIdx = 0;
  currentMod   = 'bw';
  show('screen-start');
}

// ══════════════════════════════════════════════
// ── STOPWATCH + BEEP ENGINE ──
// ══════════════════════════════════════════════

var swRunning    = false;
var swStartTime  = 0;
var swElapsed    = 0;       // ms accumulated before last pause
var swRafId      = null;
var swIsBilateral = false;
var swSavedL     = null;    // seconds saved for L side
var swSavedR     = null;    // seconds saved for R side
var swHasStopped = false;   // true once stopped after at least one run
var countdownTimer = null;
var beepVolume   = parseFloat(localStorage.getItem('lf_beep_vol') || '0.6');
var longPressTimer = null;
var LONG_PRESS_MS  = 600;
var longPressFired = false;  // suppresses the click that fires after a long press

// ── AUDIO ──
var audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function beep(freq, duration, volume, delay) {
  delay = delay || 0;
  var ctx = getAudioCtx();
  var osc = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = freq;
  osc.type = 'sine';
  gain.gain.setValueAtTime(0, ctx.currentTime + delay);
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + delay + 0.01);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + delay + duration);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.05);
}

function playCountdownBeeps(seconds) {
  // Short beeps at 3, 2, 1 then a long GO beep when timer actually starts
  var vol = beepVolume;
  var startDelay = seconds - 3;
  if (startDelay < 0) startDelay = 0;
  if (seconds >= 3) beep(880, 0.1, vol, startDelay);       // 3 — short
  if (seconds >= 2) beep(880, 0.1, vol, startDelay + 1);   // 2 — short
  beep(880, 0.1, vol, startDelay + 2);                      // 1 — short
  beep(1200, 0.6, vol, seconds);                            // GO — long, when stopwatch starts
}

function setBeepVolume(val) {
  beepVolume = parseFloat(val);
  localStorage.setItem('lf_beep_vol', beepVolume);
  // play a test beep
  beep(880, 0.15, beepVolume, 0);
}

// Init beep volume slider
window.addEventListener('DOMContentLoaded', function() {
  var savedVol = localStorage.getItem('lf_beep_vol');
  if (savedVol !== null) {
    beepVolume = parseFloat(savedVol);
    var slider = document.getElementById('beep-volume');
    if (slider) slider.value = beepVolume;
  }
});

// ── OPEN / CLOSE STOPWATCH ──
function openStopwatch() {
  // Re-read program from storage so editor changes are reflected without reload
  var freshProgram = getProgram();
  var freshList = freshProgram.flatMap(function(p) { return p.exercises; });
  // Sync bilateral flag back into live exerciseList
  freshList.forEach(function(fe, i) {
    if (exerciseList[i] && exerciseList[i].id === fe.id) {
      exerciseList[i].bilateral = fe.bilateral;
    }
  });
  var ex = exerciseList[currentExIdx];
  swIsBilateral = !!(ex && ex.bilateral);
  swSavedL = null;
  swSavedR = null;
  swHasStopped = false;
  swRunning = false;
  swElapsed = 0;
  clearCountdown();

  document.getElementById('sw-ex-label').textContent = ex ? ex.name : '';
  // Restore last-used countdown for this exercise
  var savedCd = ex ? localStorage.getItem('lf_cd_' + ex.id) : null;
  document.getElementById('sw-countdown-select').value = savedCd || '0';
  document.getElementById('sw-display').textContent = '0.0';
  document.getElementById('sw-phase').textContent = '';
  document.getElementById('sw-start-stop').textContent = 'start';
  document.getElementById('sw-start-stop').disabled = false;
  renderSwSaveButtons();

  document.getElementById('stopwatch-overlay').classList.remove('hidden');
}

function closeStopwatch() {
  swStop();
  clearCountdown();
  document.getElementById('stopwatch-overlay').classList.add('hidden');
}

// ── TOGGLE START/STOP ──
function swToggle() {
  if (longPressFired) { longPressFired = false; return; }  // swallowed by long press
  // If there's a countdown active, cancel it and go straight to run
  if (countdownTimer !== null) {
    clearCountdown();
    swBeginRun();
    return;
  }
  if (swRunning) {
    swStop();
  } else {
    var cdSec = parseInt(document.getElementById('sw-countdown-select').value, 10);
    if (cdSec > 0) {
      swStartCountdown(cdSec);
    } else {
      swBeginRun();
    }
  }
}

function swStartCountdown(seconds) {
  // Persist countdown choice for this exercise
  var ex = exerciseList[currentExIdx];
  if (ex) localStorage.setItem('lf_cd_' + ex.id, seconds);
  var btn = document.getElementById('sw-start-stop');
  btn.textContent = 'cancel';
  document.getElementById('sw-phase').textContent = 'get ready...';
  playCountdownBeeps(seconds);

  var remaining = seconds;
  document.getElementById('sw-display').textContent = remaining.toFixed(0);

  countdownTimer = setInterval(function() {
    remaining -= 1;
    if (remaining <= 0) {
      clearCountdown();
      swBeginRun();
    } else {
      document.getElementById('sw-display').textContent = remaining.toFixed(0);
    }
  }, 1000);
}

function clearCountdown() {
  if (countdownTimer !== null) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

function swBeginRun() {
  swRunning = true;
  swStartTime = performance.now() - swElapsed;
  document.getElementById('sw-start-stop').textContent = 'stop';
  document.getElementById('sw-phase').textContent = 'running';
  swTick();
}

function swStop() {
  if (!swRunning) return;
  swRunning = false;
  swHasStopped = true;
  swElapsed = performance.now() - swStartTime;
  if (swRafId) { cancelAnimationFrame(swRafId); swRafId = null; }
  document.getElementById('sw-start-stop').textContent = 'start';
  document.getElementById('sw-phase').textContent = '';
  renderSwSaveButtons();
}

function swLongPressStart() {
  longPressFired = false;
  longPressTimer = setTimeout(function() {
    longPressTimer = null;
    longPressFired = true;
    swReset();
  }, LONG_PRESS_MS);
}
function swLongPressCancel() {
  if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
}

function swReset() {
  swStop();
  clearCountdown();
  swRunning = false;
  swElapsed = 0;
  swHasStopped = false;
  document.getElementById('sw-display').textContent = '0.0';
  document.getElementById('sw-phase').textContent = '';
  document.getElementById('sw-start-stop').textContent = 'start';
  renderSwSaveButtons();
}

function swTick() {
  if (!swRunning) return;
  var elapsed = (performance.now() - swStartTime) / 1000;
  document.getElementById('sw-display').textContent = elapsed.toFixed(1);
  swRafId = requestAnimationFrame(swTick);
}

// ── SAVE BUTTONS ──
function renderSwSaveButtons() {
  var row = document.getElementById('sw-save-row');
  row.innerHTML = '';

  var elapsedSec = Math.round(swElapsed / 1000);
  var canSave = swHasStopped && elapsedSec > 0;

  if (swIsBilateral) {
    var btnL = document.createElement('button');
    btnL.className = 'sw-save-btn' + (swSavedL !== null ? ' sw-saved' : '');
    btnL.textContent = swSavedL !== null ? 'L: ' + swSavedL + 's ✓' : 'save L';
    btnL.disabled = swSavedL !== null || !canSave;
    btnL.onclick = function() { swSaveSide('L', elapsedSec); };

    var btnR = document.createElement('button');
    btnR.className = 'sw-save-btn' + (swSavedR !== null ? ' sw-saved' : '');
    btnR.textContent = swSavedR !== null ? 'R: ' + swSavedR + 's ✓' : 'save R';
    btnR.disabled = swSavedR !== null || !canSave;
    btnR.onclick = function() { swSaveSide('R', elapsedSec); };

    row.appendChild(btnL);
    row.appendChild(btnR);
  } else {
    var btn = document.createElement('button');
    btn.className = 'sw-save-btn';
    btn.textContent = 'save';
    btn.disabled = !canSave;
    btn.onclick = function() { swSaveSingle(elapsedSec); };
    row.appendChild(btn);
  }
}

function swSaveSide(side, secs) {
  if (side === 'L') swSavedL = secs;
  else              swSavedR = secs;

  renderSwSaveButtons();

  if (swSavedL !== null && swSavedR !== null) {
    var val = swSavedL + '/' + swSavedR;
    document.getElementById('input-seconds').value = val;
    closeStopwatch();
    commitAndAdvance(val);  // pass directly — nothing can clear it in between
  } else {
    swReset();
    document.getElementById('sw-phase').textContent = side === 'L' ? 'now do R' : 'now do L';
  }
}

function swSaveSingle(secs) {
  var val = String(secs);
  document.getElementById('input-seconds').value = val;
  closeStopwatch();
  commitAndAdvance(val);  // pass directly — nothing can clear it in between
}
