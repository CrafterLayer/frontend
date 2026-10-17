import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles.css';

const container = document.getElementById('root');

if (container === null) {
  throw new Error('Adaptive Spec Router root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
