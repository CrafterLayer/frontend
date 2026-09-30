import type { SectionKit } from '../types';
import {
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

const TIER = {
  name: text(40, true),
  price: text(20, true),
  period: text(24),
  text: text(160),
  badge: text(24),
  features: list({ text: text(90, true) }, 8),
  cta: link(true),
} as const;

const PERSON_ITEM = {
  name: text(60, true),
  role: text(80),
  text: text(200),
  initials: text(3),
  image: image(),
} as const;

/** A portrait when the request gives one; else the initials on a card (never a stranger's face). */
const PORTRAIT = `{{#item.image}}<img class='aspect-square w-full rounded-2xl object-cover object-top' src='{{item.image.src}}' alt='{{item.image.alt}}'/>{{/item.image}}{{^item.image}}<div class='ck-surface ck-accent-ink ck-display flex aspect-square w-full items-center justify-center rounded-2xl text-4xl font-bold'>{{item.initials}}</div>{{/item.image}}`;

export const OFFER_KITS: readonly SectionKit[] = [
  {
    id: 'pricing-tiers',
    role: 'offer',
    variant: 'pricing',
    summary: 'Plan cards',
    source: hyperui('marketing/pricing/2.html'),
    slots: { ...HEAD_SLOTS, items: list(TIER, 3) },
    markup: band(`${HEAD_CENTER}
      <div class='mt-14 grid items-stretch gap-6 md:grid-cols-3'>
        {{#items}}<div class='ck-card flex flex-col p-8'>
          <div class='flex items-center justify-between gap-3'><h3 class='text-lg font-semibold'>{{item.name}}</h3>{{#item.badge}}<span class='ck-accent-fill rounded-full px-3 py-1 text-xs font-semibold'>{{item.badge}}</span>{{/item.badge}}</div>
          {{#item.text}}<p class='ck-muted mt-2 text-sm leading-relaxed'>{{item.text}}</p>{{/item.text}}
          <p class='mt-6 flex items-baseline gap-2'><span class='ck-display text-5xl font-bold tabular-nums'>{{item.price}}</span>{{#item.period}}<span class='ck-muted text-sm'>{{item.period}}</span>{{/item.period}}</p>
          <ul class='mt-8 mb-8 space-y-3'>
            {{#item.features}}<li class='flex gap-2'><icon name='check' class='ck-accent-ink shrink-0' size='20'/><span>{{item.text}}</span></li>{{/item.features}}
          </ul>
          <a class='ck-btn mt-auto' href='{{item.cta.href}}'>{{item.cta.label}}</a>
        </div>{{/items}}
      </div>`),
  },
  {
    id: 'pricing-duo',
    role: 'offer',
    summary: 'Two wide plans',
    source: hyperui('marketing/pricing/1.html'),
    slots: { ...HEAD_SLOTS, items: list(TIER, 2) },
    markup: band(`${HEAD_CENTER}
      <div class='mx-auto mt-14 grid max-w-4xl gap-6 md:grid-cols-2'>
        {{#items}}<div class='ck-card flex flex-col p-8 md:p-10'>
          <h3 class='text-xl font-semibold'>{{item.name}}</h3>
          {{#item.badge}}<p class='ck-eyebrow mt-1'>{{item.badge}}</p>{{/item.badge}}
          <p class='mt-4 flex items-baseline gap-2'><span class='ck-display text-5xl font-bold tabular-nums'>{{item.price}}</span>{{#item.period}}<span class='ck-muted'>{{item.period}}</span>{{/item.period}}</p>
          {{#item.text}}<p class='ck-muted mt-4 leading-relaxed'>{{item.text}}</p>{{/item.text}}
          <ul class='mt-8 mb-10 space-y-3 border-t ck-border pt-8'>
            {{#item.features}}<li class='flex gap-3'><icon name='circle-check' class='ck-accent-ink shrink-0' size='20'/><span>{{item.text}}</span></li>{{/item.features}}
          </ul>
          <a class='ck-btn mt-auto w-full' href='{{item.cta.href}}'>{{item.cta.label}}</a>
        </div>{{/items}}
      </div>`),
  },
  {
    id: 'pricing-table',
    role: 'offer',
    summary: 'Comparison table',
    source: tailark('veil/blocks/comparator/one.tsx'),
    slots: {
      ...HEAD_SLOTS,
      plans: list({ name: text(30, true), price: text(20) }, 4),
      rows: list({ feature: text(80, true), values: list({ value: text(40, true) }, 4) }, 12),
    },
    markup: band(`${HEAD_CENTER}
      <div class='ck-card mt-14 overflow-x-auto'>
        <table class='w-full text-sm'>
          <thead><tr class='border-b ck-border'><th class='p-4 text-start font-semibold' scope='col'><span class='sr-only'>—</span></th>{{#plans}}<th class='p-4 text-start' scope='col'><span class='block text-base font-semibold'>{{item.name}}</span>{{#item.price}}<span class='ck-muted block font-normal tabular-nums'>{{item.price}}</span>{{/item.price}}</th>{{/plans}}</tr></thead>
          <tbody>{{#rows}}<tr class='border-b ck-border'><th class='p-4 text-start font-medium' scope='row'>{{item.feature}}</th>{{#item.values}}<td class='ck-muted p-4'>{{item.value}}</td>{{/item.values}}</tr>{{/rows}}</tbody>
        </table>
      </div>`),
  },
  {
    id: 'menu-list',
    role: 'offer',
    variant: 'menu',
    summary: 'Priced menu',
    source: hyperui('marketing/product-collections/3.html'),
    slots: {
      ...HEAD_SLOTS,
      items: list(
        { title: text(50, true), entries: list({ name: text(60, true), price: text(16, true), text: text(140) }, 12) },
        4,
      ),
    },
    markup: band(`${HEAD_CENTER}
      <div class='mt-14 grid gap-x-16 gap-y-12 md:grid-cols-2'>
        {{#items}}<div>
          <h3 class='ck-display border-b ck-border pb-3 text-2xl font-bold'>{{item.title}}</h3>
          <ul class='mt-6 space-y-5'>
            {{#item.entries}}<li>
              <div class='flex items-baseline gap-3'><span class='font-semibold'>{{item.name}}</span><span class='ck-border flex-1 border-b border-dotted'></span><span class='ck-accent-ink whitespace-nowrap font-semibold tabular-nums'>{{item.price}}</span></div>
              {{#item.text}}<p class='ck-muted mt-1 text-sm leading-relaxed'>{{item.text}}</p>{{/item.text}}
            </li>{{/item.entries}}
          </ul>
        </div>{{/items}}
      </div>`),
  },
  {
    id: 'products-grid',
    role: 'offer',
    variant: 'product',
    summary: 'Product grid',
    source: hyperui('marketing/product-collections/1.html'),
    slots: {
      ...HEAD_SLOTS,
      items: list({ image: image(true), title: text(60, true), price: text(20), badge: text(20) }, 8),
    },
    markup: band(`${HEAD_START}
      <div class='mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4'>
        {{#items}}<article class='group'>
          <div class='ck-surface relative overflow-hidden rounded-2xl'>
            <img class='aspect-square w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
            {{#item.badge}}<span class='ck-accent-fill absolute top-3 start-3 rounded-full px-2.5 py-1 text-xs font-semibold'>{{item.badge}}</span>{{/item.badge}}
          </div>
          <h3 class='mt-3 font-semibold'>{{item.title}}</h3>
          {{#item.price}}<p class='ck-muted tabular-nums'>{{item.price}}</p>{{/item.price}}
        </article>{{/items}}
      </div>`),
  },
  {
    id: 'listing-cards',
    role: 'offer',
    variant: 'listing',
    summary: 'Listing cards',
    source: hyperui('marketing/cards/5.html'),
    slots: {
      ...HEAD_SLOTS,
      items: list(
        {
          image: image(true),
          price: text(24, true),
          title: text(80, true),
          facts: list({ icon: icon(true), text: text(30, true) }, 4),
        },
        6,
      ),
    },
    markup: band(`${HEAD_START}
      <div class='mt-12 grid gap-6 md:grid-cols-3'>
        {{#items}}<article class='ck-card overflow-hidden'>
          <img class='aspect-4/3 w-full object-cover' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          <div class='p-6'>
            <p class='ck-display text-2xl font-bold tabular-nums'>{{item.price}}</p>
            <h3 class='mt-1 font-semibold'>{{item.title}}</h3>
            <ul class='ck-muted mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm'>
              {{#item.facts}}<li class='flex items-center gap-1.5'><icon name='{{item.icon}}' class='ck-accent-ink' size='16'/><span>{{item.text}}</span></li>{{/item.facts}}
            </ul>
          </div>
        </article>{{/items}}
      </div>`),
  },
  {
    id: 'team-grid',
    role: 'offer',
    variant: 'team',
    summary: 'Team portraits',
    source: hyperui('marketing/team-sections/1.html'),
    slots: { ...HEAD_SLOTS, items: list(PERSON_ITEM, 8) },
    markup: band(`${HEAD_CENTER}
      <div class='mt-14 flex flex-wrap justify-center gap-8'>
        {{#items}}<figure class='w-36 md:w-56'>
          ${PORTRAIT}
          <figcaption class='mt-4'><p class='font-semibold'>{{item.name}}</p>{{#item.role}}<p class='ck-muted text-sm'>{{item.role}}</p>{{/item.role}}</figcaption>
        </figure>{{/items}}
      </div>`),
  },
  {
    id: 'team-cards',
    role: 'offer',
    summary: 'Team with bio',
    source: merakiui('teams/Cards.html'),
    slots: { ...HEAD_SLOTS, items: list(PERSON_ITEM, 6) },
    markup: band(`${HEAD_START}
      <div class='mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3'>
        {{#items}}<article class='ck-card flex flex-col p-4'>
          ${PORTRAIT}
          <div class='px-2 pt-5 pb-2'>
            <h3 class='text-lg font-semibold'>{{item.name}}</h3>
            {{#item.role}}<p class='ck-accent-ink text-sm font-medium'>{{item.role}}</p>{{/item.role}}
            {{#item.text}}<p class='ck-muted mt-3 text-sm leading-relaxed'>{{item.text}}</p>{{/item.text}}
          </div>
        </article>{{/items}}
      </div>`),
  },
];
