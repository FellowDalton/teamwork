import React from 'react';
import { useStreamContext } from '../streaming/hooks/StreamContext';
import { useStreamState, useActivePlugins } from '../streaming/hooks/useStreamState';
import type { ProjectDraftData } from '../streaming/accumulators/ProjectAccumulator';
import type { DashboardState } from '../streaming/accumulators/DashboardAccumulator';
import { ProjectRenderer } from '../streaming/renderers/ProjectRenderer';
import { DashboardRenderer } from '../streaming/renderers/DashboardRenderer';
import { ScaleIn } from './StreamAnimations';

const PluginPanel: React.FC<{ pluginId: string; index: number }> = ({ pluginId, index }) => {
  const { router } = useStreamContext();
  const { state, isActive, isComplete } = useStreamState(router, pluginId);

  if (!isActive || !state) return null;

  const label = pluginId === 'project' ? 'Project Draft' : 'Live Dashboard';

  return (
    <ScaleIn delay={index * 50}>
      <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 overflow-hidden transition-all duration-500"
        style={{
          boxShadow: isComplete
            ? '0 0 30px rgba(16,185,129,0.03)'
            : '0 0 30px rgba(6,182,212,0.03)',
        }}
      >
        {/* Header bar with streaming indicator */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-800/50">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
              isComplete ? 'bg-emerald-500' : 'bg-cyan-500 animate-pulse'
            }`}
              style={{ boxShadow: isComplete
                ? '0 0 6px rgba(16,185,129,0.5)'
                : '0 0 6px rgba(6,182,212,0.5)',
              }}
            />
            <span className="text-sm font-medium text-zinc-300">{label}</span>
          </div>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all duration-300 ${
            isComplete
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-cyan-500/10 text-cyan-400'
          }`}>
            {isComplete ? 'COMPLETE' : 'STREAMING'}
          </span>
        </div>

        {/* Content area */}
        <div className="p-5">
          {pluginId === 'project' && <ProjectRenderer state={state as ProjectDraftData} />}
          {pluginId === 'dashboard' && <DashboardRenderer state={state as DashboardState} />}
        </div>

        {/* Bottom progress line while streaming */}
        {!isComplete && (
          <div className="h-0.5 bg-zinc-800 overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full animate-shimmer" />
          </div>
        )}
      </div>
    </ScaleIn>
  );
};

export const StreamPanel: React.FC = () => {
  const { router } = useStreamContext();
  const activePluginIds = useActivePlugins(router);

  if (activePluginIds.length === 0) return null;

  return (
    <div className="space-y-4">
      {activePluginIds.map((id, index) => (
        <PluginPanel key={id} pluginId={id} index={index} />
      ))}
    </div>
  );
};
