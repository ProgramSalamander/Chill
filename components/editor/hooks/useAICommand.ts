
import { useState, useEffect } from 'react';
import * as monaco from 'monaco-editor';

/**
 * Registers a generic command in the editor that executes a callback function passed as an argument.
 * This is used by CodeLenses and CodeActions to trigger dynamic actions.
 */
export const useAICommand = (
  editor: monaco.editor.IStandaloneCodeEditor | null
) => {
  const [commandId, setCommandId] = useState<string | null>(null);

  useEffect(() => {
    if (!editor) return;

    // Registers a command that takes a function (callback) as its first argument and executes it.
    // This allows us to bind specific closures (like onAICommand with specific params) to UI elements.
    const id = editor.addCommand(0, (_: any, callback: () => void) => {
      if (callback && typeof callback === 'function') {
        callback();
      }
    }, '');

    setCommandId(id);
    
    // Command disposal is handled by the editor model usually, 
    // but if we wanted to be strict we could dispose. 
    // Since this runs once per editor instance, it's safe.
  }, [editor]);

  return commandId;
};
