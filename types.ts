

export interface File {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  isOpen?: boolean;
  language: string;
  content: string;
  committedContent?: string; // The content as it exists in HEAD
  isModified?: boolean; // Editor dirty state (unsaved to disk)
  history?: {
    past: string[];
    future: string[];
    lastSaved: number;
  };
  handle?: any; // FileSystemFileHandle | FileSystemDirectoryHandle
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: MessageRole;
  text: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface TerminalLine {
  id: string;
  text: string;
  type: 'info' | 'error' | 'success' | 'command';
  timestamp: number;
}

export interface Commit {
  id: string;
  message: string;
  timestamp: number;
  author: string;
  stats: {
    added: number;
    modified: number;
    deleted: number;
  };
}

export interface Diagnostic {
  message: string;
  code?: string;
  severity: 'error' | 'warning' | 'info';
  startLine: number; // 1-based
  startColumn: number; // 1-based
  endLine: number; // 1-based
  endColumn: number; // 1-based
}

export type ThemeMode = 'neon' | 'calm' | 'matrix';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}