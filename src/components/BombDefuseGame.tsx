import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import {
  computeCircuitFlow,
  generateCircuitBoard,
  rotateCircuitCell,
  type CircuitBoard,
  type CircuitCell,
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

function ConduitSvg({
  cell,
  powered,
}: {
  cell: CircuitCell;
  powered: boolean;
}) {
  const stroke = powered ? '#22D3EE' : '#64748B';
  const glowWidth = powered ? 14 : 11;

  if (cell.kind === 'source') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <line x1="50" y1="50" x2="100" y2="50" stroke="#22D3EE" strokeWidth="14" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="0" stroke="#22D3EE" strokeWidth="12" strokeLinecap="round" />
        <line x1="50" y1="50" x2="50" y2="100" stroke="#22D3EE" strokeWidth="12" strokeLinecap="round" />
        <circle cx="50" cy="50" r="26" fill="#0891B2" stroke="#67E8F9" strokeWidth="4" />
        <text x="50" y="55" textAnchor="middle" fill="#ECFEFF" fontSize="18" fontWeight="800" fontFamily="monospace">
          PWR
        </text>
      </svg>
    );
  }

  if (cell.kind === 'green') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <line x1="50" y1="0" x2="50" y2="100" stroke={powered ? '#10B981' : '#334155'} strokeWidth="10" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={powered ? '#10B981' : '#334155'} strokeWidth="10" />
        <circle
          cx="50"
          cy="50"
          r="28"
          fill={powered ? '#10B981' : '#064E3B'}
          stroke={powered ? '#A7F3D0' : '#10B981'}
          strokeWidth="5"
        />
        <text
          x="50"
          y="55"
          textAnchor="middle"
          fill={powered ? '#022C22' : '#6EE7B7'}
          fontSize="16"
          fontWeight="800"
          fontFamily="monospace"
        >
          OK
        </text>
      </svg>
    );
  }

  if (cell.kind === 'red') {
    return (
      <svg viewBox="0 0 100 100" className="w-full h-full" aria-hidden="true">
        <line x1="50" y1="0" x2="50" y2="100" stroke={powered ? '#EF4444' : '#450A0A'} strokeWidth="10" />
        <line x1="0" y1="50" x2="100" y2="50" stroke={powered ? '#EF4444' : '#450A0A'} strokeWidth="10" />
        <polygon
          points="50,18 82,76 18,76"
          fill={powered ? '#EF4444' : '#7F1D1D'}
          stroke="#FCA5A5"
          strokeWidth="4"
        />
        <text x="50" y="69" textAnchor="middle" fill="#FFF" fontSize="22" fontWeight="900">
          !
        </text>
      </svg>
    );
  }

  const angle = cell.rotation * 90;
  return (
    <svg
      viewBox="0 0 100 100"
      className="w-full h-full transition-transform duration-150"
      style={{ transform: `rotate(${angle}deg)` }}
      aria-hidden="true"
    >
      {cell.shape === 'STRAIGHT' && (
        <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth={glowWidth} strokeLinecap="butt" />
      )}
      {cell.shape === 'CORNER' && (
        <path d="M 50 0 L 50 50 L 100 50" fill="none" stroke={stroke} strokeWidth={glowWidth} strokeLinejoin="round" />
      )}
      {cell.shape === 'TEE' && (
        <>
          <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth={glowWidth} />
          <line x1="50" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={glowWidth} />
        </>
      )}
      {cell.shape === 'CROSS' && (
        <>
          <line x1="50" y1="0" x2="50" y2="100" stroke={stroke} strokeWidth={glowWidth} />
          <line x1="0" y1="50" x2="100" y2="50" stroke={stroke} strokeWidth={glowWidth} />
        </>
      )}
      <circle cx="50" cy="50" r="8" fill={powered ? '#E0F2FE' : '#64748B'} />
    </svg>
  );
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
  const [board, setBoard] = useState<CircuitBoard>(() =>
    generateCircuitBoard(1, difficulty)
  );
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    tone: 'neutral' | 'success' | 'danger';
  }>({
    text: 'Rotate conduits to link all GREEN nodes and avoid RED hazards, then pump surge.',
    tone: 'neutral',
  });
  const [shaking, setShaking] = useState(false);

  const flow = useMemo(() => computeCircuitFlow(board), [board]);

  const handleCellClick = (r: number, c: number) => {
    if (paused) return;
    const cell = board.cells[r][c];
    if (cell.kind !== 'conduit') return;
    soundEngine.playClick(1.2);
    setBoard((prev) => rotateCircuitCell(prev, r, c));
  };

  const handlePumpSurge = useCallback(() => {
    if (paused) return;

    if (flow.anyRedPowered) {
      const penalty = DIFFICULTY_CONFIG[difficulty].mistakeTimePenalty + 1;
      soundEngine.playPumpSurge(false);
      onTimePenalty(penalty);
      setShaking(true);
      setStatusMessage({
        text: `SHORT CIRCUIT! Surge hit RED hazard (-${penalty}s countdown penalty)`,
        tone: 'danger',
      });
      window.setTimeout(() => setShaking(false), 360);
      return;
    }

    if (!flow.allGreensPowered) {
      soundEngine.playError();
      onTimePenalty(2);
      setStatusMessage({
        text: `WEAK FLOW (${flow.poweredGreens}/${flow.totalGreens} Green Linked) — -2s penalty`,
        tone: 'danger',
      });
      return;
    }

    // Success!
    soundEngine.playPumpSurge(true);
    const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
    onScoreAdd(Math.round((300 + round * 75) * mult));
    onLevelCleared();

    if (round >= locksRequired) {
      soundEngine.playLevelClear();
      onBombDefused();
      return;
    }

    const nextRound = round + 1;
    setRound(nextRound);
    setBoard(generateCircuitBoard(nextRound, difficulty));
    setStatusMessage({
      text: `Lock ${round} cracked! Route Circuit Lock ${nextRound} of ${locksRequired}.`,
      tone: 'success',
    });
  }, [
    paused,
    flow,
    difficulty,
    round,
    locksRequired,
    onTimePenalty,
    onScoreAdd,
    onLevelCleared,
    onBombDefused,
  ]);

  // Spacebar triggers Energy Pump Surge
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (paused) return;
      if (e.code === 'Space') {
        e.preventDefault();
        handlePumpSurge();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, handlePumpSurge]);

  return (
    <div
      className={`w-full max-w-5xl mx-auto px-4 py-5 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-8 ${
        shaking ? 'animate-shake' : ''
      }`}
    >
      {/* Circuit Cracker Board */}
      <div className="bg-[#111621] border border-slate-800 rounded-xl p-4 sm:p-5">
        <div
          className="grid gap-1.5 bg-[#0B0E14] p-2.5 rounded-lg border border-slate-800"
          style={{
            gridTemplateColumns: `repeat(${board.size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${board.size}, minmax(0, 1fr))`,
            width: 'min(90vw, 470px)',
            height: 'min(90vw, 470px)',
          }}
        >
          {board.cells.flatMap((row) =>
            row.map((cell) => {
              const isPowered = flow.poweredKeys.has(`${cell.r},${cell.c}`);
              const isClickable = cell.kind === 'conduit';
              const label =
                cell.kind === 'source'
                  ? `Power source at row ${cell.r + 1}`
                  : cell.kind === 'green'
                  ? `Green target node at row ${cell.r + 1} col ${cell.c + 1}`
                  : cell.kind === 'red'
                  ? `Red hazard node at row ${cell.r + 1} col ${cell.c + 1}`
                  : `Rotate conduit row ${cell.r + 1} col ${cell.c + 1}`;

              return (
                <button
                  key={`${cell.r}-${cell.c}`}
                  type="button"
                  disabled={!isClickable}
                  onPointerDown={(e) => {
                    if (!isClickable) return;
                    if (e.button !== 0 && e.pointerType === 'mouse') return;
                    e.preventDefault();
                    handleCellClick(cell.r, cell.c);
                  }}
                  onKeyDown={(e) => {
                    if (!isClickable) return;
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleCellClick(cell.r, cell.c);
                    }
                  }}
                  aria-label={label}
                  className={`relative rounded-md border overflow-hidden transition-colors touch-manipulation select-none ${
                    cell.kind === 'red' && isPowered
                      ? 'bg-red-950/60 border-red-500'
                      : cell.kind === 'green' && isPowered
                      ? 'bg-emerald-950/50 border-emerald-400'
                      : isClickable
                      ? 'bg-[#131A28] border-slate-800 active:border-cyan-400 hover:border-cyan-500/70 cursor-pointer'
                      : 'bg-[#0E1420] border-slate-800 cursor-default'
                  }`}
                >
                  <ConduitSvg cell={cell} powered={isPowered} />
                </button>
              );
            })
          )}
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
          <div className="flex items-center gap-2 mt-3" aria-label={`Circuit locks ${round - 1} of ${locksRequired} cracked`}>
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
              className={`font-mono-tabular text-2xl font-bold mt-0.5 ${
                flow.allGreensPowered ? 'text-emerald-400' : 'text-white'
              }`}
            >
              {flow.poweredGreens} / {flow.totalGreens}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Red Hazard</div>
            <div
              className={`font-mono-tabular text-2xl font-bold mt-0.5 ${
                flow.anyRedPowered ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {flow.anyRedPowered ? 'LINKED!' : 'CLEAR'}
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
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : statusMessage.tone === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
          ) : (
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" aria-hidden="true" />
          )}
          <span>{statusMessage.text}</span>
        </div>

        {/* Hazard Warning if currently linked to red */}
        {flow.anyRedPowered && (
          <div className="p-3 rounded-lg bg-red-600/20 border border-red-500 text-xs font-bold text-red-300 text-center">
            WARNING: Current path touches RED hazard node. Disconnect before pumping!
          </div>
        )}

        {/* Primary Physical Pump Surge Action */}
        <button
          type="button"
          onClick={handlePumpSurge}
          data-testid="pump-surge-btn"
          className={`w-full py-4 px-5 rounded-lg font-display text-xl font-extrabold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-colors cursor-pointer ${
            flow.isSolved
              ? 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
              : flow.anyRedPowered
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
          }`}
        >
          <Zap className="w-5 h-5 fill-current" aria-hidden="true" />
          <span>Pump Energy Surge</span>
        </button>

        <p className="text-[11px] text-center text-slate-500">
          Click conduit tiles to rotate 90° · Press Space or click Pump to fire surge
        </p>
      </aside>
    </div>
  );
};
