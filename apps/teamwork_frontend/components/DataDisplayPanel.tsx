import React, { useState } from 'react';
import { Database, Inbox, BarChart3, Clock, FolderOpen, Plus, TrendingUp, LayoutGrid, Send, Sparkles, CheckCircle2, Loader2, Rocket } from 'lucide-react';
import { DisplayData, DisplayType, ChartDisplayData, CustomDisplayData, TimelogDraftEntry, TimelogDraftData, ProjectDraftData, TasklistDraft, TaskDraft } from '../types/conversation';
import { DataCard } from './DataCard';
import { ChartCard } from './ChartCard';
import { TimelogDraftCard } from './TimelogDraftCard';
import { ProjectDraftCard } from './ProjectDraftCard';

// Visualization type options
const VIZ_TYPES = [
  { id: 'bar', label: 'Bar', icon: <BarChart3 size={14} /> },
  { id: 'line', label: 'Line', icon: <TrendingUp size={14} /> },
  { id: 'card', label: 'Card', icon: <LayoutGrid size={14} /> },
];

// Data grouping options
const DATA_GROUPINGS = [
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'by-task', label: 'By Task' },
  { id: 'by-project', label: 'By Project' },
];

interface DataDisplayPanelProps {
  data: DisplayData | null;
  theme?: 'light' | 'dark';
  onItemClick?: (itemId: string, itemType: string) => void;
  onRequestChart?: (chartType: string) => void;
  onVisualizationRequest?: (prompt: string) => void;
  isLoading?: boolean;
  // Timelog draft mode props
  draftData?: TimelogDraftData | null;
  onDraftUpdate?: (id: string, updates: Partial<TimelogDraftEntry>) => void;
  onDraftRemove?: (id: string) => void;
  onDraftSubmit?: () => void;
  isSubmitting?: boolean;
  // Project draft mode props
  projectDraftData?: ProjectDraftData | null;
  onProjectDraftSubmit?: () => void;
  isCreatingProject?: boolean;
  onUpdateProjectTasklist?: (tasklistId: string, updates: Partial<TasklistDraft>) => void;
  onUpdateProjectTask?: (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => void;
}

// Screw component for hardware aesthetic
const Screw = ({ isLight }: { isLight: boolean }) => (
  <div className={`w-2 h-2 rounded-full border ${isLight ? 'border-zinc-400 bg-zinc-300' : 'border-zinc-700 bg-zinc-800'} flex items-center justify-center opacity-70`}>
    <div className={`w-1 h-[1px] ${isLight ? 'bg-zinc-500' : 'bg-zinc-600'} transform -rotate-45`}></div>
  </div>
);

export const DataDisplayPanel: React.FC<DataDisplayPanelProps> = ({
  data,
  theme = 'dark',
  onItemClick,
  onRequestChart,
  onVisualizationRequest,
  isLoading = false,
  draftData,
  onDraftUpdate,
  onDraftRemove,
  onDraftSubmit,
  isSubmitting = false,
  projectDraftData,
  onProjectDraftSubmit,
  isCreatingProject = false,
  onUpdateProjectTasklist,
  onUpdateProjectTask,
}) => {
  const isLight = theme === 'light';
  const [selectedVizType, setSelectedVizType] = useState('bar');
  const [selectedGrouping, setSelectedGrouping] = useState('weekly');
  const [vizInput, setVizInput] = useState('');
  
  // Check if we're in draft mode
  const isDraftMode = draftData && draftData.isDraft && draftData.entries.length > 0;
  const isProjectDraftMode = projectDraftData && projectDraftData.isDraft;

  const handleVizInputSubmit = () => {
    if (vizInput.trim() && onVisualizationRequest) {
      onVisualizationRequest(vizInput.trim());
      setVizInput('');
    }
  };

  const handleAddVisualization = () => {
    // Map selections to chart request ID
    let chartId = 'hours-by-week'; // default
    if (selectedGrouping === 'weekly') {
      chartId = 'hours-by-week';
    } else if (selectedGrouping === 'monthly') {
      chartId = 'hours-by-month';
    } else if (selectedGrouping === 'by-task') {
      chartId = 'hours-by-task';
    } else if (selectedGrouping === 'by-project') {
      chartId = 'hours-by-project';
    }
    // Pass viz type info along with grouping
    onRequestChart?.(`${chartId}:${selectedVizType}`);
  };

  // Get display type icon
  const getTypeIcon = (type?: DisplayType) => {
    const icons: Record<DisplayType, React.ReactNode> = {
      tasks: <Database size={12} />,
      timelogs: <Clock size={12} />,
      status: <BarChart3 size={12} />,
      'project-overview': <FolderOpen size={12} />,
      activity: <Clock size={12} />,
      empty: <Inbox size={12} />
    };
    return icons[type || 'empty'] || icons.empty;
  };

  // Get display type LED color
  const getTypeLed = (type?: DisplayType) => {
    const colors: Record<DisplayType, string> = {
      tasks: 'bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]',
      timelogs: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]',
      status: 'bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.6)]',
      'project-overview': 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.6)]',
      activity: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]',
      empty: 'bg-zinc-500'
    };
    return colors[type || 'empty'] || colors.empty;
  };

  // Styles
  const panelBg = isLight ? 'bg-[#e4e4e7]' : 'bg-[#18181b]';
  const panelBorder = isLight ? 'border-[#d4d4d8]' : 'border-[#27272a]';
  const headerBg = isLight ? 'bg-[#d4d4d8]' : 'bg-[#27272a]';
  const headerBorder = isLight ? 'border-[#a1a1aa]' : 'border-black';
  const contentBg = isLight ? 'bg-[#f4f4f5]' : 'bg-[#09090b]';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-500';

  const displayType = data?.type || 'empty';
  const title = data?.title || 'DATA DISPLAY';

  return (
    <div className={`
      flex-1 flex flex-col h-full
      rounded-lg border-[2px] overflow-hidden
      ${panelBg} ${panelBorder}
      ${isLight ? 'shadow-lg' : 'shadow-2xl'}
    `}>
      {/* Panel Header (Module Faceplate style) */}
      <div className={`
        h-11 flex items-center justify-between px-3 border-b
        ${headerBg} ${headerBorder}
      `}>
        <div className="flex items-center gap-2.5">
          <Screw isLight={isLight} />
          <div className={`flex items-center gap-2 ${isLight ? 'bg-zinc-200 shadow-sm' : 'bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]'} rounded px-2 py-1`}>
            <div className={`w-1.5 h-1.5 rounded-full ${getTypeLed(displayType)}`}></div>
            <h3 className={`font-mono text-[10px] font-bold uppercase tracking-widest leading-none ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
              {title}
            </h3>
          </div>
          {data?.subtitle && (
            <span className={`text-[10px] font-mono ${textSecondary} truncate max-w-40`}>
              • {data.subtitle}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Screw isLight={isLight} />
        </div>
      </div>

      {/* Content Area (Recessed) */}
      <div className={`
        flex-1 overflow-y-auto p-4 flex flex-col
        ${isLight ? 'custom-scrollbar-light' : 'custom-scrollbar-dark'}
        ${contentBg}
        ${isLight ? 'shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]' : 'shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]'}
      `}>
        {/* Draft Mode - Editable Timelog Entries */}
        {isDraftMode && (
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
                  ({draftData!.entries.length} entries)
                </span>
              </div>
              <div className={`text-sm font-mono font-bold ${isLight ? 'text-emerald-600' : 'text-emerald-400'}`}>
                {draftData!.summary.totalHours.toFixed(1)}h total
              </div>
            </div>
            
            {/* Draft Cards Grid */}
            <div className="grid gap-3 grid-cols-1">
              {draftData!.entries.map(entry => (
                <TimelogDraftCard
                  key={entry.id}
                  entry={entry}
                  theme={theme}
                  onUpdate={onDraftUpdate || (() => {})}
                  onRemove={onDraftRemove || (() => {})}
                />
              ))}
            </div>
            
            {/* Submit Button */}
            <div className="mt-4 flex justify-end">
              <button
                onClick={onDraftSubmit}
                disabled={isSubmitting || draftData!.entries.length === 0}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-200
                  ${isSubmitting || draftData!.entries.length === 0
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
                    <span>Submit {draftData!.summary.totalHours.toFixed(1)}h</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Project Draft Mode - Create Project Preview */}
        {isProjectDraftMode && (
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
              <div className={`text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                Review before creating
              </div>
            </div>
            
            {/* Project Draft Card */}
            <ProjectDraftCard
              data={projectDraftData!}
              theme={theme}
              onUpdateTasklist={onUpdateProjectTasklist}
              onUpdateTask={onUpdateProjectTask}
            />
            
            {/* Create Project Button */}
            <div className="mt-4 flex justify-end gap-3">
              {projectDraftData!.isCreated && projectDraftData!.createdProjectUrl && (
                <a
                  href={projectDraftData!.createdProjectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                    transition-all duration-200
                    bg-cyan-600 text-white hover:bg-cyan-500 cursor-pointer shadow-lg hover:shadow-cyan-500/25
                  `}
                >
                  <FolderOpen size={16} />
                  <span>Open in Teamwork</span>
                </a>
              )}
              <button
                onClick={onProjectDraftSubmit}
                disabled={isCreatingProject || projectDraftData!.isCreated}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm
                  transition-all duration-200
                  ${isCreatingProject || projectDraftData!.isCreated
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
                ) : projectDraftData!.isCreated ? (
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
          </div>
        )}
        
        {/* Data Cards Grid - show when NOT in draft mode */}
        {!isDraftMode && !isProjectDraftMode && data && data.items && data.items.length > 0 && (
          <div className={`
            grid gap-3 mb-4
            ${data.type === 'status' || data.type === 'timelogs'
              ? 'grid-cols-2'
              : 'grid-cols-1'
            }
          `}>
            {data.items.map(item => (
              item.type === 'chart' ? (
                <ChartCard
                  key={item.id}
                  data={item.data as ChartDisplayData}
                  theme={theme}
                />
              ) : item.type === 'custom' ? (
                <div 
                  key={item.id}
                  className={`
                    rounded-lg border p-4 col-span-2
                    ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}
                  `}
                >
                  {(item.data as CustomDisplayData).title && (
                    <div className={`text-xs font-medium mb-3 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
                      {(item.data as CustomDisplayData).title}
                    </div>
                  )}
                  <div 
                    className="w-full flex justify-center [&>svg]:max-w-full [&>svg]:h-auto"
                    dangerouslySetInnerHTML={{ __html: (item.data as CustomDisplayData).svg || '' }}
                  />
                  {(item.data as CustomDisplayData).description && (
                    <div className={`text-[10px] mt-2 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                      {(item.data as CustomDisplayData).description}
                    </div>
                  )}
                </div>
              ) : (
                <DataCard
                  key={item.id}
                  item={item}
                  theme={theme}
                  onClick={onItemClick ? () => onItemClick(item.id, item.type) : undefined}
                />
              )
            ))}
          </div>
        )}

        {/* Add Visualization Card - only show when there's data and NOT in draft mode */}
        {!isDraftMode && !isProjectDraftMode && data?.items && data.items.length > 0 && (
        <div className={`
          rounded-lg border-2 border-dashed p-4
          ${isLight ? 'border-zinc-300 bg-zinc-100/50' : 'border-zinc-700 bg-zinc-900/50'}
        `}>
          <div className="flex items-end justify-between gap-4">
            {/* Type Selection */}
            <div>
              <label className={`block text-[9px] font-mono uppercase tracking-wider mb-2 ${textSecondary}`}>
                Type
              </label>
              <div className="flex gap-1">
                {VIZ_TYPES.map(type => (
                  <button
                    key={type.id}
                    onClick={() => setSelectedVizType(type.id)}
                    className={`
                      flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium
                      transition-all duration-150
                      ${selectedVizType === type.id
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : isLight
                          ? 'bg-zinc-200 text-zinc-600 border border-zinc-300 hover:bg-zinc-300'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                      }
                    `}
                  >
                    {type.icon}
                    <span>{type.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Grouping Selection */}
            <div>
              <label className={`block text-[9px] font-mono uppercase tracking-wider mb-2 ${textSecondary}`}>
                Group By
              </label>
              <div className="flex gap-1 flex-wrap">
                {DATA_GROUPINGS.map(group => (
                  <button
                    key={group.id}
                    onClick={() => setSelectedGrouping(group.id)}
                    className={`
                      px-2.5 py-1.5 rounded text-xs font-medium
                      transition-all duration-150
                      ${selectedGrouping === group.id
                        ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50'
                        : isLight
                          ? 'bg-zinc-200 text-zinc-600 border border-zinc-300 hover:bg-zinc-300'
                          : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-700'
                      }
                    `}
                  >
                    {group.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Button */}
            <button
              onClick={handleAddVisualization}
              disabled={isLoading}
              className={`
                flex items-center gap-2 px-3 py-1.5 rounded
                text-xs font-medium transition-all duration-150
                ${isLoading
                  ? 'opacity-50 cursor-not-allowed bg-zinc-700 text-zinc-500 border border-zinc-600'
                  : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 hover:bg-cyan-500/30 cursor-pointer'
                }
              `}
            >
              <Plus size={14} />
              <span>Add</span>
            </button>
          </div>

          {/* AI Visualization Input - separate from chart options */}
          <div className={`
            mt-3 pt-3 border-t
            ${isLight ? 'border-zinc-300' : 'border-zinc-700'}
          `}>
            <div className={`
              flex items-center gap-2 px-3 py-2 rounded-lg
              ${isLight ? 'bg-zinc-200' : 'bg-zinc-800/50'}
            `}>
              <Sparkles size={14} className="text-cyan-500 flex-shrink-0" />
              <input
                type="text"
                value={vizInput}
                onChange={(e) => setVizInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleVizInputSubmit()}
                placeholder="Create custom visualization with AI..."
                disabled={isLoading}
                className={`
                  flex-1 bg-transparent text-xs font-mono outline-none
                  placeholder:opacity-50
                  ${isLight ? 'text-zinc-700 placeholder:text-zinc-500' : 'text-zinc-300 placeholder:text-zinc-600'}
                  ${isLoading ? 'opacity-50' : ''}
                `}
              />
              <button
                onClick={handleVizInputSubmit}
                disabled={!vizInput.trim() || isLoading}
                className={`
                  p-1 rounded transition-all duration-150
                  ${!vizInput.trim() || isLoading
                    ? 'opacity-30 cursor-not-allowed'
                    : 'text-cyan-500 hover:bg-cyan-500/20 cursor-pointer'
                  }
                `}
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Empty State - show when no data and NOT in draft mode */}
        {!isDraftMode && !isProjectDraftMode && (!data || data.type === 'empty' || !data.items || data.items.length === 0) && (
          <div className={`flex flex-col items-center justify-center flex-1 ${textSecondary}`}>
            <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center mb-4 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
              <Inbox size={24} className="opacity-30" />
            </div>
            <p className="text-xs uppercase tracking-widest font-mono mb-1">Awaiting Data</p>
            <p className="text-[10px] opacity-50 font-mono">AI will display information here</p>
          </div>
        )}
      </div>
    </div>
  );
};
