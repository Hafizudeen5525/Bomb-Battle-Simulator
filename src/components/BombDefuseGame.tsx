import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, ShieldCheck, Zap } from 'lucide-react';
import {
  GATE_RULES,
  evaluateLogicCircuit,
  generateLogicCircuitPuzzle,
  type GateType,
  type LogicCircuitPuzzle,
  type LogicGateNode,
  type SignalRef,
} from '../game/bombDefuse';
import { DIFFICULTY_CONFIG } from '../game/config';
import { soundEngine } from '../game/audio';
import type { Difficulty } from '../game/types';

interface BombDefuseGameProps {
  difficulty: Difficulty;
  paused: boolean;
  onScoreAdd: (points: number) => void;
  onTimePenalty: (seconds: number) => void;
  onLevelCleared: () => void;
  onBombDefused: () => void;
}

const SVG_W = 700;
const SVG_H = 400;
const PUMP_X = 64;
const PUMP_OUT_X = 112;
const MID_X = 280;
const OUT_X = 485;
const TERM_X = 638;
const GATE_HALF_W = 30;
const GATE_HALF_H = 26;

function slotY(index: number, count: number, topPad: number, bottomPad: number): number {
  if (count <= 1) return (topPad + bottomPad) / 2;
  return topPad + (index * (bottomPad - topPad)) / (count - 1);
}

function octagonPoints(cx: number, cy: number, r: number): string {
  const c = r * 0.42;
  return [
    `${cx - c},${cy - r}`,
    `${cx + c},${cy - r}`,
    `${cx + r},${cy - c}`,
    `${cx + r},${cy + c}`,
    `${cx + c},${cy + r}`,
    `${cx - c},${cy + r}`,
    `${cx - r},${cy + c}`,
    `${cx - r},${cy - c}`,
  ].join(' ');
}

function uniqueGateTypes(puzzle: LogicCircuitPuzzle): GateType[] {
  const seen = new Set<GateType>();
  for (const g of puzzle.midGates) seen.add(g.type);
  for (const g of puzzle.outGates) seen.add(g.type);
  return Array.from(seen);
}

function defaultInspectedGate(puzzle: LogicCircuitPuzzle): GateType {
  const types = uniqueGateTypes(puzzle);
  if (types.includes('XOR')) return 'XOR';
  return types[0] ?? 'AND';
}

