/**
 * What the four industry page types share.
 *
 * ## Why industry page types at all
 *
 * page-composition's order — hero, proof, benefits, how it works — is a
 * software landing page. The trades that make up most Arabic small-business
 * sites live on something else: a café on its menu and prices, a clinic on
 * its doctors and booking, a shop on its products, an agency on its listings'
 * three numbers. Each type REPLACES page-composition for its trade (declared
 * conflict, higher priority), so a request still carries one skill of each
 * kind: words, look, structure, language.
 *
 * ## Why WhatsApp first
 *
 * The local conversion path in these markets is a conversation, not a form or
 * a cart: a wa.me link with the order or booking prefilled, a phone number,
 * opening hours and a map. The renderer has no brand icons, so the WhatsApp
 * link carries `message-circle` and the visible word.
 */

/**
 * The intents a whole-page playbook serves — the industry types here, and the
 * page archetypes and taste skill in builtins.ts. Their trade and archetype
 * nouns fire on edits that merely NAME the trade. Measured 2026-09-28 (wave-1
 * verifier): "Change the restaurant menu prices" carried menu-page +
 * copywriting + visual-direction, 377 → 2,529 skill tokens, and "عدّل رقم هاتف
 * العيادة" 936 → 3,205. Gated by the routed intent, an edit carries the edit
 * set alone.
 */
export const PAGE_INTENTS = ['build-page', 'build-site'] as const;

export const INDUSTRY_PAGE_IDS = [
  'craftkit.clinic-page',
  'craftkit.menu-page',
  'craftkit.property-page',
  'craftkit.shop-page',
] as const;

/** A page is one archetype; a surgical edit carries none of them. */
export function industryConflicts(self: (typeof INDUSTRY_PAGE_IDS)[number]): readonly string[] {
  return [
    'craftkit.cv-page',
    'craftkit.occasion-page',
    'craftkit.page-composition',
    'craftkit.precise-edit',
    ...INDUSTRY_PAGE_IDS.filter((id) => id !== self),
  ];
}

export const INDUSTRY_SHELL = `SHELL: one region per section, each opening with an h2 text-balance (the hero holds the page's one h1), an id on every section for the header's links; ground, card and band from the direction's palette, one band besides the hero; at most 8 insertNode per plan, the rest in followUp; setProp page title and description when empty. The bracketed layouts are section-variants ids.`;

export const INDUSTRY_LOCAL_ACTIONS = `LOCAL ACTIONS: WhatsApp is the primary action — <a href='https://wa.me/<digits only>?text=<the order or booking, encoded>'> with icon message-circle and the word «واتساب» / WhatsApp — then a tel: link; hours as ul of li flex justify-between tabular-nums; the address linked to https://maps.google.com/?q=<encoded address>. No form and no cart: the page starts a conversation. Prices carry the currency code after the number (3.50 JOD, 18 SAR, 25 AED).`;
