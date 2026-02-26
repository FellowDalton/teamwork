/**
 * StreamDisplayPanel - Generic panel that renders active stream plugins
 *
 * Replaces the draft-specific rendering in DataDisplayPanel.
 * Shows all active stream plugins' renderers, filtered by an optional `show` prop.
 */

import React from 'react';
import { useStreamContext } from '../hooks/StreamContext';
import { useStreamState, useActivePlugins } from '../hooks/useStreamState';
import { Clock, FolderOpen, Loader2, BarChart3 } from 'lucide-react';
import type { ProjectDraftData, TasklistDraft, TaskDraft, TimelogDraftData, TimelogDraftEntry } from '../../types/conversation';
import type { WebsiteDraftState } from '../accumulators/WebsiteAccumulator';
import type { StatusDraftState } from '../accumulators/StatusAccumulator';
import { ProjectDraftRenderer } from './ProjectDraftRenderer';
import { TimelogDraftRenderer } from './TimelogDraftRenderer';
import { WebsiteRenderer } from './WebsiteRenderer';
import { StatusRenderer } from './StatusRenderer';
import { CheckCircle2, Rocket } from 'lucide-react';

interface StreamDisplayPanelProps {
  /** Filter to only show these plugin IDs. If omitted, shows all active. */
  show?: string[];
  theme?: 'light' | 'dark';
  // Project draft action props
  onProjectDraftSubmit?: () => void;
  isCreatingProject?: boolean;
  onUpdateProjectTasklist?: (tasklistId: string, updates: Partial<TasklistDraft>) => void;
  onUpdateProjectTask?: (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => void;
  hourlyRate?: number;
  // Timelog draft action props
  onDraftUpdate?: (id: string, updates: Partial<TimelogDraftEntry>) => void;
  onDraftRemove?: (id: string) => void;
  onDraftSubmit?: () => void;
  isSubmitting?: boolean;
}

/** Individual plugin renderer that subscribes to its accumulator */
const PluginRenderer: React.FC<{
  pluginId: string;
  theme: 'light' | 'dark';
  props: StreamDisplayPanelProps;
}> = ({ pluginId, theme, props }) => {
  const { router } = useStreamContext();
  const { state, isActive } = useStreamState(router, pluginId);

  if (!isActive || !state) return null;

  switch (pluginId) {
    case 'project':
      return (
        <ProjectSection
          state={state as ProjectDraftData}
          theme={theme}
          {...props}
        />
      );
    case 'timelog':
      return (
        <TimelogSection
          state={state as TimelogDraftData}
          theme={theme}
          {...props}
        />
      );
    case 'website':
      return (
        <WebsiteSection
          state={state as WebsiteDraftState}
          theme={theme}
        />
      );
    case 'status':
      return (
        <StatusDashboardSection
          state={state as StatusDraftState}
          theme={theme}
        />
      );
    default:
      return null;
  }
};

/** Project draft section with header, card, and submit button */
const ProjectSection: React.FC<{
  state: ProjectDraftData;
  theme: 'light' | 'dark';
  onProjectDraftSubmit?: () => void;
  isCreatingProject?: boolean;
  onUpdateProjectTasklist?: (tasklistId: string, updates: Partial<TasklistDraft>) => void;
  onUpdateProjectTask?: (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => void;
  hourlyRate?: number;
}> = ({ state, theme, onProjectDraftSubmit, isCreatingProject, onUpdateProjectTasklist, onUpdateProjectTask, hourlyRate }) => {
  const isLight = theme === 'light';
  if (!state?.isDraft) return null;

  return (
    <div className="mb-4">
      {/* Draft Header */}
      <div className={`
        flex items-center justify-between mb-3 pb-2 border-b
        ${isLight ? 'border-zinc-300' : 'border-zinc-700'}
      `}>
        <div className="flex items-center gap-2">
          <FolderOpen size={14} className="text-purple-500" />
          <span className={`text-sm font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-200'}`}>
            New Project Preview
          </span>
        </div>
        <span className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
          Review before creating
        </span>
      </div>

      <ProjectDraftRenderer
        state={state}
        theme={theme}
        hourlyRate={hourlyRate}
        onUpdateProjectTasklist={onUpdateProjectTasklist}
        onUpdateProjectTask={onUpdateProjectTask}
      />

      {/* Create Project Button */}
      {!(state as any)?.isBuilding && (
        <div className="mt-4 flex justify-end gap-3">
          {state.isCreated && state.createdProjectUrl && (
            <a
              href={state.createdProjectUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200 bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer shadow-lg hover:shadow-cyan-500/25"
            >
              <FolderOpen size={16} />
              <span>Open in Teamwork</span>
            </a>
          )}
          <button
            onClick={onProjectDraftSubmit}
            disabled={isCreatingProject || state.isCreated}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              ${isCreatingProject || state.isCreated
                ? 'opacity-50 cursor-not-allowed bg-zinc-600 text-zinc-400'
                : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer shadow-lg hover:shadow-purple-500/25'
              }
            `}
          >
            {isCreatingProject ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Creating Project...</span>
              </>
            ) : state.isCreated ? (
              <>
                <CheckCircle2 size={16} />
                <span>Project Created</span>
              </>
            ) : (
              <>
                <Rocket size={16} />
                <span>Create Project</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

/** Timelog draft section with header, cards, and submit button */
const TimelogSection: React.FC<{
  state: TimelogDraftData;
  theme: 'light' | 'dark';
  onDraftUpdate?: (id: string, updates: Partial<TimelogDraftEntry>) => void;
  onDraftRemove?: (id: string) => void;
  onDraftSubmit?: () => void;
  isSubmitting?: boolean;
}> = ({ state, theme, onDraftUpdate, onDraftRemove, onDraftSubmit, isSubmitting }) => {
  const isLight = theme === 'light';
  if (!state?.isDraft || state.entries.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Draft Header */}
      <div className={`
        flex items-center justify-between mb-3 pb-2 border-b
        ${isLight ? 'border-zinc-300' : 'border-zinc-700'}
      `}>
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-emerald-500" />
          <span className={`text-sm font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-200'}`}>
            Draft Time Entries
          </span>
          <span className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
            ({state.entries.length} entries)
          </span>
        </div>
        <div className="flex items-center gap-2">
          {(state as any)?.isBuilding && (
            <div className="flex items-center gap-1.5">
              <Loader2 size={12} className="text-emerald-500 animate-spin" />
              <span className="text-[10px] font-mono text-emerald-500 animate-pulse">BUILDING...</span>
            </div>
          )}
          <div className={`text-sm font-mono font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
            {state.summary.totalHours.toFixed(1)}h total
          </div>
        </div>
      </div>

      <TimelogDraftRenderer
        state={state}
        theme={theme}
        onDraftUpdate={onDraftUpdate}
        onDraftRemove={onDraftRemove}
      />

      {/* Submit Button - hidden while building */}
      {!(state as any)?.isBuilding && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onDraftSubmit}
            disabled={isSubmitting || state.entries.length === 0}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
              transition-all duration-200
              ${isSubmitting || state.entries.length === 0
                ? 'opacity-50 cursor-not-allowed bg-zinc-600 text-zinc-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-500 cursor-pointer shadow-lg hover:shadow-emerald-500/25'
              }
            `}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                <span>Submit {state.summary.totalHours.toFixed(1)}h</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

/** Website builder section */
const WebsiteSection: React.FC<{
  state: WebsiteDraftState;
  theme: 'light' | 'dark';
}> = ({ state, theme }) => {
  const isLight = theme === 'light';

  return (
    <div className="mb-4">
      {/* Header */}
      <div className={`
        flex items-center justify-between mb-3 pb-2 border-b
        ${isLight ? 'border-zinc-300' : 'border-zinc-700'}
      `}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🌐</span>
          <span className={`text-sm font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-200'}`}>
            Website Builder
          </span>
        </div>
        {state.isBuilding && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="text-cyan-500 animate-spin" />
            <span className="text-[10px] font-mono text-cyan-500 animate-pulse">BUILDING...</span>
          </div>
        )}
      </div>

      <WebsiteRenderer state={state} theme={theme} />
    </div>
  );
};

/** Status dashboard section */
const StatusDashboardSection: React.FC<{
  state: StatusDraftState;
  theme: 'light' | 'dark';
}> = ({ state, theme }) => {
  const isLight = theme === 'light';

  return (
    <div className="mb-4">
      {/* Header */}
      <div className={`
        flex items-center justify-between mb-3 pb-2 border-b
        ${isLight ? 'border-zinc-300' : 'border-zinc-700'}
      `}>
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-amber-500" />
          <span className={`text-sm font-medium ${isLight ? 'text-zinc-700' : 'text-zinc-200'}`}>
            Status Dashboard
          </span>
        </div>
        {state.isBuilding && (
          <div className="flex items-center gap-1.5">
            <Loader2 size={12} className="text-amber-500 animate-spin" />
            <span className="text-[10px] font-mono text-amber-500 animate-pulse">BUILDING...</span>
          </div>
        )}
      </div>

      <StatusRenderer state={state} theme={theme} />
    </div>
  );
};

export const StreamDisplayPanel: React.FC<StreamDisplayPanelProps> = (props) => {
  const { show, theme = 'dark' } = props;
  const { router } = useStreamContext();
  const activePluginIds = useActivePlugins(router);

  // Filter to only requested plugins, or show all active
  const visibleIds = show
    ? activePluginIds.filter(id => show.includes(id))
    : activePluginIds;

  if (visibleIds.length === 0) return null;

  return (
    <>
      {visibleIds.map(pluginId => (
        <PluginRenderer
          key={pluginId}
          pluginId={pluginId}
          theme={theme}
          props={props}
        />
      ))}
    </>
  );
};
