# Dataweb Integration Plan

## Executive Summary

The **Dataweb** is a configuration layer that links Teamwork projects to data sources across Microsoft 365 (SharePoint, Outlook, Teams). When a project is selected, Claude automatically has access to relevant client files, email threads, and team discussions—without manual context gathering.

This spec covers:
1. Auto-discovery of SharePoint client folders when selecting projects
2. UI for configuring project data sources (Dataweb button)
3. Backend integration patterns
4. Storage and synchronization

---

## Part 1: Core Concepts

### What is the Dataweb?

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           DATAWEB                                       │
│                                                                         │
│  ┌─────────────────┐                                                    │
│  │  Teamwork       │                                                    │
│  │  Project        │◄──── User selects project                          │
│  │  "Website       │                                                    │
│  │   Redesign"     │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                             │
│           │ Dataweb Configuration                                       │
│           │ (stored per project)                                        │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                     Linked Data Sources                        │    │
│  │                                                                │    │
│  │  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────┐  │    │
│  │  │   SharePoint     │  │    Outlook      │  │    Teams     │  │    │
│  │  │                  │  │                 │  │              │  │    │
│  │  │  📁 /Clients/    │  │  📧 Search:     │  │  💬 Channel: │  │    │
│  │  │     Acme Corp/   │  │     "Acme"      │  │     #acme    │  │    │
│  │  │     Projects/    │  │                 │  │              │  │    │
│  │  │     Website/     │  │  📧 From:       │  │  💬 Team:    │  │    │
│  │  │                  │  │     john@acme   │  │     Acme     │  │    │
│  │  │  📁 /Shared/     │  │                 │  │     Project  │  │    │
│  │  │     Brand/       │  │                 │  │              │  │    │
│  │  └──────────────────┘  └─────────────────┘  └──────────────┘  │    │
│  └────────────────────────────────────────────────────────────────┘    │
│                                                                         │
│           │                                                             │
│           ▼                                                             │
│  ┌────────────────────────────────────────────────────────────────┐    │
│  │                     Claude Context                             │    │
│  │                                                                │    │
│  │  When user asks about the project, Claude automatically:       │    │
│  │  • Searches linked SharePoint folders for relevant files       │    │
│  │  • Checks recent emails matching the email filters             │    │
│  │  • Reviews Teams channel discussions                           │    │
│  │  • Includes this context in responses                          │    │
│  └────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. User selects project in sidebar
   ↓
2. Frontend checks if dataweb config exists
   ↓
3a. If no config → Auto-discover (search SharePoint for client folder)
   ↓
3b. If config exists → Load linked sources
   ↓
4. User can click "Dataweb" button to configure/modify
   ↓
5. When chatting, Claude uses dataweb sources for context
```

---

## Part 2: SharePoint Client Folder Discovery

### Folder Structure Assumption

Based on typical client work organization:

```
SharePoint Site (e.g., "Company Files")
└── Document Library
    └── Clients/
        ├── Acme Corp/
        │   ├── Projects/
        │   │   ├── Website Redesign 2024/
        │   │   │   ├── Documents/
        │   │   │   ├── Assets/
        │   │   │   └── Deliverables/
        │   │   └── Mobile App/
        │   ├── Contracts/
        │   └── Brand Assets/
        ├── Beta Inc/
        └── Gamma LLC/
