import { definePreset, range, sharedParams } from './define';

/**
 * Recursive rectangle subdivision in the spirit of De Stijl: a seeded split
 * tree that keeps re-balancing itself with eased transitions. A click (or tap)
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
const paper=C.surface,line=C.text,accents=[C.colors[0],C.colors[4],C.colors[1]];
const maxDepth=Math.max(2,Math.min(7,Math.round(p.depth)));
let W=1,H=1,timer=0;

function colour(){return s.random()<p.accentRatio?s.pick(accents):paper;}
function node(d,r0){
  const n={d:d,leaf:true,flip:s.random()<0.25,tr:s.rand(0.3,0.7),r:0.5,c:colour(),a:null,b:null};
  n.r=r0===undefined?n.tr:r0;
  if(d<maxDepth&&(d<2||s.random()<p.splitChance*(1-d/(maxDepth+2)))){n.leaf=false;n.a=node(d+1);n.b=node(d+1);}
  return n;
}
const root=node(0);
const inner=[];
function collect(n){if(!n.leaf){inner.push(n);collect(n.a);collect(n.b);}}
function relist(){inner.length=0;collect(root);}
relist();

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
    n.leaf=false;n.a=node(n.d+1,0.02);n.b=node(n.d+1,0.98);n.a.leaf=true;n.b.leaf=true;n.r=0.02;n.tr=0.5;
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
