import React, { useState } from 'react';
import { Trash2, Trophy, X } from 'lucide-react';
import { DIFFICULTY_CONFIG, ROOMS } from '../game/config';
import type { GameId, ScoreEntry } from '../game/types';

interface ScoreboardModalProps {
  entries: ScoreEntry[];
  onClose: () => void;
  onClear: () => void;
}

type FilterOption = 'all' | 'campaign' | GameId;

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  entries,
  onClose,
  onClear,
}) => {
  const [filter, setFilter] = useState<FilterOption>('all');

  const filtered = entries.filter((entry) => {
    if (filter === 'all') return true;
    return entry.gameId === filter;
  });

  const filterButtons: { id: FilterOption; label: string }[] = [
    { id: 'all', label: 'All Runs' },
    { id: 'campaign', label: 'Full Campaign' },
    { id: 'power-grid', label: 'Power Grid' },
    { id: 'melody-hack', label: 'Melody Hack' },
    { id: 'decrypt', label: 'Decrypt' },
    { id: 'bomb-defuse', label: 'Bomb Defuse' },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mission Scoreboard"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
    >
      <div className="w-full max-w-4xl bg-[#111621] border border-slate-700 rounded-xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <Trophy className="w-5 h-5 text-amber-400" aria-hidden="true" />
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
              Mission Scoreboard
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close scoreboard"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar */}
        <div className="px-6 py-3 bg-[#0D1119] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {filterButtons.map((btn) => (
              <button
                key={btn.id}
                type="button"
                onClick={() => setFilter(btn.id)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  filter === btn.id
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-[#131924] text-slate-300 hover:bg-slate-800'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/40 rounded-md transition-colors whitespace-nowrap"
            >
              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Clear Records</span>
            </button>
          )}
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 px-6 py-4">
          {filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-slate-300 font-medium">No mission runs recorded for this filter yet.</p>
              <p className="text-xs text-slate-500">Complete a campaign or practice drill to log your score.</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-3">Rank</th>
                  <th className="py-2.5 px-3">Callsign</th>
                  <th className="py-2.5 px-3">Mission</th>
                  <th className="py-2.5 px-3">Difficulty</th>
                  <th className="py-2.5 px-3 text-right">Levels</th>
                  <th className="py-2.5 px-3 text-right">Score</th>
                  <th className="py-2.5 pl-3 text-right">Outcome</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70 text-sm">
                {filtered.map((entry, idx) => {
                  const missionName =
                    entry.gameId === 'campaign' ? 'Full Campaign' : ROOMS[entry.gameId].name;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30">
                      <td className="py-3 pr-3 font-mono-tabular text-slate-400">
                        #{String(idx + 1).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-3 font-semibold text-white">
                        {entry.callsign}
                      </td>
                      <td className="py-3 px-3 text-slate-300">{missionName}</td>
                      <td className="py-3 px-3 text-slate-300">
                        {DIFFICULTY_CONFIG[entry.difficulty].label}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular text-slate-300">
                        {entry.levelsCleared}
                      </td>
                      <td className="py-3 px-3 text-right font-mono-tabular font-bold text-emerald-400">
                        {entry.score.toLocaleString()}
                      </td>
                      <td className="py-3 pl-3 text-right">
                        <span
                          className={`text-xs font-bold tracking-wide ${
                            entry.outcome === 'DEFUSED'
                              ? 'text-emerald-400'
                              : entry.outcome === 'CLEARED'
                              ? 'text-cyan-400'
                              : 'text-red-400'
                          }`}
                        >
                          {entry.outcome}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
