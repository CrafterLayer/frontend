import type { CreativeKind } from './creative-brief-types';

/*
  The accessibility lines of a creative brief (creative agent, 2026-10-12; split from the planner
  2026-10-14). A game or a story keeps its objective, controls and text in the DOM. A mural is the
  art itself: the owner found every mural shipping an explanation card with Next / Restart
  buttons, briefed by the game-and-story lines, so a scene gets its own.
*/
const SCENE_ACCESSIBILITY_EN = [
  'the canvas is decoration (aria-hidden) or role=img with a short label; the section heading and copy carry the meaning',
  'no controls, buttons, dialogue box, caption card, chapter navigation or status line unless the person asked for them',
  'reduced motion: a finished still frame, no shake/flash',
];

const SCENE_ACCESSIBILITY_AR = [
  'اللوحة زخرفة (aria-hidden) أو role=img مع وصف قصير؛ عنوان القسم ونصه يحملان المعنى',
  'لا أزرار ولا تحكم ولا صندوق حوار ولا بطاقة شرح ولا تنقل بين فصول ولا سطر حالة إلا إذا طلبها الشخص',
  'تقليل الحركة: إطار ثابت مكتمل بلا اهتزاز أو وميض',
];

const ACCESSIBILITY_EN = [
  'objective, controls and story text live in the DOM; the canvas is decoration or role=img with a label',
  'keyboard and touch controls with visible focus; number keys pick dialogue choices',
  'reduced motion: a finished still frame, manual navigation, no shake/flash/particles',
  'status changes announced politely, never every frame',
];

const ACCESSIBILITY_AR = [
  'الهدف والتحكم ونص القصة في DOM؛ اللوحة زخرفة أو role=img مع وصف',
  'تحكم بلوحة المفاتيح واللمس مع تركيز ظاهر؛ أزرار الأرقام تختار خيارات الحوار',
  'تقليل الحركة: إطار ثابت مكتمل وتنقل يدوي بلا اهتزاز أو وميض أو جسيمات',
  'إعلان التغيرات بهدوء وليس في كل إطار',
];

/** The brief's accessibility lines for a kind of piece, in the brief's language. */
export function accessibilityFor(kind: CreativeKind, arabic: boolean): readonly string[] {
  if (kind === 'scene') return arabic ? SCENE_ACCESSIBILITY_AR : SCENE_ACCESSIBILITY_EN;
  return arabic ? ACCESSIBILITY_AR : ACCESSIBILITY_EN;
}
