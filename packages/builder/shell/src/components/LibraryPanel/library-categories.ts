import { ELEMENT_RECIPE_IDS } from '@craftkit/builder-schema';

export const ELEMENT_CATEGORIES = {
  all: { en: 'All elements', ar: 'كل العناصر' },
  basic: { en: 'Text & essentials', ar: 'النصوص والأساسيات' },
  layout: { en: 'Layout & containers', ar: 'التخطيط والحاويات' },
  professional: { en: 'Ready-made patterns', ar: 'عناصر مركّبة جاهزة' },
  media: { en: 'Images & media', ar: 'الصور والوسائط' },
  interactive: { en: 'Forms & interaction', ar: 'النماذج والتفاعل' },
  motion: { en: 'Motion & effects', ar: 'الحركة والمؤثرات' },
} as const;

export function elementCategory(id: string): Exclude<keyof typeof ELEMENT_CATEGORIES, 'all'> {
  if ((ELEMENT_RECIPE_IDS as readonly string[]).includes(id)) return 'professional';
  if (['container', 'columns', 'grid', 'card', 'spacer', 'divider'].includes(id)) return 'layout';
  if (['form', 'input', 'accordion', 'tabs', 'pricing-toggle', 'compare'].includes(id))
    return 'interactive';
  if (/^(?:scene-|animated-|scroll-reveal-)/u.test(id)) return 'motion';
  if (/^(?:image|video|gallery-|bg-video|map)/u.test(id)) return 'media';
  return 'basic';
}
