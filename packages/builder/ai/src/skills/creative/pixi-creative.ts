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
  // The game kits by name (scene.preset game:…): each request should see its kit.
  'snake game',
  'quiz game',
  'trivia game',
  'trivia quiz',
  'interactive quiz',
  'breakout game',
  'brick breaker',
  'catch game',
  'catching game',
  'بدي لعبة',
  'اعمل لعبة',
  'اصنع لعبة',
  'ابني لعبة',
  'سوي لعبة',
  // Dialect asks (2026-10-14); «سويلي» and «اعمل لي» are read by keyword-match.ts.
  'ابغى لعبة',
  'ابي لعبة',
  'عايز لعبة',
  'عاوز لعبة',
  'حابب لعبة',
  'طور لعبة',
  'صمم لعبة',
  'لعبة تفاعلية',
  'لعبة منصات',
  'لعبة سيارات',
  'لعبة جمع',
  'لعبة ثنائية الأبعاد',
  'ألعاب تفاعلية',
  'ألعاب ثنائية الأبعاد',
  'لعبة الثعبان',
  'لعبة أسئلة',
  'مسابقة أسئلة',
  'لعبة تكسير',
  'لعبة التقاط',
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
  // Pictured stories (2026-10-14).
  'illustrated story',
  'comic',
  'comic strip',
  'كوميكس',
  'قصة مصورة',
  'قصص مصورة',
  'ابغى قصة',
  'عايز قصة',
  'عاوز قصة',
  'حابب قصة',
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

export const PIXI_GAME_EXAMPLE = `const s=await ck.scene({seed:7,design:{width:1280,height:720,align:'bottom'}});
const P=s.PIXI,root=ck.root,status=root.querySelector('[data-game-status]'),W=1280,H=720;
const field=new P.Graphics().rect(0,0,W,H).fill({color:s.palette.accent,alpha:.08});
const hero=new P.Graphics().circle(0,0,22).fill(0x67e8f9);
const goal=new P.Graphics().star(0,0,5,26,13).fill(0xfde68a);
const hazard=new P.Graphics().circle(0,0,36).fill(0xfb7185);
s.world.addChild(field,hazard,goal,hero);s.canvas.setAttribute('role','img');s.canvas.setAttribute('aria-label','Game area. Use arrow keys or the movement buttons.');
const goals=[[.72,.3],[.25,.25],[.8,.75]];
let x=.18,y=.78,score=0,seconds=30,mode='ready',last='';
const draw=()=>{hero.position.set(x*W,y*H);const g=goals[Math.min(score,2)];goal.position.set(g[0]*W,g[1]*H);goal.visible=mode!=='won';hazard.position.set(W*.5,H*.5);const text=mode+' · '+score+'/3 · '+Math.ceil(seconds)+'s';if(status&&last!==text){status.textContent=text;last=text}if(s.reducedMotion)s.app.render()};
const reset=()=>{x=.18;y=.78;score=0;seconds=30;s.input.clear();mode='ready';draw()};
const distance=(a,b)=>Math.hypot((x-a)*W,(y-b)*H);
const step=dt=>{if(mode!=='running')return;let dx=s.input.axis(['ArrowLeft','KeyA'],['ArrowRight','KeyD']),dy=s.input.axis(['ArrowUp','KeyW'],['ArrowDown','KeyS']);const n=Math.max(1,Math.hypot(dx,dy));x=Math.max(.03,Math.min(.97,x+dx/n*dt*.42));y=Math.max(.03,Math.min(.97,y+dy/n*dt*.42));if(!s.reducedMotion)seconds=Math.max(0,seconds-dt);const g=goals[Math.min(score,2)];if(distance(.5,.5)<=58||seconds===0)mode='lost';else if(distance(g[0],g[1])<=48){score++;if(score===3)mode='won'}draw()};
const listen=(el,type,fn)=>{if(el){el.addEventListener(type,fn);s.dispose(()=>el.removeEventListener(type,fn))}};
for(const action of ['start','pause','restart'])listen(root.querySelector('[data-game-action='+action+']'),'click',()=>{if(s.editor)return;if(action==='pause'){if(mode==='running')mode='paused';else if(mode==='paused')mode='running';s.input.clear()}else{reset();mode='running'}if(mode==='running'){s.input.down('ArrowLeft');s.canvas.focus()}draw()});
for(const b of root.querySelectorAll('[data-game-key]')){const code=b.getAttribute('data-game-key');listen(b,'pointerdown',e=>{if(s.editor)return;b.setPointerCapture(e.pointerId);s.input.set(code,true)});for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(b,type,()=>s.input.set(code,false));listen(b,'click',e=>{if(s.editor)return;if(s.reducedMotion||e.detail===0){s.input.set(code,true);step(.2);s.input.set(code,false)}})}
draw();if(!s.editor&&!s.reducedMotion)s.dispose(s.fixedTick(step,{step:1/60,maxSteps:5}));`;

