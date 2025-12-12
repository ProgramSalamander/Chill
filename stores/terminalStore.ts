import { create } from 'zustand';
import { TerminalLine, Diagnostic } from '../types';

interface TerminalState {
  lines: TerminalLine[];
  diagnostics: Diagnostic[];
  addTerminalLine: (text: string, type?: TerminalLine['type']) => void;
  setDiagnostics: (diagnostics: Diagnostic[]) => void;
  clearTerminal: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
  lines: [],
  diagnostics: [],
  addTerminalLine: (text, type = 'info') => {
    set((state) => ({
      lines: [...state.lines, { id: Math.random().toString(36).slice(2, 11), text, type, timestamp: Date.now() }],
    }));
  },
  setDiagnostics: (diagnostics) => set({ diagnostics }),
  clearTerminal: () => set({ lines: [] }),
}));
