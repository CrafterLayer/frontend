import type { AiSkillDefinitionV1 } from '../types';

/*
  Scene library skills (creative power, 2026-10-12): the Agent's playbooks for the Studio
  libraries the game and mural playbooks only named — `physics` (Matter.js) and the scroll-mural
  set (`s.scroll` from the kit, with `brush`, `rough`, `emitter` and `viewport`). Every `e.g.`
  example is an exact scene body: the tests compile it, and the evals browser fixture
  (engines.browser.test.ts) runs the inlined text the Agent reads against the generated runtime.

  Auto activation uses narrow phrases ("physics game", "scroll mural", «جدارية بالتمرير»); a bare
  "physics" or "parallax" brings these only inside a creative lane (pixi-selection.ts) — a physics
  tutor or a parallax agency hero gets none of them.
*/

function inlineExample(code: string): string {
  return code.replace(/\n\s*/gu, ' ');
}

export const CREATIVE_PHYSICS_CONTROLS = `<div role='group' aria-label='Physics controls'><button type='button' data-physics='drop'>Drop a crate</button><button type='button' data-physics='launch'>Launch the ball</button><button type='button' data-physics='reset'>Reset</button></div><output data-physics-status role='status' aria-live='polite'></output>`;

export const CREATIVE_PHYSICS_EXAMPLE = `const s=await ck.scene({seed:12,libs:['physics']});
const P=s.PIXI,{Engine,Bodies,Body,Composite}=s.lib.physics,root=ck.root,status=root.querySelector('[data-physics-status]');
const W=800,H=450,engine=Engine.create(),view=new P.Container(),items=[],still=s.editor||s.reducedMotion;
s.stage.addChild(view);s.canvas.setAttribute('role','img');s.canvas.setAttribute('aria-label','Crates and a ball in a box');
Composite.add(engine.world,[Bodies.rectangle(W/2,H+30,W*2,60,{isStatic:true}),Bodies.rectangle(-30,H/2,60,H*3,{isStatic:true}),Bodies.rectangle(W+30,H/2,60,H*3,{isStatic:true})]);
view.addChild(new P.Graphics().rect(0,H-6,W,6).fill(s.palette.muted));
const add=(body,g,kind)=>{Composite.add(engine.world,body);view.addChild(g);items.push({body,g,kind});if(items.length>24){const old=items.shift();Composite.remove(engine.world,old.body);old.g.destroy()}};
const crate=y=>add(Bodies.rectangle(W*(.5+s.rand(-.1,.1)),y,56,56,{friction:.8,restitution:.05}),new P.Graphics().rect(-28,-28,56,56).fill(s.palette.accent).stroke({width:4,color:s.palette.text}),'crate');
const ball=()=>{const b=Bodies.circle(W*(.5-.42*s.dir),H-40,20,{restitution:.5,density:.01});add(b,new P.Graphics().circle(0,0,20).fill(s.palette.colors[1]),'ball');Body.setVelocity(b,{x:16*s.dir,y:-6})};
const say=()=>{const n=items.filter(i=>i.kind==='crate').length;if(status)status.textContent=n+' crates, '+(items.length-n)+' balls'};
const draw=()=>{const k=Math.min(s.width/W,s.height/H);view.scale.set(k);view.position.set((s.width-W*k)/2,s.height-H*k);for(const {body,g} of items){g.position.set(body.position.x,body.position.y);g.rotation=body.angle}if(still)s.app.render()};
const settle=()=>{for(let i=0;i<240;i++)Engine.update(engine,1000/60);draw()};
const reset=()=>{for(const {body,g} of items){Composite.remove(engine.world,body);g.destroy()}items.length=0;for(let i=0;i<3;i++)crate(H-60-i*70);settle();say()};
const act={drop:()=>crate(-40),launch:ball,reset};
for(const b of root.querySelectorAll('[data-physics]')){const name=b.getAttribute('data-physics'),fn=()=>{if(s.editor)return;act[name]();if(name!=='reset'){say();if(still)settle()}};b.addEventListener('click',fn);s.dispose(()=>b.removeEventListener('click',fn))}
reset();s.onResize(draw);if(!still)s.dispose(s.fixedTick(dt=>{Engine.update(engine,dt*1000);draw()},{step:1/60,maxSteps:5}));`;

