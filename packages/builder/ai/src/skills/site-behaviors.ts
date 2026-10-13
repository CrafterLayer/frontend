/**
 * The everyday site behaviours (2026-10-13), one compact line each: the agent writes an attribute
 * and the published page runs a small audited pack (renderer `behaviors/packs/`), shipped only to
 * the pages that name it — never a hand-written script for a back-to-top button, a typed headline,
 * a counter, a "read more", a one-page nav, a portfolio filter or a closable notice.
 *
 * Every shape here is the one the door admits (`site-behavior-vocabulary.ts` in builder-schema
 * checks it) and the one its pack reads; `site-behaviors.test.ts` lands each through the door.
 * Taught to the section writer (`craftkit.build-fill`) and with interaction requests
 * (`craftkit.motion`).
 */
export const SITE_BEHAVIOR_TEACHING = `READY BEHAVIOURS: data-ck-behavior='<name>', never script; content reads without them.
back-to-top: a href='#top' aria-label='…' class='fixed bottom-6 end-6' > icon arrow-up.
typed-words: span > word spans, all but the first hidden.
count-up: b data-ck-to='250', in the page's digits.
read-more: div data-ck-text='Show less' > text + button type='button' hidden.
scroll-spy: nav > a href='#id'; css [aria-current] marks the link in view.
filter: div > button data-ck-filter='all' or '<group>' + items data-ck-filter='<groups>'.
dismiss: div > notice + last button hidden; stays closed.`;

/** For an edit, where the element already stands. */
export const SITE_BEHAVIOR_EDIT_TEACHING =
  'On an existing element, when TOOLS lists behavior.attach: {id,find,behavior,params?}.';

/** What a person calls these when they ask for one (the motion skill's extra keywords). */
export const SITE_BEHAVIOR_KEYWORDS: readonly string[] = [
  'back to top',
  'scroll to top',
  'read more',
  'typing effect',
  'typewriter',
  'scroll spy',
  'filter buttons',
  'العودة للأعلى',
  'اقرأ المزيد',
  'تأثير الكتابة',
];
