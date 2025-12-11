

import React, { useState, useMemo } from 'react';
import { File } from '../types';
import { 
  IconFileCode, 
  IconFolder, 
  IconFolderOpen, 
  IconChevronDown, 
  IconEdit,
  IconTrash,
  IconFilePlus,
  IconFolderPlus,
  IconCheck,
  IconClose,
  IconBrain
} from './Icons';

interface FileExplorerProps {
  files: File[];
  activeFileId: string;
  onFileClick: (file: File) => void;
  onDelete: (file: File) => void;
  onRename: (fileId: string, newName: string) => void;
  onCreate: (type: 'file' | 'folder', parentId: string | null, name: string) => void;
  onToggleFolder: (fileId: string) => void;
  agentAwareness?: Set<string>;
}

interface FileTreeNodeProps extends FileExplorerProps {
  nodeId: string | null;
  depth: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ 
  files, 
  nodeId, 
  depth, 
  activeFileId, 
  onFileClick, 
  onDelete,
  onRename,
  onCreate,
  onToggleFolder,
  agentAwareness
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showActions, setShowActions] = useState(false);
  
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newChildName, setNewChildName] = useState('');

  const children = useMemo(() => 
    files.filter(f => f.parentId === nodeId).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }), 
  [files, nodeId]);

  if (nodeId === null) {
    return (
      <div className="flex flex-col">
        {children.map(child => (
          <FileTreeNode 
            key={child.id} 
            nodeId={child.id} 
            depth={0} 
            files={files}
            activeFileId={activeFileId}
            onFileClick={onFileClick}
            onDelete={onDelete}
            onRename={onRename}
            onCreate={onCreate}
            onToggleFolder={onToggleFolder}
            agentAwareness={agentAwareness}
          />
        ))}
      </div>
    );
  }

  const node = files.find(f => f.id === nodeId);
  if (!node) return null;

  const isAdded = node.type === 'file' && node.committedContent === undefined;
  const isModified = node.type === 'file' && !isAdded && node.content !== (node.committedContent || '');
  const isAware = agentAwareness?.has(node.id);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(node.name);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (editName.trim()) {
      onRename(node.id, editName.trim());
    }
    setIsEditing(false);
  };

  const startCreate = (e: React.MouseEvent, type: 'file' | 'folder') => {
    e.stopPropagation();
    setIsCreating(type);
    setNewChildName('');
    if (!node.isOpen) {
        onToggleFolder(node.id);
    }
    setShowActions(false);
  };

  const saveCreate = () => {
    if (newChildName.trim() && isCreating) {
      onCreate(isCreating, node.id, newChildName.trim());
    }
    setIsCreating(null);
  };

  return (
    <div className="select-none relative">
      <div 
        className={`
          group flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-all relative rounded-lg mx-1
          ${activeFileId === node.id ? 'bg-vibe-accent/20 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}
          ${isAware && activeFileId !== node.id ? 'bg-vibe-glow/5 border border-vibe-glow/10 shadow-[0_0_10px_rgba(199,210,254,0.05)]' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => onFileClick(node)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        {isAware && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-vibe-glow rounded-r-full animate-pulse shadow-[0_0_5px_rgba(199,210,254,0.5)]"></div>
        )}

        <span className={`opacity-70 flex-shrink-0 transition-transform ${node.isOpen ? 'rotate-0' : '-rotate-90'}`}>
          {node.type === 'folder' ? (
             <IconChevronDown size={14} />
          ) : (
            <div className="w-3.5" /> 
          )}
        </span>

        <span className={`flex-shrink-0 ${activeFileId === node.id ? 'text-vibe-glow' : (isModified ? 'text-amber-400' : (isAdded ? 'text-green-400' : 'text-slate-500'))}`}>
          {node.type === 'folder' ? (
             node.isOpen ? <IconFolderOpen size={16} /> : <IconFolder size={16} />
          ) : (
             <IconFileCode size={16} />
          )}
        </span>

        {isEditing ? (
            <div className="flex items-center flex-1 min-w-0" onClick={e => e.stopPropagation()}>
                <input 
                    autoFocus
                    type="text" 
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') setIsEditing(false);
                    }}
                    onBlur={handleSaveEdit}
                    className="bg-black/60 border border-vibe-glow/50 rounded px-1.5 py-0.5 text-xs text-white w-full outline-none shadow-lg"
                />
            </div>
        ) : (
            <>
              <span className={`truncate text-sm flex-1 ${isModified ? 'text-amber-200' : (isAdded ? 'text-green-200' : '')} ${isAware ? 'font-medium text-vibe-glow' : ''}`}>
                  {node.name}
              </span>
              
              {isAware && !isModified && !isAdded && (
                 <IconBrain size={10} className="text-vibe-glow animate-pulse mr-2 opacity-50" />
              )}

              {isModified && (
                 <span className="text-[9px] font-bold text-amber-400 font-mono mr-2 bg-amber-400/10 px-1 rounded" title="Modified">M</span>
              )}
              {isAdded && (
                 <span className="text-[9px] font-bold text-green-400 font-mono mr-2 bg-green-400/10 px-1 rounded" title="Added (Untracked)">U</span>
              )}
            </>
        )}

        {!isEditing && (
            <div className={`
                flex items-center gap-1 ml-auto bg-black/60 rounded px-1 backdrop-blur-sm
                ${showActions ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} 
                transition-all duration-200
            `}>
                {node.type === 'folder' && (
                    <>
                        <button 
                            onClick={(e) => startCreate(e, 'file')} 
                            className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-green-400 transition-colors"
                            title="New File"
                        >
                            <IconFilePlus size={12} />
                        </button>
                        <button 
                            onClick={(e) => startCreate(e, 'folder')} 
                            className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-green-400 transition-colors"
                            title="New Folder"
                        >
                            <IconFolderPlus size={12} />
                        </button>
                    </>
                )}
                <button 
                    onClick={handleStartEdit} 
                    className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-blue-400 transition-colors"
                    title="Rename"
                >
                    <IconEdit size={12} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(node); }} 
                    className="p-1 hover:bg-white/20 rounded text-slate-400 hover:text-red-400 transition-colors"
                    title="Delete"
                >
                    <IconTrash size={12} />
                </button>
            </div>
        )}
      </div>

      {isCreating && node.isOpen && (
          <div 
             className="flex items-center gap-2 py-1 px-2 animate-in fade-in slide-in-from-top-1 my-1"
             style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
          >
             <span className="text-slate-500">
                {isCreating === 'folder' ? <IconFolder size={16} /> : <IconFileCode size={16} />}
             </span>
             <div className="flex items-center flex-1 gap-1">
                 <input 
                    autoFocus
                    type="text"
                    value={newChildName}
                    onChange={e => setNewChildName(e.target.value)}
                    onKeyDown={e => {
                        if (e.key === 'Enter') saveCreate();
                        if (e.key === 'Escape') setIsCreating(null);
                    }}
                    placeholder={`Name ${isCreating}...`}
                    className="bg-black/60 border border-vibe-glow/50 rounded px-1.5 py-0.5 text-xs text-white w-full outline-none shadow-lg"
                 />
                 <button onClick={saveCreate} className="text-green-400 hover:bg-green-400/10 p-1 rounded"><IconCheck size={12}/></button>
                 <button onClick={() => setIsCreating(null)} className="text-red-400 hover:bg-red-400/10 p-1 rounded"><IconClose size={12}/></button>
             </div>
          </div>
      )}

      {node.type === 'folder' && node.isOpen && (
        <div className="relative">
          <div 
             className="absolute left-0 top-0 bottom-0 w-px bg-white/10"
             style={{ left: `${depth * 16 + 18}px` }}
          />
          <div className="flex flex-col">
            {children.map(child => (
              <FileTreeNode 
                key={child.id} 
                nodeId={child.id} 
                depth={depth + 1} 
                files={files}
                activeFileId={activeFileId}
                onFileClick={onFileClick}
                onDelete={onDelete}
                onRename={onRename}
                onCreate={onCreate}
                onToggleFolder={onToggleFolder}
                agentAwareness={agentAwareness}
              />
            ))}
            {children.length === 0 && !isCreating && (
                <div 
                  className="py-1 text-[10px] text-slate-600 italic select-none"
                  style={{ paddingLeft: `${(depth + 1) * 16 + 28}px` }}
                >
                    Empty
                </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = (props) => {
    return (
        <div className="flex flex-col h-full">
            <div className="p-4 text-xs font-bold text-slate-500 uppercase flex justify-between items-center tracking-wider border-b border-white/5 shrink-0">
                <span>Explorer</span>
                <div className="flex items-center gap-2 text-slate-400">
                    <button onClick={() => props.onCreate('file', null, `untitled.ts`)} className="hover:text-white transition-colors" title="New File">
                        <IconFilePlus size={14} />
                    </button>
                    <button onClick={() => props.onCreate('folder', null, `new-folder`)} className="hover:text-white transition-colors" title="New Folder">
                        <IconFolderPlus size={14} />
                    </button>
                </div>
            </div>
            {props.files.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50 space-y-3">
                    <IconFolderOpen size={32} />
                    <p className="text-xs">No files yet</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                    <FileTreeNode nodeId={null} depth={-1} {...props} />
                </div>
            )}
        </div>
    );
};

export default FileExplorer;