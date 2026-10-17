#!/usr/bin/env node

import { writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  FILE_SIZE_BASELINE_PATH,
  FILE_SIZE_LIMITS,
  oversizedFiles,
  validateFileSizes,
} from '../files/validate-file-sizes.mjs';
import { formatDiagnostic } from '../shared/diagnostics.mjs';

const args = process.argv.slice(2);
const writeBaseline = args.includes('--write-baseline');
const repositoryRoot = args.find((arg) => !arg.startsWith('--')) ?? process.cwd();

try {
  const result = await validateFileSizes(repositoryRoot);
  if (writeBaseline) {
    // Opt-in only: the check itself never mutates the repository.
    const files = oversizedFiles(result.measured);
    await writeFile(
      path.join(path.resolve(repositoryRoot), FILE_SIZE_BASELINE_PATH),
      `${JSON.stringify({ limits: FILE_SIZE_LIMITS, files }, null, 2)}\n`,
      'utf8',
    );
    process.stdout.write(
      `Wrote ${String(Object.keys(files).length)} oversized file(s) to ${FILE_SIZE_BASELINE_PATH}.\n`,
    );
  } else if (result.valid) {
    process.stdout.write(
      `File sizes passed for ${String(result.measured.length)} file(s) (source ≤ ${String(FILE_SIZE_LIMITS.source)}, tests ≤ ${String(FILE_SIZE_LIMITS.test)} lines).\n`,
    );
    for (const file of result.shrunk) {
      process.stdout.write(
        `  ${file.path} shrank to ${String(file.lines)} lines: tighten its baseline with --write-baseline.\n`,
      );
    }
  } else {
    for (const diagnostic of result.diagnostics) {
      process.stderr.write(`${formatDiagnostic(diagnostic)}\n`);
    }
    process.stderr.write(
      `File size check failed with ${String(result.diagnostics.length)} violation(s).\n`,
    );
    process.exitCode = 1;
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[FILE_SIZE_CHECK_FAILED] ${repositoryRoot}: ${message}\n`);
  process.exitCode = 1;
}
