
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Linter, LinterStatus } from '../types';
import { ruffLinter } from '../services/linters/ruffLinter';
import { basicLinter } from '../services/linters/basicLinter';

export const availableLinters: Linter[] = [
  ruffLinter,
  basicLinter,
];

interface LinterState {
  installedLinters: Set<string>;
  linterStatuses: Record<string, LinterStatus>;
  installLinter: (id: string) => void;
  uninstallLinter: (id: string) => void;
  isInstalled: (id: string) => boolean;
  setLinterStatus: (id: string, status: LinterStatus) => void;
}

export const useLinterStore = create<LinterState>()(
  persist(
    (set, get) => ({
      installedLinters: new Set(['ruff-linter', 'basic-linter']), // Install both by default
      linterStatuses: {},

      installLinter: (id) => {
        set((state) => ({
          installedLinters: new Set(state.installedLinters).add(id),
        }));
      },

      uninstallLinter: (id) => {
        set((state) => {
          const newSet = new Set(state.installedLinters);
          newSet.delete(id);
          const newStatuses = { ...state.linterStatuses };
          delete newStatuses[id];
          return { installedLinters: newSet, linterStatuses: newStatuses };
        });
      },
      
      isInstalled: (id) => get().installedLinters.has(id),

      setLinterStatus: (id, status) => set(state => ({
        linterStatuses: { ...state.linterStatuses, [id]: status }
      }))
    }),
    {
      name: 'vibe-linter-storage',
      partialize: (state) => ({
        installedLinters: Array.from(state.installedLinters)
      }),
      // Fix: Use explicit Set<string> type to prevent Set<unknown> inference and ensure return type compatibility with LinterState.
      merge: (persistedState: any, currentState: LinterState): LinterState => {
        const installed = new Set<string>(persistedState?.installedLinters || ['ruff-linter', 'basic-linter']);
        return {
          ...currentState,
          installedLinters: installed,
        };
      },
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name);
          if (!str) return null;
          return JSON.parse(str);
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);