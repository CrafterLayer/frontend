import type { SectionKit } from '../types';
import {
  ACTIONS_CENTER,
  CTA2,
  CTA_ARROW,
  EYEBROW,
  HEAD_CENTER,
  HEAD_SLOTS,
  HEAD_START,
  band,
  hyperui,
  icon,
  image,
  link,
  list,
  merakiui,
  tailark,
  text,
} from './parts';

const QA = { q: text(140, true), a: text(600, true) } as const;

/** No script: `details name` opens one at a time; the plus turns into a cross. */
const FAQ_CSS =
  '.ck-faq summary::-webkit-details-marker{display:none}.ck-faq-icon{transition:rotate 200ms}.ck-faq[open] .ck-faq-icon{rotate:45deg}@media (prefers-reduced-motion:reduce){.ck-faq-icon{transition:none}}';

const FAQ_ITEM = `{{#items}}<details class='ck-faq border-b ck-border py-5' name='faq'>
  <summary class='flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-semibold'><span>{{item.q}}</span><icon name='plus' class='ck-faq-icon ck-accent-ink shrink-0' size='20'/></summary>
  <p class='ck-muted mt-3 leading-relaxed'>{{item.a}}</p>
</details>{{/items}}`;

const CTA_SLOTS = { ...HEAD_SLOTS, cta: link(true), cta2: link() } as const;

