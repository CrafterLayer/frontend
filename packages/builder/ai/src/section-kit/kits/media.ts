import type { SectionKit } from '../types';
import { HEAD_SLOTS, HEAD_START, band, hyperui, image, list, merakiui, text } from './parts';

const POST = {
  image: image(true),
  title: text(90, true),
  text: text(200),
  meta: text(40),
  href: text(300),
} as const;

// media-motion (2026-10-06): the two gallery kits carry data-ck-behavior='gallery' (DESIGN §F.4), so a built
// page's photos open the shared dialog — keys, swipe, counter, captions — in Preview and the export.
export const MEDIA_KITS: readonly SectionKit[] = [
  {
    id: 'gallery-mosaic',
    role: 'media',
    variant: 'gallery',
    summary: 'Photo mosaic',
    source: merakiui('portfolio/Cards.html'),
    slots: { ...HEAD_SLOTS, items: list({ image: image(true), caption: text(60) }, 6) },
    markup: band(`${HEAD_START}
      <div data-ck-behavior='gallery' class='ck-mosaic mt-12 grid grid-cols-2 gap-4 md:grid-cols-4'>
        {{#items}}<figure class='group relative overflow-hidden rounded-2xl'>
          <img class='aspect-square h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduce:transform-none' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          {{#item.caption}}<figcaption class='absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-sm font-semibold text-white'>{{item.caption}}</figcaption>{{/item.caption}}
        </figure>{{/items}}
      </div>`),
    css: '.ck-mosaic > :first-child{grid-column:span 2;grid-row:span 2}',
  },
  {
    id: 'gallery-rail',
    role: 'media',
    variant: 'rail',
    summary: 'Photo rail',
    source: merakiui('portfolio/HoverEffect.html'),
    slots: { ...HEAD_SLOTS, items: list({ image: image(true), caption: text(60, true) }, 10) },
    markup: band(`${HEAD_START}
      <div data-ck-behavior='gallery' class='mt-12 flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4'>
        {{#items}}<figure class='w-4/5 shrink-0 snap-start md:w-96'>
          <img class='aspect-4/3 w-full rounded-2xl object-cover' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          <figcaption class='mt-3 font-semibold'>{{item.caption}}</figcaption>
        </figure>{{/items}}
      </div>`),
  },
  {
    id: 'blog-cards',
    role: 'media',
    summary: 'Article cards',
    source: hyperui('marketing/blog-cards/1.html'),
    slots: { ...HEAD_SLOTS, items: list(POST, 6) },
    markup: band(`${HEAD_START}
      <div class='mt-12 grid gap-6 md:grid-cols-3'>
        {{#items}}<article class='ck-card group flex flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-xl'>
          <img class='aspect-video w-full object-cover' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          <div class='flex flex-1 flex-col p-6'>
            {{#item.meta}}<p class='ck-muted text-xs'>{{item.meta}}</p>{{/item.meta}}
            {{#item.href}}<h3 class='mt-2 text-lg font-semibold leading-snug'><a class='ck-link' href='{{item.href}}'>{{item.title}}</a></h3>{{/item.href}}{{^item.href}}<h3 class='mt-2 text-lg font-semibold leading-snug'>{{item.title}}</h3>{{/item.href}}
            {{#item.text}}<p class='ck-muted mt-2 line-clamp-3 text-sm leading-relaxed'>{{item.text}}</p>{{/item.text}}
          </div>
        </article>{{/items}}
      </div>`),
  },
  {
    id: 'blog-feature',
    role: 'media',
    summary: 'Lead article',
    source: merakiui('blog/Grid.html'),
    slots: { ...HEAD_SLOTS, items: list(POST, 4) },
    markup: band(`${HEAD_START}
      <div class='ck-posts mt-12 grid gap-8 lg:grid-cols-2'>
        {{#items}}<article class='ck-post flex gap-5'>
          <img class='aspect-square w-28 shrink-0 rounded-2xl object-cover' src='{{item.image.src}}' alt='{{item.image.alt}}'/>
          <div>
            {{#item.meta}}<p class='ck-muted text-xs'>{{item.meta}}</p>{{/item.meta}}
            {{#item.href}}<h3 class='ck-display mt-1 text-xl font-bold leading-snug'><a class='ck-link' href='{{item.href}}'>{{item.title}}</a></h3>{{/item.href}}{{^item.href}}<h3 class='ck-display mt-1 text-xl font-bold leading-snug'>{{item.title}}</h3>{{/item.href}}
            {{#item.text}}<p class='ck-muted mt-2 line-clamp-3 text-sm leading-relaxed'>{{item.text}}</p>{{/item.text}}
          </div>
        </article>{{/items}}
      </div>`),
    css: '@media (min-width:64rem){.ck-posts > .ck-post:first-child{grid-row:span 3;flex-direction:column}.ck-posts > .ck-post:first-child img{width:100%;aspect-ratio:16/10}}',
  },
];
