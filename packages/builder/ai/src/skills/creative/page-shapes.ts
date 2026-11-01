import type { AiSkillDefinitionV1 } from '../types';

/*
  The page planner's creative skill (creative power, 2026-10-12). A plan for a game, a story or
  a mural was planned like a business page: hero, features, testimonials, a pricing band. And
  only the hero's writer reads the person's request — every other writer sees its own title and
  purpose — so a chapter band whose purpose did not name its experience was built as a plain
  text band, and one that did lost the cast. This skill gives the planner the SHAPE of each kind
  of piece and makes every scene section's purpose carry what its writer needs.

  2026-11-01 (the owner: every game and mural came out in the same shape, "fixed in the code"):
  no fixed outline per kind any more. The planner is told to invent the structure of THIS piece,
  shown contrasting examples per kind to depart from, and to give the piece its own palette and
  faces instead of a trade's deck row. Every scene section's writer now reads the request too
  (`creativeRequestOf`); a text section still sees only its own title and purpose.

  Explicit: the selection lane names it for the page plan only (`pixiSkillIdsFor(…, 'page-plan')`),
  never for a section writer. No dependency: the planner writes no scene code.
*/

export const PIXI_PAGE_SHAPES_ID = 'craftkit.pixi-page-shapes';

export const PIXI_PAGE_SHAPES_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: PIXI_PAGE_SHAPES_ID,
  name: 'Creative page shapes: games, stories, murals and bedtime',
  description:
    'How a page plan finds the structure of a game, an illustrated story, a mural or a bedtime story: its own outline and look, scene sections named so their writers build scenes.',
  version: '1.1.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  activation: { mode: 'explicit' },
  tags: ['pixi', 'creative', 'planning', 'page-plan'],
  instructions: `A CREATIVE PAGE IS THE PIECE, NOT A BROCHURE: every section serves the game, story or mural; no pricing, testimonials, team, logos or invented business facts unless asked.
NO TEMPLATE: invent the structure THIS piece needs — how many sections, which one leads, where each scene sits and how big, what text it needs and in what order — from its subject, cast, mood and pace. The shapes below are contrasting examples to depart from, never an outline to fill; one outline reused for every game, story or mural is the failure to avoid.
SCENE OR TEXT, BY ITS OWN WORDS: the hero's and every scene section's writer read the request; a text section's writer sees only its own title and purpose. A section is a scene only when its own title or purpose names its experience in plain words — "playable game", "interactive story chapter scene", "mural", "scroll mural" (Arabic: «لعبة تفاعلية»، «مشاهد قصصية»، «قصة تفاعلية»، «جدارية») — so each SCENE section's purpose names one, plus the cast by name, the place, the palette and that section's beat. A TEXT section (how to play, credits, a note) names none of those words, so it stays a light text section.
GAME, e.g.: one full-bleed stage with the title set over it and nothing else; a split stage, rules and score beside it; levels or worlds as successive stage bands, each its own beat; a short story intro, then the game. The game section's purpose carries objective, controls and status; a How to play band, a characters band or a Play again cta only when this game needs one. primaryCta: Play → the game's anchor.
STORY, e.g.: one long scroll scene that is the whole tale; a cover, then 2-5 chapter scene bands in reading order sharing one cast, palette and setting ("Chapter 2 — interactive story chapter scene: Layla the fox crosses the moonlit river"); one picture-book scene that turns its own pages. The ending offers replay. primaryCta: Start the story → where it starts.
MURAL, e.g.: one panorama with the title set into it; a tall scroll mural that is the journey; a mural behind the page's few lines of copy; two contrasting murals (dawn and night) with a line between. Never a gallery of invented works.
BEDTIME: a story for sleep — short chapter scenes, a soft dark palette, calm motion, a read-aloud toggle on each chapter, the last one says goodnight. No game, no countdown, no bright sales band.
ITS OWN LOOK: write the tokens in full — a palette from the piece's world and mood, display and body faces from the verified list that suit it — and name no deckRowId: the deck's rows are trades (cafe … farm) and would dress the piece as a business.
Header, footer and nav only when the piece wants them, small; nav lists its chapters, levels or Play. Arabic requests: every title, purpose and label in Arabic. seo.pageKind: a game or mural → landing; a story or bedtime story → article; no businessType.`,
};
