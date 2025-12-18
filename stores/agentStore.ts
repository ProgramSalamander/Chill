
import { create } from 'zustand';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession, AIPatch } from '../types';
import { aiService, handleAgentAction, getActiveChatConfig, errorService } from '../services';
import { useFileTreeStore } from './fileStore';
import { useUIStore } from './uiStore';
import { useUsageStore } from './usageStore';

interface AgentState {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
  patches: AIPatch[];
  agentAwareness: Set<string>;
  agentChatSession: AISession | null;

  startAgent: (goal: string) => Promise<void>;
  resetAgent: () => void;
  stopAgent: () => void;
  summarizeTask: () => Promise<void>;
  
  addPatch: (patch: Omit<AIPatch, 'id' | 'status'>) => void;
  acceptPatch: (patchId: string) => void;
  rejectPatch: (patchId: string) => void;
  
  applyAllChanges: () => Promise<void>;
  rejectAllChanges: () => void;
}

const generatePatchId = () => `patch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  agentSteps: [],
  plan: [],
  patches: [],
  agentAwareness: new Set(),
  agentChatSession: null,

  resetAgent: () => {
    set({
      status: 'idle',
      agentSteps: [],
      plan: [],
      patches: [],
      agentChatSession: null,
      agentAwareness: new Set(),
    });
  },

  stopAgent: () => {
    const { status } = get();
    if (status !== 'thinking' && status !== 'executing' && status !== 'planning') {
      return;
    }

    set(state => ({
      status: 'failed',
      agentSteps: [...state.agentSteps, {
        id: Date.now().toString(),
        type: 'error',
        text: 'Execution stopped by user.',
        timestamp: Date.now()
      }]
    }));
  },

  startAgent: async (goal) => {
    const state = get();
    const isContinuation = state.agentChatSession !== null && 
      (state.status === 'completed' || state.status === 'failed' || state.status === 'awaiting_changes_review' || state.status === 'idle' && state.agentSteps.length > 0);

    if (!isContinuation) {
      get().resetAgent();
      set({ status: 'planning', agentSteps: [{ id: Date.now().toString(), type: 'user', text: goal, timestamp: Date.now() }] });

      try {
        const files = useFileTreeStore.getState().files;
        const context = `Project contains ${files.length} files.`;
        const generatedPlan = await aiService.generateAgentPlan({ goal, context });
        
        set({ plan: generatedPlan, status: 'thinking' });

        const systemPrompt = `You are "Vibe Agent", an autonomous coding assistant executing a plan.
