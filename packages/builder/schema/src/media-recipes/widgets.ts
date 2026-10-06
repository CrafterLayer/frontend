import { customCodeAttributeProblem, type CustomCodeNode } from '../custom-code/custom-code-tree';
import {
  el,
  icon,
  imageNode,
  inLocale,
  mediaSection,
  root,
  type MediaHeading,
  type MediaImage,
  type MediaLocale,
  type MediaRecipe,
  type MediaRecipeResult,
} from './types';
import { mapsLinkUrl } from './urls';

/**
 * Widget recipes (media-motion DESIGN §E): before/after compare, a pricing
 * toggle, a privacy-first map, a mailto form and a Lottie animation. Each is
 * plain HTML that reads without script; the named behaviour (or engine marker)
 * adds the interaction.
 */

/** Options every widget shares. */
export interface WidgetOptions {
  readonly locale: MediaLocale;
  readonly title?: string | undefined;
  readonly heading?: MediaHeading | undefined;
  /** `false` returns the widget element alone (for `insertTreeNode`); default a section. */
  readonly standalone?: boolean | undefined;
}

function wrap(
  options: WidgetOptions,
  widget: CustomCodeNode,
  label: MediaRecipe['label'],
  width: 'max-w-3xl' | 'max-w-4xl' | 'max-w-5xl' | 'max-w-6xl',
  css = '',
): MediaRecipe {
  return {
    label,
    tree: root(options.standalone === false ? widget : mediaSection(options, [widget], width)),
    css,
  };
}

export interface CompareOptions extends WidgetOptions {
  readonly before: MediaImage;
  readonly after: MediaImage;
}

/**
 * `div[data-ck-behavior=compare]` with exactly two images, before then after.
 * The runtime adds the range slider and clips the after image (logically, so it
 * mirrors in RTL); without script the after image shows.
 */
export function buildCompare(options: CompareOptions): MediaRecipeResult {
  if (options.before.src.trim() === '' || options.after.src.trim() === '') {
    return { error: 'a before/after compare needs two images' };
  }
  const name = (image: MediaImage, fallback: { ar: string; en: string }): MediaImage => ({
    ...image,
    alt: image.alt.trim() === '' ? inLocale(options.locale, fallback) : image.alt,
  });
  const widget = el(
    'div',
    'relative aspect-video overflow-hidden rounded-xl bg-black',
    { 'data-ck-behavior': 'compare' },
    [
      imageNode(name(options.before, { ar: 'قبل', en: 'Before' }), 'block size-full object-cover'),
      imageNode(
        name(options.after, { ar: 'بعد', en: 'After' }),
        'absolute inset-0 size-full object-cover',
      ),
    ],
  );
  return wrap(options, widget, { ar: 'قبل وبعد', en: 'Before and after' }, 'max-w-4xl');
}

/** One plan: its name, its price on side `a` (monthly) and side `b` (yearly). */
export interface PricingPlan {
  readonly name: string;
  readonly a: string;
  readonly b: string;
  readonly features?: readonly string[] | undefined;
}

export interface PricingToggleOptions extends WidgetOptions {
  /** One to four plans. */
  readonly plans: readonly PricingPlan[];
  /** The two sides' names; default monthly / yearly in the page locale. */
  readonly sides?: { readonly a: string; readonly b: string } | undefined;
}

/** The most plans one toggle compares. */
export const PRICING_MAX_PLANS = 4;

/**
 * Plan cards plus a `toggle-group` switch. Side `b` carries `hidden` in the
 * markup, so without script only side `a` shows; the runtime adopts the button
 * as a `role=switch` and swaps the sides.
 */
export function buildPricingToggle(options: PricingToggleOptions): MediaRecipeResult {
  const plans = options.plans.filter((plan) => plan.name.trim() !== '');
  if (plans.length === 0) return { error: 'a pricing toggle needs at least one plan' };
  if (plans.length > PRICING_MAX_PLANS) {
    return { error: `a pricing toggle compares at most ${String(PRICING_MAX_PLANS)} plans` };
  }
  const sides =
    options.sides ??
    (options.locale === 'ar' ? { a: 'شهري', b: 'سنوي' } : { a: 'Monthly', b: 'Yearly' });
  const per =
    options.locale === 'ar'
      ? { a: 'شهريًا', b: 'سنويًا' }
      : { a: 'per month', b: 'per year' };
  const option = (side: 'a' | 'b', text: string): CustomCodeNode =>
    el('span', undefined, side === 'a' ? { 'data-ck-option': 'a' } : { 'data-ck-option': 'b', hidden: '' }, undefined, text);
  const cards = plans.map((plan) => {
    const features = (plan.features ?? []).filter((feature) => feature.trim() !== '').slice(0, 8);
    const body: CustomCodeNode[] = [
      el('h3', 'text-lg font-semibold', undefined, undefined, plan.name.trim()),
      el('p', 'mt-4 text-4xl font-bold tabular-nums', undefined, [option('a', plan.a), option('b', plan.b)]),
      el('p', 'mt-1 text-sm text-text-muted', undefined, [option('a', per.a), option('b', per.b)]),
    ];
    if (features.length > 0) {
      body.push(
        el(
          'ul',
          'mt-6 space-y-2 text-sm',
          undefined,
          features.map((feature) =>
            el('li', 'flex items-start gap-2', undefined, [
              icon('check', 16, 'mt-0.5 shrink-0 text-accent'),
              el('span', undefined, undefined, undefined, feature.trim()),
            ]),
          ),
        ),
      );
    }
    return el('article', 'flex flex-col rounded-2xl border border-text/10 bg-surface p-6 shadow-sm', undefined, body);
  });
  const widget = el('div', 'flex flex-col items-center', { 'data-ck-behavior': 'toggle-group' }, [
    el(
      'button',
      'mb-10 inline-flex items-center gap-2 rounded-full border border-text/20 px-5 py-2 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
      { type: 'button' },
      undefined,
      `${sides.a} / ${sides.b}`,
    ),
    el('div', `grid w-full gap-6 md:grid-cols-${String(plans.length)}`, undefined, cards),
  ]);
  return wrap(options, widget, { ar: 'الأسعار', en: 'Pricing' }, 'max-w-6xl');
}

