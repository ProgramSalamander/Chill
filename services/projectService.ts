
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
    } catch (e) {
      console.error("Failed to save project", e);
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

  getActiveProjectId: () => {
    return localStorage.getItem(ACTIVE_ID_KEY);
  },

  clearActiveProject: () => {
    localStorage.removeItem(ACTIVE_ID_KEY);
  }
};
