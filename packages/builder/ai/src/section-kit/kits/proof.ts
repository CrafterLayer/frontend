import type { SectionKit } from '../types';
import { EYEBROW, HEAD_CENTER, HEAD_SLOTS, HEAD_START, band, hyperui, image, list, merakiui, tailark, text } from './parts';

const QUOTE_ITEM = {
  quote: text(320, true),
  name: text(60, true),
  role: text(80),
  initials: text(3),
} as const;

/** A monogram: the initials in an accent disc (no stock faces: a portrait the request did not give is a stranger). */
const MONOGRAM = `<span class='ck-accent-fill flex size-12 shrink-0 items-center justify-center rounded-full font-bold'>{{item.initials}}</span>`;

const PERSON = `<figcaption class='mt-auto flex items-center gap-3 pt-6'>{{#item.initials}}${MONOGRAM}{{/item.initials}}<div><p class='font-semibold'>{{item.name}}</p>{{#item.role}}<p class='ck-muted text-sm'>{{item.role}}</p>{{/item.role}}</div></figcaption>`;

export const PROOF_KITS: readonly SectionKit[] = [
  {
    id: 'testimonials-cards',
    role: 'proof',
    variant: 'cards',
    summary: 'Quote cards',
    source: hyperui('marketing/testimonials/1.html'),
    slots: { ...HEAD_SLOTS, items: list(QUOTE_ITEM, 6) },
    markup: band(`${HEAD_CENTER}
      <div class='mt-14 grid gap-6 md:grid-cols-3' data-ck-behavior='stagger'>
        {{#items}}<figure class='ck-card flex flex-col p-8'>
          <div class='ck-stars ck-accent-ink flex gap-1'><icon name='star' size='18'/><icon name='star' size='18'/><icon name='star' size='18'/><icon name='star' size='18'/><icon name='star' size='18'/></div>
          <blockquote class='mt-5 text-lg leading-relaxed text-pretty'>{{item.quote}}</blockquote>
          ${PERSON}
        </figure>{{/items}}
      </div>`),
    // Lucide's star is an outline: filled in the accent ink, a rating reads as five stars, not ☆☆☆☆☆.
    css: '.ck-stars svg{fill:currentColor}',
  },
  {
    id: 'testimonials-wall',
    role: 'proof',
    summary: 'Quote wall',
    source: tailark('mist/blocks/testimonials/one.tsx'),
    slots: { ...HEAD_SLOTS, items: list(QUOTE_ITEM, 9) },
    markup: band(`${HEAD_CENTER}
      <div class='ck-wall mt-14 columns-1 gap-6'>
        {{#items}}<figure class='ck-card mb-6 flex break-inside-avoid flex-col p-6'>
          <blockquote class='leading-relaxed text-pretty'>{{item.quote}}</blockquote>
          ${PERSON}
        </figure>{{/items}}
      </div>`),
    css: '@media (min-width:48rem){.ck-wall{columns:3}}',
  },
  {
    id: 'testimonial-quote',
    role: 'proof',
    variant: 'quote',
    summary: 'One big quote',
    source: merakiui('testimonials/Single.html'),
    slots: { ...HEAD_SLOTS, items: list(QUOTE_ITEM, 1) },
    markup: `<section class='ck-ground py-20 md:py-28'>
      <div class='mx-auto max-w-4xl px-4 text-center md:px-8'>
        ${EYEBROW}<h2 data-kit-heading class='ck-muted mt-2 text-base font-semibold'>{{title}}</h2>{{#lead}}<p class='ck-muted mt-2 text-sm'>{{lead}}</p>{{/lead}}
        {{#items}}<figure class='mt-8'>
          <icon name='quote' class='ck-accent-ink mx-auto' size='44'/>
          <blockquote class='ck-display mt-6 text-2xl font-medium leading-snug text-balance md:text-4xl'>{{item.quote}}</blockquote>
          <figcaption class='mt-10 flex items-center justify-center gap-3'>{{#item.initials}}${MONOGRAM}{{/item.initials}}<div class='text-start'><p class='font-semibold'>{{item.name}}</p>{{#item.role}}<p class='ck-muted text-sm'>{{item.role}}</p>{{/item.role}}</div></figcaption>
        </figure>{{/items}}
      </div>
    </section>`,
  },
  {
    id: 'stats-row',
    role: 'proof',
    variant: 'stats',
    summary: 'Numbers row',
    source: hyperui('marketing/stats/1.html'),
    slots: { ...HEAD_SLOTS, items: list({ value: text(12, true), label: text(60, true) }, 4) },
    markup: band(`${HEAD_START}
      <dl class='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4'>
        {{#items}}<div class='border-t ck-border pt-6'>
          <dd class='ck-display ck-accent-ink text-4xl font-bold tabular-nums md:text-5xl' data-ck-behavior='count-up'>{{item.value}}</dd>
          <dt class='ck-muted mt-2 text-sm'>{{item.label}}</dt>
        </div>{{/items}}
      </dl>`),
  },
  {
    id: 'stats-story',
    role: 'proof',
    summary: 'Text, stat cards',
    source: tailark('mist/blocks/stats/one.tsx'),
    slots: { ...HEAD_SLOTS, items: list({ value: text(12, true), label: text(60, true) }, 4) },
    markup: band(`<div class='grid items-center gap-12 lg:grid-cols-2'>
        ${HEAD_START}
        <dl class='grid grid-cols-2 gap-4'>
          {{#items}}<div class='ck-card p-6'>
            <dd class='ck-display text-4xl font-bold tabular-nums' data-ck-behavior='count-up'>{{item.value}}</dd>
            <dt class='ck-muted mt-2 text-sm'>{{item.label}}</dt>
          </div>{{/items}}
        </dl>
      </div>`, 'ck-surface'),
  },
  {
    id: 'logos-row',
    role: 'proof',
    summary: 'Logo row',
    source: hyperui('marketing/logo-clouds/1.html'),
    slots: { ...HEAD_SLOTS, items: list({ name: text(40, true), image: image() }, 8) },
    markup: `<section class='ck-ground py-16'>
      <div class='mx-auto max-w-6xl px-4 md:px-8'>
        <div class='text-center'>${EYEBROW}<h2 data-kit-heading class='ck-muted mt-2 text-sm font-semibold'>{{title}}</h2>{{#lead}}<p class='ck-muted mt-2 text-sm'>{{lead}}</p>{{/lead}}</div>
        <ul class='mt-8 flex flex-wrap items-center justify-center gap-x-12 gap-y-6'>
          {{#items}}<li class='opacity-70 grayscale transition hover:opacity-100 hover:grayscale-0'>{{#item.image}}<img class='h-10 w-auto object-contain' src='{{item.image.src}}' alt='{{item.image.alt}}' title='{{item.name}}'/>{{/item.image}}{{^item.image}}<span class='ck-display text-xl font-bold'>{{item.name}}</span>{{/item.image}}</li>{{/items}}
        </ul>
      </div>
    </section>`,
  },
];
