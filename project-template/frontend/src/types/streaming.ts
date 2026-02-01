import { DraftData, DraftUpdateEvent } from './conversation';

// =============================================================================
// SSE EVENT TYPES
// =============================================================================

export interface StreamingOptions {
  message: string;
  mode: string;
  conversationHistory?: Array<{ role: string; content: string }>;
  onChunk: (text: string) => void;
  onThinking: (thinking: string) => void;
  onDraft?: (draft: DraftData) => void;
  onDraftUpdate?: (update: DraftUpdateEvent) => void;
  onDraftComplete?: (message?: string) => void;
  onComplete: (fullText: string) => void;
  onError: (error: Error) => void;
}

// SSE event structure from backend
export interface SSEEvent {
  type: 'init' | 'text' | 'thinking' | 'tool_use' | 'result' | 'draft_init' | 'draft_update' | 'draft_complete' | 'error';
  text?: string;
  thinking?: string;
  tool?: string;
  draft?: DraftData;
  action?: string;
  section?: unknown;
  sectionId?: string;
  item?: unknown;
  itemId?: string;
  subitems?: unknown[];
  message?: string;
  error?: string;
}

// Submit result
export interface SubmitResult {
  success: boolean;
  id?: string;
  url?: string;
  message: string;
  error?: string;
}
