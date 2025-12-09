import init, { Workspace, type Diagnostic as RuffDiagnostic, PositionEncoding } from "@astral-sh/ruff-wasm-web";
import { Diagnostic } from '../types';

let isReady = false;
let initPromise: Promise<void> | null = null;

export const initRuff = async () => {
  if (isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // The init function fetches the WASM. 
      // In a no-bundler environment via esm.sh, the WASM path is usually handled relative to the JS.
      await init();
      isReady = true;
      console.log("Ruff WASM initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Ruff WASM:", e);
      // We don't throw, just log, so the app doesn't crash. Linting will just be unavailable.
    }
  })();

  return initPromise;
};


export const runPythonLint = (code: string): Diagnostic[] => {
  if (!isReady) return [];

  const workspace = new Workspace({
    'line-length': 88,
    'indent-width': 4,
    format: {
      'indent-style': 'space',
      'quote-style': 'double',
    },
    lint: {
      select: [
        'E4',
        'E7',
        'E9',
        'F'
      ],
    },
  }, PositionEncoding.Utf16);

  try {
    // ruff-api check returns an array of diagnostics
    const ruffDiagnostics: RuffDiagnostic[] = workspace.check(code);

    return ruffDiagnostics.map((d) => ({
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
