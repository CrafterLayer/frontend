import type { AiSkillDefinitionV1 } from '../types';

/*
  Game library skills (game libraries, 2026-10-12): the Agent's playbooks for the Studio
  libraries `audio` (@pixi/sound + ZzFX), `gameai` (yuka steering, A* chases, state machines) and
  `hud` (@pixi/ui). Every `e.g.` example is an exact scene body — the tests compile it and the
  evals browser fixture runs the inlined text the Agent reads against the generated runtime.

  Auto activation uses narrow game phrases only ("sound effects", "enemies chase", "health bar");
  plain words such as "music" or "enemies" bring these skills only inside a creative lane, through
  GAME_LIB_CUES (pixi-selection.ts) — a music school or a security patrol page gets none of them.
*/

function inlineExample(code: string): string {
  return code.replace(/\n\s*/gu, ' ');
}

export const CREATIVE_AUDIO_EXAMPLE = `const p=ck.params({music:''});
const s=await ck.scene({seed:2,libs:['audio','fx']});
const P=s.PIXI,fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion,rng:s.random}),audio=s.lib.audio.create(s);
const orb=new P.Graphics().circle(0,0,26).fill(s.palette.accent);s.stage.addChildAt(orb,0);s.canvas.setAttribute('aria-hidden','true');
const layout=()=>orb.position.set(s.width*.5,s.height*.55);layout();s.onResize(layout);
if(p.music)audio.music.play(p.music,{loop:true,volume:.45,fadeMs:900});
const status=ck.root.querySelector('[data-sfx-status]'),burst={jump:'dust',coin:'coin',explode:'explosion',powerup:'levelup'};
const play=name=>{if(s.editor)return;audio.sfx(name);fx.emit(burst[name]||'sparkle',orb.x,orb.y);if(status)status.textContent=name};
for(const b of ck.root.querySelectorAll('[data-sfx]')){const name=b.getAttribute('data-sfx'),fn=()=>play(name);b.addEventListener('click',fn);s.dispose(()=>b.removeEventListener('click',fn))}
if(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));
s.dispose(()=>{fx.dispose();audio.dispose()});`;

