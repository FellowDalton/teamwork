import type { StreamLine } from './types';

export class NdjsonParser {
  private buffer = '';
  private onEvent: (line: StreamLine) => void;

  constructor(onEvent: (line: StreamLine) => void) {
    this.onEvent = onEvent;
  }

  feed(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';
    for (const line of lines) {
      this.processLine(line);
    }
  }

  flush(): void {
    if (this.buffer.trim()) {
      this.processLine(this.buffer);
      this.buffer = '';
    }
  }

  private processLine(line: string): void {
    const trimmed = line.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.type === 'string') {
        this.onEvent(parsed as StreamLine);
      }
    } catch {
      // Not valid JSON - skip
    }
  }

  reset(): void {
    this.buffer = '';
  }
}
