import React, { useRef, useEffect } from 'react';
import { Bot, User, Sparkles, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ConversationMode } from '../types/conversation';

interface ConversationPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  mode: ConversationMode;
  isProcessing: boolean;
  thinkingStatus?: string;
  inputValue: string;
  onInputChange: (value: string) => void;
}

// Mode configuration - customize these for your use case
const MODE_CONFIG: Record<ConversationMode, { label: string; color: string; placeholder: string }> = {
  create: {
    label: 'CREATE',
    color: 'bg-purple-500',
    placeholder: 'Describe what you want to create...',
  },
  query: {
    label: 'QUERY',
    color: 'bg-cyan-500',
    placeholder: 'Ask a question...',
  },
  general: {
    label: 'CHAT',
    color: 'bg-blue-500',
    placeholder: 'Type a message...',
  },
};

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  onSend,
  mode,
  isProcessing,
  thinkingStatus,
  inputValue,
  onInputChange,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);

  const config = MODE_CONFIG[mode];

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-scroll thinking container
  useEffect(() => {
    if (thinkingRef.current) {
      thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
    }
  }, [thinkingStatus]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() && !isProcessing) {
        onSend(inputValue.trim());
      }
    }
  };

  const handleSend = () => {
    if (inputValue.trim() && !isProcessing) {
      onSend(inputValue.trim());
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
      {/* Header */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${config.color}`} />
          <span className="text-xs font-medium text-zinc-300 uppercase tracking-wider">
            {config.label}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {messages.length} messages
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <Bot size={32} className="mb-3 opacity-30" />
            <p className="text-sm">Awaiting input</p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                msg.role === 'user'
                  ? 'bg-blue-900/30 border border-blue-700'
                  : msg.isThinking
                  ? 'bg-amber-900/20 border border-amber-800'
                  : 'bg-cyan-900/20 border border-cyan-700'
              }`}
            >
              {msg.role === 'user' ? (
                <User size={14} className="text-blue-400" />
              ) : (
                <Sparkles
                  size={14}
                  className={msg.isThinking ? 'text-amber-400' : 'text-cyan-400'}
                />
              )}
            </div>

            {/* Message */}
            <div
              className={`max-w-[80%] p-3 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'bg-zinc-800 text-zinc-100'
                  : msg.isThinking
                  ? 'bg-amber-900/10 text-amber-300/80 italic'
                  : 'bg-zinc-800/50 text-zinc-300'
              }`}
            >
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ children }) => (
                      <code className="px-1 py-0.5 rounded bg-zinc-700 text-xs">{children}</code>
                    ),
                    pre: ({ children }) => (
                      <pre className="p-2 rounded bg-zinc-700 overflow-x-auto text-xs mb-2">
                        {children}
                      </pre>
                    ),
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center bg-cyan-900/20 border border-cyan-800">
              <Sparkles size={14} className="text-cyan-400" />
            </div>
            <div className="flex-1 p-3 rounded-lg bg-zinc-800/50">
              {thinkingStatus ? (
                <div ref={thinkingRef} className="max-h-32 overflow-y-auto">
                  <p className="text-xs text-cyan-400 whitespace-pre-wrap font-mono">
                    {thinkingStatus}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-800/30">
        <div className="flex items-center gap-2 p-2 rounded-lg bg-zinc-800 border border-zinc-700 focus-within:border-cyan-500/50">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={config.placeholder}
            disabled={isProcessing}
            className="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder:text-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isProcessing}
            className={`p-2 rounded-md transition-all ${
              !inputValue.trim() || isProcessing
                ? 'opacity-30 cursor-not-allowed'
                : 'bg-cyan-600 hover:bg-cyan-500 cursor-pointer'
            }`}
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};
