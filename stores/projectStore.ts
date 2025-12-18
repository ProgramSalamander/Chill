import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectMeta } from '../types';
import { projectService } from '../services/projectService';
import { useFileTreeStore } from './fileStore';
import { useGitStore } from './gitStore';
import { useChatStore } from './chatStore';
import { errorService } from '../services';
import { gitService } from '../services/gitService';
import { notify } from './notificationStore';

interface ProjectState {
  projectToDelete: ProjectMeta | null;
  activeProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];

  setProjectToDelete: (project: ProjectMeta | null) => void;
  confirmDeleteProject: () => Promise<void>;
  loadInitialProject: () => Promise<void>;
  handleNewProject: (name: string) => Promise<ProjectMeta | void>;
  handleLoadProject: (project: ProjectMeta) => Promise<void>;
  handleRenameProject: (id: string, newName: string) => void;
  saveCurrentProject: () => void;
  clearActiveProject: () => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      projectToDelete: null,
      activeProject: null,
      recentProjects: [],

      setProjectToDelete: (project) => set({ projectToDelete: project }),

      clearActiveProject: () => {
        useFileTreeStore.getState().resetFiles();
        useGitStore.getState().reset();
        useChatStore.getState().clearChat();
        projectService.clearActiveProject();
        set({ activeProject: null });
      },

      confirmDeleteProject: async () => {
        const { projectToDelete, activeProject } = get();
        if (!projectToDelete) return;

        const wasActive = activeProject?.id === projectToDelete.id;
        try {
          projectService.deleteProject(projectToDelete.id);

          if (wasActive) {
            get().clearActiveProject();
            errorService.report(`Deleted active project: ${projectToDelete.name}`, 'Project', { notifyUser: false, terminal: true, severity: 'info' });
          }

          const newRecents = projectService.getRecents();
          set({
            recentProjects: newRecents,
            projectToDelete: null,
          });
        } catch (e: any) {
          errorService.report(e, "Project Deletion");
        }
      },

      loadInitialProject: async () => {
        try {
          const recents = projectService.getRecents();
          set({ recentProjects: recents });
          const lastProjectId = projectService.getActiveProjectId();
          const projectToLoad = recents.find(p => p.id === lastProjectId);
          
          if (projectToLoad) {
            await get().handleLoadProject(projectToLoad);
          } else {
            set({ activeProject: null });
          }
        } catch (e: any) {
          errorService.report(e, "Initial Project Load");
        }
      },

      handleNewProject: async (name: string): Promise<ProjectMeta | void> => {
        if (!name || !name.trim()) {
           errorService.report("Project name is required.", "Project", { severity: 'warning' });
           return;
        }

        try {
          get().saveCurrentProject();

          const newMeta = projectService.createProject(name.trim());
          projectService.saveProject([], newMeta);
          
          set({ 
            activeProject: newMeta, 
            recentProjects: projectService.getRecents() 
          });

          gitService.initForProject(newMeta.id);
          useGitStore.getState().reset();

          useFileTreeStore.getState().resetFiles();
          useChatStore.getState().clearChat();
          errorService.report(`New project created: ${name}`, 'Project', { notifyUser: false, terminal: true, severity: 'success' });
          return newMeta;
        } catch (e: any) {
          errorService.report(e, "New Project Creation");
        }
      },

      handleLoadProject: async (project) => {
        const { activeProject } = get();
        try {
          if (activeProject?.id === project.id) return;
          
          get().saveCurrentProject();

          const loadedFiles = projectService.loadProject(project.id);
          if (loadedFiles !== null) {
            useFileTreeStore.getState().setAllFiles(loadedFiles);
            projectService.saveProject(loadedFiles, project);
            
            set({ 
              activeProject: project, 
              recentProjects: projectService.getRecents() 
            });

            gitService.initForProject(project.id);
            await useGitStore.getState().checkForExistingRepo();

            errorService.report(`Switched to project: ${project.name}`, 'Project', { notifyUser: false, terminal: true, severity: 'info' });
          } else {
             projectService.deleteProject(project.id);
             set({ recentProjects: projectService.getRecents() });
             throw new Error(`Project data for '${project.name}' not found. Removing from recents.`);
          }
        } catch (e: any) {
          errorService.report(e, "Project Load");
        }
      },

      handleRenameProject: (id: string, newName: string) => {
        if (!newName.trim()) return;
        projectService.renameProject(id, newName.trim());
        set(state => ({
            recentProjects: projectService.getRecents(),
            activeProject: state.activeProject?.id === id ? { ...state.activeProject, name: newName.trim() } : state.activeProject
        }));
        notify(`Project renamed to ${newName}`, 'success');
      },
      
      saveCurrentProject: () => {
        const { activeProject } = get();
        const { files } = useFileTreeStore.getState();
        if (activeProject) {
          try {
            projectService.saveProject(files, activeProject);
            set({ recentProjects: projectService.getRecents() });
          } catch (e: any) {
            errorService.report(e, "Project Save", { silent: true, severity: 'warning' });
          }
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