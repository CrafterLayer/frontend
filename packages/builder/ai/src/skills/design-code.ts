import {
  CUSTOM_CODE_EFFECTS,
  CUSTOM_CODE_ENTRANCE_PRESETS,
  CUSTOM_CODE_HOVER_PRESETS,
  CUSTOM_CODE_LOOP_PRESETS,
  CUSTOM_CODE_MOTION_EASES,
  CUSTOM_CODE_SCROLL_PRESETS,
  CUSTOM_CODE_STAGGER_PRESETS,
  CUSTOM_CODE_TEXT_PRESETS,
} from '@craftkit/builder-schema';

import type { AiSkillDefinitionV1 } from './types';
import { DESIGN_LIBRARY_TEACHING } from './design-libraries';

// P10-agent-power additions (style-manager DESIGN.md §D.3): the element
// vocabulary widened on 2026-10-05 — style tools, the desktop-first prefix
// law, logical utilities, palette variables, named styles, effects, motion
// presets by name and the new tags. Every name list is READ from the
// vocabulary, so a preset added there is taught here without an edit.
// Enums are written a|b|c, the skill's spelling for attribute values, so a
// preset such as blur-in or sticky-stack never reads as a utility class.
const list = (names: readonly string[]): string => names.join('|');

export const STYLE_MANAGER_TEACHING = `EDIT BY NAME on a follow-up: prefer element.style {id,path|find,styles:[{property,value,bucket?,state?,side?}]} and element.animate {id,path|find,preset,hover,trigger,…} over rewriting className — the engine writes the canonical class and replaces the old one; element.insert adds markup, element.effect adds an effect, style.define + style.apply share one look, palette.set adds colours (ramp → 50-950 shades).
RESPONSIVE + STATES, desktop first: unprefixed is every screen, max-lg: is tablet and down, max-md: is the phone (a phone-only edit: max-md:px-4). States hover: focus-visible: active: open: group-hover: combine after the screen (max-md:hover:…). Mobile-first md:/lg: pairs are rewritten to this form.
LOGICAL ONLY: ps-/pe-/ms-/me-/pbs-/pbe-/inset-s-/inset-e-/rounded-s-/rounded-e-/border-s/border-e/text-start/text-end follow dir, so an Arabic page mirrors itself; a left/right class is a bug.
COLOUR: theme tokens first; a site palette colour is bg-(--ck-c-<id>) or text-(--ck-c-<id>), or element.style value "palette:<id>"; an exact colour is element.style value "#0f766e".
NAMED STYLES: a look several elements share is one style; elements carry ck-s-<id> and one edit of the style updates every one.
EFFECTS, hook classes whose CSS ships with fallbacks: ${CUSTOM_CODE_EFFECTS.map((name) => `ck-fx-${name}`).join(' ')}.
ANIMATE BY NAME (the page ships the CSS; reduced motion shows the final state): data-ck-motion='<preset>' with data-ck-trigger (view load hover click scroll), data-ck-delay 0-6, data-ck-speed slow|normal|fast, data-ck-ease (${list(CUSTOM_CODE_MOTION_EASES)}), data-ck-once, data-ck-distance sm|md|lg, data-ck-stagger on a stagger container, data-ck-target (click plays the element with that id). Entrance: ${list(CUSTOM_CODE_ENTRANCE_PRESETS)}. Stagger: ${list(CUSTOM_CODE_STAGGER_PRESETS)}. Scroll, on view or scroll: ${list(CUSTOM_CODE_SCROLL_PRESETS)}. Loop: ${list(CUSTOM_CODE_LOOP_PRESETS)}. Text, on view load or click: ${list(CUSTOM_CODE_TEXT_PRESETS)}. Hover data-ck-hover='<preset>': ${list(CUSTOM_CODE_HOVER_PRESETS)}. One or two moments a section.
NEW TAGS: form with input textarea select option label fieldset legend sends only through data-ck-behavior='whatsapp-form' with data-ck-phone; dialog opened by a popovertarget button; iframe with a title, only google.com/maps/embed or open.spotify.com/embed (a YouTube or Vimeo video is media.add, a light facade); audio with https sources; svg text textPath clipPath mask pattern and feTurbulence/feGaussianBlur filters.`;
// end P10-agent-power additions

// media-motion (2026-10-06, DESIGN §F.4): the media tools, one line each, read only where TOOLS lists them.
export const MEDIA_MOTION_TEACHING = `MEDIA, when TOOLS lists media.add: a gallery, video, map, before/after or pricing toggle is ONE media.add step (images 'catalog:<topic>' — alt, sizes and srcset are filled for you), not markup.
GSAP / SCROLL ANIMATION, when TOOLS lists motion.add: motion.add {id,find,recipe} plays a named timeline (stagger-in for items, split-reveal for a heading) — never hand-written GSAP, never css that hides content for a reveal, never data-ck-motion on the same element.
ANIMATED BACKGROUND: media.add {kind:scene,scene,behind:<hero id>} puts particles, a gradient or a mural behind the hero's real text.
A video only with an address the request gives — never an invented id, never a raw YouTube/Vimeo iframe; a background video is media.add {kind:video,url,behind} — no autoplay, the page plays it in view.`;

