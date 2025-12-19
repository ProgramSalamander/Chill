import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loader } from "@monaco-editor/react";

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Using a path relative to root to help the browser find it in various deployment setups
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(reg => console.log('[Chill] ServiceWorker registered with scope:', reg.scope))
      .catch(err => {
        console.warn('[Chill] ServiceWorker registration failed. Note: This is expected if sw.js is not served at root.', err);
      });
  });
}

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