import React from 'react';
import { IconClose, IconTrash } from './Icons';
import { useProjectStore } from '../stores/projectStore';

const DeleteProjectConfirmModal: React.FC = () => {
  const projectToDelete = useProjectStore(state => state.projectToDelete);
  const setProjectToDelete = useProjectStore(state => state.setProjectToDelete);
  const confirmDeleteProject = useProjectStore(state => state.confirmDeleteProject);

  if (!projectToDelete) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-[400px] bg-[#0f0f16] border border-red-500/20 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.15)] overflow-hidden transform transition-all scale-100">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-red-900/20 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
               <IconTrash size={18} />
            </div>
            <h2 className="text-lg font-semibold text-white tracking-tight">Delete Project</h2>
          </div>
          <button 
            onClick={() => setProjectToDelete(null)} 
            className="text-slate-500 hover:text-white transition-colors p-1 hover:bg-white/5 rounded-md"
          >
            <IconClose size={18} />
          </button>
        </div>
        
        <div className="p-6">
          <p className="text-slate-300 text-sm leading-relaxed">
            Are you sure you want to delete the project <span className="font-mono text-white bg-white/5 px-1.5 py-0.5 rounded border border-white/10">{projectToDelete.name}</span>?
          </p>
          <p className="text-slate-500 text-xs mt-2">
            This action is permanent and cannot be undone. All associated files will be removed.
          </p>
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5 flex justify-end gap-3">
          <button 
            onClick={() => setProjectToDelete(null)} 
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={confirmDeleteProject} 
            className="px-4 py-2 rounded-lg text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-lg shadow-red-900/20"
          >
            Delete Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteProjectConfirmModal;
