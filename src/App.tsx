import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Play, RotateCcw, Home } from 'lucide-react';
import {
  calculateBonusDefuseSeconds,
  getRoomDurationSeconds,
  ROOM_ORDER,
  ROOMS,
} from './game/config';
import { soundEngine } from './game/audio';
import {
  clearScoreboard,
  getBestScoreFor,
  loadScoreboard,
  saveScoreEntry,
} from './game/scoreboard';
import type {
  AppScreenState,
  Difficulty,
  GameId,
  PlayMode,
  ScoreEntry,
  StageResult,
  TimerScale,
} from './game/types';
import { TitleScreen } from './components/TitleScreen';
import { GameHud } from './components/GameHud';
import { PowerGridGame } from './components/PowerGridGame';
import { MelodyHackGame } from './components/MelodyHackGame';
import { DecryptGame } from './components/DecryptGame';
import { BombDefuseGame } from './components/BombDefuseGame';
import { ScoreboardModal } from './components/ScoreboardModal';
import { OutcomeModal } from './components/OutcomeModal';

function getInitialQueryParams(): {
  autostart: boolean;
  gameParam: GameId | null;
} {
  if (typeof window === 'undefined') return { autostart: false, gameParam: null };
  const params = new URLSearchParams(window.location.search);
  const autostart = params.get('autostart') === '1';
  const rawGame = params.get('game') as GameId | null;
  const validGame = rawGame && ROOM_ORDER.includes(rawGame) ? rawGame : null;
  return { autostart, gameParam: validGame };
}

