
import React from 'react';

interface TooltipProps {
  content: React.ReactNode;
  shortcut?: string;
  children: React.ReactElement;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

const Tooltip: React.FC<TooltipProps> = ({ 
  content, 
  shortcut, 
  children,
  position = 'right'
}) => {

  const positionClasses = {
    right: 'left-full ml-3 top-1/2 -translate-y-1/2 origin-left',
    left: 'right-full mr-3 top-1/2 -translate-y-1/2 origin-right',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2 origin-bottom',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2 origin-top',
  };

  return (
    <div className="relative group flex items-center">
      {children}
      <div 
        className={`
          absolute w-max z-50 flex items-center gap-2 px-3 py-1.5 
          bg-[#0f0f16]/90 backdrop-blur-xl border border-white/10 
          rounded-lg shadow-2xl text-xs font-medium text-slate-200 
          opacity-0 group-hover:opacity-100 group-hover:scale-100 scale-95
          pointer-events-none transition-all duration-200
          ${positionClasses[position]}
        `}
      >
        <span>{content}</span>
        {shortcut && (
          <kbd className="h-5 items-center gap-1 rounded border border-white/10 bg-black/40 px-1.5 font-mono text-[10px] font-medium text-slate-400">
            {shortcut}
          </kbd>
        )}
      </div>
    </div>
  );
};

export default Tooltip;
