import type { AiSkillDefinitionV1 } from '../types';

/*
  Scene library skills (creative power, 2026-10-12): the Agent's playbooks for the Studio
  libraries the game and mural playbooks only named — `physics` (Matter.js) and the scroll-mural
  set (`s.scroll` from the kit, with `brush`, `rough`, `emitter` and `viewport`). Every `e.g.`
  example is an exact scene body: the tests compile it, and the evals browser fixture
  (engines.browser.test.ts) runs the inlined text the Agent reads against the generated runtime.

  Auto activation uses narrow phrases ("physics game", "scroll mural", «جدارية بالتمرير», and the
  mural-story phrases "mural story", «قصة جدارية», 2026-10-14); a bare
  "physics" or "parallax" brings these only inside a creative lane (pixi-selection.ts) — a physics
  tutor or a parallax agency hero gets none of them.
*/

function inlineExample(code: string): string {
  return code.replace(/\n\s*/gu, ' ');
}

export const CREATIVE_PHYSICS_CONTROLS = `<div role='group' aria-label='Physics controls'><button type='button' data-physics='drop'>Drop a crate</button><button type='button' data-physics='launch'>Launch the ball</button><button type='button' data-physics='reset'>Reset</button></div><output data-physics-status role='status' aria-live='polite'></output>`;

export const CREATIVE_PHYSICS_EXAMPLE = `const s=await ck.scene({seed:12,libs:['physics'],design:{width:800,height:450,align:'bottom'}});
const P=s.PIXI,{Bodies,Body}=s.lib.physics,w=s.lib.physics.world(s),root=ck.root,status=root.querySelector('[data-physics-status]'),items=[];
s.canvas.setAttribute('role','img');s.canvas.setAttribute('aria-label','Crates and a ball in a box; drag them');
s.world.addChild(new P.Graphics().rect(0,444,800,6).fill(s.palette.muted));
const add=(body,g,kind)=>{w.add(body,g);items.push({body,kind});if(items.length>24)w.remove(items.shift().body)};
const crate=y=>add(Bodies.rectangle(400+s.rand(-80,80),y,56,56,{friction:.8,restitution:.05}),new P.Graphics().rect(-28,-28,56,56).fill(s.palette.accent).stroke({width:4,color:s.palette.text}),'crate');
const ball=()=>{const b=Bodies.circle(400-336*s.dir,410,20,{restitution:.5,density:.01});add(b,new P.Graphics().circle(0,0,20).fill(s.palette.colors[1]),'ball');Body.setVelocity(b,{x:16*s.dir,y:-6})};
const say=()=>{const n=items.filter(i=>i.kind==='crate').length;if(status)status.textContent=n+' crates, '+(items.length-n)+' balls'};
const reset=()=>{for(const i of items)w.remove(i.body);items.length=0;for(let i=0;i<3;i++)crate(390-i*70);say()};
const act={drop:()=>crate(-40),launch:ball,reset};
for(const b of root.querySelectorAll('[data-physics]')){const name=b.getAttribute('data-physics'),fn=()=>{if(s.editor)return;act[name]();say()};b.addEventListener('click',fn);s.dispose(()=>b.removeEventListener('click',fn))}
reset();`;

