import { useState, useCallback } from 'react';
import { ChatMessage, ConversationMode, DraftData, DraftSection, DraftItem, DraftUpdateEvent } from '../types/conversation';
import { processStream, submitDraft } from '../services/streamingService';

interface UseStreamingChatOptions {
  mode: ConversationMode;
  onDraftCreated?: (draft: DraftData) => void;
}

interface UseStreamingChatReturn {
  messages: ChatMessage[];
  inputValue: string;
  setInputValue: (value: string) => void;
  isProcessing: boolean;
  thinkingStatus: string;
  draft: DraftData | null;
  isSubmitting: boolean;
  sendMessage: (content: string) => Promise<void>;
  submitCurrentDraft: () => Promise<void>;
  updateDraftSection: (sectionId: string, updates: Partial<DraftSection>) => void;
  updateDraftItem: (sectionId: string, itemId: string, updates: Partial<DraftItem>) => void;
  clearDraft: () => void;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function useStreamingChat(options: UseStreamingChatOptions): UseStreamingChatReturn {
  const { mode, onDraftCreated } = options;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState('');
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
        mode,
      };
      setMessages((prev) => [...prev, userMsg]);
      setInputValue('');
      setIsProcessing(true);
      setThinkingStatus('');

      // Build conversation history
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let accumulatedThinking = '';

      try {
        await processStream({
          message: content,
          mode,
          conversationHistory: history.length > 0 ? history : undefined,
          onChunk: () => {
            // Text chunks are accumulated in processStream
          },
          onThinking: (thinking) => {
            accumulatedThinking += thinking;
            setThinkingStatus(accumulatedThinking);
          },
          onDraft: (newDraft) => {
            setDraft(newDraft);
            onDraftCreated?.(newDraft);
          },
          onDraftUpdate: (update: DraftUpdateEvent) => {
            setDraft((prev) => {
              if (!prev) return prev;

              switch (update.action) {
                case 'add_section':
                  if (update.section) {
                    return {
                      ...prev,
                      sections: [...prev.sections, { ...update.section, items: [] }],
                      summary: {
                        ...prev.summary,
                        totalSections: prev.summary.totalSections + 1,
                      },
                    };
                  }
                  break;

                case 'add_item':
                  if (update.sectionId && update.item) {
                    return {
                      ...prev,
                      sections: prev.sections.map((s) =>
                        s.id === update.sectionId
                          ? { ...s, items: [...s.items, { ...update.item!, children: [] }] }
                          : s
                      ),
                      summary: {
                        ...prev.summary,
                        totalItems: prev.summary.totalItems + 1,
                      },
                    };
                  }
                  break;

                case 'add_subitem':
                  if (update.itemId && update.subitems) {
                    return {
                      ...prev,
                      sections: prev.sections.map((s) => ({
                        ...s,
                        items: s.items.map((i) =>
                          i.id === update.itemId
                            ? { ...i, children: [...(i.children || []), ...update.subitems!] }
                            : i
                        ),
                      })),
                      summary: {
                        ...prev.summary,
                        totalSubItems: prev.summary.totalSubItems + update.subitems.length,
                      },
                    };
                  }
                  break;
              }
              return prev;
            });
          },
          onDraftComplete: (message) => {
            setDraft((prev) =>
              prev
                ? {
                    ...prev,
                    message: message || prev.message,
                    isBuilding: false,
                  }
                : prev
            );
          },
          onComplete: (fullText) => {
            setThinkingStatus('');
            const responseContent = fullText || 'Done.';

            const aiMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: responseContent,
              timestamp: new Date().toISOString(),
              mode,
            };
            setMessages((prev) => [...prev, aiMsg]);
            setIsProcessing(false);
          },
          onError: (error) => {
            console.error('Stream error:', error);
            const errorMsg: ChatMessage = {
              id: `msg-${Date.now()}`,
              role: 'assistant',
              content: 'An error occurred while processing your request.',
              timestamp: new Date().toISOString(),
              mode,
            };
            setMessages((prev) => [...prev, errorMsg]);
            setIsProcessing(false);
          },
        });
      } catch (error) {
        console.error('Chat error:', error);
        setIsProcessing(false);
      }
    },
    [messages, mode, onDraftCreated]
  );

  const submitCurrentDraft = useCallback(async () => {
    if (!draft) return;

    setIsSubmitting(true);
    try {
      const result = await submitDraft(draft);

      setDraft({
        ...draft,
        isSubmitted: true,
        submittedUrl: result.url,
      });

      const successMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: result.message + (result.url ? `\n\n[View Result](${result.url})` : ''),
        timestamp: new Date().toISOString(),
        mode,
      };
      setMessages((prev) => [...prev, successMsg]);
    } catch (error) {
      console.error('Submit error:', error);
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: `Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString(),
        mode,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSubmitting(false);
    }
  }, [draft, mode]);

  const updateDraftSection = useCallback((sectionId: string, updates: Partial<DraftSection>) => {
    setDraft((prev) =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
          }
        : prev
    );
  }, []);

  const updateDraftItem = useCallback(
    (sectionId: string, itemId: string, updates: Partial<DraftItem>) => {
      setDraft((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.id === sectionId
                  ? {
                      ...s,
                      items: s.items.map((i) => (i.id === itemId ? { ...i, ...updates } : i)),
                    }
                  : s
              ),
            }
          : prev
      );
    },
    []
  );

  const clearDraft = useCallback(() => {
    setDraft(null);
  }, []);

  return {
    messages,
    inputValue,
    setInputValue,
    isProcessing,
    thinkingStatus,
    draft,
    isSubmitting,
    sendMessage,
    submitCurrentDraft,
    updateDraftSection,
    updateDraftItem,
    clearDraft,
    setMessages,
  };
}
