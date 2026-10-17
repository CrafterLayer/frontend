import type { SectionKit } from '../types';
import {
  CTA2,
  CTA_ARROW,
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

const ITEM = { icon: icon(true), title: text(70, true), text: text(220) } as const;

export const FEATURES_KITS: readonly SectionKit[] = [
  {
    id: 'features-lead',
    role: 'features',
    variant: 'grid',
    summary: 'Lead card grid',
    source: hyperui('marketing/feature-grids/1.html'),
    slots: { ...HEAD_SLOTS, highlight: text(200, true), items: list(ITEM, 4) },
    markup: band(`${HEAD_START}
      <div class='mt-12 grid gap-4 md:grid-cols-3'>
        <article class='ck-accent-fill rounded-3xl p-8 md:col-span-2 md:row-span-2 md:p-12'>
          <icon name='sparkles' size='32'/>
          <p class='ck-display mt-6 text-2xl font-bold leading-snug text-balance md:text-4xl'>{{highlight}}</p>
        </article>
        {{#items}}<article class='ck-card p-6'>
          <span class='ck-surface ck-accent-ink flex size-12 items-center justify-center rounded-2xl'><icon name='{{item.icon}}' size='24'/></span>
          <h3 class='mt-5 text-lg font-semibold'>{{item.title}}</h3>
          {{#item.text}}<p class='ck-muted mt-2 leading-relaxed'>{{item.text}}</p>{{/item.text}}
        </article>{{/items}}
      </div>`),
  },
  {
    id: 'features-list',
    role: 'features',
    variant: 'list',
    summary: 'Icon list',
    source: hyperui('marketing/feature-grids/3.html'),
    slots: { ...HEAD_SLOTS, items: list(ITEM, 8) },
    markup: band(`${HEAD_START}
      <dl class='mt-14 grid gap-x-12 gap-y-10 md:grid-cols-2'>
        {{#items}}<div class='border-t ck-border pt-6'>
          <dt class='flex items-center gap-3 text-lg font-semibold'><icon name='{{item.icon}}' class='ck-accent-ink' size='22'/><span>{{item.title}}</span></dt>
          {{#item.text}}<dd class='ck-muted mt-2 leading-relaxed'>{{item.text}}</dd>{{/item.text}}
        </div>{{/items}}
      </dl>`),
  },
  {
    id: 'features-bento',
    role: 'features',
    variant: 'bento',
    summary: 'Photo bento',
    source: tailark('mist/blocks/features/four.tsx'),
    slots: { ...HEAD_SLOTS, image: image(true), caption: text(90, true), items: list(ITEM, 2) },
    markup: band(`${HEAD_CENTER}
      <div class='mt-14 grid gap-4 md:grid-cols-3 md:grid-rows-2'>
        <div class='relative isolate flex min-h-80 items-end overflow-hidden rounded-3xl md:col-span-2 md:row-span-2'>
          <img class='absolute inset-0 -z-10 h-full w-full object-cover' src='{{image.src}}' alt='{{image.alt}}'/>
          <div class='absolute inset-0 -z-10 bg-gradient-to-t from-black/70 to-transparent'></div>
          <h3 class='ck-display p-8 text-2xl font-bold leading-snug text-white md:text-3xl'>{{caption}}</h3>
        </div>
        {{#items}}<article class='ck-card p-6'>
          <icon name='{{item.icon}}' class='ck-accent-ink' size='28'/>
          <h3 class='mt-4 text-lg font-semibold'>{{item.title}}</h3>
          {{#item.text}}<p class='ck-muted mt-2 leading-relaxed'>{{item.text}}</p>{{/item.text}}
        </article>{{/items}}
      </div>`),
  },
  {
    id: 'features-sticky',
    role: 'features',
    variant: 'sticky',
    summary: 'Sticky list',
    source: tailark('veil/blocks/features/two.tsx'),
    slots: { ...HEAD_SLOTS, cta: link(), items: list({ title: text(70, true), text: text(260) }, 8) },
    markup: band(`<div class='grid gap-12 md:grid-cols-12'>
        <div class='self-start md:sticky md:top-24 md:col-span-5'>${HEAD_START}{{#cta}}<div class='mt-8'>${CTA_ARROW}</div>{{/cta}}</div>
        <ol class='md:col-span-7'>
          {{#items}}<li class='border-b ck-border py-8'>
            <h3 class='text-xl font-semibold'>{{item.title}}</h3>
            {{#item.text}}<p class='ck-muted mt-3 leading-relaxed'>{{item.text}}</p>{{/item.text}}
          </li>{{/items}}
        </ol>
      </div>`),
  },
  {
    id: 'features-cards',
    role: 'features',
    summary: 'Photo, icon cards',
    source: merakiui('features/GridListWithImage.html'),
    slots: { ...HEAD_SLOTS, image: image(true), items: list(ITEM, 4) },
    markup: band(`<div class='grid items-center gap-12 lg:grid-cols-2'>
        <div>${HEAD_START}
          <div class='mt-10 grid gap-8 sm:grid-cols-2' data-ck-behavior='stagger'>
            {{#items}}<div>
              <span class='ck-accent-fill inline-flex size-11 items-center justify-center rounded-xl'><icon name='{{item.icon}}' size='22'/></span>
              <h3 class='mt-4 text-lg font-semibold'>{{item.title}}</h3>
              {{#item.text}}<p class='ck-muted mt-2 leading-relaxed'>{{item.text}}</p>{{/item.text}}
            </div>{{/items}}
          </div>
        </div>
        <img class='aspect-4/3 w-full rounded-3xl object-cover shadow-xl lg:aspect-3/4' src='{{image.src}}' alt='{{image.alt}}'/>
      </div>`),
  },
  {
    id: 'content-zigzag',
    role: 'features',
    variant: 'zigzag',
    summary: 'Alternating rows',
    source: tailark('veil/blocks/content/one.tsx'),
    slots: {
      ...HEAD_SLOTS,
      items: list({ image: image(true), title: text(80, true), text: text(320) }, 4),
    },
    markup: band(`${HEAD_CENTER}
      <div class='mt-16 flex flex-col gap-16 md:gap-24'>
        {{#items}}<div class='ck-zig grid items-center gap-8 md:grid-cols-2 md:gap-16'>
          <img class='ck-zig-media aspect-4/3 w-full rounded-3xl object-cover' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          <div>
            <h3 class='ck-display text-2xl font-bold leading-snug text-balance md:text-3xl'>{{item.title}}</h3>
            {{#item.text}}<p class='ck-muted mt-4 text-lg leading-relaxed'>{{item.text}}</p>{{/item.text}}
          </div>
        </div>{{/items}}
      </div>`),
    css: '@media (min-width:48rem){.ck-zig:nth-child(even) .ck-zig-media{order:2}}',
  },
  {
    id: 'content-story',
    role: 'features',
    summary: 'Story, tall photo',
    source: hyperui('marketing/sections/1.html'),
    slots: {
      ...HEAD_SLOTS,
      body: text(600),
      image: image(true),
      cta: link(),
      cta2: link(),
    },
    markup: band(`<div class='grid items-center gap-12 md:grid-cols-2 md:gap-16'>
        <img class='aspect-3/4 w-full rounded-3xl object-cover md:order-last' src='{{image.src}}' alt='{{image.alt}}'/>
        <div>${HEAD_START}
          {{#body}}<p class='mt-5 leading-relaxed text-pretty'>{{body}}</p>{{/body}}
          {{#cta}}<div class='mt-8 flex flex-wrap gap-3'>${CTA_ARROW}${CTA2}</div>{{/cta}}
        </div>
      </div>`),
  },
  {
    id: 'steps-timeline',
    role: 'features',
    variant: 'steps',
    summary: 'Numbered steps',
    source: hyperui('application/steps/2.html'),
    slots: {
      ...HEAD_SLOTS,
      items: list({ step: text(12), title: text(70, true), text: text(220) }, 6),
    },
    markup: band(`${HEAD_START}
      <ol class='mt-14 grid gap-8 md:grid-cols-3'>
        {{#items}}<li class='ck-step border-s-2 ps-6'>
          {{#item.step}}<span class='ck-accent-ink text-sm font-semibold tabular-nums'>{{item.step}}</span>{{/item.step}}
          <h3 class='mt-2 text-lg font-semibold'>{{item.title}}</h3>
          {{#item.text}}<p class='ck-muted mt-2 leading-relaxed'>{{item.text}}</p>{{/item.text}}
        </li>{{/items}}
      </ol>`),
    css: '.ck-step{border-color:var(--ck-accent)}',
  },
];
