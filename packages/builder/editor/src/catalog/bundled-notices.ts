import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/** Trusted build inputs only. Include notices for the packages actually bundled, not a host scan. */
export async function bundledNotices(
  inputs: readonly string[],
  workingDirectory: string,
): Promise<string> {
  const directories = new Set<string>();
  const visited = new Set<string>();
  for (const input of inputs) {
    if (input.startsWith('<')) continue;
    let directory = dirname(resolve(workingDirectory, input));
    while (!visited.has(directory)) {
      visited.add(directory);
      try {
        const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
          name?: string;
        };
        if (metadata.name !== undefined) {
          directories.add(directory);
          break;
        }
      } catch {
        // A source directory is usually not a package root; only the build's ancestors are read.
      }
      const parent = dirname(directory);
      if (parent === directory) break;
      directory = parent;
    }
  }
  const notices: string[] = [];
  for (const directory of [...directories].sort()) {
    const metadata = JSON.parse(await readFile(join(directory, 'package.json'), 'utf8')) as {
      name: string;
      version: string;
      license?: string;
    };
    if (metadata.license !== 'MIT')
      throw new Error(
        `Review bundled license for ${metadata.name}: ${metadata.license ?? 'missing'}`,
      );
    let license: string | undefined;
    for (const filename of ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'license']) {
      try {
        license = await readFile(join(directory, filename), 'utf8');
        break;
      } catch {
        /* Try the next conventional published notice name. */
      }
    }
    if (license === undefined) throw new Error(`Missing bundled license for ${metadata.name}`);
    notices.push(
      `/*! ${metadata.name}@${metadata.version}\n${license.replaceAll('*/', '* /')}\n*/`,
    );
  }
  return notices.join('\n');
}
