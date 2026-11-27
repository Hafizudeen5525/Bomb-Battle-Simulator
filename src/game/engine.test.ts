import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBonusDefuseSeconds,
  getRoomDurationSeconds,
} from './config';
import {
  generatePowerGridPuzzle,
  interpolateDragSteps,
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
  evalGate,
  evaluateLogicCircuit,
  generateLogicCircuitPuzzle,
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

test('Bomb Defuse Logic Gates evaluate truth tables and generate guaranteed solvable puzzles', () => {
  // Verify truth tables for all 6 gate types
  assert.equal(evalGate('AND', [true, true]), true);
  assert.equal(evalGate('AND', [true, false]), false);
  assert.equal(evalGate('OR', [false, true]), true);
  assert.equal(evalGate('OR', [false, false]), false);
  assert.equal(evalGate('XOR', [true, false]), true);
  assert.equal(evalGate('XOR', [true, true]), false);
  assert.equal(evalGate('NOT', [false]), true);
  assert.equal(evalGate('NOT', [true]), false);
  assert.equal(evalGate('NAND', [true, true]), false);
  assert.equal(evalGate('NAND', [true, false]), true);
  assert.equal(evalGate('NOR', [false, false]), true);
  assert.equal(evalGate('NOR', [true, false]), false);

  const rng = makeSeededRng(2026);
  for (const diff of ['easy', 'normal', 'hard'] as const) {
    for (let round = 1; round <= 5; round++) {
      const puzzle = generateLogicCircuitPuzzle(round, diff, rng);
      const initialEval = evaluateLogicCircuit(puzzle, puzzle.initialInputs);
      assert.equal(
        initialEval.isSolved,
        false,
        `Round ${round} (${diff}) should not start already solved`
      );

      let winningCombinations = 0;
      const totalStates = 1 << puzzle.numInputs;
      for (let mask = 0; mask < totalStates; mask++) {
        const vec = Array.from(
          { length: puzzle.numInputs },
          (_, bit) => Boolean((mask >> bit) & 1)
        );
        const ev = evaluateLogicCircuit(puzzle, vec);
        if (ev.isSolved) {
          assert.equal(ev.allGreensPowered, true);
          assert.equal(ev.anyRedPowered, false);
          winningCombinations++;
        }
      }

      assert.ok(
        winningCombinations >= 1,
        `Round ${round} (${diff}) must have at least 1 valid pump combination`
      );
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

test('Power Grid drag interpolation handles orthogonal, fast-2, and diagonal corner drags', () => {
  // Orthogonal 1-step
  assert.deepEqual(
    interpolateDragSteps({ r: 0, c: 0 }, { r: 0, c: 1 }, () => true),
    [{ r: 0, c: 1 }]
  );

  // Fast 2-step straight swipe
  assert.deepEqual(
    interpolateDragSteps({ r: 1, c: 0 }, { r: 1, c: 2 }, () => true),
    [{ r: 1, c: 1 }, { r: 1, c: 2 }]
  );

  // Diagonal 1x1 move routes around blocked corner A via corner B
  const steps = interpolateDragSteps(
    { r: 0, c: 0 },
    { r: 1, c: 1 },
    (c) => !(c.r === 0 && c.c === 1)
  );
  assert.deepEqual(steps, [{ r: 1, c: 0 }, { r: 1, c: 1 }]);
});

