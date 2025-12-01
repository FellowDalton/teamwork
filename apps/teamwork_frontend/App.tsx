import React, { useState } from 'react';
import { Project, Stage, Task, ViewState } from './types';
import { TaskCard } from './components/TaskCard';
import { AnalogButton } from './components/AnalogButton';
import { generateProjectStructure, suggestNextTask } from './services/claudeService';
import { ChatWidget } from './components/ChatWidget';
import { 
  Layout, 
  Plus, 
  Search, 
  Bell, 
  Sparkles, 
  Loader2,
  Kanban,
  List as ListIcon,
  Briefcase,
  Play,
  Settings,
  Grid,
  Sun,
  Moon,
  MoreVertical,
  Crosshair,
  MessageSquare
} from 'lucide-react';

// Initial Mock Data (unchanged structure)
const INITIAL_PROJECTS: Project[] = [
  {
    id: 'p1',
    name: 'Q3 Marketing',
    description: 'Launch strategy for the new product line.',
    lastUpdated: new Date().toISOString(),
    stages: [
      {
        id: 's1',
        name: 'Briefing',
        tasks: [
          { id: 't1', title: 'Define target audience', priority: 'high', tags: ['strategy'], assignedTo: 'https://picsum.photos/32/32?1', timeLogs: [], comments: [] },
          { id: 't2', title: 'Competitor analysis', priority: 'medium', tags: ['research'], assignedTo: 'https://picsum.photos/32/32?2', timeLogs: [], comments: [] }
        ]
      },
      {
        id: 's2',
        name: 'Content',
        tasks: [
          { id: 't3', title: 'Draft email copy', priority: 'high', tags: ['copy'], assignedTo: 'https://picsum.photos/32/32?3', timeLogs: [], comments: [] }
        ]
      },
      {
        id: 's3',
        name: 'Review',
        tasks: []
      }
    ]
  },
  {
    id: 'p2',
    name: 'Website Redesign',
    description: 'Overhaul of the corporate website.',
    lastUpdated: new Date(Date.now() - 86400000).toISOString(),
    stages: [
      {
        id: 's4',
        name: 'Backlog',
        tasks: [
             { id: 't4', title: 'Audit existing pages', priority: 'low', tags: ['seo'], assignedTo: 'https://picsum.photos/32/32?4', timeLogs: [], comments: [] }
        ]
      },
      {
        id: 's5',
        name: 'Design',
        tasks: [
            { id: 't5', title: 'Homepage Mockup', priority: 'high', tags: ['ui/ux'], assignedTo: 'https://picsum.photos/32/32?5', timeLogs: [], comments: [] }
        ]
      }
    ]
  }
];

type PanelView = 'board' | 'list';
type Theme = 'light' | 'dark';

