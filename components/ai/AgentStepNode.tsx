import React, { useState, useEffect } from 'react';
import { AgentStep } from '../../types';
import { 
  IconSparkles, IconCpu, IconWand, IconTerminal, IconFileCode, 
  IconCheck, IconClose, IconZap, IconChevronDown, IconChevronRight,
  IconFileText, IconTrash, IconGitMerge, IconBug, IconPlayCircle,
  IconNetwork, IconSearch, IconGitBranch, IconList, IconInfo
} from '../Icons';

interface AgentStepNodeProps {
  step: AgentStep;
  isLast: boolean;
}

// Helper component for displaying tool call arguments
const ArgDisplay: React.FC<{ icon: React.ReactNode; label: string; value: string; valueClass?: string }> = ({ icon, label, value, valueClass }) => (
  <div className="flex items-start gap-3">
    <div className="flex items-center gap-2 text-slate-500 shrink-0 w-24">
      {icon}
      <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
    </div>
    <div className={`flex-1 min-w-0 px-2 py-1 rounded text-xs break-words bg-black/40 font-mono ${valueClass || 'text-slate-300'}`}>
      {value}
    </div>
  </div>
);

const ToolCallDisplay: React.FC<{ toolName: string; toolArgs: any }> = ({ toolName, toolArgs }) => {
  if (toolName === 'writeFile') {
    return (
      <div className="flex flex-col bg-black/40 rounded border border-white/5">
          <div className="flex items-center gap-2 text-slate-400 border-b border-white/5 p-2 text-xs">
              <IconFileCode size={14} />
              <span>Writing to <span className="font-mono text-indigo-300">{toolArgs.path}</span></span>
          </div>
          <pre className="text-green-300/80 max-h-40 overflow-y-auto custom-scrollbar p-2 font-mono text-xs">
              {toolArgs.content}
          </pre>
      </div>
    );
  }
  
  if (typeof toolArgs !== 'object' || toolArgs === null || Object.keys(toolArgs).length === 0) {
    return (
      <div className="bg-black/40 rounded p-3 border border-white/5 text-xs text-slate-500 italic">
        No parameters for this action.
      </div>
    );
  }

  const args = toolArgs as Record<string, any>;
  let title = 'Tool Arguments';
  let icon = <IconWand size={14} />;
  
  switch(toolName) {
    case 'readFile': title = 'Read File'; icon = <IconFileText size={14}/>; break;
    case 'deleteFile': title = 'Delete File'; icon = <IconTrash size={14}/>; break;
    case 'git_diff': title = 'Git Diff'; icon = <IconGitMerge size={14}/>; break;
    case 'tooling_lint': title = 'Run Linter'; icon = <IconBug size={14}/>; break;
    case 'runtime_execJs': title = 'Execute Script'; icon = <IconPlayCircle size={14}/>; break;
    case 'getFileStructure': title = 'Get File Structure'; icon = <IconNetwork size={14}/>; break;
    case 'autoFixErrors': title = 'Auto-Fix Errors'; icon = <IconWand size={14}/>; break;
    case 'tooling_runTests': title = 'Run Tests'; icon = <IconTerminal size={14}/>; break;
    case 'searchCode': title = 'Search Code'; icon = <IconSearch size={14}/>; break;
    case 'grep': title = 'Grep'; icon = <IconSearch size={14}/>; break;
    case 'git_getStatus': title = 'Git Status'; icon = <IconGitBranch size={14}/>; break;
    case 'fs_listFiles': title = 'List Files'; icon = <IconList size={14}/>; break;
  }
  
  return (
    <div className="bg-black/40 rounded border border-white/5">
        <div className="flex items-center gap-2 text-slate-300 border-b border-white/5 p-2 text-xs font-bold">
            {icon}
            <span>{title}</span>
        </div>
        <div className="p-3 space-y-2">
            {args.path && <ArgDisplay icon={<IconFileCode size={12} />} label="Path" value={args.path} valueClass="text-indigo-300" />}
            {args.runner && <ArgDisplay icon={<IconTerminal size={12} />} label="Runner" value={args.runner} valueClass="text-yellow-300" />}
            {args.command && <ArgDisplay icon={<IconTerminal size={12} />} label="Command" value={args.command} valueClass="text-yellow-300" />}
            {args.query && <ArgDisplay icon={<IconSearch size={12} />} label="Query" value={args.query} valueClass="text-blue-300" />}
            {args.pattern && <ArgDisplay icon={<IconSearch size={12} />} label="Pattern" value={args.pattern} valueClass="text-blue-300" />}
            {Object.entries(args).filter(([key]) => !['path', 'runner', 'command', 'query', 'pattern', 'content'].includes(key)).map(([key, value]) => (
                <ArgDisplay key={key} icon={<IconInfo size={12} />} label={key} value={String(value)} />
            ))}
        </div>
    </div>
  );
};

