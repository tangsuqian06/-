import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill process for browser environment to avoid "ReferenceError: process is not defined"
// This maps VITE_API_KEY (standard Vite) or API_KEY (if replaced by bundler) to process.env.API_KEY
if (typeof process === 'undefined') {
  (window as any).process = {
    env: {
      // Try to grab from Vite's import.meta.env if available
      API_KEY: (import.meta as any).env?.VITE_API_KEY || (import.meta as any).env?.API_KEY || ''
    }
  };
}

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