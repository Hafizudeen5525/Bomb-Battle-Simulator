import type { Difficulty } from './types';

export interface GridCoord {
  r: number;
  c: number;
}

export interface CircuitColorDef {
  id: string;
  label: string;
  symbol: string;
  hex: string;
}

export const CIRCUIT_COLORS: CircuitColorDef[] = [
  { id: 'cyan', label: 'Cyan', symbol: 'A', hex: '#06B6D4' },
  { id: 'amber', label: 'Amber', symbol: 'B', hex: '#F59E0B' },
  { id: 'emerald', label: 'Emerald', symbol: 'C', hex: '#10B981' },
  { id: 'crimson', label: 'Crimson', symbol: 'D', hex: '#EF4444' },
  { id: 'indigo', label: 'Cobalt', symbol: 'E', hex: '#6366F1' },
  { id: 'lime', label: 'Lime', symbol: 'F', hex: '#84CC16' },
  { id: 'orange', label: 'Orange', symbol: 'G', hex: '#F97316' },
  { id: 'sky', label: 'Ice', symbol: 'H', hex: '#38BDF8' },
];

export interface CircuitPair {
  colorIndex: number;
  a: GridCoord;
  b: GridCoord;
  solutionPath: GridCoord[];
}

export interface PowerGridPuzzle {
  level: number;
  size: number;
  pairs: CircuitPair[];
}

export type PathMap = Record<number, GridCoord[]>;

function coordsEqual(a: GridCoord, b: GridCoord): boolean {
  return a.r === b.r && a.c === b.c;
}

function manhattan(a: GridCoord, b: GridCoord): number {
  return Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
}

function getGridSpec(level: number, difficulty: Difficulty): { size: number; pairCount: number } {
  const diffOffset = difficulty === 'hard' ? 2 : difficulty === 'normal' ? 1 : 0;
  const effectiveLevel = level + diffOffset;

  if (effectiveLevel <= 1) return { size: 5, pairCount: 4 };
  if (effectiveLevel <= 2) return { size: 5, pairCount: 5 };
  if (effectiveLevel <= 3) return { size: 6, pairCount: 5 };
  if (effectiveLevel <= 4) return { size: 6, pairCount: 6 };
  if (effectiveLevel <= 6) return { size: 7, pairCount: 6 };
  if (effectiveLevel <= 8) return { size: 7, pairCount: 7 };
  return { size: 8, pairCount: 8 };
}

/**
 * Generates an unbiased Hamiltonian path on an N x N grid using the
 * Jacobson & Matthews backbite algorithm, guaranteeing 100% full-grid
 * non-crossing solvability.
 */
function generateHamiltonianPath(size: number, rng: () => number): GridCoord[] {
  const path: GridCoord[] = [];
  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) path.push({ r, c });
    } else {
      for (let c = size - 1; c >= 0; c--) path.push({ r, c });
    }
  }

  const indexOf = (coord: GridCoord): number => {
    for (let i = 0; i < path.length; i++) {
      if (path[i].r === coord.r && path[i].c === coord.c) return i;
    }
    return -1;
  };

  const dirs = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];

  const steps = size * size * 12;
  for (let step = 0; step < steps; step++) {
    const fromHead = rng() < 0.5;
    const endIdx = fromHead ? 0 : path.length - 1;
    const end = path[endIdx];

    const candidates: number[] = [];
    for (const d of dirs) {
      const nr = end.r + d.dr;
      const nc = end.c + d.dc;
      if (nr >= 0 && nr < size && nc >= 0 && nc < size) {
        const neighborIdx = indexOf({ r: nr, c: nc });
        if (fromHead && neighborIdx > 1) {
          candidates.push(neighborIdx);
        } else if (!fromHead && neighborIdx < path.length - 2) {
          candidates.push(neighborIdx);
        }
      }
    }

    if (candidates.length === 0) continue;
    const chosenIdx = candidates[Math.floor(rng() * candidates.length)];

    if (fromHead) {
      // Reverse path[0 .. chosenIdx - 1]
      let lo = 0;
      let hi = chosenIdx - 1;
      while (lo < hi) {
        const tmp = path[lo];
        path[lo] = path[hi];
        path[hi] = tmp;
        lo++;
        hi--;
      }
    } else {
      // Reverse path[chosenIdx + 1 .. path.length - 1]
      let lo = chosenIdx + 1;
      let hi = path.length - 1;
      while (lo < hi) {
        const tmp = path[lo];
        path[lo] = path[hi];
        path[hi] = tmp;
        lo++;
        hi--;
      }
    }
  }

  return path;
}

