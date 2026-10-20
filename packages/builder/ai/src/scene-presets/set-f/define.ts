/**
 * Builders for the set-F builtin scene presets (mural stories, 2026-10-14): illustrated murals
 * that tell a short story in 3–5 beats across a wide painted panorama — people, animals, places
 * and things drawn as silhouettes in depth layers, posed by `s.lib.anim` rigs and sequenced by one
 * `s.lib.anim` timeline that also pans the camera. No GSAP: the in-house timeline has the
 * controls a story needs (labels, from/fromTo, stagger, seek/progress).
 *
 * Same contract as sets A, D and E (author craftkit, trust trusted, licence MIT, kind scene, a
 * still frame under reduced motion) and the same param builders. Every story composes at the
 * 1280 × 720 design in s.world through the pixi-viewport camera, plays as a seamless loop by
 * default (a veil in the night colour hides the jump back to the first beat), and with `scrub`
 * the visitor's scroll drives the same timeline instead (`tl.progress(s.scroll.progress)`). A
 * story shows no UI of its own: no buttons, captions or dialogue boxes.
 */
import type { ScriptEntry } from '@craftkit/builder-schema';

import { definePreset, select, toggle, type PresetDefinition } from '../set-a/define';

export { range, select, sharedParams, toggle } from '../set-a/define';

/** One fixed timestamp: builtin entries never change under a clock. */
export const SET_F_SAVED_AT = '2026-10-14T12:00:00.000Z';

/** A builtin set-F preset as a ScriptEntry. */
export function defineStory(definition: PresetDefinition): ScriptEntry {
  return { ...definePreset(definition), createdAt: SET_F_SAVED_AT, updatedAt: SET_F_SAVED_AT };
}

/** The two params every mural story adds: scroll scrubbing and the colour source. */
export function storyParams(): ReturnType<typeof toggle>[] {
  return [
    toggle('scrub', 'Play with scroll', 'التشغيل بالتمرير', false, 'motion'),
    select(
      'tones',
      'Colours',
      'الألوان',
      'story',
      [
        ['story', 'Painted story colours', 'ألوان القصة المرسومة'],
        ['theme', 'Tinted with the page colours', 'ممزوجة بألوان الصفحة'],
      ],
      'look',
    ),
  ];
}

/**
 * The story stage every set-F preset shares, as scene code placed right after its `ck.scene`:
 *
 * - `root` mirrors the whole picture in RTL (s.dir), `layer(f)` adds a depth layer the camera
 *   pans by `cam.pan` (0..1) times `f` — sky 0, far hills ~0.25, the ground 1, foreground > 1;
 * - `gfx`, `box`, `grad` and `glow` build Graphics, joints, smooth gradients and soft lights; `tone(list)` keeps the
 *   painted colours or tints them with the page palette (`tones: 'theme'`); `skies` stacks the
 *   times of day, `fade` and `relight` (a tint per layer, so the light stays one light) time them;
 * - `figure` and `bird` build anim-rig characters from joints (legs, arms, head, wings), and
 *   `rig` registers a rig with its walking pace, so scrubbing walks them only while scrolling;
 * - `tl` is the story's one timeline: looping, or paused and scrubbed by s.scroll (`scrub`);
 * - `loop(end, colour)` fades the end into the start; `play(stillAt, ambient)` registers the one
 *   tick (camera, rigs, the scene's own gentle ambient motion) and the disposal, and holds the
 *   beat at `stillAt` (0..1) as the still frame in the editor and under reduced motion.
 */