export const PIXI_STORY_CONTROLS = `<article><h2 data-story-title></h2><p data-story-copy></p>
<div role='group' aria-label='Story navigation'><button type='button' data-story-action='back'>Previous</button>
<button type='button' data-story-action='next'>Next</button><button type='button' data-story-action='reset'>Restart story</button>
<button type='button' data-story-voice aria-pressed='false'>Read aloud</button></div>
<output data-story-status role='status' aria-live='polite'></output></article>`;

export const PIXI_STORY_EXAMPLE = `const s=await ck.scene({seed:11,design:{width:1280,height:720,align:'bottom'}});
const P=s.PIXI,root=ck.root;
const content=[['dawn','Dawn','A traveller discovers a light.',0xfde68a],['crossing','Crossing','The traveller carries it across the valley.',0x67e8f9],['home','Home','The light becomes a beacon for everyone.',0xc4b5fd]];
const layers=content.map((c,i)=>{const layer=new P.Container();layer.addChild(new P.Graphics().circle(0,0,90).fill(c[3]));layer.position.set(320+i*320,360);layer.visible=false;s.world.addChild(layer);return layer});
const title=root.querySelector('[data-story-title]'),copy=root.querySelector('[data-story-copy]'),status=root.querySelector('[data-story-status]');
const back=root.querySelector('[data-story-action=back]'),next=root.querySelector('[data-story-action=next]');
const voice=root.querySelector('[data-story-voice]'),speech=globalThis.speechSynthesis;let reading=false;
const speak=i=>{if(!speech||s.editor)return;speech.cancel();if(reading){const u=new SpeechSynthesisUtterance(content[i][1]+'. '+content[i][2]);u.lang=s.lang;u.rate=.9;speech.speak(u)}};
const show=i=>{layers[i].visible=true;if(title)title.textContent=content[i][1];if(copy)copy.textContent=content[i][2];if(status)status.textContent='Chapter '+(i+1)+' of 3';if(back)back.disabled=i===0;if(next)next.disabled=i===2;if(reading)speak(i)};
s.canvas.setAttribute('aria-hidden','true');
const story=s.story(content.map((c,i)=>({id:c[0],enter:()=>show(i),leave:()=>{layers[i].visible=false}})));
for(const action of ['back','next','reset']){const button=root.querySelector('[data-story-action='+action+']');if(button){const fn=()=>{if(!s.editor)story[action]()};button.addEventListener('click',fn);s.dispose(()=>button.removeEventListener('click',fn))}}
if(voice){voice.hidden=!speech;const fn=()=>{if(s.editor)return;reading=!reading;voice.setAttribute('aria-pressed',String(reading));speak(content.findIndex(c=>c[0]===story.current))};voice.addEventListener('click',fn);s.dispose(()=>{voice.removeEventListener('click',fn);speech?.cancel()})}
s.dispose(()=>story.dispose());`;

