import React, { useState, useEffect, useRef } from 'react';
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  ListTodo,
  CheckSquare,
  Calendar,
  Clock,
  Tag,
  Edit3,
  Trash2,
  Plus,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { 
  ProjectDraftData, 
  TasklistDraft, 
  TaskDraft, 
  SubtaskDraft,
  ProjectDraftTag 
} from '../types/conversation';

interface ProjectDraftCardProps {
  data: ProjectDraftData;
  theme?: 'light' | 'dark';
  hourlyRate?: number;
  onUpdateProject?: (updates: Partial<ProjectDraftData['project']>) => void;
  onUpdateTasklist?: (tasklistId: string, updates: Partial<TasklistDraft>) => void;
  onUpdateTask?: (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => void;
  onRemoveTasklist?: (tasklistId: string) => void;
  onRemoveTask?: (tasklistId: string, taskId: string) => void;
}

const priorityColors = {
  none: 'bg-zinc-500',
  low: 'bg-blue-500',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
};

const TagBadge: React.FC<{ tag: ProjectDraftTag; isLight: boolean }> = ({ tag, isLight }) => (
  <span
    className={`
      inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium
      ${tag.isNew 
        ? 'border border-dashed border-cyan-500 text-cyan-500' 
        : isLight 
          ? 'bg-zinc-200 text-zinc-600' 
          : 'bg-zinc-700 text-zinc-300'
      }
    `}
    style={tag.color && !tag.isNew ? { backgroundColor: `#${tag.color}20`, color: `#${tag.color}` } : undefined}
  >
    <Tag size={8} />
    {tag.name}
    {tag.isNew && <span className="text-[8px]">(new)</span>}
  </span>
);

const SubtaskItem: React.FC<{
  subtask: SubtaskDraft;
  isLight: boolean;
  textSecondary: string;
  onUpdate?: (updates: Partial<SubtaskDraft>) => void;
  isEditable?: boolean;
}> = ({ subtask, isLight, textSecondary, onUpdate, isEditable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(subtask.name);
  
  const handleSave = () => {
    if (onUpdate && editName.trim() !== subtask.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(subtask.name);
      setIsEditing(false);
    }
  };
  
  return (
    <div className={`
      flex items-center gap-2 py-1 pl-8 text-xs group
      ${isLight ? 'text-zinc-600' : 'text-zinc-400'}
    `}>
      <CheckSquare size={12} className="opacity-50" />
      {isEditing ? (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          autoFocus
          className={`
            flex-1 text-xs px-1 py-0.5 rounded border outline-none
            ${isLight 
              ? 'bg-white border-cyan-400 text-zinc-800' 
              : 'bg-zinc-800 border-cyan-500 text-zinc-100'
            }
          `}
        />
      ) : (
        <>
          <span className="flex-1">{subtask.name}</span>
          {isEditable && onUpdate && (
            <Edit3 
              size={10} 
              className={`opacity-0 group-hover:opacity-50 hover:!opacity-100 ${textSecondary} cursor-pointer`}
              onClick={() => setIsEditing(true)}
            />
          )}
        </>
      )}
      {subtask.estimatedMinutes && !isEditing && (
        <span className={`flex items-center gap-0.5 text-cyan-500 text-[10px]`}>
          <Clock size={10} />
          {subtask.estimatedMinutes >= 60
            ? `${Math.round(subtask.estimatedMinutes / 60)}h`
            : `${subtask.estimatedMinutes}m`
          }
        </span>
      )}
      {subtask.dueDate && !isEditing && (
        <span className={`flex items-center gap-0.5 ${textSecondary} text-[10px]`}>
          <Calendar size={10} />
          {subtask.dueDate}
        </span>
      )}
    </div>
  );
};

const TaskItem: React.FC<{
  task: TaskDraft;
  isLight: boolean;
  textPrimary: string;
  textSecondary: string;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdate?: (updates: Partial<TaskDraft>) => void;
  isEditable?: boolean;
}> = ({ task, isLight, textPrimary, textSecondary, isExpanded, onToggle, onUpdate, isEditable }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(task.name);
  
  const handleSave = () => {
    if (onUpdate && editName.trim() !== task.name) {
      onUpdate({ name: editName.trim() });
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(task.name);
      setIsEditing(false);
    }
  };
  
  return (
    <div className="mb-1">
      <div 
        className={`
          flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer group
          ${isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800'}
        `}
        onClick={() => !isEditing && onToggle()}
      >
        {task.subtasks.length > 0 ? (
          isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
        ) : (
          <div className="w-3.5" />
        )}
        <div className={`w-2 h-2 rounded-full ${priorityColors[task.priority || 'none']}`} />
        
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className={`
              flex-1 text-sm px-1 py-0.5 rounded border outline-none
              ${isLight 
                ? 'bg-white border-cyan-400 text-zinc-800' 
                : 'bg-zinc-800 border-cyan-500 text-zinc-100'
              }
            `}
          />
        ) : (
          <>
            <span className={`flex-1 text-sm ${textPrimary}`}>{task.name}</span>
            {isEditable && onUpdate && (
              <Edit3 
                size={12} 
                className={`opacity-0 group-hover:opacity-50 hover:!opacity-100 ${textSecondary} cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              />
            )}
          </>
        )}
        
        {task.dueDate && !isEditing && (
          <span className={`flex items-center gap-0.5 ${textSecondary} text-[10px]`}>
            <Calendar size={10} />
            {task.dueDate}
          </span>
        )}
        
        {task.estimatedMinutes && !isEditing && (
          <span className={`flex items-center gap-0.5 ${textSecondary} text-[10px]`}>
            <Clock size={10} />
            {Math.round(task.estimatedMinutes / 60)}h
          </span>
        )}
        
        {task.subtasks.length > 0 && !isEditing && (
          <span className={`text-[10px] ${textSecondary}`}>
            {task.subtasks.length} subtask{task.subtasks.length > 1 ? 's' : ''}
          </span>
        )}
      </div>
      
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-8 py-1">
          {task.tags.map((tag, idx) => (
            <TagBadge key={idx} tag={tag} isLight={isLight} />
          ))}
        </div>
      )}
      
      {isExpanded && task.subtasks.map((subtask, idx) => (
        <SubtaskItem
          key={subtask.id}
          subtask={subtask}
          isLight={isLight}
          textSecondary={textSecondary}
          isEditable={isEditable}
          onUpdate={onUpdate ? (updates) => {
            const newSubtasks = [...task.subtasks];
            newSubtasks[idx] = { ...newSubtasks[idx], ...updates };
            onUpdate({ subtasks: newSubtasks });
          } : undefined}
        />
      ))}
    </div>
  );
};

const TasklistSection: React.FC<{
  tasklist: TasklistDraft;
  isLight: boolean;
  textPrimary: string;
  textSecondary: string;
  cardBg: string;
  cardBorder: string;
  isExpanded: boolean;
  onToggle: () => void;
  expandedTasks: Set<string>;
  onToggleTask: (taskId: string) => void;
  onUpdateTasklist?: (updates: Partial<TasklistDraft>) => void;
  onUpdateTask?: (taskId: string, updates: Partial<TaskDraft>) => void;
  isEditable?: boolean;
}> = ({ 
  tasklist, 
  isLight, 
  textPrimary, 
  textSecondary, 
  cardBg, 
  cardBorder,
  isExpanded,
  onToggle,
  expandedTasks,
  onToggleTask,
  onUpdateTasklist,
  onUpdateTask,
  isEditable,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(tasklist.name);
  
  const handleSave = () => {
    if (onUpdateTasklist && editName.trim() !== tasklist.name) {
      onUpdateTasklist({ name: editName.trim() });
    }
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') {
      setEditName(tasklist.name);
      setIsEditing(false);
    }
  };
  
  return (
    <div className={`${cardBg} ${cardBorder} border rounded-lg overflow-hidden mb-3`}>
      <div
        className={`
          flex items-center gap-2 p-3 cursor-pointer group
          ${isLight ? 'bg-zinc-50 hover:bg-zinc-100' : 'bg-zinc-800/50 hover:bg-zinc-800'}
        `}
        onClick={() => !isEditing && onToggle()}
      >
        {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <ListTodo size={16} className="text-cyan-500" />
        
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className={`
              flex-1 font-medium text-sm px-1 py-0.5 rounded border outline-none
              ${isLight 
                ? 'bg-white border-cyan-400 text-zinc-800' 
                : 'bg-zinc-800 border-cyan-500 text-zinc-100'
              }
            `}
          />
        ) : (
          <>
            <span className={`flex-1 font-medium text-sm ${textPrimary}`}>{tasklist.name}</span>
            {isEditable && onUpdateTasklist && (
              <Edit3 
                size={12} 
                className={`opacity-0 group-hover:opacity-50 hover:!opacity-100 ${textSecondary} cursor-pointer`}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
              />
            )}
          </>
        )}
        
        <span className={`text-xs ${textSecondary}`}>
          {tasklist.tasks.length} task{tasklist.tasks.length !== 1 ? 's' : ''}
        </span>
      </div>
      
      {isExpanded && (
        <div className="p-2 pt-0">
          {tasklist.tasks.length === 0 ? (
            <div className={`text-xs ${textSecondary} text-center py-3 italic`}>
              No tasks in this list
            </div>
          ) : (
            tasklist.tasks.map(task => (
              <TaskItem
                key={task.id}
                task={task}
                isLight={isLight}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                isExpanded={expandedTasks.has(task.id)}
                onToggle={() => onToggleTask(task.id)}
                onUpdate={onUpdateTask ? (updates) => onUpdateTask(task.id, updates) : undefined}
                isEditable={isEditable}
              />
            ))
          )}
      </div>
    )}
  </div>
  );
};

export const ProjectDraftCard: React.FC<ProjectDraftCardProps> = ({
  data,
  theme = 'dark',
  hourlyRate = 1200,
  onUpdateProject,
  onUpdateTasklist,
  onUpdateTask,
  onRemoveTasklist,
  onRemoveTask,
}) => {
  const isLight = theme === 'light';
  const isEditable = !data.isCreated; // Disable editing after project is created
  const isBuilding = (data as any).isBuilding === true;

  const cardBg = isLight ? 'bg-white' : 'bg-zinc-900';
  const cardBorder = isLight ? 'border-zinc-200' : 'border-zinc-800';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const headerBg = isLight ? 'bg-zinc-50' : 'bg-zinc-800/50';

  const [expandedTasklists, setExpandedTasklists] = useState<Set<string>>(
    new Set(data.tasklists.map(tl => tl.id))
  );
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  // Track seen tasklist IDs to animate new ones
  const seenTasklistIds = useRef<Set<string>>(new Set());
  const [newTasklistIds, setNewTasklistIds] = useState<Set<string>>(new Set());

  // Auto-expand new tasklists as they appear
  useEffect(() => {
    const currentIds = new Set(data.tasklists.map(tl => tl.id));
    const newIds = new Set<string>();

    currentIds.forEach(id => {
      if (!seenTasklistIds.current.has(id)) {
        newIds.add(id);
        seenTasklistIds.current.add(id);
      }
    });

    if (newIds.size > 0) {
      // Mark new items for animation
      setNewTasklistIds(prev => new Set([...prev, ...newIds]));
      // Auto-expand new tasklists
      setExpandedTasklists(prev => new Set([...prev, ...newIds]));

      // Clear animation class after animation completes
      setTimeout(() => {
        setNewTasklistIds(prev => {
          const next = new Set(prev);
          newIds.forEach(id => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [data.tasklists]);

  // Ensure all tasklists stay expanded when building completes
  useEffect(() => {
    if (!isBuilding) {
      const allIds = new Set(data.tasklists.map(tl => tl.id));
      setExpandedTasklists(allIds);
    }
  }, [isBuilding, data.tasklists]);
  
  const toggleTasklist = (id: string) => {
    setExpandedTasklists(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  
  const toggleTask = (id: string) => {
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      {/* Project Header */}
      <div className={`${cardBg} ${cardBorder} border rounded-lg overflow-hidden`}>
        <div className={`${headerBg} px-4 py-3 border-b ${cardBorder}`}>
          <div className="flex items-center gap-2">
            <FolderOpen size={18} className="text-purple-500" />
            <h3 className={`font-semibold ${textPrimary}`}>{data.project.name}</h3>
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          {data.project.description && (
            <p className={`text-sm ${textSecondary}`}>{data.project.description}</p>
          )}
          
          <div className="flex flex-wrap gap-4">
            {data.project.startDate && (
              <div className={`flex items-center gap-1.5 text-xs ${textSecondary}`}>
                <Calendar size={12} />
                <span>Start: {data.project.startDate}</span>
              </div>
            )}
            {data.project.endDate && (
              <div className={`flex items-center gap-1.5 text-xs ${textSecondary}`}>
                <Calendar size={12} />
                <span>End: {data.project.endDate}</span>
              </div>
            )}
          </div>
          
          {data.project.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {data.project.tags.map((tag, idx) => (
                <TagBadge key={idx} tag={tag} isLight={isLight} />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className={`${cardBg} ${cardBorder} border rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{data.summary.totalTasklists}</div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Lists</div>
        </div>
        <div className={`${cardBg} ${cardBorder} border rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{data.summary.totalTasks}</div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Tasks</div>
        </div>
        <div className={`${cardBg} ${cardBorder} border rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{data.summary.totalSubtasks}</div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Subtasks</div>
        </div>
        <div className={`${cardBg} ${cardBorder} border rounded-lg p-3 text-center`}>
          <div className={`text-2xl font-bold text-cyan-500`}>
            {data.summary.totalMinutes ? Math.round(data.summary.totalMinutes / 60) : 0}h
          </div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Est. Hours</div>
        </div>
      </div>

      {/* Budget & Cost Estimate */}
      {(data.budget || data.summary.totalMinutes) && (
        <div className={`${cardBg} ${cardBorder} border rounded-lg p-3 space-y-2`}>
          {data.budget && (
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${textSecondary} text-sm`}>
                <AlertCircle size={14} className="text-amber-500" />
                <span>Budget:</span>
              </div>
              <div className={`font-mono font-medium ${textPrimary}`}>
                {data.budget.type === 'time'
                  ? `${data.budget.capacity}h`
                  : `${data.budget.capacity.toLocaleString()} DKK`
                }
              </div>
            </div>
          )}
          {data.summary.totalMinutes && data.summary.totalMinutes > 0 && (
            <div className="flex items-center justify-between">
              <div className={`flex items-center gap-2 ${textSecondary} text-sm`}>
                <span>Est. Cost ({hourlyRate.toLocaleString('da-DK')} DKK/h):</span>
              </div>
              <div className={`font-mono font-medium text-cyan-500`}>
                {Math.round((data.summary.totalMinutes / 60) * hourlyRate).toLocaleString('da-DK')} DKK
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Tasklists */}
      <div>
        <div className={`flex items-center gap-2 mb-2 ${textSecondary} text-xs uppercase tracking-wider`}>
          <ListTodo size={12} />
          <span>Task Lists</span>
        </div>
        
        {data.tasklists.length === 0 ? (
          <div className={`${cardBg} ${cardBorder} border rounded-lg p-4 text-center ${textSecondary} text-sm italic`}>
            {isBuilding ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin text-cyan-500" />
                <span>Building task structure...</span>
              </div>
            ) : (
              'No task lists defined yet'
            )}
          </div>
        ) : (
          data.tasklists.map(tasklist => (
            <div
              key={tasklist.id}
              className={`transition-all duration-300 ease-out ${
                newTasklistIds.has(tasklist.id)
                  ? 'animate-pulse bg-cyan-500/5 ring-1 ring-cyan-500/30 rounded-lg'
                  : ''
              }`}
            >
              <TasklistSection
                tasklist={tasklist}
                isLight={isLight}
                textPrimary={textPrimary}
                textSecondary={textSecondary}
                cardBg={cardBg}
                cardBorder={cardBorder}
                isExpanded={isBuilding || expandedTasklists.has(tasklist.id)}
                onToggle={() => toggleTasklist(tasklist.id)}
                expandedTasks={expandedTasks}
                onToggleTask={toggleTask}
                onUpdateTasklist={onUpdateTasklist ? (updates) => onUpdateTasklist(tasklist.id, updates) : undefined}
                onUpdateTask={onUpdateTask ? (taskId, updates) => onUpdateTask(tasklist.id, taskId, updates) : undefined}
                isEditable={isEditable}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
};
