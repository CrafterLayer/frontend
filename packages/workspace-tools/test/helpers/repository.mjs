import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../..',
);

export async function readRepositoryText(relativePath) {
  return readFile(path.join(repositoryRoot, relativePath), 'utf8');
}

export async function readRepositoryJson(relativePath) {
  return JSON.parse(await readRepositoryText(relativePath));
}
