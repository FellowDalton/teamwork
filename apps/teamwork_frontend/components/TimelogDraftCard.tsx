import React from 'react';
import { Clock, Calendar, Briefcase, X, CheckCircle } from 'lucide-react';
import { TimelogDraftEntry } from '../types/conversation';

interface TimelogDraftCardProps {
  entry: TimelogDraftEntry;
  theme?: 'light' | 'dark';
  onUpdate: (id: string, updates: Partial<TimelogDraftEntry>) => void;
  onRemove: (id: string) => void;
}

export const TimelogDraftCard: React.FC<TimelogDraftCardProps> = ({
  entry,
  theme = 'dark',
  onUpdate,
  onRemove,
}) => {
  const isLight = theme === 'light';
  
  const cardBg = isLight ? 'bg-white' : 'bg-zinc-900';
  const cardBorder = isLight ? 'border-zinc-300' : 'border-zinc-700';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const inputBg = isLight ? 'bg-zinc-100' : 'bg-zinc-800';
  const inputBorder = isLight ? 'border-zinc-300' : 'border-zinc-600';
  
  // Confidence indicator color
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'bg-emerald-500';
    if (confidence >= 0.7) return 'bg-cyan-500';
    if (confidence >= 0.5) return 'bg-amber-500';
    return 'bg-red-500';
  };

  return (
    <div className={`
      ${cardBg} ${cardBorder} border rounded-lg p-3 relative
      transition-all duration-200 hover:shadow-lg
    `}>
      {/* Remove button */}
      <button
        onClick={() => onRemove(entry.id)}
        className={`
          absolute top-2 right-2 p-1 rounded-full
          ${isLight ? 'hover:bg-zinc-200' : 'hover:bg-zinc-700'}
          ${textSecondary} hover:text-red-500 transition-colors
        `}
      >
        <X size={14} />
      </button>
      
      {/* Confidence indicator */}
      <div className="absolute top-3 right-8 flex items-center gap-1">
        <div className={`w-2 h-2 rounded-full ${getConfidenceColor(entry.confidence)}`} />
        <span className={`text-[10px] font-mono ${textSecondary}`}>
          {Math.round(entry.confidence * 100)}%
        </span>
      </div>
      
      {/* Task name */}
      <div className={`font-medium text-sm ${textPrimary} pr-16 mb-2`}>
        {entry.taskName}
      </div>
      
      {/* Project & Date row */}
      <div className="flex items-center gap-3 mb-3">
        <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
          <Briefcase size={12} />
          <span>{entry.projectName}</span>
        </div>
        <div className={`flex items-center gap-1 text-xs ${textSecondary}`}>
          <Calendar size={12} />
          <span>{entry.date}</span>
        </div>
      </div>
      
      {/* Hours input */}
      <div className="flex items-center gap-2 mb-3">
        <Clock size={14} className="text-emerald-500" />
        <input
          type="number"
          step="0.5"
          min="0.5"
          max="24"
          value={entry.hours}
          onChange={(e) => onUpdate(entry.id, { hours: parseFloat(e.target.value) || 0 })}
          className={`
            w-16 px-2 py-1 text-sm font-mono rounded border
            ${inputBg} ${inputBorder} ${textPrimary}
            focus:outline-none focus:ring-1 focus:ring-cyan-500
          `}
        />
        <span className={`text-xs ${textSecondary}`}>hours</span>
        
        {/* Billable indicator */}
        <div className="ml-auto flex items-center gap-1">
          <CheckCircle size={12} className="text-emerald-500" />
          <span className="text-[10px] font-mono text-emerald-500">BILLABLE</span>
        </div>
      </div>
      
      {/* Comment textarea */}
      <textarea
        value={entry.comment}
        onChange={(e) => onUpdate(entry.id, { comment: e.target.value })}
        placeholder="Describe the work done..."
        rows={2}
        className={`
          w-full px-2 py-1.5 text-xs rounded border resize-none
          ${inputBg} ${inputBorder} ${textPrimary}
          focus:outline-none focus:ring-1 focus:ring-cyan-500
          placeholder:${textSecondary}
        `}
      />
    </div>
  );
};
