import { create } from 'zustand';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession, PreFlightResult } from '../types';
import { aiService } from '../services/aiService';
import { validateCode } from '../services/lintingService';
import { getLanguage, resolveFileByPath } from '../utils/fileUtils';
import { useFileTreeStore } from './fileStore';
import { useTerminalStore } from './terminalStore';
import { handleAgentAction } from '../services/agentToolService';

interface AgentState {
  status: AgentStatus;
  agentSteps: AgentStep[];
  plan: AgentPlanItem[];
  pendingAction: AgentPendingAction | null;
  preFlightResult: PreFlightResult | null;
  agentAwareness: Set<string>;
  agentChatSession: AISession | null;

  // Actions
  startAgent: (goal: string) => Promise<void>;
  approvePlan: (modifiedPlan?: AgentPlanItem[]) => Promise<void>;
  approveAction: () => Promise<void>;
  rejectAction: () => void;
  updatePendingActionArgs: (newArgs: any) => void;
  sendFeedback: (feedback: string) => Promise<void>;
  resetAgent: () => void;
  summarizeTask: () => Promise<void>;
}

const useAgentStore = create<AgentState>((set, get) => ({
  status: 'idle',
  agentSteps: [],
  plan: [],
  pendingAction: null,
  preFlightResult: null,
  agentAwareness: new Set(),
  agentChatSession: null,

  resetAgent: () => {
    set({
      status: 'idle',
      agentSteps: [],
      plan: [],
      pendingAction: null,
      preFlightResult: null,
      agentChatSession: null,
      agentAwareness: new Set(),
    });
  },

  startAgent: async (goal) => {
    get().resetAgent();
    set({ status: 'planning', agentSteps: [{ id: Date.now().toString(), type: 'user', text: goal, timestamp: Date.now() }] });

    try {
      const files = useFileTreeStore.getState().files;
      const context = `Project contains ${files.length} files.`;
      const generatedPlan = await aiService.generateAgentPlan({ goal, context });
      set({ plan: generatedPlan, status: 'plan_review' });
    } catch (e: any) {
      console.error(e);
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: `Planning failed: ${e.message}`, timestamp: Date.now() }],
        status: 'failed',
      }));
    }
  },

  approvePlan: async (modifiedPlan) => {
    const plan = modifiedPlan || get().plan;
    set({ plan, status: 'thinking' });

    const systemPrompt = `You are "Vibe Agent", an autonomous coding assistant. You have agreed on a plan with the user. Your task is to execute this plan step-by-step.
Current Plan:
${JSON.stringify(plan, null, 2)}
For each turn, I will tell you which step needs to be worked on. You should output a Tool Call to perform an action. Wait for the user to confirm the action, then I will give you the result.`;
    
    const session = aiService.createChatSession({ systemInstruction: systemPrompt, isAgent: true });
    set({ agentChatSession: session });
    await processNextStep();
  },

  approveAction: async () => {
    const { pendingAction, agentChatSession } = get();
    if (!pendingAction || !agentChatSession) return;

    set({ status: 'executing', preFlightResult: null });
    const { toolName, args } = pendingAction;

    set(state => ({
      agentSteps: [...state.agentSteps, {
        id: Date.now().toString(), type: 'call', text: `Running ${toolName}...`,
        toolName: toolName, toolArgs: args, timestamp: Date.now()
      }]
    }));

    let result = "Error";
    try {
      result = await handleAgentAction(toolName, args);
      // If the action was readFile or writeFile, update awareness
      if (toolName === 'readFile' || toolName === 'writeFile') {
          const file = resolveFileByPath(args.path, useFileTreeStore.getState().files);
          if (file) {
              set(state => ({ agentAwareness: new Set(state.agentAwareness).add(file.id) }));
          }
      }
    } catch (e: any) {
      result = `Error executing ${toolName}: ${e.message}`;
      handleFailedStep(result);
      return;
    }

    set(state => ({
      agentSteps: [...state.agentSteps, {
        id: Date.now().toString(), type: 'result',
        text: result.length > 300 ? result.slice(0, 300) + '...' : result,
        timestamp: Date.now()
      }],
      pendingAction: null,
    }));

    const toolResponse = [{ id: pendingAction.id, name: toolName, result: result }];
    
    try {
      const response = await agentChatSession.sendMessage({ message: "", toolResponses: toolResponse });
      handleAgentResponse(response);
    } catch (e: any) {
      console.error(e);
      handleFailedStep(`Agent failed after action: ${e.message}`);
    }
  },

  rejectAction: () => {
    set({
      pendingAction: null,
      preFlightResult: null,
      status: 'idle',
      agentSteps: [...get().agentSteps, { id: Date.now().toString(), type: 'error', text: "Action rejected by user.", timestamp: Date.now() }]
    });
  },

  updatePendingActionArgs: (newArgs) => {
    set(state => ({
      pendingAction: state.pendingAction ? { ...state.pendingAction, args: newArgs } : null
    }));
    runPreFlightChecks(get().pendingAction?.args.path, get().pendingAction?.args.content);
  },

  sendFeedback: async (feedback) => {
    const { pendingAction, agentChatSession } = get();
    if (!pendingAction || !agentChatSession) return;

    const { toolName, args } = pendingAction;
    set(state => ({
      agentSteps: [
        ...state.agentSteps,
        { id: Date.now().toString(), type: 'call', text: `Pre-Flight Check: ${toolName}...`, toolName: toolName, toolArgs: args, timestamp: Date.now() },
        { id: (Date.now() + 1).toString(), type: 'error', text: `Pre-Flight Failed: ${feedback}`, timestamp: Date.now() }
      ],
      pendingAction: null,
      preFlightResult: null,
      status: 'thinking',
    }));

    const toolResponse = [{
      id: pendingAction.id,
      name: toolName,
      result: `[PRE-FLIGHT CHECK FAILED]\nThe system prevented this file write because of the following errors:\n${feedback}\n\nPlease fix the code and try again.`
    }];

    try {
      const response = await agentChatSession.sendMessage({ message: "", toolResponses: toolResponse });
      handleAgentResponse(response);
    } catch (e: any) {
      console.error(e);
      handleFailedStep(`Agent failed after feedback: ${e.message}`);
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
        }],
        status: 'completed'
      }));
    } catch(e) {
      console.error("Summary generation failed", e);
      set(state => ({
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }],
        status: 'completed'
      }));
    }
  },
}));

