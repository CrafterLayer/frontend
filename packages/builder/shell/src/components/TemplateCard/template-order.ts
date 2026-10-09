import type { BuilderDocument } from '@craftkit/builder-schema';

/**
 * A Library template card as the shell sees it (agent-script DESIGN §B.5).
 *
 * Structurally equal to blocks-marketing's `MarketingTemplateCard`: the shell
 * never imports that package (nor builder-ai), so a host passes its catalog
 * straight through. `category` is a plain string here, so a host's narrower
 * category union is assignable.
 */
export interface TemplateCardInfo {
  /** The composition id this card inserts. */
  readonly id: string;
  /** Shared by the en/ar pair ('saas' …). */
  readonly templateKey: string;
  /** The CONTENT language of the composition (not the editor's). */
  readonly lang: 'en' | 'ar';
  readonly category: string;
  readonly name: { readonly en: string; readonly ar: string };
  readonly description: { readonly en: string; readonly ar: string };
  /** Top-level sections, header and footer included. */
  readonly sections: number;
  /** A verified photo; `alt` is in the content language. */
  readonly thumbnail: { readonly src: string; readonly alt: string };
}

/** A BCP-47-shaped tag, the static export's own test (export-static-site.ts `LANGUAGE_TAG`). */
const LANGUAGE_TAG = /^[a-zA-Z]{2,8}(?:-[a-zA-Z0-9]{1,8})*$/u;

/**
 * The page's language tag: the root's own `lang` prop when it is a tag, else
 * the direction decides (RTL pages are Arabic here). The same rule the static
 * export writes into `<html lang>` (export-static-site.ts `languageOf`), so the
 * canvas, Preview and the published page agree.
 */
export function documentLanguage(document: BuilderDocument): string {
  const raw = document.nodes[document.rootId]?.props['lang'];
  if (typeof raw === 'string') {
    const tag = raw.trim();
    if (tag !== '' && LANGUAGE_TAG.test(tag)) return tag;
  }
  return document.dir === 'rtl' ? 'ar' : 'en';
}

/**
 * The content language a template must have to "match" the page: `ar` or
 * `en` from the page's tag; a page in a third language falls back to its
 * direction, so a template is never matched on nothing.
 */
export function pageContentLanguage(document: BuilderDocument): 'en' | 'ar' {
  const primary = documentLanguage(document).split('-')[0]?.toLowerCase();
  if (primary === 'ar' || primary === 'en') return primary;
  return document.dir === 'rtl' ? 'ar' : 'en';
}

/** Words a search matches on: both names, both descriptions, the key, the category and the id. */
export function templateCardSearchText(card: TemplateCardInfo): string {
  return [
    card.name.en,
    card.name.ar,
    card.description.en,
    card.description.ar,
    card.templateKey,
    card.category,
    card.id,
  ]
    .join(' ')
    .toLocaleLowerCase();
}

/**
 * Cards in the page's language first, then the rest under "Other language".
 * Nothing is dropped; each group keeps the catalog's own order.
 */
export function orderTemplateCards<T extends { readonly card: TemplateCardInfo }>(
  entries: readonly T[],
  language: 'en' | 'ar',
): { readonly matching: readonly T[]; readonly other: readonly T[] } {
  return {
    matching: entries.filter((entry) => entry.card.lang === language),
    other: entries.filter((entry) => entry.card.lang !== language),
  };
}
