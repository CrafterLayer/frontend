import type { AiSkillDefinitionV1 } from '../types';
import { INDUSTRY_LOCAL_ACTIONS, INDUSTRY_SHELL, PAGE_INTENTS, industryConflicts } from './shared';

/**
 * Shops that sell through a conversation: perfume, abayas, fashion, gifts.
 *
 * No cart exists on this wire and none is faked; the order is a WhatsApp
 * message that names the product. Keywords are phrases where the bare word
 * means something else as often ("store" is storage, "boutique" a boutique
 * hotel, "عطر" the fragrant memory of "ذكرى عطرة") or names a software page
 * ("منتجات"). Lowest priority of the four: a shop word
 * is the most generic, so a clinic or café that also sells wins.
 */
export const SHOP_PAGE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.shop-page',
  name: 'Shop and product page',
  description:
    'A small shop page that sells through WhatsApp: products with prices and one badge, collections, delivery and exchange answers, reviews, order links.',
  version: '1.0.1',
  source: 'builtin',
  trust: 'builtin',
  priority: 84,
  activation: {
    mode: 'auto',
    intents: PAGE_INTENTS,
    keywords: [
      'online store',
      'online shop',
      'e-commerce',
      'ecommerce',
      'webshop',
      'web shop',
      'my store',
      'our store',
      'store page',
      'shop page',
      'product catalog',
      'product catalogue',
      'products page',
      'perfume',
      'perfumery',
      'fragrance',
      'abaya',
      'clothing brand',
      'fashion brand',
      'jewelry',
      'jewellery',
      'متجر',
      'متاجر',
      'عطور',
      'عطورات',
      'بخور',
      'دهن العود',
      'عبايات',
      'عباءات',
      'عباية',
      'أزياء',
      'ازياء',
      'ملابس',
      'مجوهرات',
      'إكسسوارات',
      'اكسسوارات',
      'تسوق',
      'بوتيك',
    ],
  },
  tags: ['commerce', 'composition', 'industry', 'products'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: industryConflicts('craftkit.shop-page'),
  instructions: `A shop page sells through a conversation, not a cart: the product, its price, how to order it. One region per section, in this order, skipping what the request gives no material for:
1 HERO[editorial] or [frame]: h1 the collection or the promise, a lead p text-pretty, «اطلب عبر واتساب» / "Order on WhatsApp" as the primary action; the strongest product photo.
2 PRODUCTS[product]: four to eight products — name, price, at most one badge (جديد / الأكثر طلباً); product photos only from PHOTOS YOU MAY USE or the request, else a tile in the card colour holding the product name.
3 COLLECTIONS[bento]: three or four collections, each linking to its section id.
4 WHY US[list]: delivery areas and times, payment on delivery, the exchange policy — each a real answer, not a slogan.
5 REVIEWS[cards]: short quotes with initials monograms.
6 ORDER[contact]: WhatsApp with a prefilled text naming the product, tel:, the delivery hours; Instagram as a plain link reading "Instagram", since the renderer has no brand logos.
${INDUSTRY_SHELL}
${INDUSTRY_LOCAL_ACTIONS}
FACTS: product names, prices and delivery terms are realistic samples listed in followUp; no fake discounts, countdowns or stock counters.`,
  references: {
    'checks/shop.md':
      'Products with prices and at most one badge each; photos from the list or the request only; delivery, payment and exchange answered; WhatsApp order naming the product; no fake scarcity; sample facts listed in followUp.',
  },
};