```

### Auto-Discovery Algorithm

```typescript
interface DiscoveredFolder {
  path: string;
  driveId: string;
  itemId: string;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

async function discoverClientFolder(
  client: MicrosoftGraphClient,
  projectName: string,
  clientName?: string
): Promise<DiscoveredFolder[]> {
  const candidates: DiscoveredFolder[] = [];

  // Strategy 1: Search by project name
  const projectSearch = await client.sharepoint.searchFiles(projectName, { top: 10 });
  for (const item of projectSearch.value) {
    if (item.folder) {
      candidates.push({
        path: item.parentReference?.path || '',
        driveId: item.parentReference?.driveId || '',
        itemId: item.id,
        confidence: 'high',
        reason: `Folder name matches project: "${item.name}"`,
      });
    }
  }

  // Strategy 2: Search by client name (if provided)
  if (clientName) {
    const clientSearch = await client.sharepoint.searchFiles(clientName, { top: 10 });
    for (const item of clientSearch.value) {
      if (item.folder && item.name.toLowerCase().includes('client')) {
        candidates.push({
          path: item.parentReference?.path || '',
          driveId: item.parentReference?.driveId || '',
          itemId: item.id,
          confidence: 'medium',
          reason: `Client folder found: "${item.name}"`,
        });
      }
    }
  }

  // Strategy 3: Check common paths
  const commonPaths = [
    `Clients/${clientName}`,
    `Projects/${projectName}`,
    `Active Projects/${projectName}`,
    `Client Work/${clientName}/${projectName}`,
  ];

  for (const path of commonPaths) {
    try {
      const folder = await client.sharepoint.getItemByPath(path);
      if (folder.folder) {
        candidates.push({
          path,
          driveId: folder.parentReference?.driveId || '',
          itemId: folder.id,
          confidence: 'high',
          reason: `Standard path exists: "${path}"`,
        });
      }
    } catch {
      // Path doesn't exist, skip
    }
  }

  // Deduplicate and sort by confidence
  return deduplicateByItemId(candidates).sort((a, b) =>
    confidenceScore(b.confidence) - confidenceScore(a.confidence)
  );
}
```

### When to Trigger Discovery

1. **On project selection** (if no config exists)
2. **On "Dataweb" button click** → Show discovery results
3. **Manual search** → User enters path or search term

---

## Part 3: Dataweb Configuration Model

### TypeScript Types

```typescript
// Dataweb configuration per project
interface DatawebConfig {
  projectId: string;           // Teamwork project ID
  projectName: string;
  clientName?: string;         // Optional client name for better discovery

  // SharePoint/OneDrive sources
  sharepoint: SharePointSource[];

  // Outlook email filters
  outlook: OutlookSource[];

