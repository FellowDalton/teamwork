import React from 'react';
import type { StreamRendererProps } from '../core/types';
import type { GeneralDraftState, GeneralTaskItem } from '../accumulators/GeneralAccumulator';

interface GeneralRendererExtraProps {
  onTaskChange?: (taskId: string, updates: Partial<GeneralTaskItem>) => void;
  onTaskRemove?: (taskId: string) => void;
}

type Props = StreamRendererProps<GeneralDraftState> & GeneralRendererExtraProps;

export const GeneralRenderer: React.FC<Props> = ({ state, theme, onTaskChange, onTaskRemove }) => {
  const isLight = theme === 'light';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-500';
  const cardBg = isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-700';
  const inputBg = isLight ? 'bg-white border-zinc-300 text-zinc-800' : 'bg-zinc-800 border-zinc-700 text-zinc-100';

  if (!state.tasks.length && !state.message) return null;

  return (
    <div className="space-y-4">
      {state.tasks.map((task) => (
        <div key={task.id} className={`rounded border p-4 space-y-3 ${cardBg}`}>
          <div className="flex items-center justify-between gap-3">
            <input
              value={task.name}
              onChange={(e) => onTaskChange?.(task.id, { name: e.target.value })}
              placeholder="Task name"
              className={`w-full rounded border px-3 py-2 text-sm font-semibold ${inputBg}`}
            />
            <button
              onClick={() => onTaskRemove?.(task.id)}
              className={`text-xs px-2 py-1 rounded border ${isLight ? 'border-zinc-300 text-zinc-600 hover:bg-zinc-200' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-800'}`}
            >
              Remove
            </button>
          </div>
          <textarea
            value={task.description}
            onChange={(e) => onTaskChange?.(task.id, { description: e.target.value })}
            placeholder="Task description"
            className={`w-full rounded border px-3 py-2 text-sm min-h-[88px] ${inputBg}`}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Project</label>
              <input
                value={task.projectName || ''}
                onChange={(e) => onTaskChange?.(task.id, { projectName: e.target.value })}
                className={`w-full rounded border px-3 py-2 text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Tasklist</label>
              <input
                value={task.tasklistName || ''}
                onChange={(e) => onTaskChange?.(task.id, { tasklistName: e.target.value })}
                className={`w-full rounded border px-3 py-2 text-sm ${inputBg}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Project ID</label>
              <input
                type="number"
                value={task.projectId ?? ''}
                onChange={(e) => onTaskChange?.(task.id, {
                  projectId: e.target.value ? parseInt(e.target.value, 10) : undefined
                })}
                className={`w-full rounded border px-3 py-2 text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Tasklist ID</label>
              <input
                type="number"
                value={task.tasklistId ?? ''}
                onChange={(e) => onTaskChange?.(task.id, {
                  tasklistId: e.target.value ? parseInt(e.target.value, 10) : undefined
                })}
                className={`w-full rounded border px-3 py-2 text-sm ${inputBg}`}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Priority</label>
              <select
                value={task.priority || 'none'}
                onChange={(e) => onTaskChange?.(task.id, { priority: e.target.value as GeneralTaskItem['priority'] })}
                className={`w-full rounded border px-2 py-2 text-sm ${inputBg}`}
              >
                <option value="none">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Start Date</label>
              <input
                type="date"
                value={task.startDate || ''}
                onChange={(e) => onTaskChange?.(task.id, { startDate: e.target.value || undefined })}
                className={`w-full rounded border px-2 py-2 text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Due Date</label>
              <input
                type="date"
                value={task.dueDate || ''}
                onChange={(e) => onTaskChange?.(task.id, { dueDate: e.target.value || undefined })}
                className={`w-full rounded border px-2 py-2 text-sm ${inputBg}`}
              />
            </div>
            <div>
              <label className={`block text-xs mb-1 ${textSecondary}`}>Est. Minutes</label>
              <input
                type="number"
                min={0}
                value={task.estimatedMinutes ?? ''}
                onChange={(e) => onTaskChange?.(task.id, {
                  estimatedMinutes: e.target.value ? parseInt(e.target.value, 10) : undefined
                })}
                className={`w-full rounded border px-2 py-2 text-sm ${inputBg}`}
              />
            </div>
          </div>
        </div>
      ))}
      {state.message && <p className={`text-xs ${textSecondary}`}>{state.message}</p>}
    </div>
  );
};
