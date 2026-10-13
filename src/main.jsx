import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { PlannerProvider } from './lib/store.jsx';
import { DataProvider } from './lib/data.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PlannerProvider>
      <DataProvider>
        <App />
      </DataProvider>
    </PlannerProvider>
  </React.StrictMode>
);
