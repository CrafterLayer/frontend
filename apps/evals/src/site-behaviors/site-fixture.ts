/*
  everyday site behaviours (2026-10-13): one published site, in English (LTR) and Arabic (RTL),
  that names every new hook the way the section writer is taught to (skills/site-behaviors.ts):
  a sticky header with a scroll-spy nav, a dismissible notice, a typed headline, a read-more
  story, a filtered portfolio and a back-to-top link. Data only — the browser test exports it.
*/

export type Dir = 'ltr' | 'rtl';

interface Copy {
  readonly lang: string;
  readonly brand: string;
  readonly nav: readonly [string, string, string];
  readonly notice: string;
  readonly close: string;
  readonly lead: string;
  readonly words: readonly [string, string, string];
  readonly story: string;
  readonly more: string;
  readonly less: string;
  readonly all: string;
  readonly web: string;
  readonly print: string;
  readonly items: readonly [string, string, string];
  readonly contact: string;
  readonly top: string;
}

const COPY: Readonly<Record<Dir, Copy>> = {
  ltr: {
    lang: 'en',
    brand: 'Hail Studio',
    nav: ['Story', 'Work', 'Contact'],
    notice: 'Free delivery this week',
    close: 'Close the notice',
    lead: 'We build',
    words: ['websites', 'shops', 'brands'],
    story:
      'We started in a small room above a bakery in Amman, with one laptop and a lot of patience. '.repeat(
        8,
      ),
    more: 'Read more',
    less: 'Show less',
    all: 'All',
    web: 'Web',
    print: 'Print',
    items: ['Roastery website', 'Menu posters', 'Clinic booking site'],
    contact: 'Write to us any day of the week.',
    top: 'Back to top',
  },
  rtl: {
    lang: 'ar',
    brand: 'استوديو حائل',
    nav: ['قصتنا', 'أعمالنا', 'تواصل'],
    notice: 'توصيل مجاني هذا الأسبوع',
    close: 'إغلاق الإشعار',
    lead: 'نصمم',
    words: ['مواقع', 'متاجر', 'هويات'],
    story: 'بدأنا في غرفة صغيرة فوق مخبز في عمّان، بحاسوب واحد وصبر كثير. '.repeat(10),
    more: 'اقرأ المزيد',
    less: 'عرض أقل',
    all: 'الكل',
    web: 'ويب',
    print: 'مطبوعات',
    items: ['موقع محمصة', 'ملصقات قائمة الطعام', 'موقع حجز عيادة'],
    contact: 'راسلنا في أي يوم من أيام الأسبوع.',
    top: 'إلى الأعلى',
  },
};

type Node = Readonly<Record<string, unknown>>;

const el = (
  tag: string,
  extra: {
    readonly className?: string;
    readonly text?: string;
    readonly attributes?: Readonly<Record<string, string>>;
    readonly children?: readonly Node[];
  } = {},
): Node => ({ kind: 'element', tag, ...extra });

const root = (...children: readonly Node[]): Node => ({ kind: 'root', children });

