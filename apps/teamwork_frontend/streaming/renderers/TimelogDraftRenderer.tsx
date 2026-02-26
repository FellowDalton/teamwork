/**
 * TimelogDraftRenderer - Connects TimelogDraftCard to stream state
 *
 * Wraps the existing TimelogDraftCard component with stream-aware props.
 */

import React from 'react';
import type { StreamRendererProps } from '../core/types';
import type { TimelogDraftData, TimelogDraftEntry } from '../../types/conversation';
import { TimelogDraftCard } from '../../components/TimelogDraftCard';

export interface TimelogRendererExtraProps {
  onDraftUpdate?: (id: string, updates: Partial<TimelogDraftEntry>) => void;
  onDraftRemove?: (id: string) => void;
  onDraftSubmit?: () => void;
  isSubmitting?: boolean;
}

type Props = StreamRendererProps<TimelogDraftData> & TimelogRendererExtraProps;

export const TimelogDraftRenderer: React.FC<Props> = ({
  state,
  theme,
  onDraftUpdate,
  onDraftRemove,
}) => {
  if (!state || !state.isDraft || state.entries.length === 0) return null;

  return (
    <div className="grid gap-3 grid-cols-1">
      {state.entries.map(entry => (
        <TimelogDraftCard
          key={entry.id}
          entry={entry}
          theme={theme}
          onUpdate={onDraftUpdate || (() => {})}
          onRemove={onDraftRemove || (() => {})}
        />
      ))}
    </div>
  );
};
