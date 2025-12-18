import { File, ProjectMeta } from '../types';

const RECENT_KEY = 'vibe_recent_projects';
const ACTIVE_ID_KEY = 'vibe_active_project_id';

export const projectService = {
  getRecents: (): ProjectMeta[] => {
    try {
      const data = localStorage.getItem(RECENT_KEY);
      const parsed = data ? JSON.parse(data) : [];
      // Sort by lastOpened desc
      return parsed.sort((a: ProjectMeta, b: ProjectMeta) => b.lastOpened - a.lastOpened);
    } catch {
      return [];
    }
  },

  saveProject: (files: File[], meta: ProjectMeta) => {
    try {
      // Save Files
      localStorage.setItem(`vibe_project_${meta.id}`, JSON.stringify(files));

      // Update Recents
      const recents = projectService.getRecents();
      const updatedMeta = { ...meta, lastOpened: Date.now() };
      
      const otherRecents = recents.filter(p => p.id !== meta.id);
      const newRecents = [updatedMeta, ...otherRecents].slice(0, 15); // Limit to 15 recent projects

      localStorage.setItem(RECENT_KEY, JSON.stringify(newRecents));
      localStorage.setItem(ACTIVE_ID_KEY, meta.id);
    } catch (e: any) {
      console.error("Failed to save project", e);
      throw e;
    }
  },

  loadProject: (id: string): File[] | null => {
    try {
      const data = localStorage.getItem(`vibe_project_${id}`);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  createProject: (name: string): ProjectMeta => {
    return {
      id: Math.random().toString(36).slice(2, 11),
      name,
      lastOpened: Date.now()
    };
  },

  renameProject: (id: string, newName: string) => {
    const recents = projectService.getRecents();
    const updated = recents.map(p => p.id === id ? { ...p, name: newName } : p);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  },

  getActiveProjectId: () => {
    return localStorage.getItem(ACTIVE_ID_KEY);
  },

  clearActiveProject: () => {
    localStorage.removeItem(ACTIVE_ID_KEY);
  },

  deleteProject: (id: string) => {
    try {
      // Remove project files
      localStorage.removeItem(`vibe_project_${id}`);

      // Update Recents
      const recents = projectService.getRecents();
      const newRecents = recents.filter(p => p.id !== id);
      localStorage.setItem(RECENT_KEY, JSON.stringify(newRecents));

      // Check if it was the active project
      if (projectService.getActiveProjectId() === id) {
        projectService.clearActiveProject();
      }
    } catch (e: any) {
      console.error("Failed to delete project", e);
      throw e;
    }
  },
};