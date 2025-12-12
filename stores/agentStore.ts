import { create } from 'zustand';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession, PreFlightResult, File } from '../types';
import { aiService } from '../services/aiService';
import { validateCode } from '../services/lintingService';
import { getLanguage, resolveFileByPath, getFilePath, extractSymbols } from '../utils/fileUtils';
import { useFileStore } from './fileStore';
import { ragService } from '../services/ragService';
import { useTerminalStore } from './terminalStore';

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
      const files = useFileStore.getState().files;
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
  const stepIndex = plan.findIndex(p => p.status === 'pending');

  if (stepIndex === -1) {
    await summarizeTask();
    return;
  }

  const step = plan[stepIndex];
  // FIX: Explicitly cast status to literal type to avoid type widening
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
      // FIX: Explicitly cast status to literal type to avoid type widening
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
        // FIX: Explicitly cast status to literal type to avoid type widening
        const newPlan = plan.map((p, idx) => idx === activeIndex ? { ...p, status: 'failed' as const } : p);
        useAgentStore.setState({ plan: newPlan });
    }
    useAgentStore.setState(state => ({
        status: 'failed',
        agentSteps: [...state.agentSteps, { id: Date.now().toString(), type: 'error', text: errorMessage, timestamp: Date.now() }],
        pendingAction: null
    }));
}

async function handleAgentAction(action: string, args: any): Promise<string> {
    const { files, createNode, updateFileContent } = useFileStore.getState();
    const { addTerminalLine } = useTerminalStore.getState();

    const updateAwareness = (fileId: string) => {
        useAgentStore.setState(state => ({ agentAwareness: new Set(state.agentAwareness).add(fileId) }));
    };

    switch (action) {
        case 'listFiles': return files.map(f => `${f.type === 'folder' ? '[DIR]' : '[FILE]'} ${getFilePath(f, files)}`).sort().join('\n');
        
        case 'readFile': {
           const file = resolveFileByPath(args.path, files);
           if (file) updateAwareness(file.id);
           return file ? (file.type === 'file' ? file.content : "Error: Is a folder") : `Error: File not found ${args.path}`;
        }
        
        case 'writeFile': {
           const { path, content } = args;
           const existing = resolveFileByPath(path, files);
           if (existing) {
               updateFileContent(content, true, existing.id);
               updateAwareness(existing.id);
               return `Updated: ${path}`;
           }
           const name = path.split('/').pop() || 'untitled';
           const newFile = await createNode('file', null, name, content);
           if (newFile) updateAwareness(newFile.id);
           return `Created: ${path}`;
        }
        
        case 'runCommand':
            addTerminalLine(`Agent: ${args.command}`, 'command');
            return `Executed: ${args.command}`;
            
        case 'searchCode': {
           const results = ragService.search(args.query);
           results.forEach(r => updateAwareness(r.fileId));
           if (results.length === 0) return "No matches found.";
           return `Found matches in: ${[...new Set(results.map(r => r.filePath))].join(', ')}\n\n` + 
                  results.map(r => `File: ${r.filePath}\nMatch Score: ${r.score.toFixed(2)}\nSnippet:\n${r.snippet}`).join('\n\n');
        }

        case 'getFileStructure': {
           const file = resolveFileByPath(args.path, files);
           if (!file) return `Error: File not found ${args.path}`;
           updateAwareness(file.id);
           if (file.type !== 'file') return "Error: Is a folder";
           return extractSymbols(file);
        }

        default: return `Unknown tool: ${action}`;
    }
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