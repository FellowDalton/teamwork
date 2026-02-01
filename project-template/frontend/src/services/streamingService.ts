import { DraftData, DraftSection, DraftItem, DraftUpdateEvent } from '../types/conversation';
import { StreamingOptions } from '../types/streaming';

// =============================================================================
// API CONFIGURATION
// =============================================================================

const API_BASE = '/api';

// =============================================================================
// STREAMING SERVICE
// =============================================================================

/**
 * Process a streaming response from the backend using Server-Sent Events.
 *
 * This function handles:
 * - Real-time text streaming
 * - Thinking/reasoning updates
 * - Progressive draft building
 * - Error handling
 */
export const processStream = async (options: StreamingOptions): Promise<void> => {
  const {
    message,
    mode,
    conversationHistory,
    onChunk,
    onThinking,
    onDraft,
    onDraftUpdate,
    onDraftComplete,
    onComplete,
    onError,
  } = options;

  try {
    const response = await fetch(`${API_BASE}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        mode,
        conversationHistory,
      }),
    });

    if (!response.ok) {
      throw new Error(`Stream error: ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      let streamDone = false;
      for (const line of lines) {
        const data = line.slice(6); // Remove "data: " prefix

        if (data === '[DONE]') {
          streamDone = true;
          break;
        }

        try {
          const parsed = JSON.parse(data);

          switch (parsed.type) {
            case 'init':
              console.log('Stream initialized:', parsed.model);
              break;

            case 'text':
              if (parsed.text) {
                fullText += parsed.text;
                onChunk(parsed.text);
              }
              break;

            case 'thinking':
              if (parsed.thinking) {
                onThinking(parsed.thinking);
              }
              break;

            case 'result':
              if (parsed.text) {
                fullText = parsed.text;
                onChunk(parsed.text);
              }
              break;

            case 'draft_init':
              if (parsed.draft && onDraft) {
                const draft: DraftData = {
                  ...parsed.draft,
                  isBuilding: true,
                  isDraft: true,
                };
                onDraft(draft);
              }
              break;

            case 'draft_update':
              if (onDraftUpdate) {
                onDraftUpdate({
                  type: 'draft_update',
                  action: parsed.action,
                  section: parsed.section,
                  sectionId: parsed.sectionId,
                  item: parsed.item,
                  itemId: parsed.itemId,
                  subitems: parsed.subitems,
                });
              }
              break;

            case 'draft_complete':
              if (onDraftComplete) {
                onDraftComplete(parsed.message);
              }
              break;

            case 'error':
              throw new Error(parsed.error);
          }
        } catch (e) {
          if (e instanceof SyntaxError) continue; // Skip invalid JSON
          throw e;
        }
      }

      if (streamDone) break;
    }

    onComplete(fullText);
  } catch (error) {
    onError(error instanceof Error ? error : new Error(String(error)));
  }
};

// =============================================================================
// SUBMIT SERVICE
// =============================================================================

/**
 * Submit a completed draft to the backend.
 */
export const submitDraft = async (draft: DraftData): Promise<{ success: boolean; url?: string; message: string }> => {
  const response = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(draft),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `Failed to submit: ${response.status}`);
  }

  return response.json();
};

// =============================================================================
// JSON LINES PARSER
// =============================================================================

/**
 * Parser for JSON Lines streaming format.
 * Each line is a complete JSON object that gets parsed progressively.
 */
export class JsonLinesParser {
  private buffer = '';
  private onEvent: (event: unknown) => void;

  constructor(onEvent: (event: unknown) => void) {
    this.onEvent = onEvent;
  }

  feed(chunk: string) {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        this.onEvent(parsed);
      } catch {
        // Skip invalid JSON lines
      }
    }
  }

  flush() {
    if (this.buffer.trim()) {
      try {
        const parsed = JSON.parse(this.buffer.trim());
        this.onEvent(parsed);
      } catch {
        // Ignore incomplete JSON
      }
      this.buffer = '';
    }
  }
}

// =============================================================================
// DRAFT STATE ACCUMULATOR
// =============================================================================

/**
 * Accumulates streaming events into a complete DraftData structure.
 * Used when the backend sends JSON Lines format for progressive rendering.
 */
export class DraftStateAccumulator {
  private draft: DraftData | null = null;
  private sectionCounter = 0;
  private itemCounter = 0;
  private subItemCounter = 0;

  processEvent(event: {
    type: string;
    name?: string;
    description?: string;
    id?: string;
    sectionId?: string;
    itemId?: string;
    message?: string;
  }): DraftData | null {
    switch (event.type) {
      case 'draft':
        this.draft = {
          id: `draft-${Date.now()}`,
          name: event.name || 'Untitled',
          description: event.description,
          sections: [],
          summary: { totalSections: 0, totalItems: 0, totalSubItems: 0 },
          message: '',
          isDraft: true,
          isBuilding: true,
        };
        break;

      case 'section':
        if (this.draft) {
          const section: DraftSection = {
            id: event.id || `section-${++this.sectionCounter}`,
            name: event.name || 'Unnamed Section',
            description: event.description,
            items: [],
          };
          this.draft.sections.push(section);
          this.draft.summary.totalSections = this.draft.sections.length;
        }
        break;

      case 'item':
        if (this.draft && event.sectionId) {
          const section = this.draft.sections.find((s) => s.id === event.sectionId);
          if (section) {
            const item: DraftItem = {
              id: event.id || `item-${++this.itemCounter}`,
              name: event.name || 'Unnamed Item',
              description: event.description,
              children: [],
            };
            section.items.push(item);
            this.draft.summary.totalItems++;
          }
        }
        break;

      case 'subitem':
        if (this.draft && event.itemId) {
          for (const section of this.draft.sections) {
            const item = section.items.find((i) => i.id === event.itemId);
            if (item) {
              const subitem: DraftItem = {
                id: `subitem-${++this.subItemCounter}`,
                name: event.name || 'Unnamed Sub-item',
                description: event.description,
              };
              item.children = item.children || [];
              item.children.push(subitem);
              this.draft.summary.totalSubItems++;
              break;
            }
          }
        }
        break;

      case 'complete':
        if (this.draft) {
          this.draft.isBuilding = false;
          this.draft.message = event.message || 'Draft complete';
        }
        break;
    }

    return this.draft;
  }

  getDraft(): DraftData | null {
    return this.draft;
  }
}
