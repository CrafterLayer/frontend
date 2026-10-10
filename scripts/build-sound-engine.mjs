#!/usr/bin/env node

import { buildStudioEngines } from './build-studio-engines.mjs';

try {
  await buildStudioEngines('sound');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
