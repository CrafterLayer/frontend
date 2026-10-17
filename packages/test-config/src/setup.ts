import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Testing Library only auto-registers cleanup when a global `afterEach` exists;
// this workspace does not enable vitest globals, so register it explicitly —
// otherwise rendered trees leak across tests (e.g. duplicate iframes/titles).
afterEach(() => {
  cleanup();
});
