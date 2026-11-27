import type { Difficulty } from './types';

export type GateType = 'AND' | 'OR' | 'XOR' | 'NAND' | 'NOR' | 'NOT';

export interface GateRuleInfo {
  type: GateType;
  label: string;
  description: string;
  accentHex: string;
}

export const GATE_RULES: Record<GateType, GateRuleInfo> = {
  AND: {
    type: 'AND',
    label: 'AND Gate',
    description: 'Requires BOTH active electric paths (1 & 1) to pass power through.',
    accentHex: '#3B82F6',
  },
  OR: {
    type: 'OR',
    label: 'OR Gate',
    description: 'Passes power through if AT LEAST ONE input path is active.',
    accentHex: '#10B981',
  },
  XOR: {
    type: 'XOR',
    label: 'XOR Gate',
    description: 'Only requires one active electric path to pass through, but disables if greater than one.',
    accentHex: '#22C55E',
  },
  NOT: {
    type: 'NOT',
    label: 'NOT Gate',
    description: 'Inverts the signal: passes power only when the input path is OFF.',
    accentHex: '#F59E0B',
  },
  NAND: {
    type: 'NAND',
    label: 'NAND Gate',
    description: 'Passes power UNLESS both input paths are active at the same time.',
    accentHex: '#6366F1',
  },
  NOR: {
    type: 'NOR',
    label: 'NOR Gate',
    description: 'Passes power ONLY when both input paths are OFF.',
    accentHex: '#EC4899',
  },
};

export type SignalRef =
  | { kind: 'input'; index: number }
  | { kind: 'gate'; id: string };

export interface LogicGateNode {
  id: string;
  layer: 1 | 2;
  slotIndex: number;
  type: GateType;
  inputs: SignalRef[];
}

export interface OutputTerminal {
  id: string;
  kind: 'green' | 'red';
  slotIndex: number;
  sourceGateId: string;
}

export interface LogicCircuitPuzzle {
  round: number;
  numInputs: number;
  initialInputs: boolean[];
  midGates: LogicGateNode[];
  outGates: LogicGateNode[];
  outputs: OutputTerminal[];
  solutionCount: number;
}

export interface LogicCircuitEvaluation {
  inputValues: boolean[];
  gateOutputs: Record<string, boolean>;
  outputValues: Record<string, boolean>;
  poweredGreens: number;
  totalGreens: number;
  poweredReds: number;
  allGreensPowered: boolean;
  anyRedPowered: boolean;
  isSolved: boolean;
}

export function evalGate(type: GateType, inputs: boolean[]): boolean {
  const a = Boolean(inputs[0]);
  const b = Boolean(inputs[1]);
  switch (type) {
    case 'AND':
      return a && b;
    case 'OR':
      return a || b;
    case 'XOR':
      return a !== b;
    case 'NOT':
      return !a;
    case 'NAND':
      return !(a && b);
    case 'NOR':
      return !(a || b);
  }
}

export function evaluateLogicCircuit(
  puzzle: LogicCircuitPuzzle,
  inputStates: boolean[]
): LogicCircuitEvaluation {
  const inputValues = Array.from({ length: puzzle.numInputs }, (_, i) =>
    Boolean(inputStates[i])
  );
  const gateOutputs: Record<string, boolean> = {};

  const resolve = (ref: SignalRef): boolean => {
    if (ref.kind === 'input') return inputValues[ref.index] ?? false;
    return gateOutputs[ref.id] ?? false;
  };

  for (const gate of puzzle.midGates) {
    gateOutputs[gate.id] = evalGate(
      gate.type,
      gate.inputs.map(resolve)
    );
  }

  for (const gate of puzzle.outGates) {
    gateOutputs[gate.id] = evalGate(
      gate.type,
      gate.inputs.map(resolve)
    );
  }

  const outputValues: Record<string, boolean> = {};
  let poweredGreens = 0;
  let totalGreens = 0;
  let poweredReds = 0;

  for (const out of puzzle.outputs) {
    const val = gateOutputs[out.sourceGateId] ?? false;
    outputValues[out.id] = val;
    if (out.kind === 'green') {
      totalGreens++;
      if (val) poweredGreens++;
    } else if (val) {
      poweredReds++;
    }
  }

  const allGreensPowered = totalGreens > 0 && poweredGreens === totalGreens;
  const anyRedPowered = poweredReds > 0;

  return {
    inputValues,
    gateOutputs,
    outputValues,
    poweredGreens,
    totalGreens,
    poweredReds,
    allGreensPowered,
    anyRedPowered,
    isSolved: allGreensPowered && !anyRedPowered,
  };
}

function pick<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

function getGatePool(round: number, difficulty: Difficulty): GateType[] {
  if (difficulty === 'easy' && round <= 2) {
    return ['AND', 'OR', 'XOR', 'NOT'];
  }
  if (difficulty === 'normal' && round <= 1) {
    return ['AND', 'OR', 'XOR', 'NOT'];
  }
  return ['AND', 'OR', 'XOR', 'NOT', 'NAND', 'NOR'];
}

