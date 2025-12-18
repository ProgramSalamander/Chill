
import { File } from '../types';

/**
 * Selectors for the File Store
 */
export const selectFiles = (state: any): File[] => state.files;
export const selectActiveFileId = (state: any): string => state.activeFileId;
export const selectOpenFileIds = (state: any): string[] => state.openFileIds;

export const selectActiveFile = (state: any): File | null => {
  const files = selectFiles(state);
  const activeId = selectActiveFileId(state);
  return files.find(f => f.id === activeId) || null;
};

export const selectOpenFiles = (state: any): File[] => {
  const files = selectFiles(state);
  const openIds = selectOpenFileIds(state);
  return files.filter(f => openIds.includes(f.id));
};

/**
 * Selectors for UI Store
 */
export const selectTheme = (state: any) => state.theme;
export const selectIsAIOpen = (state: any) => state.isAIOpen;
export const selectActiveSidebarView = (state: any) => state.activeSidebarView;
export const selectIsTerminalOpen = (state: any) => state.isTerminalOpen;

/**
 * Selectors for Chat Store
 */
export const selectMessages = (state: any) => state.messages;
export const selectIsGenerating = (state: any) => state.isGenerating;
