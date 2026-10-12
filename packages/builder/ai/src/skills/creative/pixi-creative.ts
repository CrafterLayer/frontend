import { specificGenreKeywords } from '../../creative/creative-activation';
import type { CreativeKind } from '../../creative/creative-brief-types';
import type { AiSkillDefinitionV1 } from '../types';

/** Deliberate playable requests, not a games shop or a studio's landing page. */
export const PIXI_GAME_KEYWORDS = [
  '2d game',
  'mini game',
  'minigame',
  'platformer',
  'arcade game',
  'playable game',
  'browser game',
  'interactive game',
  'game with',
  'game where',
  'بدي لعبة',
  'اعمل لعبة',
  'اصنع لعبة',
  'ابني لعبة',
  'سوي لعبة',
  'طور لعبة',
  'صمم لعبة',
  'لعبة تفاعلية',
  'لعبة منصات',
  'لعبة سيارات',
  'لعبة جمع',
  'لعبة ثنائية الأبعاد',
  'ألعاب تفاعلية',
  'ألعاب ثنائية الأبعاد',
] as const;

/** No bare "story": business history and ordinary copy do not need a scene. */
export const PIXI_STORY_KEYWORDS = [
  'interactive story',
  'playable story',
  'visual narrative',
  'chapter scene',
  'قصة تفاعلية',
  'قصص تفاعلية',
  'حكاية تفاعلية',
  'حكايات تفاعلية',
  'مشاهد قصصية',
  'قصة بصرية',
] as const;

/** Art-directed scenes: what the mural playbook adds to its genre words. */
export const PIXI_MURAL_KEYWORDS = [
  'mural',
  'generative art',
  'جدارية',
  'جداريات',
  'فن توليدي',
  'رسوم توليدية',
] as const;

/*
  A playbook activates on its hand-written phrases plus every specific GENRES keyword of its kind
  (creative power, 2026-10-12): "bedtime story", "picture book", «حكاية قبل النوم» plan a picture
  book AND load the story playbook; the broad genre words (creative-activation.ts) never do.
*/
function playbookKeywords(own: readonly string[], kind: CreativeKind): readonly string[] {
  return [...new Set([...own, ...specificGenreKeywords(kind)])];
}

/** Companion tree markers are part of each example's contract, not invented canvas UI. */
export const PIXI_GAME_CONTROLS = `<p>Collect three lights, avoid the red obstacle. Use arrows or the movement buttons.</p>
<div role='group' aria-label='Game controls'>
  <button type='button' data-game-action='start'>Start</button>
  <button type='button' data-game-action='pause'>Pause / resume</button>
  <button type='button' data-game-action='restart'>Restart</button>
  <button type='button' data-game-key='ArrowLeft'>Left</button>
  <button type='button' data-game-key='ArrowRight'>Right</button>
  <button type='button' data-game-key='ArrowUp'>Up</button>
  <button type='button' data-game-key='ArrowDown'>Down</button>
</div><output data-game-status role='status' aria-live='polite'></output>`;

