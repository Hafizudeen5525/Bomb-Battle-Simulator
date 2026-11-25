export type GameId = 'power-grid' | 'melody-hack' | 'decrypt' | 'bomb-defuse';

export type Difficulty = 'easy' | 'normal' | 'hard';

export type TimerScale = 'blitz' | 'standard' | 'real';

export type PlayMode = 'campaign' | 'practice';

export type AppScreenState = 'title' | 'playing' | 'paused' | 'transition' | 'gameover';

export interface RoomMeta {
  id: GameId;
  order: number;
  name: string;
  subtitle: string;
  brief: string;
  accentHex: string;
}

export interface StageResult {
  gameId: GameId;
  scoreEarned: number;
  levelsCleared: number;
  mistakes: number;
  timeRemaining: number;
  cleared: boolean;
}

export interface ScoreEntry {
  id: string;
  callsign: string;
  mode: PlayMode;
  gameId: GameId | 'campaign';
  difficulty: Difficulty;
  timerScale: TimerScale;
  score: number;
  levelsCleared: number;
  timeRemaining: number;
  outcome: 'DEFUSED' | 'BLASTED' | 'CLEARED';
  timestamp: number;
}
