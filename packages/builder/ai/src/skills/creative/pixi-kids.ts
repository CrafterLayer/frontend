import type { AiSkillDefinitionV1 } from '../types';

export const PIXI_KIDS_ID = 'craftkit.pixi-kids';

/*
  children's stories and drawings (2026-11-05). A colouring book is a creative piece by itself, so
  its words activate the playbook; "kids" alone never does ("a kids' clothing store" is a shop).
  Inside a story, game or scene the broader words below bring it as a cue (pixi-selection.ts).
*/
export const PIXI_KIDS_KEYWORDS = [
  'coloring book',
  'colouring book',
  'coloring page',
  'colouring page',
  'coloring pages',
  'colouring pages',
  'كتاب تلوين',
  'صفحة تلوين',
  'صفحات تلوين',
  'لعبة تلوين',
  'رسومات للتلوين',
] as const;

/** Words that bring the kids' playbook once a piece is already a story, game or scene. */
export const PIXI_KIDS_CUE_WORDS = [
  'kids',
  'children',
  "children's",
  'toddler',
  'preschool',
  'kindergarten',
  'animals',
  'zoo',
  'farm animals',
  'stickers',
  'emoji',
  'coloring',
  'colouring',
  'أطفال',
  'اطفال',
  'للأطفال',
  'للاطفال',
  'صغار',
  'روضة',
  'حضانة',
  'حيوانات',
  'حديقة الحيوان',
  'مزرعة',
  'ملصقات',
  'ستيكرات',
  'تلوين',
  // original characters (2026-11-05): an invented creature in any story or game.
  'dragon',
  'unicorn',
  'monster',
  'creature',
  'dinosaur',
  'imaginary character',
  'fantasy character',
  'تنين',
  'يونيكورن',
  'وحش',
  'مخلوق',
  'كائن خيالي',
  'شخصية خيالية',
  'شخصيات خيالية',
  'ديناصور',
] as const;

export const PIXI_KIDS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: PIXI_KIDS_ID,
  name: "Pixi: children's stories, animals and colouring",
  description:
    'Original invented characters, bundled picture vocabulary (Fluent stickers), a cast of cute animals, colouring pages and storybook layout for children aged 3-9.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: { mode: 'auto', keywords: [...PIXI_KIDS_KEYWORDS] },
  tags: ['pixi', 'kids', 'story', 'drawing', 'accessibility'],
  instructions: `FOR CHILDREN 3-9: short sentences (one idea per page), warm and safe (no fear, violence or brands), bright palette with dark text on light, tap targets 64 px or more, one action per screen, praise on success and a gentle retry, read-aloud (speechSynthesis in the page language, the existing story voice button), Arabic RTL first when the person writes Arabic.
LIBS (list them in ck.scene({libs:[…]}); all art is bundled, never fetch an image): 'stickers' — s.lib.stickers.find('دب'|'bear') → name; await s.lib.stickers.texture(s,name,{size}) for props, food, weather, scenery; svg(name), lineArt(name) an outlined colouring version; search(word,limit). 'animals' — a consistent cast of 29 cute round animal heads (bear, panda, penguin, owl, rabbit, elephant, giraffe, monkey, cow, duck, frog, whale…; no camel, sheep or cat: use a sticker or draw it): s.lib.animals.find('باندا'|'panda'), await s.lib.animals.sprite(s,name,{size,x,y}) or texture(s,name) as an anim.rig head or anim.peek({texture}) face (libs:['animals','anim']). 'layout' — storybook spreads: const r=s.lib.layout.page(W,H,{picture:'auto'|'top'|'left'|'right'|'full',rtl:s.rtl}) → r.picture / r.text rects; layout.flex(container,{direction,gap,justify,align,wrap,rtl}); layout.fit(sprite,box,'contain'|'cover'); layout.grid(children,{columns,gap}).
COLOURING (libs:['paint','stickers']): const page=await s.lib.paint.page(s,{art:s.lib.stickers.lineArt('teddy-bear'),width:W,height:H,palette:'bright'}); s.world.addChild(page.view); tools fill|brush|eraser, page.color, undo/redo/clear, page.toDataURL() for "save my picture". Tree buttons: data-paint-color='#ff595e' (each with an aria-label colour name), data-paint-tool=fill|brush|eraser, data-paint-action=undo|redo|clear; wire them with s.lib.paint.swatches(ck.root,page,palette) and s.dispose(()=>page.dispose()). Offer several pages (a row of sticker thumbnails to pick from).
CHARACTERS (libs:['creatures','anim']): invent ORIGINAL characters from the story, never a known character, brand or pig. Pick the closest kind from the story's noun ('a shy little dragon called Zahra who loves stars' → {kind:'dragon',name:'Zahra',mood:'shy',pattern:'stars'}); kinds dragon unicorn monster dino robot alien ghost slime griffin fox bunny bear star mushroom sea. ALWAYS pass the name: the same name gives the same look and colours on every page, so reuse it. Story colours go in palette as kid words or hex ({body:'mint'}), the rest is derived; add at most 1-2 parts or accessories the story mentions (wings, crown, scarf, glasses; s.lib.creatures.parts lists them). const a=s.lib.anim.create({reducedMotion:s.reducedMotion}); const c=s.lib.creatures.create(s,def,{size:220,x,y,animator:a}) (feet at x,y, added to s.world); c.rig(a,{state:'walk'|'jump'|'wave'|'talk'|'celebrate'}); feelings change with c.face.set('happy'|'calm'|'surprised'|'sad'|'sleepy'|'excited'|'shy'|'grumpy'), not a new character; tick a with s.tick(t=>a.update(t.dt)) only when !s.editor&&!s.reducedMotion; s.dispose(()=>{c.dispose();a.dispose()}). A still portrait inside the scene: await s.lib.creatures.texture(s,def,{size,mood}).
STORY PAGES: picture from stickers/animals laid out with layout.page, text in the DOM tree (data-story-copy), big next/back buttons; a friendly animal can peek over the text box (anim.peek with an animals texture).`,
};