export function storyStage(panoramaWidth: number): string {
  return String.raw`const P=s.PIXI,C=s.palette,A=s.lib.anim.create({reducedMotion:s.reducedMotion});
const still=s.reducedMotion||s.editor,PW=${String(panoramaWidth)},H=720,cam={pan:0},layers=[],rigs=[];
const root=new P.Container();root.scale.x=s.dir;root.x=s.dir<0?1280:0;s.world.addChild(root);
const tl=A.timeline({repeat:-1,paused:still||p.scrub});
const tone=k=>p.tones==='theme'?k.map((c,i)=>C.mix(c,i?C.accent:C.surface,i?0.3:0.6)):k;
function box(parent,x,y){const c=new P.Container();c.position.set(x||0,y||0);parent.addChild(c);return c}
function gfx(parent,x,y){const g=new P.Graphics();g.position.set(x||0,y||0);parent.addChild(g);return g}
function layer(f){const c=box(root);c.f=f;layers.push(c);return c}
// Smooth Pixi gradients (an OKLab midpoint keeps dawn from going grey); released with the scene.
const fills=[],rgba=(c,a)=>'#'+c.toString(16).padStart(6,'0')+Math.round(a*255).toString(16).padStart(2,'0');
function fill(o){const f=new P.FillGradient({textureSpace:'local',...o});fills.push(f);return f}
function grad(g,y,h,a,b){return g.rect(-40,y,PW+80,h).fill(fill({type:'linear',start:{x:0,y:0},end:{x:0,y:1},colorStops:[0,0.5,1].map(o=>({offset:o,color:C.mix(a,b,o)}))}))}
// A soft additive light: lamps, fire, windows at night.
function glow(parent,x,y,r,c,a){const g=gfx(parent,x,y);g.blendMode='add';return g.circle(0,0,r).fill(fill({type:'radial',colorStops:[{offset:0,color:rgba(c,a||0.7)},{offset:1,color:rgba(c,0)}]}))}
// Sky gradients stacked bottom-up: the first always shows, the second starts shown, the rest hidden.
function skies(parent,pairs){return pairs.map((q,i)=>{const g=grad(gfx(parent),-40,560,q[0],q[1]);g.alpha=i>1?0:1;return g})}
function fade(target,alpha,at,d){return tl.to(target,{alpha},{duration:d||4,ease:'inOutSine'},at)}
function relight(list,color,at,d){return tl.to(list,{tint:color},{duration:d||4,ease:'inOutSine',colors:['tint']},at)}
function limb(parent,x,y,len,w,color){const j=box(parent,x,y);gfx(j).roundRect(-w/2,-w/2,w,len+w/2,w/2).fill(color);return j}
// A walking person (rig parts), feet at x,y: c = [robe, skin, headwear]; staff: a walking stick.
function figure(parent,x,y,h,c,staff){
  const r=box(parent,x,y),k=h/100,back=C.mix(c[0],c[1],0.5);
  const armL=limb(r,-2*k,-72*k,34*k,8*k,back),legL=limb(r,-3*k,-44*k,44*k,9*k,c[1]);
  const body=box(r);gfx(body).poly([-11*k,-76*k,11*k,-76*k,17*k,-16*k,-17*k,-16*k]).fill(c[0]);
  const legR=limb(r,3*k,-44*k,44*k,9*k,c[1]),armR=limb(r,2*k,-72*k,34*k,8*k,c[0]);
  if(staff)gfx(armR).roundRect(-2*k,-40*k,4*k,112*k,2*k).fill(C.mix(c[1],0x000000,0.35));
  const head=box(r,0,-78*k);gfx(head).circle(0,-9*k,9*k).fill(c[1]).poly([-11*k,-9*k,0,-23*k,11*k,-9*k,13*k,4*k,-9*k,-4*k]).fill(c[2]);
  return {root:r,body,head,armL,armR,legL,legR};
}
// A bird whose wings are rig arms (the run state flaps them).
function bird(parent,x,y,size,color){
  const r=box(parent,x,y),wing=()=>{const j=box(r);gfx(j).poly([0,0,-size*0.9,-size*0.5,-size*1.3,-size*0.1]).fill(color);return j};
  const armL=wing(),body=box(r);gfx(body).ellipse(0,0,size*0.6,size*0.22).fill(color).circle(size*0.5,-size*0.12,size*0.16).fill(color);
  const armR=wing();armR.scale.x=-1;
  return {root:r,body,armL,armR};
}
function rig(parts,size,state,pace){const r=A.rig(parts,{size,state,speed:pace||1});r.pace=pace||1;rigs.push(r);return r}
function loop(end,color){
  if(still||p.scrub)return;
  const v=gfx(s.world);v.rect(-40,-40,1360,800).fill(color);
  tl.fromTo(v,{alpha:1},{alpha:0},{duration:1.6,ease:'inOutSine'},0).to(v,{alpha:1},{duration:1.6,ease:'inOutSine'},end-1.6);
}
function play(stillAt,ambient){
  if(still)tl.progress(stillAt);
  let sp=0,go=0;
  s.tick(function(time){
    if(!still){
      if(p.scrub){
        const target=s.scroll.progress;sp=target===0||target===1?target:sp+(target-sp)*Math.min(1,time.dt*5);tl.progress(sp);
        go+=(Math.min(1,Math.abs(s.scroll.velocity)*6)-go)*Math.min(1,time.dt*4);
        for(const r of rigs)r.speed=r.pace*go;
      }
      A.update(time.dt*p.speed);
    }
    for(const l of layers)l.x=-cam.pan*(PW-1280)*l.f;
    ambient(still?0:time.t*p.speed,tl.time());
  });
  s.dispose(()=>{A.dispose();for(const f of fills)f.destroy()});
}`;
}
