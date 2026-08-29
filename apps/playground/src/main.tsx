import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

// Tailwind + the builder's token bridge. Imported at the root so the theme
// arrives before any component renders.
import './tailwind.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Playground root element is missing.');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
