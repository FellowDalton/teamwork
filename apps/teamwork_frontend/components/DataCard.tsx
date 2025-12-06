import React from 'react';
import {
  Clock,
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Calendar,
  DollarSign,
  Folder,
  ListTodo
} from 'lucide-react';
import {
  DisplayItem,
  TaskDisplayData,
  TimelogDisplayData,
  MetricDisplayData,
  ProjectSummaryData
} from '../types/conversation';

interface DataCardProps {
  item: DisplayItem;
  theme?: 'light' | 'dark';
  onClick?: () => void;
}

export const DataCard: React.FC<DataCardProps> = ({ item, theme = 'dark', onClick }) => {
  const isLight = theme === 'light';

  // Base card styles (matching TaskCard 3D effect)
  const cardBody = isLight
    ? "bg-white border-zinc-300 text-zinc-800 shadow-[0_3px_0_#cbd5e1]"
    : "bg-[#27272a] border-[#3f3f46] text-zinc-200 shadow-[0_3px_0_#000000]";

  const hoverStyle = isLight
    ? "hover:border-zinc-400"
    : "hover:border-zinc-500 hover:text-white";

  const metaColor = isLight ? "text-zinc-400" : "text-zinc-500";
  const textureClass = isLight ? 'bg-texture-card-light' : 'bg-texture-card-dark';

  // LED colors by type
  const getLedColor = (type: string, color?: string) => {
    if (color) {
      const colors: Record<string, string> = {
        cyan: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]',
        green: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
        orange: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]',
        red: 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]',
        purple: 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]',
        blue: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]',
      };
      return colors[color] || colors.cyan;
    }

    const typeColors: Record<string, string> = {
      task: 'bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.8)]',
      timelog: 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]',
      metric: 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]',
      'project-summary': 'bg-purple-500 shadow-[0_0_6px_rgba(168,85,247,0.8)]',
      comment: 'bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.8)]',
    };
    return typeColors[type] || typeColors.task;
  };

  // Trend icon
  const TrendIcon = ({ trend }: { trend?: 'up' | 'down' | 'stable' }) => {
    if (trend === 'up') return <TrendingUp size={12} className="text-emerald-500" />;
    if (trend === 'down') return <TrendingDown size={12} className="text-rose-500" />;
    return <Minus size={10} className="text-zinc-500" />;
  };

  // Render based on item type
  const renderContent = () => {
    switch (item.type) {
      case 'task': {
        const { task, stageName } = item.data as TaskDisplayData;
        const totalHours = task.timeLogs?.reduce((acc, log) => acc + log.hours, 0) || 0;
        const commentCount = task.comments?.length || 0;

        const getPriorityLed = (p: string) => {
          switch (p) {
            case 'high': return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]';
            case 'medium': return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]';
            case 'low': return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]';
            default: return 'bg-zinc-500';
          }
        };

        const tagStyle = isLight
          ? "text-zinc-500 bg-zinc-100 border-zinc-200"
          : "text-zinc-400 bg-zinc-900/50 border-zinc-700";

        return (
          <>
            <div className="flex justify-between items-center mb-3">
              <div className={`h-1.5 w-8 rounded-full ${getPriorityLed(task.priority)}`} title={`Priority: ${task.priority}`} />
              <div className={`text-[9px] font-mono tracking-widest uppercase opacity-60 ${metaColor}`}>
                {stageName && <span className="mr-2">{stageName}</span>}
                {task.id.split('-').pop()?.slice(0,4) || 'TSK'}
              </div>
            </div>

            <h4 className="text-sm font-bold leading-snug mb-3 tracking-tight">
              {task.title}
            </h4>

            {task.tags && task.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {task.tags.slice(0, 3).map(tag => (
                  <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-sm border font-mono tracking-tight uppercase ${tagStyle}`}>
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className={`border-t my-2 ${isLight ? 'border-zinc-200/70' : 'border-zinc-600/30'}`} />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {task.assignedTo && (
                  <div className={`w-5 h-5 rounded-full border flex items-center justify-center overflow-hidden ${isLight ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-700 bg-zinc-800'}`}>
                    <img src={task.assignedTo} alt="Assignee" className="w-full h-full object-cover opacity-80 grayscale" />
                  </div>
                )}
              </div>

              {(totalHours > 0 || commentCount > 0) && (
                <div className={`flex items-center gap-3 ${metaColor}`}>
                  {totalHours > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                      <Clock size={10} strokeWidth={3} />
                      <span>{totalHours}h</span>
                    </div>
                  )}
                  {commentCount > 0 && (
                    <div className="flex items-center gap-1 text-[10px] font-mono font-bold">
                      <MessageSquare size={10} strokeWidth={3} />
                      <span>{commentCount}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        );
      }

      case 'timelog': {
        const { timelog, taskTitle, projectName } = item.data as TimelogDisplayData;
        const date = new Date(timelog.date);

        return (
          <>
            <div className="flex justify-between items-center mb-2">
              <div className={`h-1.5 w-8 rounded-full ${getLedColor('timelog')}`} />
              <div className={`text-[9px] font-mono tracking-widest uppercase opacity-60 ${metaColor}`}>
                {timelog.isBillable ? 'BILLABLE' : 'NON-BILL'}
              </div>
            </div>

            {/* Project name - prominent at top */}
            <h4 className="text-lg font-bold mb-1 truncate" title={projectName}>
              {projectName || 'No Project'}
            </h4>
            
            {/* Task name */}
            <div className={`flex items-center gap-1.5 text-[11px] ${metaColor} mb-2`}>
              <ListTodo size={10} />
              <span className="truncate">{taskTitle}</span>
            </div>

            {/* Description */}
            <p className="text-xs opacity-80 mb-3 line-clamp-2">{timelog.comment}</p>

            {/* Bottom row: date left, hours right */}
            <div className={`flex items-center justify-between mt-auto pt-2 border-t ${isLight ? 'border-zinc-200/70' : 'border-zinc-600/30'}`}>
              <div className={`text-[10px] font-mono ${metaColor}`}>
                {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <h4 className="text-xl font-bold font-mono">
                {timelog.hours}h
              </h4>
            </div>
          </>
        );
      }

      case 'metric': {
        const { label, value, subValue, trend, color } = item.data as MetricDisplayData;

        return (
          <>
            <div className="flex justify-between items-center mb-3">
              <div className={`h-1.5 w-8 rounded-full ${getLedColor('metric', color)}`} />
              <TrendIcon trend={trend} />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[10px] font-mono uppercase tracking-wider mb-1 ${metaColor}`}>
                  {label}
                </p>
                {subValue && (
                  <span className={`text-xs ${metaColor}`}>{subValue}</span>
                )}
              </div>
              <h4 className="text-2xl font-bold font-mono">
                {value}
              </h4>
            </div>
          </>
        );
      }

      case 'project-summary': {
        const { project, taskCount, completedCount, totalHours } = item.data as ProjectSummaryData;
        const progress = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;

        return (
          <>
            <div className="flex justify-between items-center mb-3">
              <div className={`h-1.5 w-8 rounded-full ${getLedColor('project-summary')}`} />
              <div className={`text-[9px] font-mono tracking-widest uppercase opacity-60 ${metaColor}`}>
                PROJECT
              </div>
            </div>

            <h4 className="text-sm font-bold leading-snug mb-2 tracking-tight">
              {project.name}
            </h4>

            <p className={`text-xs mb-3 line-clamp-2 ${metaColor}`}>
              {project.description}
            </p>

            <div className={`border-t my-2 ${isLight ? 'border-zinc-200/70' : 'border-zinc-600/30'}`} />

            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold font-mono">{taskCount}</div>
                <div className={`text-[9px] font-mono uppercase ${metaColor}`}>Tasks</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{progress}%</div>
                <div className={`text-[9px] font-mono uppercase ${metaColor}`}>Done</div>
              </div>
              <div>
                <div className="text-lg font-bold font-mono">{totalHours}h</div>
                <div className={`text-[9px] font-mono uppercase ${metaColor}`}>Logged</div>
              </div>
            </div>
          </>
        );
      }

      default:
        return <div className={`text-sm ${metaColor}`}>Unknown data type</div>;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`
        relative group w-full
        rounded-lg border-[1px]
        p-3 overflow-hidden
        ${onClick ? 'cursor-pointer' : ''}
        transition-all duration-75 ease-out
        ${onClick ? 'active:translate-y-[3px] active:shadow-none active:border-b-transparent' : ''}
        select-none
        ${cardBody} ${hoverStyle}
      `}
    >
      {/* Texture Overlay */}
      <div className={`absolute inset-0 ${textureClass} opacity-40 pointer-events-none mix-blend-overlay`} />

      {/* Content wrapper */}
      <div className="relative z-10">
        {renderContent()}
      </div>
    </div>
  );
};
