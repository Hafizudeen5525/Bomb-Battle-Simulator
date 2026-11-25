import React, { useState } from 'react';
import { CheckCircle2, RotateCcw, ShieldX, Trophy } from 'lucide-react';
import { ROOMS } from '../game/config';
import type { GameId, PlayMode, StageResult } from '../game/types';

interface OutcomeModalProps {
  outcome: 'DEFUSED' | 'BLASTED' | 'CLEARED';
  playMode: PlayMode;
  activeRoomId: GameId;
  totalScore: number;
  levelsCleared: number;
  timeRemaining: number;
  stageResults: StageResult[];
  callsign: string;
  onCallsignChange: (val: string) => void;
  onSaveScore: (name: string) => void;
  scoreSaved: boolean;
  onPlayAgain: () => void;
  onReturnTitle: () => void;
  onOpenScoreboard: () => void;
}

export const OutcomeModal: React.FC<OutcomeModalProps> = ({
  outcome,
  playMode,
  activeRoomId,
  totalScore,
  levelsCleared,
  timeRemaining,
  stageResults,
  callsign,
  onCallsignChange,
  onSaveScore,
  scoreSaved,
  onPlayAgain,
  onReturnTitle,
  onOpenScoreboard,
}) => {
  const [submitted, setSubmitted] = useState(scoreSaved);
  const isBlasted = outcome === 'BLASTED';

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitted) return;
    onSaveScore(callsign);
    setSubmitted(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isBlasted ? 'Mission Failed — Get Blasted' : 'Mission Cleared'}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 overflow-y-auto"
    >
      {/* UV Paint Splatters when BLASTED */}
      {isBlasted && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
          <svg
            viewBox="0 0 1200 800"
            className="w-full h-full animate-paint-splat opacity-35"
            preserveAspectRatio="xMidYMid slice"
          >
            <circle cx="180" cy="140" r="110" fill="#EC4899" />
            <circle cx="260" cy="210" r="45" fill="#EC4899" />
            <circle cx="1020" cy="180" r="130" fill="#22D3EE" />
            <circle cx="940" cy="260" r="40" fill="#22D3EE" />
            <circle cx="240" cy="640" r="120" fill="#A3E635" />
            <circle cx="980" cy="660" r="105" fill="#F59E0B" />
          </svg>
        </div>
      )}

      <div className="relative w-full max-w-xl bg-[#111621] border border-slate-700 rounded-xl p-6 md:p-8 space-y-6">
        {/* Outcome Banner */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-medium text-slate-400">
              {playMode === 'campaign'
                ? 'Full Bomb Battle Campaign'
                : `Practice · ${ROOMS[activeRoomId].name}`}
            </div>
            <h2
              className={`font-display text-4xl font-extrabold uppercase tracking-wide ${
                isBlasted ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {outcome === 'DEFUSED'
                ? 'Bomb Defused'
                : outcome === 'CLEARED'
                ? 'Drill Complete'
                : '#GetBlasted — Detonation'}
            </h2>
            <p className="text-sm text-slate-300">
              {outcome === 'DEFUSED'
                ? 'All circuit locks cracked before zero. Your squad survived the paint blast.'
                : outcome === 'CLEARED'
                ? 'Timer complete. Review your accuracy and speed metrics below.'
                : 'Countdown expired before the final circuit lock was cleared.'}
            </p>
          </div>

          {isBlasted ? (
            <ShieldX className="w-10 h-10 text-red-400 shrink-0" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="w-10 h-10 text-emerald-400 shrink-0" aria-hidden="true" />
          )}
        </div>

        {/* Stat Tiles */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <div className="text-xs text-slate-400">Final Score</div>
            <div className="font-mono-tabular text-2xl font-bold text-emerald-400 mt-0.5">
              {Math.round(totalScore).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <div className="text-xs text-slate-400">Levels Cleared</div>
            <div className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
              {levelsCleared}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3.5">
            <div className="text-xs text-slate-400">Time Left</div>
            <div className="font-mono-tabular text-2xl font-bold text-cyan-400 mt-0.5">
              {timeRemaining.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Per-Stage Breakdown (Campaign) */}
        {stageResults.length > 0 && (
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Stage Breakdown
            </div>
            <div className="divide-y divide-slate-800/80 text-sm">
              {stageResults.map((st, idx) => (
                <div key={`${st.gameId}-${idx}`} className="py-2 flex items-center justify-between gap-4">
                  <span className="text-slate-200 font-medium">
                    {ROOMS[st.gameId].name}
                  </span>
                  <div className="flex items-center gap-4 font-mono-tabular text-xs">
                    <span className="text-slate-400">{st.levelsCleared} lvls</span>
                    <span className="text-emerald-400 font-bold">+{st.scoreEarned} pts</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Save to Scoreboard */}
        <form onSubmit={handleSave} className="flex flex-col sm:flex-row gap-2.5">
          <label htmlFor="outcome-callsign" className="sr-only">
            Callsign for scoreboard
          </label>
          <input
            id="outcome-callsign"
            type="text"
            maxLength={18}
            value={callsign}
            onChange={(e) => onCallsignChange(e.target.value)}
            disabled={submitted}
            placeholder="Enter callsign"
            className="flex-1 px-3.5 py-2.5 bg-[#0B0E14] border border-slate-700 rounded-lg text-sm text-white disabled:opacity-60 focus:outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            disabled={submitted}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold bg-amber-500 hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-400 text-slate-950 transition-colors whitespace-nowrap"
          >
            {submitted ? 'Saved to Scoreboard' : 'Save Score'}
          </button>
        </form>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onReturnTitle}
              className="px-4 py-2.5 text-sm font-medium text-slate-300 bg-[#0B0E14] border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Title Menu
            </button>
            <button
              type="button"
              onClick={onOpenScoreboard}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-slate-200 bg-[#0B0E14] border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
              <span>Scoreboard</span>
            </button>
          </div>

          <button
            type="button"
            data-start="true"
            onClick={onPlayAgain}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-bold uppercase tracking-wide bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg transition-colors"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Play Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
