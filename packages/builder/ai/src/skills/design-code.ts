import type { AiSkillDefinitionV1 } from './types';

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
  version: '1.0.0',
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
NEVER: script, on… handlers, a style attribute, iframes, form controls, http:// addresses.`,
  references: {
    'checks/design-code.md':
      'Code only for the signature; motion guarded; FAQ details, phone nav a popover, comparison a table; video muted; online booking a formSection with service, date and time.',
  },
};
