import type { ScoreEntry } from './types';

const STORAGE_KEY = 'bomb_battle_sim_scoreboard_v1';

const SEED_ENTRIES: ScoreEntry[] = [
  {
    id: 'seed-1',
    callsign: 'SQUAD ALPHA',
    mode: 'campaign',
    gameId: 'campaign',
    difficulty: 'normal',
    timerScale: 'standard',
    score: 4850,
    levelsCleared: 14,
    timeRemaining: 18.4,
    outcome: 'DEFUSED',
    timestamp: Date.now() - 86400000 * 2,
  },
  {
    id: 'seed-2',
    callsign: 'VIPER 04',
    mode: 'campaign',
    gameId: 'campaign',
    difficulty: 'hard',
    timerScale: 'blitz',
    score: 3920,
    levelsCleared: 11,
    timeRemaining: 9.2,
    outcome: 'DEFUSED',
    timestamp: Date.now() - 86400000,
  },
  {
    id: 'seed-3',
    callsign: 'KL CIRCUIT',
    mode: 'practice',
    gameId: 'power-grid',
    difficulty: 'normal',
    timerScale: 'standard',
    score: 1640,
    levelsCleared: 5,
    timeRemaining: 0,
    outcome: 'CLEARED',
    timestamp: Date.now() - 3600000 * 6,
  },
];

export function loadScoreboard(): ScoreEntry[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [...SEED_ENTRIES];
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ENTRIES));
      return [...SEED_ENTRIES];
    }
    const parsed = JSON.parse(raw) as ScoreEntry[];
    if (!Array.isArray(parsed)) return [...SEED_ENTRIES];
    return sortScoreboard(parsed);
  } catch {
    return [...SEED_ENTRIES];
  }
}

export function sortScoreboard(entries: ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.timestamp - a.timestamp;
  });
}

export function saveScoreEntry(entry: Omit<ScoreEntry, 'id' | 'timestamp'>): ScoreEntry[] {
  const fullEntry: ScoreEntry = {
    ...entry,
    callsign: entry.callsign.trim() || 'AGENT-01',
    id: `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: Date.now(),
  };

  const existing = loadScoreboard();
  const next = sortScoreboard([fullEntry, ...existing]).slice(0, 40);

  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Ignore quota errors
    }
  }
  return next;
}

export function clearScoreboard(): ScoreEntry[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
    } catch {
      // Ignore
    }
  }
  return [];
}

export function getBestScoreFor(entries: ScoreEntry[], gameId: ScoreEntry['gameId']): number {
  let best = 0;
  for (const e of entries) {
    if (e.gameId === gameId && e.score > best) {
      best = e.score;
    }
  }
  return best;
}
