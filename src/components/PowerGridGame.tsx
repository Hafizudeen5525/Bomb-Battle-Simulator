import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Eraser, RotateCcw } from 'lucide-react';
import {
  CIRCUIT_COLORS,
  generatePowerGridPuzzle,
  interpolateDragSteps,
  validatePowerGridBoard,
  type GridCoord,
  type PathMap,
  type PowerGridPuzzle,
} from '../game/powerGrid';
import { DIFFICULTY_CONFIG } from '../game/config';
import { soundEngine } from '../game/audio';
import type { Difficulty, PlayMode } from '../game/types';

interface PowerGridGameProps {
  difficulty: Difficulty;
  playMode: PlayMode;
  paused: boolean;
  onScoreAdd: (points: number) => void;
  onLevelCleared: () => void;
  onFinishRoomEarly?: () => void;
}

export const PowerGridGame: React.FC<PowerGridGameProps> = ({
  difficulty,
  playMode,
  paused,
  onScoreAdd,
  onLevelCleared,
  onFinishRoomEarly,
}) => {
  const [level, setLevel] = useState(1);
  const [puzzle, setPuzzle] = useState<PowerGridPuzzle>(() =>
    generatePowerGridPuzzle(1, difficulty)
  );
  const [paths, setPaths] = useState<PathMap>({});
  const [activeColor, setActiveColor] = useState<number | null>(null);
  const [solvedBanner, setSolvedBanner] = useState(false);

  const gridRef = useRef<HTMLDivElement | null>(null);
  const pathsRef = useRef<PathMap>(paths);
  const activeColorRef = useRef<number | null>(activeColor);
  const isDraggingRef = useRef(false);
  const lastCellRef = useRef<GridCoord | null>(null);
  const solvedTimerRef = useRef<number | null>(null);

  pathsRef.current = paths;
  activeColorRef.current = activeColor;

  const validation = useMemo(
    () => validatePowerGridBoard(puzzle, paths),
    [puzzle, paths]
  );

  // Map endpoints for O(1) lookup
  const endpointMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const pair of puzzle.pairs) {
      map.set(`${pair.a.r},${pair.a.c}`, pair.colorIndex);
      map.set(`${pair.b.r},${pair.b.c}`, pair.colorIndex);
    }
    return map;
  }, [puzzle]);

  useEffect(() => {
    const stopDrag = () => {
      isDraggingRef.current = false;
      lastCellRef.current = null;
    };
    window.addEventListener('pointerup', stopDrag);
    window.addEventListener('pointercancel', stopDrag);
    return () => {
      window.removeEventListener('pointerup', stopDrag);
      window.removeEventListener('pointercancel', stopDrag);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (solvedTimerRef.current) window.clearTimeout(solvedTimerRef.current);
    };
  }, []);

  // Trigger level clear when solved
  useEffect(() => {
    if (!validation.isSolved || solvedBanner) return;
    setSolvedBanner(true);
    isDraggingRef.current = false;
    lastCellRef.current = null;
    soundEngine.playLevelClear();

    const mult = DIFFICULTY_CONFIG[difficulty].scoreMultiplier;
    const basePts = 180 + level * 40;
    const coverageBonus = validation.fullCoverage ? 100 : 0;
    onScoreAdd(Math.round((basePts + coverageBonus) * mult));
    onLevelCleared();

    solvedTimerRef.current = window.setTimeout(() => {
      const nextLvl = level + 1;
      setLevel(nextLvl);
      setPuzzle(generatePowerGridPuzzle(nextLvl, difficulty));
      setPaths({});
      pathsRef.current = {};
      setActiveColor(null);
      activeColorRef.current = null;
      setSolvedBanner(false);
    }, 650);
  }, [
    validation.isSolved,
    validation.fullCoverage,
    solvedBanner,
    difficulty,
    level,
    onScoreAdd,
    onLevelCleared,
  ]);

  const commitPaths = useCallback((nextPaths: PathMap) => {
    pathsRef.current = nextPaths;
    setPaths(nextPaths);
  }, []);

  const commitActiveColor = useCallback((colorIdx: number | null) => {
    activeColorRef.current = colorIdx;
    setActiveColor(colorIdx);
  }, []);

  const stepPathTo = useCallback(
    (coord: GridCoord) => {
      const color = activeColorRef.current;
      if (color === null) return;

      const endpointColor = endpointMap.get(`${coord.r},${coord.c}`);
      if (endpointColor !== undefined && endpointColor !== color) return;

      const prev = pathsRef.current;
      const current = prev[color] ?? [];
      if (current.length === 0) return;

      const last = current[current.length - 1];
      if (last.r === coord.r && last.c === coord.c) return;

      // Backtracking along own path
      const selfIdx = current.findIndex((p) => p.r === coord.r && p.c === coord.c);
      if (selfIdx !== -1) {
        const sliced = current.slice(0, selfIdx + 1);
        commitPaths({ ...prev, [color]: sliced });
        soundEngine.playClick(0.95);
        return;
      }

      // Prevent extending past already-completed opposite endpoint
      const pair = puzzle.pairs.find((p) => p.colorIndex === color);
      const alreadyLinked =
        pair &&
        current.length >= 2 &&
        ((current[0].r === pair.a.r &&
          current[0].c === pair.a.c &&
          last.r === pair.b.r &&
          last.c === pair.b.c) ||
          (current[0].r === pair.b.r &&
            current[0].c === pair.b.c &&
            last.r === pair.a.r &&
            last.c === pair.a.c));
      if (alreadyLinked) return;

      const steps = interpolateDragSteps(last, coord, (c) => {
        const ep = endpointMap.get(`${c.r},${c.c}`);
        return ep === undefined || ep === color;
      });
      if (steps.length === 0) return;

      let nextPaths: PathMap = { ...prev };
      let updated = [...current];

      for (const step of steps) {
        // Stop if step loops back into own path
        const hitSelf = updated.findIndex((p) => p.r === step.r && p.c === step.c);
        if (hitSelf !== -1) {
          updated = updated.slice(0, hitSelf + 1);
          continue;
        }

        // Trim any conflicting other color path at this cell
        for (const [otherKey, otherPath] of Object.entries(nextPaths)) {
          const oColor = Number(otherKey);
          if (oColor === color) continue;
          const hitIdx = otherPath.findIndex((p) => p.r === step.r && p.c === step.c);
          if (hitIdx !== -1) {
            nextPaths[oColor] = otherPath.slice(0, hitIdx);
          }
        }

        updated.push(step);

        const stepEp = endpointMap.get(`${step.r},${step.c}`);
        if (stepEp === color && updated.length >= 2) {
          soundEngine.playConnect();
          break;
        } else {
          soundEngine.playClick(1.1);
        }
      }

      nextPaths[color] = updated;
      commitPaths(nextPaths);
    },
    [endpointMap, puzzle.pairs, commitPaths]
  );

  const startAtCoord = useCallback(
    (coord: GridCoord) => {
      if (paused || solvedBanner) return;
      const endpointColor = endpointMap.get(`${coord.r},${coord.c}`);

      // Step-by-step tap fallback: if user taps a cell adjacent to currently selected path
      const currentColor = activeColorRef.current;
      if (
        currentColor !== null &&
        (endpointColor === undefined || endpointColor === currentColor)
      ) {
        const currPath = pathsRef.current[currentColor] ?? [];
        if (currPath.length > 0) {
          const last = currPath[currPath.length - 1];
          const dist = Math.abs(last.r - coord.r) + Math.abs(last.c - coord.c);
          if (dist === 1) {
            isDraggingRef.current = true;
            lastCellRef.current = coord;
            stepPathTo(coord);
            return;
          }
        }
      }

      // Start fresh from endpoint
      if (endpointColor !== undefined) {
        commitActiveColor(endpointColor);
        isDraggingRef.current = true;
        lastCellRef.current = coord;
        commitPaths({
          ...pathsRef.current,
          [endpointColor]: [coord],
        });
        soundEngine.playClick(1.0);
        return;
      }

      // Resume from existing path body
      for (const [colorKey, path] of Object.entries(pathsRef.current)) {
        const idx = path.findIndex((p) => p.r === coord.r && p.c === coord.c);
        if (idx !== -1) {
          const cIdx = Number(colorKey);
          commitActiveColor(cIdx);
          isDraggingRef.current = true;
          lastCellRef.current = coord;
          commitPaths({
            ...pathsRef.current,
            [cIdx]: path.slice(0, idx + 1),
          });
          soundEngine.playClick(0.95);
          return;
        }
      }
    },
    [paused, solvedBanner, endpointMap, commitActiveColor, commitPaths, stepPathTo]
  );

  const clientPointToCoord = useCallback(
    (clientX: number, clientY: number): GridCoord | null => {
      const el = gridRef.current;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      // Account for 8px (p-2) inner padding inside the grid container
      const pad = 8;
      const innerWidth = rect.width - pad * 2;
      const innerHeight = rect.height - pad * 2;
      if (innerWidth <= 0 || innerHeight <= 0) return null;

      const x = clientX - rect.left - pad;
      const y = clientY - rect.top - pad;
      if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) return null;

      const c = Math.min(puzzle.size - 1, Math.max(0, Math.floor((x / innerWidth) * puzzle.size)));
      const r = Math.min(puzzle.size - 1, Math.max(0, Math.floor((y / innerHeight) * puzzle.size)));
      return { r, c };
    },
    [puzzle.size]
  );

  const handleGridPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (paused || solvedBanner) return;
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const coord = clientPointToCoord(e.clientX, e.clientY);
    if (!coord) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture isn't supported in synthetic test environments
    }

    startAtCoord(coord);
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current || paused || solvedBanner) return;
    const coord = clientPointToCoord(e.clientX, e.clientY);
    if (!coord) return;

    const last = lastCellRef.current;
    if (last && last.r === coord.r && last.c === coord.c) return;
    lastCellRef.current = coord;
    stepPathTo(coord);
  };

  const handleGridPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    lastCellRef.current = null;
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }
  };

  const handleClearBoard = () => {
    if (paused || solvedBanner) return;
    commitPaths({});
    commitActiveColor(null);
    soundEngine.playClick(0.8);
  };

  const handleResetActiveLine = () => {
    if (paused || solvedBanner || activeColor === null) return;
    const next = { ...pathsRef.current };
    delete next[activeColor];
    commitPaths(next);
    soundEngine.playClick(0.8);
  };

  const size = puzzle.size;
  const fillPct = Math.round((validation.filledCells / validation.totalCells) * 100);

  return (
    <div className="w-full max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 lg:gap-8">
      {/* Main Circuit Grid */}
      <div className="relative bg-[#111621] border border-slate-800 rounded-xl p-3 sm:p-5 select-none touch-none">
        <div
          ref={gridRef}
          data-testid="power-grid-board"
          onPointerDown={handleGridPointerDown}
          onPointerMove={handleGridPointerMove}
          onPointerUp={handleGridPointerEnd}
          onPointerCancel={handleGridPointerEnd}
          className="relative grid gap-1 bg-[#0B0E14] p-2 rounded-lg border border-slate-800 touch-none select-none cursor-crosshair"
          style={{
            gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${size}, minmax(0, 1fr))`,
            width: 'min(90vw, 480px)',
            height: 'min(90vw, 480px)',
          }}
        >
          {/* SVG Pipe Overlay */}
          <svg
            viewBox={`0 0 ${size * 100} ${size * 100}`}
            className="pointer-events-none absolute inset-2 w-[calc(100%-16px)] h-[calc(100%-16px)] z-10"
            aria-hidden="true"
          >
            {Object.entries(paths).map(([colorKey, path]) => {
              if (!path || path.length < 2) return null;
              const def = CIRCUIT_COLORS[Number(colorKey) % CIRCUIT_COLORS.length];
              const points = path
                .map((p) => `${p.c * 100 + 50},${p.r * 100 + 50}`)
                .join(' ');
              return (
                <polyline
                  key={colorKey}
                  points={points}
                  fill="none"
                  stroke={def.hex}
                  strokeWidth={30}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={0.9}
                />
              );
            })}
          </svg>

          {/* Grid Cells */}
          {Array.from({ length: size }, (_, r) =>
            Array.from({ length: size }, (_, c) => {
              const endpointColor = endpointMap.get(`${r},${c}`);
              let occupiedColor: number | undefined;
              for (const [cKey, path] of Object.entries(paths)) {
                if (path.some((p) => p.r === r && p.c === c)) {
                  occupiedColor = Number(cKey);
                  break;
                }
              }
              const colorDef =
                endpointColor !== undefined
                  ? CIRCUIT_COLORS[endpointColor % CIRCUIT_COLORS.length]
                  : null;
              const pathColorDef =
                occupiedColor !== undefined
                  ? CIRCUIT_COLORS[occupiedColor % CIRCUIT_COLORS.length]
                  : null;
              const isSelectedEndpoint =
                endpointColor !== undefined && endpointColor === activeColor;

              return (
                <button
                  key={`${r}-${c}`}
                  type="button"
                  onClick={() => {
                    // Keyboard activation (Enter/Space) support without duplicating pointer down
                    if (!isDraggingRef.current && lastCellRef.current === null) {
                      startAtCoord({ r, c });
                      lastCellRef.current = null;
                      isDraggingRef.current = false;
                    }
                  }}
                  aria-label={
                    colorDef
                      ? `Circuit node ${colorDef.label} (${colorDef.symbol}) at row ${r + 1} column ${c + 1}`
                      : `Grid cell row ${r + 1} column ${c + 1}`
                  }
                  className={`relative z-20 flex items-center justify-center rounded-md border transition-colors touch-none ${
                    isSelectedEndpoint
                      ? 'border-white/80 bg-slate-800/70'
                      : 'border-slate-800/80 bg-[#141B29]/75 hover:bg-slate-800/70'
                  }`}
                  style={
                    pathColorDef && !colorDef
                      ? { backgroundColor: `${pathColorDef.hex}22` }
                      : undefined
                  }
                >
                  {colorDef && (
                    <span
                      className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono-tabular text-xs font-extrabold text-slate-950 shadow-sm ring-2 ring-slate-950/60 pointer-events-none"
                      style={{ backgroundColor: colorDef.hex }}
                    >
                      {colorDef.symbol}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Solved feedback bar */}
        {solvedBanner && (
          <div className="mt-3 py-2 px-4 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-center text-sm font-bold text-emerald-300">
            Grid Linked · Loading Level {level + 1}
          </div>
        )}
      </div>

      {/* Right Side Tactical Panel */}
      <aside className="w-full max-w-md lg:w-80 bg-[#111621] border border-slate-800 rounded-xl p-4 sm:p-5 space-y-4 sm:space-y-5">
        <div>
          <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white">
            Power Grid Status
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Touch and drag (or click and drag) from any node to its matching letter without crossing lines.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Pairs Linked</div>
            <div
              data-testid="power-grid-pairs"
              className="font-mono-tabular text-2xl font-bold text-cyan-400 mt-0.5"
            >
              {validation.connectedCount} / {validation.totalPairs}
            </div>
          </div>
          <div className="bg-[#0B0E14] border border-slate-800 rounded-lg p-3">
            <div className="text-xs text-slate-400">Grid Fill</div>
            <div className="font-mono-tabular text-2xl font-bold text-white mt-0.5">
              {fillPct}%
            </div>
          </div>
        </div>

        {/* Color Pair Legend */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-slate-400">Circuit Channels</div>
          <div className="grid grid-cols-2 gap-2">
            {puzzle.pairs.map((pair) => {
              const def = CIRCUIT_COLORS[pair.colorIndex % CIRCUIT_COLORS.length];
              const path = paths[pair.colorIndex] ?? [];
              const linked =
                path.length >= 2 &&
                ((path[0].r === pair.a.r &&
                  path[0].c === pair.a.c &&
                  path[path.length - 1].r === pair.b.r &&
                  path[path.length - 1].c === pair.b.c) ||
                  (path[0].r === pair.b.r &&
                    path[0].c === pair.b.c &&
                    path[path.length - 1].r === pair.a.r &&
                    path[path.length - 1].c === pair.a.c));
              return (
                <button
                  key={pair.colorIndex}
                  type="button"
                  onClick={() => commitActiveColor(pair.colorIndex)}
                  className={`flex items-center justify-between px-2.5 py-2 rounded-md border text-xs transition-colors ${
                    activeColor === pair.colorIndex
                      ? 'border-slate-500 bg-slate-800 text-white'
                      : 'border-slate-800 bg-[#0B0E14] text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: def.hex }}
                    />
                    <span>Line {def.symbol}</span>
                  </span>
                  <span className={linked ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {linked ? 'OK' : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={handleResetActiveLine}
            disabled={activeColor === null}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg bg-[#0B0E14] border border-slate-700 text-slate-300 hover:text-white disabled:opacity-40 transition-colors"
          >
            <Eraser className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear Line</span>
          </button>
          <button
            type="button"
            onClick={handleClearBoard}
            className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-xs font-semibold rounded-lg bg-[#0B0E14] border border-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Reset Grid</span>
          </button>
        </div>

        {playMode === 'campaign' && onFinishRoomEarly && (
          <button
            type="button"
            onClick={onFinishRoomEarly}
            disabled={level <= 1}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wide rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white transition-colors"
          >
            <span>Advance to Melody Hack</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </aside>
    </div>
  );
};
