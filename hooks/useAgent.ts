
import { useState, useRef } from 'react';
import { AgentStep, AISession } from '../types';
import { createChatSession } from '../services/geminiService';

export const useAgent = (onAgentAction: (action: string, args: any) => Promise<string>) => {
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [isAgentRunning, setIsAgentRunning] = useState(false);
  const agentChatRef = useRef<AISession | null>(null);

  const runAgent = async (goal: string) => {
      setIsAgentRunning(true);
      setAgentSteps(prev => [...prev, {
          id: Date.now().toString(),
          type: 'user',
          text: goal,
          timestamp: Date.now()
      }]);

      try {
          const systemPrompt = `You are an autonomous coding agent called "Vibe Agent".
          Your goal is to complete the user's request by autonomously exploring the codebase, reading files, and writing code.
          
          Guidelines:
          1. Start by exploring the codebase using 'listFiles' to understand the structure.
          2. Read relevant files using 'readFile'.
          3. Plan your changes.
          4. Execute changes using 'writeFile'.
          5. Verify your work (conceptually).
          
          Always keep the user informed of what you are doing. If you need to "think", just output text.
          If you need to perform an action, use the available tools.
          `;
          
          const chat = createChatSession(systemPrompt, [], true);
          agentChatRef.current = chat;
          
          let currentInput = goal;
          let keepGoing = true;
          let turns = 0;
          const MAX_TURNS = 15;

          while (keepGoing && turns < MAX_TURNS) {
              turns++;
              
              let response = await chat.sendMessage({ message: currentInput });
              currentInput = "";

              if (response.text) {
                  setAgentSteps(prev => [...prev, {
                      id: Math.random().toString(),
                      type: 'thought',
                      text: response.text,
                      timestamp: Date.now()
                  }]);
              }

              const calls = response.toolCalls;
              
              if (calls && calls.length > 0) {
                  const toolResponses: any[] = [];
                  
                  for (const call of calls) {
                      setAgentSteps(prev => [...prev, {
                          id: Math.random().toString(),
                          type: 'call',
                          text: `Running ${call.name}...`,
                          toolName: call.name,
                          toolArgs: call.args,
                          timestamp: Date.now()
                      }]);

                      let result = "Error";
                      try {
                          result = await onAgentAction(call.name, call.args);
                      } catch (e: any) {
                          result = `Error executing ${call.name}: ${e.message}`;
                      }
                      
                      setAgentSteps(prev => [...prev, {
                        id: Math.random().toString(),
                        type: 'result',
                        text: result.length > 200 ? result.slice(0, 200) + '...' : result,
                        timestamp: Date.now()
                      }]);

                      toolResponses.push({
                          id: call.id, 
                          name: call.name,
                          result: result
                      });
                  }

                  response = await chat.sendMessage({ message: "", toolResponses: toolResponses });
                  
                  if (response.text) {
                      setAgentSteps(prev => [...prev, {
                          id: Math.random().toString(),
                          type: 'thought',
                          text: response.text,
                          timestamp: Date.now()
                      }]);
                  }
                  
                  if (!response.toolCalls || response.toolCalls.length === 0) {
                      keepGoing = false;
                      setAgentSteps(prev => [...prev, {
                        id: Math.random().toString(),
                        type: 'response',
                        text: "Task completed.",
                        timestamp: Date.now()
                      }]);
                  } else {
                       if (response.toolCalls && response.toolCalls.length > 0) {
                           let activeResponse = response;
                           while (activeResponse.toolCalls && activeResponse.toolCalls.length > 0 && turns < MAX_TURNS) {
                               turns++;
                               const nextResponses: any[] = [];
                               for (const call of activeResponse.toolCalls) {
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'call', text: `Running ${call.name}...`, toolName: call.name, toolArgs: call.args, timestamp: Date.now() }]);
                                   const res = await onAgentAction(call.name, call.args);
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'result', text: res.length > 100 ? res.slice(0,100)+'...' : res, timestamp: Date.now() }]);
                                   nextResponses.push({ id: call.id, name: call.name, result: res });
                               }
                               activeResponse = await chat.sendMessage({ message: "", toolResponses: nextResponses });
                               if (activeResponse.text) {
                                   setAgentSteps(prev => [...prev, { id: Math.random().toString(), type: 'thought', text: activeResponse.text, timestamp: Date.now() }]);
                               }
                           }
                           keepGoing = false;
                       } else {
                           keepGoing = false;
                       }
                  }
              } else {
                  keepGoing = false;
                  setAgentSteps(prev => [...prev, {
                      id: Math.random().toString(),
                      type: 'response',
                      text: "Done.",
                      timestamp: Date.now()
                  }]);
              }
          }

      } catch (e: any) {
          console.error(e);
          setAgentSteps(prev => [...prev, {
              id: Date.now().toString(),
              type: 'error',
              text: `Error: ${e.message}`,
              timestamp: Date.now()
          }]);
      } finally {
          setIsAgentRunning(false);
      }
  };

  return { agentSteps, isAgentRunning, runAgent, setAgentSteps };
};
