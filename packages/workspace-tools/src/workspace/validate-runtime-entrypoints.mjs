import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createDiagnostic } from '../shared/diagnostics.mjs';

/** Follow literal imports/re-exports, including dynamic imports, through each runtime graph. */
export async function validateRuntimeEntrypoints(repositoryRoot, diagnostics) {
  const root = path.join(repositoryRoot, 'packages/builder/code-runtime/src');
  for (const entry of ['index.ts', 'browser.ts', 'compiler.ts', 'export.ts']) {
    const pending = [path.join(root, entry)];
    const visited = new Set();
    while (pending.length > 0) {
      const file = pending.pop();
      if (visited.has(file)) continue;
      visited.add(file);
      let source;
      try {
        source = await readFile(file, 'utf8');
      } catch {
        continue;
      }
      const imports = [
        ...source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)(['"])([^'"\n]+)\1/gu),
      ];
      for (const match of imports) {
        const specifier = match[2];
        const browser = entry === 'browser.ts';
        const typeRoot = entry === 'index.ts';
        const forbidden =
          (browser &&
            (/^(node:|esbuild$|typescript$|tailwindcss$)/u.test(specifier) ||
              /(?:^|\/)compiler(?:\/|$)/u.test(specifier))) ||
          ((browser || entry === 'compiler.ts' || entry === 'export.ts') &&
            /@craftkit\/builder-(?:editor|shell|renderer)|(?:^|\/)apps\//u.test(specifier)) ||
          (typeRoot && /(?:^|\/)(?:compiler|browser|export)(?:\/|$)/u.test(specifier));
        if (forbidden)
          diagnostics.push(
            createDiagnostic({
              code: 'BUILDER_RUNTIME_ENTRYPOINT',
              ownerPath: path.relative(repositoryRoot, file),
              message: `${entry} reaches forbidden runtime dependency "${specifier}". Keep browser, compiler and type-only entrypoints physically separate.`,
            }),
          );
        if (specifier.startsWith('.')) {
          const target = path.resolve(path.dirname(file), specifier);
          if (target === root || target.startsWith(root + path.sep)) {
            pending.push(
              target.endsWith('.ts') ? target : target + '.ts',
              path.join(target, 'index.ts'),
            );
          }
        }
      }
    }
  }
}