/** The page's regions: id → custom-code tree, in reading order. */
export function siteRegions(dir: Dir): readonly (readonly [string, Node])[] {
  const copy = COPY[dir];
  const link = (href: string, text: string) => el('a', { text, attributes: { href } });
  return [
    [
      'header',
      root(
        el('header', {
          className: 'qa-header',
          attributes: { 'data-ck-behavior': 'sticky-header' },
          children: [
            el('strong', { text: copy.brand }),
            el('nav', {
              className: 'qa-nav',
              attributes: { 'data-ck-behavior': 'scroll-spy', 'aria-label': copy.nav[0] },
              children: [
                link('#story', copy.nav[0]),
                link('#work', copy.nav[1]),
                link('#contact', copy.nav[2]),
              ],
            }),
          ],
        }),
      ),
    ],
    [
      'notice',
      root(
        el('div', {
          className: 'qa-notice',
          attributes: {
            'data-ck-behavior': 'dismiss',
            role: 'region',
            'aria-label': copy.notice,
          },
          children: [
            el('p', { text: copy.notice }),
            el('button', {
              text: '×',
              attributes: { type: 'button', 'aria-label': copy.close, hidden: '' },
            }),
          ],
        }),
      ),
    ],
    [
      'hero',
      root(
        el('section', {
          className: 'qa-band',
          children: [
            el('h1', {
              text: `${copy.lead} `,
              children: [
                el('span', {
                  attributes: { 'data-ck-behavior': 'typed-words' },
                  children: [
                    el('span', { text: copy.words[0] }),
                    el('span', { text: copy.words[1], attributes: { hidden: '' } }),
                    el('span', { text: copy.words[2], attributes: { hidden: '' } }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ),
    ],
    [
      'story',
      root(
        el('section', {
          className: 'qa-band',
          attributes: { id: 'story' },
          children: [
            el('h2', { text: copy.nav[0] }),
            el('div', {
              className: 'qa-more',
              attributes: { 'data-ck-behavior': 'read-more', 'data-ck-text': copy.less },
              children: [
                el('p', { text: copy.story }),
                el('button', { text: copy.more, attributes: { type: 'button', hidden: '' } }),
              ],
            }),
          ],
        }),
      ),
    ],
    [
      'work',
      root(
        el('section', {
          className: 'qa-band',
          attributes: { id: 'work' },
          children: [
            el('h2', { text: copy.nav[1] }),
            el('div', {
              attributes: { 'data-ck-behavior': 'filter' },
              children: [
                el('div', {
                  attributes: { role: 'group', 'aria-label': copy.nav[1] },
                  children: [
                    el('button', {
                      text: copy.all,
                      attributes: { type: 'button', 'data-ck-filter': 'all' },
                    }),
                    el('button', {
                      text: copy.web,
                      attributes: { type: 'button', 'data-ck-filter': 'web' },
                    }),
                    el('button', {
                      text: copy.print,
                      attributes: { type: 'button', 'data-ck-filter': 'print' },
                    }),
                  ],
                }),
                el('ul', {
                  children: [
                    el('li', { text: copy.items[0], attributes: { 'data-ck-filter': 'web' } }),
                    el('li', { text: copy.items[1], attributes: { 'data-ck-filter': 'print' } }),
                    el('li', { text: copy.items[2], attributes: { 'data-ck-filter': 'web' } }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ),
    ],
    [
      'contact',
      root(
        el('section', {
          className: 'qa-band',
          attributes: { id: 'contact' },
          children: [
            el('h2', { text: copy.nav[2] }),
            el('p', { text: copy.contact }),
            el('a', {
              className: 'fixed bottom-6 end-6 qa-top',
              // An icon, as taught: a neutral text glyph would take dir='auto' and read LTR.
              children: [{ kind: 'icon', name: 'arrow-up' }],
              attributes: {
                href: '#top',
                'data-ck-behavior': 'back-to-top',
                'aria-label': copy.top,
              },
            }),
          ],
        }),
      ),
    ],
  ];
}

/** The words the typed headline cycles, and the read-more labels, for assertions. */
export function siteCopy(dir: Dir): Copy {
  return COPY[dir];
}

/**
 * The page's CSS (the host's Tailwind compile, stubbed): the three utilities the skill teaches
 * for the back-to-top link, a sticky header and tall bands so the page scrolls. Colours are the
 * page's own tokens.
 *
 * No sticky rule of the page's own: the renderer makes a sticky header's region stick with it
 * (behaviors-css.ts), which this test found missing on a published page (2026-10-13).
 */
export const SITE_CSS = `:root{--qa-ink:#172033;--qa-surface:#ffffff;--qa-accent:#0f766e}
body{margin:0;font:16px/1.5 system-ui,sans-serif;color:var(--qa-ink);background:var(--qa-surface)}
.fixed{position:fixed}.bottom-6{bottom:1.5rem}.end-6{inset-inline-end:1.5rem}
.qa-header{display:flex;gap:2rem;align-items:center;padding:0 1rem;height:64px;background:var(--qa-surface);border-block-end:1px solid var(--qa-ink)}
.qa-nav{display:flex;gap:1rem}.qa-nav a{color:var(--qa-ink)}.qa-nav a[aria-current]{color:var(--qa-accent);font-weight:700}
.qa-notice{display:flex;gap:1rem;align-items:center;justify-content:space-between;padding:0.5rem 1rem;background:var(--qa-surface);border-block-end:1px solid var(--qa-ink)}
.qa-band{min-height:900px;padding:2rem 1rem;box-sizing:border-box}
.qa-more{max-width:40rem}
.qa-top{display:inline-grid;place-items:center;width:3rem;height:3rem;border-radius:999px;background:var(--qa-accent);color:var(--qa-surface);text-decoration:none}
button{min-height:2.75rem;min-width:2.75rem;padding:0.5rem 1rem;color:var(--qa-ink);background:var(--qa-surface);border:1px solid var(--qa-ink)}
button[aria-pressed=true]{background:var(--qa-accent);color:var(--qa-surface)}`;
