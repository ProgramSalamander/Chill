
import React, { useState, useMemo } from 'react';
import { File } from '../types';
import { 
  IconFileCode, 
  IconFolder, 
  IconFolderOpen, 
  IconChevronRight, 
  IconChevronDown, 
  IconMore,
  IconEdit,
  IconTrash,
  IconFilePlus,
  IconFolderPlus,
  IconCheck,
  IconClose
} from './Icons';

interface FileExplorerProps {
  files: File[];
  activeFileId: string;
  onFileClick: (file: File) => void;
  onDelete: (file: File) => void;
  onRename: (fileId: string, newName: string) => void;
  onCreate: (type: 'file' | 'folder', parentId: string | null, name: string) => void;
  onToggleFolder: (fileId: string) => void;
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
  onToggleFolder
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [showActions, setShowActions] = useState(false);
  
  // States for creating new children
  const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
  const [newChildName, setNewChildName] = useState('');

  // Get children for this node
  const children = useMemo(() => 
    files.filter(f => f.parentId === nodeId).sort((a, b) => {
      // Sort folders first, then files, alphabetically
      if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
      return a.name.localeCompare(b.name);
    }), 
  [files, nodeId]);

  // If nodeId is null, we are at root, just render children
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
          />
        ))}
        {/* Root level creation input if needed, though usually handled by header actions */}
      </div>
    );
  }

  const node = files.find(f => f.id === nodeId);
  if (!node) return null;

  // Determine git status
  const isAdded = node.type === 'file' && node.committedContent === undefined;
  const isModified = node.type === 'file' && !isAdded && node.content !== (node.committedContent || '');

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
    <div className="select-none">
      <div 
        className={`
          group flex items-center gap-1 py-1 px-2 cursor-pointer transition-colors relative
          ${activeFileId === node.id ? 'bg-vibe-accent/10 text-white border-l-2 border-vibe-glow' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-l-2 border-transparent'}
        `}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onFileClick(node)}
        onMouseEnter={() => setShowActions(true)}
        onMouseLeave={() => setShowActions(false)}
      >
        <span className="opacity-70 flex-shrink-0">
          {node.type === 'folder' ? (
            node.isOpen ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />
          ) : (
            <div className="w-3.5" /> // Spacer for alignment
          )}
        </span>

        <span className={`mr-2 flex-shrink-0 ${activeFileId === node.id ? 'text-vibe-glow' : (isModified ? 'text-amber-400' : (isAdded ? 'text-green-400' : 'text-slate-500'))}`}>
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
                    className="bg-black/40 border border-vibe-glow/50 rounded px-1 py-0.5 text-xs text-white w-full outline-none"
                />
            </div>
        ) : (
            <>
              <span className={`truncate text-sm flex-1 ${isModified ? 'text-amber-200' : (isAdded ? 'text-green-200' : '')}`}>{node.name}</span>
              {isModified && (
                 <span className="text-[10px] font-bold text-amber-400 font-mono mr-2" title="Modified">M</span>
              )}
              {isAdded && (
                 <span className="text-[10px] font-bold text-green-400 font-mono mr-2" title="Added (Untracked)">U</span>
              )}
            </>
        )}

        {/* Hover Actions */}
        {!isEditing && (
            <div className={`
                flex items-center gap-1 ml-auto
                ${showActions ? 'opacity-100' : 'opacity-0'} 
                transition-opacity duration-200
            `}>
                {node.type === 'folder' && (
                    <>
                        <button 
                            onClick={(e) => startCreate(e, 'file')} 
                            className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-green-400"
                            title="New File"
                        >
                            <IconFilePlus size={12} />
                        </button>
                        <button 
                            onClick={(e) => startCreate(e, 'folder')} 
                            className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-green-400"
                            title="New Folder"
                        >
                            <IconFolderPlus size={12} />
                        </button>
                    </>
                )}
                <button 
                    onClick={handleStartEdit} 
                    className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-blue-400"
                    title="Rename"
                >
                    <IconEdit size={12} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); onDelete(node); }} 
                    className="p-1 hover:bg-white/10 rounded text-slate-500 hover:text-red-400"
                    title="Delete"
                >
                    <IconTrash size={12} />
                </button>
            </div>
        )}
      </div>

      {/* Creation Input within folder */}
      {isCreating && node.isOpen && (
          <div 
             className="flex items-center gap-2 py-1 px-2 animate-in fade-in slide-in-from-top-1"
             style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
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
                    className="bg-black/40 border border-vibe-glow/50 rounded px-1 py-0.5 text-xs text-white w-full outline-none"
                 />
                 <button onClick={saveCreate} className="text-green-400 hover:bg-green-400/10 p-0.5 rounded"><IconCheck size={12}/></button>
                 <button onClick={() => setIsCreating(null)} className="text-red-400 hover:bg-red-400/10 p-0.5 rounded"><IconClose size={12}/></button>
             </div>
          </div>
      )}

      {/* Render Children */}
      {node.type === 'folder' && node.isOpen && (
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
            />
          ))}
          {children.length === 0 && !isCreating && (
              <div 
                className="py-1 text-[10px] text-slate-600 italic select-none"
                style={{ paddingLeft: `${(depth + 1) * 12 + 24}px` }}
              >
                  Empty
              </div>
          )}
        </div>
      )}
    </div>
  );
};

const FileExplorer: React.FC<FileExplorerProps> = (props) => {
    return (
        <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
            <FileTreeNode nodeId={null} depth={0} {...props} />
        </div>
    );
};

export default FileExplorer;
