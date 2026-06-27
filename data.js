// ── DEFAULT PROGRAM ──
const DEFAULT_PROGRAM = [
  {
    pair: 1,
    exercises: [
      { id: 'pullup',     name: 'Pull-up',    type: 'bodyweight' },
      { id: 'ohp',        name: 'OHP',        type: 'weighted'   },
    ]
  },
  {
    pair: 2,
    exercises: [
      { id: 'sldl',       name: 'SLDL',       type: 'weighted'   },
      { id: 'copenhagen', name: 'Copenhagen', type: 'timed'      },
    ]
  },
  {
    pair: 3,
    exercises: [
      { id: 'pushup',     name: 'Push-up',    type: 'bodyweight' },
      { id: 'row',        name: 'Row',        type: 'weighted'   },
    ]
  },
  {
    pair: 4,
    exercises: [
      { id: 'latraise',   name: 'Lat Raise',  type: 'weighted'   },
      { id: 'deadbug',    name: 'Deadbug',    type: 'timed'      },
    ]
  },
  {
    pair: 5,
    exercises: [
      { id: 'bicep',      name: 'Bicep',      type: 'weighted'   },
      { id: 'tricep',     name: 'Tricep',     type: 'weighted'   },
    ]
  },
];

// ── STORAGE HELPERS ──

function getProgram() {
  const stored = localStorage.getItem('lf_program');
  return stored ? JSON.parse(stored) : DEFAULT_PROGRAM;
}

function saveProgram(program) {
  localStorage.setItem('lf_program', JSON.stringify(program));
}

// sessions: array of { date: ISO string, sets: [{exerciseId, weight, reps, skipped}] }
function getSessions() {
  const stored = localStorage.getItem('lf_sessions');
  return stored ? JSON.parse(stored) : [];
}

function saveSessions(sessions) {
  localStorage.setItem('lf_sessions', JSON.stringify(sessions));
}

// Save a completed session
function saveSession(sets) {
  const sessions = getSessions();
  sessions.push({ date: new Date().toISOString(), sets });
  saveSessions(sessions);
}

// Get last logged set for a given exerciseId + round (most recent session).
// Returns { set, fromRound } — fromRound tells the ghost which round it's referencing.
// Falls back to nearest available round if the exact round wasn't logged last time.
function getLastSetForRound(exerciseId, round) {
  const sessions = getSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = sessions[i].sets.filter(s => s.exerciseId === exerciseId && !s.skipped);
    if (!sets.length) continue;
    const exact = sets.find(s => s.round === round);
    if (exact) return { set: exact, fromRound: round };
    const closest = sets.reduce((a, b) =>
      Math.abs(b.round - round) < Math.abs(a.round - round) ? b : a
    );
    return { set: closest, fromRound: closest.round };
  }
  return null;
}

// Get all weighted data points for an exercise: [{date, weight}]
// Also handles timed exercises (returns max seconds as 'weight' for charting)
function getWeightHistory(exerciseId) {
  const sessions = getSessions();
  return sessions
    .map(s => {
      const sets = s.sets.filter(x => x.exerciseId === exerciseId && !x.skipped);
      if (!sets.length) return null;
      const weighted = sets.filter(x => x.weight);
      const timed    = sets.filter(x => x.seconds !== undefined || x.secondsL !== undefined);
      if (weighted.length) {
        return { date: s.date, weight: Math.max(...weighted.map(x => parseFloat(x.weight))) };
      }
      if (timed.length) {
        const vals = timed.map(x => Math.max(
          x.seconds   ? parseFloat(x.seconds)  : 0,
          x.secondsL  ? parseFloat(x.secondsL) : 0,
          x.secondsR  ? parseFloat(x.secondsR) : 0
        ));
        return { date: s.date, weight: Math.max(...vals) };
      }
      return null;
    })
    .filter(Boolean);
}

// Flatten all exercises from program
function getAllExercises() {
  const program = getProgram();
  return program.flatMap(pair => pair.exercises);
}

// Menu open/close (shared)
function openMenu() {
  document.getElementById('menu-overlay').classList.remove('hidden');
}
function closeMenu() {
  document.getElementById('menu-overlay').classList.add('hidden');
}
document.addEventListener('click', e => {
  const overlay = document.getElementById('menu-overlay');
  if (overlay && !overlay.classList.contains('hidden') && e.target === overlay) {
    closeMenu();
  }
});

// ── THEME (shared across all pages) ──
(function initTheme() {
  if (localStorage.getItem('lf_theme') === 'light') document.body.classList.add('light');
})();

function toggleTheme() {
  var isLight = document.body.classList.toggle('light');
  localStorage.setItem('lf_theme', isLight ? 'light' : 'dark');
}
