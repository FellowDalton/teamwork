import React, { useState, useEffect } from 'react';
import { Layout, Plus, MessageSquare, HelpCircle } from 'lucide-react';
import { ConversationPanel } from './components/ConversationPanel';
import { DataDisplayPanel } from './components/DataDisplayPanel';
import { ConversationMode, ChatMessage } from './types/conversation';
import { useStreamingChat } from './hooks/useStreamingChat';

// =============================================================================
// MODE CONFIGURATION
// Customize these for your specific use case
// =============================================================================

const MODES: Array<{
  id: ConversationMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  welcomeMessage: string;
}> = [
  {
    id: 'create',
    label: 'OUTLINE',
    icon: <Plus size={14} />,
    color: 'bg-purple-600 hover:bg-purple-500',
    welcomeMessage: 'Outline mode active. Describe what you want to outline and I\'ll build the structure progressively.\n\nTry: "Create an outline for a blog post about learning to code"',
  },
  {
    id: 'query',
    label: 'HELP',
    icon: <HelpCircle size={14} />,
    color: 'bg-cyan-600 hover:bg-cyan-500',
    welcomeMessage: 'Help mode active. Ask me about outlining, organization, or structure.',
  },
  {
    id: 'general',
    label: 'CHAT',
    icon: <MessageSquare size={14} />,
    color: 'bg-zinc-600 hover:bg-zinc-500',
    welcomeMessage: 'How can I help you today?',
  },
];

// =============================================================================
// MAIN APP COMPONENT
// =============================================================================

function App() {
  const [activeMode, setActiveMode] = useState<ConversationMode>('general');

  const {
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
  } = useStreamingChat({
    mode: activeMode,
  });

  // Reset conversation when mode changes
  useEffect(() => {
    clearDraft();

    const modeConfig = MODES.find((m) => m.id === activeMode);
    const welcomeMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: modeConfig?.welcomeMessage || 'How can I help?',
      timestamp: new Date().toISOString(),
      mode: activeMode,
    };

    setMessages([welcomeMsg]);
  }, [activeMode, clearDraft, setMessages]);

  const handleModeChange = (mode: ConversationMode) => {
    if (activeMode === mode && mode !== 'general') {
      setActiveMode('general');
    } else {
      setActiveMode(mode);
    }
  };

  const currentModeConfig = MODES.find((m) => m.id === activeMode);

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 flex items-center px-6 gap-6">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <Layout className="text-zinc-400" size={20} />
          </div>
          <div>
            <h1 className="font-bold text-lg text-zinc-200">Outline Builder</h1>
            <p className="text-xs text-zinc-500">Chat + Progressive Display Template</p>
          </div>
        </div>

        <div className="h-8 w-px bg-zinc-800" />

        {/* Mode Buttons */}
        <div className="flex gap-2">
          {MODES.map((mode) => (
            <button
              key={mode.id}
              onClick={() => handleModeChange(mode.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeMode === mode.id
                  ? `${mode.color} text-white`
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
              }`}
            >
              {mode.icon}
              <span>{mode.label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Status */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 border border-zinc-700">
          <div
            className={`w-2 h-2 rounded-full ${
              isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-green-500'
            }`}
          />
          <span className="text-xs text-zinc-400 font-mono">
            {isProcessing ? 'PROCESSING' : currentModeConfig?.label || 'READY'}
          </span>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden p-6 gap-6">
        {/* Left: Conversation Panel */}
        <div className="flex-1 min-w-0 h-full">
          <ConversationPanel
            messages={messages}
            onSend={sendMessage}
            mode={activeMode}
            isProcessing={isProcessing}
            thinkingStatus={thinkingStatus}
            inputValue={inputValue}
            onInputChange={setInputValue}
          />
        </div>

        {/* Right: Data Display Panel */}
        <div className="flex-1 min-w-0 h-full">
          <DataDisplayPanel
            data={null}
            draftData={draft}
            onDraftSubmit={submitCurrentDraft}
            isSubmitting={isSubmitting}
            onUpdateSection={updateDraftSection}
            onUpdateItem={updateDraftItem}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
