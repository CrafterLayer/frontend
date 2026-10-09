import { useCallback, useEffect } from 'react';

import type { BuilderKernel } from '@craftkit/builder-core';
import { useKernelSelector } from '@craftkit/builder-renderer';

import { documentLanguage } from '../TemplateCard/template-order';

/*
  `<html lang>` of the canvas and Preview frames (agent-script DESIGN §B.1.6,
  library-playground). CanvasFrame sets the frame root's `dir` but never its
  `lang`, so every frame read `lang=""`: a screen reader guessed the language
  and `:lang(ar)` font rules never matched. The tag follows the DOCUMENT — the
  root's `lang` prop, else `ar` for a right-to-left page and `en` otherwise —
  the same rule the static export writes (export-static-site.ts `languageOf`).
  A Preview direction flip is view state over the same words, so it does not
  change the language.
*/

/** Writes the tag on the frame's root element; a no-op until the frame document exists. */
export function applyFrameLang(frame: HTMLIFrameElement | null, lang: string): void {
  const root = frame?.contentDocument?.documentElement;
  if (root !== undefined && root.getAttribute('lang') !== lang) root.setAttribute('lang', lang);
}

/** Keeps a frame's `<html lang>` on the document's language as the root `lang` prop or `dir` changes. */
export function useFrameLang(kernel: BuilderKernel, frame: HTMLIFrameElement | null): string {
  const lang = useKernelSelector(
    kernel,
    useCallback(
      (state: ReturnType<BuilderKernel['context']['store']['getState']>) => documentLanguage(state.doc),
      [],
    ),
  );
  useEffect(() => {
    applyFrameLang(frame, lang);
  }, [frame, lang]);
  return lang;
}
