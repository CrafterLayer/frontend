import { useCallback, useEffect, useMemo, useState } from 'react';

import { RAIL_UTILITIES, railItemsIn } from './rail-sections';
import { RAIL_DESTINATIONS } from './rail-destinations';
import { editorLabels, initialEditorLocale, type EditorLocale } from './editor-labels';

/** The rail's own agent button: where focus returns when the phone sheet closes. */
function railAgentButton(name: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`.bldr-icon-rail button[aria-label="${name}"]`);
}

/**
 * The editor's language and everything worded in it: the labels, the document's
 * `lang`/`dir`, and the rail items named in that language.
 */
export function useEditorLanguage() {
  // The chosen language survives a reload (per viewer; the env, else the browser, decides a first visit).
  const [editorLocale, setEditorLocale] = useState<EditorLocale>(() =>
    initialEditorLocale(import.meta.env, () => localStorage, navigator.languages),
  );
  const labels = useMemo(() => editorLabels(editorLocale), [editorLocale]);
  /*
    The editor's language reaches the whole document (arabic-editor): the html
    element carries `lang` and `dir`, so the browser's own UI, popovers that
    portal to <body>, and the scrollbar side follow the chrome. The PAGE keeps
    its own direction inside the canvas frame.
  */
  useEffect(() => {
    const root = document.documentElement;
    root.lang = editorLocale;
    root.dir = labels.dir;
  }, [editorLocale, labels.dir]);
  const railDestinations = useMemo(
    () => railItemsIn(RAIL_DESTINATIONS, labels.chrome.rail),
    [labels.chrome.rail],
  );
  const railUtilities = useMemo(
    () => railItemsIn(RAIL_UTILITIES, labels.chrome.rail),
    [labels.chrome.rail],
  );
  const returnFocusToRailAgent = useCallback(
    () => railAgentButton(labels.chrome.rail.assistant),
    [labels.chrome.rail.assistant],
  );
  return {
    editorLocale,
    setEditorLocale,
    labels,
    railDestinations,
    railUtilities,
    returnFocusToRailAgent,
  };
}
