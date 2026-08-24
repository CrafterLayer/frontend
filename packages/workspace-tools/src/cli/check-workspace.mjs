#!/usr/bin/env node

import { formatDiagnostic } from '../shared/diagnostics.mjs';
import { validateWorkspace } from '../workspace/validate-workspace.mjs';

const repositoryRoot = process.argv[2] ?? process.cwd();

try {
  const result = await validateWorkspace(repositoryRoot);
  if (result.valid) {
    process.stdout.write(`Workspace contract passed for ${result.members.length} member(s).\n`);
  } else {
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
    }
    process.stderr.write(
      `Workspace contract failed with ${result.diagnostics.length} violation(s) across ${result.members.length} member(s).\n`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[WORKSPACE_CHECK_FAILED] ${repositoryRoot}: ${message}\n`);
  process.exitCode = 1;
}
