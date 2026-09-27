import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

// The editor chrome's design system. The facade's index also imports it, but a
// production bundle skips that side-effect-free module when only its re-exports
// are used, and the whole chrome then ships unstyled. The root import keeps it.
import '@craftkit/builder/css';
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
