

import React from 'react';

export interface File {
  id: string;
  name: string;
  type: 'file' | 'folder';
  parentId: string | null;
  isOpen?: boolean;
  language: string;
  content: string;
  committedContent?: string;
  isModified?: boolean;
  history?: {
    past: string[];
    future: string[];
    lastSaved: number;
  };
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
  id:string;
  text: string;
  type: 'info' | 'error' | 'success' | 'command' | 'warning';
  timestamp: number;
}

export interface Commit {
  oid: string;
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
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export type ThemeMode = 'neon' | 'calm' | 'matrix';

export type AgentStepType = 'user' | 'thought' | 'call' | 'result' | 'response' | 'error' | 'plan' | 'summary';
export type AgentRole = 'planner' | 'coder' | 'tester' | 'debugger' | 'user' | 'system';

export interface AgentStep {
  id: string;
  type: AgentStepType;
  text: string;
  toolName?: string;
  toolArgs?: any;
  timestamp: number;
  agentRole?: AgentRole;
}

export interface ProjectMeta {
  id: string;
  name: string;
  lastOpened: number;
}

export type AIProvider = 'gemini' | 'openai';

export interface AIModelConfig {
  provider: AIProvider;
  modelId: string;
  baseUrl: string; 
  apiKey: string;
}

export interface AIModelProfile extends AIModelConfig {
  id: string;
  name: string;
}

export interface AIConfig {
  profiles: AIModelProfile[];
  activeChatProfileId: string | null;
  activeCompletionProfileId: string | null;
}

export interface AIToolCall {
  id: string;
  name: string;
  args: any;
}

export interface AIToolResponse {
  id: string;
  name: string;
  result: any;
}

export interface AIResponse {
  text: string;
  toolCalls?: AIToolCall[];
  usage?: AIUsageMetadata;
}

export interface AIUsageMetadata {
  promptTokenCount: number;
  candidatesTokenCount: number;
  totalTokenCount: number;
  thinkingTokenCount?: number;
}

export interface AISession {
  sendMessage: (props: { message: string, toolResponses?: AIToolResponse[] }) => Promise<AIResponse>;
  sendMessageStream: (props: { message: string, toolResponses?: AIToolResponse[] }) => Promise<AsyncIterable<{ text: string, usage?: AIUsageMetadata }>>;
}

export interface AIProviderAdapter {
  createChatSession(props: {
    systemInstruction: string;
    history?: Message[];
    isAgent?: boolean;
    config: AIModelProfile;
  }): AISession;

  generateText(props: {
    prompt: string;
    config: AIModelProfile;
    options?: {
      temperature?: number;
      maxOutputTokens?: number;
    };
  }): Promise<{ text: string, usage?: AIUsageMetadata }>;

  generateAgentPlan(props: {
    goal: string;
    context: string;
    config: AIModelProfile;
  }): Promise<AgentPlanItem[]>;
}

export interface SidebarViewConfig {
  id: string;
  title: string;
  icon: React.FC<any>;
}

export type SidebarView = SidebarViewConfig & {
  order: number;
  visible: boolean;
};

export type AgentStatus = 'idle' | 'planning' | 'thinking' | 'executing' | 'completed' | 'failed' | 'summarizing' | 'awaiting_changes_review';

export interface AgentPlanItem {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'active' | 'completed' | 'skipped' | 'failed';
  assignedAgent?: AgentRole;
  dependencies?: string[];
}

export interface AgentPendingAction {
  id: string;
  type: 'tool_call';
  toolName: string;
  args: any;
  agentRole: AgentRole;
}

export interface AIPatch {
  id: string;
  fileId: string;
  range: {
    startLineNumber: number;
    startColumn: number;
    endLineNumber: number;
    endColumn: number;
  };
  originalText: string;
  proposedText: string;
  status: 'pending' | 'accepted' | 'rejected';
}

export interface PreFlightCheck {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failure';
  message?: string;
}

export interface PreFlightResult {
  checks: PreFlightCheck[];
  hasErrors: boolean;
  diagnostics: Diagnostic[];
}

export type LinterStatus = 'idle' | 'initializing' | 'ready' | 'error';

export interface Linter {
  id: string;
  name: string;
  description: string;
  supportedLanguages: string[];
  init?: () => Promise<void>;
  lint?: (code: string) => Diagnostic[];
}

export interface ContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'separator';
  shortcut?: string;
}

export interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  items: ContextMenuItem[];
}

declare global {
  interface Window {
    aistudio?: AIStudio;
  }
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}