export const CLOSING_KITS: readonly SectionKit[] = [
  {
    id: 'faq-accordion',
    role: 'closing',
    variant: 'faq',
    summary: 'FAQ',
    source: hyperui('marketing/faqs/1.html'),
    slots: { ...HEAD_SLOTS, items: list(QA, 10) },
    markup: band(`<div class='mx-auto max-w-3xl'>${HEAD_START}<div class='mt-10 border-t ck-border'>${FAQ_ITEM}</div></div>`),
    css: FAQ_CSS,
  },
  {
    id: 'faq-split',
    role: 'closing',
    summary: 'FAQ, side heading',
    source: tailark('veil/blocks/faqs/one.tsx'),
    slots: { ...HEAD_SLOTS, cta: link(), items: list(QA, 10) },
    markup: band(`<div class='grid gap-12 md:grid-cols-12'>
        <div class='self-start md:sticky md:top-24 md:col-span-5'>${HEAD_START}{{#cta}}<div class='mt-8'><a class='ck-btn ck-btn--ghost' href='{{cta.href}}'>{{cta.label}}</a></div>{{/cta}}</div>
        <div class='border-t ck-border md:col-span-7'>${FAQ_ITEM}</div>
      </div>`),
    css: FAQ_CSS,
  },
  {
    id: 'cta-band',
    role: 'closing',
    variant: 'band',
    summary: 'Accent band',
    source: hyperui('marketing/ctas/1.html'),
    slots: CTA_SLOTS,
    markup: `<section class='ck-ground py-16 md:py-24'>
      <div class='mx-auto max-w-6xl px-4 md:px-8'>
        <div class='ck-accent-fill relative isolate overflow-hidden rounded-3xl px-6 py-16 text-center md:px-16 md:py-24'>
          {{#eyebrow}}<p class='font-semibold opacity-80'>{{eyebrow}}</p>{{/eyebrow}}
          <h2 data-kit-heading class='ck-display mx-auto mt-3 max-w-3xl text-3xl font-bold leading-snug text-balance md:text-5xl'>{{title}}</h2>
          {{#lead}}<p class='mx-auto mt-4 max-w-xl text-lg leading-relaxed opacity-90'>{{lead}}</p>{{/lead}}
          ${ACTIONS_CENTER}
        </div>
      </div>
    </section>`,
  },
  {
    id: 'cta-split',
    role: 'closing',
    variant: 'cta-split',
    summary: 'Action aside',
    source: hyperui('marketing/ctas/3.html'),
    slots: CTA_SLOTS,
    markup: `<section class='ck-ground py-16 md:py-20'>
      <div class='mx-auto grid max-w-6xl items-center gap-8 border-t ck-border px-4 pt-12 md:grid-cols-12 md:px-8'>
        <div class='md:col-span-8'>${EYEBROW}<h2 data-kit-heading class='ck-display mt-2 text-3xl font-bold leading-snug text-balance md:text-4xl'>{{title}}</h2>{{#lead}}<p class='ck-muted mt-3 text-lg'>{{lead}}</p>{{/lead}}</div>
        <div class='flex flex-wrap gap-3 md:col-span-4 md:justify-end'>${CTA_ARROW}${CTA2}</div>
      </div>
    </section>`,
  },
  {
    id: 'cta-card',
    role: 'closing',
    summary: 'Dark photo card',
    source: merakiui('cta/Card.html'),
    slots: { ...CTA_SLOTS, image: image(true) },
    markup: `<section class='ck-ground py-16 md:py-24'>
      <div class='mx-auto max-w-6xl px-4 md:px-8'>
        <div class='ck-inverse grid overflow-hidden rounded-3xl md:grid-cols-2'>
          <div class='p-8 md:p-14'>
            ${EYEBROW}
            <h2 data-kit-heading class='ck-display mt-3 text-3xl font-bold leading-snug text-balance md:text-4xl'>{{title}}</h2>
            {{#lead}}<p class='ck-muted mt-4 text-lg leading-relaxed'>{{lead}}</p>{{/lead}}
            <div class='mt-8 flex flex-wrap gap-3'>${CTA_ARROW}${CTA2}</div>
          </div>
          <img class='aspect-4/3 h-full w-full object-cover md:aspect-auto' src='{{image.src}}' alt='{{image.alt}}'/>
        </div>
      </div>
    </section>`,
  },
  {
    id: 'contact-split',
    role: 'closing',
    variant: 'contact',
    summary: 'Hours and map',
    source: merakiui('contact/TwoColumn.html'),
    slots: {
      ...HEAD_SLOTS,
      channels: list({ icon: icon(true), label: text(40, true), href: text(300, true) }, 4),
      hours: list({ day: text(40, true), time: text(40, true) }, 7, false),
      address: text(160),
      map: link(),
    },
    markup: band(`<div class='grid gap-10 md:grid-cols-2'>
        <div>${HEAD_START}
          <div class='ck-channels mt-8 flex flex-wrap gap-3'>{{#channels}}<a class='ck-btn ck-btn--ghost' href='{{item.href}}'><icon name='{{item.icon}}' size='20'/><span>{{item.label}}</span></a>{{/channels}}</div>
        </div>
        <div class='ck-card p-8'>
          <ul class='space-y-3'>{{#hours}}<li class='flex justify-between gap-4 border-b ck-border pb-3 tabular-nums'><span>{{item.day}}</span><span class='ck-muted'>{{item.time}}</span></li>{{/hours}}</ul>
          {{#address}}<p class='mt-6 flex items-start gap-2'><icon name='map-pin' class='ck-accent-ink shrink-0' size='20'/><span>{{address}}</span></p>{{/address}}
          {{#map}}<a class='ck-link ck-accent-ink mt-4 inline-flex items-center gap-2 font-semibold underline' href='{{map.href}}'>{{map.label}}<icon name='arrow-up-right' class='ck-flip' size='18'/></a>{{/map}}
        </div>
      </div>`),
    css: '.ck-channels > :first-child{background-color:var(--ck-accent);color:var(--ck-on-accent);box-shadow:none}',
  },
  {
    id: 'contact-cards',
    role: 'closing',
    summary: 'Contact cards',
    source: merakiui('contact/Grid2x2.html'),
    slots: {
      ...HEAD_SLOTS,
      items: list({ icon: icon(true), title: text(40, true), text: text(120, true), href: text(300) }, 4),
    },
    markup: band(`${HEAD_CENTER}
      <div class='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4'>
        {{#items}}<div class='ck-card p-6'>
          <span class='ck-accent-fill inline-flex size-12 items-center justify-center rounded-full'><icon name='{{item.icon}}' size='22'/></span>
          <h3 class='mt-5 text-lg font-semibold'>{{item.title}}</h3>
          {{#item.href}}<a class='ck-link ck-accent-ink mt-2 block break-words' href='{{item.href}}'>{{item.text}}</a>{{/item.href}}{{^item.href}}<p class='ck-muted mt-2'>{{item.text}}</p>{{/item.href}}
        </div>{{/items}}
      </div>`),
  },
];
