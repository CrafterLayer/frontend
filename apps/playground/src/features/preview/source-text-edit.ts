import { codeFileHash, type CodeFile } from '@craftkit/builder';
import type { RuntimeSnapshot, SourceElement } from '@craftkit/builder/code-runtime';

export interface StaticTextChange {
  readonly path: string;
  readonly expectedHash: string;
  readonly file: CodeFile;
}

/** Applies only the exact text span identified by the compiler for this source revision. */
export function prepareStaticTextChange(
  snapshot: RuntimeSnapshot,
  element: SourceElement,
  text: string,
): StaticTextChange {
  const { handle, staticText } = element;
  if (
    handle.projectId !== snapshot.projectId ||
    handle.sourceRevision !== snapshot.project.revision
  ) {
    throw new Error('The selection belongs to an older source revision. Select the element again.');
  }
  if (handle.modulePath !== snapshot.entry || element.dynamic) {
    throw new Error(
      'This element uses shared or dynamic source. Open source to review its impact.',
    );
  }
  const file = snapshot.project.files[handle.modulePath];
  if (
    file === undefined ||
    staticText === undefined ||
    staticText.start < element.start ||
    staticText.end > element.end ||
    staticText.end < staticText.start ||
    file.source.slice(staticText.start, staticText.end) !== staticText.source
  ) {
    throw new Error('The selected static text no longer matches its source. Select it again.');
  }
  const escaped = text.replace(
    /[&<>{}]/gu,
    (character) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '{': '&#123;', '}': '&#125;' })[character] ??
      character,
  );
  return {
    path: handle.modulePath,
    expectedHash: codeFileHash(file),
    file: {
      ...file,
      source: file.source.slice(0, staticText.start) + escaped + file.source.slice(staticText.end),
    },
  };
}

export function staticTextValue(element: SourceElement): string | undefined {
  return element.staticText?.source.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu,
    (entity: string, name: string) => {
      const named: Readonly<Record<string, string>> = {
        amp: '&',
        lt: '<',
        gt: '>',
        quot: '"',
        apos: "'",
      };
      if (!name.startsWith('#')) return named[name.toLowerCase()] ?? entity;
      const hex = name.slice(0, 2).toLowerCase() === '#x';
      const point = Number.parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
    },
  );
}
