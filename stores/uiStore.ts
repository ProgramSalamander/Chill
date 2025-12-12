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
  const defaultViews = SIDEBAR_VIEWS.map((view, index) => ({
    ...view,
    order: index,
    visible: true,
  }));

  try {
    const saved = localStorage.getItem('vibe-ui-layout-storage');
    if (!saved) return defaultViews;

    const parsedState = JSON.parse(saved).state;
    const savedViewsConfig: Array<{ id: string; order: number; visible: boolean }> = parsedState.sidebarViews || [];
    
    if(savedViewsConfig.length === 0) return defaultViews;

    const baseViewsMap = new Map(SIDEBAR_VIEWS.map(v => [v.id, v]));

    // Reconstruct the array by merging saved config with static definitions.
    const mergedViews = savedViewsConfig
      .map(savedView => {
        const baseView = baseViewsMap.get(savedView.id);
        if (!baseView) return null; // A view was removed from the codebase.
        return {
          ...baseView, // This brings back the icon component and title.
          order: savedView.order,
          visible: savedView.visible,
        };
      })
      .filter((v): v is SidebarView => v !== null);

    // Add any new views that are in the code but not in storage yet.
    SIDEBAR_VIEWS.forEach(baseView => {
      if (!mergedViews.some(v => v.id === baseView.id)) {
        mergedViews.push({ ...baseView, order: mergedViews.length, visible: true });
      }
    });
    
    return mergedViews.sort((a, b) => a.order - b.order);

  } catch (e) {
    // If anything fails, return the safe default.
    return defaultViews;
  }
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
        sidebarViews: state.sidebarViews.map(({ id, order, visible }) => ({ id, order, visible })),
      }),
    }
  )
);