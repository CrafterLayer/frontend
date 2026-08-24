#!/usr/bin/env node

import { validateComponents } from '../components/validate-components.mjs';
import { formatDiagnostic } from '../shared/diagnostics.mjs';

const repositoryRoot = process.argv[2] ?? process.cwd();

try {
  const result = await validateComponents(repositoryRoot);
  if (result.valid) {
    process.stdout.write(
      `Component contract passed for ${result.components.length} component(s).\n`,
    );
  } else {
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
    }
    process.stderr.write(
      `Component contract failed with ${result.diagnostics.length} missing artifact(s) across ${result.components.length} component(s).\n`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[COMPONENT_CHECK_FAILED] ${repositoryRoot}: ${message}\n`);
  process.exitCode = 1;
}
