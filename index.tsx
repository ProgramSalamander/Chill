
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loader } from "@monaco-editor/react";

// Preload Monaco Editor scripts from a fast CDN to ensure availability before component mount
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.46.0/min/vs',
  },
});

loader.init().catch(err => console.error('Monaco pre-load failed:', err));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
