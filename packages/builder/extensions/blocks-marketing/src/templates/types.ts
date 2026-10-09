import type { CompositionDef } from '@craftkit/builder-schema';

/*
  The template library's types (agent-script DESIGN §B.2, package templates-core).

  Every template ships twice: an English (LTR) composition and an Arabic (RTL)
  one written for the market, not translated word for word. The pair shares a
  `templateKey`; each half is its own registered composition with its own id.
*/

/** The CONTENT language of one composition (not the editor's UI language). */
export type TemplateLang = 'en' | 'ar';

export const TEMPLATE_LANGS: readonly TemplateLang[] = ['en', 'ar'];

/** What a template is for. The core four plus the verticals package's five. */
export type TemplateCategory =
  | 'saas'
  | 'agency'
  | 'store'
  | 'services'
  | 'restaurant'
  | 'clinic'
  | 'portfolio'
  | 'realestate'
  | 'events';

/** Copy that exists in both languages: a card's name and description. */
export interface BilingualText {
  readonly en: string;
  readonly ar: string;
}

/**
 * One Library card. The shape is load-bearing: the shell's `TemplateCardInfo`
 * is structurally equal to it (the shell never imports this package), and the
 * Library's Templates tab renders exactly these fields.
 */
export interface MarketingTemplateCard {
  /** The composition id this card inserts. */
  readonly id: string;
  /** 'saas' … shared by the en/ar pair. */
  readonly templateKey: string;
  /** The CONTENT language. */
  readonly lang: 'en' | 'ar';
  readonly category: TemplateCategory;
  readonly name: { readonly en: string; readonly ar: string };
  /** ≤ 120 characters each. */
  readonly description: { readonly en: string; readonly ar: string };
  /** Top-level sections, header and footer included. */
  readonly sections: number;
  /** `src` is a TEMPLATE_PHOTOS url at w=640; `alt` is in the content language. */
  readonly thumbnail: { readonly src: string; readonly alt: string };
}

/** One template: both of its compositions and both of its cards. */
export interface TemplateDefinition {
  readonly key: string;
  readonly category: TemplateCategory;
  /** English keeps the historical id; Arabic appends `-ar`. */
  compositionId(lang: TemplateLang): string;
  build(lang: TemplateLang): CompositionDef;
  card(lang: TemplateLang): MarketingTemplateCard;
}
