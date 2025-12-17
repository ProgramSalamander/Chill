import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectMeta } from '../types';
import type { ProjectService } from '../services/projectService';
import { useFileTreeStore } from './fileStore';
import { useGitStore } from './gitStore';
import { useChatStore } from './chatStore';
import { useTerminalStore } from './terminalStore';
// FIX: Correctly import gitService to derive its type, as 'GitService' is not an exported member.
import { gitService } from '../services/gitService';
type GitService = typeof gitService;
import { notify } from '../stores/notificationStore';

interface ProjectState {
  projectToDelete: ProjectMeta | null;
  activeProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];
  _projectService: ProjectService | null;
  _gitService: GitService | null;

  setDependencies: (services: { projectService: ProjectService, gitService: GitService }) => void;
  setProjectToDelete: (project: ProjectMeta | null) => void;
  confirmDeleteProject: () => Promise<void>;
  loadInitialProject: () => Promise<void>;
  handleNewProject: (name?: string) => Promise<ProjectMeta | void>;
  handleLoadProject: (project: ProjectMeta) => Promise<void>;
  saveCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectToDelete: null,
      activeProject: null,
      recentProjects: [],
      _projectService: null,
      _gitService: null,

      setDependencies: (services) => set({ 
        _projectService: services.projectService,
        _gitService: services.gitService
      }),

      setProjectToDelete: (project) => set({ projectToDelete: project }),

      confirmDeleteProject: async () => {
        const { projectToDelete, activeProject, _projectService } = get();
        if (!projectToDelete || !_projectService) return;

        const wasActive = activeProject?.id === projectToDelete.id;
        _projectService.deleteProject(projectToDelete.id);

        if (wasActive) {
          useFileTreeStore.getState().resetFiles();
          useGitStore.getState().reset();
          useChatStore.getState().clearChat();
          useTerminalStore.getState().clearTerminal();
          useTerminalStore.getState().addTerminalLine(`Deleted active project: ${projectToDelete.name}`, 'info');
          set({ activeProject: null });
        }

        const newRecents = _projectService.getRecents();
        set({
          recentProjects: newRecents,
          projectToDelete: null,
        });

        if (wasActive && newRecents.length > 0) {
          get().handleLoadProject(newRecents[0]);
        }
      },

      loadInitialProject: async () => {
        const { _projectService } = get();
        if (!_projectService) return;

        const recents = _projectService.getRecents();
        set({ recentProjects: recents });
        const lastProjectId = _projectService.getActiveProjectId();
        const projectToLoad = recents.find(p => p.id === lastProjectId) || recents[0];
        
        if (projectToLoad) {
          await get().handleLoadProject(projectToLoad);
        } else {
          const { _gitService } = get();
          if (!_gitService) return;
          // First time user, no projects.
          _gitService.initForProject('default-scratchpad');
          useGitStore.getState().reset();
        }
      },

      handleNewProject: async (name?: string): Promise<ProjectMeta | void> => {
        const { _projectService, _gitService } = get();
        if (!_projectService || !_gitService) return;
        
        let projectName = name;
        if (!projectName) {
          projectName = window.prompt("Enter project name:", "Untitled Project");
          if (!projectName) return;
        }

        get().saveCurrentProject();

        const newMeta = _projectService.createProject(projectName);
        _projectService.saveProject([], newMeta);
        
        set({ 
          activeProject: newMeta, 
          recentProjects: _projectService.getRecents() 
        });

        _gitService.initForProject(newMeta.id);
        useGitStore.getState().reset();

        useFileTreeStore.getState().resetFiles();
        useChatStore.getState().clearChat();
        useTerminalStore.getState().clearTerminal();
        useTerminalStore.getState().addTerminalLine(`New project created: ${projectName}`, 'success');
        return newMeta;
      },

      handleLoadProject: async (project) => {
        const { activeProject, _projectService, _gitService } = get();
        if (!_projectService || !_gitService) return;

        await useGitStore.getState().checkForExistingRepo();
        if (activeProject?.id === project.id) return;
        
        get().saveCurrentProject();

        const loadedFiles = _projectService.loadProject(project.id);
        if (loadedFiles) {
          useFileTreeStore.getState().setAllFiles(loadedFiles);
          _projectService.saveProject(loadedFiles, project); // This updates the lastOpened timestamp
          
          set({ 
            activeProject: project, 
            recentProjects: _projectService.getRecents() 
          });

          _gitService.initForProject(project.id);
          useGitStore.getState().reset();

          useTerminalStore.getState().addTerminalLine(`Switched to project: ${project.name}`, 'info');
        } else {
          useTerminalStore.getState().addTerminalLine(`Failed to load project: ${project.name}`, 'error');
        }
      },
      
      saveCurrentProject: () => {
        const { activeProject, _projectService } = get();
        const { files } = useFileTreeStore.getState();
        if (activeProject && _projectService) {
          _projectService.saveProject(files, activeProject);
          set({ recentProjects: _projectService.getRecents() });
        }
      },
    }),
    {
      name: 'vibe-project-storage',
      partialize: (state) => ({ 
        activeProject: state.activeProject, 
        recentProjects: state.recentProjects 
      }),
    }
  )
);