export const PIXI_GAME_EXAMPLE = `const s=await ck.scene({seed:7});
const P=s.PIXI,root=ck.root,status=root.querySelector('[data-game-status]');
const hero=new P.Graphics().circle(0,0,10).fill(0x67e8f9);
const goal=new P.Graphics().star(0,0,5,12,6).fill(0xfde68a);
const hazard=new P.Graphics().circle(0,0,16).fill(0xfb7185);
s.stage.addChild(hazard,goal,hero);s.canvas.setAttribute('role','img');s.canvas.setAttribute('aria-label','Game area. Use arrow keys or the movement buttons.');
const goals=[[.72,.3],[.25,.25],[.8,.75]];
let x=.18,y=.78,score=0,seconds=30,mode='ready',last='';
const draw=()=>{hero.position.set(x*s.width,y*s.height);const g=goals[Math.min(score,2)];goal.position.set(g[0]*s.width,g[1]*s.height);goal.visible=mode!=='won';hazard.position.set(s.width*.5,s.height*.5);const text=mode+' · '+score+'/3 · '+Math.ceil(seconds)+'s';if(status&&last!==text){status.textContent=text;last=text}if(s.reducedMotion)s.app.render()};
const reset=()=>{x=.18;y=.78;score=0;seconds=30;s.input.clear();mode='ready';draw()};
const distance=(a,b)=>Math.hypot((x-a)*s.width,(y-b)*s.height);
const step=dt=>{if(mode!=='running')return;let dx=s.input.axis(['ArrowLeft','KeyA'],['ArrowRight','KeyD']),dy=s.input.axis(['ArrowUp','KeyW'],['ArrowDown','KeyS']);const n=Math.max(1,Math.hypot(dx,dy));x=Math.max(.03,Math.min(.97,x+dx/n*dt*.42));y=Math.max(.03,Math.min(.97,y+dy/n*dt*.42));if(!s.reducedMotion)seconds=Math.max(0,seconds-dt);const g=goals[Math.min(score,2)];if(distance(.5,.5)<=26||seconds===0)mode='lost';else if(distance(g[0],g[1])<=22){score++;if(score===3)mode='won'}draw()};
const listen=(el,type,fn)=>{if(el){el.addEventListener(type,fn);s.dispose(()=>el.removeEventListener(type,fn))}};
for(const action of ['start','pause','restart'])listen(root.querySelector('[data-game-action='+action+']'),'click',()=>{if(s.editor)return;if(action==='pause'){if(mode==='running')mode='paused';else if(mode==='paused')mode='running';s.input.clear()}else{reset();mode='running'}if(mode==='running'){s.input.down('ArrowLeft');s.canvas.focus()}draw()});
for(const b of root.querySelectorAll('[data-game-key]')){const code=b.getAttribute('data-game-key');listen(b,'pointerdown',e=>{if(s.editor)return;b.setPointerCapture(e.pointerId);s.input.set(code,true)});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,()=>s.input.set(code,false));listen(b,'click',e=>{if(s.editor)return;if(s.reducedMotion||e.detail===0){s.input.set(code,true);step(.2);s.input.set(code,false)}})}
draw();s.onResize(draw);if(!s.editor&&!s.reducedMotion)s.dispose(s.fixedTick(step,{step:1/60,maxSteps:5}));`;

export const PIXI_STORY_CONTROLS = `<article><h2 data-story-title></h2><p data-story-copy></p>
<div role='group' aria-label='Story navigation'><button type='button' data-story-action='back'>Previous</button>
<button type='button' data-story-action='next'>Next</button><button type='button' data-story-action='reset'>Restart story</button>
<button type='button' data-story-voice aria-pressed='false'>Read aloud</button></div>
<output data-story-status role='status' aria-live='polite'></output></article>`;

export const PIXI_STORY_EXAMPLE = `const s=await ck.scene({seed:11});
const P=s.PIXI,root=ck.root;
const content=[['dawn','Dawn','A traveller discovers a light.',0xfde68a],['crossing','Crossing','The traveller carries it across the valley.',0x67e8f9],['home','Home','The light becomes a beacon for everyone.',0xc4b5fd]];
const layers=content.map(c=>{const layer=new P.Container();const orb=new P.Graphics().circle(0,0,38).fill(c[3]);layer.addChild(orb);layer.visible=false;s.stage.addChild(layer);return layer});
const title=root.querySelector('[data-story-title]'),copy=root.querySelector('[data-story-copy]'),status=root.querySelector('[data-story-status]');
const back=root.querySelector('[data-story-action=back]'),next=root.querySelector('[data-story-action=next]');
const voice=root.querySelector('[data-story-voice]'),speech=globalThis.speechSynthesis;let reading=false;
const speak=i=>{if(!speech||s.editor)return;speech.cancel();if(reading){const u=new SpeechSynthesisUtterance(content[i][1]+'. '+content[i][2]);u.lang=s.lang;u.rate=.9;speech.speak(u)}};
const layout=()=>layers.forEach((layer,i)=>layer.position.set(s.width*(.25+i*.25),s.height*.5));
const show=i=>{layers[i].visible=true;if(title)title.textContent=content[i][1];if(copy)copy.textContent=content[i][2];if(status)status.textContent='Chapter '+(i+1)+' of 3';if(back)back.disabled=i===0;if(next)next.disabled=i===2;if(reading)speak(i)};
layout();s.onResize(layout);s.canvas.setAttribute('aria-hidden','true');
const story=s.story(content.map((c,i)=>({id:c[0],enter:()=>show(i),leave:()=>{layers[i].visible=false}})));
for(const action of ['back','next','reset']){const button=root.querySelector('[data-story-action='+action+']');if(button){const fn=()=>{if(!s.editor)story[action]()};button.addEventListener('click',fn);s.dispose(()=>button.removeEventListener('click',fn))}}
if(voice){voice.hidden=!speech;const fn=()=>{if(s.editor)return;reading=!reading;voice.setAttribute('aria-pressed',String(reading));speak(content.findIndex(c=>c[0]===story.current))};voice.addEventListener('click',fn);s.dispose(()=>{voice.removeEventListener('click',fn);speech?.cancel()})}
s.dispose(()=>story.dispose());`;

