import type { PlaygroundFixture } from './create-playground-kernel';

const CURRENT_WORKSPACE_KEY = 'craftkit-current-workspace-v1';
const FIXTURES: readonly PlaygroundFixture[] = [
  'landing',
  'empty',
  'inline',
  'code-view',
  'code-page',
];

export function readCurrentWorkspace(): PlaygroundFixture {
  try {
    const value = localStorage.getItem(CURRENT_WORKSPACE_KEY);
    return FIXTURES.find((fixture) => fixture === value) ?? 'landing';
  } catch {
    return 'landing';
  }
}

/** Navigation preference only. Project durability is acknowledged separately by Vault. */
export function rememberCurrentWorkspace(fixture: PlaygroundFixture): void {
  try {
    localStorage.setItem(CURRENT_WORKSPACE_KEY, fixture);
  } catch {
    /* Storage can be disabled. */
  }
}
