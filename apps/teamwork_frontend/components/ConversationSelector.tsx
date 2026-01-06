import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { MessageSquare, Search, Plus, ChevronDown, Trash2, Clock, Folder, FileEdit } from 'lucide-react';
import type { Conversation, ConversationTopic } from '../types/supabase';
import {
  getConversationsByTopic,
  createConversation,
  deleteConversation,
  searchConversations,
} from '../services/supabaseService';
import { useAuth } from '../contexts/AuthContext';

interface ConversationSelectorProps {
  currentConversationId: string | null;
  onSelectConversation: (conversation: Conversation | null) => void;
  onNewConversation: (conversation: Conversation) => void;
  filterTopic?: ConversationTopic;
  isLight?: boolean;
  className?: string;
}

const TOPIC_LABELS: Record<ConversationTopic, string> = {
  project: 'Projects',
  status: 'Status',
  timelog: 'Time Logs',
  general: 'General',
};

const TOPIC_LABELS_SINGULAR: Record<ConversationTopic, string> = {
  project: 'Project',
  status: 'Status',
  timelog: 'Time Log',
  general: 'General',
};

const TOPIC_LED_COLORS: Record<ConversationTopic, string> = {
  project: 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.6)]',
  status: 'bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]',
  timelog: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]',
  general: 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]',
};

const TOPIC_ICONS: Record<ConversationTopic, React.ReactNode> = {
  project: <Folder className="w-3.5 h-3.5" />,
  status: <Clock className="w-3.5 h-3.5" />,
  timelog: <Clock className="w-3.5 h-3.5" />,
  general: <MessageSquare className="w-3.5 h-3.5" />,
};

