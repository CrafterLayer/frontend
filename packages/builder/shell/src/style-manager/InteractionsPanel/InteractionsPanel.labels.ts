import type { CustomCodeMotionEase, CustomCodeMotionTrigger } from '@craftkit/builder-schema';

import {
  MOTION_PRESET_GRID_LABELS_AR,
  MOTION_PRESET_GRID_LABELS_EN,
  type MotionPresetGridLabels,
} from '../controls/MotionPresetGrid';

export interface InteractionsPanelLabels {
  readonly panel: string;
  readonly trigger: string;
  readonly triggers: Readonly<Record<CustomCodeMotionTrigger, string>>;
  readonly animation: string;
  readonly hover: string;
  readonly speed: string;
  readonly speeds: Readonly<Record<'slow' | 'normal' | 'fast', string>>;
  readonly delay: string;
  /** "240 ms" for step 3. */
  readonly delayStep: (step: number) => string;
  readonly ease: string;
  readonly eases: Readonly<Record<CustomCodeMotionEase, string>>;
  readonly distance: string;
  readonly stagger: string;
  readonly sizes: Readonly<Record<'sm' | 'md' | 'lg', string>>;
  readonly once: string;
  readonly target: string;
  readonly targetSelf: string;
  readonly preview: string;
  readonly remove: string;
  readonly params: string;
  readonly paramsNeedAnimation: string;
  readonly updated: (what: string) => string;
  readonly removed: string;
  readonly grid: MotionPresetGridLabels;
}

export const INTERACTIONS_PANEL_LABELS_EN: InteractionsPanelLabels = {
  panel: 'Interactions',
  trigger: 'Plays',
  triggers: {
    view: 'On view',
    load: 'On load',
    hover: 'On hover',
    click: 'On click',
    scroll: 'While scrolling',
  },
  animation: 'Animation',
  hover: 'Hover effect',
  speed: 'Speed',
  speeds: { slow: 'Slow', normal: 'Normal', fast: 'Fast' },
  delay: 'Delay',
  delayStep: (step) => `${String(step * 80)} ms`,
  ease: 'Easing',
  eases: {
    standard: 'Standard',
    emphasized: 'Emphasised',
    spring: 'Spring',
    bounce: 'Bounce',
    linear: 'Linear',
  },
  distance: 'Distance',
  stagger: 'Stagger children',
  sizes: { sm: 'Small', md: 'Medium', lg: 'Large' },
  once: 'Play once',
  target: 'Plays on',
  targetSelf: 'This element',
  preview: 'Preview',
  remove: 'Remove animation',
  params: 'Timing',
  paramsNeedAnimation: 'Choose an animation or a hover effect to tune it.',
  updated: (what) => `${what} updated`,
  removed: 'Animation removed',
  grid: MOTION_PRESET_GRID_LABELS_EN,
};

export const INTERACTIONS_PANEL_LABELS_AR: InteractionsPanelLabels = {
  panel: 'التفاعلات',
  trigger: 'يعمل',
  triggers: {
    view: 'عند الظهور',
    load: 'عند التحميل',
    hover: 'عند المرور',
    click: 'عند النقر',
    scroll: 'أثناء التمرير',
  },
  animation: 'الحركة',
  hover: 'تأثير التمرير',
  speed: 'السرعة',
  speeds: { slow: 'بطيئة', normal: 'عادية', fast: 'سريعة' },
  delay: 'التأخير',
  delayStep: (step) => `${String(step * 80)} ملّي ثانية`,
  ease: 'منحنى الحركة',
  eases: {
    standard: 'قياسي',
    emphasized: 'مؤكَّد',
    spring: 'نابض',
    bounce: 'ارتداد',
    linear: 'خطي',
  },
  distance: 'المسافة',
  stagger: 'تتابع العناصر الأبناء',
  sizes: { sm: 'صغيرة', md: 'متوسطة', lg: 'كبيرة' },
  once: 'مرة واحدة',
  target: 'يعمل على',
  targetSelf: 'هذا العنصر',
  preview: 'معاينة',
  remove: 'إزالة الحركة',
  params: 'التوقيت',
  paramsNeedAnimation: 'اختر حركة أو تأثير تمرير لضبطه.',
  updated: (what) => `تم تحديث ${what}`,
  removed: 'أُزيلت الحركة',
  grid: MOTION_PRESET_GRID_LABELS_AR,
};
