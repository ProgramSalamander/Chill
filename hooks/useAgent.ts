

import { useState, useRef, useCallback } from 'react';
import { AgentStep, AgentStatus, AgentPlanItem, AgentPendingAction, AISession } from '../types';
import { createChatSession, generateAgentPlan } from '../services/geminiService';
import { ragService } from '../services/ragService'; // We might need this for plan context, or pass it in

export const useAgent = (
  onAgentAction: (action: string, args: any) => Promise<string>,
  files: any[], // Pass files to generate context for planning
) => {
  // State
  const [status, setStatus] = useState<AgentStatus>('idle');
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [plan, setPlan] = useState<AgentPlanItem[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction | null>(null);
  
  // Refs
  const agentChatRef = useRef<AISession | null>(null);
  
  const resetAgent = () => {
      setStatus('idle');
      setAgentSteps([]);
      setPlan([]);
      setPendingAction(null);
      agentChatRef.current = null;
  };

  // 1. Start Phase: Generate Plan
  const startAgent = async (goal: string) => {
      resetAgent();
      setStatus('planning');
      
      // Log user goal
      setAgentSteps([{
          id: Date.now().toString(),
          type: 'user',
          text: goal,
          timestamp: Date.now()
      }]);

      try {
          // Generate Context
          // Simple context: list of top-level files or just nothing for now
          const context = `Project contains ${files.length} files.`; // Could be richer
          
          const generatedPlan = await generateAgentPlan(goal, context);
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
      
      // Initialize Chat Session with the Goal and the Plan
      const systemPrompt = `You are "Vibe Agent", an autonomous coding assistant.
      You have agreed on a plan with the user.
      Your task is to execute this plan step-by-step.
      
      Current Plan:
      ${JSON.stringify(modifiedPlan || plan, null, 2)}
      
      For each turn, I will tell you which step needs to be worked on.
      You should output a Tool Call to perform an action (e.g., readFile, writeFile).
      Wait for the user to confirm the action, then I will give you the result.
      `;
      
      agentChatRef.current = createChatSession(systemPrompt, [], true);
      
      // Kick off execution of the first pending step
      await processNextStep(modifiedPlan || plan);
  };

  // 3. Execution Logic
  const processNextStep = async (currentPlan: AgentPlanItem[]) => {
      // Find first pending step
      const stepIndex = currentPlan.findIndex(p => p.status === 'pending');
      
      if (stepIndex === -1) {
          setStatus('completed');
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'response', text: "All steps completed successfully.", timestamp: Date.now() }]);
          return;
      }
      
      const step = currentPlan[stepIndex];
      
      // Mark step active visually
      const updatedPlan = [...currentPlan];
      updatedPlan[stepIndex] = { ...step, status: 'active' };
      setPlan(updatedPlan);
      
      // Prompt AI for action
      if (!agentChatRef.current) return;
      
      setStatus('thinking');
      const prompt = `We are working on Step ${stepIndex + 1}: "${step.title}" - ${step.description}. What is the next action?`;
      
      try {
          const response = await agentChatRef.current.sendMessage({ message: prompt });
          
          if (response.text) {
               setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'thought', text: response.text, timestamp: Date.now() }]);
          }

          if (response.toolCalls && response.toolCalls.length > 0) {
              const call = response.toolCalls[0]; // Handle one at a time for interactive mode
              setPendingAction({
                  id: call.id,
                  type: 'tool_call',
                  toolName: call.name,
                  args: call.args
              });
              setStatus('action_review');
          } else {
              // No tool call means the model thinks the step (or at least this turn) is done without action, 
              // or it just wants to talk.
              // We'll assume if it didn't call a tool, it might be done with the step or asking for info.
              // For simplicity, let's auto-advance the step if it says "Done" or similar, but 
              // usually we want it to verify.
              // Let's just ask it: "Did you complete the step?"
              
              // For now, if no tool, we just mark step complete and loop. 
              // But real agents usually explicitely say they are done.
              // Let's assume if no tool call, it's just a thought, and we loop unless it says "Step Complete".
              
              if (response.text.toLowerCase().includes('step complete') || response.text.toLowerCase().includes('done')) {
                  updatedPlan[stepIndex].status = 'completed';
                  setPlan(updatedPlan);
                  await processNextStep(updatedPlan);
              } else {
                  // If it didn't do anything, maybe force it or just loop? 
                  // Let's treat it as a comment and wait? No, we need to drive it.
                  // We'll mark step complete to prevent infinite loops of chatting for this demo.
                  updatedPlan[stepIndex].status = 'completed';
                  setPlan(updatedPlan);
                  await processNextStep(updatedPlan);
              }
          }

      } catch (e: any) {
          console.error(e);
          setStatus('failed');
          setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: e.message, timestamp: Date.now() }]);
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
      }

      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'result',
          text: result.length > 300 ? result.slice(0, 300) + '...' : result,
          timestamp: Date.now()
      }]);
      
      setPendingAction(null);
      
      // Feed result back
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
               // More tools needed for this step
               setPendingAction({
                  id: response.toolCalls[0].id,
                  type: 'tool_call',
                  toolName: response.toolCalls[0].name,
                  args: response.toolCalls[0].args
               });
               setStatus('action_review');
           } else {
               // Step likely done
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
      // Just clear pending and ask AI to try something else? 
      // Or fail the step.
      setPendingAction(null);
      // For now, let's stop.
      setStatus('idle'); 
      setAgentSteps(prev => [...prev, { id: Date.now().toString(), type: 'error', text: "Action rejected by user.", timestamp: Date.now() }]);
  };
  
  // Allow user to modify the proposed action args before approving
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
      startAgent,
      approvePlan,
      approveAction,
      rejectAction,
      updatePendingActionArgs,
      setAgentSteps
  };
};