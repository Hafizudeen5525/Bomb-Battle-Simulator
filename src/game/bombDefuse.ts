import type { Difficulty } from './types';

export type Direction = 'N' | 'E' | 'S' | 'W';
export type ConduitShape = 'STRAIGHT' | 'CORNER' | 'TEE' | 'CROSS';
export type CircuitCellKind = 'source' | 'green' | 'red' | 'conduit' | 'blocker';

export interface CircuitCell {
  r: number;
  c: number;
  kind: CircuitCellKind;
  shape?: ConduitShape;
  rotation: number; // 0, 1, 2, 3 (90deg clockwise steps)
  solutionRotation?: number;
}

export interface CircuitBoard {
  round: number;
  size: number;
  cells: CircuitCell[][];
  greenTargets: number;
  redHazards: number;
}

export interface CircuitFlowResult {
  poweredKeys: Set<string>;
  poweredGreens: number;
  totalGreens: number;
  poweredReds: number;
  allGreensPowered: boolean;
  anyRedPowered: boolean;
  isSolved: boolean;
}

const DIR_DELTAS: Record<Direction, { dr: number; dc: number; opposite: Direction }> = {
  N: { dr: -1, dc: 0, opposite: 'S' },
  E: { dr: 0, dc: 1, opposite: 'W' },
  S: { dr: 1, dc: 0, opposite: 'N' },
  W: { dr: 0, dc: -1, opposite: 'E' },
};

const ALL_DIRS: Direction[] = ['N', 'E', 'S', 'W'];

const BASE_SHAPE_PORTS: Record<ConduitShape, Direction[]> = {
  STRAIGHT: ['N', 'S'],
  CORNER: ['N', 'E'],
  TEE: ['N', 'E', 'S'],
  CROSS: ['N', 'E', 'S', 'W'],
};

function rotateDir(dir: Direction, steps: number): Direction {
  const idx = ALL_DIRS.indexOf(dir);
  return ALL_DIRS[(idx + (steps % 4) + 4) % 4];
}

export function getCellPorts(cell: CircuitCell): Direction[] {
  if (cell.kind === 'blocker') return [];
  if (cell.kind === 'source') return ['E', 'N', 'S'];
  if (cell.kind === 'green' || cell.kind === 'red') return ALL_DIRS;
  if (!cell.shape) return [];
  const base = BASE_SHAPE_PORTS[cell.shape];
  return base.map((d) => rotateDir(d, cell.rotation));
}

function findShapeAndRotation(requiredDirs: Direction[]): { shape: ConduitShape; rotation: number } {
  const reqSet = new Set(requiredDirs);
  const shapes: ConduitShape[] =
    reqSet.size <= 2
      ? ['STRAIGHT', 'CORNER']
      : reqSet.size === 3
      ? ['TEE']
      : ['CROSS'];

  for (const shape of shapes) {
    for (let rot = 0; rot < 4; rot++) {
      const ports = BASE_SHAPE_PORTS[shape].map((d) => rotateDir(d, rot));
      const allPresent = requiredDirs.every((d) => ports.includes(d));
      if (allPresent && ports.length === reqSet.size) {
        return { shape, rotation: rot };
      }
    }
  }

  // Fallback for single-degree or edge cases
  if (reqSet.size === 1) {
    const dir = requiredDirs[0];
    const rot = dir === 'N' || dir === 'S' ? 0 : 1;
    return { shape: 'STRAIGHT', rotation: rot };
  }
  return { shape: 'CROSS', rotation: 0 };
}

export function computeCircuitFlow(board: CircuitBoard): CircuitFlowResult {
  const poweredKeys = new Set<string>();
  const queue: { r: number; c: number }[] = [];
  let totalGreens = 0;
  let poweredGreens = 0;
  let poweredReds = 0;

  for (let r = 0; r < board.size; r++) {
    for (let c = 0; c < board.size; c++) {
      const cell = board.cells[r][c];
      if (cell.kind === 'source') {
        poweredKeys.add(`${r},${c}`);
        queue.push({ r, c });
      } else if (cell.kind === 'green') {
        totalGreens++;
      }
    }
  }

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const cell = board.cells[curr.r][curr.c];
    // Terminal nodes (green / red) absorb surge rather than conducting through
    if (cell.kind === 'green' || cell.kind === 'red') continue;

    const ports = getCellPorts(cell);
    for (const dir of ports) {
      const delta = DIR_DELTAS[dir];
      const nr = curr.r + delta.dr;
      const nc = curr.c + delta.dc;
      if (nr < 0 || nr >= board.size || nc < 0 || nc >= board.size) continue;

      const key = `${nr},${nc}`;
      if (poweredKeys.has(key)) continue;

      const neighbor = board.cells[nr][nc];
      const neighborPorts = getCellPorts(neighbor);
      if (neighborPorts.includes(delta.opposite)) {
        poweredKeys.add(key);
        if (neighbor.kind === 'green') {
          poweredGreens++;
        } else if (neighbor.kind === 'red') {
          poweredReds++;
        } else {
          queue.push({ r: nr, c: nc });
        }
      }
    }
  }

  const allGreensPowered = totalGreens > 0 && poweredGreens === totalGreens;
  const anyRedPowered = poweredReds > 0;

  return {
    poweredKeys,
    poweredGreens,
    totalGreens,
    poweredReds,
    allGreensPowered,
    anyRedPowered,
    isSolved: allGreensPowered && !anyRedPowered,
  };
}