export const CREATIVE_SCROLL_MURAL_EXAMPLE = `const s=await ck.scene({seed:21,libs:['brush','rough','emitter','viewport']});
const P=s.PIXI,W=2400,H=600,gen=s.lib.rough.generator(),far=new P.Graphics();
const vp=new s.lib.viewport.Viewport({screenWidth:s.width,screenHeight:s.height,worldWidth:W,worldHeight:H,events:s.app.renderer.events,noTicker:true});
s.stage.addChild(far,vp);s.canvas.setAttribute('aria-hidden','true');
const ridge=Array.from({length:25},(_,i)=>[i*100,H*.62+s.noise2(i*.35,1)*60]);
const hills=new P.Graphics().poly([...ridge.flat(),W,H,0,H]).fill(s.palette.colors[4]);
hills.poly(s.lib.brush.getStroke(ridge,{size:14,thinning:.7,smoothing:.6}).flat()).fill(s.palette.accent);vp.addChild(hills);
for(let i=0;i<9;i++){const g=new P.Graphics(),h=s.rand(60,120);s.lib.rough.drawRough(g,gen.rectangle(180+i*250,H*.8-h,70,h,{fill:s.palette.hex(i),fillStyle:'hachure',stroke:'#1e293b',roughness:1.6,seed:i+1}));vp.addChild(g)}
s.lib.emitter.spawn(s,'magic',{parent:vp,x:W/2,y:H*.4,width:W,height:H*.5,colors:['#fde68a','#fef3c7'],intensity:.7});
const fit=()=>{far.clear().rect(0,0,s.width*1.2,s.height).fill(s.palette.surface).circle(s.width*.8,s.height*.25,40).fill(s.palette.colors[1]);vp.resize(s.width,s.height,W,H);vp.setZoom(s.height/H,true)};
const look=p=>{const t=s.dir>0?p:1-p,half=Math.min(W/2,vp.worldScreenWidth/2);vp.moveCenter(half+(W-2*half)*t,H/2);far.x=-t*s.width*.1};
fit();s.onResize(fit);s.tick(()=>look(s.reducedMotion?.5:s.scroll.progress));`;

export const CREATIVE_PHYSICS_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-physics',
  name: 'Pixi: physics toys and puzzles (Matter.js)',
  description:
    'Rigid bodies that stack, topple, bounce and launch, stepped in the fixed loop, with settled still frames.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'physics game',
      'physics toy',
      'physics sandbox',
      'physics playground',
      'physics puzzle',
      'physics simulation',
      'matter js',
      'rigid body',
      'ragdoll',
      'لعبة فيزياء',
      'ألعاب فيزياء',
      'محاكاة فيزيائية',
      'لعبة مقلاع',
    ],
  },
  tags: ['pixi', 'physics', 'game'],
  instructions: `PHYSICS SERVES PLAY: bodies that stack, topple, bounce and launch make a toy or a puzzle — a slingshot at a tower, falling blocks, a pinball table — never decoration that ignores the visitor. Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:['physics', …]}).
MATTER 0.20 + world(): const {Bodies,Body}=s.lib.physics,w=s.lib.physics.world(s,{gravity?,walls?:true|'box'|false,bounds?,drag?}) — one call gives the Engine stepped in s.fixedTick, static walls just outside the design (else the region, refitted on resize), pointer drag of bodies (never through DOM buttons; the page still scrolls) and full disposal. w.add(body,graphics) links a Graphics drawn around 0,0 (position + angle every step); w.remove(body) destroys it; w.engine for Matter.Events. Bodies.rectangle(x,y,w,h,{isStatic,restitution,friction,density}), Bodies.circle(x,y,r,opts), Body.setVelocity(b,{x,y}). Never Runner.run, Render.create or your own loop.
DESIGN UNITS: ck.scene({design:{width:800,height:450,align:'bottom'}}) — the kit fits s.world to the region and maps the pointer; bodies are never rebuilt. Cap live bodies (w.remove the oldest).
MARBLE MAZES: libs:['physics','procgen'] — const m=s.lib.procgen.maze(s,{width:21,height:13}) is seeded and always solvable; a static Bodies.rectangle per m.wall(x,y) cell, the ball at m.centre(m.start,t), the goal at m.exit.
CALM: the editor and reduced motion run no loop; world() settles synchronously after the setup and after each add/remove and draws that still frame — no code of yours. Launch along s.dir so RTL mirrors. Native buttons (drop, launch, reset), a polite status of what changed, the canvas role=img with a label; the editor's buttons do nothing.
Example tree: buttons data-physics=drop/launch/reset and output[data-physics-status].
e.g. crates and a ball: ${inlineExample(CREATIVE_PHYSICS_EXAMPLE)}`,
};

