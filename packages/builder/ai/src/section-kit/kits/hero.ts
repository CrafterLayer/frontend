import type { SectionKit } from '../types';
import {
  ACTIONS,
  ACTIONS_CENTER,
  CTA_ARROW,
  EYEBROW,
  H1,
  HEAD_SLOTS,
  hyperui,
  image,
  link,
  merakiui,
  tailark,
  text,
} from './parts';

const HERO_SLOTS = {
  ...HEAD_SLOTS,
  lead: text(280),
  cta: link(true),
  cta2: link(),
  note: text(80),
} as const;

const LEAD = `{{#lead}}<p class='ck-muted mt-6 max-w-2xl text-lg leading-relaxed text-pretty md:text-xl'>{{lead}}</p>{{/lead}}`;
const NOTE = `{{#note}}<p class='ck-muted mt-6 flex items-center gap-2 text-sm'><icon name='badge-check' class='ck-accent-ink' size='18'/>{{note}}</p>{{/note}}`;

export const HERO_KITS: readonly SectionKit[] = [
  {
    id: 'hero-centered',
    role: 'hero',
    variant: 'centered',
    summary: 'Centred type',
    source: hyperui('marketing/banners/1.html'),
    slots: HERO_SLOTS,
    markup: `<section class='ck-ground relative overflow-hidden py-24 md:py-40'>
      <div class='mx-auto max-w-4xl px-4 text-center'>
        ${EYEBROW}
        <h1 data-kit-heading class='ck-display mt-4 text-5xl font-black leading-snug text-balance md:text-7xl'>{{title}}</h1>
        {{#lead}}<p class='ck-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty md:text-xl'>{{lead}}</p>{{/lead}}
        ${ACTIONS_CENTER}
        {{#note}}<p class='ck-muted mt-6 text-sm'>{{note}}</p>{{/note}}
      </div>
    </section>`,
  },
  {
    id: 'hero-split',
    role: 'hero',
    variant: 'split',
    summary: 'Photo beside',
    source: hyperui('marketing/sections/2.html'),
    slots: { ...HERO_SLOTS, image: image(true) },
    markup: `<section class='ck-ground relative overflow-hidden py-16 md:py-24'>
      <div class='mx-auto grid max-w-6xl items-center gap-12 px-4 md:grid-cols-12 md:px-8'>
        <div class='md:col-span-6'>${EYEBROW}<div class='mt-4'>${H1}</div>${LEAD}${ACTIONS}${NOTE}</div>
        <figure class='md:col-span-6'>
          <img class='aspect-4/3 w-full rounded-3xl object-cover shadow-2xl' src='{{image.src}}' alt='{{image.alt}}'/>
        </figure>
      </div>
    </section>`,
  },
  {
    id: 'hero-overlay',
    role: 'hero',
    variant: 'overlay',
    summary: 'Full photo',
    source: merakiui('heros/BackgroundImage.html'),
    slots: { ...HERO_SLOTS, image: image(true) },
    markup: `<section class='relative isolate flex min-h-dvh items-end overflow-hidden'>
      <img class='absolute inset-0 -z-10 h-full w-full object-cover' src='{{image.src}}' alt='{{image.alt}}'/>
      <div class='absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-transparent'></div>
      <div class='mx-auto w-full max-w-6xl px-4 pb-16 text-white md:px-8 md:pb-24'>
        {{#eyebrow}}<p class='inline-flex rounded-full bg-white/10 px-3 py-1 text-sm font-semibold backdrop-blur-md'>{{eyebrow}}</p>{{/eyebrow}}
        <h1 data-kit-heading class='ck-display mt-4 max-w-3xl text-4xl font-bold leading-snug text-balance md:text-7xl'>{{title}}</h1>
        {{#lead}}<p class='mt-6 max-w-2xl text-lg leading-relaxed text-white/90 text-pretty'>{{lead}}</p>{{/lead}}
        <div class='mt-8 flex flex-wrap gap-3'>${CTA_ARROW}{{#cta2}}<a class='ck-btn ck-btn--ghost bg-white/10 text-white backdrop-blur-md' href='{{cta2.href}}'>{{cta2.label}}</a>{{/cta2}}</div>
        {{#note}}<p class='mt-6 text-sm text-white/80'>{{note}}</p>{{/note}}
      </div>
    </section>`,
  },
  {
    id: 'hero-frame',
    role: 'hero',
    variant: 'frame',
    summary: 'Framed photo',
    source: tailark('veil/blocks/hero-section/one/hero-section.tsx'),
    slots: { ...HERO_SLOTS, image: image(true) },
    markup: `<section class='ck-ground relative overflow-hidden pt-20 pb-16 md:pt-32 md:pb-24'>
      <div class='mx-auto max-w-3xl px-4 text-center'>
        {{#eyebrow}}<p class='ck-card ck-muted inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm'><icon name='sparkles' class='ck-accent-ink' size='16'/>{{eyebrow}}</p>{{/eyebrow}}
        <h1 data-kit-heading class='ck-display mt-6 text-4xl font-bold leading-snug text-balance md:text-6xl'>{{title}}</h1>
        {{#lead}}<p class='ck-muted mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-pretty'>{{lead}}</p>{{/lead}}
        ${ACTIONS_CENTER}
      </div>
      <div class='mx-auto mt-16 max-w-6xl px-4 md:px-8'>
        <div class='ck-card overflow-hidden p-2 shadow-2xl'>
          <img class='aspect-video w-full rounded-2xl object-cover md:aspect-21/9' src='{{image.src}}' alt='{{image.alt}}'/>
        </div>
        {{#note}}<p class='ck-muted mt-6 text-center text-sm'>{{note}}</p>{{/note}}
      </div>
    </section>`,
  },
  {
    id: 'hero-editorial',
    role: 'hero',
    variant: 'editorial',
    summary: 'Magazine',
    source: merakiui('heros/SideImage.html'),
    slots: { ...HERO_SLOTS, image: image(true) },
    markup: `<section class='ck-ground py-16 md:py-24'>
      <div class='mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-12 md:gap-12 md:px-8'>
        <div class='md:col-span-7'>${EYEBROW}<h1 data-kit-heading class='ck-display mt-4 text-4xl font-bold leading-snug text-balance md:text-7xl'>{{title}}</h1></div>
        <div class='self-end md:col-span-5'>
          {{#lead}}<p class='ck-muted text-lg leading-relaxed text-pretty'>{{lead}}</p>{{/lead}}
          ${ACTIONS}
        </div>
        <figure class='md:col-span-12'>
          <img class='aspect-video w-full rounded-3xl object-cover md:aspect-21/9' src='{{image.src}}' alt='{{image.alt}}'/>
          {{#note}}<figcaption class='ck-muted mt-3 text-sm'>{{note}}</figcaption>{{/note}}
        </figure>
      </div>
    </section>`,
  },
];
