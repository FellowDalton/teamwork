import React, { useRef, useEffect } from 'react';
import { Bot, User, Sparkles, Command, ChevronRight, CheckCircle2, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage, ConversationTopic } from '../types/conversation';

// Convert bullet characters to markdown list syntax
const normalizeMarkdown = (text: string): string => {
  // Split into lines and process
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;
  
  for (const line of lines) {
    // Check if line starts with bullet
    if (/^[•●]\s*/.test(line.trim())) {
      if (!inList && result.length > 0) {
        result.push(''); // Add blank line before list
      }
      inList = true;
      result.push(line.trim().replace(/^[•●]\s*/, '- '));
    } 
    // Check if line contains inline bullets (like "• item1 • item2")
    else if (/[•●]/.test(line)) {
      if (!inList && result.length > 0) {
        result.push('');
      }
      inList = true;
      // Split by bullet and create list items
      const parts = line.split(/\s*[•●]\s*/).filter(p => p.trim());
      for (const part of parts) {
        result.push('- ' + part.trim());
      }
    }
    else {
      if (inList && line.trim()) {
        result.push(''); // Add blank line after list
      }
      inList = false;
      result.push(line);
    }
  }
  
  return result.join('\n');
};

interface ConversationPanelProps {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  topic: ConversationTopic;
  isProcessing: boolean;
  thinkingStatus?: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  projectName?: string;
  theme?: 'light' | 'dark';
}

// Screw component for hardware aesthetic
const Screw = ({ isLight }: { isLight: boolean }) => (
  <div className={`w-2 h-2 rounded-full border ${isLight ? 'border-zinc-400 bg-zinc-300' : 'border-zinc-700 bg-zinc-800'} flex items-center justify-center opacity-70`}>
    <div className={`w-1 h-[1px] ${isLight ? 'bg-zinc-500' : 'bg-zinc-600'} transform -rotate-45`}></div>
  </div>
);