export const PIXI_MURAL_EXAMPLE = `const s=await ck.scene({libs:['mural','anim'],seed:7,design:{width:1280,height:720,fit:'cover'}});
s.lib.mural.compose(s,{width:2400,mood:'desert',time:['golden','night'],layers:{sky:['sun','stars',{item:'moon',x:950}],far:[{item:'dunes',size:90}],mid:[{item:'palm',count:4},{item:'tent',x:1500}],near:[{item:'camel',id:'c',x:200},{item:'person',id:'p',x:120,staff:true},{item:'campfire',x:1600}]},
beats:[{label:'set',dur:4},{label:'trek',camera:0.6,walk:{c:1400,p:1320},dur:8},{label:'camp',time:'night',lights:'on',state:{p:'wave'},still:true}]});`;

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
  instructions: `KITS FIRST: scene.preset game:arcade|platformer|runner|breakout|memory|quiz|snake|catch is a tested whole game set by params; write code only for what no kit covers.
PLAYABLE, not a decorative hero: objective, controls and ready/running/paused/won/lost; restart resets score, clock, bodies and input. No fake multiplayer, servers or logins.
FREE CODE OFF: closed media.add only; explain the opt-in. ON: await ck.scene, no imports/CDN. Put instructions, status, labelled start/pause/restart/direction buttons and any dialogue lines (s.lib.dialogue.fromDom) in the tree; scope queries to ck.root. Match the user's language; expose status changes politely, not every frame.
INPUT: s.input.down(code), axis(negativeCodes,positiveCodes), set(code,held), clear(). Keyboard is focused-scene only; no window key handlers. Virtual buttons release on pointerup/cancel/lostcapture and take keyboard clicks. Seconds in s.fixedTick(fn,{step:1/60,maxSteps:5}); unsubscribe via s.dispose. No simulation in editor/reduced motion: draw a finished frame, offer manual steps.
Design at 1280×720 (core SIZE): positions and hit radii in world units. libs:['physics']: s.lib.physics.world(s) walls, steps, drags, disposes; never Runner.run. Big map: design zoom:true + libs:['viewport']: s.world is the camera. Hex board: (await s.lib.hex.load(s)).board({cols,rows}), Kenney tiles: pick(x,y), neighbours(q,r), set(q,r,name). Audio only via audio:true and s.sound after a gesture, with mute. People: s.lib.peeps (director). Few entities, no frame allocations.
Example tree: data-game-action=start/pause/restart, data-game-key=ArrowLeft/ArrowRight/ArrowUp/ArrowDown, output[data-game-status] and an accessible objective.
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
  instructions: `KITS FIRST: scene.preset story:picture-book|visual-novel|scroll-story is a tested whole story, pages edited as text; write code only for what no kit covers.
