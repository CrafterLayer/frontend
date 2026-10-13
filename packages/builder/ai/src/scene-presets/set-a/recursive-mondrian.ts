import { definePreset, range, sharedParams } from './define';

/**
 * Recursive rectangle subdivision in the spirit of De Stijl: a seeded split
 * tree sized against the stage (big panels always split, a few calm ones stay
 * whole), several panels in the palette's colours and thick lines in the
 * theme's ink, re-balancing itself with eased transitions. A click (or tap)
 * splits the panel under the pointer. RTL mirrors the composition.
 */
export const RECURSIVE_MONDRIAN = definePreset({
  id: 'recursive-mondrian',
  name: { en: 'Recursive Mondrian', ar: 'موندريان المتكرّر' },
  description: {
    en: 'A De Stijl grid that keeps re-splitting itself with eased motion, in your accent colours. Click a panel to split it.',
    ar: 'شبكة على طريقة دي ستيل تعيد تقسيم نفسها بحركة انسيابية بألوانك المميّزة، وانقر أي لوح لتقسمه.',
  },
  tags: ['geometric', 'bold', 'interactive', 'generative', 'loop'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 3, interactive: true }),
    range('depth', 'Depth', 'العمق', 5, 2, 7, 1, 'look'),
    range('splitChance', 'Split chance', 'احتمال التقسيم', 0.7, 0.2, 1, 0.05, 'look'),
    range('lineWidth', 'Line width', 'سماكة الخط', 8, 1, 20, 1, 'look'),
    range('accentRatio', 'Colour share', 'نسبة الألوان', 0.28, 0, 0.8, 0.02, 'look'),
    range('interval', 'Re-split every (s)', 'إعادة التقسيم كل (ث)', 3.5, 1, 12, 0.5, 'motion'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:3,speed:1,density:1,interactive:true,depth:5,splitChance:0.7,lineWidth:8,accentRatio:0.28,interval:3.5});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette;
const g=new PIXI.Graphics();
s.stage.addChild(g);
const paper=C.surface,paper2=C.mix(C.surface,C.text,0.07),line=C.text;
const colours=[C.colors[0],C.colors[4],C.colors[1],C.colors[3]];
const maxDepth=Math.max(2,Math.min(7,Math.round(p.depth)));
let W=Math.max(1,s.width),H=Math.max(1,s.height),timer=0;

function neutral(){return s.random()<0.3?paper2:paper;}
function colour(){return s.random()<p.accentRatio*1.2?s.pick(colours):neutral();}
function leaf(d,r0){return {d:d,leaf:true,flip:false,tr:0.5,r:r0,c:neutral(),a:null,b:null};}
// A seeded split tree, sized against the stage it is built for: big panels always split, small
// ones only by chance, and no panel gets thinner than a few line widths.
function node(d,w,h){
  const n=leaf(d,0.5);
  n.flip=s.random()<0.2;
  n.tr=d<2||s.random()<0.6?s.pick([s.rand(0.2,0.36),s.rand(0.64,0.8)]):s.rand(0.36,0.64);
  n.r=n.tr;
  const vert=(w>h)!==n.flip,side=vert?w:h,small=p.lineWidth*2+22;
  const share=w*h/(W*H),chance=Math.min(1,p.splitChance*1.45*(1-d/(maxDepth+4)));
  // Now and then a big panel stays whole: the calm field the small ones play against.
  const keep=d>0&&share>0.06&&share<0.25&&Math.max(w,h)<Math.min(w,h)*1.7&&s.random()<0.35;
  if(d<maxDepth&&side*Math.min(n.tr,1-n.tr)>small&&(d<1||share>0.3||(!keep&&(share>0.1||s.random()<chance)))){
    n.leaf=false;
    n.a=vert?node(d+1,w*n.tr,h):node(d+1,w,h*n.tr);
    n.b=vert?node(d+1,w*(1-n.tr),h):node(d+1,w,h*(1-n.tr));
  }
  return n;
}
const root=node(0,W,H);
const inner=[],leaves=[];
function collect(n){if(n.leaf)leaves.push(n);else{inner.push(n);collect(n.a);collect(n.b);}}
function relist(){inner.length=0;leaves.length=0;collect(root);}
relist();
// The classic look: a few panels in colour (every palette colour once before any repeats).
const lit=p.accentRatio>0?Math.max(3,Math.round(leaves.length*p.accentRatio*1.15)):0;
s.shuffle(leaves.slice()).slice(0,lit).forEach(function(n,i){n.c=colours[i%colours.length];});

function walk(n,x,y,w,h,fn){
  if(n.leaf){fn(n,x,y,w,h);return;}
  const vert=(w>h)!==n.flip;
  if(vert){const k=w*n.r;walk(n.a,x,y,k,h,fn);walk(n.b,x+k,y,w-k,h,fn);}
  else{const k=h*n.r;walk(n.a,x,y,w,k,fn);walk(n.b,x,y+k,w,h-k,fn);}
}
function lines(n,x,y,w,h){
  if(n.leaf)return;
  const vert=(w>h)!==n.flip;
  if(vert){const k=w*n.r;g.moveTo(x+k,y).lineTo(x+k,y+h);lines(n.a,x,y,k,h);lines(n.b,x+k,y,w-k,h);}
  else{const k=h*n.r;g.moveTo(x,y+k).lineTo(x+w,y+k);lines(n.a,x,y,w,k);lines(n.b,x,y+k,w,h-k);}
}
function settle(n,k){n.r+=(n.tr-n.r)*k;if(!n.leaf){settle(n.a,k);settle(n.b,k);}}
function layout(w,h){W=Math.max(1,w);H=Math.max(1,h);g.scale.x=s.dir;g.x=s.dir<0?W:0;}
layout(s.width,s.height);
s.onResize(layout);

s.pointer.onDown(function(){
  if(!p.interactive||!s.pointer.inside||s.editor)return;
  const px=s.dir<0?W-s.pointer.x:s.pointer.x,py=s.pointer.y;
  walk(root,0,0,W,H,function(n,x,y,w,h){
    if(px<x||px>x+w||py<y||py>y+h||n.d>=8)return;
    n.leaf=false;n.a=leaf(n.d+1,0.02);n.b=leaf(n.d+1,0.98);n.a.c=n.c;n.b.c=colour();n.r=0.02;n.tr=0.5;
  });
  relist();
});

s.tick(function(time){
  if(!s.reducedMotion){
    timer+=time.dt*p.speed;
    if(timer>p.interval&&inner.length){
      timer=0;
      const n=s.pick(inner);
      n.tr=s.rand(0.25,0.75);
      if(s.random()<0.35){n.a.c=colour();if(n.b.leaf)n.b.c=colour();}
    }
    settle(root,Math.min(1,time.dt*3*Math.max(0.2,p.speed)));
  }
  g.clear();
  walk(root,0,0,W,H,function(n,x,y,w,h){g.rect(x,y,w,h).fill(n.c);});
  lines(root,0,0,W,H);
  g.rect(0,0,W,H);
  g.stroke({width:p.lineWidth,color:line,cap:'square'});
});
s.dispose(function(){inner.length=0;});
`,
});
