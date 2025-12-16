import { Linter, Diagnostic } from '../../types';

const lint = (code: string): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];
  const lines = code.split('\n');
  
  let openBraces = 0;
  let openParens = 0;
  let openBrackets = 0;

  for(let i=0; i<code.length; i++) {
      const char = code[i];
      if(char === '{') openBraces++;
      if(char === '}') openBraces--;
      if(char === '(') openParens++;
      if(char === ')') openParens--;
      if(char === '[') openBrackets++;
      if(char === ']') openBrackets--;
  }

  if (openBraces !== 0) {
      diagnostics.push({
          message: `Unbalanced curly braces '{ }' (Diff: ${openBraces})`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }
  if (openParens !== 0) {
       diagnostics.push({
          message: `Unbalanced parentheses '( )' (Diff: ${openParens})`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }
  if (openBrackets !== 0) {
       diagnostics.push({
          message: `Unbalanced square brackets '[ ]' (Diff: ${openBrackets})`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }

  return diagnostics;
};

export const basicLinter: Linter = {
  id: 'basic-linter',
  name: 'Basic Syntax Check',
  description: 'A simple syntax checker for unbalanced brackets, braces, and parentheses.',
  supportedLanguages: ['javascript', 'typescript', 'json', 'css', 'jsx', 'tsx'],
  lint: lint,
};
