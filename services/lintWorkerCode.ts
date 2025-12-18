
export const LINT_WORKER_CODE = `
import init, { Workspace, PositionEncoding } from "https://esm.sh/@astral-sh/ruff-wasm-web@^0.14.9";

let ruffInitialized = false;
let ruffInitPromise = null;

const initRuff = async () => {
    if (ruffInitialized) return;
    if (ruffInitPromise) return ruffInitPromise;
    ruffInitPromise = init().then(() => {
        ruffInitialized = true;
    }).catch(e => console.error("Ruff init failed", e));
    await ruffInitPromise;
};

// Basic Linter Logic
const lintBasic = (code) => {
  const diagnostics = [];
  const lines = code.split('\\n');
  
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
          message: \`Unbalanced curly braces '{ }' (Diff: \${openBraces})\`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }
  if (openParens !== 0) {
       diagnostics.push({
          message: \`Unbalanced parentheses '( )' (Diff: \${openParens})\`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }
  if (openBrackets !== 0) {
       diagnostics.push({
          message: \`Unbalanced square brackets '[ ]' (Diff: \${openBrackets})\`,
          severity: 'error',
          startLine: lines.length, startColumn: 1, endLine: lines.length, endColumn: 1
      });
  }

  return diagnostics;
};

// Ruff Linter Logic
const lintRuff = (code) => {
  if (!ruffInitialized) return [];

  // Minimal config for fast web usage
  const workspace = new Workspace({
    'line-length': 88,
    'indent-width': 4,
    format: {
      'indent-style': 'space',
      'quote-style': 'double',
    },
    lint: {
      // Select defaults + some common errors
      select: [ 'E4', 'E7', 'E9', 'F', 'W' ], 
    },
  }, PositionEncoding.Utf16);

  try {
    const diagnostics = workspace.check(code);
    return diagnostics.map((d) => ({
      message: d.message,
      code: d.code || 'SyntaxError',
      severity: d.code?.startsWith('W') ? 'warning' : 'error',
      startLine: d.start_location.row,
      startColumn: d.start_location.column,
      endLine: d.end_location.row,
      endColumn: d.end_location.column
    }));
  } catch (e) {
    console.error("Ruff linting error:", e);
    return [];
  }
};

self.onmessage = async (e) => {
    const { id, code, language, activeLinters } = e.data;
    const results = [];

    try {
        // Basic Linter
        if (activeLinters.includes('basic-linter') && ['javascript', 'typescript', 'json', 'css', 'jsx', 'tsx'].includes(language)) {
            results.push(...lintBasic(code));
        }

        // Ruff Linter
        if (activeLinters.includes('ruff-linter') && language === 'python') {
            await initRuff();
            results.push(...lintRuff(code));
        }
        
        self.postMessage({ id, diagnostics: results });
    } catch (e) {
        self.postMessage({ id, error: e.message, diagnostics: [] });
    }
};
`;
