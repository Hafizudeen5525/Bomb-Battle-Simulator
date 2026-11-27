import type { Difficulty, GameId, RoomMeta, TimerScale } from './types';

export const ROOM_ORDER: GameId[] = [
  'power-grid',
  'melody-hack',
  'decrypt',
  'bomb-defuse',
];

export const ROOMS: Record<GameId, RoomMeta> = {
  'power-grid': {
    id: 'power-grid',
    order: 1,
    name: 'Power Grid',
    subtitle: 'Circuit Link Matrix',
    brief: 'Connect every color-coded circuit pair across the grid without crossing lines.',
    accentHex: '#06B6D4',
  },
  'melody-hack': {
    id: 'melody-hack',
    order: 2,
    name: 'Melody Hack',
    subtitle: 'Audio Sequence Override',
    brief: 'Listen to the randomized sensor tone pattern and replicate it in exact order.',
    accentHex: '#F59E0B',
  },
  'decrypt': {
    id: 'decrypt',
    order: 3,
    name: 'Decrypt',
    subtitle: '1-100 Code Terminal',
    brief: 'Tap numbers 1 to 100 in strict ascending order across terminals and clear math overrides.',
    accentHex: '#10B981',
  },
  'bomb-defuse': {
    id: 'bomb-defuse',
    order: 4,
    name: 'Bomb Defuse',
    subtitle: 'Circuit Cracker Core',
    brief: 'Toggle input pumps through logic gates to power GREEN targets and keep RED hazards off.',
    accentHex: '#EF4444',
  },
};

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  {
    label: string;
    scoreMultiplier: number;
    mistakeTimePenalty: number;
    bombBaseTime: number;
    bombLocksRequired: number;
  }
> = {
  easy: {
    label: 'Easy',
    scoreMultiplier: 1.0,
    mistakeTimePenalty: 2,
    bombBaseTime: 75,
    bombLocksRequired: 4,
  },
  normal: {
    label: 'Normal',
    scoreMultiplier: 1.35,
    mistakeTimePenalty: 4,
    bombBaseTime: 60,
    bombLocksRequired: 5,
  },
  hard: {
    label: 'Hard',
    scoreMultiplier: 1.75,
    mistakeTimePenalty: 6,
    bombBaseTime: 45,
    bombLocksRequired: 6,
  },
};

export const TIMER_SCALE_SECONDS: Record<TimerScale, { label: string; roomSeconds: number; description: string }> = {
  blitz: {
    label: 'Blitz (60s)',
    roomSeconds: 60,
    description: 'Rapid 60-second sprint per room',
  },
  standard: {
    label: 'Standard (120s)',
    roomSeconds: 120,
    description: 'Balanced 2-minute simulator drill per room',
  },
  real: {
    label: 'Real Room (15:00)',
    roomSeconds: 900,
    description: 'Authentic 15-minute Bomb Battle room clock',
  },
};

export function getRoomDurationSeconds(gameId: GameId, difficulty: Difficulty, timerScale: TimerScale, campaignBonusSeconds = 0): number {
  if (gameId === 'bomb-defuse') {
    const base = DIFFICULTY_CONFIG[difficulty].bombBaseTime;
    const scaleBoost = timerScale === 'real' ? 60 : timerScale === 'standard' ? 15 : 0;
    return base + scaleBoost + campaignBonusSeconds;
  }
  return TIMER_SCALE_SECONDS[timerScale].roomSeconds;
}

/**
 * In Bomb Battle, accumulated points from Power Grid, Melody Hack, and Decrypt
 * directly convert into extra defusal seconds in the final Bomb Defuse room.
 */
export function calculateBonusDefuseSeconds(totalScore: number): number {
  return Math.min(90, Math.floor(totalScore / 150));
}