export const ConversationPanel: React.FC<ConversationPanelProps> = ({
  messages,
  onSend,
  topic,
  isProcessing,
  thinkingStatus,
  inputValue,
  onInputChange,
  projectName,
  theme = 'dark'
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isLight = theme === 'light';

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  // Get topic label
  const getTopicLabel = () => {
    const labels: Record<ConversationTopic, string> = {
      project: 'NEW PROJECT',
      status: 'STATUS',
      timelog: 'TIME LOG',
      general: 'CHAT'
    };
    return labels[topic] || 'CHAT';
  };

  // Get topic LED color
  const getTopicLed = () => {
    const colors: Record<ConversationTopic, string> = {
      project: 'bg-purple-500 shadow-[0_0_4px_rgba(168,85,247,0.6)]',
      status: 'bg-cyan-500 shadow-[0_0_4px_rgba(6,182,212,0.6)]',
      timelog: 'bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]',
      general: 'bg-blue-500 shadow-[0_0_4px_rgba(59,130,246,0.6)]'
    };
    return colors[topic] || colors.general;
  };

  // Get placeholder based on topic
  const getPlaceholder = () => {
    const placeholders: Record<ConversationTopic, string> = {
      project: 'Describe the project you want to create...',
      status: 'Ask about project status, progress, or metrics...',
      timelog: 'Log time or ask about time entries...',
      general: 'Type a command or ask a question...'
    };
    return placeholders[topic] || placeholders.general;
  };

  // Styles
  const panelBg = isLight ? 'bg-[#e4e4e7]' : 'bg-[#18181b]';
  const panelBorder = isLight ? 'border-[#d4d4d8]' : 'border-[#27272a]';
  const headerBg = isLight ? 'bg-[#d4d4d8]' : 'bg-[#27272a]';
  const headerBorder = isLight ? 'border-[#a1a1aa]' : 'border-black';
  const contentBg = isLight ? 'bg-[#f4f4f5]' : 'bg-[#09090b]';
  const inputBg = isLight ? 'bg-white border-zinc-300' : 'bg-[#18181b] border-amber-900/50';
  const textPrimary = isLight ? 'text-zinc-800' : 'text-zinc-200';
  const textSecondary = isLight ? 'text-zinc-500' : 'text-zinc-500';
  const accentColor = isLight ? 'text-cyan-600' : 'text-cyan-400';

  return (
    <div className={`
      flex-1 flex flex-col h-full
      rounded-lg border-[2px] overflow-hidden
      ${panelBg} ${panelBorder}
      ${isLight ? 'shadow-lg' : 'shadow-2xl'}
    `}>
      {/* Panel Header (Module Faceplate style) */}
      <div className={`
        h-11 flex items-center justify-between px-3 border-b
        ${headerBg} ${headerBorder}
      `}>
        <div className="flex items-center gap-2.5">
          <Screw isLight={isLight} />
          <div className={`flex items-center gap-2 ${isLight ? 'bg-zinc-200 shadow-sm' : 'bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]'} rounded px-2 py-1`}>
            <div className={`w-1.5 h-1.5 rounded-full ${getTopicLed()}`}></div>
            <h3 className={`font-mono text-[10px] font-bold uppercase tracking-widest leading-none ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
              {getTopicLabel()}
            </h3>
          </div>
          {projectName && (
            <span className={`text-[10px] font-mono ${textSecondary} truncate max-w-32`}>
              • {projectName}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className={`font-mono text-[9px] ${textSecondary}`}>
            {messages.length} MSG
          </span>
          <Screw isLight={isLight} />
        </div>
      </div>

      {/* Message Area (Recessed Content) */}
      <div className={`
        flex-1 overflow-y-auto p-4 space-y-4
        ${isLight ? 'custom-scrollbar-light' : 'custom-scrollbar-dark'}
        ${contentBg}
        ${isLight ? 'shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]' : 'shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]'}
      `}>
        {messages.length === 0 && (
          <div className={`flex flex-col items-center justify-center h-full ${textSecondary}`}>
            <Bot size={32} className="mb-3 opacity-30" />
            <p className="text-xs uppercase tracking-widest">Awaiting Input</p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            {/* Avatar */}
            <div className={`
              w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border
              ${msg.role === 'user'
                ? (isLight ? 'bg-cyan-100 border-cyan-200' : 'bg-amber-900/30 border-amber-700')
                : msg.isThought
                  ? (isLight ? 'bg-amber-100 border-amber-200' : 'bg-amber-900/20 border-amber-800')
                  : (isLight ? 'bg-cyan-50 border-cyan-200' : 'bg-cyan-900/20 border-cyan-700')
              }
            `}>
              {msg.role === 'user'
                ? <User size={12} className={isLight ? 'text-cyan-600' : 'text-amber-400'} />
                : <Sparkles size={12} className={msg.isThought ? (isLight ? 'text-amber-600' : 'text-amber-400') : accentColor} />
              }
            </div>

            {/* Message Bubble */}
            <div className={`
              max-w-[85%] p-4 rounded-lg text-[13px] border shadow-sm leading-[1.6]
              ${msg.role === 'user'
                ? (isLight ? 'bg-zinc-100 text-zinc-800 border-zinc-300' : 'bg-zinc-800 text-zinc-100 border-zinc-700')
                : msg.isThought
                  ? (isLight ? 'bg-amber-50 text-amber-700 border-amber-200 italic' : 'bg-amber-900/10 text-amber-300/80 border-amber-800/50 italic')
                  : (isLight ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-[#1a1a1c] text-zinc-300 border-zinc-800')
              }
            `}>
              {msg.role === 'assistant' ? (
                <ReactMarkdown
                  components={{
                    p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
                    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                    em: ({ children }) => <em className="italic">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc pl-5 mb-3 space-y-2">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-5 mb-3 space-y-2">{children}</ol>,
                    li: ({ children }) => <li className="pl-1">{children}</li>,
                    h1: ({ children }) => <h1 className="text-base font-semibold mb-3 mt-1">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 mt-1">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-[13px] font-semibold mb-2">{children}</h3>,
                    code: ({ children }) => <code className={`px-1.5 py-0.5 rounded text-[11px] font-mono ${isLight ? 'bg-zinc-100' : 'bg-zinc-800'}`}>{children}</code>,
                    pre: ({ children }) => <pre className={`p-3 rounded mb-3 overflow-x-auto text-[11px] ${isLight ? 'bg-zinc-100' : 'bg-zinc-800'}`}>{children}</pre>,
                    table: ({ children }) => <table className="w-full mb-3 text-[12px] border-collapse">{children}</table>,
                    th: ({ children }) => <th className={`text-left p-2 border-b ${isLight ? 'border-zinc-200' : 'border-zinc-700'} font-semibold`}>{children}</th>,
                    td: ({ children }) => <td className={`p-2 border-b ${isLight ? 'border-zinc-100' : 'border-zinc-800'}`}>{children}</td>,
                    hr: () => <hr className={`my-3 ${isLight ? 'border-zinc-200' : 'border-zinc-700'}`} />,
                  }}
                >
                  {normalizeMarkdown(msg.content)}
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
            <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center border ${isLight ? 'bg-cyan-100 border-cyan-200' : 'bg-cyan-900/20 border-cyan-800'}`}>
              <Sparkles size={12} className={accentColor} />
            </div>
            <div className={`flex-1 p-3 rounded-lg border ${isLight ? 'bg-white border-zinc-200' : 'bg-[#1a1a1c] border-zinc-800'}`}>
              {thinkingStatus ? (
                <div className="max-h-40 overflow-y-auto">
                  <p className={`text-xs ${accentColor} whitespace-pre-wrap break-words font-mono leading-relaxed`}>
                    {thinkingStatus}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                  <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className={`p-3 border-t ${headerBg} ${headerBorder}`}>
        <div className={`
          flex items-center gap-2 p-1 pl-3 rounded-lg border transition-all
          ${inputBg}
          ${isLight ? 'focus-within:border-cyan-500/50 focus-within:ring-1 focus-within:ring-cyan-500/20' : 'focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20'}
        `}>
          <Command size={14} className={textSecondary} />
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={getPlaceholder()}
            disabled={isProcessing}
            className={`flex-1 bg-transparent border-none focus:ring-0 outline-none h-9 text-sm ${textPrimary} placeholder:opacity-50 disabled:opacity-50`}
          />
          <button
            onClick={() => inputValue.trim() && !isProcessing && onSend(inputValue.trim())}
            disabled={!inputValue.trim() || isProcessing}
            className={`
              h-8 w-8 flex items-center justify-center rounded-md transition-all
              ${!inputValue.trim() || isProcessing ? 'opacity-30' : 'opacity-100 hover:scale-105 active:scale-95'}
              ${isLight ? 'bg-cyan-600 text-white' : 'bg-amber-600 text-white shadow-[0_0_10px_rgba(217,119,6,0.4)]'}
            `}
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