export const CREATIVE_SCROLL_MURAL_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-scroll-murals',
  name: 'Pixi: scroll murals and parallax journeys',
  description:
    'A wide painted world travelled by page scroll: s.scroll, parallax depth, brush, rough, emitter and a viewport camera.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'scroll mural',
      'scrolling mural',
      'parallax mural',
      'parallax scene',
      'parallax landscape',
      'parallax journey',
      'scroll story',
      'scrolling story',
      'scrollytelling',
      'جدارية بالتمرير',
      'جدارية بارالاكس',
      'مشهد بارالاكس',
      'منظر بارالاكس',
      'قصة بالتمرير',
      // mural stories (2026-10-14): an illustrated mural that tells a story in beats.
      'mural story',
      'mural stories',
      'story mural',
      'illustrated mural',
      'قصة جدارية',
      'قصص جدارية',
      'جدارية تحكي',
      'جدارية قصصية',
    ],
  },
  tags: ['pixi', 'mural', 'scroll', 'parallax', 'story'],
  instructions: `SCROLL MURALS: a wide illustrated world the visitor travels by scrolling — a journey, a timeline, a story told as landscape. The page scroll stays the page's: never capture the wheel, preventDefault scrolling or scroll from code. Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:[…]}).
s.scroll: progress 0 when the region's top meets the viewport's bottom, 1 when its bottom leaves the top; velocity in viewport heights per second; visible. Read it in s.tick. Give the region a tall css height (120-180vh); DOM captions scroll beside it.
PARALLAX: far to near, layers built once; t=s.dir>0?progress:1-progress so RTL travels the other way; far layers pale and slow, near ones saturated and fast; one focal object per screen.
LIBS, only those used: brush → s.lib.brush.getStroke(points,{size,thinning,smoothing}) gives an outline, g.poly(outline.flat()).fill(c) paints it. rough → const gen=s.lib.rough.generator(); s.lib.rough.drawRough(g,gen.rectangle|circle|polygon(…,{fill:'#rrggbb',fillStyle:'hachure',roughness,seed})) with string colours (s.palette.hex(i)). emitter → s.lib.emitter.spawn(s,'snow'|'rain'|'leaves'|'petals'|'magic'|'dust'|'embers'|'fire'|'smoke'|'sparkles'|'bubbles'|'confetti'|'fireworks',{x,y,width,height,parent,colors,intensity,wind}): a tuned, theme-aware emitter, pre-warmed (a still frame holds particles), mirrored with s.dir, halved in the editor, disposed with the scene; omit x,y to fill the view. burst(s,name,{x,y}) is one shot; presets.<name>(s,opts) is the raw config for new s.lib.emitter.Emitter(new PIXI.ParticleContainer(…),cfg). viewport → new s.lib.viewport.Viewport({screenWidth,screenHeight,worldWidth,worldHeight,events:s.app.renderer.events,noTicker:true}) as a camera: moveCenter/setZoom from progress, resize in s.onResize, NO drag, wheel or pinch plugin on a scrolled page; the stage destroys it.
MURAL STORY («قصة جدارية»): ready presets desert-caravan, fishing-village, seed-to-forest, souq-morning. Else illustrated vignettes: people, animals, places and things as silhouettes lit from one side in far/mid/near layers; characters are anim.rig parts (walk at stride pace). One anim.timeline({repeat:-1}) with labels per beat (3-5) moves the cast, relights layers (tint) and pans cam.pan; scrub: timeline({paused:true}) and tl.progress(eased s.scroll.progress) each tick. NO UI: no buttons, captions or dialogue boxes. Editor/reduced motion: tl.progress(strongest beat), no update.
CALM: reduced motion runs each tick once — compose the frame at progress .5 and keep it still. Generated textures end in s.dispose.
GIF only one the person gave (never invent a URL): const g=await s.lib.gif.load(s,url) is a Sprite (play, stop, gotoAndStop), still on its first frame when calm, ended with the scene.
e.g. camera over a painted night world: ${inlineExample(CREATIVE_SCROLL_MURAL_EXAMPLE)}`,
};

export const SCENE_ENGINE_SKILLS: readonly AiSkillDefinitionV1[] = [
  CREATIVE_PHYSICS_SKILL,
  CREATIVE_SCROLL_MURAL_SKILL,
];
