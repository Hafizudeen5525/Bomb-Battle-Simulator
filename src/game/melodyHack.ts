import type { Difficulty } from './types';

export interface MelodyPad {
  index: number;
  label: string;
  noteName: string;
  frequency: number;
  hex: string;
  keyHint: string;
}

export const MELODY_PADS: MelodyPad[] = [
  { index: 0, label: 'Sensor 1', noteName: 'C4', frequency: 261.63, hex: '#06B6D4', keyHint: '1' },
  { index: 1, label: 'Sensor 2', noteName: 'D4', frequency: 293.66, hex: '#10B981', keyHint: '2' },
  { index: 2, label: 'Sensor 3', noteName: 'E4', frequency: 329.63, hex: '#F59E0B', keyHint: '3' },
  { index: 3, label: 'Sensor 4', noteName: 'G4', frequency: 392.0, hex: '#EF4444', keyHint: '4' },
  { index: 4, label: 'Sensor 5', noteName: 'A4', frequency: 440.0, hex: '#6366F1', keyHint: '5' },
  { index: 5, label: 'Sensor 6', noteName: 'C5', frequency: 523.25, hex: '#EC4899', keyHint: '6' },
];

export interface MelodyLevel {
  level: number;
  sequence: number[];
  stepIntervalMs: number;
  padCount: number;
}

export function generateMelodyLevel(
  level: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): MelodyLevel {
  const baseLength = difficulty === 'hard' ? 5 : difficulty === 'normal' ? 4 : 3;
  const sequenceLength = Math.min(12, baseLength + (level - 1));
  const padCount = difficulty === 'easy' && level <= 2 ? 4 : 6;

  const baseTempo = difficulty === 'hard' ? 390 : difficulty === 'normal' ? 460 : 540;
  const stepIntervalMs = Math.max(240, baseTempo - (level - 1) * 22);

  const sequence: number[] = [];
  for (let i = 0; i < sequenceLength; i++) {
    let pick = Math.floor(rng() * padCount);
    // Prevent 3 identical consecutive tones so melodies stay musical and fair
    if (i >= 2 && sequence[i - 1] === pick && sequence[i - 2] === pick) {
      pick = (pick + 1 + Math.floor(rng() * (padCount - 1))) % padCount;
    }
    sequence.push(pick);
  }

  return {
    level,
    sequence,
    stepIntervalMs,
    padCount,
  };
}

export interface MelodyStepOutcome {
  status: 'continue' | 'completed' | 'mistake';
  nextIndex: number;
}

export function evaluateMelodyStep(
  sequence: number[],
  currentIndex: number,
  padIndex: number
): MelodyStepOutcome {
  if (currentIndex < 0 || currentIndex >= sequence.length) {
    return { status: 'mistake', nextIndex: 0 };
  }
  if (sequence[currentIndex] !== padIndex) {
    return { status: 'mistake', nextIndex: 0 };
  }
  const nextIndex = currentIndex + 1;
  if (nextIndex >= sequence.length) {
    return { status: 'completed', nextIndex };
  }
  return { status: 'continue', nextIndex };
}
