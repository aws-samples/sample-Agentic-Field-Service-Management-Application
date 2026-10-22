import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.simple';
import '@cloudscape-design/global-styles/index.css';

console.log('Simple React app starting...');

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
