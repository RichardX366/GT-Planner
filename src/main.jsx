import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PlannerProvider } from './lib/store.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PlannerProvider>
      <App />
    </PlannerProvider>
  </React.StrictMode>
);
