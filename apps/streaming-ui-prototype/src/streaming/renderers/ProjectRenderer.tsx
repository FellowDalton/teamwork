import React from 'react';
import type { ProjectDraftData } from '../accumulators/ProjectAccumulator';
import { FadeSlideIn, ScaleIn, DrawBorder, CountUp, TypeReveal, ProgressBar } from '../../components/StreamAnimations';

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400 border-red-500/30',
  medium: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  low: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  none: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
};

export const ProjectRenderer: React.FC<{ state: ProjectDraftData }> = ({ state }) => {
  const totalEstimate = state.summary.totalMinutes;

  return (
    <div className="space-y-4">
      {/* Project Header - types out the name */}
      {state.project.name && (
        <FadeSlideIn>
          <h3 className="text-lg font-semibold text-white">
            <TypeReveal text={state.project.name} charsPerFrame={8} />
          </h3>
          {state.project.description && (
            <p className="text-sm text-zinc-400 mt-1">
              <TypeReveal text={state.project.description} charsPerFrame={20} />
            </p>
          )}
        </FadeSlideIn>
      )}

      {/* Build Progress */}
      {state.isBuilding && (
        <FadeSlideIn>
          <ProgressBar
            progress={state.summary.totalTasks > 0 ? Math.min(
              ((state.summary.totalTasks + state.summary.totalSubtasks) / 20) * 100,
              95
            ) : 10}
          />
        </FadeSlideIn>
      )}

      {/* Summary Stats - numbers count up */}
      <div className="grid grid-cols-3 gap-3">
        <ScaleIn delay={0}>
          <StatBox label="Tasklists" value={state.summary.totalTasklists} color="text-purple-400" />
        </ScaleIn>
        <ScaleIn delay={30}>
          <StatBox label="Tasks" value={state.summary.totalTasks} color="text-cyan-400" />
        </ScaleIn>
        <ScaleIn delay={60}>
          <StatBox label="Subtasks" value={state.summary.totalSubtasks} color="text-emerald-400" />
        </ScaleIn>
      </div>

      {/* Estimated time - only when we have data */}
      {totalEstimate > 0 && (
        <FadeSlideIn className="text-center">
          <span className="text-xs text-zinc-500">Estimated: </span>
          <span className="text-xs font-mono text-amber-400">
            <CountUp value={Math.round(totalEstimate / 60)} suffix="h" />
          </span>
        </FadeSlideIn>
      )}

      {/* Tasklists - each card draws in */}
      {state.tasklists.map((tl, tlIndex) => (
        <FadeSlideIn key={tl.id} delay={tlIndex * 30}>
          <DrawBorder>
            <div className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2 h-2 rounded-full bg-purple-500 transition-all duration-300"
                  style={{ boxShadow: '0 0 6px rgba(168,85,247,0.4)' }}
                />
                <span className="text-sm font-medium text-zinc-200">
                  <TypeReveal text={tl.name} charsPerFrame={10} />
                </span>
                <span className="text-xs text-zinc-500 ml-auto font-mono">
                  <CountUp value={tl.tasks.length} /> tasks
                </span>
              </div>

              {tl.tasks.length > 0 && (
                <div className="space-y-1 ml-4">
                  {tl.tasks.map((task, taskIndex) => (
                    <FadeSlideIn key={task.id} delay={taskIndex * 20}>
                      <div className="flex items-center gap-2 py-1.5 group">
                        {/* Checkbox that appears */}
                        <div className="w-4 h-4 rounded border border-zinc-600 flex-shrink-0 transition-all duration-300 group-hover:border-cyan-500/50" />
                        <span className="text-sm text-zinc-300 flex-1">
                          <TypeReveal text={task.name} charsPerFrame={12} />
                        </span>
                        <ScaleIn delay={50}>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border transition-all duration-200 ${priorityColors[task.priority]}`}>
                            {task.priority}
                          </span>
                        </ScaleIn>
                        {task.estimatedMinutes && (
                          <span className="text-xs text-zinc-500 font-mono">
                            <CountUp value={task.estimatedMinutes} suffix="m" duration={300} />
                          </span>
                        )}
                      </div>

                      {/* Subtasks slide in underneath */}
                      {task.subtasks.length > 0 && (
                        <div className="ml-6 space-y-0.5 border-l border-zinc-800 pl-3">
                          {task.subtasks.map((st, stIndex) => (
                            <FadeSlideIn key={st.id} delay={stIndex * 15}>
                              <div className="flex items-center gap-2 py-0.5">
                                <div className="w-3 h-3 rounded-sm border border-zinc-700 flex-shrink-0 transition-all duration-300" />
                                <span className="text-xs text-zinc-400">
                                  <TypeReveal text={st.name} charsPerFrame={10} />
                                </span>
                              </div>
                            </FadeSlideIn>
                          ))}
                        </div>
                      )}
                    </FadeSlideIn>
                  ))}
                </div>
              )}
            </div>
          </DrawBorder>
        </FadeSlideIn>
      ))}

      {/* Complete message - special entrance */}
      {!state.isBuilding && state.message && (
        <ScaleIn>
          <div className="text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3 border border-emerald-500/20"
            style={{ boxShadow: '0 0 20px rgba(16,185,129,0.05)' }}
          >
            <TypeReveal text={state.message} charsPerFrame={15} />
          </div>
        </ScaleIn>
      )}
    </div>
  );
};

const StatBox: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div className="bg-zinc-800/50 rounded-lg p-2.5 border border-zinc-700/50 text-center transition-all duration-300 hover:bg-zinc-800/70">
    <div className={`text-xl font-bold font-mono ${color}`}>
      <CountUp value={value} />
    </div>
    <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
  </div>
);
