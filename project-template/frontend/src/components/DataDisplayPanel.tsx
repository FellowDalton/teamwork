import React from 'react';
import { Inbox, FolderOpen, Loader2, CheckCircle2, Rocket, ExternalLink } from 'lucide-react';
import { DisplayData, DraftData, DraftSection, DraftItem } from '../types/conversation';
import { DraftCard } from './DraftCard';

interface DataDisplayPanelProps {
  data: DisplayData | null;
  // Draft mode props
  draftData?: DraftData | null;
  onDraftSubmit?: () => void;
  isSubmitting?: boolean;
  onUpdateSection?: (sectionId: string, updates: Partial<DraftSection>) => void;
  onUpdateItem?: (sectionId: string, itemId: string, updates: Partial<DraftItem>) => void;
}

export const DataDisplayPanel: React.FC<DataDisplayPanelProps> = ({
  data,
  draftData,
  onDraftSubmit,
  isSubmitting = false,
  onUpdateSection,
  onUpdateItem,
}) => {
  const isDraftMode = draftData && draftData.isDraft;
  const isBuilding = draftData?.isBuilding;

  const displayType = data?.type || 'empty';
  const title = draftData ? 'Draft Preview' : data?.title || 'DATA DISPLAY';

  return (
    <div className="flex-1 flex flex-col h-full rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div
            className={`w-2 h-2 rounded-full ${
              isDraftMode ? 'bg-purple-500' : 'bg-cyan-500'
            }`}
          />
          <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
            {title}
          </span>
          {data?.subtitle && (
            <span className="text-xs text-zinc-500">• {data.subtitle}</span>
          )}
        </div>

        {/* Building indicator */}
        {isDraftMode && isBuilding && (
          <div className="flex items-center gap-2">
            <Loader2 size={12} className="text-cyan-500 animate-spin" />
            <span className="text-xs text-cyan-500 animate-pulse">BUILDING...</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col custom-scrollbar">
        {/* Draft Mode */}
        {isDraftMode && (
          <div className="mb-4">
            {/* Draft Header */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <FolderOpen size={14} className="text-purple-500" />
                <span className="text-sm font-medium text-zinc-200">Preview</span>
              </div>
              <div className="text-xs text-zinc-500">Review before submitting</div>
            </div>

            {/* Draft Card */}
            <DraftCard
              data={draftData!}
              onUpdateSection={onUpdateSection}
              onUpdateItem={onUpdateItem}
            />

            {/* Submit Button - only show when not building */}
            {!isBuilding && (
              <div className="mt-4 flex justify-end gap-3">
                {draftData!.isSubmitted && draftData!.submittedUrl && (
                  <a
                    href={draftData!.submittedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-cyan-600 text-white hover:bg-cyan-500 transition-all"
                  >
                    <ExternalLink size={16} />
                    <span>View Result</span>
                  </a>
                )}
                <button
                  onClick={onDraftSubmit}
                  disabled={isSubmitting || draftData!.isSubmitted}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                    isSubmitting || draftData!.isSubmitted
                      ? 'opacity-50 cursor-not-allowed bg-zinc-600 text-zinc-400'
                      : 'bg-purple-600 text-white hover:bg-purple-500 cursor-pointer'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : draftData!.isSubmitted ? (
                    <>
                      <CheckCircle2 size={16} />
                      <span>Submitted</span>
                    </>
                  ) : (
                    <>
                      <Rocket size={16} />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Data Cards - show when NOT in draft mode */}
        {!isDraftMode && data && data.items && data.items.length > 0 && (
          <div className="grid gap-3 grid-cols-1">
            {data.items.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-zinc-700 p-4 bg-zinc-800/30"
              >
                {item.type === 'metric' && 'label' in item.data && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-zinc-100">
                      {(item.data as { value: string | number }).value}
                    </div>
                    <div className="text-xs uppercase tracking-wider text-zinc-500">
                      {(item.data as { label: string }).label}
                    </div>
                    {'subValue' in item.data && item.data.subValue && (
                      <div className="text-xs text-zinc-500 mt-1">
                        {item.data.subValue}
                      </div>
                    )}
                  </div>
                )}
                {item.type === 'card' && 'title' in item.data && (
                  <div>
                    <div className="font-medium text-zinc-200">
                      {(item.data as { title: string }).title}
                    </div>
                    {'description' in item.data && item.data.description && (
                      <div className="text-sm text-zinc-400 mt-1">
                        {item.data.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isDraftMode && (!data || data.type === 'empty' || !data.items || data.items.length === 0) && (
          <div className="flex flex-col items-center justify-center flex-1 text-zinc-500">
            <div className="w-16 h-16 rounded-full border-2 border-dashed border-zinc-700 flex items-center justify-center mb-4">
              <Inbox size={24} className="opacity-30" />
            </div>
            <p className="text-xs uppercase tracking-widest mb-1">Awaiting Data</p>
            <p className="text-xs opacity-50">AI will display information here</p>
          </div>
        )}
      </div>
    </div>
  );
};
