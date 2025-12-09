

export interface File {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  isOpen?: boolean;
  language: string;
  content: string;
  committedContent?: string; // Kept for logic reference, though we lean on gitService now
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

// Updated Commit to match isomorphic-git ReadCommitResult roughly
export interface Commit {
  oid: string; // SHA
  message: string;
  payload?: string;
  commit: {
      message: string;
      author: {
          name: string;
          email: string;
          timestamp: number;
          timezoneOffset: number;
      };
      committer: {
          name: string;
          email: string;
          timestamp: number;
          timezoneOffset: number;
      };
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

export type AgentStepType = 'user' | 'thought' | 'call' | 'result' | 'response' | 'error';

export interface AgentStep {
  id: string;
  type: AgentStepType;
  text: string;
  toolName?: string;
  toolArgs?: any;
  timestamp: number;
}

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