function splitPathIntoSegments(
  path: GridCoord[],
  pairCount: number,
  rng: () => number
): GridCoord[][] | null {
  const n = path.length;
  const minLen = 3;
  if (pairCount * minLen > n) return null;

  for (let attempt = 0; attempt < 40; attempt++) {
    const lengths = new Array<number>(pairCount).fill(minLen);
    let remaining = n - pairCount * minLen;

    while (remaining > 0) {
      const idx = Math.floor(rng() * pairCount);
      lengths[idx]++;
      remaining--;
    }

    const segments: GridCoord[][] = [];
    let cursor = 0;
    let valid = true;

    for (let i = 0; i < pairCount; i++) {
      const seg = path.slice(cursor, cursor + lengths[i]);
      cursor += lengths[i];
      if (manhattan(seg[0], seg[seg.length - 1]) < 2) {
        valid = false;
        break;
      }
      segments.push(seg);
    }

    if (valid) return segments;
  }

  // Fallback balanced split
  const segments: GridCoord[][] = [];
  const baseLen = Math.floor(n / pairCount);
  let extra = n % pairCount;
  let cursor = 0;
  for (let i = 0; i < pairCount; i++) {
    const len = baseLen + (extra > 0 ? 1 : 0);
    if (extra > 0) extra--;
    segments.push(path.slice(cursor, cursor + len));
    cursor += len;
  }
  return segments;
}

export function generatePowerGridPuzzle(
  level: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): PowerGridPuzzle {
  const { size, pairCount } = getGridSpec(level, difficulty);

  for (let retry = 0; retry < 10; retry++) {
    const hamPath = generateHamiltonianPath(size, rng);
    const segments = splitPathIntoSegments(hamPath, pairCount, rng);
    if (!segments) continue;

    // Shuffle color assignments so colors vary across boards
    const colorIndices = Array.from({ length: pairCount }, (_, i) => i);
    for (let i = colorIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [colorIndices[i], colorIndices[j]] = [colorIndices[j], colorIndices[i]];
    }

    const pairs: CircuitPair[] = segments.map((seg, i) => ({
      colorIndex: colorIndices[i],
      a: seg[0],
      b: seg[seg.length - 1],
      solutionPath: seg,
    }));

    return { level, size, pairs };
  }

  // Deterministic fallback if all retries somehow miss
  const hamPath = generateHamiltonianPath(size, rng);
  const segments = splitPathIntoSegments(hamPath, pairCount, rng)!;
  return {
    level,
    size,
    pairs: segments.map((seg, i) => ({
      colorIndex: i,
      a: seg[0],
      b: seg[seg.length - 1],
      solutionPath: seg,
    })),
  };
}

export interface PowerGridValidation {
  connectedCount: number;
  totalPairs: number;
  filledCells: number;
  totalCells: number;
  allConnected: boolean;
  fullCoverage: boolean;
  isSolved: boolean;
}

export function isPairConnected(pair: CircuitPair, path: GridCoord[] | undefined): boolean {
  if (!path || path.length < 2) return false;
  const start = path[0];
  const end = path[path.length - 1];
  const matchesForward = coordsEqual(start, pair.a) && coordsEqual(end, pair.b);
  const matchesReverse = coordsEqual(start, pair.b) && coordsEqual(end, pair.a);
  if (!matchesForward && !matchesReverse) return false;

  for (let i = 1; i < path.length; i++) {
    if (manhattan(path[i - 1], path[i]) !== 1) return false;
  }
  return true;
}

export function validatePowerGridBoard(
  puzzle: PowerGridPuzzle,
  paths: PathMap
): PowerGridValidation {
  const occupied = new Set<string>();
  let hasOverlap = false;
  let connectedCount = 0;

  for (const pair of puzzle.pairs) {
    const path = paths[pair.colorIndex] ?? [];
    for (const cell of path) {
      const key = `${cell.r},${cell.c}`;
      if (occupied.has(key)) {
        hasOverlap = true;
      }
      occupied.add(key);
    }
    if (isPairConnected(pair, path)) {
      connectedCount++;
    }
  }

  const totalCells = puzzle.size * puzzle.size;
  const allConnected = !hasOverlap && connectedCount === puzzle.pairs.length;
  const fullCoverage = occupied.size === totalCells;

  return {
    connectedCount,
    totalPairs: puzzle.pairs.length,
    filledCells: occupied.size,
    totalCells,
    allConnected,
    fullCoverage,
    isSolved: allConnected,
  };
}

/**
 * Computes intermediate orthogonal grid steps between `from` and `to` so fast
 * finger swipes or slight diagonal drags smoothly trace around corners instead
 * of dropping cells.
 */
export function interpolateDragSteps(
  from: GridCoord,
  to: GridCoord,
  canEnter: (coord: GridCoord) => boolean
): GridCoord[] {
  const dr = to.r - from.r;
  const dc = to.c - from.c;
  const dist = Math.abs(dr) + Math.abs(dc);

  if (dist === 0) return [];
  if (dist === 1) {
    return canEnter(to) ? [to] : [];
  }

  if (dist === 2) {
    if (dr === 0 || dc === 0) {
      const mid: GridCoord = {
        r: from.r + Math.sign(dr),
        c: from.c + Math.sign(dc),
      };
      if (canEnter(mid) && canEnter(to)) {
        return [mid, to];
      }
      return [];
    }

    // Diagonal 1x1 move: try either orthogonal corner
    const cornerA: GridCoord = { r: from.r, c: to.c };
    const cornerB: GridCoord = { r: to.r, c: from.c };
    if (canEnter(cornerA) && canEnter(to)) {
      return [cornerA, to];
    }
    if (canEnter(cornerB) && canEnter(to)) {
      return [cornerB, to];
    }
  }

  return [];
}

