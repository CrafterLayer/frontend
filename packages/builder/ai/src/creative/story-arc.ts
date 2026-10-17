/*
  The story arc (T231c, 2026-10-12): a page of several scenes — a story's chapters, a game's
  levels, a mural's panels — is written by several writers at once, each handed its own section
  and the creative brief (cast, setting, palette). None of them saw the others: chapter three
  could retell chapter two, or forget where it ended. This fragment gives every scene writer the
  page's scene sections in order, its own marked, and the ones on either side of it, so each
  writes its part of one arc. Deterministic and free (no model call), DATA like the brief: it
  describes the page, it never instructs beyond it.
*/

import type { AiContextProvider } from '@craftkit/builder-schema';

export const STORY_ARC_PROVIDER_ID = 'craftkit:story-arc';

/** One scene section of the page, as the plan names it. */
export interface StoryArcSection {
  readonly key: string;
  readonly title: string;
  readonly purpose: string;
}

/** A purpose is a sentence or two; the arc keeps a line of it. */
const PURPOSE_CHARS = 180;

function line(section: StoryArcSection): string {
  const purpose = section.purpose.replace(/\s+/gu, ' ').trim();
  const cut =
    purpose.length > PURPOSE_CHARS ? `${purpose.slice(0, PURPOSE_CHARS - 1).trimEnd()}…` : purpose;
  return cut === '' ? section.title : `${section.title} — ${cut}`;
}

/**
 * The arc as the writer of `current` reads it, or undefined when there is no arc to keep: fewer
 * than two scenes on the page, or `current` is not one of them.
 */
export function renderStoryArc(
  sections: readonly StoryArcSection[],
  current: string,
): string | undefined {
  const at = sections.findIndex(({ key }) => key === current);
  if (sections.length < 2 || at < 0) return undefined;
  const before = sections[at - 1];
  const after = sections[at + 1];
  const quoted = (section: StoryArcSection): string => `"${section.title}"`;
  const place = [
    `Part ${String(at + 1)} of ${String(sections.length)}.`,
    before === undefined ? 'It opens the arc.' : `It follows ${quoted(before)}.`,
    after === undefined ? 'It ends the arc.' : `It leads into ${quoted(after)}.`,
    'The cast, setting, palette and voice are shared by every part; each part tells its own events.',
  ].join(' ');
  return [
    'The scenes on this page, in order (▶ marks the one being written):',
    ...sections.map(
      (section, index) => `${index === at ? '▶' : ' '} ${String(index + 1)}. ${line(section)}`,
    ),
    place,
  ].join('\n');
}

/** The arc for the writer of `current`; it collects an empty body when there is none. */
export function createStoryArcContextProvider(
  sections: readonly StoryArcSection[],
  current: string,
): AiContextProvider {
  return {
    id: STORY_ARC_PROVIDER_ID,
    collect() {
      return {
        source: STORY_ARC_PROVIDER_ID,
        kind: 'data',
        trust: 'reviewed',
        title: 'Story arc: the page’s scenes in order',
        body: renderStoryArc(sections, current) ?? '',
      };
    },
  };
}
