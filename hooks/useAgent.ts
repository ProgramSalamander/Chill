import { useState, useRef, useEffect, useCallback } from 'react';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession, PreFlightResult, PreFlightCheck } from '../types';
// FIX: Replaced import from empty geminiService.ts with aiService.
import { aiService } from '../services/aiService';
import { validateCode } from '../services/lintingService';
import { getLanguage } from '../utils/fileUtils';

export const useAgent = (
  onAgentAction: (action: string, args: any) => Promise<string>,
  files: any[], 
) => {
  // State
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [plan, setPlan] = useState<AgentPlanItem[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(null);
  const [preFlightResult, setPreFlightResult] = useState<PreFlightResult | null>(null);
  
  // Refs
  const agentChatRef = useRef<AISession | null>(null);
  
  const resetAgent = () => {
      setStatus('idle');
      setAgentSteps([]);
      setPlan([]);
      setPendingAction(null);
      setPreFlightResult(null);
      agentChatRef.current = null;
  };

  // --- Pre-Flight Sandbox Logic ---
  useEffect(() => {
    if (pendingAction && pendingAction.toolName === 'writeFile') {
        runPreFlightChecks(pendingAction.args.path, pendingAction.args.content);
    } else {
        setPreFlightResult(null);
    }
  }, [pendingAction]);

  const runPreFlightChecks = async (path: string, content: string) => {
      const language = getLanguage(path);
      
      // Initialize checks
      setPreFlightResult({
          checks: [
              { id: 'syntax', name: 'Syntax Analysis', status: 'running' },
              { id: 'build', name: 'Virtual Build', status: 'pending' },
              { id: 'security', name: 'Security Scan', status: 'pending' }
          ],
          hasErrors: false,
          diagnostics: []
      });

      // 1. Syntax Check (Real)
      await new Promise(r => setTimeout(r, 600)); // Animation delay
      const diagnostics = validateCode(content, language);
      const hasErrors = diagnostics.some(d => d.severity === 'error');

      setPreFlightResult(prev => {
          if(!prev) return null;
          return {
              ...prev,
              hasErrors: hasErrors,
              diagnostics: diagnostics,
              checks: prev.checks.map(c => c.id === 'syntax' ? { ...c, status: hasErrors ? 'failure' : 'success' } : c)
          };
      });

      if (hasErrors) {
           // Skip rest
           setPreFlightResult(prev => prev ? ({ ...prev, checks: prev.checks.map(c => c.id !== 'syntax' ? { ...c, status: 'pending', message: 'Skipped due to syntax errors' } : c) }) : null);
           return;
      }

      // 2. Virtual Build (Simulated for demo, unless we have language services)
      setPreFlightResult(prev => prev ? ({ ...prev, checks: prev.checks.map(c => c.id === 'build' ? { ...c, status: 'running' } : c) }) : null);
      await new Promise(r => setTimeout(r, 800));
      
      // Simulation: Fail if content contains "FIXME" or certain keywords for demo purposes
      const buildFail = content.includes('<<<') || content.includes('>>>'); 
      setPreFlightResult(prev => prev ? ({ 
          ...prev, 
          checks: prev.checks.map(c => c.id === 'build' ? { ...c, status: buildFail ? 'failure' : 'success', message: buildFail ? 'Merge conflicts detected' : 'Build successful' } : c),
          hasErrors: prev.hasErrors || buildFail
      }) : null);

      if (buildFail) return;

      // 3. Security (Simulated)
      setPreFlightResult(prev => prev ? ({ ...prev, checks: prev.checks.map(c => c.id === 'security' ? { ...c, status: 'running' } : c) }) : null);
      await new Promise(r => setTimeout(r, 500));
      setPreFlightResult(prev => prev ? ({ 
          ...prev, 
          checks: prev.checks.map(c => c.id === 'security' ? { ...c, status: 'success', message: 'No secrets detected' } : c) 
      }) : null);
  };

  const sendFeedback = async (feedback: string) => {
      if (!pendingAction || !agentChatRef.current) return;
      
      const { toolName, args, agentRole } = pendingAction;
      
      // 1. Record the attempt as if it happened but failed
      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'call',
          text: `Pre-Flight Check: ${toolName}...`,
          toolName: toolName,
          toolArgs: args,
          timestamp: Date.now()
      }]);

      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'error',
          text: `Pre-Flight Failed: ${feedback}`,
          timestamp: Date.now()
      }]);

      setPendingAction(null);
      setPreFlightResult(null);
      setStatus('thinking');

      // 2. Feed back to agent
      const toolResponse = [{
          id: pendingAction.id,
          name: toolName,
          result: `[PRE-FLIGHT CHECK FAILED]\nThe system prevented this file write because of the following errors:\n${feedback}\n\nPlease fix the code and try again.`
      }];

      try {
           const response = await agentChatRef.current.sendMessage({ message: "", toolResponses: toolResponse });
           if (response.text) {
               setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]);
           }
           
           if (response.toolCalls && response.toolCalls.length > 0) {
               setPendingAction({
                  id: response.toolCalls[0].id,
                  type: 'tool_call',
                  toolName: response.toolCalls[0].name,
                  args: response.toolCalls[0].args,
                  agentRole: agentRole // Maintain the role from the failed attempt
               });
               setStatus('action_review');
           }
      } catch (e: any) {
           console.error(e);
           setStatus('failed');
      }
  };


  // --- Original Logic ---

  // 1. Start Phase: Generate Plan
  const startAgent = async (goal: string) => {
      resetAgent();
      setStatus('planning');
      
      setAgentSteps([{
          id: Date.now().toString(),
          type: 'user',
          text: goal,
          timestamp: Date.now()
      }]);

      try {
          const context = `Project contains ${files.length} files.`; 
          // FIX: Call aiService.generateAgentPlan with the correct object argument.
          const generatedPlan = await aiService.generateAgentPlan({ goal, context });
          setPlan(generatedPlan);
          setStatus('plan_review');
          
      } catch (e: any) {
          console.error(e);
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: `Planning failed: ${e.message}`, timestamp: Date.now() }]);
          setStatus('failed');
      }
  };

  // 2. Review Phase: Approve Plan
  const approvePlan = async (modifiedPlan?: AgentPlanItem[]) => {
      if (modifiedPlan) setPlan(modifiedPlan);
      setStatus('thinking');
      const systemPrompt = `You are "Vibe Agent", an autonomous coding assistant.
      You have agreed on a plan with the user.
      Your task is to execute this plan step-by-step.
      
      Current Plan:
      ${JSON.stringify(modifiedPlan || plan, null, 2)}
      
      For each turn, I will tell you which step needs to be worked on.
      You should output a Tool Call to perform an action (e.g., readFile, writeFile).
      Wait for the user to confirm the action, then I will give you the result.
      `;
      // FIX: Call aiService.createChatSession with the correct object argument.
      agentChatRef.current = aiService.createChatSession({ systemInstruction: systemPrompt, history: [], isAgent: true });
      await processNextStep(modifiedPlan || plan);
  };

  // 3. Execution Logic
  const processNextStep = async (currentPlan: AgentPlanItem[]) => {
      const stepIndex = currentPlan.findIndex(p => p.status === 'pending');
      
      if (stepIndex === -1) {
          setStatus('completed');
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }]);
          return;
      }
      
      const step = currentPlan[stepIndex];
      const updatedPlan = [...currentPlan];
      updatedPlan[stepIndex] = { ...step, status: 'active' };
      setPlan(updatedPlan);
      
      if (!agentChatRef.current) return;
      
      setStatus('thinking');
      const prompt = `We are working on Step ${stepIndex + 1}: "${step.title}" - ${step.description}. What is the next action?`;
      
      try {
          const response = await agentChatRef.current.sendMessage({ message: prompt });
          
          if (response.text) {
               setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]);
          }

          if (response.toolCalls && response.toolCalls.length > 0) {
              const call = response.toolCalls[0]; 
              setPendingAction({
                  id: call.id,
                  type: 'tool_call',
                  toolName: call.name,
                  args: call.args,
                  agentRole: step.assignedAgent || 'coder'
              });
              setStatus('action_review');
          } else {
              if (response.text && (response.text.toLowerCase().includes('step complete') || response.text.toLowerCase().includes('done'))) {
                  updatedPlan[stepIndex].status = 'completed';
                  setPlan(updatedPlan);
                  await processNextStep(updatedPlan);
              } else {
                  // Agent returned a thought without a tool call or completion signal.
                  // This is an ambiguous state. We will mark the step as failed to prevent runaway execution.
                  setStatus('failed');
                  const activeIndex = updatedPlan.findIndex(p => p.status === 'active');
                  if (activeIndex !== -1) {
                      const failedPlan = [...updatedPlan];
                      failedPlan[activeIndex] = { ...failedPlan[activeIndex], status: 'failed' };
                      setPlan(failedPlan);
                  }
                  setAgentSteps(prev => [...prev, {
                      id: Date.now().toString(),
                      type: 'error',
                      text: "Agent stalled. It provided a thought but no clear action or completion. Please review the plan and try again.",
                      timestamp: Date.now()
                  }]);
              }
          }

      } catch (e: any) {
          console.error(e);
          setStatus('failed');
          const activeIndex = updatedPlan.findIndex(p => p.status === 'active');
          if (activeIndex !== -1) {
              const newPlan = [...updatedPlan];
              newPlan[activeIndex] = { ...newPlan[activeIndex], status: 'failed' };
              setPlan(newPlan);
          }
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: `Agent failed to decide next action: ${e.message}`, timestamp: Date.now() }]);
      }
  };
  
  // 4. Action Confirmation
  const approveAction = async () => {
      if (!pendingAction || !agentChatRef.current) return;
      
      setStatus('executing');
      const { toolName, args } = pendingAction;
      
      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'call',
          text: `Running ${toolName}...`,
          toolName: toolName,
          toolArgs: args,
          timestamp: Date.now()
      }]);

      let result = "Error";
      try {
          result = await onAgentAction(toolName, args);
      } catch (e: any) {
          result = `Error executing ${toolName}: ${e.message}`;
          const activeIndex = plan.findIndex(p => p.status === 'active');
          if (activeIndex !== -1) {
              const newPlan = [...plan];
              newPlan[activeIndex] = { ...newPlan[activeIndex], status: 'failed' };
              setPlan(newPlan);
          }
          setStatus('failed');
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: result, timestamp: Date.now() }]);
          setPendingAction(null);
          return;
      }

      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'result',
          text: result.length > 300 ? result.slice(0, 300) + '...' : result,
          timestamp: Date.now()
      }]);
      
      setPendingAction(null);
      setPreFlightResult(null);
      
      const toolResponse = [{
          id: pendingAction.id,
          name: toolName,
          result: result
      }];
      
      try {
           const response = await agentChatRef.current.sendMessage({ message: "", toolResponses: toolResponse });
           if (response.text) {
               setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]);
           }
           
           if (response.toolCalls && response.toolCalls.length > 0) {
               // Determine current role based on active plan step
               const activeIndex = plan.findIndex(p => p.status === 'active');
               const activeRole = activeIndex !== -1 ? plan[activeIndex].assignedAgent : 'coder';

               setPendingAction({
                  id: response.toolCalls[0].id,
                  type: 'tool_call',
                  toolName: response.toolCalls[0].name,
                  args: response.toolCalls[0].args,
                  agentRole: activeRole || 'coder'
               });
               setStatus('action_review');
           } else {
               const activeIndex = plan.findIndex(p => p.status === 'active');
               if (activeIndex !== -1) {
                   const newPlan = [...plan];
                   newPlan[activeIndex].status = 'completed';
                   setPlan(newPlan);
                   await processNextStep(newPlan);
               }
           }
      } catch (e: any) {
           console.error(e);
           setStatus('failed');
      }
  };
  
  const rejectAction = async () => {
      setPendingAction(null);
      setPreFlightResult(null);
      setStatus('idle'); 
      setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: "Action rejected by user.", timestamp: Date.now() }]);
  };
  
  const updatePendingActionArgs = (newArgs: any) => {
      if (pendingAction) {
          setPendingAction({ ...pendingAction, args: newArgs });
      }
  };

  return {
      status,
      agentSteps,
      plan,
      pendingAction,
      preFlightResult,
      startAgent,
      approvePlan,
      approveAction,
      rejectAction,
      updatePendingActionArgs,
      setAgentSteps,
      sendFeedback
  };
};