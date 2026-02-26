/**
 * WebsiteRenderer - Skeleton structural preview for website builder
 *
 * Renders a live preview showing pages/sections appearing as they stream in.
 * Uses collapsible sections with component type labels. No actual HTML rendering -
 * just a structural preview that can be extended later.
 */

import React, { useState, useEffect, useRef } from 'react';
import type { StreamRendererProps } from '../core/types';
import type { WebsiteDraftState, WebsitePage, WebsiteSection } from '../accumulators/WebsiteAccumulator';

interface PageSectionProps {
  section: WebsiteSection;
  isLight: boolean;
  isNew: boolean;
}

const SectionCard: React.FC<PageSectionProps> = ({ section, isLight, isNew }) => {
  const cardBg = isLight ? 'bg-white' : 'bg-zinc-900';
  const cardBorder = isLight ? 'border-zinc-200' : 'border-zinc-800';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';

  // Extract key props for display
  const keyProps = Object.entries(section.props)
    .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
    .slice(0, 3);

  return (
    <div className={`
      ${cardBg} border ${cardBorder} rounded p-2.5 transition-all duration-300
      ${isNew ? 'ring-1 ring-cyan-500/30 animate-pulse' : ''}
    `}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`
          px-1.5 py-0.5 rounded text-[10px] font-mono font-medium uppercase
          ${isLight ? 'bg-purple-100 text-purple-700' : 'bg-purple-900/50 text-purple-400'}
        `}>
          {section.component}
        </span>
        <span className={`text-[10px] font-mono ${textSecondary}`}>{section.id}</span>
      </div>
      {keyProps.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {keyProps.map(([key, value]) => (
            <span key={key} className={`text-[10px] ${textSecondary}`}>
              <span className="opacity-60">{key}:</span>{' '}
              <span className={textPrimary}>
                {String(value).length > 40 ? String(value).slice(0, 40) + '...' : String(value)}
              </span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

interface PageCardProps {
  page: WebsitePage;
  isLight: boolean;
  defaultExpanded: boolean;
  newSectionIds: Set<string>;
}

const PageCard: React.FC<PageCardProps> = ({ page, isLight, defaultExpanded, newSectionIds }) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const headerBg = isLight ? 'bg-zinc-50 hover:bg-zinc-100' : 'bg-zinc-800/50 hover:bg-zinc-800';
  const cardBg = isLight ? 'bg-white' : 'bg-zinc-900';
  const cardBorder = isLight ? 'border-zinc-200' : 'border-zinc-800';

  // Auto-expand when new sections arrive
  useEffect(() => {
    if (page.sections.some(s => newSectionIds.has(s.id))) {
      setExpanded(true);
    }
  }, [page.sections, newSectionIds]);

  return (
    <div className={`${cardBg} border ${cardBorder} rounded-lg overflow-hidden`}>
      <div
        className={`flex items-center gap-2 p-3 cursor-pointer ${headerBg}`}
        onClick={() => setExpanded(!expanded)}
      >
        <span className={`text-xs ${expanded ? 'rotate-90' : ''} transition-transform`}>
          &#9654;
        </span>
        <span className={`font-medium text-sm ${textPrimary}`}>{page.title}</span>
        <span className={`text-[10px] font-mono ${textSecondary}`}>{page.route}</span>
        <span className={`ml-auto text-[10px] ${textSecondary}`}>
          {page.sections.length} section{page.sections.length !== 1 ? 's' : ''}
        </span>
      </div>
      {expanded && (
        <div className="p-2 space-y-2">
          {page.sections.length === 0 ? (
            <div className={`text-xs ${textSecondary} text-center py-2 italic`}>
              No sections yet
            </div>
          ) : (
            page.sections.map(section => (
              <SectionCard
                key={section.id}
                section={section}
                isLight={isLight}
                isNew={newSectionIds.has(section.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
};

export const WebsiteRenderer: React.FC<StreamRendererProps<WebsiteDraftState>> = ({
  state,
  theme = 'dark',
}) => {
  if (!state) return null;

  const isLight = theme === 'light';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';

  // Track new section IDs for animation
  const seenSections = useRef(new Set<string>());
  const [newSectionIds, setNewSectionIds] = useState(new Set<string>());

  useEffect(() => {
    const currentIds = new Set<string>();
    const freshIds = new Set<string>();
    for (const page of state.pages) {
      for (const section of page.sections) {
        currentIds.add(section.id);
        if (!seenSections.current.has(section.id)) {
          freshIds.add(section.id);
          seenSections.current.add(section.id);
        }
      }
    }
    if (freshIds.size > 0) {
      setNewSectionIds(prev => new Set([...prev, ...freshIds]));
      setTimeout(() => {
        setNewSectionIds(prev => {
          const next = new Set(prev);
          freshIds.forEach(id => next.delete(id));
          return next;
        });
      }, 500);
    }
  }, [state.pages]);

  return (
    <div className="space-y-4">
      {/* Website Meta */}
      {state.meta.title && (
        <div className={`
          rounded-lg border p-4
          ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}
        `}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">🌐</span>
            <h3 className={`font-semibold ${textPrimary}`}>{state.meta.title}</h3>
            {state.meta.theme && (
              <span className={`
                px-1.5 py-0.5 rounded text-[10px] font-mono
                ${isLight ? 'bg-zinc-100 text-zinc-600' : 'bg-zinc-800 text-zinc-400'}
              `}>
                {state.meta.theme}
              </span>
            )}
          </div>
          {state.meta.description && (
            <p className={`text-sm ${textSecondary}`}>{state.meta.description}</p>
          )}
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`
          rounded-lg border p-3 text-center
          ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}
        `}>
          <div className={`text-2xl font-bold ${textPrimary}`}>{state.pages.length}</div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Pages</div>
        </div>
        <div className={`
          rounded-lg border p-3 text-center
          ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}
        `}>
          <div className={`text-2xl font-bold ${textPrimary}`}>
            {state.pages.reduce((sum, p) => sum + p.sections.length, 0)}
          </div>
          <div className={`text-[10px] uppercase tracking-wider ${textSecondary}`}>Sections</div>
        </div>
      </div>

      {/* Pages */}
      <div>
        <div className={`flex items-center gap-2 mb-2 ${textSecondary} text-xs uppercase tracking-wider`}>
          <span>Pages</span>
        </div>
        {state.pages.length === 0 ? (
          <div className={`
            rounded-lg border p-4 text-center italic text-sm
            ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-900 border-zinc-800'}
            ${textSecondary}
          `}>
            {state.isBuilding ? 'Building website structure...' : 'No pages defined'}
          </div>
        ) : (
          <div className="space-y-3">
            {state.pages.map(page => (
              <PageCard
                key={page.id}
                page={page}
                isLight={isLight}
                defaultExpanded={true}
                newSectionIds={newSectionIds}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completion message */}
      {state.message && !state.isBuilding && (
        <div className={`
          rounded-lg border p-3 text-sm
          ${isLight ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-emerald-900/20 border-emerald-800 text-emerald-400'}
        `}>
          {state.message}
        </div>
      )}
    </div>
  );
};
