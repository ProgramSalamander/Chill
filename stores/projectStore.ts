import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectMeta } from '../types';
import { projectService } from '../services/projectService';
import { useFileTreeStore } from './fileStore';
import { useGitStore } from './gitStore';
import { useChatStore } from './chatStore';
import { useTerminalStore } from './terminalStore';

interface ProjectState {
  projectToDelete: ProjectMeta | null;
  activeProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];

  setProjectToDelete: (project: ProjectMeta | null) => void;
  confirmDeleteProject: () => Promise<void>;
  loadInitialProject: () => void;
  handleNewProject: () => Promise<void>;
  handleLoadProject: (project: ProjectMeta) => Promise<void>;
  saveCurrentProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectToDelete: null,
      activeProject: null,
      recentProjects: [],

      setProjectToDelete: (project) => set({ projectToDelete: project }),

      confirmDeleteProject: async () => {
        const { projectToDelete, activeProject } = get();
        if (!projectToDelete) return;

        const wasActive = activeProject?.id === projectToDelete.id;
        projectService.deleteProject(projectToDelete.id);

        if (wasActive) {
          useFileTreeStore.getState().resetFiles();
          useGitStore.getState().reset();
          useChatStore.getState().clearChat();
          useTerminalStore.getState().clearTerminal();
          useTerminalStore.getState().addTerminalLine(`Deleted active project: ${projectToDelete.name}`, 'info');
          set({ activeProject: null });
        }

        const newRecents = projectService.getRecents();
        set({
          recentProjects: newRecents,
          projectToDelete: null,
        });

        if (wasActive && newRecents.length > 0) {
          get().handleLoadProject(newRecents[0]);
        }
      },

      loadInitialProject: () => {
        const recents = projectService.getRecents();
        set({ recentProjects: recents });
        const lastProjectId = projectService.getActiveProjectId();
        const projectToLoad = recents.find(p => p.id === lastProjectId);
        if (projectToLoad) {
          get().handleLoadProject(projectToLoad);
        }
      },

      handleNewProject: async () => {
        const name = window.prompt("Enter project name:", "Untitled Project");
        if (!name) return;

        get().saveCurrentProject();

        const newMeta = projectService.createProject(name);
        projectService.saveProject([], newMeta);
        
        set({ 
          activeProject: newMeta, 
          recentProjects: projectService.getRecents() 
        });

        useFileTreeStore.getState().resetFiles();
        useGitStore.getState().reset();
        useChatStore.getState().clearChat();
        useTerminalStore.getState().clearTerminal();
        useTerminalStore.getState().addTerminalLine(`New project created: ${name}`, 'success');
      },

      handleLoadProject: async (project) => {
        const { activeProject } = get();
        if (activeProject?.id === project.id) return;
        
        get().saveCurrentProject();

        const loadedFiles = projectService.loadProject(project.id);
        if (loadedFiles) {
          useFileTreeStore.getState().setAllFiles(loadedFiles);
          projectService.saveProject(loadedFiles, project); // This updates the lastOpened timestamp
          
          set({ 
            activeProject: project, 
            recentProjects: projectService.getRecents() 
          });

          useGitStore.getState().reset();
          useTerminalStore.getState().addTerminalLine(`Switched to project: ${project.name}`, 'info');
        } else {
          useTerminalStore.getState().addTerminalLine(`Failed to load project: ${project.name}`, 'error');
        }
      },
      
      saveCurrentProject: () => {
        const { activeProject } = get();
        const { files } = useFileTreeStore.getState();
        if (activeProject) {
          projectService.saveProject(files, activeProject);
          set({ recentProjects: projectService.getRecents() });
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
