import init, { Workspace, type Diagnostic as RuffDiagnostic, PositionEncoding } from "@astral-sh/ruff-wasm-web";
import { Linter, Diagnostic } from '../../types';

let isReady = false;
let initPromise: Promise<void> | null = null;

const initialize = async () => {
  if (isReady) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      await init();
      isReady = true;
      console.log("Ruff WASM initialized successfully");
    } catch (e) {
      console.error("Failed to initialize Ruff WASM:", e);
    }
  })();

  return initPromise;
};

const lint = (code: string): Diagnostic[] => {
  if (!isReady) return [];

  const workspace = new Workspace({
    'line-length': 88,
    'indent-width': 4,
    format: {
      'indent-style': 'space',
      'quote-style': 'double',
    },
    lint: {
      select: [ 'E4', 'E7', 'E9', 'F' ],
    },
  }, PositionEncoding.Utf16);

  try {
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

export const ruffLinter: Linter = {
  id: 'ruff-linter',
  name: 'Ruff',
  description: 'An extremely fast Python linter and code formatter, written in Rust.',
  supportedLanguages: ['python'],
  init: initialize,
  lint: lint,
};
