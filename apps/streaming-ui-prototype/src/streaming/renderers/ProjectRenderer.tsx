import React from 'react';
import type { ProjectDraftData } from '../accumulators/ProjectAccumulator';

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  none: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export const ProjectRenderer: React.FC<{ state: ProjectDraftData }> = ({ state }) => {
  return (
    <div className="space-y-4">
      {/* Project Header */}
      {state.project.name && (
        <div className="stream-item">
          <h3 className="text-lg font-semibold text-white">{state.project.name}</h3>
          {state.project.description && (
            <p className="text-sm text-zinc-400 mt-1">{state.project.description}</p>
          )}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatBox label="Tasklists" value={state.summary.totalTasklists} color="text-purple-400" />
        <StatBox label="Tasks" value={state.summary.totalTasks} color="text-cyan-400" />
        <StatBox label="Subtasks" value={state.summary.totalSubtasks} color="text-emerald-400" />
      </div>

      {/* Tasklists */}
      {state.tasklists.map((tl) => (
        <div key={tl.id} className="stream-item bg-zinc-800/50 rounded-lg border border-zinc-700/50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-purple-500" />
            <span className="text-sm font-medium text-zinc-200">{tl.name}</span>
            <span className="text-xs text-zinc-500 ml-auto">{tl.tasks.length} tasks</span>
          </div>

          {tl.tasks.length > 0 && (
            <div className="space-y-1.5 ml-4">
              {tl.tasks.map((task) => (
                <div key={task.id} className="stream-item">
                  <div className="flex items-center gap-2 py-1">
                    <div className="w-4 h-4 rounded border border-zinc-600 flex-shrink-0" />
                    <span className="text-sm text-zinc-300 flex-1">{task.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${priorityColors[task.priority]}`}>
                      {task.priority}
                    </span>
                    {task.estimatedMinutes && (
                      <span className="text-xs text-zinc-500 font-mono">{task.estimatedMinutes}m</span>
                    )}
                  </div>
                  {task.subtasks.length > 0 && (
                    <div className="ml-6 space-y-0.5">
                      {task.subtasks.map((st) => (
                        <div key={st.id} className="stream-item flex items-center gap-2 py-0.5">
                          <div className="w-3 h-3 rounded-sm border border-zinc-700 flex-shrink-0" />
                          <span className="text-xs text-zinc-400">{st.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Complete message */}
      {!state.isBuilding && state.message && (
        <div className="stream-item text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20">
          {state.message}
        </div>
      )}
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/50 text-center">
    <div className={`text-xl font-bold font-mono ${color}`}>{value}</div>
    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
  </div>
);
