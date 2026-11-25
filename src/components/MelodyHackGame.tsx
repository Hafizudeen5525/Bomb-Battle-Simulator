import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowRight, RotateCw, Volume2 } from 'lucide-react';
import {
  evaluateMelodyStep,
  generateMelodyLevel,
  MELODY_PADS,
  type MelodyLevel,
} from '../game/melodyHack';
import { DIFFICULTY_CONFIG } from '../game/config';
import { soundEngine } from '../game/audio';
import type { Difficulty, PlayMode } from '../game/types';

interface MelodyHackGameProps {
  difficulty: Difficulty;
  playMode: PlayMode;
  paused: boolean;
  onScoreAdd: (points: number) => void;
  onTimePenalty: (seconds: number) => void;
  onLevelCleared: () => void;
  onFinishRoomEarly?: () => void;
}

type MelodyPhase = 'LISTEN' | 'REPLICATE' | 'CLEARED' | 'ERROR';

export const MelodyHackGame: React.FC<MelodyHackGameProps> = ({
  difficulty,
  playMode,
  paused,
  onScoreAdd,
  onTimePenalty,
  onLevelCleared,
  onFinishRoomEarly,
}) => {
  const [levelNum, setLevelNum] = useState(1);
  const [melody, setMelody] = useState<MelodyLevel>(() =>
    generateMelodyLevel(1, difficulty)
  );
  const [phase, setPhase] = useState<MelodyPhase>('LISTEN');
  const [litPad, setLitPad] = useState<number | null>(null);
  const [inputIndex, setInputIndex] = useState(0);
  const [streak, setStreak] = useState(0);

  const timersRef = useRef<number[]>([]);

  const clearPlaybackTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const playSequence = useCallback(
    (seq: number[], intervalMs: number) => {
      clearPlaybackTimers();
      setPhase('LISTEN');
      setInputIndex(0);
      setLitPad(null);

      seq.forEach((padIdx, step) => {
        const startAt = 320 + step * intervalMs;
        const t1 = window.setTimeout(() => {
          setLitPad(padIdx);
          const pad = MELODY_PADS[padIdx];
          soundEngine.playTone(pad.frequency, Math.min(280, intervalMs * 0.72), 'triangle', 0.18);
        }, startAt);

        const t2 = window.setTimeout(() => {
          setLitPad((curr) => (curr === padIdx ? null : curr));
        }, startAt + intervalMs * 0.72);

        timersRef.current.push(t1, t2);
      });

      const finishAt = 320 + seq.length * intervalMs + 120;
      const tEnd = window.setTimeout(() => {
        setLitPad(null);
        setPhase('REPLICATE');
      }, finishAt);
      timersRef.current.push(tEnd);
    },
    [clearPlaybackTimers]
  );

  // Trigger playback whenever melody level changes
  useEffect(() => {
    if (paused) {
      clearPlaybackTimers();
      return;
    }
    if (phase === 'LISTEN') {
      playSequence(melody.sequence, melody.stepIntervalMs);
    }
    return () => clearPlaybackTimers();
  }, [melody, paused]);

  const handlePadPress = useCallback(
    (padIdx: number) => {
      if (paused || phase !== 'REPLICATE') return;
      if (padIdx >= melody.padCount) return;

      const pad = MELODY_PADS[padIdx];
      setLitPad(padIdx);
      soundEngine.playTone(pad.frequency, 210, 'triangle', 0.18);
      window.setTimeout(() => {
        setLitPad((curr) => (curr === padIdx ? null : curr));
      }, 190);

      const outcome = evaluateMelodyStep(melody.sequence, inputIndex, padIdx);

      if (outcome.status === 'mistake') {
        setPhase('ERROR');
        setStreak(0);
        setInputIndex(0);
        soundEngine.playError();
        onTimePenalty(2);

        const retryTimer = window.setTimeout(() => {
          playSequence(melody.sequence, melody.stepIntervalMs);
        }, 700);
        timersRef.current.push(retryTimer);
        return;
      }

      if (outcome.status === 'continue') {
        setInputIndex(outcome.nextIndex);
        return;
      }

      // Completed sequence!
      setPhase('CLEARED');
      const nextStreak = streak + 1;
      setStreak(nextStreak);
      soundEngine.playLevelClear();

      const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
      const pts = Math.round((140 + melody.sequence.length * 35 + nextStreak * 25) * mult);
      onScoreAdd(pts);
      onLevelCleared();

      const nextTimer = window.setTimeout(() => {
        const nextNum = levelNum + 1;
        setLevelNum(nextNum);
        const nextLevel = generateMelodyLevel(nextNum, difficulty);
        setMelody(nextLevel);
        setPhase('LISTEN');
      }, 700);
      timersRef.current.push(nextTimer);
    },
    [
      paused,
      phase,
      melody,
      inputIndex,
      streak,
      difficulty,
      levelNum,
      onScoreAdd,
      onTimePenalty,
      onLevelCleared,
      playSequence,
    ]
  );

  // Keyboard 1-6 shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (paused || phase !== 'REPLICATE') return;
      const num = Number(e.key);
      if (num >= 1 && num <= melody.padCount) {
        e.preventDefault();
        handlePadPress(num - 1);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [paused, phase, melody.padCount, handlePadPress]);

  const handleReplay = () => {
    if (paused || phase !== 'REPLICATE') return;
    onTimePenalty(2);
    playSequence(melody.sequence, melody.stepIntervalMs);
  };

  const activePads = MELODY_PADS.slice(0, melody.padCount);

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Phase & Progress Banner */}
      <div className="bg-[#111621] border border-slate-800 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs text-slate-400">
            Sequence Length: {melody.sequence.length} Tones · Streak ×{streak}
          </div>
          <h3
            data-testid="melody-phase"
            className={`font-display text-2xl font-bold uppercase tracking-wide mt-0.5 ${
              phase === 'LISTEN'
                ? 'text-amber-400'
                : phase === 'REPLICATE'
                ? 'text-emerald-400'
                : phase === 'ERROR'
                ? 'text-red-400'
                : 'text-cyan-400'
            }`}
          >
            {phase === 'LISTEN'
              ? 'Listen — Memorize Sequence'
              : phase === 'REPLICATE'
              ? 'Your Turn — Replicate Melody'
              : phase === 'ERROR'
              ? 'Wrong Tone — Replaying Sequence (-2s)'
              : 'Sequence Accepted'}
          </h3>
        </div>

        {/* Sequence Pips */}
        <div className="flex items-center gap-2" aria-label={`Progress ${inputIndex} of ${melody.sequence.length}`}>
          {melody.sequence.map((_, idx) => {
            const done = idx < inputIndex || phase === 'CLEARED';
            return (
              <span
                key={idx}
                className={`w-3.5 h-3.5 rounded-full border transition-colors ${
                  done
                    ? 'bg-emerald-400 border-emerald-300'
                    : 'bg-[#0B0E14] border-slate-700'
                }`}
              />
            );
          })}
        </div>
      </div>

      {/* Sensor Pad Wall */}
      <div
        className={`grid gap-4 ${
          melody.padCount <= 4 ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2 sm:grid-cols-3'
        }`}
      >
        {activePads.map((pad) => {
          const isLit = litPad === pad.index;
          return (
            <button
              key={pad.index}
              type="button"
              disabled={phase !== 'REPLICATE'}
              onClick={() => handlePadPress(pad.index)}
              aria-label={`${pad.label} (${pad.noteName}) Key ${pad.keyHint}`}
              className={`group relative h-36 sm:h-44 rounded-xl border-2 flex flex-col items-center justify-center gap-2 transition-transform duration-100 cursor-pointer disabled:cursor-default ${
                isLit
                  ? 'scale-[1.03] border-white text-slate-950'
                  : 'bg-[#111621] border-slate-800 text-slate-200 hover:border-slate-600'
              }`}
              style={
                isLit
                  ? { backgroundColor: pad.hex }
                  : undefined
              }
            >
              <span
                className={`w-12 h-12 rounded-lg flex items-center justify-center font-mono-tabular text-xl font-extrabold ${
                  isLit ? 'bg-slate-950/20 text-slate-950' : 'text-slate-950'
                }`}
                style={!isLit ? { backgroundColor: pad.hex } : undefined}
              >
                {pad.keyHint}
              </span>
              <span className="font-display text-lg font-bold tracking-wide uppercase">
                {pad.label}
              </span>
              <span
                className={`font-mono-tabular text-xs ${
                  isLit ? 'text-slate-950/80' : 'text-slate-400'
                }`}
              >
                {pad.noteName} · {Math.round(pad.frequency)} Hz
              </span>
            </button>
          );
        })}
      </div>

      {/* Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#111621] border border-slate-800 rounded-xl px-5 py-3.5">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Volume2 className="w-4 h-4 text-amber-400" aria-hidden="true" />
          <span>Click sensor panels or press keys 1–{melody.padCount} in exact order</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleReplay}
            disabled={phase !== 'REPLICATE'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-[#0B0E14] border border-slate-700 text-slate-200 hover:bg-slate-800 disabled:opacity-40 transition-colors"
          >
            <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Replay Sequence (-2s)</span>
          </button>

          {playMode === 'campaign' && onFinishRoomEarly && (
            <button
              type="button"
              onClick={onFinishRoomEarly}
              disabled={levelNum <= 1}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wide rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
            >
              <span>Advance to Decrypt</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