export function generateLogicCircuitPuzzle(
  round: number,
  difficulty: Difficulty,
  rng: () => number = Math.random
): LogicCircuitPuzzle {
  const numInputs =
    difficulty === 'hard' || round >= 4
      ? 4
      : difficulty === 'easy' && round === 1
      ? 2
      : 3;

  const greenCount = round >= 3 || difficulty === 'hard' ? 2 : 1;
  const redCount = round >= 5 && difficulty === 'hard' ? 2 : 1;
  const outCount = greenCount + redCount;
  const midCount = numInputs >= 4 ? 3 : 2;
  const gatePool = getGatePool(round, difficulty);

  const totalStates = 1 << numInputs;
  const maxAllowedSolutions = Math.max(2, Math.floor(totalStates * 0.38));

  for (let attempt = 0; attempt < 240; attempt++) {
    // Build Layer 1 (midGates)
    const midGates: LogicGateNode[] = [];
    for (let m = 0; m < midCount; m++) {
      const type = pick(gatePool, rng);
      const i1 = m % numInputs;
      let i2 = Math.floor(rng() * numInputs);
      if (i2 === i1) i2 = (i1 + 1) % numInputs;

      const inputs: SignalRef[] =
        type === 'NOT'
          ? [{ kind: 'input', index: i1 }]
          : [
              { kind: 'input', index: i1 },
              { kind: 'input', index: i2 },
            ];

      midGates.push({
        id: `m-${m}`,
        layer: 1,
        slotIndex: m,
        type,
        inputs,
      });
    }

    // Build Layer 2 (outGates) wired from midGates + direct input lines
    const outGates: LogicGateNode[] = [];
    for (let o = 0; o < outCount; o++) {
      const type = pick(gatePool, rng);
      const primaryMid: SignalRef = { kind: 'gate', id: midGates[o % midCount].id };

      // Second input can come from another midGate or a direct input line (authentic to the game)
      let secondRef: SignalRef;
      if (midCount > 1 && rng() < 0.55) {
        const otherMidIdx = (o + 1) % midCount;
        secondRef = { kind: 'gate', id: midGates[otherMidIdx].id };
      } else {
        const directIdx = (o + numInputs - 1) % numInputs;
        secondRef = { kind: 'input', index: directIdx };
      }

      const inputs: SignalRef[] =
        type === 'NOT' ? [primaryMid] : [primaryMid, secondRef];

      outGates.push({
        id: `o-${o}`,
        layer: 2,
        slotIndex: o,
        type,
        inputs,
      });
    }

    // Assign output terminals (Green top, Red bottom, or interleaved)
    const outputs: OutputTerminal[] = [];
    for (let o = 0; o < outCount; o++) {
      outputs.push({
        id: `term-${o}`,
        kind: o < greenCount ? 'green' : 'red',
        slotIndex: o,
        sourceGateId: outGates[o].id,
      });
    }

    const candidate: LogicCircuitPuzzle = {
      round,
      numInputs,
      initialInputs: new Array<boolean>(numInputs).fill(false),
      midGates,
      outGates,
      outputs,
      solutionCount: 0,
    };

    // Exhaustively evaluate all 2^numInputs combinations
    const winningMasks: number[] = [];
    const nonWinningMasks: number[] = [];

    for (let mask = 0; mask < totalStates; mask++) {
      const vec = Array.from(
        { length: numInputs },
        (_, bit) => Boolean((mask >> bit) & 1)
      );
      const ev = evaluateLogicCircuit(candidate, vec);
      if (ev.isSolved) {
        winningMasks.push(mask);
      } else {
        nonWinningMasks.push(mask);
      }
    }

    if (
      winningMasks.length >= 1 &&
      winningMasks.length <= maxAllowedSolutions &&
      nonWinningMasks.length >= 1
    ) {
      // Prefer starting with all-OFF (0) if it's non-winning, otherwise pick a non-winning mask
      const startMask = nonWinningMasks.includes(0)
        ? 0
        : pick(nonWinningMasks, rng);
      candidate.initialInputs = Array.from(
        { length: numInputs },
        (_, bit) => Boolean((startMask >> bit) & 1)
      );
      candidate.solutionCount = winningMasks.length;
      return candidate;
    }
  }

  // Deterministic guaranteed-solvable fallback matching the TikTok layout:
  // A XOR B -> top goes with C into AND -> GREEN; bottom goes with C into NOR -> RED
  return {
    round,
    numInputs: Math.max(2, numInputs),
    initialInputs: new Array<boolean>(Math.max(2, numInputs)).fill(false),
    midGates: [
      {
        id: 'm-0',
        layer: 1,
        slotIndex: 0,
        type: 'XOR',
        inputs: [
          { kind: 'input', index: 0 },
          { kind: 'input', index: 1 },
        ],
      },
    ],
    outGates: [
      {
        id: 'o-0',
        layer: 2,
        slotIndex: 0,
        type: 'AND',
        inputs: [
          { kind: 'gate', id: 'm-0' },
          { kind: 'input', index: numInputs >= 3 ? 2 : 0 },
        ],
      },
      {
        id: 'o-1',
        layer: 2,
        slotIndex: 1,
        type: 'NOR',
        inputs: [
          { kind: 'gate', id: 'm-0' },
          { kind: 'input', index: numInputs >= 3 ? 2 : 1 },
        ],
      },
    ],
    outputs: [
      { id: 'term-0', kind: 'green', slotIndex: 0, sourceGateId: 'o-0' },
      { id: 'term-1', kind: 'red', slotIndex: 1, sourceGateId: 'o-1' },
    ],
    solutionCount: 1,
  };
}
