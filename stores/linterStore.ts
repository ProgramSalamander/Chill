
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Linter, LinterStatus } from '../types';

export const availableLinters: Linter[] = [
  {
    id: 'ruff-linter',
    name: 'Ruff',
    description: 'An extremely fast Python linter and code formatter, written in Rust (WASM).',
    supportedLanguages: ['python'],
  },
  {
    id: 'basic-linter',
    name: 'Basic Syntax Check',
    description: 'A simple syntax checker for unbalanced brackets, braces, and parentheses.',
    supportedLanguages: ['javascript', 'typescript', 'json', 'css', 'jsx', 'tsx'],
  },
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
      installedLinters: new Set(['ruff-linter', 'basic-linter']), 
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
