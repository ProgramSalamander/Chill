
import React, { useState, useRef, useLayoutEffect, useCallback } from 'react';
import { useUIStore } from '../stores/uiStore';

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
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const isDraggingSidebar = useUIStore(state => state.isDraggingSidebar);

  const calculatePosition = useCallback(() => {
    if (!wrapperRef.current || !tooltipRef.current) return;

    const targetRect = wrapperRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const newStyle: React.CSSProperties = {};
    
    const gap = 4;
    const screenPadding = 8;
    
    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = targetRect.top - tooltipRect.height - gap;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'bottom':
        top = targetRect.bottom + gap;
        left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
        break;
      case 'left':
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.left - tooltipRect.width - gap;
        break;
      case 'right':
      default:
        top = targetRect.top + targetRect.height / 2 - tooltipRect.height / 2;
        left = targetRect.right + gap;
        break;
    }
    
    if (left < screenPadding) {
      left = screenPadding;
    } else if (left + tooltipRect.width > window.innerWidth - screenPadding) {
      left = window.innerWidth - tooltipRect.width - screenPadding;
    }
    
    if (top < screenPadding) {
      top = screenPadding;
    } else if (top + tooltipRect.height > window.innerHeight - screenPadding) {
      top = window.innerHeight - tooltipRect.height - screenPadding;
    }
    
    newStyle.top = `${top}px`;
    newStyle.left = `${left}px`;
    
    setStyle(newStyle);
  }, [position, content, shortcut]);

  useLayoutEffect(() => {
    if (visible && !isDraggingSidebar) {
      calculatePosition();
    }
  }, [visible, calculatePosition, isDraggingSidebar]);

  const show = () => !isDraggingSidebar && setVisible(true);
  const hide = () => setVisible(false);

  return (
    <>
      <div
        className="inline-flex items-center"
        ref={wrapperRef}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </div>
      <div
        ref={tooltipRef}
        style={{
          ...style,
          position: 'fixed',
          opacity: (visible && !isDraggingSidebar) ? 1 : 0,
          transform: (visible && !isDraggingSidebar) ? 'scale(1)' : 'scale(0.95)',
          transition: 'opacity 0.08s ease-out, transform 0.08s ease-out',
          pointerEvents: 'none',
          zIndex: 250,
        }}
        className="w-max bg-[#0f0f16]/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl"
        role="tooltip"
      >
        <div className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-200">
          <span>{content}</span>
          {shortcut && (
            <kbd className="h-5 items-center gap-1 rounded border border-white/10 bg-black/40 px-1.5 font-mono text-[10px] font-medium text-slate-400">
              {shortcut}
            </kbd>
          )}
        </div>
      </div>
    </>
  );
};

export default Tooltip;
