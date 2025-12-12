import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { SidebarView } from '../types';
import { SIDEBAR_VIEWS } from '../views/sidebarViews';

type Theme = 'light' | 'dark';

interface UIState {
  theme: Theme;
  isTerminalOpen: boolean;
  activeSidebarView: string | null;
  sidebarViews: SidebarView[];
  isAIOpen: boolean;
  isSettingsOpen: boolean;
  isCommandPaletteOpen: boolean;
  isPreviewOpen: boolean;
  isCloneModalOpen: boolean;
  
  // Actions
  toggleTheme: () => void;
  setIsTerminalOpen: (isOpen: boolean) => void;
  setActiveSidebarView: (viewId: string | null) => void;
  updateSidebarViews: (views: SidebarView[]) => void;
  setIsAIOpen: (isOpen: boolean) => void;
  setIsSettingsOpen: (isOpen: boolean) => void;
  setIsCommandPaletteOpen: (isOpen: boolean) => void;
  setIsPreviewOpen: (isOpen: boolean) => void;
  setIsCloneModalOpen: (isOpen: boolean) => void;
}

const getDefaultSidebarViews = (): SidebarView[] => {
  try {
    const saved = localStorage.getItem('vibe-ui-layout-storage');
    if (saved) {
      const parsedState = JSON.parse(saved).state;
      if (parsedState.sidebarViews) return parsedState.sidebarViews;
    }
  } catch (e) { /* ignore */ }
  return SIDEBAR_VIEWS.map((view, index) => ({
    ...view,
    order: index,
    visible: true,
  }));
};

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      isTerminalOpen: true,
      activeSidebarView: 'explorer',
      sidebarViews: getDefaultSidebarViews(),
      isAIOpen: false,
      isSettingsOpen: false,
      isCommandPaletteOpen: false,
      isPreviewOpen: false,
      isCloneModalOpen: false,

      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setIsTerminalOpen: (isOpen) => set({ isTerminalOpen: isOpen }),
      setActiveSidebarView: (viewId) => set({ activeSidebarView: viewId }),
      updateSidebarViews: (views) => set({ sidebarViews: views }),
      setIsAIOpen: (isOpen) => set({ isAIOpen: isOpen }),
      setIsSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
      setIsCommandPaletteOpen: (isOpen) => set({ isCommandPaletteOpen: isOpen }),
      setIsPreviewOpen: (isOpen) => set({ isPreviewOpen: isOpen }),
      setIsCloneModalOpen: (isOpen) => set({ isCloneModalOpen: isOpen }),
    }),
    {
      name: 'vibe-ui-layout-storage',
      partialize: (state) => ({ 
        theme: state.theme, 
        isTerminalOpen: state.isTerminalOpen, 
        activeSidebarView: state.activeSidebarView,
        sidebarViews: state.sidebarViews,
      }),
    }
  )
);
