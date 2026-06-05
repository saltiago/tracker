// ── DEFAULT PROGRAM ──
const DEFAULT_PROGRAM = [
  {
    pair: 1,
    exercises: [
      { id: 'pull',       name: 'Pull',       type: 'weighted' },
      { id: 'ohp',        name: 'OHP',        type: 'weighted' },
    ]
  },
  {
    pair: 2,
    exercises: [
      { id: 'sldl',       name: 'SLDL',       type: 'weighted' },
      { id: 'copenhagen', name: 'Copenhagen', type: 'timed'    },
    ]
  },
  {
    pair: 3,
    exercises: [
      { id: 'push',       name: 'Push',       type: 'weighted' },
      { id: 'row',        name: 'Row',        type: 'weighted' },
    ]
  },
  {
    pair: 4,
    exercises: [
      { id: 'latraise',   name: 'Lat Raise',  type: 'weighted' },
      { id: 'deadbug',    name: 'Deadbug',    type: 'timed'    },
    ]
  },
  {
    pair: 5,
    exercises: [
      { id: 'bicep',      name: 'Bicep',      type: 'weighted' },
      { id: 'tricep',     name: 'Tricep',     type: 'weighted' },
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

// Get last logged sets for a given exerciseId (most recent non-skipped)
function getLastSets(exerciseId) {
  const sessions = getSessions();
  for (let i = sessions.length - 1; i >= 0; i--) {
    const sets = sessions[i].sets.filter(s => s.exerciseId === exerciseId && !s.skipped);
    if (sets.length > 0) return sets;
  }
  return [];
}

// Get all weighted data points for an exercise: [{date, weight}]
function getWeightHistory(exerciseId) {
  const sessions = getSessions();
  return sessions
    .map(s => {
      const sets = s.sets.filter(x => x.exerciseId === exerciseId && !x.skipped && x.weight);
      if (!sets.length) return null;
      const maxWeight = Math.max(...sets.map(x => parseFloat(x.weight)));
      return { date: s.date, weight: maxWeight };
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
