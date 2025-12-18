
import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../stores/uiStore';
import { ContextMenuItem } from '../types';

export const ContextMenu: React.FC = () => {
  const { contextMenu, hideContextMenu } = useUIStore();
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (contextMenu.visible && menuRef.current) {
      const menuRect = menuRef.current.getBoundingClientRect();
      let x = contextMenu.x;
      let y = contextMenu.y;

      // Ensure menu stays within viewport
      if (x + menuRect.width > window.innerWidth) {
        x = window.innerWidth - menuRect.width - 10;
      }
      if (y + menuRect.height > window.innerHeight) {
        y = window.innerHeight - menuRect.height - 10;
      }

      setPosition({ x, y });
    }
  }, [contextMenu.visible, contextMenu.x, contextMenu.y]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        hideContextMenu();
      }
    };
    
    if (contextMenu.visible) {
      window.addEventListener('mousedown', handleClick);
      window.addEventListener('keydown', hideContextMenu);
    }
    
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', hideContextMenu);
    };
  }, [contextMenu.visible, hideContextMenu]);

  if (!contextMenu.visible) return null;

  return (
    <div
      ref={menuRef}
      className="fixed z-[999] w-56 bg-[#0f0f16]/90 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/50"
      style={{ top: position.y, left: position.x }}
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
