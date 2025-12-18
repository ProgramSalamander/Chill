
import React, { useEffect, useRef } from 'react';
import { useUIStore } from '../stores/uiStore';

export const ContextMenu: React.FC = () => {
  const { contextMenu, hideContextMenu } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);

  // We calculate clamping logic inside the render or via a layout effect to avoid "flashes"
  // However, simple clamping can be done by looking at window dimensions
  const getClampedPosition = (x: number, y: number) => {
    const width = 224; // w-56 = 14rem = 224px
    const height = contextMenu.items.length * 32 + 20; // Rough estimate per item
    
    let finalX = x;
    let finalY = y;

    if (x + width > window.innerWidth) {
      finalX = window.innerWidth - width - 10;
    }
    if (y + height > window.innerHeight) {
      finalY = window.innerHeight - height - 10;
    }

    return { x: finalX, y: finalY };
  };

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };
    
    if (contextMenu.visible) {
      window.addEventListener('mousedown', handleClick);
      // Close on escape key
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') hideContextMenu();
      };
      window.addEventListener('keydown', handleEsc);
      return () => {
        window.removeEventListener('mousedown', handleClick);
        window.removeEventListener('keydown', handleEsc);
      };
    }
  }, [contextMenu.visible, hideContextMenu]);

  if (!contextMenu.visible) return null;

  const { x, y } = getClampedPosition(contextMenu.x, contextMenu.y);

  return (
    <div
      ref={menuRef}
      // Using a key based on coordinates forces React to unmount the old menu and mount a new one.
      // This ensures the "animate-in" CSS animation starts fresh at the new location
      // rather than sliding from the previous one.
      key={`${contextMenu.x}-${contextMenu.y}`}
      className="fixed z-[999] w-56 bg-[#0f0f16]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
      style={{ top: y, left: x }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {contextMenu.items.map((item, index) => {
        if (item.variant === 'separator') {
          return <div key={`sep-${index}`} className="h-px bg-white/5 my-1 mx-2" />;
        }

        return (
          <button
            key={item.id}
            onClick={(e) => {
              e.stopPropagation();
              item.onClick();
              hideContextMenu();
            }}
            className={`
              w-full flex items-center justify-between px-3 py-2 text-xs transition-all mx-1 rounded-lg group
              ${item.variant === 'danger' 
                ? 'text-red-400 hover:bg-red-500/10' 
                : 'text-slate-300 hover:bg-vibe-accent/20 hover:text-white'}
            `}
          >
            <div className="flex items-center gap-3">
              <span className={`transition-colors ${item.variant === 'danger' ? 'text-red-400' : 'text-slate-500 group-hover:text-vibe-glow'}`}>
                {item.icon}
              </span>
              <span className="font-medium">{item.label}</span>
            </div>
            {item.shortcut && (
              <span className="text-[10px] font-mono text-slate-600 opacity-60 group-hover:opacity-100">
                {item.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
