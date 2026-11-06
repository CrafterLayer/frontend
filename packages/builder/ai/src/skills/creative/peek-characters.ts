import type { AiSkillDefinitionV1 } from '../types';

export const PEEK_CHARACTERS_ID = 'craftkit.peek-characters';

/*
  peeking characters (2026-11-05): a small original character whose head rises from behind an
  edge. Words for the motion itself, never a bare "peek": "sneak peek" names a preview section.
  Levantine "بيطل"/"بتطل" sit beside the standard forms; "بطل" (hero) is deliberately absent.
*/
export const PEEK_WORDS = [
  'peeking',
  'peeks',
  'peek over',
  'peeks over',
  'peek out',
  'peeking character',
  'peeking mascot',
  'peekaboo',
  'peek-a-boo',
  'mascot peeking',
  'يطل',
  'تطل',
  'يطلّ',
  'تطلّ',
  'بيطل',
  'بتطل',
  'يختلس النظر',
  'تختلس النظر',
  'يتلصص',
  'مختبئ خلف',
  'مختبئة خلف',
];

/** The SVG head the plain-section route starts from; the writer recolours and reshapes it. */
const PEEK_SVG = `<svg class='peek-head' viewBox='0 0 120 112' width='96' aria-hidden='true'><path d='M14 44 24 4 54 26ZM106 44 96 4 66 26Z' fill='FUR'/><ellipse cx='60' cy='62' rx='54' ry='48' fill='FUR'/><ellipse cx='60' cy='70' rx='44' ry='36' fill='FACE'/><g class='peek-eyes'><ellipse cx='40' cy='62' rx='9' ry='11' fill='EYES'/><ellipse cx='80' cy='62' rx='9' ry='11' fill='EYES'/><circle cx='43' cy='58' r='3.5' fill='#fff'/><circle cx='83' cy='58' r='3.5' fill='#fff'/></g><ellipse cx='28' cy='80' rx='9' ry='5' fill='BLUSH' opacity='.55'/><ellipse cx='92' cy='80' rx='9' ry='5' fill='BLUSH' opacity='.55'/><path d='M54 82q6 6 12 0' stroke='INK' stroke-width='2.5' fill='none' stroke-linecap='round'/></svg>`;

const PEEK_CSS = `.peek-stage{position:relative;height:84px;overflow:hidden}.peek-head{position:absolute;left:var(--x,50%);bottom:-16px;translate:-50% 100%;animation:peek 7s cubic-bezier(.34,1.56,.64,1) infinite}@keyframes peek{0%,10%{translate:-50% 100%}18%,42%{translate:-50% 0}48%,100%{translate:-50% 100%}}.peek-eyes{transform-box:fill-box;transform-origin:center;animation:blink 3.6s infinite}@keyframes blink{0%,45%,49%,100%{scale:1 1}47%{scale:1 .1}}@media (prefers-reduced-motion:reduce){.peek-head{animation:none;translate:-50% 0}.peek-eyes{animation:none}}`;

export const PEEK_CHARACTERS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: PEEK_CHARACTERS_ID,
  name: 'Peeking characters',
  description:
    'A small original character that peeks over an edge (progress bar, card top, dialogue box, chapter line): Pixi anim.peek in scenes, an SVG + CSS head in plain sections.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  activation: { mode: 'auto', keywords: PEEK_WORDS },
  tags: ['character', 'motion', 'pixi', 'story', 'game'],
  instructions: `PEEKING CHARACTER: a small head rises from BEHIND an edge (progress bar, card top, dialogue box, chapter rule, ground line) until ears, eyes and cheeks clear it; the edge cuts it at the chin. Spring up, hold ~1.6 s, duck fast, peek again every 3-10 s; blinks while up. Top or bottom edge only, no frame around it. Invent an ORIGINAL character from data (ears, fur, face, eyes, blush), styled to the page; never a brand mascot or a known cartoon (no GitHub cat, no Duolingo owl).
SCENE (free code on, Pixi story/game/scene): const A=s.lib.anim.create({reducedMotion:s.reducedMotion}); const p=A.peek(s,{x,y,size:110,side:'top'|'bottom',mode:'loop'|'up',reveal:.8,look:'wander'|'pointer',character:{ears:'cat'|'fox'|'bear'|'bunny'|'none',shape:'round'|'wide'|'tall',fur,face,eyes,blush,ink,whiskers,mouth:'smile'|'cat'|'open'}}); s.world.addChild(p.view) BEFORE the edge art so the bar or box draws on top; x,y is the edge's centre. Tick A with s.tick(t=>A.update(t.dt)) only when !s.editor&&!s.reducedMotion; s.dispose(()=>A.dispose()). Still frames show it raised. A cast member can peek: texture: await s.lib.peeps.texture(s,{seed:name}). p.peek() on each new chapter, p.up()/p.down() on win/lose, p.lookAt(x,y) at what matters, p.view.x follows a progress fill.
PLAIN SECTION (no free code): a stage whose bottom IS the edge: div.peek-stage holding ${PEEK_SVG} with FUR/FACE/EYES/BLUSH/INK swapped for the palette and the ears path reshaped (round bear ears: two circles; long bunny ears: two ellipses), then the bar/card right after the stage. Region css: ${PEEK_CSS} Set --x to place it (a progress bar: --x equal to the fill). Decorative: aria-hidden, the progress itself stays text or a real progressbar.`,
};
