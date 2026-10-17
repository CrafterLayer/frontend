import type { Bilingual, ScriptKind, ScriptParamGroup, ScriptTier } from './types';

/**
 * Bilingual labels for the Studio's vocabulary (pixi-studio DESIGN.md §A.1, §A.5).
 *
 * Tags are stored as kebab KEYS on entries and shown through this table, so a
 * library saved in an Arabic session reads in English and the other way round.
 * An unknown tag still shows: as its key.
 */
export const STUDIO_TAG_LABELS: Readonly<Record<string, Bilingual>> = {
  generative: { en: 'Generative', ar: 'توليدي' },
  arabic: { en: 'Arabic', ar: 'عربي' },
  islamic: { en: 'Islamic pattern', ar: 'زخرفة إسلامية' },
  geometric: { en: 'Geometric', ar: 'هندسي' },
  organic: { en: 'Organic', ar: 'عضوي' },
  interactive: { en: 'Interactive', ar: 'تفاعلي' },
  cursor: { en: 'Cursor', ar: 'المؤشر' },
  scroll: { en: 'Scroll', ar: 'التمرير' },
  particles: { en: 'Particles', ar: 'جسيمات' },
  physics: { en: 'Physics', ar: 'فيزياء' },
  photo: { en: 'Photo', ar: 'صورة' },
  audio: { en: 'Audio', ar: 'صوت' },
  'audio-reactive': { en: 'Audio-reactive', ar: 'يتفاعل مع الصوت' },
  light: { en: 'Light', ar: 'ضوء' },
  glow: { en: 'Glow', ar: 'توهج' },
  text: { en: 'Text', ar: 'نص' },
  calligraphy: { en: 'Calligraphy', ar: 'خط عربي' },
  typography: { en: 'Typography', ar: 'طباعة' },
  calm: { en: 'Calm', ar: 'هادئ' },
  bold: { en: 'Bold', ar: 'جريء' },
  playful: { en: 'Playful', ar: 'مرح' },
  elegant: { en: 'Elegant', ar: 'أنيق' },
  minimal: { en: 'Minimal', ar: 'بسيط' },
  loop: { en: 'Loop', ar: 'حلقة متكررة' },
  hero: { en: 'Hero', ar: 'واجهة رئيسية' },
  background: { en: 'Background', ar: 'خلفية' },
  mural: { en: 'Mural', ar: 'جدارية' },
  pattern: { en: 'Pattern', ar: 'نقش' },
  texture: { en: 'Texture', ar: 'ملمس' },
  noise: { en: 'Noise', ar: 'ضجيج' },
  flow: { en: 'Flow', ar: 'انسياب' },
  water: { en: 'Water', ar: 'ماء' },
  fire: { en: 'Fire', ar: 'نار' },
  nature: { en: 'Nature', ar: 'طبيعة' },
  space: { en: 'Space', ar: 'فضاء' },
  stars: { en: 'Stars', ar: 'نجوم' },
  gallery: { en: 'Gallery', ar: 'معرض' },
  transition: { en: 'Transition', ar: 'انتقال' },
  celebration: { en: 'Celebration', ar: 'احتفال' },
  glitch: { en: 'Glitch', ar: 'تشويش' },
  retro: { en: 'Retro', ar: 'كلاسيكي' },
  shader: { en: 'Shader', ar: 'مظلل' },
  'hand-drawn': { en: 'Hand-drawn', ar: 'مرسوم باليد' },
  mosaic: { en: 'Mosaic', ar: 'فسيفساء' },
  sfx: { en: 'Sound effect', ar: 'مؤثر صوتي' },
  ambient: { en: 'Ambient', ar: 'أجواء' },
  ui: { en: 'Interface', ar: 'واجهة' },
};

/** The bilingual label of a tag key; an unknown key labels itself. */
export function studioTagLabel(tag: string): Bilingual {
  return Object.hasOwn(STUDIO_TAG_LABELS, tag)
    ? (STUDIO_TAG_LABELS[tag] as Bilingual)
    : { en: tag, ar: tag };
}

/**
 * Labels for the param keys presets and agent scripts share, so an inferred
 * spec (`inferParamSpec`) reads properly in Arabic without anyone writing it.
 */
