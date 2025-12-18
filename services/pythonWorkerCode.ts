
export const PYTHON_WORKER_CODE = `
importScripts("https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js");

let pyodide = null;
let pyodideReadyPromise = null;

async function loadPyodideAndPackages() {
  try {
    pyodide = await loadPyodide();
    // Pre-load common scientific packages
    await pyodide.loadPackage(["numpy", "pandas", "matplotlib"]);
    self.postMessage({ type: 'ready' });
  } catch (err) {
    self.postMessage({ type: 'error', content: 'Failed to load Pyodide: ' + err.message });
  }
}

pyodideReadyPromise = loadPyodideAndPackages();

// Helper to recursively create directories
function mkdirp(path) {
  const parts = path.split('/');
  let current = '';
  for (let i = 0; i < parts.length - 1; i++) {
    current += (current ? '/' : '') + parts[i];
    if (!pyodide.FS.analyzePath(current).exists) {
      pyodide.FS.mkdir(current);
    }
  }
}

const runPython = async (id, code) => {
  await pyodideReadyPromise;
  if (!pyodide) {
      self.postMessage({ id, type: 'error', content: 'Pyodide not initialized' });
      return;
  }

  try {
    // Redirect stdout/stderr to capture output
    pyodide.setStdout({ batched: (msg) => self.postMessage({ id, type: 'stdout', content: msg }) });
    pyodide.setStderr({ batched: (msg) => self.postMessage({ id, type: 'stderr', content: msg }) });
    
    // Execute
    await pyodide.loadPackagesFromImports(code);
    const result = await pyodide.runPythonAsync(code);
    
    self.postMessage({ id, type: 'result', content: result !== undefined ? String(result) : '' });
  } catch (error) {
    self.postMessage({ id, type: 'error', content: error.toString() });
  }
};

self.onmessage = async (event) => {
  const { id, type, code, files } = event.data;

  if (type === 'run') {
      // Sync file system if provided
      if (files && pyodide) {
          // Reset file system (optional, but good for clean state) to avoid conflicts? 
          // For now we just overwrite.
          
          for (const [path, content] of Object.entries(files)) {
              try {
                  mkdirp(path);
                  pyodide.FS.writeFile(path, content, { encoding: 'utf8' });
              } catch(e) {
                  self.postMessage({ id, type: 'stderr', content: 'FS Sync Error: ' + e.message + ' for ' + path });
              }
          }
      }
      await runPython(id, code);
  }
};
`;
