import type { ArtifactFile } from '@craftkit/builder';

const encoder = new TextEncoder();

/** Portable ZIP (stored entries) preserving export paths without another runtime dependency. */
export function createArtifactArchive(files: readonly ArtifactFile[]): Uint8Array<ArrayBuffer> {
  if (files.length === 0 || files.length > 65535)
    throw new Error('Export contains an invalid number of files.');
  const entries = files.map((file) => {
    if (
      !file.path ||
      file.path.startsWith('/') ||
      file.path.includes('\\') ||
      file.path.split('/').some((part) => !part || part === '.' || part === '..')
    ) {
      throw new Error('Export contains an unsafe file path.');
    }
    const name = encoder.encode(file.path);
    const content = file.bytes ?? encoder.encode(file.content);
    if (name.length > 65535) throw new Error('Export file path is too long.');
    return { name, content, crc: crc32(content) };
  });
  if (new Set(files.map((file) => file.path)).size !== files.length)
    throw new Error('Export contains duplicate file paths.');
  const localBytes = entries.reduce(
    (sum, entry) => sum + 30 + entry.name.length + entry.content.length,
    0,
  );
  const centralBytes = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0);
  if (localBytes + centralBytes + 22 > 256 * 1024 * 1024)
    throw new Error('Export exceeds the browser archive size limit.');
  const bytes = new Uint8Array(localBytes + centralBytes + 22);
  const view = new DataView(bytes.buffer);
  let localOffset = 0;
  let centralOffset = localBytes;
  for (const entry of entries) {
    view.setUint32(localOffset, 0x04034b50, true);
    view.setUint16(localOffset + 4, 20, true);
    view.setUint16(localOffset + 6, 0x0800, true);
    view.setUint16(localOffset + 12, 0x21, true);
    view.setUint32(localOffset + 14, entry.crc, true);
    view.setUint32(localOffset + 18, entry.content.length, true);
    view.setUint32(localOffset + 22, entry.content.length, true);
    view.setUint16(localOffset + 26, entry.name.length, true);
    bytes.set(entry.name, localOffset + 30);
    bytes.set(entry.content, localOffset + 30 + entry.name.length);

    view.setUint32(centralOffset, 0x02014b50, true);
    view.setUint16(centralOffset + 4, 20, true);
    view.setUint16(centralOffset + 6, 20, true);
    view.setUint16(centralOffset + 8, 0x0800, true);
    view.setUint16(centralOffset + 14, 0x21, true);
    view.setUint32(centralOffset + 16, entry.crc, true);
    view.setUint32(centralOffset + 20, entry.content.length, true);
    view.setUint32(centralOffset + 24, entry.content.length, true);
    view.setUint16(centralOffset + 28, entry.name.length, true);
    view.setUint32(centralOffset + 42, localOffset, true);
    bytes.set(entry.name, centralOffset + 46);
    localOffset += 30 + entry.name.length + entry.content.length;
    centralOffset += 46 + entry.name.length;
  }
  view.setUint32(centralOffset, 0x06054b50, true);
  view.setUint16(centralOffset + 8, entries.length, true);
  view.setUint16(centralOffset + 10, entries.length, true);
  view.setUint32(centralOffset + 12, centralBytes, true);
  view.setUint32(centralOffset + 16, localBytes, true);
  return bytes;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
