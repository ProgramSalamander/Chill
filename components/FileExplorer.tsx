import React, { useState, useMemo } from 'react';
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
import { useFileTreeStore } from '../stores/fileStore';
import { useAgentStore } from '../stores/agentStore';
import { useGitStore } from '../stores/gitStore';
import { getFilePath } from '../utils/fileUtils';

interface FileTreeNodeProps {
  nodeId: string | null;
  depth: number;
}

const FileTreeNode: React.FC<FileTreeNodeProps> = ({ nodeId, depth }) => {
  const files = useFileTreeStore(state => state.files);
  const activeFileId = useFileTreeStore(state => state.activeFileId);
  const selectFile = useFileTreeStore(state => state.selectFile);
  const setFileToDelete = useFileTreeStore(state => state.setFileToDelete);
  const renameNode = useFileTreeStore(state => state.renameNode);
  const createNode = useFileTreeStore(state => state.createNode);
  const toggleFolder = useFileTreeStore(state => state.toggleFolder);
  const agentAwareness = useAgentStore(state => state.agentAwareness);

  const isGitInitialized = useGitStore(state => state.isInitialized);
  const gitStatus = useGitStore(state => state.status);

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
          />
        ))}
      </div>
    );
  }

  const node = files.find(f => f.id === nodeId);
  if (!node) return null;

  const filePath = useMemo(() => getFilePath(node, files), [node, files]);

  const nodeGitStatus = useMemo(() => {
    if (!isGitInitialized || node.type !== 'file') return null;
    return gitStatus.find(s => s.filepath === filePath);
  }, [isGitInitialized, gitStatus, filePath, node.type]);

  // 'added' in gitService means untracked
  const isAdded = nodeGitStatus?.status === 'added';
  // 'modified' means modified in the working directory
  const isModified = nodeGitStatus?.status === 'modified';
  
  const isAware = agentAwareness?.has(node.id);

  const handleStartEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditName(node.name);
    setShowActions(false);
  };

  const handleSaveEdit = () => {
    if (editName.trim()) {
      renameNode(node.id, editName.trim());
    }
    setIsEditing(false);
  };

  const startCreate = (e: React.MouseEvent, type: 'file' | 'folder') => {
    e.stopPropagation();
    setIsCreating(type);
    setNewChildName('');
    if (!node.isOpen) {
        toggleFolder(node.id);
    }
    setShowActions(false);
  };

  const saveCreate = () => {
    if (newChildName.trim() && isCreating) {
      createNode(isCreating, node.id, newChildName.trim());
    }
    setIsCreating(null);
  };

  return (
    <div className="select-none relative">
      <div 
        className={`
          group flex items-center gap-2 py-1.5 px-3 cursor-pointer transition-all relative rounded-lg mx-1
          ${activeFileId === node.id ? 'bg-vibe-accent/20 text-vibe-text-main' : 'text-vibe-text-soft hover:bg-black/5 dark:hover:bg-white/5 hover:text-vibe-text-main'}
          ${isAware && activeFileId !== node.id ? 'bg-vibe-glow/5 border border-vibe-glow/10 shadow-[0_0_10px_rgba(199,210,254,0.05)]' : ''}
        `}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
        onClick={() => selectFile(node)}
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

        <span className={`flex-shrink-0 ${activeFileId === node.id ? 'text-vibe-glow' : (isModified ? 'text-amber-500' : (isAdded ? 'text-green-600 dark:text-green-400' : 'text-vibe-text-muted'))}`}>
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
                    className="bg-vibe-800 border border-vibe-glow/50 rounded px-1.5 py-0.5 text-xs text-vibe-text-main w-full outline-none shadow-lg"
                />
            </div>
        ) : (
            <>
              <span className={`truncate text-sm flex-1 min-w-0 ${node.isModified ? 'italic' : ''} ${isModified ? 'text-amber-600 dark:text-amber-200' : (isAdded ? 'text-green-600 dark:text-green-200' : '')} ${isAware ? 'font-medium text-vibe-glow' : ''}`}>
                  {node.name}
              </span>

              <div className="flex items-center gap-x-2 mr-2 shrink-0">
                  {node.isModified && (
                      <div className="w-1.5 h-1.5 rounded-full bg-vibe-accent animate-pulse" title="Unsaved changes"></div>
                  )}

                  {isModified && (
                      <span className="text-[9px] font-bold text-amber-500 font-mono bg-amber-500/10 px-1 rounded" title="Modified">M</span>
                  )}
                  {isAdded && (
                      <span className="text-[9px] font-bold text-green-600 dark:text-green-400 font-mono bg-green-500/10 px-1 rounded" title="Added (Untracked)">U</span>
                  )}
                  
                  {isAware && !isModified && !isAdded && (
                      <IconBrain size={10} className="text-vibe-glow animate-pulse opacity-50" />
                  )}
              </div>
            </>
        )}

        {!isEditing && (
            <div className={`
                flex items-center gap-1 ml-auto bg-vibe-800 border border-vibe-border rounded px-1 backdrop-blur-sm shadow-sm
                ${showActions ? 'opacity-100 scale-100' : 'opacity-0 scale-90'} 
                transition-all duration-200
            `}>
                {node.type === 'folder' && (
                    <>
                        <button 
                            onClick={(e) => startCreate(e, 'file')} 
                            className="p-1 hover:bg-black/5 dark:hover:bg-white/20 rounded text-vibe-text-muted hover:text-green-500 transition-colors"
                            title="New File"
                        >
                            <IconFilePlus size={12} />
                        </button>
                        <button 
                            onClick={(e) => startCreate(e, 'folder')} 
                            className="p-1 hover:bg-black/5 dark:hover:bg-white/20 rounded text-vibe-text-muted hover:text-green-500 transition-colors"
                            title="New Folder"
                        >
                            <IconFolderPlus size={12} />
                        </button>
                    </>
                )}
                <button 
                    onClick={handleStartEdit} 
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/20 rounded text-vibe-text-muted hover:text-blue-500 transition-colors"
                    title="Rename"
                >
                    <IconEdit size={12} />
                </button>
                <button 
                    onClick={(e) => { e.stopPropagation(); setFileToDelete(node); }} 
                    className="p-1 hover:bg-black/5 dark:hover:bg-white/20 rounded text-vibe-text-muted hover:text-red-500 transition-colors"
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
             <span className="text-vibe-text-muted">
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
                    className="bg-vibe-800 border border-vibe-glow/50 rounded px-1.5 py-0.5 text-xs text-vibe-text-main w-full outline-none shadow-lg"
                 />
                 <button onClick={saveCreate} className="text-green-600 dark:text-green-400 hover:bg-green-400/10 p-1 rounded"><IconCheck size={12}/></button>
                 <button onClick={() => setIsCreating(null)} className="text-red-500 hover:bg-red-400/10 p-1 rounded"><IconClose size={12}/></button>
             </div>
          </div>
      )}

      {node.type === 'folder' && node.isOpen && (
        <div className="relative">
          <div 
             className="absolute left-0 top-0 bottom-0 w-px bg-vibe-border"
             style={{ left: `${depth * 16 + 18}px` }}
          />
          <div className="flex flex-col">
            {children.map(child => (
              <FileTreeNode 
                key={child.id} 
                nodeId={child.id} 
                depth={depth + 1} 
              />
            ))}
            {children.length === 0 && !isCreating && (
                <div 
                  className="py-1 text-[10px] text-vibe-text-muted italic select-none"
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

const FileExplorer: React.FC = () => {
    const files = useFileTreeStore(state => state.files);
    const createNode = useFileTreeStore(state => state.createNode);
    
    const [isCreating, setIsCreating] = useState<'file' | 'folder' | null>(null);
    const [newNodeName, setNewNodeName] = useState('');

    const handleStartCreate = (type: 'file' | 'folder') => {
        setIsCreating(type);
        setNewNodeName('');
    };

    const handleSaveCreate = () => {
        if (newNodeName.trim() && isCreating) {
            createNode(isCreating, null, newNodeName.trim());
        }
        setIsCreating(null);
        setNewNodeName('');
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 text-xs font-bold text-vibe-text-muted uppercase flex justify-between items-center tracking-wider border-b border-vibe-border shrink-0">
                <span>Explorer</span>
                <div className="flex items-center gap-2 text-vibe-text-muted">
                    <button onClick={() => handleStartCreate('file')} className="hover:text-vibe-text-main transition-colors" title="New File">
                        <IconFilePlus size={14} />
                    </button>
                    <button onClick={() => handleStartCreate('folder')} className="hover:text-vibe-text-main transition-colors" title="New Folder">
                        <IconFolderPlus size={14} />
                    </button>
                </div>
            </div>
            {files.length === 0 && !isCreating ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-4 opacity-50 space-y-3">
                    <IconFolderOpen size={32} />
                    <p className="text-xs text-vibe-text-soft">No files yet</p>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto py-2 custom-scrollbar">
                    {isCreating && (
                        <div 
                            className="flex items-center gap-2 py-1 px-3 animate-in fade-in slide-in-from-top-1 my-1 mx-1"
                            style={{ paddingLeft: `12px` }}
                        >
                            <span className="text-vibe-text-muted">
                                {isCreating === 'folder' ? <IconFolder size={16} /> : <IconFileCode size={16} />}
                            </span>
                            <div className="flex items-center flex-1 gap-1">
                                <input 
                                    autoFocus
                                    type="text"
                                    value={newNodeName}
                                    onChange={e => setNewNodeName(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') handleSaveCreate();
                                        if (e.key === 'Escape') { setIsCreating(null); setNewNodeName(''); }
                                    }}
                                    onBlur={handleSaveCreate}
                                    placeholder={`Name your ${isCreating}...`}
                                    className="bg-vibe-800 border border-vibe-glow/50 rounded px-1.5 py-0.5 text-xs text-vibe-text-main w-full outline-none shadow-lg"
                                />
                                <button onClick={handleSaveCreate} className="text-green-600 dark:text-green-400 hover:bg-green-400/10 p-1 rounded"><IconCheck size={12}/></button>
                                <button onClick={() => setIsCreating(null)} className="text-red-500 hover:bg-red-400/10 p-1 rounded"><IconClose size={12}/></button>
                            </div>
                        </div>
                    )}
                    <FileTreeNode nodeId={null} depth={-1} />
                </div>
            )}
        </div>
    );
};

export default FileExplorer;