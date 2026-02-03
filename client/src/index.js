import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  // Temporarily disable StrictMode to prevent double socket connections in development
  // <React.StrictMode>
    <App />
  // </React.StrictMode>
);
