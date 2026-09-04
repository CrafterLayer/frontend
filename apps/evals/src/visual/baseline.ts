import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * Names are restricted to characters that mean the same thing on every filesystem, and `..` and
 * separators are excluded outright. A baseline name usually comes from a test title or a route, so
 * it is one directory traversal away from writing PNGs anywhere on the machine, and a name that
 * differs only by case would silently share a file with its twin on macOS while getting its own on
 * Linux.
 */
const SAFE_BASELINE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

/** Thrown when a baseline name could escape, or collide inside, the baseline directory. */
export class InvalidBaselineNameError extends Error {
  override readonly name = 'InvalidBaselineNameError';

  constructor(readonly baselineName: string) {
    super(
      `"${baselineName}" is not a usable baseline name. Use lowercase letters, digits, dots, ` +
        `dashes and underscores, starting with a letter or digit.`,
    );
  }
}

function assertSafeName(name: string): void {
  if (!SAFE_BASELINE_NAME.test(name) || name.includes('..')) {
    throw new InvalidBaselineNameError(name);
  }
}

/** The path a baseline PNG is stored at. Callers can report it without touching the filesystem. */
export function baselinePath(directory: string, name: string): string {
  assertSafeName(name);
  return join(directory, `${name}.png`);
}

/** The path {@link writeDiffImage} stores a diff under, next to the baseline it came from. */
export function diffImagePath(directory: string, name: string): string {
  assertSafeName(name);
  return join(directory, `${name}.diff.png`);
}

/**
 * Read a stored baseline, or `null` when none has been recorded yet.
 *
 * Only a missing file yields `null`. A permissions error or an unreadable directory is rethrown,
 * because treating those as "no baseline yet" would quietly overwrite a real baseline with
 * whatever the current run produced.
 */
export async function readBaseline(directory: string, name: string): Promise<Buffer | null> {
  try {
    return await readFile(baselinePath(directory, name));
  } catch (error: unknown) {
    if (isFileNotFound(error)) return null;
    throw error;
  }
}

function isFileNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

/** Write a baseline PNG, creating the baseline directory if it does not exist. */
export async function writeBaseline(directory: string, name: string, png: Buffer): Promise<string> {
  const path = baselinePath(directory, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path, png);
  return path;
}

/** Write a diff image produced by `compareScreenshots`, for a human to look at after a failure. */
export async function writeDiffImage(
  directory: string,
  name: string,
  diffPng: Buffer,
): Promise<string> {
  const path = diffImagePath(directory, name);
  await mkdir(directory, { recursive: true });
  await writeFile(path, diffPng);
  return path;
}

export type BaselineStatus = 'created' | 'updated' | 'reused';

export interface ResolveBaselineRequest {
  /** Directory the baselines live in. Created on demand. */
  readonly directory: string;
  /** Stable identifier for this screenshot, e.g. `home-hero`. See {@link SAFE_BASELINE_NAME}. */
  readonly name: string;
  /** The screenshot captured by this run. */
  readonly candidate: Buffer;
  /** Overwrite the stored baseline with the candidate and accept it as the new truth. */
  readonly update?: boolean;
}

export interface ResolvedBaseline {
  readonly status: BaselineStatus;
  readonly path: string;
  /** The bytes to compare the candidate against. */
  readonly baseline: Buffer;
  /**
   * Whether comparing `baseline` against the candidate proves anything. It is false exactly when
   * this call wrote the baseline, since the two buffers are then the same bytes and a comparison
   * would trivially report "identical" — which is the false pass a caller must not read as a
   * result.
   */
  readonly comparable: boolean;
  /** A sentence for the run log saying what happened to the baseline and what it means. */
  readonly message: string;
}

/**
 * Find the baseline to compare against, recording one when none exists yet.
 *
 * A first run has nothing to compare against. Rather than fail — which makes a new check look
 * broken — or pass silently — which hides that nothing was actually verified — this writes the
 * candidate as the new baseline, returns `comparable: false`, and says so in `message`. The caller
 * must branch on `comparable` and report "baseline recorded", never "visually unchanged".
 */
export async function resolveBaseline(request: ResolveBaselineRequest): Promise<ResolvedBaseline> {
  const { directory, name, candidate } = request;
  const path = baselinePath(directory, name);

  if (request.update === true) {
    await writeBaseline(directory, name, candidate);
    return {
      status: 'updated',
      path,
      baseline: candidate,
      comparable: false,
      message: `Update mode: overwrote the baseline at ${path}. Nothing was verified this run.`,
    };
  }

  const stored = await readBaseline(directory, name);
  if (stored === null) {
    await writeBaseline(directory, name, candidate);
    return {
      status: 'created',
      path,
      baseline: candidate,
      comparable: false,
      message:
        `No baseline existed, so this run's screenshot was recorded as the baseline at ${path}. ` +
        `Nothing was verified this run; review the image and commit it.`,
    };
  }

  return {
    status: 'reused',
    path,
    baseline: stored,
    comparable: true,
    message: `Comparing against the recorded baseline at ${path}.`,
  };
}
