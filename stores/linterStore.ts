import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Linter } from '../types';
import { ruffLinter } from '../services/linters/ruffLinter';
import { basicLinter } from '../services/linters/basicLinter';

export const availableLinters: Linter[] = [
  ruffLinter,
  basicLinter,
];

interface LinterState {
  installedLinters: Set<string>;
  installLinter: (id: string) => void;
  uninstallLinter: (id: string) => void;
  isInstalled: (id: string) => boolean;
}

export const useLinterStore = create<LinterState>()(
  persist(
    (set, get) => ({
      installedLinters: new Set(['ruff-linter', 'basic-linter']), // Install both by default

      installLinter: (id) => {
        set((state) => ({
          installedLinters: new Set(state.installedLinters).add(id),
        }));
        // Future: Trigger initialization of the newly installed linter if needed
      },

      uninstallLinter: (id) => {
        set((state) => {
          const newSet = new Set(state.installedLinters);
          newSet.delete(id);
          return { installedLinters: newSet };
        });
      },
      
      isInstalled: (id) => get().installedLinters.has(id),
    }),
    {
      name: 'vibe-linter-storage',
      // Custom serialization/deserialization for Set
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          const { state } = JSON.parse(str);
          return {
            state: {
              ...state,
              installedLinters: new Set(state.installedLinters),
            },
          };
        },
        setItem: (name, newValue) => {
          const str = JSON.stringify({
            state: {
              ...newValue.state,
              installedLinters: Array.from(newValue.state.installedLinters),
            },
          });
          localStorage.setItem(name, str);
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
