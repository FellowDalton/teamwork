/**
 * Generic NDJSON (JSON Lines) Parser
 *
 * Extracted from ProjectJsonParser. Accumulates text chunks,
 * splits by newlines, and emits parsed objects with a `type` field.
 * Gracefully skips non-JSON content (thinking text, etc.).
 */

import type { StreamLine } from './types';

export class NdjsonParser {
  private buffer = '';
  private onEvent: (line: StreamLine) => void;

  constructor(onEvent: (line: StreamLine) => void) {
    this.onEvent = onEvent;
  }

  /**
   * Feed a text chunk into the parser.
   * Processes complete lines and keeps incomplete ones in buffer.
   */
  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');

    // Keep last line in buffer (might be incomplete)
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      this.processLine(line);
    }
  }

  /**
   * Process any remaining buffer content.
   * Call this when the stream ends.
   */
  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
  }

  /** Process a single line - parse if it's valid JSON with a type field */
  private processLine(line: string): void {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) return;

    // Only process lines that look like JSON objects
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return;

    try {
      const parsed = JSON.parse(trimmed);

      // Validate it has a type field
      if (parsed && typeof parsed.type === 'string') {
        this.onEvent(parsed as StreamLine);
      }
    } catch {
      // Not valid JSON - skip gracefully
    }
  }

  /** Reset the parser state */
  reset(): void {
    this.buffer = '';
  }
}
