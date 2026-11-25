import React from 'react';
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { calculateBonusDefuseSeconds, DIFFICULTY_CONFIG, ROOM_ORDER, ROOMS } from '../game/config';
import type { Difficulty, GameId, PlayMode } from '../game/types';

interface GameHudProps {
  playMode: PlayMode;
  gameId: GameId;
  difficulty: Difficulty;
  level: number;
  score: number;
  timeRemaining: number;
  muted: boolean;
  onToggleMute: () => void;
  onPause: () => void;
  onRestart: () => void;
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const mins = Math.floor(clamped / 60);
  const secs = Math.floor(clamped % 60);
  const tenths = Math.floor((clamped - Math.floor(clamped)) * 10);
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  return `${mm}:${ss}.${tenths}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  playMode,
  gameId,
  difficulty,
  level,
  score,
  timeRemaining,
  muted,
  onToggleMute,
  onPause,
  onRestart,
}) => {
  const room = ROOMS[gameId];
  const isCritical = timeRemaining <= 10;
  const isWarning = timeRemaining > 10 && timeRemaining <= 25;
  const bonusSeconds = calculateBonusDefuseSeconds(score);

  return (
    <header className="w-full bg-[#111621] border-b border-slate-800 px-4 py-3 md:px-8">
      <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4">
        {/* Left: Room & Level */}
        <div className="flex items-center gap-4 min-w-0">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>
                {playMode === 'campaign'
                  ? `Stage ${room.order} of ${ROOM_ORDER.length}`
                  : 'Practice Drill'}
              </span>
              <span aria-hidden="true">·</span>
              <span>{DIFFICULTY_CONFIG[difficulty].label}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: room.accentHex }}
                aria-hidden="true"
              />
              <h2 className="font-display text-2xl font-bold tracking-wide text-white uppercase whitespace-nowrap">
                {room.name}
              </h2>
              <span className="font-mono-tabular text-xs font-bold text-slate-300 bg-[#0B0E14] border border-slate-800 px-2 py-0.5 rounded">
                LVL {String(level).padStart(2, '0')}
              </span>
            </div>
          </div>
        </div>

        {/* Center: Countdown Clock */}
        <div className="flex flex-col items-center">
          <span className="text-[11px] font-medium tracking-wider uppercase text-slate-400">
            {isCritical ? 'Critical Countdown' : 'Room Timer'}
          </span>
          <div
            data-testid="hud-timer"
            className={`font-mono-tabular text-3xl md:text-4xl font-bold leading-none ${
              isCritical
                ? 'text-red-400'
                : isWarning
                ? 'text-amber-400'
                : 'text-white'
            }`}
          >
            {formatClock(timeRemaining)}
          </div>
        </div>

        {/* Right: Score, Bonus Time & Compact Utility Buttons */}
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Score {playMode === 'campaign' && gameId !== 'bomb-defuse' ? `· +${bonusSeconds}s Defuse` : ''}
            </div>
            <div data-testid="hud-score" className="font-mono-tabular text-2xl font-bold text-emerald-400 leading-none">
              {Math.round(score).toLocaleString()}
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleMute();
              }}
              aria-label={muted ? 'Unmute audio (M)' : 'Mute audio (M)'}
              title="Mute (M)"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#0B0E14] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onPause();
              }}
              aria-label="Pause simulation (P)"
              title="Pause (P)"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#0B0E14] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <Pause className="w-4 h-4" />
            </button>

            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.currentTarget.blur();
                onRestart();
              }}
              aria-label="Restart room (R)"
              title="Restart (R)"
              className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#0B0E14] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
