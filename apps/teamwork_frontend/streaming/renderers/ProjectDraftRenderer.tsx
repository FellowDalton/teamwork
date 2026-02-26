/**
 * ProjectDraftRenderer - Connects ProjectDraftCard to stream state
 *
 * Wraps the existing ProjectDraftCard component with stream-aware props.
 * This renderer is used by StreamDisplayPanel to display project drafts.
 */

import React from 'react';
import type { StreamRendererProps } from '../core/types';
import type { ProjectDraftData, TasklistDraft, TaskDraft } from '../../types/conversation';
import { ProjectDraftCard } from '../../components/ProjectDraftCard';

export interface ProjectRendererExtraProps {
  hourlyRate?: number;
  onProjectDraftSubmit?: () => void;
  isCreatingProject?: boolean;
  onUpdateProjectTasklist?: (tasklistId: string, updates: Partial<TasklistDraft>) => void;
  onUpdateProjectTask?: (tasklistId: string, taskId: string, updates: Partial<TaskDraft>) => void;
}

// Extra props are injected via StreamDisplayPanel's extraProps mechanism
type Props = StreamRendererProps<ProjectDraftData> & ProjectRendererExtraProps;

export const ProjectDraftRenderer: React.FC<Props> = ({
  state,
  theme,
  hourlyRate = 1200,
  onUpdateProjectTasklist,
  onUpdateProjectTask,
}) => {
  if (!state || !state.isDraft) return null;

  return (
    <ProjectDraftCard
      data={state}
      theme={theme}
      hourlyRate={hourlyRate}
      onUpdateTasklist={onUpdateProjectTasklist}
      onUpdateTask={onUpdateProjectTask}
    />
  );
};