export const CREATIVE_GAMEAI_EXAMPLE = `const s=await ck.scene({seed:6,libs:['tilemap','gameai']});
const P=s.PIXI,root=ck.root,status=root.querySelector('[data-chase-status]');
const layer=new P.Container();s.stage.addChildAt(layer,0);s.canvas.setAttribute('role','img');s.canvas.setAttribute('aria-label','Maze with a guard');
const world=s.lib.tilemap.world(s.app,{tileSize:32,rows:['############','#p...#....e#','#....#.....#','#....#..g..#','#..........#','############'],
legend:{'#':{style:'stone',solid:true},e:{kind:'exit',style:'grass'},p:{kind:'player',marker:true},g:{kind:'guard',marker:true}}});
layer.addChild(world.view);s.dispose(()=>world.dispose());
const ai=s.lib.gameai.create(s);ai.grid(world);
const mid=c=>({x:c.x+16,y:c.y+16}),spawn=mid(world.find('player')[0]),post=mid(world.find('guard')[0]);
const hv=new P.Graphics().circle(0,0,10).fill(0x67e8f9),gv=new P.Graphics().roundRect(-11,-11,22,22,6).fill(0xf87171);layer.addChild(hv,gv);
const hero={...spawn},guard=ai.agent(gv,{...post,speed:90,solid:true,size:20});
const route=[post,{x:post.x+64,y:post.y},{x:post.x,y:post.y-64}];
let mode='ready';
const say=t=>{if(status)status.textContent=t};
const brain=ai.fsm({patrol:{enter:()=>guard.stop().patrol(route)},chase:{enter:()=>guard.stop().chase(hero),update:()=>{if(guard.near(hero,22)){mode='caught';brain.go('done');say('caught')}}},done:{enter:()=>guard.stop()}},'patrol');
const draw=()=>{layer.position.set((s.width-world.width)/2,(s.height-world.height)/2);hv.position.set(hero.x,hero.y);if(s.reducedMotion)s.app.render()};
const reset=()=>{Object.assign(hero,spawn);guard.x=post.x;guard.y=post.y;gv.position.set(post.x,post.y);s.input.clear();mode='ready';brain.go('patrol');say('ready');draw()};
const step=dt=>{if(mode==='running'){const v=150*dt,m=world.move({x:hero.x-9,y:hero.y-9,w:18,h:18},s.input.axis(['ArrowLeft','KeyA'],['ArrowRight','KeyD'])*v,s.input.axis(['ArrowUp','KeyW'],['ArrowDown','KeyS'])*v);hero.x=m.x+9;hero.y=m.y+9;
if(world.overlaps({x:m.x,y:m.y,w:18,h:18}).some(c=>c.kind==='exit')){mode='escaped';brain.go('done');say('escaped')}}ai.update(dt);draw()};
const listen=(el,type,fn)=>{if(el){el.addEventListener(type,fn);s.dispose(()=>el.removeEventListener(type,fn))}};
listen(root.querySelector('[data-chase-start]'),'click',()=>{if(s.editor)return;reset();mode='running';brain.go('chase');say('running');s.canvas.focus()});
for(const b of root.querySelectorAll('[data-chase-key]'))listen(b,'click',()=>{if(s.editor)return;const code=b.getAttribute('data-chase-key');s.input.set(code,true);step(.25);s.input.set(code,false)});
reset();s.onResize(draw);if(!s.editor&&!s.reducedMotion)s.dispose(s.fixedTick(step,{step:1/60,maxSteps:5}));`;

export const CREATIVE_HUD_EXAMPLE = `const s=await ck.scene({seed:8,libs:['fx','hud']});
const P=s.PIXI,fx=s.lib.fx.create(s.app,{reducedMotion:s.reducedMotion,rng:s.random}),hud=s.lib.hud.create(s);
const ar=s.lang.startsWith('ar'),L=ar?{hp:'الصحة',xp:'الخبرة',score:'النقاط',pause:'إيقاف مؤقت',paused:'متوقف'}:{hp:'Health',xp:'XP',score:'Score',pause:'Pause',paused:'Paused'};
const hero=new P.Graphics().circle(0,0,28).fill(s.palette.accent);s.stage.addChildAt(hero,0);s.canvas.setAttribute('aria-hidden','true');
const layout=()=>hero.position.set(s.width*.5,s.height*.55);layout();s.onResize(layout);
const hp=hud.bar({label:L.hp,value:100,max:100}),xp=hud.bar({label:L.xp,value:0,max:50,color:0x22c55e}),score=hud.text(L.score+' 0',{corner:'topEnd'});
let points=0,paused=false;const status=ck.root.querySelector('[data-hud-status]');
const report=()=>{score.text=L.score+' '+points;if(status)status.textContent=paused?L.paused:L.hp+' '+hp.value+' · '+L.score+' '+points;if(s.reducedMotion)s.app.render()};
hud.button({label:L.pause,corner:'bottomEnd',onPress:()=>{paused=!paused;report()}});
const act=kind=>{if(s.editor||paused)return;if(kind==='hit'){hp.value-=20;fx.emit('hit',hero.x,hero.y)}else{hp.value+=15;xp.value+=10;points+=10;fx.emit('heal',hero.x,hero.y)}report()};
for(const b of ck.root.querySelectorAll('[data-hud-act]')){const kind=b.getAttribute('data-hud-act'),fn=()=>act(kind);b.addEventListener('click',fn);s.dispose(()=>b.removeEventListener('click',fn))}
report();if(!s.editor&&!s.reducedMotion)s.tick(t=>fx.update(t.dt));
s.dispose(()=>{fx.dispose();hud.dispose()});`;

