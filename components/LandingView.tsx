import React, { useState } from 'react';
import { useProjectStore } from '../stores/projectStore';
import { useUIStore } from '../stores/uiStore';
import { IconPlus, IconGitBranch, IconFolder, IconClock, IconSparkles, IconTrash, IconEdit, IconCheck } from './Icons';
import Tooltip from './Tooltip';

const ProjectCard: React.FC<{ 
  project: any; 
  isActive: boolean; 
  onLoad: () => void;
  onDelete: () => void;
  onRename: (newName: string) => void;
}> = ({ project, isActive, onLoad, onDelete, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);

  const handleRenameSubmit = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (newName.trim() && newName !== project.name) {
      onRename(newName);
    }
    setIsRenaming(false);
  };

  return (
    <div 
      className={`group relative flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer shadow-sm
        ${isActive 
          ? 'bg-vibe-accent/10 border-vibe-accent/40 ring-1 ring-vibe-accent/20' 
          : 'bg-vibe-800 border-vibe-border hover:border-vibe-accent/30 hover:bg-white/10 dark:hover:bg-white/[0.07]'}
      `}
      onClick={onLoad}
    >
      <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors
            ${isActive ? 'bg-vibe-accent text-white shadow-lg' : 'bg-vibe-700 text-vibe-text-muted group-hover:text-vibe-glow'}
          `}>
            <IconFolder size={20} />
          </div>
          <div className="text-left truncate flex-1">
            {isRenaming ? (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <input 
                  autoFocus
                  className="bg-black/40 border border-vibe-accent/50 rounded px-2 py-0.5 text-sm text-white w-full outline-none"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameSubmit(e);
                    if (e.key === 'Escape') setIsRenaming(false);
                  }}
                />
                <button onClick={handleRenameSubmit} className="text-green-400 p-1"><IconCheck size={14}/></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <p className={`text-sm font-bold truncate transition-colors ${isActive ? 'text-white' : 'text-vibe-text-soft group-hover:text-vibe-text-main'}`}>
                  {project.name}
                </p>
                {isActive && (
                  <span className="text-[8px] bg-vibe-accent text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter shadow-sm animate-pulse">Active</span>
                )}
              </div>
            )}
            <p className="text-[10px] text-vibe-text-muted flex items-center gap-1 mt-0.5">
              <IconClock size={10} />
              {new Date(project.lastOpened).toLocaleDateString()}
            </p>
          </div>
      </div>
      
      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-all">
        {!isRenaming && (
          <Tooltip content="Rename Project" position="top">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsRenaming(true); }}
              className="p-2 rounded-xl text-vibe-text-muted hover:text-vibe-glow hover:bg-white/5 transition-all"
            >
              <IconEdit size={14} />
            </button>
          </Tooltip>
        )}
        <Tooltip content="Delete Project" position="top">
          <button 
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-xl text-vibe-text-muted hover:text-red-500 hover:bg-red-500/10 transition-all"
          >
            <IconTrash size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  );
};

const LandingView: React.FC = () => {
  const { recentProjects, activeProject, handleLoadProject, setProjectToDelete, handleRenameProject } = useProjectStore();
  const setIsCloneModalOpen = useUIStore(state => state.setIsCloneModalOpen);
  const setIsNewProjectModalOpen = useUIStore(state => state.setIsNewProjectModalOpen);

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-700 overflow-y-auto custom-scrollbar">
      <div className="max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        
        {/* Brand/Welcome Header */}
        <div className="space-y-4">
          <div className="relative inline-block">
             <div className="absolute inset-0 bg-vibe-accent blur-3xl opacity-30 animate-pulse-slow"></div>
             <div className="relative w-24 h-24 mx-auto rounded-3xl bg-gradient-to-br from-vibe-accent to-purple-600 flex items-center justify-center shadow-2xl border border-white/20 transform hover:scale-105 transition-transform duration-500 cursor-default">
                <span className="text-4xl font-black text-white">C</span>
             </div>
          </div>
          <h1 className="text-4xl font-black text-vibe-text-main tracking-tighter sm:text-5xl">
            Welcome to <span className="bg-gradient-to-r from-vibe-glow to-purple-400 bg-clip-text text-transparent">Chill IDE</span>
          </h1>
          <p className="text-vibe-text-soft text-lg max-w-lg mx-auto leading-relaxed">
            The AI-first, vibe-driven development environment for modern engineers. Open a project to get started.
          </p>
        </div>

        {/* Primary Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 w-full max-w-2xl">
          <button 
            onClick={() => setIsNewProjectModalOpen(true)}
            className="group relative p-8 rounded-3xl bg-vibe-800 border border-vibe-border hover:border-vibe-accent/50 hover:bg-vibe-accent/5 transition-all duration-300 text-left overflow-hidden shadow-sm"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <IconPlus size={120} />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-vibe-accent/10 flex items-center justify-center text-vibe-glow group-hover:scale-110 transition-transform">
                 <IconPlus size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-vibe-text-main mb-1">New Project</h3>
                <p className="text-sm text-vibe-text-soft">Start from scratch in a clean workspace.</p>
              </div>
            </div>
          </button>

          <button 
            onClick={() => setIsCloneModalOpen(true)}
            className="group relative p-8 rounded-3xl bg-vibe-800 border border-vibe-border hover:border-indigo-400/50 hover:bg-indigo-400/5 transition-all duration-300 text-left overflow-hidden shadow-sm"
          >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
               <IconGitBranch size={120} />
            </div>
            <div className="relative z-10 flex flex-col gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
                 <IconGitBranch size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-vibe-text-main mb-1">Clone Repository</h3>
                <p className="text-sm text-vibe-text-soft">Import an existing project from Git.</p>
              </div>
            </div>
          </button>
        </div>

        {/* Recent Projects Section */}
        {recentProjects.length > 0 && (
          <div className="w-full max-w-2xl space-y-6">
            <div className="flex items-center gap-4 px-4">
               <div className="h-px flex-1 bg-vibe-border"></div>
               <span className="text-xs font-bold text-vibe-text-muted uppercase tracking-widest flex items-center gap-2">
                 <IconClock size={14} /> Recent Projects
               </span>
               <div className="h-px flex-1 bg-vibe-border"></div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {recentProjects.map(proj => (
                 <ProjectCard 
                    key={proj.id}
                    project={proj}
                    isActive={activeProject?.id === proj.id}
                    onLoad={() => handleLoadProject(proj)}
                    onDelete={() => setProjectToDelete(proj)}
                    onRename={(name) => handleRenameProject(proj.id, name)}
                 />
               ))}
            </div>
          </div>
        )}

        {/* Hints / Features info */}
        <div className="pt-8 grid grid-cols-1 sm:grid-cols-3 gap-8 w-full max-w-3xl opacity-50 grayscale hover:grayscale-0 transition-all duration-700">
           <div className="flex flex-col items-center gap-3">
              <IconSparkles size={20} className="text-vibe-glow" />
              <p className="text-xs font-medium text-vibe-text-muted">AI Contextual Search</p>
           </div>
           <div className="flex flex-col items-center gap-3">
              <IconGitBranch size={20} className="text-indigo-400" />
              <p className="text-xs font-medium text-vibe-text-muted">Integrated Git Support</p>
           </div>
           <div className="flex flex-col items-center gap-3">
              <IconFolder size={20} className="text-purple-400" />
              <p className="text-xs font-medium text-vibe-text-muted">Project Management</p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default LandingView;