const AgentStepNode: React.FC<AgentStepNodeProps> = ({ step, isLast }) => {
    const [isExpanded, setIsExpanded] = useState(step.type === 'error' || step.type === 'user');
    
    useEffect(() => {
        if (isLast && step.type !== 'thought') setIsExpanded(true);
    }, [isLast, step.type]);

    const getStepConfig = () => {
        switch (step.type) {
            case 'user': return {
                icon: <IconSparkles size={14} />,
                color: 'text-vibe-glow',
                bg: 'bg-vibe-accent/10',
                border: 'border-vibe-accent/30',
                title: 'Objective'
            };
            case 'thought': return {
                icon: <IconCpu size={14} />,
                color: 'text-slate-400',
                bg: 'bg-white/5',
                border: 'border-white/10',
                title: 'Thinking'
            };
            case 'call': 
                const isWrite = step.toolName === 'writeFile';
                const isRun = step.toolName === 'runCommand';
                return {
                    icon: isWrite ? <IconFileCode size={14} /> : isRun ? <IconTerminal size={14} /> : <IconWand size={14} />,
                    color: isWrite ? 'text-green-400' : isRun ? 'text-purple-400' : 'text-yellow-400',
                    bg: isWrite ? 'bg-green-500/10' : isRun ? 'bg-purple-500/10' : 'bg-yellow-500/10',
                    border: isWrite ? 'border-green-500/20' : isRun ? 'border-purple-500/20' : 'border-yellow-500/20',
                    title: step.toolName
                };
            case 'result': return {
                icon: <IconCheck size={14} />,
                color: 'text-slate-300',
                bg: 'bg-black/20',
                border: 'border-white/5',
                title: 'Output'
            };
            case 'error': return {
                icon: <IconClose size={14} />,
                color: 'text-red-400',
                bg: 'bg-red-500/10',
                border: 'border-red-500/30',
                title: 'Error'
            };
            case 'response': return {
                icon: <IconZap size={14} />,
                color: 'text-vibe-glow',
                bg: 'bg-vibe-accent/10',
                border: 'border-vibe-accent/30',
                title: 'Complete'
            };
        }
    };

    const config = getStepConfig();

    return (
        <div className="relative pl-6 pb-6 last:pb-0 group">
            {!isLast && <div className="absolute left-[11px] top-6 bottom-0 w-[2px] bg-white/5 group-hover:bg-white/10 transition-colors"></div>}
            
            <div className={`
                absolute left-0 top-0 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 transition-all
                ${config.bg} ${config.border} ${config.color} shadow-[0_0_10px_rgba(0,0,0,0.2)]
                ${isLast && step.type === 'thought' ? 'animate-pulse' : ''}
            `}>
                {config.icon}
            </div>

            <div className={`
                ml-3 rounded-lg border transition-all duration-300 overflow-hidden
                ${config.bg} ${config.border}
                ${isExpanded ? 'shadow-lg' : 'hover:border-white/20'}
            `}>
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center justify-between px-3 py-2 cursor-pointer select-none"
                >
                    <div className="flex items-center gap-2">
                        <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                            {config.title}
                        </span>
                        {step.type === 'call' && (
                             <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded text-slate-400 font-mono">
                                 {step.toolName === 'writeFile' ? step.toolArgs.path : step.toolName === 'runCommand' ? 'exec' : 'read'}
                             </span>
                        )}
                    </div>
                    <div className="text-slate-500">
                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                    </div>
                </div>

                {isExpanded && (
                    <div className="px-3 pb-3 pt-0 text-sm animate-in slide-in-from-top-2 duration-200">
                        {step.type === 'call' ? (
                            <ToolCallDisplay toolName={step.toolName!} toolArgs={step.toolArgs} />
                        ) : (
                            <div className={`leading-relaxed whitespace-pre-wrap ${step.type === 'result' ? 'font-mono text-xs text-slate-400 bg-black/20 p-2 rounded max-h-60 overflow-y-auto custom-scrollbar' : 'text-slate-300'}`}>
                                {step.text}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AgentStepNode;
