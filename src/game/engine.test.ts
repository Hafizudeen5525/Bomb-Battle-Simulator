import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBonusDefuseSeconds,
  getRoomDurationSeconds,
} from './config';
import {
  generatePowerGridPuzzle,
  validatePowerGridBoard,
  type PathMap,
} from './powerGrid';
import {
  generateMelodyLevel,
  evaluateMelodyStep,
} from './melodyHack';
import {
  generateDecryptWave,
  generateMathOverride,
  shouldTriggerOverride,
} from './decrypt';
import {
  generateCircuitBoard,
  computeCircuitFlow,
  rotateCircuitCell,
} from './bombDefuse';
import { sortScoreboard } from './scoreboard';

function makeSeededRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test('Power Grid generates guaranteed solvable puzzles across levels and difficulties', () => {
  const rng = makeSeededRng(42);
  const difficulties = ['easy', 'normal', 'hard'] as const;

  for (const diff of difficulties) {
    for (let level = 1; level <= 6; level++) {
      const puzzle = generatePowerGridPuzzle(level, diff, rng);
      assert.ok(puzzle.size >= 5 && puzzle.size <= 8);
      assert.ok(puzzle.pairs.length >= 4);

      const solutionPaths: PathMap = {};
      for (const pair of puzzle.pairs) {
        solutionPaths[pair.colorIndex] = pair.solutionPath;
      }

      const validation = validatePowerGridBoard(puzzle, solutionPaths);
      assert.equal(validation.allConnected, true, `Level ${level} (${diff}) should solve via solutionPath`);
      assert.equal(validation.fullCoverage, true, `Level ${level} (${diff}) should cover entire grid`);
      assert.equal(validation.isSolved, true);
    }
  }
});

test('Power Grid rejects overlapping paths', () => {
  const rng = makeSeededRng(101);
  const puzzle = generatePowerGridPuzzle(1, 'easy', rng);
  const paths: PathMap = {};
  for (const pair of puzzle.pairs) {
    paths[pair.colorIndex] = [...pair.solutionPath];
  }
  // Force overlap by duplicating first cell of pair 1 into pair 0
  paths[puzzle.pairs[0].colorIndex].push(puzzle.pairs[1].a);
  const validation = validatePowerGridBoard(puzzle, paths);
  assert.equal(validation.isSolved, false);
});

test('Melody Hack generates valid sequences and evaluates steps accurately', () => {
  const rng = makeSeededRng(77);
  const lvl1 = generateMelodyLevel(1, 'normal', rng);
  const lvl4 = generateMelodyLevel(4, 'hard', rng);

  assert.equal(lvl1.sequence.length, 4);
  assert.equal(lvl4.sequence.length, 8);
  assert.ok(lvl4.stepIntervalMs < lvl1.stepIntervalMs);

  // Simulate playing exact sequence
  let idx = 0;
  for (let i = 0; i < lvl1.sequence.length - 1; i++) {
    const res = evaluateMelodyStep(lvl1.sequence, idx, lvl1.sequence[i]);
    assert.equal(res.status, 'continue');
    idx = res.nextIndex;
  }
  const finalRes = evaluateMelodyStep(lvl1.sequence, idx, lvl1.sequence[lvl1.sequence.length - 1]);
  assert.equal(finalRes.status, 'completed');

  // Wrong step returns mistake
  const wrongPad = (lvl1.sequence[0] + 1) % lvl1.padCount;
  const errRes = evaluateMelodyStep(lvl1.sequence, 0, wrongPad);
  assert.equal(errRes.status, 'mistake');
  assert.equal(errRes.nextIndex, 0);
});

test('Decrypt generates full 1-100 terminals and valid math overrides', () => {
  const rng = makeSeededRng(999);
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    const wave = generateDecryptWave(1, diff, rng);
    assert.equal(wave.terminals.length, 4);

    const seen = new Set<number>();
    for (const term of wave.terminals) {
      assert.equal(term.length, 25);
      for (const tile of term) {
        seen.add(tile.value);
      }
    }
    assert.equal(seen.size, 100);
    for (let n = 1; n <= 100; n++) {
      assert.equal(seen.has(n), true, `Missing number ${n}`);
    }

    const override = generateMathOverride(diff, rng);
    assert.equal(override.options.length, 4);
    assert.ok(override.options.includes(override.answer));
  }

  assert.equal(shouldTriggerOverride(26, 'normal'), true);
  assert.equal(shouldTriggerOverride(27, 'normal'), false);
});

test('Bomb Defuse Circuit Cracker generates solvable scrambled boards that solve when set to solutionRotation', () => {
  const rng = makeSeededRng(2026);
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    for (let round = 1; round <= 5; round++) {
      const board = generateCircuitBoard(round, diff, rng);
      const initialFlow = computeCircuitFlow(board);
      assert.equal(initialFlow.isSolved, false, `Scrambled round ${round} (${diff}) should not start solved`);

      // Restore solution rotations
      const solvedBoard = {
        ...board,
        cells: board.cells.map((row) =>
          row.map((cell) =>
            cell.kind === 'conduit' && cell.solutionRotation !== undefined
              ? { ...cell, rotation: cell.solutionRotation }
              : cell
          )
        ),
      };

      const solvedFlow = computeCircuitFlow(solvedBoard);
      assert.equal(solvedFlow.allGreensPowered, true, `Round ${round} (${diff}) solution must power all greens`);
      assert.equal(solvedFlow.anyRedPowered, false, `Round ${round} (${diff}) solution must avoid red hazards`);
      assert.equal(solvedFlow.isSolved, true);

      // Verify rotateCircuitCell cycles 0..3
      const conduit = board.cells.flat().find((c) => c.kind === 'conduit')!;
      const rotated = rotateCircuitCell(board, conduit.r, conduit.c);
      assert.equal(rotated.cells[conduit.r][conduit.c].rotation, (conduit.rotation + 1) % 4);
    }
  }
});

test('Score bonus conversion and scoreboard sorting behave deterministically', () => {
  assert.equal(calculateBonusDefuseSeconds(0), 0);
  assert.equal(calculateBonusDefuseSeconds(1500), 10);
  assert.equal(calculateBonusDefuseSeconds(999999), 90);

  const defuseSeconds = getRoomDurationSeconds('bomb-defuse', 'normal', 'standard', 12);
  assert.equal(defuseSeconds, 60 + 15 + 12);

  const sorted = sortScoreboard([
    {
      id: 'a',
      callsign: 'A',
      mode: 'campaign',
      gameId: 'campaign',
      difficulty: 'normal',
      timerScale: 'standard',
      score: 1200,
      levelsCleared: 4,
      timeRemaining: 5,
      outcome: 'BLASTED',
      timestamp: 100,
    },
    {
      id: 'b',
      callsign: 'B',
      mode: 'campaign',
      gameId: 'campaign',
      difficulty: 'normal',
      timerScale: 'standard',
      score: 4200,
      levelsCleared: 10,
      timeRemaining: 14,
      outcome: 'DEFUSED',
      timestamp: 50,
    },
  ]);

  assert.equal(sorted[0].id, 'b');
});
