// =============================================================================
// CONVERSATION TYPES
// =============================================================================

// Mode/topic for the conversation - customize these for your use case
export type ConversationMode = 'create' | 'query' | 'general';

// Chat message structure
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  mode: ConversationMode;
  isThinking?: boolean;
}

// =============================================================================
// DISPLAY TYPES (Right Panel)
// =============================================================================

export type DisplayType = 'draft' | 'data' | 'empty';

export interface DisplayData {
  type: DisplayType;
  title: string;
  subtitle?: string;
  items: DisplayItem[];
}

export interface DisplayItem {
  id: string;
  type: 'metric' | 'card' | 'chart';
  data: MetricData | CardData | ChartData;
}

export interface MetricData {
  label: string;
  value: string | number;
  subValue?: string;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
}

export interface CardData {
  title: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface ChartData {
  chartType: 'bar' | 'line';
  title: string;
  data: Array<{ label: string; value: number }>;
  summary?: { total?: number; average?: number };
}

// =============================================================================
// DRAFT TYPES (Progressive Building)
// =============================================================================

// Generic draft item - extend this for your specific use case
export interface DraftItem {
  id: string;
  name: string;
  description?: string;
  children?: DraftItem[];
  metadata?: Record<string, unknown>;
}

// Generic section containing items
export interface DraftSection {
  id: string;
  name: string;
  description?: string;
  items: DraftItem[];
}

// Main draft data structure
export interface DraftData {
  id: string;
  name: string;
  description?: string;
  sections: DraftSection[];
  summary: {
    totalSections: number;
    totalItems: number;
    totalSubItems: number;
    [key: string]: number; // Allow custom summary fields
  };
  message: string;
  isDraft: true;
  isBuilding?: boolean;
  isSubmitted?: boolean;
  submittedUrl?: string;
}

// =============================================================================
// STREAMING EVENT TYPES
// =============================================================================

export type DraftUpdateAction =
  | 'add_section'
  | 'add_item'
  | 'add_subitem'
  | 'update_metadata';

export interface DraftUpdateEvent {
  type: 'draft_update';
  action: DraftUpdateAction;
  section?: DraftSection;
  sectionId?: string;
  item?: DraftItem;
  itemId?: string;
  subitems?: DraftItem[];
}

// =============================================================================
// JSON LINES STREAMING FORMAT
// =============================================================================

// Each line in the stream is one of these types
export type StreamLine =
  | { type: 'draft'; name: string; description?: string }
  | { type: 'section'; id: string; name: string; description?: string }
  | { type: 'item'; id: string; sectionId: string; name: string; description?: string }
  | { type: 'subitem'; itemId: string; name: string; description?: string }
  | { type: 'complete'; message?: string };