export const PIXI_MURAL_EXAMPLE = `const s=await ck.scene({seed:23,quality:'auto'});
const P=s.PIXI,bg=new P.Graphics(),bands=new P.Container(),details=new P.Container();
s.stage.addChild(bg,bands,details);s.canvas.setAttribute('aria-hidden','true');
const colors=s.palette.ramp(5);
const ribbons=colors.map(color=>{const g=new P.Graphics();bands.addChild(g);return {g,color,phase:s.rand(0,6)}});
const marks=Array.from({length:s.count(s.editor?24:80)},()=>{const g=new P.Graphics().circle(0,0,s.rand(1,3)).fill(s.palette.accent);g.alpha=s.rand(.1,.4);details.addChild(g);return {g,x:s.random(),y:s.random()}});
const layout=()=>{bg.clear().rect(0,0,s.width,s.height).fill(s.palette.surface);ribbons.forEach(({g,color,phase},i)=>{g.clear().moveTo(0,s.height);for(let x=0;x<=s.width+24;x+=24)g.lineTo(x,s.height*(.35+i*.09)+Math.sin(x/Math.max(1,s.width)*6+phase)*s.height*.06);g.lineTo(s.width,s.height).closePath().fill({color,alpha:.3})});marks.forEach(m=>m.g.position.set(m.x*s.width,m.y*s.height))};
layout();s.onResize(layout);if(!s.editor&&!s.reducedMotion)s.tick(time=>{bands.y=Math.sin(time.t*.35)*s.height*.012;details.x=(s.pointer.nx-.5)*s.width*.008});`;

/** One-line e.g. entries remain compatible with pixiSkillExamples and canonical skill budgets. */
function inlineExample(code: string): string {
  return code.replace(/\n\s*/gu, ' ');
}

export const PIXI_GAME_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-games',
  name: 'Pixi: playable 2D games',
  description: 'Scoped input, fixed-step game state, collisions, mobile controls and restart.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: { mode: 'auto', keywords: playbookKeywords(PIXI_GAME_KEYWORDS, 'game') },
  tags: ['pixi', 'game', 'interaction'],
  instructions: `PLAYABLE, not a decorative hero: define objective, controls and ready/running/paused/won/lost; make restart reset score, clock, bodies and input. No fake multiplayer, save server or authentication.
FREE CODE OFF: closed media.add only; explain the opt-in. ON: await ck.scene, one v8 namespace, no imports/CDN/new Application. Put instructions, status, labelled start/pause/restart/direction buttons and any dialogue lines (s.lib.dialogue.fromDom) in the tree; scope queries to ck.root. Match the user's language; expose status changes politely, not every frame.
INPUT: s.input.down(code), axis(negativeCodes,positiveCodes), set(code,held), clear(). Keyboard is focused-scene only; never install window key handlers or capture editor typing. Virtual buttons must release on pointerup/cancel/lostcapture and support keyboard clicks. Use seconds in s.fixedTick(fn,{step:1/60,maxSteps:5}); unsubscribe via s.dispose. It does not simulate in editor/reduced motion: draw a finished frame and offer manual steps there.
Use normalized positions with pixel-space collision radii matching the rendered shapes; resize layout. Existing libs:['physics'] exposes s.lib.physics (Matter): Engine.update(engine,dt*1000), not Runner.run. libs:['viewport'] exposes s.lib.viewport.Viewport; release viewport/plugins. Audio only via audio:true and s.sound after a gesture, with mute. Limit entities, no frame allocations.
Example tree: data-game-action=start/pause/restart, data-game-key=ArrowLeft/ArrowRight/ArrowUp/ArrowDown and output[data-game-status]; include an accessible objective.
e.g. collect three lights: ${inlineExample(PIXI_GAME_EXAMPLE)}`,
};