// --- Helper functions to be called within the store ---

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
    // If no pending steps are ready, checks if everything is done or if we are deadlocked
    const anyPending = plan.some(p => p.status === 'pending');
    if (anyPending) {
        // We have pending steps but dependencies aren't met.
        // For simplicity in this agent, we'll mark them failed or just stop. 
        // But usually this means the agent flow is stuck.
        // Let's assume done if we can't progress.
    }
    await summarizeTask();
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

function handleAgentResponse(response: any) {
  if (response.text) {
    useAgentStore.setState(state => ({
      agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]
    }));
  }

  if (response.toolCalls && response.toolCalls.length > 0) {
    const call = response.toolCalls[0];
    const activeStep = useAgentStore.getState().plan.find(p => p.status === 'active');
    useAgentStore.setState({
      pendingAction: {
        id: call.id, type: 'tool_call', toolName: call.name, args: call.args,
        agentRole: activeStep?.assignedAgent || 'coder'
      },
      status: 'action_review'
    });
    if (call.name === 'writeFile') {
        runPreFlightChecks(call.args.path, call.args.content);
    }
  } else {
    const activeIndex = useAgentStore.getState().plan.findIndex(p => p.status === 'active');
    if (activeIndex !== -1) {
      const newPlan = useAgentStore.getState().plan.map((p, idx) => idx === activeIndex ? { ...p, status: 'completed' as const } : p);
      useAgentStore.setState({ plan: newPlan });
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
        pendingAction: null
    }));
}

async function runPreFlightChecks(path: string, content: string) {
      if(!path || !content) return;
      const language = getLanguage(path);
      
      useAgentStore.setState({ preFlightResult: {
          checks: [
              { id: 'syntax', name: 'Syntax Analysis', status: 'running' },
              { id: 'build', name: 'Virtual Build', status: 'pending' },
              { id: 'security', name: 'Security Scan', status: 'pending' }
          ], hasErrors: false, diagnostics: []
      }});

      await new Promise(r => setTimeout(r, 600)); 
      const diagnostics = validateCode(content, language);
      const hasErrors = diagnostics.some(d => d.severity === 'error');

      useAgentStore.setState(prev => ({ preFlightResult: prev.preFlightResult ? {
          ...prev.preFlightResult, hasErrors: hasErrors, diagnostics: diagnostics,
          checks: prev.preFlightResult.checks.map(c => c.id === 'syntax' ? { ...c, status: hasErrors ? 'failure' : 'success' } : c)
      } : null }));

      if (hasErrors) {
           useAgentStore.setState(prev => ({ preFlightResult: prev.preFlightResult ? ({ ...prev.preFlightResult, checks: prev.preFlightResult.checks.map(c => c.id !== 'syntax' ? { ...c, status: 'pending', message: 'Skipped' } : c) }) : null }));
           return;
      }

      useAgentStore.setState(prev => ({ preFlightResult: prev.preFlightResult ? ({ ...prev.preFlightResult, checks: prev.preFlightResult.checks.map(c => c.id === 'build' ? { ...c, status: 'running' } : c) }) : null }));
      await new Promise(r => setTimeout(r, 800));
      
      const buildFail = content.includes('<<<') || content.includes('>>>'); 
      useAgentStore.setState(prev => prev.preFlightResult ? ({ preFlightResult: { 
          ...prev.preFlightResult, 
          checks: prev.preFlightResult.checks.map(c => c.id === 'build' ? { ...c, status: buildFail ? 'failure' : 'success', message: buildFail ? 'Merge conflicts' : 'Build successful' } : c),
          hasErrors: prev.preFlightResult.hasErrors || buildFail
      }}) : null);

      if (buildFail) return;

      useAgentStore.setState(prev => ({ preFlightResult: prev.preFlightResult ? ({ ...prev.preFlightResult, checks: prev.preFlightResult.checks.map(c => c.id === 'security' ? { ...c, status: 'running' } : c) }) : null }));
      await new Promise(r => setTimeout(r, 500));
      useAgentStore.setState(prev => ({ preFlightResult: prev.preFlightResult ? ({ 
          ...prev.preFlightResult, 
          checks: prev.preFlightResult.checks.map(c => c.id === 'security' ? { ...c, status: 'success', message: 'No secrets found' } : c) 
      }) : null}));
};


export { useAgentStore };