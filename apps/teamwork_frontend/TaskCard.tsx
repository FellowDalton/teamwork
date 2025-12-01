import React from 'react';
import { Task } from '../types';
import { MoreHorizontal, MessageSquare, Clock } from 'lucide-react';

interface TaskCardProps {
  task: Task;
  stageId: string;
  onDragStart: (e: React.DragEvent, taskId: string, stageId: string) => void;
  theme?: 'light' | 'dark';
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, stageId, onDragStart, theme = 'dark' }) => {
  const totalHours = task.timeLogs?.reduce((acc, log) => acc + log.hours, 0) || 0;
  const commentCount = task.comments?.length || 0;
  const isLight = theme === 'light';

  // --- Theme Styles ---
  
  // Physical Body Style (3D Key Look)
  const keyBody = isLight 
    ? "bg-white border-zinc-300 text-zinc-800 shadow-[0_3px_0_#cbd5e1]"
    : "bg-[#27272a] border-[#3f3f46] text-zinc-200 shadow-[0_3px_0_#000000]";
    
  const hoverStyle = isLight
    ? "hover:border-zinc-400"
    : "hover:border-zinc-500 hover:text-white";

  const metaColor = isLight ? "text-zinc-400" : "text-zinc-500";
  const tagStyle = isLight 
    ? "text-zinc-500 bg-zinc-100 border-zinc-200" 
    : "text-zinc-400 bg-zinc-900/50 border-zinc-700";

  // LED Status Light
  const getPriorityLed = (p: string) => {
    switch (p) {
      case 'high': return 'bg-rose-500 shadow-[0_0_6px_rgba(244,63,94,0.8)]';
      case 'medium': return 'bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.8)]';
      case 'low': return 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.8)]';
      default: return 'bg-zinc-500';
    }
  };

  // Use the finer texture for cards
  const textureClass = isLight ? 'bg-texture-card-light' : 'bg-texture-card-dark';

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id, stageId)}
      className={`
        relative group w-full mb-1
        rounded-lg border-[1px]
        p-3 overflow-hidden
        cursor-grab active:cursor-grabbing
        transition-all duration-75 ease-out
        active:translate-y-[3px] active:shadow-none active:border-b-transparent
        select-none
        ${keyBody} ${hoverStyle}
      `}
    >
      {/* Texture Overlay */}
      <div className={`absolute inset-0 ${textureClass} opacity-40 pointer-events-none mix-blend-overlay`} />

      {/* Content wrapper z-index fix */}
      <div className="relative z-10">
          {/* Top Row: LED Indicator & Tech ID */}
          <div className="flex justify-between items-center mb-3">
            <div className={`h-1.5 w-8 rounded-full ${getPriorityLed(task.priority)}`} title={`Priority: ${task.priority}`} />
            
            <div className={`text-[9px] font-mono tracking-widest uppercase opacity-60 ${metaColor}`}>
               {task.id.split('-').pop()?.slice(0,4) || 'TSK'}
            </div>
          </div>
          
          {/* Main Content */}
          <h4 className="text-sm font-bold leading-snug mb-3 tracking-tight">
            {task.title}
          </h4>
          
          {/* Tags (Printed Look) */}
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-3">
              {task.tags.slice(0, 3).map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded-sm border font-mono tracking-tight uppercase ${tagStyle}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Footer Divider (Printed Line) */}
          <div className={`border-t border-dashed my-2 ${isLight ? 'border-zinc-200' : 'border-zinc-700/50'}`} />

          {/* Footer Info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {task.assignedTo && (
                    <div className={`w-5 h-5 rounded-full border flex items-center justify-center overflow-hidden ${isLight ? 'border-zinc-200 bg-zinc-100' : 'border-zinc-700 bg-zinc-800'}`}>
                        <img src={task.assignedTo} alt="Assignee" className="w-full h-full object-cover opacity-80 hover:opacity-100 grayscale hover:grayscale-0 transition-all" />
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
            
            {/* Hover interaction hint */}
            <div className={`opacity-0 group-hover:opacity-100 transition-opacity absolute top-3 right-3 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <MoreHorizontal size={14} />
            </div>
          </div>
      </div>
    </div>
  );
};