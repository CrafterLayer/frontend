import type { AiSkillDefinitionV1 } from '../types';

/*
  The page planner's creative skill (creative power, 2026-10-12). A plan for a game, a story or
  a mural was planned like a business page: hero, features, testimonials, a pricing band. And
  only the hero's writer reads the person's request — every other writer sees its own title and
  purpose — so a chapter band whose purpose did not name its experience was built as a plain
  text band, and one that did lost the cast. This skill gives the planner the SHAPE of each kind
  of piece and makes every scene section's purpose carry what its writer needs.

  Explicit: the selection lane names it for the page plan only (`pixiSkillIdsFor(…, 'page-plan')`),
  never for a section writer. No dependency: the planner writes no scene code.
*/

export const PIXI_PAGE_SHAPES_ID = 'craftkit.pixi-page-shapes';

export const PIXI_PAGE_SHAPES_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: PIXI_PAGE_SHAPES_ID,
  name: 'Creative page shapes: games, stories, murals and bedtime',
  description:
    'How a page plan lays out a game, an illustrated story, a mural or a bedtime story: the scene first, then the sections that serve it.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  activation: { mode: 'explicit' },
  tags: ['pixi', 'creative', 'planning', 'page-plan'],
  instructions: `A CREATIVE PAGE IS THE PIECE, NOT A BROCHURE: every section serves the game, story or mural; no pricing, testimonials, team, logos or invented business facts unless asked.
WRITERS ARE BLIND: only the hero's writer reads the request; every other writer sees its own title and purpose. So each SCENE section's purpose names its experience in plain words — "playable game", "interactive story chapter scene", "mural", "scroll mural" (Arabic: «لعبة تفاعلية»، «مشاهد قصصية»، «قصة تفاعلية»، «جدارية») — plus the cast by name, the place, the palette and that section's beat. A TEXT section (how to play, credits, a note) names none of those words, so it stays a light kit section.
GAME: the hero IS the game — objective, controls and status in its purpose. Then one band "How to play": goal, keys and touch, scoring, how to win or lose. Optional: a levels or characters band. Close with a cta "Play again" back to the hero. primaryCta: Play → #<hero anchor>.
STORY: the hero is the cover — title, hero character, the world, "start reading". Then 2-5 bands, ONE chapter scene each, in reading order, every one sharing the cover's cast, palette and setting ("Chapter 2 — interactive story chapter scene: Layla the fox crosses the moonlit river"); the last chapter is the ending with replay. primaryCta: Start the story → the first chapter.
MURAL: the hero is the scene (a mural, or a scroll mural for a journey); then one or two short bands of supporting copy — what it shows, the motif, credits. Never a gallery of invented works.
BEDTIME: a story for sleep — 3-4 short chapter scenes, a soft dark palette, calm motion, a read-aloud toggle on each chapter, the last one says goodnight. No game, no countdown, no bright sales band.
Header and footer stay small or absent; nav, when present, lists the chapters or "Play" and "How to play". Arabic requests: every title, purpose and label in Arabic. seo.pageKind: a game or mural → landing; a story or bedtime story → article; no businessType.`,
};