export const CREATIVE_AUDIO_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-audio',
  name: 'Pixi: game sound effects and music',
  description:
    'Procedural sound effects with no files, optional music, mute toggle, gesture start.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'sound effects',
      'sfx',
      'game sound',
      'game sounds',
      'game music',
      'chiptune',
      'retro sounds',
      'sound board',
      'مؤثرات صوتية',
      'مؤثرات الصوت',
      'أصوات اللعبة',
      'صوت اللعبة',
      'موسيقى اللعبة',
    ],
  },
  tags: ['pixi', 'audio', 'game'],
  instructions: `SOUND SERVES PLAY: an effect confirms an action (jump, coin, hit, win); music sets the mood and is always optional; nothing important is said only by sound. Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:['audio', …]}).
API: const audio=s.lib.audio.create(s) — owned by the scene (disposed with it) and silent on the editor canvas. audio.sfx(name|[zzfxParams],{volume}) with jump, coin, hit, explode, powerup, click, laser, blip, step, win, lose: procedural ZzFX, no audio files; it returns false before the first gesture and while muted. audio.music.play(url,{loop:true,volume:.5,fadeMs:800}), audio.music.stop({fadeMs}), audio.music.playing; audio.volume=0..1; audio.mute()/unmute()/muted.
THE LIBRARY ENFORCES, DO NOT FIGHT IT: nothing sounds before a pointer, key or touch inside the scene (music requested earlier waits for it); whenever music is requested a bilingual mute toggle appears in the region (WCAG 1.4.2) — never hide it or add a second one; a hidden page pauses all sound; at most 6 tracks of 12 MB and 12 effects at once; a track that fails is logged once and the scene runs silent.
URLS: music only from APPROVED ASSETS or the person's own URL (https:, data:audio/ or blob:), read through ck.params({music:''}) so the Inspector can set it; never invent a URL or file name — no music is fine. s.audio is analyser bands and s.sound the page sound engine; use one sound system per scene.
Example tree: div[role=group] of button[data-sfx=jump|coin|powerup|explode] and p[data-sfx-status] role=status.
e.g. sound board with optional music: ${inlineExample(CREATIVE_AUDIO_EXAMPLE)}`,
};

export const CREATIVE_GAMEAI_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-game-ai',
  name: 'Pixi: enemies, chases, patrols and NPC behaviour',
  description: 'Steering agents, A* chases around tile walls and state machines for enemies.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'enemy ai',
      'game ai',
      'npc',
      'npcs',
      'pathfinding',
      'path finding',
      'enemies chase',
      'enemies chasing',
      'enemies that chase',
      'chasing enemies',
      'patrolling enemies',
      'enemy patrol',
      'ذكاء الأعداء',
      'أعداء يطاردون',
      'أعداء تطارد',
      'عدو يطارد',
      'مطاردة الأعداء',
      'دورية الأعداء',
      'حراس يطاردون',
    ],
  },
  tags: ['pixi', 'game', 'ai'],
  instructions: `ENEMIES NEED READABLE INTENT: patrol, notice, chase around walls, catch or lose the player; telegraph changes (colour, pose, fx); keep them beatable. Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:['tilemap','gameai', …]}).
API: const ai=s.lib.gameai.create(s) — seeded by s.random, disposed with the scene; ai.grid(world) reads a s.lib.tilemap world's solid tiles (or {cols,rows,tileSize,solid(col,row)}). const e=ai.agent(displayObject,{x,y,speed:90,solid:true,size:20,rotate?,flip?}) moves the display object (never set its x/y); solid needs ai.grid. One behaviour per kind (call again to retarget); targets are read live, pass the hero object: e.seek(p) flee(p,{panic}) arrive(p) pursue(a) evade(a,{panic}) wander() patrol(points) follow(points) chase(p) (A* around walls, re-planned as p moves; e.reachable) avoid() with ai.obstacle(x,y,r), separate(); e.stop(), e.near(p,d), e.distanceTo(p); set e.x/e.y on restart.
BRAINS: const brain=ai.fsm({patrol:{enter,update},chase:{enter,update(dt,elapsed)}},'patrol'); brain.go('chase'), brain.state; enter() sets behaviours, e.g. guard.stop().chase(hero). Step in s.fixedTick(dt=>{move hero; ai.update(dt)},{step:1/60,maxSteps:5}) only when !s.editor&&!s.reducedMotion; direction buttons take one step per tap (touch and reduced motion).
BOUNDS: ≤64 agents (create(s,{max})), ≤128 obstacles, paths ≤512 cells; agent() beyond the cap throws. Restart resets positions and brain; announce caught/escaped politely.
Example tree: button[data-chase-start], button[data-chase-key=ArrowLeft…ArrowDown] ×4, output[data-chase-status] role=status.
e.g. guard patrols, then chases the hero round a wall: ${inlineExample(CREATIVE_GAMEAI_EXAMPLE)}`,
};

