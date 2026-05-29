import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { WebSocketProvider } from './lib/WebSocketContext.tsx';

// Generate a dummy session ID for local testing
const sessionId = 'test-session-' + Math.floor(Math.random() * 1000);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WebSocketProvider url={`ws://localhost:8080/ws/${sessionId}`}>
      <App />
    </WebSocketProvider>
  </StrictMode>,
);
