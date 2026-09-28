/*
  Plan mode's entry point, `planAiPage`, is implemented once, in
  agent/plan-page.ts, beside the T1 step the build shares with it. This module
  only keeps the page-plan barrel's name for it pointing there.

  It used to hold a stub that rejected 'not implemented: planAiPage', and the
  package root exported the stub — so Plan mode's public entry point failed
  for every host while the real one sat one directory up (engine wave-2
  verifier, repro v6-root.mjs, 2026-09-28). A second body here would be a
  second answer to the same question; a re-export cannot drift.
*/
export { planAiPage } from '../plan-page';
