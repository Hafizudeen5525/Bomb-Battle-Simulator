import React from 'react';
import { Play, Trophy, ShieldAlert, Volume2, VolumeX } from 'lucide-react';
import {
  DIFFICULTY_CONFIG,
  ROOM_ORDER,
  ROOMS,
  TIMER_SCALE_SECONDS,
} from '../game/config';
import type { Difficulty, GameId, PlayMode, TimerScale } from '../game/types';

interface TitleScreenProps {
  playMode: PlayMode;
  setPlayMode: (mode: PlayMode) => void;
  selectedRoom: GameId;
  setSelectedRoom: (room: GameId) => void;
  difficulty: Difficulty;
  setDifficulty: (diff: Difficulty) => void;
  timerScale: TimerScale;
  setTimerScale: (scale: TimerScale) => void;
  callsign: string;
  setCallsign: (val: string) => void;
  muted: boolean;
  onToggleMute: () => void;
  onStart: () => void;
  onOpenScoreboard: () => void;
  bestCampaignScore: number;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  playMode,
  setPlayMode,
  selectedRoom,
  setSelectedRoom,
  difficulty,
  setDifficulty,
  timerScale,
  setTimerScale,
  callsign,
  setCallsign,
  muted,
  onToggleMute,
  onStart,
  onOpenScoreboard,
  bestCampaignScore,
}) => {
  return (
    <main className="min-h-screen w-full bg-[#0B0E14] text-slate-100 flex flex-col justify-between px-6 py-6 md:px-12 md:py-8">
      {/* Top utility row: strictly minimal */}
      <div className="max-w-6xl w-full mx-auto flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <svg
            width="34"
            height="34"
            viewBox="0 0 36 36"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="2" y="2" width="32" height="32" rx="6" fill="#131924" stroke="#334155" strokeWidth="1.5" />
            <circle cx="18" cy="19" r="8" stroke="#EF4444" strokeWidth="2" />
            <path d="M18 11V7M18 7L22 5" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
            <circle cx="18" cy="19" r="3" fill="#EF4444" />
          </svg>
          <span className="font-display text-xl sm:text-2xl font-bold tracking-wide uppercase text-slate-100 whitespace-nowrap truncate">
            Bomb Battle Simulator
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenScoreboard}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-slate-200 bg-[#131924] border border-slate-700/80 rounded-lg hover:bg-slate-800 hover:border-slate-600 transition-colors whitespace-nowrap"
          >
            <Trophy className="w-4 h-4 text-amber-400" aria-hidden="true" />
            <span>Scoreboard</span>
            {bestCampaignScore > 0 && (
              <span className="hidden sm:inline font-mono-tabular text-xs text-slate-400 pl-1 border-l border-slate-700">
                Best {bestCampaignScore}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            aria-label={muted ? 'Unmute audio' : 'Mute audio'}
            className="p-2.5 bg-[#131924] border border-slate-700/80 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main Focal Console */}
      <div className="max-w-6xl w-full mx-auto my-auto py-6 md:py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8 items-stretch">
        {/* Left column: Hero briefing & Mission Mode */}
        <section className="lg:col-span-7 flex flex-col justify-between gap-6 bg-[#111621] border border-slate-800 rounded-xl p-5 sm:p-6 md:p-8 min-w-0">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-slate-400">
              <span>4 Authentic Mission Rooms</span>
              <span aria-hidden="true">·</span>
              <span>Randomized Levels</span>
              <span aria-hidden="true">·</span>
              <span>Defuse or Get Blasted</span>
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-white leading-[1.02] text-balance">
              Master Every Room Before the Clock Hits Zero
            </h1>

            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
              Train with exact Bomb Battle rules. Earn points across Power Grid, Melody Hack, and Decrypt to bank bonus seconds for the final Circuit Cracker defusal—or take on any room solo.
            </p>
          </div>

          {/* Room Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {ROOM_ORDER.map((roomId) => {
              const room = ROOMS[roomId];
              const isSelected = playMode === 'practice' && selectedRoom === roomId;
              return (
                <button
                  key={roomId}
                  type="button"
                  onClick={() => {
                    setPlayMode('practice');
                    setSelectedRoom(roomId);
                  }}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    isSelected
                      ? 'bg-[#172030] border-cyan-500/80 text-white'
                      : 'bg-[#0D1119] border-slate-800/90 text-slate-300 hover:border-slate-700 hover:bg-[#131925]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-display text-lg font-bold tracking-wide text-white">
                      0{room.order}. {room.name}
                    </span>
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: room.accentHex }}
                      aria-hidden="true"
                    />
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{room.brief}</p>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right column: Mission Configuration & Primary Start CTA */}
        <section className="lg:col-span-5 flex flex-col justify-between gap-6 bg-[#111621] border border-slate-800 rounded-xl p-5 sm:p-6 md:p-8 min-w-0">
          <div className="space-y-5">
            {/* Play Mode Switch */}
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Simulation Mode
              </span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0B0E14] rounded-lg border border-slate-800">
                <button
                  type="button"
                  onClick={() => setPlayMode('campaign')}
                  className={`px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
                    playMode === 'campaign'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Full Campaign
                </button>
                <button
                  type="button"
                  onClick={() => setPlayMode('practice')}
                  className={`px-2.5 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
                    playMode === 'practice'
                      ? 'bg-cyan-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Single Room
                </button>
              </div>
              {playMode === 'practice' && (
                <p className="mt-2 text-xs text-cyan-300">
                  Selected Room: {ROOMS[selectedRoom].name} ({ROOMS[selectedRoom].subtitle})
                </p>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Difficulty Level
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0B0E14] rounded-lg border border-slate-800">
                {(['easy', 'normal', 'hard'] as Difficulty[]).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setDifficulty(diff)}
                    className={`px-2 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                      difficulty === diff
                        ? 'bg-slate-100 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {DIFFICULTY_CONFIG[diff].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                Score multiplier ×{DIFFICULTY_CONFIG[difficulty].scoreMultiplier.toFixed(2)} · Defuse base {DIFFICULTY_CONFIG[difficulty].bombBaseTime}s
              </p>
            </div>

            {/* Timer Scale */}
            <div>
              <span className="block text-xs font-medium text-slate-400 mb-2">
                Room Countdown Clock
              </span>
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-[#0B0E14] rounded-lg border border-slate-800">
                {(['blitz', 'standard', 'real'] as TimerScale[]).map((scale) => (
                  <button
                    key={scale}
                    type="button"
                    onClick={() => setTimerScale(scale)}
                    className={`px-1.5 py-2 text-[11px] sm:text-xs font-semibold rounded-md transition-colors whitespace-nowrap truncate ${
                      timerScale === scale
                        ? 'bg-amber-500 text-slate-950'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {TIMER_SCALE_SECONDS[scale].label}
                  </button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-slate-400">
                {TIMER_SCALE_SECONDS[timerScale].description}
              </p>
            </div>

            {/* Callsign */}
            <div>
              <label htmlFor="squad-callsign" className="block text-xs font-medium text-slate-400 mb-1.5">
                Agent / Squad Callsign
              </label>
              <input
                id="squad-callsign"
                type="text"
                maxLength={18}
                value={callsign}
                onChange={(e) => setCallsign(e.target.value)}
                placeholder="SQUAD ALPHA"
                className="w-full px-3.5 py-2.5 bg-[#0B0E14] border border-slate-700 rounded-lg text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <button
              type="button"
              data-start="true"
              onClick={onStart}
              className="w-full flex items-center justify-center gap-2.5 px-6 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold tracking-wide uppercase rounded-lg transition-colors cursor-pointer"
            >
              <Play className="w-5 h-5 fill-current" aria-hidden="true" />
              <span>
                {playMode === 'campaign'
                  ? 'Start Full Mission'
                  : `Practice ${ROOMS[selectedRoom].name}`}
              </span>
            </button>

            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
              <span>Score converts into bonus defusal time in Bomb Defuse</span>
            </div>
          </div>
        </section>
      </div>

      {/* Bottom control hint line */}
      <div className="max-w-6xl w-full mx-auto text-center text-xs text-slate-500">
        Enter or Space Start · 1-6 Melody Pads · Space Pump Surge · P or Esc Pause · M Mute
      </div>
    </main>
  );
};
