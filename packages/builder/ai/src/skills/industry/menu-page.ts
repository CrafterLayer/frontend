import type { AiSkillDefinitionV1 } from '../types';
import { INDUSTRY_LOCAL_ACTIONS, INDUSTRY_SHELL, PAGE_INTENTS, industryConflicts } from './shared';

/**
 * Cafés, restaurants, bakeries and sweet shops: the menu IS the page.
 *
 * Every one of the 9 recorded skeletons (2026-09-28) was a café, and each was
 * composed as a software landing page — benefits cards, a how-it-works row —
 * with the menu an afterthought or missing. Keywords list the spellings
 * people type (مقهى / مقهي، قهوة / قهوه); since 2026-09-28 the matcher folds
 * them itself and matches whole words, so the pairs are redundant, not
 * wrong. Words that name something else as often are left out ("menu" is a
 * dropdown, "فرن" an oven as often as a bakery).
 */
export const MENU_PAGE_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.menu-page',
  name: 'Café, restaurant and bakery page',
  description:
    'A food or drink business page built around its menu: dishes with dotted leaders to local-currency prices, the story, hours, map and a WhatsApp order.',
  version: '1.0.2',
  source: 'builtin',
  trust: 'builtin',
  priority: 88,
  activation: {
    mode: 'auto',
    intents: PAGE_INTENTS,
    keywords: [
      'restaurant',
      'cafe',
      'café',
      'coffee shop',
      'coffee house',
      'coffeehouse',
      'roastery',
      'bakery',
      'patisserie',
      'pastry shop',
      'dessert shop',
      'sweets shop',
      'food truck',
      'bistro',
      'shawarma',
      'falafel',
      'pizzeria',
      'juice bar',
      // A three-letter last word takes no endings since 2026-09-28 (keyword-match.ts): plural listed.
      'juice bars',
      'food menu',
      'restaurant menu',
      'menu page',
      'مطعم',
      'مطاعم',
      'مقهى',
      'مقهي',
      'مقاهي',
      'كافيه',
      'كوفي شوب',
      'قهوة',
      'قهوه',
      'مخبز',
      'مخابز',
      'معجنات',
      'حلويات',
      'كنافة',
      'كنافه',
      'بقلاوة',
      'مشاوي',
      'مشويات',
      'شاورما',
      'فلافل',
      'قائمة الطعام',
      'قائمة المشروبات',
      'منيو',
      'عصائر',
      'مندي',
      'فطائر',
    ],
  },
  tags: ['composition', 'food', 'industry', 'menu'],
  dependencies: ['craftkit.copywriting', 'craftkit.visual-direction'],
  conflicts: industryConflicts('craftkit.menu-page'),
  instructions: `A menu page is read on a phone outside the door: what is served, what it costs, when it is open, how to get there. One region per section, in this order, skipping what the request gives no material for:
1 HERO[split], or [overlay] on a strong photo: h1 the place's name or its one dish, a lead p text-pretty on why it is worth the walk, the WhatsApp action to order or reserve and a tel: link; its photo from PHOTOS YOU MAY USE.
2 MENU[menu]: two to four categories as h3, four to eight items each — li > div flex items-baseline gap-3 (span font-semibold + span flex-1 border-b border-dotted border-black/20 + span whitespace-nowrap font-semibold tabular-nums) + p mt-1 text-sm for one ingredient line.
3 THE HOUSE[bento] or STORY[zigzag]: the dish the place is known for, or where its beans and recipes come from, with one photo.
4 REVIEW[quote]: one line that sounds like a regular, with an initials monogram.
5 VISIT[contact]: hours, the map link, WhatsApp and tel:.
${INDUSTRY_SHELL}
${INDUSTRY_LOCAL_ACTIONS}
FACTS: dishes, prices, hours and the address are realistic samples for this trade and city, every one listed in followUp; no calorie counts, no "best in town".`,
  references: {
    'checks/menu.md':
      'Menu present with categories, dotted leaders and prices in the local currency; WhatsApp primary, tel: secondary; hours and a maps link; review carries initials; sample facts listed in followUp; one h1.',
  },
};
