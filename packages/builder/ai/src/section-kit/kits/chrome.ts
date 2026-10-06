import type { SectionKit } from '../types';
import { CTA2, CTA_ARROW, hyperui, icon, link, list, merakiui, text } from './parts';

const NAV = list({ label: text(30, true), href: text(300, true) }, 8);

/*
  The phone menu is the skeleton's (skeleton-from-plan.ts phoneMenu): a
  button opens the links as a popover sheet, no script. The sheet carries no
  display utility — a `flex` on a popover would show it while closed.
*/
const BAR = `<div class='mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8 lg:gap-8'>
  <a class='ck-display ck-link min-w-0 truncate text-xl font-bold' href='/'>{{brand}}</a>
  <nav class='hidden items-center gap-6 text-sm font-medium lg:flex' aria-label='{{nav_label}}'>{{#nav}}<a class='ck-link ck-muted whitespace-nowrap' href='{{item.href}}'>{{item.label}}</a>{{/nav}}</nav>
  <div class='flex shrink-0 items-center gap-2'>
    {{#cta}}<a class='ck-btn hidden text-sm sm:inline-flex' href='{{cta.href}}'>{{cta.label}}</a>{{/cta}}
    <button class='ck-link flex size-10 items-center justify-center rounded-full border ck-border bg-transparent lg:hidden' popovertarget='ck-kit-nav' aria-label='{{nav_label}}'><icon name='menu' size='22'/></button>
  </div>
  <nav class='ck-surface me-0 ms-auto h-full w-80 max-w-full border-0 p-6 shadow-2xl lg:hidden' id='ck-kit-nav' popover='' aria-label='{{nav_label}}'>
    <div class='flex flex-col gap-1'>
      <button class='ck-link flex size-10 items-center justify-center self-end rounded-full bg-transparent' popovertarget='ck-kit-nav' popovertargetaction='hide' aria-label='{{nav_label}}'><icon name='x' size='22'/></button>
      {{#nav}}<a class='ck-link block rounded-lg px-3 py-3 text-lg font-medium' href='{{item.href}}'>{{item.label}}</a>{{/nav}}
      {{#cta}}<a class='ck-btn mt-4' href='{{cta.href}}'>{{cta.label}}</a>{{/cta}}
    </div>
  </nav>
</div>`;

const HEADER_SLOTS = {
  brand: text(40, true),
  nav_label: text(40, true),
  nav: NAV,
  cta: link(),
} as const;

const FOOTER_LINKS = `<nav aria-label='{{nav_label}}'><ul class='space-y-2 text-sm'>{{#nav}}<li><a class='ck-link' href='{{item.href}}'>{{item.label}}</a></li>{{/nav}}</ul></nav>`;
const FOOTER_CONTACT = `<ul class='space-y-3 text-sm'>{{#contact}}<li class='flex items-start gap-2'><icon name='{{item.icon}}' class='ck-accent-ink shrink-0' size='18'/>{{#item.href}}<a class='ck-link min-w-0 break-words' href='{{item.href}}'>{{item.text}}</a>{{/item.href}}{{^item.href}}<span class='min-w-0 break-words'>{{item.text}}</span>{{/item.href}}</li>{{/contact}}</ul>`;
const COPYRIGHT = `<div class='border-t ck-border'><p class='ck-muted mx-auto max-w-6xl px-4 py-6 text-xs md:px-8'>{{copyright}}</p></div>`;

const FOOTER_SLOTS = {
  brand: text(40, true),
  text: text(200),
  nav_label: text(40, true),
  nav: NAV,
  contact: list({ icon: icon(true), text: text(80, true), href: text(300) }, 5, false),
  copyright: text(120, true),
} as const;

export const HEADER_KITS: readonly SectionKit[] = [
  {
    id: 'header-bar',
    role: 'header',
    summary: 'Bar, phone menu',
    source: hyperui('marketing/headers/1.html'),
    slots: HEADER_SLOTS,
    markup: `<header class='ck-surface sticky top-0 z-40 border-b ck-border' data-ck-behavior='sticky-header'>${BAR}</header>`,
  },
  {
    id: 'header-notice',
    role: 'header',
    summary: 'Notice strip, bar',
    source: hyperui('marketing/announcements/1.html'),
    slots: { ...HEADER_SLOTS, notice: text(120, true), notice_link: link() },
    markup: `<header class='ck-surface sticky top-0 z-40 border-b ck-border' data-ck-behavior='sticky-header'>
      <div class='ck-accent-fill px-4 py-2 text-center text-sm font-medium'><span>{{notice}}</span>{{#notice_link}}<a class='ck-link ms-2 font-semibold underline underline-offset-4' href='{{notice_link.href}}'>{{notice_link.label}}</a>{{/notice_link}}</div>
      ${BAR}
    </header>`,
  },
];

export const FOOTER_KITS: readonly SectionKit[] = [
  {
    id: 'footer-columns',
    role: 'footer',
    variant: 'footer',
    summary: 'Links, contact',
    source: hyperui('marketing/footers/3.html'),
    slots: FOOTER_SLOTS,
    markup: `<footer class='ck-inverse'>
      <div class='mx-auto grid max-w-6xl gap-10 px-4 py-14 md:grid-cols-4 md:px-8'>
        <div class='md:col-span-2'><p class='ck-display text-2xl font-bold'>{{brand}}</p>{{#text}}<p class='ck-muted mt-3 max-w-sm text-sm leading-relaxed'>{{text}}</p>{{/text}}</div>
        ${FOOTER_LINKS}
        ${FOOTER_CONTACT}
      </div>
      ${COPYRIGHT}
    </footer>`,
  },
  {
    id: 'footer-cta',
    role: 'footer',
    summary: 'Call, then links',
    source: merakiui('footers/CTAWithLinks.html'),
    slots: { ...FOOTER_SLOTS, title: text(90, true), cta: link(true), cta2: link() },
    markup: `<footer class='ck-inverse'>
      <div class='mx-auto max-w-6xl px-4 py-14 md:px-8'>
        <div class='flex flex-col gap-6 border-b ck-border pb-12 md:flex-row md:items-center md:justify-between'>
          <p class='ck-display max-w-xl text-3xl font-bold leading-snug text-balance'>{{title}}</p>
          <div class='flex flex-wrap gap-3'>${CTA_ARROW}${CTA2}</div>
        </div>
        <div class='grid gap-10 pt-12 md:grid-cols-4'>
          <div class='md:col-span-2'><p class='ck-display text-xl font-bold'>{{brand}}</p>{{#text}}<p class='ck-muted mt-3 max-w-sm text-sm leading-relaxed'>{{text}}</p>{{/text}}</div>
          ${FOOTER_LINKS}
          ${FOOTER_CONTACT}
        </div>
      </div>
      ${COPYRIGHT}
    </footer>`,
  },
];
