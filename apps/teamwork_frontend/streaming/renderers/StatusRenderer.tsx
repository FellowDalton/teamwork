/**
 * StatusRenderer - Renders StatusDraftState with section-based layout
 *
 * Displays metrics in a 2-column grid, tasks as compact rows,
 * and charts using the existing ChartCard component.
 */

import React from 'react';
import type { StreamRendererProps } from '../core/types';
import type { StatusDraftState, StatusSection, StatusMetric, StatusTask, StatusChart } from '../accumulators/StatusAccumulator';
import { ChartCard } from '../../components/ChartCard';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  ListTodo,
  Clock,
  LayoutDashboard,
} from 'lucide-react';

type Props = StreamRendererProps<StatusDraftState>;

// LED color map for metric cards
const LED_COLORS: Record<string, string> = {
  cyan: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]',
  green: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
  orange: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]',
  red: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]',
  purple: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]',
  blue: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]',
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  metrics: <BarChart3 size={12} />,
  tasks: <ListTodo size={12} />,
  time: <Clock size={12} />,
  dashboard: <LayoutDashboard size={12} />,
};

const PRIORITY_COLORS: Record<string, string> = {
  high: 'bg-rose-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
};

/** Single metric card */
const MetricCard: React.FC<{ metric: StatusMetric; isLight: boolean }> = ({ metric, isLight }) => {
  const ledColor = LED_COLORS[metric.color || 'cyan'] || LED_COLORS.cyan;
  const cardBg = isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';

  const TrendIcon = metric.trend === 'up' ? TrendingUp : metric.trend === 'down' ? TrendingDown : Minus;
  const trendColor = metric.trend === 'up' ? 'text-emerald-500' : metric.trend === 'down' ? 'text-rose-500' : 'text-zinc-500';

  return (
    <div className={`rounded-lg border p-3 ${cardBg} transition-all duration-300`}>
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full ${ledColor}`} />
          <span className={`text-[10px] font-mono uppercase tracking-wider ${textSecondary}`}>
            {metric.label}
          </span>
        </div>
        {metric.trend && <TrendIcon size={12} className={trendColor} />}
      </div>
      <div className={`text-lg font-bold font-mono ${textPrimary}`}>
        {metric.value}
      </div>
      {metric.subValue && (
        <div className={`text-[11px] ${textSecondary} mt-0.5`}>
          {metric.subValue}
        </div>
      )}
    </div>
  );
};

/** Task row */
const TaskRow: React.FC<{ task: StatusTask; isLight: boolean }> = ({ task, isLight }) => {
  const cardBg = isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const priorityLed = PRIORITY_COLORS[task.priority || 'medium'] || PRIORITY_COLORS.medium;

  return (
    <div className={`rounded-lg border p-2.5 ${cardBg} flex items-center gap-3`}>
      {/* Priority LED */}
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${priorityLed}`} />

      {/* Task name & status */}
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${textPrimary} truncate`}>
          {task.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-mono ${textSecondary}`}>
            {task.status}
          </span>
          {task.assignee && (
            <span className={`text-[10px] ${textSecondary}`}>
              {task.assignee}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {task.progress !== undefined && (
        <div className="w-16 flex-shrink-0">
          <div className={`h-1.5 rounded-full ${isLight ? 'bg-zinc-200' : 'bg-zinc-800'}`}>
            <div
              className="h-full rounded-full bg-cyan-500 transition-all duration-500"
              style={{ width: `${Math.min(100, task.progress)}%` }}
            />
          </div>
          <div className={`text-[9px] font-mono text-right mt-0.5 ${textSecondary}`}>
            {task.progress}%
          </div>
        </div>
      )}

      {/* Hours */}
      {(task.loggedHours !== undefined || task.estimatedHours !== undefined) && (
        <div className="flex-shrink-0 text-right">
          {task.loggedHours !== undefined && (
            <div className={`text-xs font-mono font-medium ${textPrimary}`}>
              {task.loggedHours}h
            </div>
          )}
          {task.estimatedHours !== undefined && (
            <div className={`text-[10px] font-mono ${textSecondary}`}>
              / {task.estimatedHours}h
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/** Section renderer */
const SectionBlock: React.FC<{ section: StatusSection; isLight: boolean }> = ({ section, isLight }) => {
  const textPrimary = isLight ? 'text-zinc-700' : 'text-zinc-200';
  const textSecondary = isLight ? 'text-zinc-400' : 'text-zinc-500';
  const borderColor = isLight ? 'border-zinc-200' : 'border-zinc-800';
  const icon = CATEGORY_ICONS[section.category] || CATEGORY_ICONS.dashboard;

  return (
    <div className="mb-4 last:mb-0">
      {/* Section header */}
      <div className={`flex items-center gap-2 mb-2.5 pb-1.5 border-b ${borderColor}`}>
        <span className="text-amber-500">{icon}</span>
        <span className={`text-xs font-medium uppercase tracking-wide ${textPrimary}`}>
          {section.title}
        </span>
        <span className={`text-[10px] font-mono ${textSecondary}`}>
          {section.category}
        </span>
      </div>

      {/* Metrics grid */}
      {section.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {section.metrics.map(metric => (
            <MetricCard key={metric.id} metric={metric} isLight={isLight} />
          ))}
        </div>
      )}

      {/* Tasks list */}
      {section.tasks.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {section.tasks.map(task => (
            <TaskRow key={task.id} task={task} isLight={isLight} />
          ))}
        </div>
      )}

      {/* Charts */}
      {section.charts.length > 0 && (
        <div className="space-y-2 mb-3">
          {section.charts.map(chart => (
            <ChartCard
              key={chart.id}
              data={{
                chartType: chart.chartType,
                title: chart.title,
                data: chart.data,
                summary: chart.summary,
              }}
              theme={isLight ? 'light' : 'dark'}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const StatusRenderer: React.FC<Props> = ({ state, theme }) => {
  if (!state || state.sections.length === 0) return null;

  const isLight = theme === 'light';

  return (
    <div>
      {state.sections.map(section => (
        <SectionBlock key={section.id} section={section} isLight={isLight} />
      ))}
      {state.message && !state.isBuilding && (
        <div className={`text-[11px] font-mono mt-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
          {state.message}
        </div>
      )}
    </div>
  );
};