ENVIRONMENT: You are in a browser-based environment. You CANNOT use commands like \`npx create-react-app\`, \`vite\`, \`next\`, or other complex build tools.
WORKFLOW: To create a project boilerplate, you MUST create each file individually using the 'writeFile' tool. Your file modifications will be staged as AI Patches for user review.

Current Plan:
${JSON.stringify(generatedPlan, null, 2)}
For each turn, I will tell you which step needs to be worked on. You should output a Tool Call to perform an action.`;
        
        const config = getActiveChatConfig();
        if (!config) {
          throw new Error("No active AI model configured for the agent.");
        }
        const session = aiService.createChatSession({ systemInstruction: systemPrompt, isAgent: true, config });
        set({ agentChatSession: session });
        await processNextStep();

      } catch (e: any) {
        errorService.report(e, "Agent Start (Planning)");
        set(state => ({
          agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: `Planning failed: ${e.message}`, timestamp: Date.now() }],
          status: 'failed',
        }));
      }
    } else {
      set(state => ({
        status: 'thinking',
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'user', text: goal, timestamp: Date.now() }]
      }));

      try {
        const session = state.agentChatSession!;
        const response = await session.sendMessage({ 
          message: `The user has provided a follow-up instruction: "${goal}". Please analyze this feedback. If it requires new actions, perform them now. If the current plan needs updates, state your updated approach then use tools. If you are finished, summarize.` 
        });
        handleAgentResponse(response);
      } catch (e: any) {
        errorService.report(e, "Agent Continuation");
        set(state => ({
          agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: `Continuation failed: ${e.message}`, timestamp: Date.now() }],
          status: 'failed',
        }));
      }
    }
  },

  summarizeTask: async () => {
    const { agentChatSession } = get();
    if (!agentChatSession) {
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }],
        status: 'completed'
      }));
      return;
    }

    set({ status: 'summarizing' });
    try {
      const summaryResponse = await agentChatSession.sendMessage({ message: "Excellent work. All planned steps are complete. Please provide a friendly and concise summary for the user in markdown. Briefly list the key files you created or modified and what was accomplished. Frame it as a successful hand-off. Start with a `### Summary` heading." });
      
      set(state => ({
        agentSteps: [...state.agentSteps, { 
          id: Date.now().toString(), 
          type: 'summary', 
          text: summaryResponse.text || "Task completed. I have updated the necessary files.", 
          timestamp: Date.now() 
        }]
      }));

      if (get().patches.length > 0) {
        set({ status: 'awaiting_changes_review' });
        useUIStore.getState().setActiveSidebarView('changes');
      } else {
        set({ status: 'completed' });
      }

    } catch(e) {
      errorService.report(e, "Agent Summary Generation", { severity: 'warning' });
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }],
        status: 'completed'
      }));
    }
  },
  
  addPatch: (patch) => {
    set(state => {
      const existingPatchIndex = state.patches.findIndex(p => p.fileId === patch.fileId && p.status === 'pending');
      
      if (existingPatchIndex !== -1) {
        const updatedPatches = [...state.patches];
        const existing = updatedPatches[existingPatchIndex];
        
        updatedPatches[existingPatchIndex] = {
          ...existing,
          proposedText: patch.proposedText,
          range: patch.range, 
        };
        
        return { patches: updatedPatches };
      }

      return {
        patches: [...state.patches, { ...patch, id: generatePatchId(), status: 'pending' }]
      };
    });
  },

  acceptPatch: (patchId) => {
    const patch = get().patches.find(p => p.id === patchId);
    if (!patch) return;
    
    set(state => ({
      patches: state.patches.map(p => p.id === patchId ? { ...p, status: 'accepted' } : p)
    }));

    useFileTreeStore.getState().updateFileContent(patch.proposedText, true, patch.fileId);
    const file = useFileTreeStore.getState().files.find(f => f.id === patch.fileId);
    if (file) {
        useFileTreeStore.getState().saveFile(file);
    }

    set(state => ({
      patches: state.patches.filter(p => p.id !== patchId)
    }));

    if (get().patches.length === 0 && get().status === 'awaiting_changes_review') {
      set({ status: 'completed' });
    }
  },

  rejectPatch: (patchId) => {
    set(state => ({
      patches: state.patches.map(p => p.id === patchId ? { ...p, status: 'rejected' } : p)
    }));

    set(state => ({
      patches: state.patches.filter(p => p.id !== patchId)
    }));

    if (get().patches.length === 0 && get().status === 'awaiting_changes_review') {
      set({ status: 'completed' });
    }
  },

  applyAllChanges: async () => {
    const patches = [...get().patches];
    for (const patch of patches) {
      get().acceptPatch(patch.id);
    }
    useFileTreeStore.getState().saveAllFiles();
  },

  rejectAllChanges: () => {
    set({ patches: [], status: 'completed' });
  }
}));

async function _executeAndContinue(action: AgentPendingAction) {
    const { toolName, args } = action;

    useAgentStore.setState({ status: 'executing' });

    useAgentStore.setState(state => ({
      agentSteps: [...state.agentSteps, {
        id: Date.now().toString(), type: 'call', text: `Running ${toolName}...`,
        toolName: toolName, toolArgs: args, timestamp: Date.now()
      }],
    }));

    let result = "Error";
    try {
      const actionResult = await handleAgentAction(toolName, args);
      result = actionResult.result;
      
      if (toolName === 'fs_readFile') {
          const file = useFileTreeStore.getState().files.find(f => f.name === args.path);
          if (file) {
              useAgentStore.setState(state => ({ agentAwareness: new Set(state.agentAwareness).add(file.id) }));
          }
      }
    } catch (e: any) {
      result = errorService.report(e, `Agent Execute Tool: ${toolName}`, { silent: true });
      handleFailedStep(result);
      return;
    }

    useAgentStore.setState(state => ({
      agentSteps: [...state.agentSteps, {
        id: Date.now().toString(), type: 'result',
        text: result.length > 300 ? result.slice(0, 300) + '...' : result,
        timestamp: Date.now()
      }],
    }));
    
    const { agentChatSession } = useAgentStore.getState();
    if (!agentChatSession) return;

    const toolResponse = [{ id: action.id, name: toolName, result: result }];
    
    try {
      const response = await agentChatSession.sendMessage({ message: "", toolResponses: toolResponse });
      
      if (response.usage) {
          const config = getActiveChatConfig();
          if (config) {
              useUsageStore.getState().recordUsage(config.modelId, config.provider, response.usage, 'agent');
          }
      }

      handleAgentResponse(response);
    } catch (e: any) {
      const msg = errorService.report(e, "Agent Handle Response");
      handleFailedStep(`Agent failed after action: ${msg}`);
    }
}


