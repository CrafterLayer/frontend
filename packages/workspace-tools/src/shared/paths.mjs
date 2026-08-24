import path from 'node:path';

/**
 * @param {string} repositoryRoot
 * @param {string} absolutePath
 */
export function toRepositoryPath(repositoryRoot, absolutePath) {
  const relativePath = path.relative(repositoryRoot, absolutePath);
  return relativePath.split(path.sep).join('/');
}

/**
 * @param {string} parentPath
 * @param {string} candidatePath
 */
export function isPathInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return (
    relativePath === '' ||
    (!relativePath.startsWith(`..${path.sep}`) &&
      relativePath !== '..' &&
      !path.isAbsolute(relativePath))
  );
}