export default function App() {
  const [projects, setProjects] = useState<Project[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(INITIAL_PROJECTS[0].id);
  const [currentView, setCurrentView] = useState<PanelView>('board');
  const [theme, setTheme] = useState<Theme>('dark');
  const [isLoading, setIsLoading] = useState(false);

  // Chat State
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatIntent, setChatIntent] = useState<'general' | 'create'>('general');

  // Drag and Drop State
  const [draggedTask, setDraggedTask] = useState<{taskId: string, sourceStageId: string} | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || null;
  const isLight = theme === 'light';

  // --- Theme Styles ---
  // Main background (Chassis) with texture
  const appBg = isLight ? 'bg-[#e4e4e7]' : 'bg-[#121214]'; 
  const appText = isLight ? 'text-zinc-800' : 'text-zinc-100';
  
  // Header
  const headerBg = isLight ? 'bg-[#d4d4d8] border-zinc-400' : 'bg-[#18181b] border-black';
  const logoBg = isLight ? 'bg-[#e4e4e7] border-zinc-400 shadow-[inset_0_1px_1px_rgba(255,255,255,0.4)]' : 'bg-[#27272a] border-black shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]';
  const dividerBg = isLight ? 'bg-zinc-400' : 'bg-zinc-800';
  
  // Sidebar
  const sidebarBg = isLight ? 'bg-[#d4d4d8] border-zinc-400' : 'bg-[#18181b] border-black';
  const sidebarHeading = isLight ? 'text-zinc-500' : 'text-zinc-600';
  const sidebarFooterBorder = isLight ? 'border-zinc-400' : 'border-zinc-800';
  
  // Screen Area (Grid Background)
  const screenBg = isLight 
    ? 'bg-[#f4f4f5] bg-grid-light border-zinc-400' 
    : 'bg-[#09090b] bg-grid-dark border-zinc-900';
    
  // LCD Display
  const lcdBg = isLight 
    ? 'bg-[#e4e4e7] border-zinc-400 shadow-[inset_0_2px_4px_rgba(0,0,0,0.05)]'
    : 'bg-[#0c0c0e] border-zinc-800 shadow-[inset_0_2px_4px_rgba(0,0,0,0.8)]';
  const lcdLabel = isLight ? 'text-cyan-700' : 'text-cyan-600';
  const lcdText = isLight ? 'text-zinc-800' : 'text-cyan-400';

  // --- Handlers ---

  const handleOpenChat = (intent: 'general' | 'create') => {
    setChatIntent(intent);
    setIsChatOpen(true);
  };

  const handleCreateProjectFromAI = (projectData: any) => {
    // Transform AI structure to App structure
    const newProject: Project = {
        id: `proj-${Date.now()}`,
        name: projectData.name,
        description: projectData.description,
        stages: projectData.stages.map((stage: any, sIdx: number) => ({
            id: `stage-${Date.now()}-${sIdx}`,
            name: stage.name,
            tasks: stage.tasks?.map((task: any, tIdx: number) => ({
                id: `task-${Date.now()}-${sIdx}-${tIdx}`,
                title: task.title,
                description: task.description,
                priority: task.priority || 'medium',
                tags: task.tags || [],
                timeLogs: [],
                comments: [],
                assignedTo: `https://picsum.photos/seed/${Math.random()}/32/32`
            })) || []
        })) || [],
        lastUpdated: new Date().toISOString()
    };
    
    setProjects(prev => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
  };

  const handleLogWork = async (taskName: string | undefined, hours: number, comment: string, isBillable: boolean): Promise<boolean> => {
    let targetProject = activeProject;
    let targetTask: Task | null = null;
    let targetStage: Stage | null = null;

    const findTaskInProject = (proj: Project, name: string) => {
      for (const stage of proj.stages) {
        const task = stage.tasks.find(t => t.title.toLowerCase().includes(name.toLowerCase()));
        if (task) return { task, stage };
      }
      return null;
    };

    if (activeProject && taskName) {
      const found = findTaskInProject(activeProject, taskName);
      if (found) {
        targetTask = found.task;
        targetStage = found.stage;
      }
    } else if (!activeProject && taskName) {
      for (const proj of projects) {
        const found = findTaskInProject(proj, taskName);
        if (found) {
          targetTask = found.task;
          targetStage = found.stage;
          targetProject = proj;
          break;
        }
      }
    } else if (activeProject && !taskName) {
      // Default to first task if available
      if (activeProject.stages[0]?.tasks.length > 0) {
        targetTask = activeProject.stages[0].tasks[0];
        targetStage = activeProject.stages[0];
      }
    }

    if (targetTask && targetStage && targetProject) {
      const updatedTask = { ...targetTask };
      
      updatedTask.timeLogs = [
        ...(updatedTask.timeLogs || []),
        {
          id: `log-${Date.now()}`,
          hours,
          comment,
          isBillable,
          date: new Date().toISOString()
        }
      ];

      updatedTask.comments = [
        ...(updatedTask.comments || []),
        {
          id: `cmt-${Date.now()}`,
          text: `Logged ${hours}h: ${comment}`,
          createdAt: new Date().toISOString(),
          author: 'AI'
        }
      ];

      const updatedProject = {
        ...targetProject,
        stages: targetProject.stages.map(s => 
          s.id === targetStage!.id 
            ? { ...s, tasks: s.tasks.map(t => t.id === updatedTask.id ? updatedTask : t) }
            : s
        )
      };

      setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
      return true;
    }

    return false;
  };

  // --- Drag & Drop ---

  const onDragStart = (e: React.DragEvent, taskId: string, sourceStageId: string) => {
    setDraggedTask({ taskId, sourceStageId });
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOverStage = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const onDrop = (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    setDragOverStageId(null);
    if (!draggedTask || !activeProject) return;

    const { taskId, sourceStageId } = draggedTask;
    if (sourceStageId === targetStageId) return;

    const newProject = { ...activeProject };
    const sourceStage = newProject.stages.find(s => s.id === sourceStageId);
    const targetStage = newProject.stages.find(s => s.id === targetStageId);
    
    if (sourceStage && targetStage) {
      const taskIndex = sourceStage.tasks.findIndex(t => t.id === taskId);
      if (taskIndex > -1) {
        const [task] = sourceStage.tasks.splice(taskIndex, 1);
        targetStage.tasks.push(task);
        setProjects(projects.map(p => p.id === newProject.id ? newProject : p));
      }
    }
    setDraggedTask(null);
  };

  const handleSuggestTask = async (stageId: string) => {
    if (!activeProject) return;
    setIsLoading(true);
    try {
        const allTasks = activeProject.stages.flatMap(s => s.tasks.map(t => t.title));
        const newTask = await suggestNextTask(allTasks, activeProject.description);
        
        const newProject = {...activeProject};
        const stage = newProject.stages.find(s => s.id === stageId);
        if (stage) {
            stage.tasks.push(newTask);
            setProjects(projects.map(p => p.id === newProject.id ? newProject : p));
        }
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  }

  // --- Views ---

  const Screw = () => (
    <div className={`w-2 h-2 rounded-full border ${isLight ? 'border-zinc-400 bg-zinc-300' : 'border-zinc-700 bg-zinc-800'} flex items-center justify-center opacity-70`}>
       <div className={`w-1 h-[1px] ${isLight ? 'bg-zinc-500' : 'bg-zinc-600'} transform -rotate-45`}></div>
    </div>
  );
  
  const RegistrationMark = ({ className }: { className?: string }) => (
    <div className={`absolute w-3 h-3 border-zinc-500 opacity-30 ${className}`}>
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-current"></div>
        <div className="absolute left-1/2 top-0 h-full w-[1px] bg-current"></div>
    </div>
  );

  const renderContent = () => {
    if (!activeProject) {
        return (
            <div className={`flex flex-col h-full items-center justify-center ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`}>
                <div className={`w-16 h-16 rounded-full border-4 flex items-center justify-center mb-4 ${isLight ? 'border-zinc-300' : 'border-zinc-800'}`}>
                    <Grid size={32} />
                </div>
                <p className="font-mono text-sm uppercase tracking-widest">Select Project Source</p>
            </div>
        );
    }

    if (currentView === 'list') {
      return (
        <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto no-scrollbar relative z-10">
            <h2 className={`text-xl font-bold mb-6 flex items-center gap-2 font-mono uppercase tracking-wider ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`}>
              <span className="text-cyan-500">02</span> / LIST VIEW
            </h2>
            <div className="space-y-1">
              {activeProject.stages.flatMap(s => s.tasks.map(t => ({...t, stageName: s.name}))).map(task => (
                <div key={task.id} className={`flex items-center justify-between p-4 border transition-all group ${isLight ? 'bg-white border-zinc-300 hover:bg-zinc-50' : 'bg-zinc-800/50 border-zinc-700/50 hover:bg-zinc-800 hover:border-cyan-500/30'}`}>
                  <div className="flex items-center gap-4">
                     <div className={`w-1.5 h-1.5 rounded-full ${task.priority === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]' : task.priority === 'medium' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'}`} />
                     <span className={`font-medium font-mono text-sm group-hover:text-cyan-600 ${isLight ? 'text-zinc-700' : 'text-zinc-300 group-hover:text-white'}`}>{task.title}</span>
                  </div>
                  <div className="flex items-center gap-6">
                     <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${isLight ? 'bg-zinc-100 text-zinc-500 border-zinc-200' : 'text-zinc-500 bg-zinc-900 border-zinc-800'}`}>{task.stageName}</span>
                     <span className="text-xs text-zinc-400 font-mono w-16 text-right">{task.timeLogs.reduce((acc, l) => acc + l.hours, 0)}h REC</span>
                  </div>
                </div>
              ))}
            </div>
        </div>
      );
    }

    // Default: Board View (Module Layout)
    return (
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 h-full relative z-10">
          <div className="flex h-full gap-6 min-w-max">
            {activeProject.stages.map(stage => (
              <div 
                key={stage.id}
                className={`
                    w-80 flex-shrink-0 flex flex-col h-full 
                    rounded-lg border-[2px] overflow-hidden relative
                    transition-all duration-200
                    ${isLight 
                      ? 'bg-[#e4e4e7] border-[#d4d4d8] shadow-lg' 
                      : 'bg-[#18181b] border-[#27272a] shadow-2xl'
                    }
                `}
                onDragOver={(e) => onDragOverStage(e, stage.id)}
                onDrop={(e) => onDrop(e, stage.id)}
              >
                {/* Module Header Faceplate */}
                <div className={`
                    h-11 flex items-center justify-between px-3 border-b
                    ${isLight ? 'bg-[#d4d4d8] border-[#a1a1aa]' : 'bg-[#27272a] border-black'}
                `}>
                     {/* Left: Indicator & Label */}
                     <div className="flex items-center gap-2.5">
                        <Screw />
                        <div className={`flex items-center gap-2 ${isLight ? 'bg-zinc-200 shadow-sm' : 'bg-black shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]'} rounded px-2 py-1`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${isLight ? 'bg-cyan-500' : 'bg-cyan-400'} shadow-[0_0_4px_rgba(6,182,212,0.6)]`}></div>
                            <h3 className={`font-mono text-[10px] font-bold uppercase tracking-widest leading-none ${isLight ? 'text-zinc-600' : 'text-zinc-300'}`}>
                                {stage.name}
                            </h3>
                        </div>
                     </div>

                     {/* Right: Controls & Info */}
                     <div className="flex items-center gap-2">
                        <span className={`font-mono text-[9px] ${isLight ? 'text-zinc-500' : 'text-zinc-600'}`}>{stage.tasks.length} CH</span>
                        <button 
                            onClick={() => handleSuggestTask(stage.id)}
                            disabled={isLoading}
                            className={`p-1 rounded transition-colors ${isLight ? 'hover:bg-zinc-200 text-zinc-500' : 'hover:bg-zinc-800 text-zinc-500 hover:text-cyan-400'}`}
                            title="AI Generate"
                        >
                            <Sparkles size={12} />
                        </button>
                        <Screw />
                     </div>
                </div>

                {/* Module Tray (Recessed Content Area) */}
                <div className={`
                    flex-1 p-2.5 overflow-y-auto no-scrollbar relative
                    ${isLight 
                        ? 'bg-[#f4f4f5] shadow-[inset_0_2px_6px_rgba(0,0,0,0.06)]' 
                        : 'bg-[#09090b] shadow-[inset_0_2px_8px_rgba(0,0,0,0.6)]'
                    }
                `}>
                    {/* Drag Highlight Overlay */}
                    {dragOverStageId === stage.id && (
                        <div className="absolute inset-0 z-0 bg-cyan-500/5 pointer-events-none animate-pulse" />
                    )}
                    
                    {/* Inner content wrapper */}
                    <div className="relative z-10 space-y-3">
                        {stage.tasks.map(task => (
                        <TaskCard 
                            key={task.id} 
                            task={task} 
                            stageId={stage.id} 
                            onDragStart={onDragStart}
                            theme={theme}
                        />
                        ))}
                        {stage.tasks.length === 0 && (
                            <div className={`border-2 border-dashed rounded h-24 flex flex-col gap-2 items-center justify-center text-[10px] font-mono uppercase tracking-widest opacity-50 ${isLight ? 'border-zinc-300 text-zinc-400' : 'border-zinc-800 text-zinc-600'}`}>
                                <span>No Signal</span>
                                <div className="w-8 h-[1px] bg-current opacity-50"></div>
                            </div>
                        )}
                    </div>
                </div>
              </div>
            ))}

            {/* Empty Expansion Slot (Add Column) */}
            <button className={`
                w-16 h-full flex-shrink-0 flex flex-col items-center justify-center gap-4 rounded-lg border-2 transition-all duration-200 group
                ${isLight 
                    ? 'bg-[#e4e4e7] border-[#d4d4d8] hover:border-zinc-400 text-zinc-400 hover:text-zinc-600' 
                    : 'bg-[#18181b] border-[#27272a] hover:border-zinc-700 text-zinc-700 hover:text-zinc-500'
                }
            `}>
               <Screw />
               <div className="flex-1 w-[1px] bg-current opacity-20 group-hover:opacity-40 transition-opacity"></div>
               <Plus size={24} strokeWidth={1.5} />
               <div className="flex-1 w-[1px] bg-current opacity-20 group-hover:opacity-40 transition-opacity"></div>
               <Screw />
            </button>
          </div>
      </div>
    );
  };

  return (
    <div className={`h-screen ${appBg} bg-noise ${appText} font-sans overflow-hidden flex flex-col transition-colors duration-300`}>
      
      {/* Top Hardware Panel */}
      <div className={`h-24 ${headerBg} border-b flex items-center px-6 gap-8 shadow-xl z-20 relative transition-colors duration-300`}>
         <div className="flex items-center gap-4">
             {/* Logo / Brand Area */}
             <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-b-4 ${logoBg}`}>
                 <Layout className={isLight ? "text-zinc-500" : "text-zinc-400"} />
             </div>
             <div>
                 <h1 className={`font-bold text-lg tracking-tighter ${isLight ? 'text-zinc-700' : 'text-zinc-200'}`}>OP-PROJECT</h1>
                 <p className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">Workflow Engine v1.0</p>
             </div>
         </div>

         <div className={`h-12 w-[2px] mx-4 ${dividerBg}`} />

         {/* Transport / Main Controls */}
         <div className="flex gap-4 items-center">
            <div className="w-28">
                <AnalogButton 
                    label="BOARD" 
                    isActive={currentView === 'board'} 
                    onClick={() => setCurrentView('board')}
                    ledColor="cyan"
                    variant="dark"
                    subLabel="View A"
                    icon={<Kanban size={14} />}
                    theme={theme}
                    noTexture
                />
            </div>
            <div className="w-28">
                <AnalogButton 
                    label="LIST" 
                    isActive={currentView === 'list'} 
                    onClick={() => setCurrentView('list')}
                    ledColor="green"
                    variant="dark"
                    subLabel="View B"
                    icon={<ListIcon size={14} />}
                    theme={theme}
                    noTexture
                />
            </div>
         </div>

         <div className={`h-12 w-[2px] mx-4 ${dividerBg}`} />

         {/* Status / Utility */}
         <div className="flex gap-4 items-center flex-1">
             <div className="flex-1"></div>
             
             {/* LCD Status Display */}
             <div className={`h-[60px] w-64 ${lcdBg} rounded flex flex-col p-2 font-mono relative overflow-hidden`}>
                <div className="flex justify-between items-center z-10 relative">
                     <span className={`text-[10px] uppercase tracking-widest ${lcdLabel}`}>STATUS</span>
                     <div className="flex gap-1">
                         <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                         <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                     </div>
                </div>
                <div className={`text-xs mt-1 truncate ${lcdText}`}>
                     {isLoading ? "PROCESSING AI REQUEST..." : `ACTIVE: ${activeProject?.name || 'NONE'}`}
                </div>
                {/* Scanline overlay */}
                <div className="absolute inset-0 bg-[linear-gradient(rgba(0,0,0,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] pointer-events-none opacity-50"></div>
             </div>

             {/* Small Square Utility Buttons Grid (60x60, 2px gap, Flush keys) */}
             <div className="grid grid-cols-2 gap-[2px] w-[60px] h-[60px]">
                <div className="w-[29px] h-[29px]">
                    <AnalogButton 
                        onClick={() => handleOpenChat('general')} 
                        icon={<MessageSquare size={12} />} 
                        variant="dark" 
                        theme={theme} 
                        minimal 
                        flush
                        noTexture
                        className="!p-0 h-full hover:!text-blue-400"
                    />
                </div>
                <div className="w-[29px] h-[29px]">
                     <AnalogButton 
                         onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                         icon={theme === 'dark' ? <Moon size={12} /> : <Sun size={12} />}
                         variant="dark"
                         theme={theme}
                         minimal
                         flush
                         noTexture
                         className={`!p-0 h-full ${theme === 'dark' ? '!text-yellow-400' : '!text-orange-500'}`}
                     />
                </div>
                <div className="w-[29px] h-[29px]">
                    <AnalogButton 
                        onClick={() => {}} 
                        icon={<Bell size={12} />} 
                        variant="dark" 
                        theme={theme} 
                        minimal 
                        flush
                        noTexture
                        className="!p-0 h-full hover:!text-red-400"
                    />
                </div>
                <div className="w-[29px] h-[29px]">
                    <AnalogButton 
                        onClick={() => {}} 
                        icon={<Settings size={12} />} 
                        variant="dark" 
                        theme={theme} 
                        minimal 
                        flush
                        noTexture
                        className="!p-0 h-full hover:!text-emerald-400"
                    />
                </div>
             </div>
         </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className={`w-64 ${sidebarBg} flex flex-col border-r z-10 transition-colors duration-300 relative`}>
           <div className="p-4 flex-1 overflow-y-auto no-scrollbar">
              <h2 className={`text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2 ${sidebarHeading}`}>
                  <Briefcase size={12} /> Projects
              </h2>
              <div className="space-y-4">
                  {projects.map((proj, idx) => (
                      <AnalogButton 
                          key={proj.id}
                          label={proj.name}
                          subLabel={`IDX_0${idx + 1}`}
                          isActive={activeProjectId === proj.id}
                          onClick={() => setActiveProjectId(proj.id)}
                          ledColor={activeProjectId === proj.id ? 'orange' : 'blue'}
                          variant={activeProjectId === proj.id ? 'accent' : 'dark'}
                          theme={theme}
                          noTexture
                      />
                  ))}
                  <div className="pt-4 border-t border-dashed border-gray-700/30">
                     <AnalogButton 
                        label="NEW PROJ"
                        onClick={() => handleOpenChat('create')}
                        ledColor="purple"
                        variant="dark"
                        subLabel="GENERATE"
                        icon={<Plus size={14} />}
                        theme={theme}
                        noTexture
                     />
                  </div>
              </div>
           </div>
           
           <div className={`p-4 border-t ${sidebarFooterBorder}`}>
               <div className={`flex items-center gap-3 text-xs ${isLight ? 'text-zinc-500' : 'text-zinc-500'}`}>
                   <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${isLight ? 'bg-zinc-200 border-zinc-300' : 'bg-zinc-800 border-zinc-700'}`}>
                       <span className="font-bold">JS</span>
                   </div>
                   <div>
                       <div className="font-bold">John Smith</div>
                       <div className="opacity-70">Admin Access</div>
                   </div>
               </div>
           </div>
        </div>

        {/* Main Workspace (The "Screen") */}
        <div className={`flex-1 relative flex flex-col overflow-hidden transition-colors duration-300 ${screenBg}`}>
            {/* Screen Glare/Reflection overlay (subtle) */}
            <div className={`absolute top-0 left-0 right-0 h-32 bg-gradient-to-b pointer-events-none z-0 ${isLight ? 'from-white/40 to-transparent' : 'from-white/5 to-transparent'}`}></div>

            {/* Engineering Registration Marks */}
            <RegistrationMark className="top-4 left-4 border-l border-t" />
            <RegistrationMark className="top-4 right-4 border-r border-t" />
            <RegistrationMark className="bottom-4 left-4 border-l border-b" />
            <RegistrationMark className="bottom-4 right-4 border-r border-b" />

            {/* Content Area */}
            <div className="flex-1 relative z-10 pt-4">
                {renderContent()}
            </div>
        </div>
      </div>

      {/* AI Chat Modal */}
      <ChatWidget 
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          activeProject={activeProject}
          allProjects={projects}
          currentView={currentView}
          initialIntent={chatIntent}
          onLogWork={handleLogWork}
          onCreateProject={handleCreateProjectFromAI}
          theme={theme}
      />

    </div>
  );
}