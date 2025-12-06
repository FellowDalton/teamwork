import React from 'react';
import { Database, Inbox, BarChart3, Clock, FolderOpen } from 'lucide-react';
import { DisplayData, DisplayType } from '../types/conversation';
import { DataCard } from './DataCard';

interface DataDisplayPanelProps {
  data: DisplayData | null;
  theme?: 'light' | 'dark';
  onItemClick?: (itemId: string, itemType: string) => void;
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
  onItemClick
}) => {
  const isLight = theme === 'light';

  // Get display type icon
  const getTypeIcon = (type?: DisplayType) => {
    const icons: Record<DisplayType, React.ReactNode> = {
      tasks: <Database size={12} />,
      timelogs: <Clock size={12} />,
      status: <BarChart3 size={12} />,
      'project-overview': <FolderOpen size={12} />,
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
          <span className={`font-mono text-[9px] ${textSecondary}`}>
            {data?.items?.length || 0} ITEMS
          </span>
          <Screw isLight={isLight} />
        </div>
      </div>

      {/* Content Area (Recessed) */}
      <div className={`
        flex-1 overflow-y-auto p-4
        ${isLight ? 'custom-scrollbar-light' : 'custom-scrollbar-dark'}
        ${contentBg}
        ${isLight ? 'shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]' : 'shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]'}
      `}>
        {/* Empty State */}
        {(!data || data.type === 'empty' || !data.items || data.items.length === 0) && (
          <div className={`flex flex-col items-center justify-center h-full ${textSecondary}`}>
            <div className={`w-16 h-16 rounded-full border-2 border-dashed flex items-center justify-center mb-4 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
              <Inbox size={24} className="opacity-30" />
            </div>
            <p className="text-xs uppercase tracking-widest font-mono mb-1">Awaiting Data</p>
            <p className="text-[10px] opacity-50 font-mono">AI will display information here</p>
          </div>
        )}

        {/* Data Cards Grid */}
        {data && data.items && data.items.length > 0 && (
          <div className={`
            grid gap-3
            ${data.type === 'status' || data.type === 'timelogs'
              ? 'grid-cols-2'
              : 'grid-cols-1'
            }
          `}>
            {data.items.map(item => (
              <DataCard
                key={item.id}
                item={item}
                theme={theme}
                onClick={onItemClick ? () => onItemClick(item.id, item.type) : undefined}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
