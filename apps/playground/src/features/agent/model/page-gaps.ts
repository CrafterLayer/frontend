import type { Key } from '../copy/keys';

/**
 * The sections a page commonly lacks, each with the words its label is recognised by in
 * either language. A label is a region's own name ("Pricing", «الأسعار») or its block type
 * in words ("accordion"), so both are matched, loosely and case-blind. Matchers, not copy:
 * they live apart from `suggestions.ts`, which holds no Arabic word of its own.
 */
export const PAGE_GAPS = [
  {
    key: 'suggest.page.pricing',
    match: /pric|plan|package|tarif|سعر|أسعار|اسعار|باقات/iu,
  },
  { key: 'suggest.page.faq', match: /faq|question|accordion|أسئلة|اسئلة/iu },
  {
    key: 'suggest.page.contact',
    match: /contact|book|reserv|appointment|تواصل|اتصال|حجز|موعد/iu,
  },
  {
    key: 'suggest.page.testimonials',
    match: /testimonial|review|quote|social proof|آراء|اراء|تقييم|شهادات/iu,
  },
] as const satisfies readonly { readonly key: Key; readonly match: RegExp }[];