export function ConversationSelector({
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  filterTopic,
  isLight = false,
  className = '',
}: ConversationSelectorProps) {
  const { isAuthenticated, isConfigured } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversations, setConversations] = useState<Record<ConversationTopic, Conversation[]>>({
    project: [],
    status: [],
    timelog: [],
    general: [],
  });
  const [searchResults, setSearchResults] = useState<Conversation[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Find current conversation from all conversations
  const currentConversation = useMemo(() => {
    if (!currentConversationId) return null;
    for (const topic of Object.keys(conversations) as ConversationTopic[]) {
      const found = conversations[topic].find((c) => c.id === currentConversationId);
      if (found) return found;
    }
    return null;
  }, [currentConversationId, conversations]);

  // Get filtered conversations based on filterTopic
  const filteredConversations = useMemo(() => {
    if (!filterTopic) return conversations;
    return {
      project: filterTopic === 'project' ? conversations.project : [],
      status: filterTopic === 'status' ? conversations.status : [],
      timelog: filterTopic === 'timelog' ? conversations.timelog : [],
      general: filterTopic === 'general' ? conversations.general : [],
    };
  }, [conversations, filterTopic]);

  // Load conversations on mount
  useEffect(() => {
    if (!isAuthenticated || !isConfigured) return;

    const loadConversations = async () => {
      setIsLoading(true);
      try {
        const grouped = await getConversationsByTopic();
        setConversations(grouped);
      } catch (error) {
        console.error('Error loading conversations:', error);
      }
      setIsLoading(false);
    };

    loadConversations();
  }, [isAuthenticated, isConfigured]);

  // Search conversations
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const results = await searchConversations(searchQuery);
        // Filter search results by topic if filter is set
        const filtered = filterTopic
          ? results.filter((c) => c.topic === filterTopic)
          : results;
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching conversations:', error);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, filterTopic]);

  // Handle creating a new conversation
  const handleNewConversation = useCallback(async () => {
    setIsOpen(false);
    const topic = filterTopic || 'general';

    try {
      const newConv = await createConversation(topic);
      if (newConv) {
        // Update local state
        setConversations((prev) => ({
          ...prev,
          [topic]: [newConv, ...prev[topic]],
        }));
        onNewConversation(newConv);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    }
  }, [filterTopic, onNewConversation]);

  // Handle deleting a conversation
  const handleDelete = useCallback(async (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();

    if (!confirm('Delete this conversation?')) return;

    try {
      const success = await deleteConversation(conv.id);
      if (success) {
        setConversations((prev) => ({
          ...prev,
          [conv.topic]: prev[conv.topic].filter((c) => c.id !== conv.id),
        }));

        if (currentConversationId === conv.id) {
          onSelectConversation(null);
        }
      }
    } catch (error) {
      console.error('Error deleting conversation:', error);
    }
  }, [currentConversationId, onSelectConversation]);

  // Handle selecting a conversation
  const handleSelect = useCallback((conv: Conversation) => {
    setIsOpen(false);
    setSearchQuery('');
    setSearchResults(null);
    onSelectConversation(conv);
  }, [onSelectConversation]);

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Don't render if not configured/authenticated
  if (!isConfigured || !isAuthenticated) {
    return null;
  }

  const displayConversations = searchResults !== null ? searchResults : null;
  const hasConversations = filterTopic
    ? filteredConversations[filterTopic].length > 0
    : Object.values(filteredConversations).some((list) => list.length > 0);
  const conversationCount = filterTopic
    ? filteredConversations[filterTopic].length
    : Object.values(filteredConversations).reduce((sum, list) => sum + list.length, 0);

  // Get current topic LED color
  const currentLedColor = filterTopic
    ? TOPIC_LED_COLORS[filterTopic]
    : currentConversation
      ? TOPIC_LED_COLORS[currentConversation.topic]
      : TOPIC_LED_COLORS.general;

  return (
    <div className={`relative ${className}`}>
      {/* Trigger button - hardware panel style */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          flex items-center gap-2 px-2.5 py-1.5 rounded
          ${isLight
            ? 'bg-zinc-200 hover:bg-zinc-300 border border-zinc-300'
            : 'bg-black/40 hover:bg-black/60 border border-zinc-700 shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]'
          }
          transition-colors cursor-pointer
        `}
      >
        {/* LED indicator */}
        <div className={`w-1.5 h-1.5 rounded-full ${currentLedColor}`} />

        {/* Title */}
        <span className={`
          text-[10px] font-mono uppercase tracking-wider truncate max-w-[100px]
          ${isLight ? 'text-zinc-600' : 'text-zinc-400'}
        `}>
          {currentConversation?.title || 'New'}
        </span>

        {/* Chevron */}
        <ChevronDown
          className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''} ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}
        />
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Panel - hardware panel style */}
          <div className={`
            absolute right-0 mt-2 w-72 z-20 max-h-[60vh] flex flex-col
            ${isLight
              ? 'bg-zinc-100 border border-zinc-300 shadow-lg'
              : 'bg-[#18181b] border border-zinc-800 shadow-2xl shadow-black/50'
            }
            rounded-lg overflow-hidden
          `}>
            {/* Header */}
            <div className={`
              px-3 py-2.5 border-b
              ${isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-[#27272a] border-zinc-800'}
            `}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${currentLedColor}`} />
                  <span className={`text-[9px] font-mono font-bold uppercase tracking-widest ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {filterTopic ? `${TOPIC_LABELS[filterTopic]} Conversations` : 'All Conversations'}
                  </span>
                </div>
                <span className={`text-[9px] font-mono ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  {conversationCount}
                </span>
              </div>
            </div>

            {/* Search bar */}
            <div className={`p-2 border-b ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
              <div className="relative">
                <Search className={`absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={`
                    w-full pl-8 pr-3 py-1.5 text-xs rounded
                    ${isLight
                      ? 'bg-white border border-zinc-300 text-zinc-700 placeholder-zinc-400'
                      : 'bg-black/40 border border-zinc-700 text-zinc-300 placeholder-zinc-500'
                    }
                    focus:outline-none focus:ring-1 focus:ring-cyan-500/50
                  `}
                />
              </div>
            </div>

            {/* New conversation button */}
            <div className={`p-2 border-b ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
              <button
                onClick={handleNewConversation}
                className={`
                  flex items-center gap-2 w-full px-2.5 py-2 rounded text-xs font-medium
                  ${isLight
                    ? 'text-cyan-700 hover:bg-cyan-100'
                    : 'text-cyan-400 hover:bg-cyan-500/10'
                  }
                  transition-colors
                `}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New {filterTopic ? TOPIC_LABELS_SINGULAR[filterTopic] : ''} Conversation</span>
              </button>
            </div>

            {/* Conversation list */}
            <div className="flex-1 overflow-y-auto p-2">
              {isLoading ? (
                <div className={`text-center py-4 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Loading...
                </div>
              ) : displayConversations !== null ? (
                // Search results
                displayConversations.length > 0 ? (
                  <div className="space-y-1">
                    {displayConversations.map((conv) => (
                      <ConversationItem
                        key={conv.id}
                        conversation={conv}
                        isSelected={conv.id === currentConversationId}
                        onSelect={() => handleSelect(conv)}
                        onDelete={(e) => handleDelete(e, conv)}
                        formatDate={formatDate}
                        isLight={isLight}
                        showTopicBadge={!filterTopic}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={`text-center py-4 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                    No conversations found
                  </div>
                )
              ) : hasConversations ? (
                // Grouped by topic (or single topic if filtered)
                <div className="space-y-3">
                  {(filterTopic ? [filterTopic] : Object.keys(TOPIC_LABELS) as ConversationTopic[]).map((topic) =>
                    filteredConversations[topic].length > 0 ? (
                      <div key={topic}>
                        {!filterTopic && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 text-[9px] font-mono font-semibold uppercase tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                            <div className={`w-1 h-1 rounded-full ${TOPIC_LED_COLORS[topic]}`} />
                            {TOPIC_LABELS[topic]}
                          </div>
                        )}
                        <div className="space-y-0.5">
                          {filteredConversations[topic].map((conv) => (
                            <ConversationItem
                              key={conv.id}
                              conversation={conv}
                              isSelected={conv.id === currentConversationId}
                              onSelect={() => handleSelect(conv)}
                              onDelete={(e) => handleDelete(e, conv)}
                              formatDate={formatDate}
                              isLight={isLight}
                              showTopicBadge={false}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null
                  )}
                </div>
              ) : (
                <div className={`text-center py-6 ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p className="text-[10px] font-mono uppercase tracking-wider">
                    No {filterTopic ? TOPIC_LABELS[filterTopic].toLowerCase() : 'conversations'}
                  </p>
                  <p className="text-[9px] mt-1 opacity-60">
                    Start chatting to create one
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (e: React.MouseEvent) => void;
  formatDate: (date: string) => string;
  isLight: boolean;
  showTopicBadge: boolean;
}

function ConversationItem({
  conversation,
  isSelected,
  onSelect,
  onDelete,
  formatDate,
  isLight,
  showTopicBadge,
}: ConversationItemProps) {
  const isDraft = (conversation as any).status === 'draft';

  return (
    <button
      onClick={onSelect}
      className={`
        group flex items-center gap-2 w-full px-2.5 py-2 text-left rounded transition-colors
        ${isSelected
          ? isLight
            ? 'bg-cyan-100 text-cyan-700 border border-cyan-300'
            : 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
          : isLight
            ? 'hover:bg-zinc-200 text-zinc-700'
            : 'hover:bg-zinc-800 text-zinc-300'
        }
      `}
    >
      {/* Topic LED (small) */}
      {showTopicBadge && (
        <div className={`w-1 h-1 rounded-full ${TOPIC_LED_COLORS[conversation.topic]}`} />
      )}

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-xs font-medium truncate">
            {conversation.title || 'Untitled'}
          </p>
          {isDraft && (
            <span className={`
              flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-mono uppercase
              ${isLight ? 'bg-amber-100 text-amber-700' : 'bg-amber-500/20 text-amber-400'}
            `}>
              <FileEdit className="w-2.5 h-2.5" />
              Draft
            </span>
          )}
        </div>
        <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
          {formatDate(conversation.updated_at)}
        </p>
      </div>

      <button
        onClick={onDelete}
        className={`
          p-1 opacity-0 group-hover:opacity-100 rounded transition-all
          ${isLight ? 'hover:bg-red-100' : 'hover:bg-red-500/20'}
        `}
        title="Delete"
      >
        <Trash2 className="w-3.5 h-3.5 text-red-500" />
      </button>
    </button>
  );
}

export default ConversationSelector;
