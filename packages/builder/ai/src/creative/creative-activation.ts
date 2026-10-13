/*
  Which of the planner's genre words may ACTIVATE a creative playbook (creative power, 2026-10-12).

  The planner reads GENRES inside a brief that is already creative, so a bare "story", "لعبة" or
  "حكاية" is a fine genre cue there. Activation reads every request a builder sees — a café's
  "our story", a game store, «حكايتنا» on an about page — so a word activates only when it means
  "make a playable or illustrated piece" on its own. Before this file the two lists were written
  by hand and disagreed: "bedtime story", "picture book" and "fairy tale" planned a picture book
  but loaded no playbook. Now the playbooks' words are DERIVED from GENRES minus the broad words
  below, so a genre phrase added to the planner activates its playbook without a second edit.

  Data only; `skills/creative/pixi-creative.ts` and the selection lane read it.
*/

import type { CreativeKind } from './creative-brief-types';
import { GENRES } from './creative-genres';

/**
 * Genre words a business page uses too. Each still steers the planner's genre once a piece is
 * creative; none activates a playbook alone. Every entry must be a GENRES keyword (a test holds
 * it), so this list cannot rot into words nothing reads.
 */
export const BROAD_GENRE_KEYWORDS: readonly string[] = [
  // "our story", «قصتنا», «حكايتنا»: about pages. «حكاية» is also a brand name.
  'story',
  'قصة',
  'حكاية',
  'حكايات',
  // A shop, a studio, a car dealer, a coworking "space", a loyalty "collect".
  'game',
  'لعبة',
  'ألعاب',
  'arcade',
  'runner',
  'endless',
  'shooter',
  'racing',
  'collect',
  'سباق',
  'سيارات',
  'فضاء',
  'جمع',
  // «منصات التواصل» (social platforms), a pizzeria called Mario, travel «مغامرات», «كنز» brands.
  'منصات',
  'ماريو',
  'مغامرات',
  'كنز',
  'maze',
  'top down',
  'top-down',
  'rpg',
  // Contact forms, pricing "options", chat widgets, git branching.
  'branching',
  'dialogue',
  'dialog',
  'conversation',
  'خيارات',
  'اختيارات',
  'حوار',
  'حوارات',
  'محادثة',
  // Kids' clothing, a nursery, a summer camp; «عروض خرافية» is "fabulous offers";
  // «أذكار قبل النوم» and night creams are bedtime words with no story in them.
  'for kids',
  'for children',
  'للأطفال',
  'قبل النوم',
  'خرافية',
  // A physics tutor, a bounce house, a tech stack, «معدل الارتداد» (bounce rate), a pinball bar.
  'physics',
  'bounce',
  'stack',
  'catapult',
  'pinball',
  'فيزياء',
  'ارتداد',
  'مقلاع',
  // A jigsaw shop, an escape room, «مطابقة المواصفات» (compliance).
  'puzzle',
  'لغز',
  'ألغاز',
  'مطابقة',
  // Any page section; the motion skill owns animated backgrounds.
  'scene',
  'مشهد',
  'animated background',
];

const BROAD = new Set(BROAD_GENRE_KEYWORDS);

/** The GENRES keywords of one kind (or all) that activate a playbook on their own. */
export function specificGenreKeywords(kind?: CreativeKind): readonly string[] {
  const words = GENRES.filter((rule) => kind === undefined || rule.kind === kind).flatMap(
    (rule) => rule.keywords,
  );
  return [...new Set(words)].filter((word) => !BROAD.has(word));
}

/*
  A story asked for at bedtime, in any order: "a story about a sleepy bunny before bed",
  «اكتب قصة عن أرنب صغير قبل النوم». Neither half activates alone — «قصتنا» is an about page,
  «أذكار قبل النوم» a prayer page — together they are a bedtime story (the selection lane).
*/
export const STORY_WORDS: readonly string[] = [
  'story',
  'stories',
  'tale',
  'tales',
  'قصة',
  'قصص',
  'حكاية',
  'حكايات',
  'حدوتة',
  'حواديت',
];

export const BEDTIME_WORDS: readonly string[] = [
  'bedtime',
  'before bed',
  'before sleep',
  'goodnight',
  'good night',
  'lullaby',
  'قبل النوم',
  'وقت النوم',
  'تصبح على خير',
  'تهويدة',
];

/*
  Words that ask a creative piece for physics or a scroll-driven mural. Like GAME_LIB_CUES they
  are too common alone ("physics tutor", "parallax hero") and count only once a game, story or
  mural playbook matched: the lane adds the physics or scroll-mural playbook for them.
*/
export const PHYSICS_CUE_WORDS: readonly string[] = [
  'physics',
  'ragdoll',
  'rigid body',
  'matter js',
  'catapult',
  'slingshot',
  'pinball',
  'stacking',
  'falling blocks',
  'فيزياء',
  'فيزيائية',
  'مقلاع',
  'تكديس',
];

export const SCROLL_CUE_WORDS: readonly string[] = [
  'parallax',
  'scroll',
  'scrolling',
  'scrollytelling',
  'بارالاكس',
  'سكرول',
  // The matcher peels the clitics: this also reads «بالتمرير» and «التمرير».
  'تمرير',
];
