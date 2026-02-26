/**
 * Backward-compatible re-export wrapper
 *
 * The core logic has been extracted to the streaming framework:
 * - NdjsonParser → streaming/core/NdjsonParser.ts
 * - ProjectStateAccumulator → streaming/accumulators/ProjectAccumulator.ts
 *
 * This file preserves the old API for any remaining consumers.
 */

import type {
  ProjectLine,
  ProjectDraftData,
} from '../types/conversation';
import { NdjsonParser } from '../streaming/core/NdjsonParser';
import { ProjectAccumulator } from '../streaming/accumulators/ProjectAccumulator';

/**
 * @deprecated Use NdjsonParser from streaming/core/NdjsonParser instead
 */
export class ProjectJsonParser {
  private parser: NdjsonParser;

  constructor(onEvent: (event: ProjectLine) => void) {
    this.parser = new NdjsonParser((line) => {
      // Only forward project-related lines
      if (['project', 'tasklist', 'task', 'subtask', 'complete'].includes(line.type)) {
        onEvent(line as ProjectLine);
      }
    });
  }

  feed(chunk: string): void {
    this.parser.feed(chunk);
  }

  flush(): void {
    this.parser.flush();
  }

  reset(): void {
    this.parser.reset();
  }
}

/**
 * @deprecated Use ProjectAccumulator from streaming/accumulators/ProjectAccumulator instead
 */
export class ProjectStateAccumulator {
  private accumulator = new ProjectAccumulator();

  processEvent(event: ProjectLine): ProjectDraftData {
    return this.accumulator.processLine(event);
  }

  getDraft(): ProjectDraftData {
    return this.accumulator.getState();
  }

  isComplete(): boolean {
    return this.accumulator.isComplete();
  }

  reset(): void {
    this.accumulator.reset();
  }
}

/**
 * @deprecated Use the streaming framework's StreamProvider/StreamContext instead
 */
export function createProjectJsonLineProcessor(
  onDraftUpdate: (draft: ProjectDraftData) => void,
  onComplete: (draft: ProjectDraftData) => void
) {
  const accumulator = new ProjectStateAccumulator();

  const parser = new ProjectJsonParser((event) => {
    const draft = accumulator.processEvent(event);

    if (event.type === 'complete') {
      onComplete(draft);
    } else {
      onDraftUpdate(draft);
    }
  });

  return {
    parser,
    accumulator,
    feed: (chunk: string) => parser.feed(chunk),
    flush: () => parser.flush(),
    reset: () => {
      parser.reset();
      accumulator.reset();
    },
  };
}
