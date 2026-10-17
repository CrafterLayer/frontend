/*
  What the scene kit reads from its region and its params: direction, language, the font family
  text inherits, and numeric params. Moved out of create-scene.ts unchanged (responsive scenes,
  2026-10-13): that file may only shrink, and these are plain module-level helpers.
*/

import type { ScriptParamValue } from './types';

export function readDirection(root: HTMLElement, given: boolean | undefined): boolean {
  if (typeof given === 'boolean') return given;
  const marked = root.closest('[dir]');
  if (marked !== null) return marked.getAttribute('dir')?.toLowerCase() === 'rtl';
  try {
    return root.ownerDocument.defaultView?.getComputedStyle(root).direction === 'rtl';
  } catch {
    return false;
  }
}

export function readLang(root: HTMLElement, given: string | undefined): string {
  if (typeof given === 'string' && given !== '') return given;
  const marked = root.closest('[lang]');
  return (
    marked?.getAttribute('lang') ?? root.ownerDocument.documentElement.getAttribute('lang') ?? ''
  );
}

export function readFontFamily(root: HTMLElement): string | undefined {
  try {
    const family = root.ownerDocument.defaultView?.getComputedStyle(root).fontFamily;
    return family === undefined || family === '' ? undefined : family;
  } catch {
    return undefined;
  }
}

export function numberParam(
  params: Record<string, ScriptParamValue>,
  key: string,
): number | undefined {
  const value = params[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
