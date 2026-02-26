/**
 * SuggestionCards - 2x2 grid of clickable suggestion cards
 *
 * Used for status mode type selection and period selection.
 * Supports an optional header and subtitle shown above the cards.
 */

import React from 'react';

export interface SuggestionCard {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  prompt: string;
}

interface SuggestionCardsProps {
  cards: SuggestionCard[];
  onSelect: (card: SuggestionCard) => void;
  theme?: 'light' | 'dark';
  /** Optional header shown above the cards */
  header?: string;
  /** Optional subtitle below the header */
  subtitle?: string;
}

export const SuggestionCards: React.FC<SuggestionCardsProps> = ({
  cards,
  onSelect,
  theme = 'dark',
  header,
  subtitle,
}) => {
  const isLight = theme === 'light';

  const cardBg = isLight
    ? 'bg-white border-zinc-200 hover:border-amber-400'
    : 'bg-zinc-900 border-zinc-800 hover:border-amber-600';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-100';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-400';
  const iconColor = isLight ? 'text-amber-600' : 'text-amber-500';

  return (
    <div className="my-3">
      {header && (
        <div className="mb-2">
          <div className={`text-xs font-medium ${textPrimary}`}>{header}</div>
          {subtitle && (
            <div className={`text-[10px] mt-0.5 ${textSecondary}`}>{subtitle}</div>
          )}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {cards.map(card => (
          <button
            key={card.id}
            onClick={() => onSelect(card)}
            className={`
              group flex flex-col items-start gap-1.5 p-3 rounded-lg border
              transition-all duration-200 text-left cursor-pointer
              ${cardBg}
              hover:shadow-[0_0_12px_rgba(245,158,11,0.15)]
            `}
          >
            <div className="flex items-center gap-2">
              <span className={`${iconColor} group-hover:scale-110 transition-transform`}>
                {card.icon}
              </span>
              <span className={`text-xs font-medium ${textPrimary}`}>
                {card.label}
              </span>
            </div>
            <span className={`text-[10px] leading-tight ${textSecondary}`}>
              {card.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
