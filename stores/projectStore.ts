
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ProjectMeta } from '../types';
import { projectService } from '../services/projectService';
import { useFileTreeStore } from './fileStore';
import { useGitStore } from './gitStore';
import { useChatStore } from './chatStore';
import { errorService } from '../services';
import { gitService } from '../services/gitService';

interface ProjectState {
  projectToDelete: ProjectMeta | null;
  activeProject: ProjectMeta | null;
  recentProjects: ProjectMeta[];

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

      setProjectToDelete: (project) => set({ projectToDelete: project }),

      confirmDeleteProject: async () => {
        const { projectToDelete, activeProject } = get();
        if (!projectToDelete) return;

        const wasActive = activeProject?.id === projectToDelete.id;
        try {
          projectService.deleteProject(projectToDelete.id);

          if (wasActive) {
            useFileTreeStore.getState().resetFiles();
            useGitStore.getState().reset();
            useChatStore.getState().clearChat();
            errorService.report(`Deleted active project: ${projectToDelete.name}`, 'Project', { notifyUser: false, terminal: true, severity: 'info' });
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
        } catch (e: any) {
          errorService.report(e, "Project Deletion");
        }
      },

      loadInitialProject: async () => {
        try {
          const recents = projectService.getRecents();
          set({ recentProjects: recents });
          const lastProjectId = projectService.getActiveProjectId();
          const projectToLoad = recents.find(p => p.id === lastProjectId) || recents[0];
          
          if (projectToLoad) {
            await get().handleLoadProject(projectToLoad);
          } else {
            gitService.initForProject('default-scratchpad');
            useGitStore.getState().reset();
          }
        } catch (e: any) {
          errorService.report(e, "Initial Project Load");
        }
      },

      handleNewProject: async (name?: string): Promise<ProjectMeta | void> => {
        let projectName = name;
        if (!projectName) {
          projectName = window.prompt("Enter project name:", "Untitled Project");
          if (!projectName) return;
        }

        try {
          get().saveCurrentProject();

          const newMeta = projectService.createProject(projectName);
          projectService.saveProject([], newMeta);
          
          set({ 
            activeProject: newMeta, 
            recentProjects: projectService.getRecents() 
          });

          gitService.initForProject(newMeta.id);
          useGitStore.getState().reset();

          useFileTreeStore.getState().resetFiles();
          useChatStore.getState().clearChat();
          errorService.report(`New project created: ${projectName}`, 'Project', { notifyUser: false, terminal: true, severity: 'success' });
          return newMeta;
        } catch (e: any) {
          errorService.report(e, "New Project Creation");
        }
      },

      handleLoadProject: async (project) => {
        const { activeProject } = get();
        try {
          await useGitStore.getState().checkForExistingRepo();
          if (activeProject?.id === project.id) return;
          
          get().saveCurrentProject();

          const loadedFiles = projectService.loadProject(project.id);
          if (loadedFiles) {
            useFileTreeStore.getState().setAllFiles(loadedFiles);
            projectService.saveProject(loadedFiles, project);
            
            set({ 
              activeProject: project, 
              recentProjects: projectService.getRecents() 
            });

            gitService.initForProject(project.id);
            useGitStore.getState().reset();

            errorService.report(`Switched to project: ${project.name}`, 'Project', { notifyUser: false, terminal: true, severity: 'info' });
          } else {
            throw new Error(`Project data for '${project.name}' not found.`);
          }
        } catch (e: any) {
          errorService.report(e, "Project Load");
        }
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