export const CREATIVE_SCROLL_MURAL_EXAMPLE = `const s=await ck.scene({seed:21,libs:['brush','rough','emitter','viewport']});
const P=s.PIXI,W=2400,H=600,gen=s.lib.rough.generator(),far=new P.Graphics();
const vp=new s.lib.viewport.Viewport({screenWidth:s.width,screenHeight:s.height,worldWidth:W,worldHeight:H,events:s.app.renderer.events,noTicker:true});
s.stage.addChild(far,vp);s.canvas.setAttribute('aria-hidden','true');
const ridge=Array.from({length:25},(_,i)=>[i*100,H*.62+s.noise2(i*.35,1)*60]);
const hills=new P.Graphics().poly([...ridge.flat(),W,H,0,H]).fill(s.palette.colors[4]);
hills.poly(s.lib.brush.getStroke(ridge,{size:14,thinning:.7,smoothing:.6}).flat()).fill(s.palette.accent);vp.addChild(hills);
for(let i=0;i<9;i++){const g=new P.Graphics(),h=s.rand(60,120);s.lib.rough.drawRough(g,gen.rectangle(180+i*250,H*.8-h,70,h,{fill:s.palette.hex(i),fillStyle:'hachure',stroke:'#1e293b',roughness:1.6,seed:i+1}));vp.addChild(g)}
const dot=s.app.renderer.generateTexture(new P.Graphics().circle(0,0,4).fill(0xffffff));s.dispose(()=>dot.destroy(true));
const air=new P.ParticleContainer({dynamicProperties:{position:true,color:true}});vp.addChild(air);
const flies=new s.lib.emitter.Emitter(air,{lifetime:{min:2,max:4},frequency:.06,maxParticles:s.count(90),pos:{x:0,y:0},behaviors:[{type:'spawnShape',config:{type:'rect',data:{x:0,y:H*.15,w:W,h:H*.5}}},{type:'rotationStatic',config:{min:0,max:360}},{type:'moveSpeedStatic',config:{min:8,max:24}},{type:'alpha',config:{alpha:{list:[{value:0,time:0},{value:.9,time:.5},{value:0,time:1}]}}},{type:'colorStatic',config:{color:'#fde68a'}},{type:'textureSingle',config:{texture:dot}}]});
for(let i=0;i<40;i++)flies.update(.1);
const fit=()=>{far.clear().rect(0,0,s.width*1.2,s.height).fill(s.palette.surface).circle(s.width*.8,s.height*.25,40).fill(s.palette.colors[1]);vp.resize(s.width,s.height,W,H);vp.setZoom(s.height/H,true)};
const look=p=>{const t=s.dir>0?p:1-p,half=Math.min(W/2,vp.worldScreenWidth/2);vp.moveCenter(half+(W-2*half)*t,H/2);far.x=-t*s.width*.1};
fit();s.onResize(fit);s.tick(t=>{flies.update(t.dt);look(s.reducedMotion?.5:s.scroll.progress)});`;

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
MATTER 0.20: const {Engine,Bodies,Body,Composite}=s.lib.physics; Engine.create() (the kit clears every engine on dispose). Bodies.rectangle(x,y,w,h,{isStatic,restitution,friction,density}), Bodies.circle(x,y,r,opts), Composite.add/remove(engine.world,body), Body.setVelocity(b,{x,y}). Step ONLY in s.fixedTick(dt=>Engine.update(engine,dt*1000),{step:1/60,maxSteps:5}) — never Runner.run, Render.create or a raw frame delta.
WORLD UNITS: simulate a fixed world (e.g. 800×450) inside static walls just outside it and scale one Container to fit s.width/s.height on resize — bodies are never rebuilt. One Graphics per body drawn around 0,0; each step copy body.position and body.angle to it. Cap live bodies (drop the oldest) and remove a body from the world when its Graphics is destroyed.
CALM: the editor and reduced motion run no simulation — settle the world synchronously (240 × Engine.update(engine,1000/60)) and draw one finished frame, again after each button press. Launch along s.dir so RTL mirrors. Native buttons (drop, launch, reset), a polite status of what changed, the canvas role=img with a label; the editor's buttons do nothing.
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
    ],
  },
  tags: ['pixi', 'mural', 'scroll', 'parallax'],
  instructions: `SCROLL MURALS: a wide illustrated world the visitor travels by scrolling — a journey, a timeline, a story told as landscape. The page scroll stays the page's: never capture the wheel, preventDefault scrolling or scroll from code. Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:[…]}).
s.scroll: progress 0 when the region's top meets the viewport's bottom, 1 when its bottom leaves the top; velocity in viewport heights per second; visible. Read it in s.tick. Give the region a tall css height (120-180vh); DOM captions scroll beside it.
PARALLAX: far to near, layers built once; t=s.dir>0?progress:1-progress so RTL travels the other way; far layers pale and slow, near ones saturated and fast; one focal object per screen.
LIBS, only those used: brush → s.lib.brush.getStroke(points,{size,thinning,smoothing}) gives an outline, g.poly(outline.flat()).fill(c) paints it. rough → const gen=s.lib.rough.generator(); s.lib.rough.drawRough(g,gen.rectangle|circle|polygon(…,{fill:'#rrggbb',fillStyle:'hachure',roughness,seed})) with string colours (s.palette.hex(i)). emitter → new s.lib.emitter.Emitter(particleContainer,{lifetime,frequency,maxParticles,pos,behaviors:[…]}) — its parent is a new PIXI.ParticleContainer({dynamicProperties:{position:true,color:true}}), never a plain Container; update(t.dt) in s.tick, pre-warmed so a still frame holds particles. viewport → new s.lib.viewport.Viewport({screenWidth,screenHeight,worldWidth,worldHeight,events:s.app.renderer.events,noTicker:true}) as a camera: moveCenter/setZoom from progress, resize in s.onResize, NO drag, wheel or pinch plugin on a scrolled page; the stage destroys it.
CALM: reduced motion runs each tick once — compose the frame at progress .5 and keep it still. Generated textures end in s.dispose.
e.g. camera over a painted night world: ${inlineExample(CREATIVE_SCROLL_MURAL_EXAMPLE)}`,
};

export const SCENE_ENGINE_SKILLS: readonly AiSkillDefinitionV1[] = [
  CREATIVE_PHYSICS_SKILL,
  CREATIVE_SCROLL_MURAL_SKILL,
];
