
import React, { useState, useRef, useCallback, useEffect } from 'react';

interface ResizablePanelProps {
  mainContent: React.ReactNode;
  sideContent: React.ReactNode;
  isSideVisible: boolean;
  initialSideWidth?: number;
  className?: string;
}

export const ResizablePanel: React.FC<ResizablePanelProps> = ({
  mainContent,
  sideContent,
  isSideVisible,
  initialSideWidth = 50,
  className = ''
}) => {
  const [sideWidthPercent, setSideWidthPercent] = useState(initialSideWidth);
  const isResizingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizingRef.current || !containerRef.current) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Calculate width from the right side
    const newWidth = 100 - (x / rect.width) * 100;
    setSideWidthPercent(Math.max(10, Math.min(newWidth, 90)));
  }, []);

  const handleResizeMouseUp = useCallback(() => {
    isResizingRef.current = false;
    document.body.style.cursor = '';
    // Re-enable pointer events if necessary
    window.removeEventListener('mousemove', handleResizeMouseMove);
    window.removeEventListener('mouseup', handleResizeMouseUp);
  }, [handleResizeMouseMove]);

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    isResizingRef.current = true;
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', handleResizeMouseMove);
    window.addEventListener('mouseup', handleResizeMouseUp);
  };

  useEffect(() => {
    return () => {
      window.removeEventListener('mousemove', handleResizeMouseMove);
      window.removeEventListener('mouseup', handleResizeMouseUp);
    };
  }, [handleResizeMouseMove, handleResizeMouseUp]);

  return (
    <div ref={containerRef} className={`flex h-full w-full overflow-hidden ${className}`}>
      <div 
        className="relative h-full transition-[width] duration-75 ease-out"
        style={{ width: isSideVisible ? `${100 - sideWidthPercent}%` : '100%' }}
      >
        {mainContent}
      </div>

      {isSideVisible && (
        <div 
          onMouseDown={handleResizeMouseDown}
          className="w-1.5 h-full cursor-col-resize group flex items-center justify-center bg-black/20 hover:bg-vibe-accent transition-colors z-30 shrink-0"
        >
          <div className="w-0.5 h-10 bg-white/10 group-hover:bg-white/40 rounded-full" />
        </div>
      )}

      {isSideVisible && (
        <div 
          className="h-full flex flex-col bg-white animate-in slide-in-from-right-5 fade-in duration-300 border-l border-vibe-border overflow-hidden"
          style={{ width: `${sideWidthPercent}%` }}
        >
          {sideContent}
        </div>
      )}
    </div>
  );
};