export const STUDIO_PARAM_LABELS: Readonly<Record<string, Bilingual>> = {
  seed: { en: 'Seed', ar: 'البذرة' },
  speed: { en: 'Speed', ar: 'السرعة' },
  density: { en: 'Density', ar: 'الكثافة' },
  palette: { en: 'Palette', ar: 'لوحة الألوان' },
  color: { en: 'Colour', ar: 'اللون' },
  colour: { en: 'Colour', ar: 'اللون' },
  accent: { en: 'Accent', ar: 'لون التمييز' },
  background: { en: 'Background', ar: 'الخلفية' },
  interactive: { en: 'Interactive', ar: 'تفاعلي' },
  count: { en: 'Count', ar: 'العدد' },
  size: { en: 'Size', ar: 'الحجم' },
  scale: { en: 'Scale', ar: 'المقياس' },
  noiseScale: { en: 'Noise scale', ar: 'مقياس الضجيج' },
  opacity: { en: 'Opacity', ar: 'الشفافية' },
  alpha: { en: 'Opacity', ar: 'الشفافية' },
  glow: { en: 'Glow', ar: 'التوهج' },
  blur: { en: 'Blur', ar: 'التمويه' },
  grain: { en: 'Grain', ar: 'الحبيبات' },
  warp: { en: 'Warp', ar: 'الالتواء' },
  trail: { en: 'Trail', ar: 'الأثر' },
  trailFade: { en: 'Trail fade', ar: 'تلاشي الأثر' },
  particles: { en: 'Particles', ar: 'الجسيمات' },
  radius: { en: 'Radius', ar: 'نصف القطر' },
  gap: { en: 'Gap', ar: 'المسافة' },
  angle: { en: 'Angle', ar: 'الزاوية' },
  rotation: { en: 'Rotation', ar: 'الدوران' },
  fold: { en: 'Symmetry', ar: 'التناظر' },
  text: { en: 'Text', ar: 'النص' },
  words: { en: 'Words', ar: 'الكلمات' },
  image: { en: 'Image', ar: 'الصورة' },
  images: { en: 'Images', ar: 'الصور' },
  sound: { en: 'Sound', ar: 'الصوت' },
  volume: { en: 'Volume', ar: 'مستوى الصوت' },
  gravity: { en: 'Gravity', ar: 'الجاذبية' },
  wind: { en: 'Wind', ar: 'الرياح' },
  intensity: { en: 'Intensity', ar: 'الشدة' },
  strength: { en: 'Strength', ar: 'القوة' },
  duration: { en: 'Duration', ar: 'المدة' },
  delay: { en: 'Delay', ar: 'التأخير' },
  hover: { en: 'Hover', ar: 'التمرير فوق' },
  pointer: { en: 'Pointer', ar: 'المؤشر' },
  lineWidth: { en: 'Line width', ar: 'سماكة الخط' },
  layers: { en: 'Layers', ar: 'الطبقات' },
  detail: { en: 'Detail', ar: 'التفاصيل' },
  contrast: { en: 'Contrast', ar: 'التباين' },
};

export const SCRIPT_KIND_LABELS: Readonly<Record<ScriptKind, Bilingual>> = {
  scene: { en: 'Scene', ar: 'مشهد' },
  interaction: { en: 'Interaction', ar: 'تفاعل' },
  snippet: { en: 'Snippet', ar: 'مقتطف' },
};

export const SCRIPT_TIER_LABELS: Readonly<Record<ScriptTier, Bilingual>> = {
  builtin: { en: 'CraftKit', ar: 'كرافت كيت' },
  project: { en: 'This project', ar: 'هذا المشروع' },
  personal: { en: 'Mine', ar: 'مكتبتي' },
};

export const SCRIPT_PARAM_GROUP_LABELS: Readonly<Record<ScriptParamGroup, Bilingual>> = {
  look: { en: 'Look', ar: 'المظهر' },
  motion: { en: 'Motion', ar: 'الحركة' },
  interaction: { en: 'Interaction', ar: 'التفاعل' },
  sound: { en: 'Sound', ar: 'الصوت' },
};

/** `noiseScale` → `Noise scale`; `trail_fade` → `Trail fade`. */
export function humaniseKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/[_-]+/gu, ' ')
    .trim()
    .toLowerCase();
  return words === '' ? key : words.charAt(0).toUpperCase() + words.slice(1);
}

/** The bilingual label of a param key: the shared table, else the key humanised (ar falls back to the key). */
export function studioParamLabel(key: string): Bilingual {
  if (Object.hasOwn(STUDIO_PARAM_LABELS, key)) return STUDIO_PARAM_LABELS[key] as Bilingual;
  return { en: humaniseKey(key).slice(0, 80), ar: key.slice(0, 80) };
}