  // Teams channels/chats
  teams: TeamsSource[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  autoDiscovered: boolean;     // Was this auto-generated?
}

interface SharePointSource {
  id: string;
  type: 'folder' | 'site' | 'library';
  path: string;                // e.g., "Clients/Acme/Projects/Website"
  driveId?: string;
  siteId?: string;
  itemId?: string;
  displayName: string;         // User-friendly name
  includeSubfolders: boolean;
  fileTypes?: string[];        // Filter: ['pdf', 'docx'] or empty for all
}

interface OutlookSource {
  id: string;
  type: 'search' | 'sender' | 'folder';
  value: string;               // Search query, email address, or folder name
  displayName: string;
  daysBack?: number;           // Limit to last N days
}

interface TeamsSource {
  id: string;
  type: 'channel' | 'chat' | 'team';
  teamId?: string;
  channelId?: string;
  chatId?: string;
  displayName: string;
  includeReplies: boolean;
}
```

### Storage Options

#### Option A: JSON File (Simple, Local)

```typescript
// Store in .dataweb/configs/{projectId}.json
const configPath = `.dataweb/configs/${projectId}.json`;

async function saveDatawebConfig(config: DatawebConfig): Promise<void> {
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

async function loadDatawebConfig(projectId: string): Promise<DatawebConfig | null> {
  const file = Bun.file(configPath);
  if (await file.exists()) {
    return file.json();
  }
  return null;
}
```

#### Option B: Teamwork Custom Fields

Store as metadata on the Teamwork project using custom fields or tags.

```typescript
// Store as project tag or custom field
const tagValue = `dataweb:${Buffer.from(JSON.stringify(config)).toString('base64')}`;
```

#### Option C: SQLite Database

```sql
CREATE TABLE dataweb_configs (
  project_id TEXT PRIMARY KEY,
  project_name TEXT NOT NULL,
  client_name TEXT,
  config_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE dataweb_sources (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'sharepoint', 'outlook', 'teams'
  config_json TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES dataweb_configs(project_id)
);
```

**Recommendation**: Start with **Option A (JSON files)** for simplicity, migrate to SQLite if needed.

---

## Part 4: Frontend Implementation

### UI Components

#### 4.1 Dataweb Button (Header)

```tsx
// In App.tsx header section, add after existing mode buttons

<button
  onClick={() => setShowDatawebModal(true)}
  disabled={!activeProjectId}
  className={`dataweb-button ${activeProjectId ? 'active' : 'disabled'}`}
>
  <DatabaseIcon size={16} />
  Dataweb
  {datawebConfig && <span className="badge">{datawebConfig.sourceCount}</span>}
</button>
```

**Visual Design:**
```
┌───────────────────────────────────────────────────────────────────┐
│ [PROJECT ▾] [STATUS] [TIMELOG] [GENERAL]      [🗄️ Dataweb (3)] │
└───────────────────────────────────────────────────────────────────┘
                                                     ↑
                                                Shows number of
                                                linked sources
```

#### 4.2 Dataweb Modal

```tsx
interface DatawebModalProps {
  projectId: string;
  projectName: string;
  onClose: () => void;
  onSave: (config: DatawebConfig) => void;
}

function DatawebModal({ projectId, projectName, onClose, onSave }: DatawebModalProps) {
  const [config, setConfig] = useState<DatawebConfig | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveries, setDiscoveries] = useState<DiscoveredFolder[]>([]);

  useEffect(() => {
    loadConfig();
  }, [projectId]);

  async function handleDiscover() {
    setDiscovering(true);
    const results = await discoverClientFolders(projectName);
    setDiscoveries(results);
    setDiscovering(false);
  }

  return (
    <Modal onClose={onClose}>
      <h2>Dataweb: {projectName}</h2>

      {/* SharePoint Section */}
      <section>
        <h3>📁 SharePoint/OneDrive</h3>
        <button onClick={handleDiscover}>
          {discovering ? 'Searching...' : 'Auto-discover folders'}
        </button>

        {discoveries.map(folder => (
          <DiscoveryCard
            key={folder.itemId}
            folder={folder}
            onAdd={() => addSharePointSource(folder)}
          />
        ))}

        <SourceList
          sources={config?.sharepoint || []}
          onRemove={removeSharePointSource}
        />

        <button onClick={() => setShowAddFolder(true)}>
          + Add folder manually
        </button>
      </section>

      {/* Outlook Section */}
      <section>
        <h3>📧 Outlook Emails</h3>
        <SourceList sources={config?.outlook || []} />
        <button onClick={() => setShowAddEmail(true)}>
          + Add email filter
        </button>
      </section>

      {/* Teams Section */}
      <section>
        <h3>💬 Teams Channels</h3>
        <SourceList sources={config?.teams || []} />
        <button onClick={() => setShowAddTeams(true)}>
          + Add Teams channel
        </button>
      </section>

      <footer>
        <button onClick={onClose}>Cancel</button>
        <button onClick={() => onSave(config)}>Save Configuration</button>
      </footer>
    </Modal>
  );
}
```

**Modal Layout:**
```
┌─────────────────────────────────────────────────────────────────┐
│ Dataweb: Website Redesign Project                          [X] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 📁 SharePoint/OneDrive                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ [🔍 Auto-discover folders]                                  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Discovered:                                                     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📁 Clients/Acme Corp/Projects/Website  [✓ High] [+ Add]    │ │
│ │ 📁 Shared Documents/Acme               [◐ Medium] [+ Add]  │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ Linked folders:                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 📁 Clients/Acme Corp/Projects/Website          [- Remove]  │ │
│ │    Include subfolders: ✓   File types: All                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [+ Add folder manually]                                         │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 📧 Outlook Emails                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search: "Acme website"              Last 30 days [- ]   │ │
│ │ 👤 From: john@acmecorp.com             All time     [- ]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [+ Add email filter]                                            │
│                                                                 │
│ ─────────────────────────────────────────────────────────────── │
│                                                                 │
│ 💬 Teams Channels                                               │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Team: Acme Project → Channel: #general          [- Remove] │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ [+ Add Teams channel]                                           │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                              [Cancel]  [💾 Save Configuration]  │
└─────────────────────────────────────────────────────────────────┘
```

#### 4.3 State Management

```tsx
// In App.tsx
const [datawebConfigs, setDatawebConfigs] = useState<Map<string, DatawebConfig>>(new Map());
const [showDatawebModal, setShowDatawebModal] = useState(false);

// Load config when project changes
useEffect(() => {
  if (activeProjectId) {
    loadDatawebConfig(activeProjectId).then(config => {
      if (config) {
        setDatawebConfigs(prev => new Map(prev).set(activeProjectId, config));
      }
    });
  }
}, [activeProjectId]);

// Get current project's dataweb
const currentDataweb = activeProjectId ? datawebConfigs.get(activeProjectId) : null;
```

---

## Part 5: Backend Integration

### API Endpoints

Add to `server.ts` or `server-sdk.ts`:

```typescript
// GET /api/dataweb/:projectId
app.get('/api/dataweb/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const config = await loadDatawebConfig(projectId);
  res.json(config || { projectId, sources: [] });
});

// POST /api/dataweb/:projectId
app.post('/api/dataweb/:projectId', async (req, res) => {
  const { projectId } = req.params;
  const config: DatawebConfig = req.body;
  await saveDatawebConfig(config);
  res.json({ success: true });
});

// POST /api/dataweb/:projectId/discover
app.post('/api/dataweb/:projectId/discover', async (req, res) => {
  const { projectId } = req.params;
  const { projectName, clientName } = req.body;

  const client = createMicrosoftClientFromEnv();
  const discoveries = await discoverClientFolders(client, projectName, clientName);

  res.json({ discoveries });
});

// GET /api/dataweb/:projectId/context
// Returns aggregated context from all linked sources
app.get('/api/dataweb/:projectId/context', async (req, res) => {
  const { projectId } = req.params;
  const config = await loadDatawebConfig(projectId);

  if (!config) {
    return res.json({ context: null });
  }

  const client = createMicrosoftClientFromEnv();
  const context = await gatherDatawebContext(client, config);

  res.json({ context });
});
```

### Context Gathering Service

```typescript
// services/datawebService.ts

interface DatawebContext {
  files: Array<{
    name: string;
    path: string;
    modifiedAt: string;
    url: string;
  }>;
  emails: Array<{
    subject: string;
    from: string;
    date: string;
    preview: string;
  }>;
  teamsMessages: Array<{
    from: string;
    content: string;
    channel: string;
    date: string;
  }>;
}

async function gatherDatawebContext(
  client: MicrosoftGraphClient,
  config: DatawebConfig
): Promise<DatawebContext> {
  const context: DatawebContext = {
    files: [],
    emails: [],
    teamsMessages: [],
  };

  // Gather SharePoint files
  for (const source of config.sharepoint) {
    try {
      const items = await client.sharepoint.listItemsByPath(source.path, {
        top: 20,
        orderBy: 'lastModifiedDateTime desc',
      });

      for (const item of items.value) {
        if (!item.folder) {
          context.files.push({
            name: item.name,
            path: source.path,
            modifiedAt: item.lastModifiedDateTime || '',
            url: item.webUrl || '',
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch SharePoint source: ${source.path}`, error);
    }
  }

  // Gather Outlook emails
  for (const source of config.outlook) {
    try {
      let emails;
      if (source.type === 'search') {
        emails = await client.outlook.searchMessages(source.value, { top: 10 });
      } else if (source.type === 'sender') {
        emails = await client.outlook.listMessages({
          filter: `from/emailAddress/address eq '${source.value}'`,
          top: 10,
        });
      }

      for (const email of emails?.value || []) {
        context.emails.push({
          subject: email.subject || '',
          from: email.from?.emailAddress?.address || '',
          date: email.receivedDateTime || '',
          preview: email.bodyPreview || '',
        });
      }
    } catch (error) {
      console.error(`Failed to fetch Outlook source: ${source.value}`, error);
    }
  }

  // Gather Teams messages
  for (const source of config.teams) {
    try {
      if (source.type === 'channel' && source.teamId && source.channelId) {
        const messages = await client.teams.listChannelMessages(
          source.teamId,
          source.channelId,
          { top: 10 }
        );

        for (const msg of messages.value) {
          context.teamsMessages.push({
            from: msg.from?.user?.displayName || '',
            content: msg.body?.content?.replace(/<[^>]*>/g, '') || '',
            channel: source.displayName,
            date: msg.createdDateTime || '',
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch Teams source: ${source.displayName}`, error);
    }
  }

  return context;
}
```

### Integration with Claude

Modify the agent prompt to include dataweb context:

```typescript
// In server-sdk.ts or server.ts

async function buildSystemPrompt(
  projectId: string,
  mode: string
): Promise<string> {
  let prompt = baseSystemPrompt;

  // Load dataweb context if configured
  const datawebConfig = await loadDatawebConfig(projectId);
  if (datawebConfig) {
    const client = createMicrosoftClientFromEnv();
    const context = await gatherDatawebContext(client, datawebConfig);

    prompt += `\n\n## Project Dataweb Context\n\n`;
    prompt += `The following information is linked to this project:\n\n`;

    if (context.files.length > 0) {
      prompt += `### Recent Files\n`;
      for (const file of context.files.slice(0, 10)) {
        prompt += `- ${file.name} (modified: ${file.modifiedAt})\n`;
      }
      prompt += `\n`;
    }

    if (context.emails.length > 0) {
      prompt += `### Recent Emails\n`;
      for (const email of context.emails.slice(0, 5)) {
        prompt += `- "${email.subject}" from ${email.from} (${email.date})\n`;
      }
      prompt += `\n`;
    }

    if (context.teamsMessages.length > 0) {
      prompt += `### Recent Teams Discussions\n`;
      for (const msg of context.teamsMessages.slice(0, 5)) {
        prompt += `- [${msg.channel}] ${msg.from}: ${msg.content.substring(0, 100)}...\n`;
      }
    }
  }

  return prompt;
}
```

---

## Part 6: Implementation Phases

### Phase 1: Foundation (1-2 days)

1. **Create dataweb storage** (`services/datawebStorage.ts`)
   - JSON file-based storage
   - Load/save functions

2. **Add API endpoints** (`server.ts`)
   - GET/POST dataweb config
   - Discover endpoint

3. **Basic UI** (`components/DatawebModal.tsx`)
   - Modal structure
   - Source list display

### Phase 2: SharePoint Integration (1-2 days)

1. **Auto-discovery service** (`services/datawebDiscovery.ts`)
   - Search by project name
   - Search by client name
   - Check common paths

2. **Discovery UI**
   - Show discovered folders
   - Add to configuration

3. **Manual folder picker**
   - Browse SharePoint
   - Path input

### Phase 3: Outlook & Teams (1-2 days)

1. **Outlook source configuration**
   - Search query input
   - Sender filter
   - Days back selection

2. **Teams source configuration**
   - Team/channel selector
   - Load user's teams

3. **Source previews**
   - Show sample results

### Phase 4: Context Integration (1 day)

1. **Context gathering service**
   - Aggregate from all sources
   - Cache results

2. **Claude prompt integration**
   - Include context in system prompt
   - Tool for on-demand refresh

### Phase 5: Polish (1 day)

1. **Error handling**
   - Permission errors
   - Missing sources

2. **Performance**
   - Lazy loading
   - Caching

3. **UX improvements**
   - Loading states
   - Confirmation dialogs

---

## Part 7: File Structure

```
apps/
├── teamwork_frontend/
│   ├── components/
│   │   ├── DatawebModal.tsx        # Main configuration modal
│   │   ├── DatawebButton.tsx       # Header button
│   │   ├── SourceCard.tsx          # Individual source display
│   │   ├── DiscoveryCard.tsx       # Discovery result card
│   │   └── SourcePicker/
│   │       ├── SharePointPicker.tsx
│   │       ├── OutlookPicker.tsx
│   │       └── TeamsPicker.tsx
│   ├── services/
│   │   ├── datawebService.ts       # Frontend API client
│   │   └── datawebDiscovery.ts     # Discovery logic
│   └── types/
│       └── dataweb.ts              # Type definitions
│
├── microsoft_365_api_client/
│   └── src/
│       └── dataweb/                # (Optional) Dataweb-specific helpers
│           └── discovery.ts
│
└── dataweb_configs/                # JSON storage (gitignored)
    ├── proj-805682.json
    └── proj-804926.json

.claude/skills/
└── manage-dataweb/                 # Claude skill for dataweb
    ├── SKILL.md
    └── workflows/
        ├── configure-project.md
        ├── discover-sources.md
        └── gather-context.md
```

---

## Part 8: Security Considerations

### Permissions

- Dataweb only accesses sources the authenticated user can access
- No elevation of privileges
- Respect Microsoft 365 permissions

### Token Security

- Access tokens stored in memory only
- Automatic refresh handled by client
- No token persistence to disk

### Data Handling

- Context is gathered on-demand
- No long-term caching of file contents
- Only metadata and previews stored

---

## Part 9: Future Enhancements

### Potential Extensions

1. **Smart suggestions** - Suggest sources based on project activity
2. **Notifications** - Alert when linked sources have new content
3. **Full-text search** - Search within linked files
4. **Version tracking** - Track file changes over time
5. **Sharing** - Share dataweb configs with team members
6. **Templates** - Standard configurations for project types

### Integration Points

1. **Notion** - Link Notion databases
2. **Google Workspace** - Drive, Gmail, Calendar
3. **Slack** - Channels and threads
4. **GitHub** - Repositories and issues

---

## Summary

The Dataweb creates an intelligent link between Teamwork projects and Microsoft 365 data sources. Key features:

1. **Auto-discovery** - Finds related SharePoint folders automatically
2. **Configurable** - Users control what data is linked
3. **Context-aware** - Claude automatically has access to relevant info
4. **Extensible** - Can add more sources (Outlook, Teams, etc.)

This transforms project work from manual context-gathering to having relevant information ready when needed.
