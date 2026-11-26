import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Lock } from 'lucide-react';
import {
  generateDecryptWave,
  generateMathOverride,
  shouldTriggerOverride,
  type DecryptWave,
  type MathOverridePrompt,
} from '../game/decrypt';
import { DIFFICULTY_CONFIG } from '../game/config';
import { soundEngine } from '../game/audio';
import type { Difficulty, PlayMode } from '../game/types';

interface DecryptGameProps {
  difficulty: Difficulty;
  playMode: PlayMode;
  paused: boolean;
  onScoreAdd: (points: number) => void;
  onTimePenalty: (seconds: number) => void;
  onTimeBonus: (seconds: number) => void;
  onLevelCleared: () => void;
  onFinishRoomEarly?: () => void;
}

export const DecryptGame: React.FC<DecryptGameProps> = ({
  difficulty,
  playMode,
  paused,
  onScoreAdd,
  onTimePenalty,
  onTimeBonus,
  onLevelCleared,
  onFinishRoomEarly,
}) => {
  const [waveNum, setWaveNum] = useState(1);
  const [wave, setWave] = useState<DecryptWave>(() =>
    generateDecryptWave(1, difficulty)
  );
  const [nextExpected, setNextExpected] = useState(1);
  const [streak, setStreak] = useState(0);
  const [wrongTile, setWrongTile] = useState<number | null>(null);
  const [pulseTick, setPulseTick] = useState(0);
  const [overridePrompt, setOverridePrompt] = useState<MathOverridePrompt | null>(null);
  const [overrideError, setOverrideError] = useState(false);

  // Subtle periodic fade modulation on Normal/Hard or Wave 2+
  useEffect(() => {
    if (paused || !wave.fadeEnabled) return;
    const id = window.setInterval(() => {
      setPulseTick((t) => (t + 1) % 4);
    }, 1100);
    return () => window.clearInterval(id);
  }, [paused, wave.fadeEnabled]);

  const handleTileClick = (val: number) => {
    if (paused || overridePrompt) return;
    if (val < nextExpected) return;

    if (val === nextExpected) {
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      setWrongTile(null);

      const pitch = 0.85 + Math.min(0.65, (val % 25) * 0.025);
      soundEngine.playClick(pitch);

      const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
      const pts = Math.round((12 + Math.min(24, nextStreak * 2)) * mult);
      onScoreAdd(pts);

      const upcoming = val + 1;

      if (val >= wave.maxNumber) {
        // Wave cleared!
        soundEngine.playLevelClear();
        onScoreAdd(Math.round(400 * mult));
        onTimeBonus(5);
        onLevelCleared();

        const nextW = waveNum + 1;
        setWaveNum(nextW);
        setWave(generateDecryptWave(nextW, difficulty));
        setNextExpected(1);
        return;
      }

      setNextExpected(upcoming);

      if (shouldTriggerOverride(upcoming, difficulty)) {
        setOverridePrompt(generateMathOverride(difficulty));
        setOverrideError(false);
      }
    } else {
      setStreak(0);
      setWrongTile(val);
      soundEngine.playError();
      onTimePenalty(1.5);
      window.setTimeout(() => {
        setWrongTile((curr) => (curr === val ? null : curr));
      }, 360);
    }
  };

  const handleOverrideAnswer = (choice: number) => {
    if (paused || !overridePrompt) return;
    if (choice === overridePrompt.answer) {
      soundEngine.playConnect();
      const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
      onScoreAdd(Math.round(140 * mult));
      setOverridePrompt(null);
      setOverrideError(false);
    } else {
      setOverrideError(true);
      soundEngine.playError();
      onTimePenalty(3);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-3 sm:px-4 py-3 sm:py-4 space-y-3 sm:space-y-4">
      {/* Top Status Bar — sticky on mobile so Next Target stays visible */}
      <div className="sticky top-2 z-10 bg-[#111621] border border-slate-800 rounded-xl px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 sm:gap-6">
          <div>
            <div className="text-xs text-slate-400">Next Target</div>
            <div
              data-testid="decrypt-target"
              className="font-mono-tabular text-2xl sm:text-3xl font-extrabold text-emerald-400 leading-none"
            >
              {nextExpected}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800" aria-hidden="true" />

          <div>
            <div className="text-xs text-slate-400">Progress</div>
            <div className="font-mono-tabular text-lg sm:text-xl font-bold text-white leading-none">
              {nextExpected - 1} / {wave.maxNumber}
            </div>
          </div>

          <div className="h-8 w-px bg-slate-800 hidden sm:block" aria-hidden="true" />

          <div className="hidden sm:block">
            <div className="text-xs text-slate-400">Wave & Streak</div>
            <div className="font-mono-tabular text-xl font-bold text-amber-400 leading-none">
              W{waveNum} · ×{streak}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden md:inline">
            Tap 1 to 100 in strict order across all 4 terminals
          </span>
          {playMode === 'campaign' && onFinishRoomEarly && (
            <button
              type="button"
              onClick={onFinishRoomEarly}
              disabled={waveNum <= 1 && nextExpected <= 25}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-wide rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
            >
              <span>Advance to Bomb Defuse</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Multi-Screen 4 Terminal Hub */}
      <div className="relative grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {wave.terminals.map((tiles, termIdx) => (
          <section
            key={termIdx}
            aria-label={`Terminal ${termIdx + 1}`}
            className="bg-[#111621] border border-slate-800 rounded-xl p-3 sm:p-3.5"
          >
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="font-display text-sm font-bold uppercase tracking-wider text-slate-300">
                Terminal 0{termIdx + 1}
              </span>
              <span className="font-mono-tabular text-xs text-slate-500">
                {tiles.filter((t) => t.value < nextExpected).length} / 25 cleared
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1.5">
              {tiles.map((tile) => {
                const isCleared = tile.value < nextExpected;
                const isWrong = wrongTile === tile.value;
                const isDimmedPhase =
                  wave.fadeEnabled && !isCleared && tile.fadePhase === pulseTick;

                return (
                  <button
                    key={tile.value}
                    type="button"
                    disabled={isCleared || Boolean(overridePrompt)}
                    onPointerDown={(e) => {
                      if (e.button !== 0 && e.pointerType === 'mouse') return;
                      e.preventDefault();
                      handleTileClick(tile.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTileClick(tile.value);
                      }
                    }}
                    aria-label={
                      isCleared ? `Number ${tile.value} cleared` : `Number ${tile.value}`
                    }
                    className={`min-h-[44px] rounded-md border font-mono-tabular text-sm font-bold flex items-center justify-center transition-opacity touch-manipulation select-none cursor-pointer disabled:cursor-default ${
                      isCleared
                        ? 'bg-[#090C11] border-slate-800/60 text-slate-600'
                        : isWrong
                        ? 'bg-red-600 border-red-400 text-white'
                        : 'bg-[#171E2E] border-slate-700/80 text-slate-100 active:bg-cyan-900 hover:bg-slate-700 hover:border-cyan-400'
                    }`}
                    style={
                      isDimmedPhase && !isWrong
                        ? { opacity: 0.45 }
                        : undefined
                    }
                  >
                    {isCleared ? (
                      <Check className="w-3.5 h-3.5 text-emerald-500/50" aria-hidden="true" />
                    ) : (
                      tile.value
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {/* Security Override Math Challenge Overlay */}
        {overridePrompt && (
          <div
            role="dialog"
            aria-label="Security Override Challenge"
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 rounded-xl p-4"
          >
            <div className="w-full max-w-sm bg-[#111621] border border-amber-500/70 rounded-xl p-6 space-y-4 text-center">
              <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-400">
                <Lock className="w-4 h-4" aria-hidden="true" />
                <span>Security Override Required</span>
              </div>

              <div className="font-mono-tabular text-3xl font-extrabold text-white">
                {overridePrompt.question}
              </div>

              {overrideError && (
                <p className="text-xs font-semibold text-red-400">
                  Incorrect code (-3s). Try again.
                </p>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                {overridePrompt.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleOverrideAnswer(opt)}
                    className="py-3 px-4 rounded-lg bg-[#0B0E14] border border-slate-700 hover:border-emerald-400 hover:bg-slate-800 font-mono-tabular text-lg font-bold text-white transition-colors"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
