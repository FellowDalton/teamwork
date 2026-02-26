/**
 * WebsiteAccumulator - Skeleton plugin for website builder
 *
 * Proof-of-concept accumulator that processes website NDJSON lines
 * and builds up a WebsiteDraftState with pages and sections.
 */

import type { StreamLine, StreamAccumulator } from '../core/types';

export const WEBSITE_LINE_TYPES = [
  'website_meta',
  'website_page',
  'website_section',
  'website_complete',
] as const;

type WebsiteLineType = typeof WEBSITE_LINE_TYPES[number];

export type WebsiteLine =
  | { type: 'website_meta'; title: string; description?: string; theme?: string }
  | { type: 'website_page'; id: string; title: string; route: string }
  | { type: 'website_section'; id: string; pageId: string; component: string; props: Record<string, unknown> }
  | { type: 'website_complete'; message?: string };

export interface WebsiteSection {
  id: string;
  component: string;
  props: Record<string, unknown>;
}

export interface WebsitePage {
  id: string;
  title: string;
  route: string;
  sections: WebsiteSection[];
}

export interface WebsiteDraftState {
  meta: { title: string; description?: string; theme?: string };
  pages: WebsitePage[];
  isBuilding: boolean;
  message?: string;
}

function isWebsiteLine(line: StreamLine): line is WebsiteLine {
  return WEBSITE_LINE_TYPES.includes(line.type as WebsiteLineType);
}

export class WebsiteAccumulator implements StreamAccumulator<WebsiteDraftState, WebsiteLine> {
  readonly id = 'website';
  readonly displayName = 'Website Builder';

  private meta: WebsiteDraftState['meta'] = { title: '' };
  private pages: WebsitePage[] = [];
  private isBuilding = true;
  private message?: string;

  accepts(line: StreamLine): line is WebsiteLine {
    return isWebsiteLine(line);
  }

  processLine(line: WebsiteLine): WebsiteDraftState {
    switch (line.type) {
      case 'website_meta':
        this.meta = {
          title: line.title,
          description: line.description,
          theme: line.theme,
        };
        break;

      case 'website_page': {
        // Only add if not already present
        if (!this.pages.find(p => p.id === line.id)) {
          this.pages.push({
            id: line.id,
            title: line.title,
            route: line.route,
            sections: [],
          });
        }
        break;
      }

      case 'website_section': {
        // Find or auto-create the target page
        let page = this.pages.find(p => p.id === line.pageId);
        if (!page) {
          // Auto-create a "home" page if sections arrive before page declaration
          page = { id: line.pageId, title: line.pageId, route: `/${line.pageId}`, sections: [] };
          this.pages.push(page);
        }
        page.sections.push({
          id: line.id,
          component: line.component,
          props: line.props,
        });
        break;
      }

      case 'website_complete':
        this.isBuilding = false;
        this.message = line.message;
        break;
    }

    return this.getState();
  }

  isComplete(): boolean {
    return !this.isBuilding;
  }

  getState(): WebsiteDraftState {
    return {
      meta: { ...this.meta },
      pages: this.pages.map(p => ({
        ...p,
        sections: [...p.sections],
      })),
      isBuilding: this.isBuilding,
      message: this.message,
    };
  }

  reset(): void {
    this.meta = { title: '' };
    this.pages = [];
    this.isBuilding = true;
    this.message = undefined;
  }
}
