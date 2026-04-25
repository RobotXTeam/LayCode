import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function App() {
  return (
    <main className="hero">
      <h1 id="hero-title">LayCode React Sample</h1>
      <button id="hero-button">Get Started</button>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