export default function App() {
  const initialQuery = useMemo(() => getInitialQueryParams(), []);

  const [playMode, setPlayMode] = useState<PlayMode>(
    initialQuery.gameParam ? 'practice' : 'campaign'
  );
  const [selectedRoom, setSelectedRoom] = useState<GameId>(
    initialQuery.gameParam ?? 'power-grid'
  );
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [timerScale, setTimerScale] = useState<TimerScale>('standard');
  const [callsign, setCallsign] = useState('SQUAD ALPHA');

  const [screenState, setScreenState] = useState<AppScreenState>(
    initialQuery.autostart ? 'playing' : 'title'
  );
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [runSeed, setRunSeed] = useState(1);

  const [totalScore, setTotalScore] = useState(0);
  const [stageScore, setStageScore] = useState(0);
  const [stageLevels, setStageLevels] = useState(0);
  const [totalLevels, setTotalLevels] = useState(0);
  const [stageMistakes, setStageMistakes] = useState(0);
  const [stageResults, setStageResults] = useState<StageResult[]>([]);

  const initialGameId: GameId =
    initialQuery.gameParam ??
    (initialQuery.autostart ? 'power-grid' : 'power-grid');

  const [timeRemaining, setTimeRemaining] = useState<number>(() =>
    getRoomDurationSeconds(initialGameId, 'normal', 'standard', 0)
  );
  const [outcome, setOutcome] = useState<'DEFUSED' | 'BLASTED' | 'CLEARED'>('CLEARED');
  const [scoreSaved, setScoreSaved] = useState(false);

  const [muted, setMuted] = useState(false);
  const [scoreboardOpen, setScoreboardOpen] = useState(false);
  const [scoreboardEntries, setScoreboardEntries] = useState<ScoreEntry[]>(() =>
    loadScoreboard()
  );

  const activeRoomId: GameId =
    playMode === 'campaign' ? ROOM_ORDER[activeStageIdx] : selectedRoom;

  const lastSecondRef = useRef<number>(Math.ceil(timeRemaining));
  const autoStartedRef = useRef(false);

  // Sync document.body.dataset.state
  useEffect(() => {
    const mappedState =
      screenState === 'transition' ? 'playing' : screenState;
    document.body.dataset.state = mappedState;
  }, [screenState]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      soundEngine.setMuted(next);
      return next;
    });
  }, []);

  const startMission = useCallback(
    (overrideMode?: PlayMode, overrideRoom?: GameId) => {
      const mode = overrideMode ?? playMode;
      const firstRoom = mode === 'campaign' ? ROOM_ORDER[0] : overrideRoom ?? selectedRoom;
      const duration = getRoomDurationSeconds(firstRoom, difficulty, timerScale, 0);

      setActiveStageIdx(0);
      setTotalScore(0);
      setStageScore(0);
      setStageLevels(0);
      setTotalLevels(0);
      setStageMistakes(0);
      setStageResults([]);
      setScoreSaved(false);
      setTimeRemaining(duration);
      lastSecondRef.current = Math.ceil(duration);
      setRunSeed((s) => s + 1);
      setScreenState('playing');

      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    },
    [playMode, selectedRoom, difficulty, timerScale]
  );

  useEffect(() => {
    if (initialQuery.autostart && !autoStartedRef.current) {
      autoStartedRef.current = true;
      startMission(
        initialQuery.gameParam ? 'practice' : 'campaign',
        initialQuery.gameParam ?? undefined
      );
    }
  }, [initialQuery, startMission]);

  const restartCurrentRoom = useCallback(() => {
    if (playMode === 'campaign') {
      startMission('campaign');
      return;
    }
    const duration = getRoomDurationSeconds(selectedRoom, difficulty, timerScale, 0);
    setTotalScore(0);
    setStageScore(0);
    setStageLevels(0);
    setTotalLevels(0);
    setStageMistakes(0);
    setScoreSaved(false);
    setTimeRemaining(duration);
    lastSecondRef.current = Math.ceil(duration);
    setRunSeed((s) => s + 1);
    setScreenState('playing');
  }, [playMode, selectedRoom, difficulty, timerScale, startMission]);

  const completeActiveRoom = useCallback(() => {
    const result: StageResult = {
      gameId: activeRoomId,
      scoreEarned: stageScore,
      levelsCleared: stageLevels,
      mistakes: stageMistakes,
      timeRemaining: Math.max(0, timeRemaining),
      cleared: activeRoomId !== 'bomb-defuse',
    };

    if (playMode === 'campaign') {
      const updatedResults = [...stageResults, result];
      setStageResults(updatedResults);

      if (activeStageIdx < ROOM_ORDER.length - 1) {
        soundEngine.playLevelClear();
        setScreenState('transition');
      } else {
        // Bomb Defuse timer expired
        soundEngine.playPaintBlast();
        setOutcome('BLASTED');
        setScreenState('gameover');
      }
    } else {
      if (activeRoomId === 'bomb-defuse') {
        soundEngine.playPaintBlast();
        setOutcome('BLASTED');
      } else {
        soundEngine.playLevelClear();
        setOutcome('CLEARED');
      }
      setStageResults([result]);
      setScreenState('gameover');
    }
  }, [
    activeRoomId,
    stageScore,
    stageLevels,
    stageMistakes,
    timeRemaining,
    playMode,
    stageResults,
    activeStageIdx,
  ]);

  const advanceToNextCampaignRoom = useCallback(() => {
    const nextIdx = activeStageIdx + 1;
    if (nextIdx >= ROOM_ORDER.length) return;
    const nextRoomId = ROOM_ORDER[nextIdx];
    const bonusSeconds =
      nextRoomId === 'bomb-defuse' ? calculateBonusDefuseSeconds(totalScore) : 0;
    const duration = getRoomDurationSeconds(
      nextRoomId,
      difficulty,
      timerScale,
      bonusSeconds
    );

    setActiveStageIdx(nextIdx);
    setStageScore(0);
    setStageLevels(0);
    setStageMistakes(0);
    setTimeRemaining(duration);
    lastSecondRef.current = Math.ceil(duration);
    setRunSeed((s) => s + 1);
    setScreenState('playing');
  }, [activeStageIdx, totalScore, difficulty, timerScale]);

  const handleBombDefused = useCallback(() => {
    const result: StageResult = {
      gameId: 'bomb-defuse',
      scoreEarned: stageScore,
      levelsCleared: stageLevels,
      mistakes: stageMistakes,
      timeRemaining,
      cleared: true,
    };
    const bonusPts = Math.round(timeRemaining * 25);
    setTotalScore((s) => s + bonusPts);
    setStageResults((prev) =>
      playMode === 'campaign' ? [...prev, result] : [result]
    );
    setOutcome('DEFUSED');
    setScreenState('gameover');
  }, [stageScore, stageLevels, stageMistakes, timeRemaining, playMode]);

  // Countdown loop using clamped dt
  useEffect(() => {
    if (screenState !== 'playing') return;

    let lastTime = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      setTimeRemaining((prev) => {
        const next = Math.max(0, prev - dt);
        const ceilSec = Math.ceil(next);
        if (ceilSec !== lastSecondRef.current) {
          lastSecondRef.current = ceilSec;
          if (ceilSec > 0 && ceilSec <= 10) {
            soundEngine.playTick(ceilSec <= 5);
          }
        }
        return next;
      });

      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [screenState]);

  // Trigger room completion when timer hits 0
  useEffect(() => {
    if (screenState === 'playing' && timeRemaining <= 0) {
      completeActiveRoom();
    }
  }, [screenState, timeRemaining, completeActiveRoom]);

  // Global keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      if (isTyping) return;

      if (screenState === 'title' && !scoreboardOpen) {
        if (e.key === 'Enter' || e.code === 'Space') {
          e.preventDefault();
          startMission();
        }
        return;
      }

      if (e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        toggleMute();
        return;
      }

      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
        if (scoreboardOpen) {
          setScoreboardOpen(false);
          return;
        }
        if (screenState === 'playing') {
          e.preventDefault();
          setScreenState('paused');
        } else if (screenState === 'paused') {
          e.preventDefault();
          setScreenState('playing');
        }
        return;
      }

      if ((e.key === 'r' || e.key === 'R') && (screenState === 'playing' || screenState === 'paused')) {
        e.preventDefault();
        restartCurrentRoom();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [screenState, scoreboardOpen, startMission, toggleMute, restartCurrentRoom]);

  const handleScoreAdd = useCallback((points: number) => {
    setTotalScore((s) => s + points);
    setStageScore((s) => s + points);
  }, []);

  const handleTimePenalty = useCallback((seconds: number) => {
    setStageMistakes((m) => m + 1);
    setTimeRemaining((t) => Math.max(0, t - seconds));
  }, []);

  const handleTimeBonus = useCallback((seconds: number) => {
    setTimeRemaining((t) => t + seconds);
  }, []);

  const handleLevelCleared = useCallback(() => {
    setStageLevels((l) => l + 1);
    setTotalLevels((l) => l + 1);
  }, []);

  const handleSaveScore = (name: string) => {
    const updated = saveScoreEntry({
      callsign: name,
      mode: playMode,
      gameId: playMode === 'campaign' ? 'campaign' : activeRoomId,
      difficulty,
      timerScale,
      score: Math.round(totalScore),
      levelsCleared: totalLevels,
      timeRemaining: Number(timeRemaining.toFixed(1)),
      outcome,
    });
    setScoreboardEntries(updated);
    setScoreSaved(true);
  };

  const handleClearScoreboard = () => {
    setScoreboardEntries(clearScoreboard());
  };

  const bestCampaignScore = getBestScoreFor(scoreboardEntries, 'campaign');

  return (
    <div className="min-h-screen w-full bg-[#0B0E14] text-slate-100 flex flex-col">
      {screenState === 'title' ? (
        <TitleScreen
          playMode={playMode}
          setPlayMode={setPlayMode}
          selectedRoom={selectedRoom}
          setSelectedRoom={setSelectedRoom}
          difficulty={difficulty}
          setDifficulty={setDifficulty}
          timerScale={timerScale}
          setTimerScale={setTimerScale}
          callsign={callsign}
          setCallsign={setCallsign}
          muted={muted}
          onToggleMute={toggleMute}
          onStart={() => startMission()}
          onOpenScoreboard={() => setScoreboardOpen(true)}
          bestCampaignScore={bestCampaignScore}
        />
      ) : (
        <>
          <GameHud
            playMode={playMode}
            gameId={activeRoomId}
            difficulty={difficulty}
            level={stageLevels + 1}
            score={totalScore}
            timeRemaining={timeRemaining}
            muted={muted}
            onToggleMute={toggleMute}
            onPause={() =>
              setScreenState((s) => (s === 'playing' ? 'paused' : 'playing'))
            }
            onRestart={restartCurrentRoom}
          />

          <main className="flex-1 flex items-center justify-center py-2">
            {activeRoomId === 'power-grid' && (
              <PowerGridGame
                key={`pg-${runSeed}`}
                difficulty={difficulty}
                playMode={playMode}
                paused={screenState !== 'playing'}
                onScoreAdd={handleScoreAdd}
                onLevelCleared={handleLevelCleared}
                onFinishRoomEarly={
                  playMode === 'campaign' ? completeActiveRoom : undefined
                }
              />
            )}

            {activeRoomId === 'melody-hack' && (
              <MelodyHackGame
                key={`mh-${runSeed}`}
                difficulty={difficulty}
                playMode={playMode}
                paused={screenState !== 'playing'}
                onScoreAdd={handleScoreAdd}
                onTimePenalty={handleTimePenalty}
                onLevelCleared={handleLevelCleared}
                onFinishRoomEarly={
                  playMode === 'campaign' ? completeActiveRoom : undefined
                }
              />
            )}

            {activeRoomId === 'decrypt' && (
              <DecryptGame
                key={`dc-${runSeed}`}
                difficulty={difficulty}
                playMode={playMode}
                paused={screenState !== 'playing'}
                onScoreAdd={handleScoreAdd}
                onTimePenalty={handleTimePenalty}
                onTimeBonus={handleTimeBonus}
                onLevelCleared={handleLevelCleared}
                onFinishRoomEarly={
                  playMode === 'campaign' ? completeActiveRoom : undefined
                }
              />
            )}

            {activeRoomId === 'bomb-defuse' && (
              <BombDefuseGame
                key={`bd-${runSeed}`}
                difficulty={difficulty}
                paused={screenState !== 'playing'}
                onScoreAdd={handleScoreAdd}
                onTimePenalty={handleTimePenalty}
                onLevelCleared={handleLevelCleared}
                onBombDefused={handleBombDefused}
              />
            )}
          </main>
        </>
      )}

      {/* Pause Modal */}
      {screenState === 'paused' && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Simulation Paused"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 p-4"
        >
          <div className="w-full max-w-sm bg-[#111621] border border-slate-700 rounded-xl p-6 space-y-5 text-center">
            <div>
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
                Simulation Paused
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                {ROOMS[activeRoomId].name} · Score {Math.round(totalScore).toLocaleString()}
              </p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => setScreenState('playing')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg transition-colors"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Resume Mission</span>
              </button>

              <button
                type="button"
                onClick={restartCurrentRoom}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0B0E14] border border-slate-700 hover:bg-slate-800 text-slate-200 font-semibold rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" aria-hidden="true" />
                <span>Restart</span>
              </button>

              <button
                type="button"
                onClick={() => setScreenState('title')}
                className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#0B0E14] border border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-white font-medium rounded-lg transition-colors"
              >
                <Home className="w-4 h-4" aria-hidden="true" />
                <span>Return to Title</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Stage Transition Briefing */}
      {screenState === 'transition' && activeStageIdx < ROOM_ORDER.length - 1 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Next Mission Briefing"
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 p-4"
        >
          <div className="w-full max-w-lg bg-[#111621] border border-slate-700 rounded-xl p-6 md:p-8 space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-medium text-emerald-400">
                Room Complete · {ROOMS[activeRoomId].name}
              </div>
              <h2 className="font-display text-3xl font-extrabold uppercase tracking-wide text-white">
                Next: {ROOMS[ROOM_ORDER[activeStageIdx + 1]].name}
              </h2>
              <p className="text-sm text-slate-300">
                {ROOMS[ROOM_ORDER[activeStageIdx + 1]].brief}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400">Room Score</div>
                <div className="font-mono-tabular text-xl font-bold text-emerald-400">
                  +{stageScore}
                </div>
              </div>
              <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400">Total Score</div>
                <div className="font-mono-tabular text-xl font-bold text-white">
                  {totalScore}
                </div>
              </div>
              <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
                <div className="text-xs text-slate-400">Defuse Bonus</div>
                <div className="font-mono-tabular text-xl font-bold text-cyan-400">
                  +{calculateBonusDefuseSeconds(totalScore)}s
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={advanceToNextCampaignRoom}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display text-xl font-extrabold uppercase tracking-wide rounded-lg transition-colors"
            >
              <span>Enter {ROOMS[ROOM_ORDER[activeStageIdx + 1]].name}</span>
              <ArrowRight className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* End-of-Run Outcome Modal */}
      {screenState === 'gameover' && (
        <OutcomeModal
          outcome={outcome}
          playMode={playMode}
          activeRoomId={activeRoomId}
          totalScore={totalScore}
          levelsCleared={totalLevels}
          timeRemaining={timeRemaining}
          stageResults={stageResults}
          callsign={callsign}
          onCallsignChange={setCallsign}
          onSaveScore={handleSaveScore}
          scoreSaved={scoreSaved}
          onPlayAgain={() => startMission()}
          onReturnTitle={() => setScreenState('title')}
          onOpenScoreboard={() => setScoreboardOpen(true)}
        />
      )}

      {/* Scoreboard Modal */}
      {scoreboardOpen && (
        <ScoreboardModal
          entries={scoreboardEntries}
          onClose={() => setScoreboardOpen(false)}
          onClear={handleClearScoreboard}
        />
      )}
    </div>
  );
}
