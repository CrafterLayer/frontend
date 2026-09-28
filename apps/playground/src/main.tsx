import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';

// The chrome's one family, self-hosted (SPEC §2.2): the host decides which fonts load,
// not the theme package. Six subset files, weights 400/500/600 only. Plex Sans Arabic's
// own Latin subsets are deliberately NOT loaded: Latin in an Arabic line falls through
// to Plex Sans, so no Latin is downloaded twice. Measured 2026-09-28 (fontsource 5.3.0):
// 71,024 B of Latin and 133,832 B of Arabic woff2; the table and the caveats are in
// features/agent/components/TypeSpecimen/TypeSpecimen.docs.mdx.
import '@fontsource/ibm-plex-sans/latin-400.css';
import '@fontsource/ibm-plex-sans/latin-500.css';
import '@fontsource/ibm-plex-sans/latin-600.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-400.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-500.css';
import '@fontsource/ibm-plex-sans-arabic/arabic-600.css';

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