export const BombDefuseGame: React.FC<BombDefuseGameProps> = ({
  difficulty,
  paused,
  onScoreAdd,
  onTimePenalty,
  onLevelCleared,
  onBombDefused,
}) => {
  const locksRequired = DIFFICULTY_CONFIG[difficulty].bombLocksRequired;
  const [round, setRound] = useState(1);
  const [puzzle, setPuzzle] = useState<LogicCircuitPuzzle>(() =>
    generateLogicCircuitPuzzle(1, difficulty)
  );
  const [inputStates, setInputStates] = useState<boolean[]>(() =>
    generateInitialStates(puzzle)
  );
  const [inspectedGate, setInspectedGate] = useState<GateType>(() =>
    defaultInspectedGate(puzzle)
  );
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'neutral' | 'success' | 'danger';
  }>({
    text: 'Toggle input pumps through the logic gates to power all GREEN targets while keeping RED hazards OFF.',
    tone: 'neutral',
  });
  const [shaking, setShaking] = useState(false);

  const evaluation = useMemo(
    () => evaluateLogicCircuit(puzzle, inputStates),
    [puzzle, inputStates]
  );

  const presentGateTypes = useMemo(() => uniqueGateTypes(puzzle), [puzzle]);

  const togglePump = useCallback(
    (index: number) => {
      if (paused) return;
      if (index < 0 || index >= puzzle.numInputs) return;
      soundEngine.playClick(1.15 + index * 0.08);
      setInputStates((prev) => prev.map((v, i) => (i === index ? !v : v)));
    },
    [paused, puzzle.numInputs]
  );

  const handlePumpSurge = useCallback(() => {
    if (paused) return;

    if (evaluation.anyRedPowered) {
      const penalty = DIFFICULTY_CONFIG[difficulty].mistakeTimePenalty + 1;
      soundEngine.playPumpSurge(false);
      onTimePenalty(penalty);
      setShaking(true);
      setStatusMessage({
        text: `SHORT CIRCUIT! Surge reached RED hazard button (-${penalty}s countdown penalty)`,
        tone: 'danger',
      });
      window.setTimeout(() => setShaking(false), 360);
      return;
    }

    if (!evaluation.allGreensPowered) {
      soundEngine.playError();
      onTimePenalty(2);
      setStatusMessage({
        text: `CIRCUIT INCOMPLETE (${evaluation.poweredGreens}/${evaluation.totalGreens} Green Powered) — -2s penalty`,
        tone: 'danger',
      });
      return;
    }

    // Lock cracked!
    soundEngine.playPumpSurge(true);
    const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
    onScoreAdd(Math.round((300 + round * 80) * mult));
    onLevelCleared();

    if (round >= locksRequired) {
      soundEngine.playLevelClear();
      onBombDefused();
      return;
    }

    const nextRound = round + 1;
    const nextPuzzle = generateLogicCircuitPuzzle(nextRound, difficulty);
    setRound(nextRound);
    setPuzzle(nextPuzzle);
    setInputStates([...nextPuzzle.initialInputs]);
    setInspectedGate(defaultInspectedGate(nextPuzzle));
    setStatusMessage({
      text: `Lock ${round} cracked! Solve Logic Circuit Lock ${nextRound} of ${locksRequired}.`,
      tone: 'success',
    });
  }, [
    paused,
    evaluation,
    difficulty,
    round,
    locksRequired,
    onTimePenalty,
    onScoreAdd,
    onLevelCleared,
    onBombDefused,
  ]);

  // Keyboard shortcuts: 1-4 toggle Pumps A-D, Space triggers Pump Energy Surge
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePumpSurge();
        return;
      }
      if (e.key >= '1' && e.key <= '4') {
        const idx = Number(e.key) - 1;
        if (idx < puzzle.numInputs) {
          e.preventDefault();
          togglePump(idx);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, puzzle.numInputs, togglePump, handlePumpSurge]);

  // Precompute Y coordinates for inputs, midGates, outGates, and outputs
  const inputYs = useMemo(
    () =>
      Array.from({ length: puzzle.numInputs }, (_, i) =>
        slotY(i, puzzle.numInputs, 62, 316)
      ),
    [puzzle.numInputs]
  );

  const midYs = useMemo(
    () =>
      puzzle.midGates.map((_, i) =>
        slotY(i, puzzle.midGates.length, 76, 304)
      ),
    [puzzle.midGates]
  );

  const outYs = useMemo(
    () =>
      puzzle.outGates.map((_, i) =>
        slotY(i, puzzle.outGates.length, 72, 316)
      ),
    [puzzle.outGates]
  );

  const midIndexById = useMemo(() => {
    const map = new Map<string, number>();
    puzzle.midGates.forEach((g, idx) => map.set(g.id, idx));
    return map;
  }, [puzzle.midGates]);

  const resolveSignalActive = (ref: SignalRef): boolean => {
    if (ref.kind === 'input') return evaluation.inputValues[ref.index] ?? false;
    return evaluation.gateOutputs[ref.id] ?? false;
  };

  const renderGateNode = (gate: LogicGateNode, cx: number, cy: number) => {
    const outputActive = evaluation.gateOutputs[gate.id] ?? false;
    const rule = GATE_RULES[gate.type];
    const isSelected = inspectedGate === gate.type;

    return (
      <g
        key={gate.id}
        transform={`translate(${cx}, ${cy})`}
        onClick={() => setInspectedGate(gate.type)}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        aria-label={`${rule.label} — click to inspect rule`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setInspectedGate(gate.type);
          }
        }}
      >
        {/* Selection halo */}
        {isSelected && (
          <rect
            x={-GATE_HALF_W - 4}
            y={-GATE_HALF_H - 4}
            width={(GATE_HALF_W + 4) * 2}
            height={(GATE_HALF_H + 4) * 2}
            rx={10}
            fill="none"
            stroke={rule.accentHex}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        )}

        {/* Gate housing */}
        <rect
          x={-GATE_HALF_W}
          y={-GATE_HALF_H}
          width={GATE_HALF_W * 2}
          height={GATE_HALF_H * 2}
          rx={7}
          fill={outputActive ? '#102438' : '#121826'}
          stroke={outputActive ? '#38BDF8' : rule.accentHex}
          strokeWidth={outputActive ? 2.5 : 1.75}
        />

        {/* Color accent header bar */}
        <rect
          x={-GATE_HALF_W + 2}
          y={-GATE_HALF_H + 2}
          width={GATE_HALF_W * 2 - 4}
          height={8}
          rx={4}
          fill={rule.accentHex}
          opacity={outputActive ? 0.95 : 0.65}
        />

        {/* Gate type text */}
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fill="#F8FAFC"
          fontSize="14"
          fontWeight="800"
          fontFamily="JetBrains Mono, monospace"
        >
          {gate.type}
        </text>

        {/* Live output bit badge */}
        <text
          x={0}
          y={19}
          textAnchor="middle"
          fill={outputActive ? '#38BDF8' : '#64748B'}
          fontSize="10"
          fontWeight="700"
          fontFamily="JetBrains Mono, monospace"
        >
          {outputActive ? 'OUT: 1' : 'OUT: 0'}
        </text>
      </g>
    );
  };

  const activeRule = GATE_RULES[inspectedGate];

  return (
    <div
      className={`w-full max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-5 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 ${
        shaking ? 'animate-shake' : ''
      }`}
    >
      {/* Left/Main TV Circuit Monitor */}
      <div className="w-full max-w-2xl bg-[#111621] border border-slate-800 rounded-xl p-3 sm:p-5 space-y-3.5">
        {/* Monitor Viewport */}
        <div className="bg-[#070B12] border-2 border-slate-800 rounded-lg p-2 sm:p-3 overflow-hidden">
          <svg
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            className="w-full h-auto block select-none"
            role="img"
            aria-label="Bomb Defuse digital logic gate circuit"
          >
            <defs>
              <pattern
                id="circuit-grid"
                width="28"
                height="28"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 28 0 L 0 0 0 28"
                  fill="none"
                  stroke="#0F172A"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width={SVG_W} height={SVG_H} fill="url(#circuit-grid)" />

            {/* Wires: Inputs -> Layer 1 Mid Gates */}
            {puzzle.midGates.map((gate, mIdx) => {
              const ty = midYs[mIdx];
              const isUnary = gate.inputs.length === 1;
              return gate.inputs.map((ref, portIdx) => {
                const active = resolveSignalActive(ref);
                const sy =
                  ref.kind === 'input' ? inputYs[ref.index] : midYs[0];
                const portY = ty + (isUnary ? 0 : portIdx === 0 ? -11 : 11);
                const inputIdx = ref.kind === 'input' ? ref.index : 0;
                const trunkX = 148 + inputIdx * 16 + portIdx * 7;
                const d = `M ${PUMP_OUT_X} ${sy} L ${trunkX} ${sy} L ${trunkX} ${portY} L ${
                  MID_X - GATE_HALF_W
                } ${portY}`;
                return (
                  <g key={`w-m-${gate.id}-${portIdx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={active ? '#0EA5E9' : '#1E293B'}
                      strokeWidth={active ? 7 : 5}
                      strokeLinejoin="round"
                    />
                    {active && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#7DD3FC"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                      />
                    )}
                  </g>
                );
              });
            })}

            {/* Wires: Layer 1 Mid Gates or Direct Inputs -> Layer 2 Out Gates */}
            {puzzle.outGates.map((gate, oIdx) => {
              const ty = outYs[oIdx];
              const isUnary = gate.inputs.length === 1;
              return gate.inputs.map((ref, portIdx) => {
                const active = resolveSignalActive(ref);
                const portY = ty + (isUnary ? 0 : portIdx === 0 ? -11 : 11);
                let d = '';

                if (ref.kind === 'gate') {
                  const mIdx = midIndexById.get(ref.id) ?? 0;
                  const sy = midYs[mIdx];
                  const sx = MID_X + GATE_HALF_W;
                  const trunkX = 344 + mIdx * 18 + oIdx * 6;
                  d = `M ${sx} ${sy} L ${trunkX} ${sy} L ${trunkX} ${portY} L ${
                    OUT_X - GATE_HALF_W
                  } ${portY}`;
                } else {
                  // Direct bottom/top bypass line matching the real game's screen
                  const sy = inputYs[ref.index];
                  const dropX = 128 + ref.index * 11;
                  const railY = 368 - ref.index * 9;
                  const riseX = 408 + oIdx * 11;
                  d = `M ${PUMP_OUT_X} ${sy} L ${dropX} ${sy} L ${dropX} ${railY} L ${riseX} ${railY} L ${riseX} ${portY} L ${
                    OUT_X - GATE_HALF_W
                  } ${portY}`;
                }

                return (
                  <g key={`w-o-${gate.id}-${portIdx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke={active ? '#0EA5E9' : '#1E293B'}
                      strokeWidth={active ? 7 : 5}
                      strokeLinejoin="round"
                    />
                    {active && (
                      <path
                        d={d}
                        fill="none"
                        stroke="#7DD3FC"
                        strokeWidth={2.5}
                        strokeLinejoin="round"
                      />
                    )}
                  </g>
                );
              });
            })}

            {/* Wires: Layer 2 Out Gates -> Output Terminals */}
            {puzzle.outputs.map((term, oIdx) => {
              const active = evaluation.outputValues[term.id] ?? false;
              const y = outYs[oIdx];
              const x1 = OUT_X + GATE_HALF_W;
              const x2 = TERM_X - 28;
              return (
                <g key={`w-term-${term.id}`}>
                  <line
                    x1={x1}
                    y1={y}
                    x2={x2}
                    y2={y}
                    stroke={
                      active
                        ? term.kind === 'green'
                          ? '#10B981'
                          : '#EF4444'
                        : '#1E293B'
                    }
                    strokeWidth={active ? 7 : 5}
                  />
                  {active && (
                    <line
                      x1={x1}
                      y1={y}
                      x2={x2}
                      y2={y}
                      stroke={term.kind === 'green' ? '#A7F3D0' : '#FCA5A5'}
                      strokeWidth={2.5}
                    />
                  )}
                </g>
              );
            })}

            {/* Left Pump Nozzles (Clickable inside SVG as well as Pump Deck below) */}
            {inputYs.map((y, idx) => {
              const on = evaluation.inputValues[idx] ?? false;
              const letter = String.fromCharCode(65 + idx);
              return (
                <g
                  key={`pump-${idx}`}
                  transform={`translate(${PUMP_X}, ${y})`}
                  onClick={() => togglePump(idx)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Toggle Input Pump ${letter} (${on ? 'ON' : 'OFF'})`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePump(idx);
                    }
                  }}
                >
                  {/* Nozzle body */}
                  <rect
                    x={-44}
                    y={-21}
                    width={72}
                    height={42}
                    rx={7}
                    fill={on ? '#0C2A44' : '#131A28'}
                    stroke={on ? '#38BDF8' : '#475569'}
                    strokeWidth={on ? 2.5 : 1.75}
                  />
                  {/* Brass/cyan nozzle collar */}
                  <rect
                    x={28}
                    y={-13}
                    width={20}
                    height={26}
                    rx={3}
                    fill={on ? '#0284C7' : '#334155'}
                    stroke={on ? '#7DD3FC' : '#64748B'}
                    strokeWidth={1.5}
                  />
                  <text
                    x={-8}
                    y={-1}
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="13"
                    fontWeight="800"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    PUMP {letter}
                  </text>
                  <text
                    x={-8}
                    y={14}
                    textAnchor="middle"
                    fill={on ? '#38BDF8' : '#94A3B8'}
                    fontSize="11"
                    fontWeight="700"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {on ? 'ON (1)' : 'OFF (0)'}
                  </text>
                </g>
              );
            })}

            {/* Layer 1 Mid Gates */}
            {puzzle.midGates.map((gate, i) =>
              renderGateNode(gate, MID_X, midYs[i])
            )}

            {/* Layer 2 Out Gates */}
            {puzzle.outGates.map((gate, i) =>
              renderGateNode(gate, OUT_X, outYs[i])
            )}

            {/* Right Output Octagon Terminals (Green Target / Red Hazard) */}
            {puzzle.outputs.map((term, oIdx) => {
              const active = evaluation.outputValues[term.id] ?? false;
              const y = outYs[oIdx];
              const isGreen = term.kind === 'green';
              const fill = isGreen
                ? active
                  ? '#10B981'
                  : '#064E3B'
                : active
                ? '#EF4444'
                : '#450A0A';
              const stroke = isGreen
                ? active
                  ? '#A7F3D0'
                  : '#10B981'
                : active
                ? '#FECACA'
                : '#DC2626';

              return (
                <g key={term.id}>
                  <polygon
                    points={octagonPoints(TERM_X, y, 27)}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={active ? 3.5 : 2.25}
                  />
                  <text
                    x={TERM_X}
                    y={y + 5}
                    textAnchor="middle"
                    fill={isGreen ? (active ? '#022C22' : '#6EE7B7') : '#FFFFFF'}
                    fontSize={isGreen ? '14' : '20'}
                    fontWeight="900"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {isGreen ? 'OK' : '!'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Tactile Pump Switch Deck (Large mobile-friendly buttons + 1-4 keyboard hints) */}
        <div>
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-slate-400 mb-2">
            <span>Input Pump Valves (Tap or press 1-{puzzle.numInputs})</span>
            <span className="font-mono-tabular text-cyan-400">
              {evaluation.inputValues.filter(Boolean).length}/{puzzle.numInputs} ACTIVE
            </span>
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${puzzle.numInputs}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: puzzle.numInputs }, (_, idx) => {
              const on = evaluation.inputValues[idx] ?? false;
              const letter = String.fromCharCode(65 + idx);
              return (
                <button
                  key={idx}
                  type="button"
                  data-testid={`pump-toggle-${idx}`}
                  aria-pressed={on}
                  aria-label={`Pump ${letter} ${on ? 'ON' : 'OFF'}`}
                  onPointerDown={(e) => {
                    if (e.button !== 0 && e.pointerType === 'mouse') return;
                    e.preventDefault();
                    togglePump(idx);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePump(idx);
                    }
                  }}
                  className={`py-2.5 px-2 rounded-lg border font-mono-tabular text-sm font-bold transition-colors touch-manipulation select-none cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    on
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                      : 'bg-[#0B0E14] border-slate-700 hover:border-slate-500 text-slate-400'
                  }`}
                >
                  <span className="text-xs">
                    [{idx + 1}] PUMP {letter}
                  </span>
                  <span
                    className={`text-[11px] font-extrabold ${
                      on ? 'text-cyan-300' : 'text-slate-500'
                    }`}
                  >
                    {on ? 'ON · 1' : 'OFF · 0'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Authentic Bottom Gate Rule Caption (Matches the Bomb Battle TV screen explanation) */}
        <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Info className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
              <span>Gate Reference</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {presentGateTypes.map((gt) => {
                const selected = inspectedGate === gt;
                return (
                  <button
                    key={gt}
                    type="button"
                    onClick={() => setInspectedGate(gt)}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono-tabular font-bold border transition-colors cursor-pointer ${
                      selected
                        ? 'bg-slate-800 text-white border-cyan-400'
                        : 'bg-[#111621] text-slate-400 border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    {gt}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <span
              className="font-mono-tabular font-bold mr-1.5"
              style={{ color: activeRule.accentHex }}
            >
              {activeRule.label}:
            </span>
            {activeRule.description}
          </p>
        </div>
      </div>

      {/* Right Control Station: Energy Pump & Lock Status */}
      <aside className="w-full max-w-md lg:w-88 bg-[#111621] border border-slate-800 rounded-xl p-5 space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
              Circuit Cracker
            </h3>
            <span className="font-mono-tabular text-xs font-bold text-cyan-400">
              LOCK {round} / {locksRequired}
            </span>
          </div>

          {/* Lock Progress Sockets */}
          <div
            className="flex items-center gap-2 mt-3"
            aria-label={`Circuit locks ${round - 1} of ${locksRequired} cracked`}
          >
            {Array.from({ length: locksRequired }, (_, idx) => {
              const cracked = idx < round - 1;
              const active = idx === round - 1;
              return (
                <div
                  key={idx}
                  className={`h-2.5 flex-1 rounded-sm ${
                    cracked
                      ? 'bg-emerald-400'
                      : active
                      ? 'bg-cyan-400'
                      : 'bg-slate-800'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* Live Signal Diagnostics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Green Targets</div>
            <div
              data-testid="green-targets-status"
              className={`font-mono-tabular text-2xl font-bold mt-0.5 ${
                evaluation.allGreensPowered ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {evaluation.poweredGreens} / {evaluation.totalGreens}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Red Hazard</div>
            <div
              data-testid="red-hazard-status"
              className={`font-mono-tabular text-2xl font-bold mt-0.5 ${
                evaluation.anyRedPowered ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {evaluation.anyRedPowered ? 'LINKED!' : 'CLEAR'}
            </div>
          </div>
        </div>

        {/* Status Alert Box */}
        <div
          className={`p-3.5 rounded-lg border text-xs leading-relaxed flex items-start gap-2.5 ${
            statusMessage.tone === 'danger'
              ? 'bg-red-950/40 border-red-500/60 text-red-200'
              : statusMessage.tone === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200'
              : 'bg-[#0B0E14] border-slate-800 text-slate-300'
          }`}
        >
          {statusMessage.tone === 'danger' ? (
            <AlertTriangle
              className="w-4 h-4 text-red-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : statusMessage.tone === 'success' ? (
            <CheckCircle2
              className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          ) : (
            <ShieldCheck
              className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
          )}
          <span>{statusMessage.text}</span>
        </div>

        {/* Hazard Warning if currently linked to red */}
        {evaluation.anyRedPowered && (
          <div className="p-3 rounded-lg bg-red-600/20 border border-red-500 text-xs font-bold text-red-300 text-center">
            WARNING: Current pump state feeds a RED hazard button. Do not pump surge!
          </div>
        )}

        {/* Primary Physical Pump Surge Action */}
        <button
          type="button"
          onClick={handlePumpSurge}
          data-testid="pump-surge-btn"
          className={`w-full py-4 px-5 rounded-lg font-display text-xl font-extrabold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors cursor-pointer ${
            evaluation.isSolved
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : evaluation.anyRedPowered
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          <Zap className="w-5 h-5 fill-current" aria-hidden="true" />
          <span>Pump Energy Surge</span>
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Press 1-{puzzle.numInputs} or tap pumps to toggle · Space or Pump to fire surge
        </p>
      </aside>
    </div>
  );
};

function generateInitialStates(puzzle: LogicCircuitPuzzle): boolean[] {
  return [...puzzle.initialInputs];
}
