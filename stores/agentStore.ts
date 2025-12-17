import { create } from 'zustand';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession, StagedChange } from '../types';
import { aiService } from '../services/aiService';
import { useFileTreeStore } from './fileStore';
import { useUIStore } from './uiStore';
import { handleAgentAction } from '../services/agentToolService';
import { getActiveChatConfig } from '../services/configService';

interface AgentState {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
  stagedChanges: StagedChange[];
  agentAwareness: Set<string>;
  agentChatSession: AISession | null;

  // Actions
  startAgent: (goal: string) => Promise<void>;
  resetAgent: () => void;
  stopAgent: () => void;
  summarizeTask: () => Promise<void>;
  
  // Staged Changes Actions
  addStagedChange: (change: Omit<StagedChange, 'id'>) => void;
  applyChange: (id: string) => Promise<void>;
  rejectChange: (id: string) => void;
  applyAllChanges: () => Promise<void>;
  rejectAllChanges: () => void;
}

const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  agentSteps: [],
  plan: [],
  stagedChanges: [],
  agentAwareness: new Set(),
  agentChatSession: null,

  resetAgent: () => {
    set({
      status: 'idle',
      agentSteps: [],
      plan: [],
      stagedChanges: [],
      agentChatSession: null,
      agentAwareness: new Set(),
    });
  },

  stopAgent: () => {
    const { status } = get();
    // Only allow stopping if it's actually running
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
    get().resetAgent();
    set({ status: 'planning', agentSteps: [{ id: Date.now().toString(), type: 'user', text: goal, timestamp: Date.now() }] });

    try {
      const files = useFileTreeStore.getState().files;
      const context = `Project contains ${files.length} files.`;
      const generatedPlan = await aiService.generateAgentPlan({ goal, context });
      
      set({ plan: generatedPlan, status: 'thinking' });

      const systemPrompt = `You are "Vibe Agent", an autonomous coding assistant executing a plan.
ENVIRONMENT: You are in a browser-based environment. You CANNOT use commands like \`npx create-react-app\`, \`vite\`, \`next\`, or other complex build tools.
WORKFLOW: To create a project boilerplate, you MUST create each file individually using the 'writeFile' tool. For example, to create a React app, first call \`writeFile\` for \`package.json\`, then \`index.html\`, then \`src/App.js\`, etc. Your file system operations will be staged for user review.

Current Plan:
${JSON.stringify(generatedPlan, null, 2)}
For each turn, I will tell you which step needs to be worked on. You should output a Tool Call to perform an action.`;
      
      // FIX: The agent needs an AI model configuration to create a chat session.
      const config = getActiveChatConfig();
      if (!config) {
        throw new Error("No active AI model configured for the agent.");
      }
      const session = aiService.createChatSession({ systemInstruction: systemPrompt, isAgent: true, config });
      set({ agentChatSession: session });
      await processNextStep();

    } catch (e: any) {
      console.error(e);
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: `Planning failed: ${e.message}`, timestamp: Date.now() }],
        status: 'failed',
      }));
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

      if (get().stagedChanges.length > 0) {
        set({ status: 'awaiting_changes_review' });
        useUIStore.getState().setActiveSidebarView('changes');
      } else {
        set({ status: 'completed' });
      }

    } catch(e) {
      console.error("Summary generation failed", e);
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }],
        status: 'completed'
      }));
    }
  },
  
  // --- Staged Changes Actions ---
  addStagedChange: (change) => {
    set(state => ({
      stagedChanges: [...state.stagedChanges, { ...change, id: Date.now().toString() }]
    }));
  },

  applyChange: async (id) => {
    const change = get().stagedChanges.find(c => c.id === id);
    if (!change) return;

    const { createNode, updateFileContent, deleteNode } = useFileTreeStore.getState();

    switch (change.type) {
      case 'create':
        if (change.newContent !== undefined) {
           const pathSegments = change.path.split('/').filter(p => p);
           const name = pathSegments.pop() || 'untitled';
           
           let currentParentId: string | null = null;
           for(const segment of pathSegments) {
               const currentFiles = useFileTreeStore.getState().files;
               const existingFolder = currentFiles.find(f => f.type === 'folder' && f.name === segment && f.parentId === currentParentId);
               if(existingFolder) {
                   currentParentId = existingFolder.id;
               } else {
                   const newFolder = await createNode('folder', currentParentId, segment);
                   if(!newFolder) throw new Error(`Failed to create parent folder ${segment}`);
                   currentParentId = newFolder.id;
               }
           }
           await createNode('file', currentParentId, name, change.newContent);
        }
        break;
      case 'update':
        if (change.fileId && change.newContent !== undefined) {
          updateFileContent(change.newContent, true, change.fileId);
        }
        break;
      case 'delete':
        const fileToDelete = useFileTreeStore.getState().files.find(f => f.id === change.fileId);
        if (fileToDelete) {
          await deleteNode(fileToDelete);
        }
        break;
    }
    
    set(state => ({
        stagedChanges: state.stagedChanges.filter(c => c.id !== id)
    }));
    
    if (get().stagedChanges.length === 0 && get().status === 'awaiting_changes_review') {
        set({ status: 'completed' });
    }
  },

  rejectChange: (id) => {
    set(state => ({
      stagedChanges: state.stagedChanges.filter(c => c.id !== id)
    }));

    if (get().stagedChanges.length === 0 && get().status === 'awaiting_changes_review') {
        set({ status: 'completed' });
    }
  },

  applyAllChanges: async () => {
    const changes = [...get().stagedChanges];
    for (const change of changes) {
        await get().applyChange(change.id);
    }
  },

  rejectAllChanges: () => {
    set({ stagedChanges: [], status: 'completed' });
  }
}));

// --- Helper functions to be called within the store ---

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
      const { result: actionResult, change } = await handleAgentAction(toolName, args);
      result = actionResult;
      
      if (change) {
        useAgentStore.getState().addStagedChange(change);
      }

      // If the action was readFile, update awareness
      if (toolName === 'readFile') {
          const file = useFileTreeStore.getState().files.find(f => f.name === args.path); // Simplified find
          if (file) {
              useAgentStore.setState(state => ({ agentAwareness: new Set(state.agentAwareness).add(file.id) }));
          }
      }
    } catch (e: any) {
      result = `Error executing ${toolName}: ${e.message}`;
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
      handleAgentResponse(response);
    } catch (e: any) {
      console.error(e);
      handleFailedStep(`Agent failed after action: ${e.message}`);
    }
}


async function processNextStep() {
  const { plan, agentChatSession, summarizeTask } = useAgentStore.getState();
  
  // Logic to find the next available step based on dependencies
  const stepIndex = plan.findIndex(p => {
    if (p.status !== 'pending') return false;
    // If dependencies exist, ensure they are all completed or skipped
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
    handleAgentResponse(response);
  } catch (e: any) {
    console.error(e);
    handleFailedStep(`Agent failed to decide next action: ${e.message}`);
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
    
    // All tool calls are executed now, file ops will be staged by the tool service
    await _executeAndContinue(actionToPerform);
    
  } else {
    // No tool calls, assume step is complete
    const activeIndex = useAgentStore.getState().plan.findIndex(p => p.status === 'active');
    if (activeIndex !== -1) {
      const newPlan = useAgentStore.getState().plan.map((p, idx) => idx === activeIndex ? { ...p, status: 'completed' as const } : p);
      useAgentStore.setState({ plan: newPlan });
      processNextStep();
    } else {
      // If no active step, might be the end of the plan
      processNextStep();
    }
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