/**
 * When a section needs code, and how to write it so the door takes it.
 *
 * The owner, 2026-09-28: "let the agent write code when the design needs it,
 * within the scope of design", and "professional pages". The door already
 * took free region CSS; what held pages back was markup — a FAQ could only be
 * a list, a price comparison only cards, a phone nav only a sideways row —
 * because the tree had no disclosure, no table, no popover, no svg, no
 * video. Those joined the vocabulary the same day (custom-code-tree.ts), each
 * with a per-tag policy, and still nothing that runs. This skill is the
 * other half: without it a writer keeps reaching for the one shape it knows.
 *
 * Explicit-only, like photo-direction: the orchestrator names it for the
 * section writers (and the page plan, which picks the sections that carry a
 * signature). Every example below is door-shaped — single-quoted attributes,
 * classes from the vocabulary (the builtins suite checks both), attributes on
 * the tags that take them — because an example the door refuses is a repair
 * round, 25-40 s measured 2026-09-27.
 */
export const DESIGN_CODE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.design-code',
  name: 'Design code',
  description:
    'Region CSS for a signature effect, and interactive markup that needs no script.',
  version: '1.3.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 91,
  activation: { mode: 'explicit' },
  tags: ['build', 'css', 'markup', 'interaction'],
  instructions: `WHEN: code draws the page's signature where classes cannot — one or two moments a page, never every section, never a gradient circle behind the headline.
CSS: the region's css prop, scoped to it, on ck- classes you name. Colours var(--ck-accent) var(--ck-ink) var(--ck-surface) on a planned page, else the direction's hex. Reach for layered radial-gradient over linear-gradient; grain (data:image/svg+xml feTurbulence, opacity 0.06, on ::before); glass (color-mix(in srgb,var(--ck-surface) 72%,transparent) + backdrop-filter:blur(14px)); mask-image:linear-gradient(#000 70%,transparent); clip-path on a band edge; a marquee (@keyframes ck-marquee{to{transform:translateX(-50%)}} on a row written twice); :hover and :focus-visible; container-type:inline-size with @container (min-width:40rem){…}. Imports: font hosts only; url(): https, relative or data: images.
MOTION: every animation and transition ships with @media (prefers-reduced-motion:reduce){.ck-…{animation:none;transition:none}}.
NO SCRIPT: these open by themselves.
FAQ: details name='faq' (one open at a time, the first open) > summary cursor-pointer list-none … with icon plus size 20 ck-faq-icon + the answer; css summary::-webkit-details-marker{display:none} .ck-faq[open] .ck-faq-icon{rotate:45deg}.
PHONE MENU: button popovertarget='ck-nav' aria-label='…' lg:hidden with icon menu, then nav id='ck-nav' popover class='ck-… me-0 ms-auto h-full w-80 p-6' > div flex flex-col of the links + button popovertarget='ck-nav' popovertargetaction='hide' with icon x. The popover itself takes no display class — it would show while closed. Only a button opens a popover.
TABLE for prices, hours, a comparison: div overflow-x-auto > table w-full text-sm > caption + thead > tr > th scope='col' + tbody > tr > th scope='row' + td (colspan, rowspan).
DIVIDER: svg viewBox='0 0 1440 80' preserveAspectRatio='none' aria-hidden='true' class='block h-12 w-full' > path d='M0 40C360 80 1080 0 1440 40V80H0Z' fill='currentColor'. An svg holds shapes only (g path circle ellipse rect line polyline polygon defs linearGradient radialGradient stop); a gradient fill is url(#id) in the same svg.
VIDEO HERO, only with a video address the request gives: video autoplay muted loop playsinline preload='metadata' poster='<a photo>' class='absolute inset-0 -z-10 h-full w-full object-cover' > source src='https://….mp4' type='video/mp4'.
IMAGES after the hero: loading='lazy' decoding='async' width height; srcset with sizes, or picture > source media srcset + img. A Latin name in Arabic: span lang='en' dir='ltr'.
REAL CONTROLS: a form, map or booking the catalog registers is <ck-component type='…' props='{…}'/>; never imitate one.
ONLINE BOOKING, when the request names booking or appointments online — a real form, not steps and links; WhatsApp stays beside it: <ck-component type='formSection' props='{"heading":"…","variant":"card","fields":[{"id":"service","name":"service","type":"select","label":"…","required":true,"options":[{"label":"…","value":"…"}]},{"id":"date","name":"date","type":"date","label":"…","required":true,"width":"half"},{"id":"time","name":"time","type":"select","label":"…","required":true,"width":"half","options":[{"label":"10:00","value":"10:00"}]},{"id":"phone","name":"phone","type":"tel","label":"…","required":true}],"submitLabel":"…"}'/> — the services and hours are the page's own.
TAP TARGETS: every link in a footer or a nav list is a 44px target on a phone: a class='inline-flex min-h-11 items-center'.
${STYLE_MANAGER_TEACHING}
${MEDIA_MOTION_TEACHING}
${DESIGN_LIBRARY_TEACHING}
NEVER: script, on… handlers, a style attribute, an iframe from another host, form action or method, http:// addresses.`,
  references: {
    'checks/design-code.md':
      'Code only for the signature; motion guarded; FAQ details, phone nav a popover, comparison a table; video muted; online booking a formSection with service, date and time.',
  },
};
