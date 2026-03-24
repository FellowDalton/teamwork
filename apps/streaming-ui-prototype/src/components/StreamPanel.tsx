import React from 'react';
import { useStreamContext } from '../streaming/hooks/StreamContext';
import { useStreamState, useActivePlugins } from '../streaming/hooks/useStreamState';
import type { ProjectDraftData } from '../streaming/accumulators/ProjectAccumulator';
import type { DashboardState } from '../streaming/accumulators/DashboardAccumulator';
import { ProjectRenderer } from '../streaming/renderers/ProjectRenderer';
import { DashboardRenderer } from '../streaming/renderers/DashboardRenderer';

const PluginPanel: React.FC<{ pluginId: string }> = ({ pluginId }) => {
  const { router } = useStreamContext();
  const { state, isActive, isComplete } = useStreamState(router, pluginId);

  if (!isActive || !state) return null;

  return (
    <div className="bg-zinc-900/80 backdrop-blur rounded-xl border border-zinc-800 p-5 overflow-hidden">
      {/* Plugin Header */}
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isComplete ? 'bg-emerald-500' : 'bg-cyan-500 pulse-dot'}`} />
          <span className="text-sm font-medium text-zinc-300">
            {pluginId === 'project' ? 'Project Draft' : 'Live Dashboard'}
          </span>
        </div>
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
          isComplete
            ? 'bg-emerald-500/20 text-emerald-400'
            : 'bg-cyan-500/20 text-cyan-400'
        }`}>
          {isComplete ? 'COMPLETE' : 'STREAMING'}
        </span>
      </div>

      {/* Plugin Content */}
      {pluginId === 'project' && <ProjectRenderer state={state as ProjectDraftData} />}
      {pluginId === 'dashboard' && <DashboardRenderer state={state as DashboardState} />}
    </div>
  );
};

export const StreamPanel: React.FC = () => {
  const { router } = useStreamContext();
  const activePluginIds = useActivePlugins(router);

  if (activePluginIds.length === 0) {
    return (
      <div className="text-center py-20 text-zinc-600">
        <div className="text-4xl mb-3 opacity-50">&#x26A1;</div>
        <p className="text-sm">No active streams. Start a demo to see the self-building UI.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activePluginIds.map(id => (
        <PluginPanel key={id} pluginId={id} />
      ))}
    </div>
  );
};
