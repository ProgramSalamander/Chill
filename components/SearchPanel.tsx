
import React, { useState, useMemo, useEffect } from 'react';
import { useFileTreeStore } from '../stores/fileStore';
import { 
  IconSearch, 
  IconReplace, 
  IconChevronDown, 
  IconChevronRight, 
  IconFileCode,
  IconCaseSensitive,
  IconRegex,
  IconRefresh
} from './Icons';
import { File } from '../types';

interface SearchMatch {
  lineContent: string;
  lineNumber: number;
  matchIndex: number;
  matchLength: number;
}

interface FileResult {
  file: File;
  matches: SearchMatch[];
}

const SearchPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [isReplaceMode, setIsReplaceMode] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set());
  
  const files = useFileTreeStore(state => state.files);
  const selectFile = useFileTreeStore(state => state.selectFile);
  const updateFileContent = useFileTreeStore(state => state.updateFileContent);
  const saveFile = useFileTreeStore(state => state.saveFile);

  // Auto-expand files with matches when query changes
  useEffect(() => {
    if (query) {
      setExpandedFiles(new Set(results.map(r => r.file.id)));
    }
  }, [query]);

  const results: FileResult[] = useMemo(() => {
    if (!query) return [];

    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      // If not regex mode, escape special characters
      const pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(pattern, flags);
    } catch (e) {
      return [];
    }

    return files
      .filter(f => f.type === 'file')
      .map(file => {
        const matches: SearchMatch[] = [];
        const lines = file.content.split('\n');
        
        lines.forEach((line, lineIdx) => {
          let match;
          // Reset lastIndex for global regex
          regex.lastIndex = 0;
          
          while ((match = regex.exec(line)) !== null) {
            matches.push({
              lineContent: line,
              lineNumber: lineIdx + 1,
              matchIndex: match.index,
              matchLength: match[0].length
            });
            // Prevent infinite loop on zero-length matches
            if (match.index === regex.lastIndex) regex.lastIndex++;
          }
        });

        return matches.length > 0 ? { file, matches } : null;
      })
      .filter(Boolean) as FileResult[];
  }, [files, query, isCaseSensitive, isRegex]);

  const toggleFileExpand = (fileId: string) => {
    const newSet = new Set(expandedFiles);
    if (newSet.has(fileId)) {
      newSet.delete(fileId);
    } else {
      newSet.add(fileId);
    }
    setExpandedFiles(newSet);
  };

  const handleMatchClick = (file: File) => {
    selectFile(file);
    // In a real implementation, we would scroll to the line here
  };

  const handleReplaceAll = () => {
    if (!window.confirm(`Replace all occurrences of "${query}" with "${replaceText}" in ${results.length} files?`)) return;

    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(pattern, flags);
    } catch (e) { return; }

    results.forEach(({ file }) => {
      const newContent = file.content.replace(regex, replaceText);
      updateFileContent(newContent, true, file.id);
      saveFile({ ...file, content: newContent });
    });
  };

  const handleReplaceInFile = (fileResult: FileResult) => {
    let regex: RegExp;
    try {
      const flags = isCaseSensitive ? 'g' : 'gi';
      const pattern = isRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      regex = new RegExp(pattern, flags);
    } catch (e) { return; }

    const newContent = fileResult.file.content.replace(regex, replaceText);
    updateFileContent(newContent, true, fileResult.file.id);
    saveFile({ ...fileResult.file, content: newContent });
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f]/50">
      {/* Header / Search Inputs */}
      <div className="p-4 border-b border-white/5 space-y-3 bg-white/[0.02]">
        <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          <span>Search</span>
          <div className="flex gap-1">
             <button 
                onClick={() => setIsCaseSensitive(!isCaseSensitive)} 
                className={`p-1 rounded ${isCaseSensitive ? 'bg-vibe-accent/20 text-vibe-glow' : 'hover:bg-white/5 text-slate-500'}`}
                title="Match Case"
             >
                <IconCaseSensitive size={14} />
             </button>
             <button 
                onClick={() => setIsRegex(!isRegex)} 
                className={`p-1 rounded ${isRegex ? 'bg-vibe-accent/20 text-vibe-glow' : 'hover:bg-white/5 text-slate-500'}`}
                title="Use Regular Expression"
             >
                <IconRegex size={14} />
             </button>
          </div>
        </div>

        <div className="relative group">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search..."
            className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-vibe-accent transition-all placeholder-slate-600"
          />
          <IconSearch size={14} className="absolute left-2.5 top-2 text-slate-500 group-focus-within:text-vibe-glow transition-colors" />
        </div>

        <div className="flex items-center gap-2">
            <button 
                onClick={() => setIsReplaceMode(!isReplaceMode)}
                className={`p-1 rounded transition-colors ${isReplaceMode ? 'text-white' : 'text-slate-500 hover:text-white'}`}
            >
                <IconChevronRight size={14} className={`transition-transform duration-200 ${isReplaceMode ? 'rotate-90' : ''}`} />
            </button>
            
            {isReplaceMode && (
                <div className="relative group flex-1 animate-in slide-in-from-left-2 duration-200">
                    <input
                        type="text"
                        value={replaceText}
                        onChange={(e) => setReplaceText(e.target.value)}
                        placeholder="Replace..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg py-1.5 pl-8 pr-3 text-xs text-white focus:outline-none focus:border-vibe-accent transition-all placeholder-slate-600"
                    />
                    <IconReplace size={14} className="absolute left-2.5 top-2 text-slate-500 group-focus-within:text-vibe-glow transition-colors" />
                </div>
            )}
        </div>
        
        {isReplaceMode && query && results.length > 0 && (
             <button 
                onClick={handleReplaceAll}
                className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 py-1.5 rounded-lg text-xs font-bold transition-all"
             >
                <IconReplace size={12} /> Replace All ({results.reduce((acc, curr) => acc + curr.matches.length, 0)})
             </button>
        )}
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {query && results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 opacity-50">
                <IconSearch size={24} className="mb-2 text-slate-600" />
                <p className="text-xs text-slate-500">No results found.</p>
            </div>
        ) : (
            <div className="space-y-1">
                {results.map((result) => (
                    <div key={result.file.id} className="rounded-lg overflow-hidden border border-transparent hover:border-white/5 transition-colors bg-white/[0.01]">
                        <div 
                            className="flex items-center px-2 py-1.5 cursor-pointer bg-white/[0.02] hover:bg-white/[0.05] group"
                            onClick={() => toggleFileExpand(result.file.id)}
                        >
                            <span className="text-slate-500 mr-2 transition-transform duration-200">
                                {expandedFiles.has(result.file.id) ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                            </span>
                            <IconFileCode size={14} className="text-vibe-accent mr-2 opacity-80" />
                            <span className="text-xs text-slate-300 font-medium truncate flex-1">{result.file.name}</span>
                            <span className="text-[10px] bg-black/40 px-1.5 rounded-full text-slate-500 font-mono ml-2">
                                {result.matches.length}
                            </span>
                            {isReplaceMode && (
                                <button 
                                    onClick={(e) => { e.stopPropagation(); handleReplaceInFile(result); }}
                                    className="p-1 text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Replace in this file"
                                >
                                    <IconReplace size={12} />
                                </button>
                            )}
                        </div>
                        
                        {expandedFiles.has(result.file.id) && (
                            <div className="bg-black/20">
                                {result.matches.map((match, idx) => (
                                    <div 
                                        key={`${result.file.id}-${match.lineNumber}-${idx}`}
                                        onClick={() => handleMatchClick(result.file)}
                                        className="flex items-start pl-8 pr-2 py-1 hover:bg-vibe-accent/10 cursor-pointer group"
                                    >
                                        <span className="text-[10px] font-mono text-slate-600 w-8 text-right mr-3 shrink-0 pt-0.5 group-hover:text-slate-400 transition-colors">
                                            {match.lineNumber}
                                        </span>
                                        <div className="text-xs font-mono text-slate-400 truncate leading-relaxed">
                                            <span>{match.lineContent.substring(0, match.matchIndex)}</span>
                                            <span className="bg-vibe-accent/30 text-vibe-glow rounded-[2px] px-[1px]">{match.lineContent.substr(match.matchIndex, match.matchLength)}</span>
                                            <span>{match.lineContent.substring(match.matchIndex + match.matchLength)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
      </div>
    </div>
  );
};

export default SearchPanel;
