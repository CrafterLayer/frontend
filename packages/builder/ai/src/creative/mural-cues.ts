/*
  Words that pull the second set of mural libraries (2026-10-13) into a creative brief, in English
  and Arabic: perceptual colour (`s.lib.color`: OKLCH gradients, shades, harmonies), L-system
  growth (`s.lib.lsys`: plants, vines, ferns, arabesque scrolls) and geom 1.2's arc rings and
  splines. Each list names what the picture IS, not a mood: "green" or "tree" alone stays out
  ("tree" is also a page tree; a forest platformer needs no L-system).
*/

export const COLOR_CUE_WORDS: readonly string[] = [
  'gradient',
  'gradients',
  'ombre',
  'oklch',
  'colour harmony',
  'color harmony',
  'colour ramp',
  'color ramp',
  'tonal',
  'تدرج',
  'تدرّج',
  'تدرجات',
  'تدرج لوني',
  'تناسق الألوان',
];

export const LSYS_CUE_WORDS: readonly string[] = [
  'l-system',
  'l-systems',
  'lsystem',
  'lindenmayer',
  'botanical',
  'fern',
  'ferns',
  'vine',
  'vines',
  'growing plant',
  'growing plants',
  'growing tree',
  'plant growth',
  'arabesque',
  'rinceau',
  'نباتية',
  'سرخس',
  'كرمة',
  'نبتة تنمو',
  'نباتات تنمو',
  'أرابيسك',
  'أرابسك',
];

export const RING_CUE_WORDS: readonly string[] = [
  'concentric',
  'astrolabe',
  'arc rings',
  'rings of arcs',
  'spline',
  'splines',
  'متحدة المركز',
  'أسطرلاب',
];

/*
  Mural stories (2026-10-14). The owner: a mural («جدارية») is often an illustrated story — «قصص
  جدارية», a wide painted panorama of people or animals, places and things that tells a story as
  it animates or as the visitor scrolls — not a field of abstract patterns. A mural that names a
  story (or an illustrated mural) is briefed as that form: vignettes in depth, a cast on anim rigs,
  one anim timeline of beats, scroll scrubbing, and no UI of its own.
*/
export const MURAL_STORY_WORDS: readonly string[] = [
  'mural story',
  'mural stories',
  'story mural',
  'story murals',
  'illustrated mural',
  'illustrated murals',
  'قصة جدارية',
  'قصص جدارية',
  'جدارية تحكي',
  'جدارية قصصية',
  'جداريات قصصية',
];

/** A mural that also says "story" in so many words («جدارية … قصة»). */
export const STORY_CUE_WORDS: readonly string[] = [
  'story',
  'stories',
  'tale',
  'tells',
  'telling',
  'قصة',
  'قصص',
  'حكاية',
  'حكايات',
  'تحكي',
];

export const MURAL_STORY_MECHANICS: readonly string[] = [
  'an illustrated mural story, not abstract patterns: people, animals, places and things as readable silhouettes in far/mid/near depth layers, lit from one side, a 3-5 colour palette',
  'one s.lib.anim timeline with a label per beat (3-5) moves the cast (anim.rig walk/idle at their stride pace), relights the layers and pans the camera across a wide panorama; it loops',
  'scroll scrubbing when asked: a paused timeline driven by tl.progress(s.scroll.progress)',
  'no UI of its own: no buttons, captions or dialogue boxes; the still frame (editor, reduced motion) is its strongest beat',
  'a ready mural story only when the request clearly is one: scene.preset desert-caravan | fishing-village | seed-to-forest | souq-morning',
];

/** The beats of a mural story, in the brief's language. */
export function muralStoryBeats(arabic: boolean): readonly { id: string; purpose: string }[] {
  return [
    {
      id: 'establish',
      purpose: arabic
        ? 'المكان والشخصيات في لحظة من اليوم'
        : 'the place and its cast at one time of day',
    },
    {
      id: 'journey',
      purpose: arabic
        ? 'رحلة أو تغيّر تتبعه الكاميرا عبر البانوراما'
        : 'a journey or change the camera follows across the panorama',
    },
    {
      id: 'turn',
      purpose: arabic ? 'تحوّل: ضوء جديد أو حدث صغير' : 'a turn: new light or a small event',
    },
    {
      id: 'arrive',
      purpose: arabic
        ? 'وصول ولوحة ختامية هادئة ثم تعود الحلقة'
        : 'an arrival and a calm closing tableau, then the loop',
    },
  ];
}
