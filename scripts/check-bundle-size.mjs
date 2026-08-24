import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export async function checkBundleSize(file, maximumBytes) {
  if (!Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new TypeError('maximumBytes must be a positive safe integer');
  }

  const absoluteFile = resolve(file);
  const fileStats = await stat(absoluteFile);

  if (!fileStats.isFile()) {
    throw new TypeError(`Bundle target is not a file: ${absoluteFile}`);
  }

  if (fileStats.size > maximumBytes) {
    throw new RangeError(
      `Bundle budget exceeded for ${absoluteFile}: ${fileStats.size} bytes > ${maximumBytes} bytes`,
    );
  }

  return { file: absoluteFile, maximumBytes, size: fileStats.size };
}

async function run() {
  const [file, maximumBytesInput] = process.argv.slice(2);

  if (!file || !maximumBytesInput) {
    throw new TypeError('Usage: check-bundle-size.mjs <file> <maximum-bytes>');
  }

  const result = await checkBundleSize(file, Number(maximumBytesInput));
  process.stdout.write(
    `Bundle size OK: ${result.file} is ${result.size}/${result.maximumBytes} bytes\n`,
  );
}

const executedFile = process.argv[1];

if (executedFile && import.meta.url === pathToFileURL(executedFile).href) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
