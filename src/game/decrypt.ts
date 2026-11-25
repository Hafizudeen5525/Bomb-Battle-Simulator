import type { Difficulty } from './types';

export interface DecryptTile {
  value: number;
  terminalIndex: number; // 0..3
  fadePhase: number; // 0..3 used for visual fade modulation
}

export interface DecryptWave {
  wave: number;
  maxNumber: number;
  terminals: DecryptTile[][]; // 4 terminals, 25 tiles each
  fadeEnabled: boolean;
}

export interface MathOverridePrompt {
  question: string;
  answer: number;
  options: number[];
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function generateDecryptWave(
  wave: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): DecryptWave {
  const maxNumber = 100;
  const allNumbers = Array.from({ length: maxNumber }, (_, i) => i + 1);
  const terminals: DecryptTile[][] = [[], [], [], []];

  if (difficulty === 'easy') {
    // Easy groups 1-25, 26-50, 51-75, 76-100 by terminal, shuffled inside each terminal
    for (let t = 0; t < 4; t++) {
      const slice = shuffle(allNumbers.slice(t * 25, (t + 1) * 25), rng);
      terminals[t] = slice.map((value) => ({
        value,
        terminalIndex: t,
        fadePhase: Math.floor(rng() * 4),
      }));
    }
  } else {
    // Normal & Hard scatter 1-100 across all 4 multi-screen terminals simultaneously
    const shuffled = shuffle(allNumbers, rng);
    for (let i = 0; i < shuffled.length; i++) {
      const t = i % 4;
      terminals[t].push({
        value: shuffled[i],
        terminalIndex: t,
        fadePhase: Math.floor(rng() * 4),
      });
    }
  }

  return {
    wave,
    maxNumber,
    terminals,
    fadeEnabled: difficulty !== 'easy' || wave > 1,
  };
}

export function shouldTriggerOverride(nextExpected: number, difficulty: Difficulty): boolean {
  if (difficulty === 'easy') {
    return nextExpected === 51;
  }
  if (difficulty === 'normal') {
    return nextExpected === 26 || nextExpected === 51 || nextExpected === 76;
  }
  return nextExpected === 21 || nextExpected === 41 || nextExpected === 61 || nextExpected === 81;
}

export function generateMathOverride(
  difficulty: Difficulty,
  rng: () => number = Math.random
): MathOverridePrompt {
  const useMultiply = difficulty === 'hard' && rng() < 0.45;
  let a: number;
  let b: number;
  let answer: number;
  let question: string;

  if (useMultiply) {
    a = 6 + Math.floor(rng() * 9);
    b = 4 + Math.floor(rng() * 8);
    answer = a * b;
    question = `${a} × ${b} = ?`;
  } else if (rng() < 0.5) {
    const maxTerm = difficulty === 'easy' ? 25 : difficulty === 'normal' ? 45 : 75;
    a = 10 + Math.floor(rng() * maxTerm);
    b = 8 + Math.floor(rng() * maxTerm);
    answer = a + b;
    question = `${a} + ${b} = ?`;
  } else {
    const base = difficulty === 'easy' ? 40 : difficulty === 'normal' ? 70 : 99;
    a = 25 + Math.floor(rng() * base);
    b = 7 + Math.floor(rng() * Math.min(24, a - 10));
    answer = a - b;
    question = `${a} - ${b} = ?`;
  }

  const distractors = new Set<number>([answer]);
  const offsets = [-10, -4, -2, -1, 1, 2, 4, 10, 6, -6];
  while (distractors.size < 4) {
    const delta = offsets[Math.floor(rng() * offsets.length)];
    const candidate = Math.max(1, answer + delta);
    distractors.add(candidate);
  }

  return {
    question,
    answer,
    options: shuffle(Array.from(distractors), rng),
  };
}