async function processNextStep() {
  const { plan, agentChatSession, summarizeTask } = useAgentStore.getState();
  
  const stepIndex = plan.findIndex(p => {
    if (p.status !== 'pending') return false;
    if (p.dependencies && p.dependencies.length > 0) {
      const allDepsMet = p.dependencies.every(depId => {
        const dep = plan.find(d => d.id === depId);
        return dep && (dep.status === 'completed' || dep.status === 'skipped');
      });
      if (!allDepsMet) return false;
    }
    return true;
  });

  if (stepIndex === -1) {
    const anyPending = plan.some(p => p.status === 'pending');
    if (!anyPending) {
        await summarizeTask();
    } else {
        handleFailedStep("Agent deadlocked. Could not execute pending steps due to unmet dependencies.");
    }
    return;
  }

  const step = plan[stepIndex];
  const updatedPlan = plan.map((p, idx) => idx === stepIndex ? { ...p, status: 'active' as const } : p);
  useAgentStore.setState({ plan: updatedPlan, status: 'thinking' });

  if (!agentChatSession) return;

  const prompt = `We are working on Step ${stepIndex + 1}: "${step.title}" - ${step.description}. What is the next action?`;

  try {
    const response = await agentChatSession.sendMessage({ message: prompt });
    
    if (response.usage) {
        const config = getActiveChatConfig();
        if (config) {
            useUsageStore.getState().recordUsage(config.modelId, config.provider, response.usage, 'agent');
        }
    }

    handleAgentResponse(response);
  } catch (e: any) {
    const msg = errorService.report(e, "Agent Step Decision");
    handleFailedStep(`Agent failed to decide next action: ${msg}`);
  }
}

async function handleAgentResponse(response: any) {
  if (response.text) {
    useAgentStore.setState(state => ({
      agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]
    }));
  }

  if (response.toolCalls && response.toolCalls.length > 0) {
    const call = response.toolCalls[0];

    const actionToPerform: AgentPendingAction = {
        id: call.id, type: 'tool_call', toolName: call.name, args: call.args,
        agentRole: useAgentStore.getState().plan.find(p => p.status === 'active')?.assignedAgent || 'coder'
    };
    
    await _executeAndContinue(actionToPerform);
    
  } else {
    const activeIndex = useAgentStore.getState().plan.findIndex(p => p.status === 'active');
    if (activeIndex !== -1) {
      const newPlan = useAgentStore.getState().plan.map((p, idx) => idx === activeIndex ? { ...p, status: 'completed' as const } : p);
      useAgentStore.setState({ plan: newPlan });
      processNextStep();
    } else {
      const { status } = useAgentStore.getState();
      if (status === 'thinking' || status === 'executing') {
         setAgentStatusAfterTurn();
      }
    }
  }
}

function setAgentStatusAfterTurn() {
    const { patches } = useAgentStore.getState();
    if (patches.length > 0) {
        useAgentStore.setState({ status: 'awaiting_changes_review' });
    } else {
        useAgentStore.setState({ status: 'completed' });
    }
}

function handleFailedStep(errorMessage: string) {
    const plan = useAgentStore.getState().plan;
    const activeIndex = plan.findIndex(p => p.status === 'active');
    if (activeIndex !== -1) {
        const newPlan = plan.map((p, idx) => idx === activeIndex ? { ...p, status: 'failed' as const } : p);
        useAgentStore.setState({ plan: newPlan });
    }
    useAgentStore.setState(state => ({
        status: 'failed',
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: errorMessage, timestamp: Date.now() }],
    }));
}

export { useAgentStore };
