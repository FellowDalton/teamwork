import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Sparkles, Command, CheckCircle2, ChevronRight } from 'lucide-react';
import { processChatCommand } from '../services/claudeService';
import { Project } from '../types';

interface ChatWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  activeProject: Project | null;
  allProjects: Project[];
  currentView: string;
  initialIntent?: 'general' | 'create';
  onLogWork: (taskName: string | undefined, hours: number, comment: string, isBillable: boolean) => Promise<boolean>;
  onCreateProject: (projectData: any) => void;
  theme?: 'light' | 'dark';
}

interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  type?: 'text' | 'success' | 'error' | 'system';
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({ 
  isOpen, 
  onClose, 
  activeProject, 
  allProjects,
  currentView,
  initialIntent,
  onLogWork, 
  onCreateProject,
  theme = 'dark' 
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLight = theme === 'light';

  // Initialize chat when opened
  useEffect(() => {
    if (isOpen) {
      // Focus input
      setTimeout(() => inputRef.current?.focus(), 100);

      // Reset or Add System Message based on intent
      if (messages.length === 0 || initialIntent === 'create') {
        let welcomeMsg = "System Online. I am fully synced with your workspace.";
        if (initialIntent === 'create') {
          welcomeMsg = "I see you want to initialize a new project module. Describe the project goals, and I will generate the workflow structure.";
        }
        setMessages([
          { id: 'init', sender: 'ai', text: welcomeMsg, type: 'system' }
        ]);
      }
    }
  }, [isOpen, initialIntent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), sender: 'user', text: inputValue };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setIsProcessing(true);

    try {
      // Build System Context
      const context = `
        Active Project: ${activeProject?.name || 'None'}
        Project Description: ${activeProject?.description || 'N/A'}
        Current View: ${currentView}
        Total Projects: ${allProjects.length}
        Active Project Tasks: ${activeProject ? activeProject.stages.flatMap(s => s.tasks.map(t => t.title)).join(', ') : 'None'}
      `;

      const response = await processChatCommand(userMsg.text, context);

      if (response.type === 'tool_call') {
        if (response.functionName === 'logWork') {
          const { taskName, hours, comment, isBillable } = response.args;
          const success = await onLogWork(taskName, hours, comment, isBillable !== false);
          
          if (success) {
             setMessages(prev => [...prev, { 
               id: Date.now().toString(), 
               sender: 'ai', 
               text: `Operation Confirmed: Logged ${hours}h ${isBillable !== false ? '[BILLABLE]' : '[NON-BILL]'} to "${taskName}".`,
               type: 'success'
             }]);
          } else {
             setMessages(prev => [...prev, { 
               id: Date.now().toString(), 
               sender: 'ai', 
               text: `Error: Task "${taskName}" not found. Please verify task ID or name.`,
               type: 'error'
             }]);
          }
        } else if (response.functionName === 'createProject') {
          // Pass the args directly to the App handler
          onCreateProject(response.args);
          setMessages(prev => [...prev, { 
            id: Date.now().toString(), 
            sender: 'ai', 
            text: `Project "${response.args.name}" structure generated and initialized.`,
            type: 'success'
          }]);
        }
      } else {
        setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: response.text || "Command not recognized." }]);
      }

    } catch (e) {
      setMessages(prev => [...prev, { id: Date.now().toString(), sender: 'ai', text: "Connection failure.", type: 'error' }]);
    } finally {
      setIsProcessing(false);
    }
  };

  // --- Styles ---
  const backdrop = "bg-black/60 backdrop-blur-sm";
  const modalBg = isLight ? "bg-zinc-100" : "bg-[#121214]";
  const borderColor = isLight ? "border-zinc-300" : "border-zinc-800";
  const headerBg = isLight ? "bg-zinc-200" : "bg-[#18181b]";
  const inputBg = isLight ? "bg-white" : "bg-[#09090b]";
  const textPrimary = isLight ? "text-zinc-800" : "text-zinc-200";
  const textSecondary = isLight ? "text-zinc-500" : "text-zinc-500";
  const accentColor = isLight ? "text-cyan-600" : "text-cyan-400";
  
  if (!isOpen) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center ${backdrop} p-4 transition-opacity duration-200`}>
      <div className={`
        w-full max-w-4xl h-[80vh] flex flex-col rounded-xl shadow-2xl overflow-hidden border
        ${modalBg} ${borderColor} animate-in zoom-in-95 duration-200
      `}>
        
        {/* Header */}
        <div className={`h-16 border-b flex items-center justify-between px-6 ${headerBg} ${borderColor}`}>
           <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center border ${isLight ? 'bg-cyan-100 border-cyan-200' : 'bg-cyan-950/30 border-cyan-900/50'}`}>
                 <Bot size={18} className={accentColor} />
              </div>
              <div>
                 <h2 className={`font-bold font-mono text-sm uppercase tracking-wider ${textPrimary}`}>AI Command Center</h2>
                 <p className={`text-[10px] font-mono ${textSecondary}`}>SYNCHRONIZED • v2.1</p>
              </div>
           </div>
           
           <button 
             onClick={onClose}
             className={`w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10 transition-colors ${textSecondary}`}
           >
             <X size={20} />
           </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex gap-4 max-w-3xl ${msg.sender === 'user' ? 'ml-auto flex-row-reverse' : ''}`}
              >
                {/* Avatar */}
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border mt-1
                  ${msg.sender === 'user' 
                    ? (isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-zinc-800 border-zinc-700') 
                    : (isLight ? 'bg-cyan-100 border-cyan-200' : 'bg-cyan-900/20 border-cyan-800')
                  }
                `}>
                  {msg.sender === 'user' 
                    ? <User size={14} className={isLight ? 'text-zinc-500' : 'text-zinc-400'} /> 
                    : <Sparkles size={14} className={accentColor} />
                  }
                </div>

                {/* Bubble */}
                <div className={`
                  p-4 rounded-lg text-sm border shadow-sm leading-relaxed
                  ${msg.sender === 'user' 
                    ? (isLight ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-zinc-800 text-zinc-100 border-zinc-700')
                    : (msg.type === 'error' 
                        ? (isLight ? 'bg-red-50 text-red-800 border-red-200' : 'bg-red-950/20 text-red-400 border-red-900/50')
                        : msg.type === 'success'
                          ? (isLight ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-emerald-950/20 text-emerald-400 border-emerald-900/50')
                          : (isLight ? 'bg-white text-zinc-700 border-zinc-200' : 'bg-[#18181b] text-zinc-300 border-zinc-800')
                      )
                  }
                `}>
                  {msg.type === 'success' && <div className="flex items-center gap-2 mb-2 font-bold uppercase text-xs tracking-wider"><CheckCircle2 size={12} /> Success</div>}
                  {msg.text}
                </div>
              </div>
            ))}
            
            {isProcessing && (
               <div className="flex gap-4">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isLight ? 'bg-cyan-100 border-cyan-200' : 'bg-cyan-900/20 border-cyan-800'}`}>
                     <Bot size={14} className={accentColor} />
                  </div>
                  <div className={`flex items-center gap-1 p-4 rounded-lg border ${isLight ? 'bg-white border-zinc-200' : 'bg-[#18181b] border-zinc-800'}`}>
                     <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                     <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                     <div className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-bounce"></div>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className={`p-6 border-t ${headerBg} ${borderColor}`}>
            <div className={`
              flex items-center gap-3 p-1 pl-4 rounded-lg border transition-all
              ${inputBg} 
              ${isLight ? 'border-zinc-300 focus-within:border-cyan-500' : 'border-zinc-700 focus-within:border-cyan-500/50'}
              focus-within:ring-1 focus-within:ring-cyan-500/20
            `}>
                <Command size={16} className={textSecondary} />
                <input 
                  ref={inputRef}
                  type="text" 
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={initialIntent === 'create' ? "Describe the project you want to build..." : "Type a command or ask a question..."}
                  className={`flex-1 bg-transparent border-none focus:ring-0 outline-none h-12 font-mono text-sm ${textPrimary} placeholder:opacity-50`}
                />
                <button 
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isProcessing}
                  className={`
                    h-10 w-10 flex items-center justify-center rounded-md transition-all
                    ${!inputValue.trim() ? 'opacity-30' : 'opacity-100 hover:scale-105 active:scale-95'}
                    ${isLight ? 'bg-zinc-800 text-white' : 'bg-cyan-600 text-white shadow-[0_0_10px_rgba(8,145,178,0.4)]'}
                  `}
                >
                   <ChevronRight size={20} />
                </button>
            </div>
            <div className={`mt-2 text-[10px] font-mono uppercase tracking-wider flex justify-between ${textSecondary}`}>
                <span>AI-71 System Active</span>
                <span>Context: {allProjects.length} Projects Loaded</span>
            </div>
        </div>
      </div>
    </div>
  );
};