/**
 * A map behind a privacy facade: a link to Google Maps until the reader clicks,
 * when the runtime swaps in the keyless embed (no Google request before that).
 */
export function buildMapFacade(address: string, options: WidgetOptions): MediaRecipeResult {
  const href = mapsLinkUrl(address);
  if (href === undefined) return { error: 'a map needs an address of at most 300 characters' };
  const place = address.trim().replace(/\s+/gu, ' ');
  const widget = el(
    'a',
    'relative block aspect-video overflow-hidden rounded-xl border border-text/10 bg-surface',
    {
      'data-ck-behavior': 'embed-facade',
      href,
      'aria-label': `${inLocale(options.locale, { ar: 'الخريطة', en: 'Map' })}: ${place}`,
    },
    [
      el('span', 'absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center', undefined, [
        icon('map-pin', 32, 'text-accent'),
        el('span', 'text-base font-semibold text-text', undefined, undefined, place),
        el(
          'span',
          'text-sm text-text-muted',
          undefined,
          undefined,
          inLocale(options.locale, { ar: 'اعرض الخريطة', en: 'Show the map' }),
        ),
      ]),
    ],
  );
  return wrap(options, widget, { ar: 'خريطة', en: 'Map' }, 'max-w-5xl');
}

export interface MailtoFormOptions extends WidgetOptions {
  /** Prefix of the field ids (unique on the page); default `ck-mail`. */
  readonly idPrefix?: string | undefined;
}

/** A contact form that opens the reader's mail app (`mailto-form`), labelled fields only. */
export function buildMailtoForm(email: string, options: MailtoFormOptions): MediaRecipeResult {
  const address = email.trim();
  const problem = customCodeAttributeProblem('form', 'data-ck-email', address);
  if (problem !== undefined) return { error: problem };
  const prefix = /^[A-Za-z][\w-]{0,40}$/u.test(options.idPrefix ?? '') ? (options.idPrefix ?? '') : 'ck-mail';
  const t = (text: { ar: string; en: string }): string => inLocale(options.locale, text);
  const control =
    'rounded-lg border border-text/20 bg-surface px-4 py-3 text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';
  const field = (
    key: 'name' | 'email' | 'message',
    label: string,
    input: CustomCodeNode,
  ): CustomCodeNode =>
    el('div', 'grid gap-2', undefined, [
      el('label', 'text-sm font-medium', { for: `${prefix}-${key}` }, undefined, label),
      input,
    ]);
  const widget = el(
    'form',
    'grid gap-4',
    { 'data-ck-behavior': 'mailto-form', 'data-ck-email': address },
    [
      field(
        'name',
        t({ ar: 'الاسم', en: 'Name' }),
        el('input', control, {
          id: `${prefix}-name`,
          name: 'name',
          type: 'text',
          autocomplete: 'name',
          required: '',
        }),
      ),
      field(
        'email',
        t({ ar: 'البريد الإلكتروني', en: 'Email' }),
        el('input', control, {
          id: `${prefix}-email`,
          name: 'email',
          type: 'email',
          autocomplete: 'email',
          required: '',
        }),
      ),
      field(
        'message',
        t({ ar: 'رسالتك', en: 'Your message' }),
        el('textarea', control, { id: `${prefix}-message`, name: 'message', rows: '5', required: '' }),
      ),
      el(
        'button',
        'inline-flex items-center justify-center rounded-lg bg-accent px-6 py-3 font-semibold text-accent-text hover:opacity-90',
        { type: 'submit' },
        undefined,
        t({ ar: 'أرسل', en: 'Send' }),
      ),
    ],
  );
  return wrap(options, widget, { ar: 'نموذج تواصل', en: 'Contact form' }, 'max-w-3xl');
}

/**
 * A Lottie animation (`div[data-ck-lottie][data-ck-src]`) with a poster image:
 * the poster is what shows without script, under reduced motion and on the
 * editing canvas. Decorative (hidden from assistive technology) unless the
 * poster carries alt text.
 */
export function buildLottie(
  src: string,
  poster: MediaImage | undefined,
  options: WidgetOptions,
): MediaRecipeResult {
  const address = src.trim();
  const problem = customCodeAttributeProblem('div', 'data-ck-src', address);
  if (problem !== undefined) return { error: problem };
  const decorative = poster === undefined || poster.alt.trim() === '';
  const widget = el(
    'div',
    'relative mx-auto w-full max-w-md',
    {
      'data-ck-lottie': '',
      'data-ck-src': address,
      'aria-hidden': decorative ? 'true' : undefined,
    },
    poster === undefined || poster.src.trim() === ''
      ? []
      : [imageNode(poster, 'block h-auto w-full', { decorative })],
  );
  return wrap(options, widget, { ar: 'رسم متحرك', en: 'Animation' }, 'max-w-3xl');
}