export const PIXI_STORY_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-stories',
  name: 'Pixi: interactive chapter stories',
  description: 'Explicit chapters, composed scene layers, accessible navigation and replay.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: { mode: 'auto', keywords: playbookKeywords(PIXI_STORY_KEYWORDS, 'story') },
  tags: ['pixi', 'story', 'accessibility'],
  instructions: `STORY, not business-history copy: a beginning, discovery, meaningful choice or chapter progression, and an ending. Give each scene a foreground/midground/background, strong focal point and intentional palette. Keep narrative, headings, controls and dialogue lines (s.lib.dialogue.fromDom) in the DOM; translate all copy and labels to the brief, Arabic shaping stays whole.
Free code OFF means closed media.add only plus explain opt-in. ON use await ck.scene; no arbitrary packages/CDN or new Application. s.story([{id,enter,leave}],initial?) enters the first/initial chapter once. current reads the id; go(id), next(), back(), reset() return booleans; no wrapping or autoplay. Unique bounded ids, lightweight enter/leave; dispose ends the active chapter. Reuse containers, toggle visible, reset chapter-owned input/effects; never recreate a scene per click.
Use native previous/next/replay buttons, disabled boundaries, a polite chapter status and visible focus. No forced scroll, auto-advancing narration or flashing; reduced motion preserves manual navigation and a finished frame. Prefer s.tick/onResize/s.dispose for transitions and listeners. Use given image URLs via s.texture with fallback; optional sound requires audio:true, gesture unlock and mute, never fabricate a voice asset. Story content is not a hidden canvas-only experience.
BEDTIME (bedtime story, picture book, lullaby): calm pacing — one short idea per page, slow fades (about a second) or none, a soft night palette that still meets contrast, no flash, shake, sudden sound, timer or auto-advance; the last page says goodnight. READ ALOUD is optional and visible: a button[data-story-voice] with aria-pressed toggles speechSynthesis reading the current page's title and text (u.lang=s.lang, rate about .9); speak only after that press, cancel on every page change, toggle-off and dispose, hide the button where speechSynthesis is missing.
Example tree: h2[data-story-title], p[data-story-copy], output[data-story-status], buttons data-story-action=back/next/reset and button[data-story-voice] aria-pressed=false.
e.g. traveller's three chapters: ${inlineExample(PIXI_STORY_EXAMPLE)}`,
};

export const PIXI_MURAL_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-murals',
  name: 'Pixi: art-directed layered murals',
  description:
    'Seeded composition, depth, typography and quality budgets instead of generic particles.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: { mode: 'auto', keywords: playbookKeywords(PIXI_MURAL_KEYWORDS, 'scene') },
  tags: ['pixi', 'mural', 'composition'],
  instructions: `ART DIRECTION FIRST: select a specific motif from the brief, one focal area, deliberate negative space for DOM copy, 3-5 coherent colours and depth layers. A mural is not always random particles: choose illustrated geometry, typographic image collage, flowing ribbons or a seeded generative landscape. Arabic copy remains DOM or unsplit Text.
Free code OFF: closed media.add and explain opt-in; ON: ck.scene({seed,quality:'auto'}), one v8 namespace, no imports/CDN. Use s.palette.ramp/mix, seeded s.random/rand/noise2, and s.count for detail budgets. Build geometry once/onResize; animate transforms through s.tick, never allocate a full scene every frame. s.pointer is local; do not let decoration steal editing clicks. Draw a complete still in reduced motion; fewer marks in editor; texture/load failure leaves usable DOM content.
Optional libs come only from the actual card's allowlist: filters → s.lib.filters, emitter → s.lib.emitter (an Emitter's parent is a PIXI.ParticleContainer), brush → s.lib.brush, rough → s.lib.rough, viewport → s.lib.viewport. Choose one useful effect, not every library. Cache static groups when appropriate, bound redraw paths and GPU filters, use s.dispose for owned textures/filter resources and external listeners. Size from s.width/height, never window dimensions; test desktop/mobile focal point and contrast. Important meaning remains accessible outside the canvas.
e.g. layered ribbon mural: ${inlineExample(PIXI_MURAL_EXAMPLE)}`,
};

export const PIXI_CREATIVE_SKILLS: readonly AiSkillDefinitionV1[] = [
  PIXI_GAME_SKILL,
  PIXI_STORY_SKILL,
  PIXI_MURAL_SKILL,
];