export function rotateCircuitCell(board: CircuitBoard, r: number, c: number): CircuitBoard {
  const target = board.cells[r]?.[c];
  if (!target || target.kind !== 'conduit') return board;

  const nextCells = board.cells.map((row, ri) =>
    ri === r
      ? row.map((cell, ci) =>
          ci === c ? { ...cell, rotation: (cell.rotation + 1) % 4 } : cell
        )
      : row
  );

  return { ...board, cells: nextCells };
}

export function generateCircuitBoard(
  round: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): CircuitBoard {
  const size = difficulty === 'hard' || round >= 3 ? 6 : 5;
  const greenTargets = round === 1 && difficulty === 'easy' ? 1 : round >= 4 || difficulty === 'hard' ? 3 : 2;
  const redHazards = difficulty === 'easy' ? 1 : difficulty === 'normal' ? 2 : 3;

  for (let attempt = 0; attempt < 50; attempt++) {
    const sourceRow = Math.floor(rng() * size);
    const occupied = new Set<string>([`${sourceRow},0`]);

    // Place green target nodes in right columns
    const greenCoords: { r: number; c: number }[] = [];
    const candidateCols = size === 6 ? [4, 5] : [3, 4];
    let guard = 0;
    while (greenCoords.length < greenTargets && guard < 60) {
      guard++;
      const r = Math.floor(rng() * size);
      const c = candidateCols[Math.floor(rng() * candidateCols.length)];
      const key = `${r},${c}`;
      if (!occupied.has(key)) {
        occupied.add(key);
        greenCoords.push({ r, c });
      }
    }
    if (greenCoords.length < greenTargets) continue;

    // Place red hazard nodes away from source immediate right
    const redCoords: { r: number; c: number }[] = [];
    guard = 0;
    while (redCoords.length < redHazards && guard < 80) {
      guard++;
      const r = Math.floor(rng() * size);
      const c = 1 + Math.floor(rng() * (size - 1));
      const key = `${r},${c}`;
      if (!occupied.has(key) && !(r === sourceRow && c === 1)) {
        occupied.add(key);
        redCoords.push({ r, c });
      }
    }
    if (redCoords.length < redHazards) continue;

    // Carve valid paths from source to each green node avoiding red & other green interiors
    const blockedSet = new Set<string>([
      ...redCoords.map((p) => `${p.r},${p.c}`),
      ...greenCoords.map((p) => `${p.r},${p.c}`),
    ]);

    const edgeMap = new Map<string, Set<Direction>>();
    const addEdge = (r1: number, c1: number, d1: Direction, r2: number, c2: number, d2: Direction) => {
      const k1 = `${r1},${c1}`;
      const k2 = `${r2},${c2}`;
      if (!edgeMap.has(k1)) edgeMap.set(k1, new Set());
      if (!edgeMap.has(k2)) edgeMap.set(k2, new Set());
      edgeMap.get(k1)!.add(d1);
      edgeMap.get(k2)!.add(d2);
    };

    let carvedAll = true;
    for (const target of greenCoords) {
      // Randomized BFS avoiding red/other-green cells
      const targetKey = `${target.r},${target.c}`;
      const parent = new Map<string, { pr: number; pc: number; dirFromParent: Direction }>();
      const visited = new Set<string>([`${sourceRow},0`]);
      const bfsQueue: { r: number; c: number }[] = [{ r: sourceRow, c: 0 }];
      let found = false;

      while (bfsQueue.length > 0) {
        const curr = bfsQueue.shift()!;
        const dirs = [...ALL_DIRS].sort(() => rng() - 0.5);

        for (const dir of dirs) {
          const delta = DIR_DELTAS[dir];
          const nr = curr.r + delta.dr;
          const nc = curr.c + delta.dc;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          const nKey = `${nr},${nc}`;
          if (visited.has(nKey)) continue;
          if (nKey !== targetKey && blockedSet.has(nKey)) continue;

          visited.add(nKey);
          parent.set(nKey, { pr: curr.r, pc: curr.c, dirFromParent: dir });

          if (nKey === targetKey) {
            found = true;
            break;
          }
          bfsQueue.push({ r: nr, c: nc });
        }
        if (found) break;
      }

      if (!found) {
        carvedAll = false;
        break;
      }

      // Walk back and record edges
      let curKey = targetKey;
      let cr = target.r;
      let cc = target.c;
      while (curKey !== `${sourceRow},0`) {
        const p = parent.get(curKey)!;
        const opp = DIR_DELTAS[p.dirFromParent].opposite;
        addEdge(p.pr, p.pc, p.dirFromParent, cr, cc, opp);
        cr = p.pr;
        cc = p.pc;
        curKey = `${cr},${cc}`;
      }
    }

    if (!carvedAll) continue;

    // Build cells grid
    const decoyShapes: ConduitShape[] = ['STRAIGHT', 'CORNER', 'TEE'];
    const greenSet = new Set(greenCoords.map((p) => `${p.r},${p.c}`));
    const redSet = new Set(redCoords.map((p) => `${p.r},${p.c}`));

    const cells: CircuitCell[][] = [];
    for (let r = 0; r < size; r++) {
      const row: CircuitCell[] = [];
      for (let c = 0; c < size; c++) {
        const key = `${r},${c}`;
        if (r === sourceRow && c === 0) {
          row.push({ r, c, kind: 'source', rotation: 0, solutionRotation: 0 });
        } else if (greenSet.has(key)) {
          row.push({ r, c, kind: 'green', rotation: 0, solutionRotation: 0 });
        } else if (redSet.has(key)) {
          row.push({ r, c, kind: 'red', rotation: 0, solutionRotation: 0 });
        } else if (edgeMap.has(key)) {
          const reqDirs = Array.from(edgeMap.get(key)!);
          const { shape, rotation } = findShapeAndRotation(reqDirs);
          row.push({
            r,
            c,
            kind: 'conduit',
            shape,
            rotation,
            solutionRotation: rotation,
          });
        } else {
          const shape = decoyShapes[Math.floor(rng() * decoyShapes.length)];
          const rot = Math.floor(rng() * 4);
          row.push({
            r,
            c,
            kind: 'conduit',
            shape,
            rotation: rot,
            solutionRotation: rot,
          });
        }
      }
      cells.push(row);
    }

    const solutionBoard: CircuitBoard = { round, size, cells, greenTargets, redHazards };
    const solutionCheck = computeCircuitFlow(solutionBoard);
    if (!solutionCheck.isSolved) continue;

    // Scramble conduit rotations so player must solve it
    const scrambledCells = cells.map((row) =>
      row.map((cell) => {
        if (cell.kind !== 'conduit') return cell;
        const offset = 1 + Math.floor(rng() * 3);
        return { ...cell, rotation: (cell.rotation + offset) % 4 };
      })
    );

    const scrambledBoard: CircuitBoard = {
      round,
      size,
      cells: scrambledCells,
      greenTargets,
      redHazards,
    };

    if (!computeCircuitFlow(scrambledBoard).isSolved) {
      return scrambledBoard;
    }
  }

  // Deterministic clean 5x5 fallback
  const fallbackCells: CircuitCell[][] = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => {
      if (r === 2 && c === 0) return { r, c, kind: 'source', rotation: 0, solutionRotation: 0 };
      if (r === 2 && c === size - 1) return { r, c, kind: 'green', rotation: 0, solutionRotation: 0 };
      if (r === 1 && c === 2) return { r, c, kind: 'red', rotation: 0, solutionRotation: 0 };
      if (r === 2) {
        return {
          r,
          c,
          kind: 'conduit',
          shape: 'STRAIGHT',
          rotation: c % 2 === 0 ? 0 : 1,
          solutionRotation: 1,
        };
      }
      return { r, c, kind: 'conduit', shape: 'CORNER', rotation: (r + c) % 4 };
    })
  );

  return {
    round,
    size,
    cells: fallbackCells,
    greenTargets: 1,
    redHazards: 1,
  };
}