export const CREATIVE_HUD_SKILL: AiSkillDefinitionV1 = {
  schemaVersion: 1,
  id: 'craftkit.pixi-hud',
  name: 'Pixi: in-game HUD — health, XP and score',
  description: 'Canvas health/xp bars, score text and small controls with a keyboard DOM twin.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 44,
  dependencies: ['craftkit.pixi-v8-core'],
  activation: {
    mode: 'auto',
    keywords: [
      'game hud',
      'in-game hud',
      'heads up display',
      'heads-up display',
      'health bar',
      'health bars',
      'xp bar',
      'mana bar',
      'lives counter',
      'شريط الصحة',
      'أشرطة الصحة',
      'شريط الخبرة',
      'واجهة اللعبة',
      'عداد الأرواح',
    ],
  },
  tags: ['pixi', 'game', 'hud', 'accessibility'],
  instructions: `A HUD IS GLANCEABLE STATE: health, xp, score, lives and a pause button — not menus. Menus, settings, forms, story text and anything a person must read or operate stay accessible DOM (tree buttons, the dialogue box). Free code OFF: closed media.add and explain the opt-in; ON: await ck.scene({libs:['hud', …]}).
API: const hud=s.lib.hud.create(s,{theme?}) — colours from the site tokens (s.palette) unless theme:{accent,surface,text,track}; create it after s.lib.fx and other layers so it stays on top (scene layers go under with s.stage.addChildAt(layer,0)); disposed with the scene. hud.bar({label,value,max,color?,corner?}) → .value/.max; hud.text('Score 0',{corner:'topEnd'}) → .text; hud.button({label,onPress,corner:'bottomEnd'}) → .enabled; hud.slider({label,min,max,step,value,onChange}); hud.checkbox({label,checked,onChange}); hud.list({label,items}) → .items. Corners topStart|topEnd|bottomStart|bottomEnd|top|bottom stack by themselves; start/end follow RTL; resizes re-layout.
ACCESS: every canvas control has a native twin in a hidden panel that appears on Tab focus, so keyboards and screen readers operate the same widget; still mirror what matters (score, lives, game over) in a polite DOM status, updated on change only. Labels in the page language (s.lang), never split Arabic. The editor canvas shows a still, inert HUD; under reduced motion call s.app.render() after changing values.
Example tree: div[role=group] of button[data-hud-act=hit] and button[data-hud-act=heal], p[data-hud-status] role=status.
e.g. health, xp and score with a pause button: ${inlineExample(CREATIVE_HUD_EXAMPLE)}`,
};

export const GAME_ENGINE_SKILLS: readonly AiSkillDefinitionV1[] = [
  CREATIVE_AUDIO_SKILL,
  CREATIVE_GAMEAI_SKILL,
  CREATIVE_HUD_SKILL,
];