STORY, not business-history copy: a beginning, discovery, meaningful choice or chapter progression, and an ending. Compose each scene at design 1280×720 in s.world (core SIZE) with a foreground/midground/background, strong focal point and intentional palette; people are s.lib.peeps (director), a mood per page. Keep narrative, headings, controls and dialogue lines (s.lib.dialogue.fromDom) in the DOM; translate all copy and labels to the brief, Arabic shaping stays whole.
Free code OFF means closed media.add only plus explain opt-in. ON use await ck.scene; no packages/CDN. s.story([{id,enter,leave}],initial?) enters the first/initial chapter once. current reads the id; go(id), next(), back(), reset() return booleans; no wrapping or autoplay. Unique ids, light enter/leave; dispose ends the chapter. Reuse containers and toggle visible; never recreate a scene per click.
Use native previous/next/replay buttons, disabled boundaries, a polite chapter status and visible focus. No forced scroll, auto-advancing narration or flashing; reduced motion preserves manual navigation and a finished frame. Prefer s.tick/onResize/s.dispose for transitions and listeners. Use given image URLs via s.texture with fallback; optional sound requires audio:true, gesture unlock and mute, never fabricate a voice asset.
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
  instructions: `COMPOSE FIRST: any illustrated mural (place, season, journey, story, subject): ck.scene({libs:['mural','anim'],seed,design:{width:1280,height:720,fit:'cover'}}); m=s.lib.mural.compose(s,spec), a 1-3k-character spec, not raw geometry; typos warn in m.warnings; own Graphics in m.layer('near').
KIT spec {width:2400,seed,mood:meadow|farm|desert|sea|winter|forest|city|oldcity|garden|fairy|space|reef,time:'day'|['dusk','night'],layers:{sky,far,mid,near,front:[item]},beats,mode:'loop'|'scrub'}; item 'name'|{item,id,x,y,size,kind,count,from,to,color}. ITEMS sun moon stars clouds aurora rain snow|hills mountains dunes plains(fields|snow|sand|road) rocks cliffs|sea waves river lake(pond) underwater bubbles|tree(round|pine|palm|olive|cypress|blossom|bare) bush grass flowers cactus seaweed coral|house(cottage|arab|japanese) skyline(old|modern) mosque arches bridge lantern(s) tent campfire fence barn windmill torii pagoda boat ship car train|bird fish(koi) butterfly camel horse dog cat sheep cow|person(robe|casual|dress|child|diver)|planet(earth|moon|mars|ringed) rocket comet|castle dragon fireflies sparkles. BEAT {label,dur,camera:0..1,time,walk:{id:x},move:{id:{x,y}},show|grow:[id],lights:'on',state:{id:'wave'}}.
PRESETS only when the request clearly is one: scene.preset mural:flow-field-silk|domain-warp-liquid|aurora-curtains|circle-packing-bloom|recursive-mondrian|differential-growth-coral|reaction-diffusion-skin|topographic-contours|voronoi-stained-glass|low-poly-terrain|rough-notebook|terraced-topography|paper-cut-landscape|ribbon-flow|hex-island|botanical-garden|gradient-waves|arc-rings|desert-caravan|fishing-village|seed-to-forest|souq-morning pattern:girih-starfield|zellige-mosaic|mashrabiya-light|arabesque-vines|mosaic-arch-window|ebru-marbling|arabesque-scroll type:calligraphy-ink-reveal|kinetic-word-grid|falling-letters-pile|particle-text-morph are tested whole murals set by params, in the page palette.
NO UI: a mural is the art — no instructions card, dialogue box, Next/Restart/Play buttons or status unless asked.
ART DIRECTION: one motif and focal area, room for DOM copy, 3-5 colours; Arabic copy stays DOM.
STORY murals: 3-5 beats on one labelled anim.timeline (camera pan, anim.rig cast): the kit's beats; mode:'scrub' is tl.progress(s.scroll.progress), with the canvas pinned automatically while native scroll advances through the final beat. Custom timelines call s.scroll.pin() once before fitting; never add a tall CSS runway or capture wheel input.
Free code OFF: closed media.add and explain opt-in. ON, raw code only for abstract or generative art no kit item draws, under ~9,000 characters: compose once in s.world at design 1280×720, no imports/CDN; seeded s.rand/noise2, s.count budgets detail; build geometry once, animate transforms in s.tick; decoration never steals editing clicks; a complete still in reduced motion.
LIBS (allowlist only): emitter → s.lib.emitter.spawn(s,'snow'|'petals'|…); noise → n=s.lib.noise.create(s,{type,fractal,scale,warp}): n.grid({width,height,cell,t}); geom (flat [x,y,…]) → G.bands(grid,8), G.draw(g,shapes,fill) cuts holes, G.mosaic(s,{cells,gap,clip:G.arch(x,y,w,h,'pointed')}), G.spline(pts,{curve}), G.arc({cx,cy,inner,outer,start,end}) per G.pie(values) span, G.simplify(pts,2); color → Co.ramp(a,b,n,{space:'oklch'}), readable(bg,[…]); lsys → L.grow(s,{preset:'fern'|'tree'|'vine'|'arabesque',dir:s.dir}), L.draw(g.clear(),L.upTo(r,t),{color,width}) grows it; hex → await s.lib.hex.load(s); filters, brush, rough.
s.dispose owned textures, filters, listeners. A phone shows the middle 540: focal point there.
e.g. desert caravan with the kit: ${inlineExample(PIXI_MURAL_EXAMPLE)}`,
};

export const PIXI_CREATIVE_SKILLS: readonly AiSkillDefinitionV1[] = [
  PIXI_GAME_SKILL,
  PIXI_STORY_SKILL,
  PIXI_MURAL_SKILL,
];
