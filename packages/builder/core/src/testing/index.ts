// @craftkit/builder-core/testing — deterministic ports and shared fixtures for
// kernel tests and (from B1 on) consumer-package tests.

export { fixedClock, seededIds } from './fixed-ports';
export { emptyDocument, fixtureBlocks, landingFixture, stressDocument } from './fixtures';
export { fakeExtension } from './fake-extension';
export { createMemoryPersistence, type MemoryPersistence } from './memory-persistence';
