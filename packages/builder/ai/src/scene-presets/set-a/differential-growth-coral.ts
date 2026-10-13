import { definePreset, range, sharedParams } from './define';

/**
 * Differential growth: a few closed curves, seeded across the stage, whose nodes
 * attract their neighbours, repel everything nearby (a grid spatial hash) and keep
 * splitting, so they buckle into coral and brain folds and fill the stage within
 * seconds. Growth rings are stamped into a render texture as faint contours; when
 * the reef is full it settles, fades and grows again. The pointer pushes it away.
 */
export const DIFFERENTIAL_GROWTH_CORAL = definePreset({
  id: 'differential-growth-coral',
  name: { en: 'Differential growth coral', ar: 'مرجان النموّ التفاضلي' },
  description: {
    en: 'Living lines that grow, repel themselves and fold into coral and brain shapes, leaving growth rings behind. The pointer pushes them.',
    ar: 'خطوطٌ حيّة تنمو وتتنافر مع نفسها فتنطوي في أشكال مرجانية ودماغية تاركةً حلقات نموّ خلفها، ويدفعها المؤشر.',
  },
  tags: ['generative', 'calm', 'loop', 'hero'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 9, interactive: true }),
    range('maxNodes', 'Max nodes', 'أقصى عدد للعُقد', 1400, 300, 3000, 100, 'look'),
    range('repulsion', 'Spacing', 'التباعد', 14, 6, 30, 1, 'look'),
    range('growthRate', 'Growth rate', 'معدّل النموّ', 0.5, 0, 1, 0.05, 'motion'),
    range('smoothing', 'Smoothing', 'النعومة', 0.5, 0, 1, 0.05, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:9,speed:1,density:1,interactive:true,maxNodes:1400,repulsion:14,growthRate:0.5,smoothing:0.5});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,R=s.app.renderer,TAU=Math.PI*2;
const bg=new PIXI.Graphics(),view=new PIXI.Sprite(),world=new PIXI.Container(),g=new PIXI.Graphics();
const stamp=new PIXI.Container(),ink=new PIXI.Graphics();
world.addChild(g);stamp.addChild(ink);
s.stage.addChild(bg,view,world);
const RR=Math.max(4,p.repulsion),R2=RR*RR,SPLIT=RR*0.85,cap=Math.max(60,s.count(p.maxNodes));
const RATE=0.03*p.growthRate,HOLD=9,PACE=80;
// Nodes live in flat arrays; each closed curve is a ring of prev/next links starting at its head.
// The growth runs in a space sized so the node budget fills it; z scales it up to the stage.
let W=1,H=1,z=1,acc=0,X=[],Y=[],P=[],N=[],heads=[],steps=0,hold=0,rings=0,mark=0,rt=null,gw=1,gh=1;
let cellHead=new Int32Array(1),link=new Int32Array(1);

function loop(cx,cy,r){
  const n=Math.max(10,Math.round(TAU*r/(RR*0.6))),o=X.length,ph=s.rand(0,9);
  for(let i=0;i<n;i++){
    const a=i/n*TAU,j=1+0.12*s.noise2(Math.cos(a)*1.5+ph,Math.sin(a)*1.5);
    X.push(cx+Math.cos(a)*r*j);Y.push(cy+Math.sin(a)*r*j);P.push(o+(i+n-1)%n);N.push(o+(i+1)%n);
  }
  heads.push(o);
}
function seed(){
  X=[];Y=[];P=[];N=[];heads=[];steps=0;hold=0;rings=0;mark=0;g.alpha=1;view.alpha=1;
  ink.clear();
  if(rt)R.render({container:stamp,target:rt,clear:true});
  // One seed in each cell of a loose grid over the stage, so the reef grows into all of it.
  const k=Math.max(3,Math.min(16,Math.round(W*H/12000)));
  const cols=Math.max(1,Math.round(Math.sqrt(k*W/H))),rows=Math.max(1,Math.round(k/cols));
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
    const x=W*(c+s.rand(0.2,0.8))/cols,y=H*(r+s.rand(0.2,0.8))/rows;
    loop(x,y,Math.min(W/cols,H/rows)*s.rand(0.08,0.2)+RR*0.5);
  }
  // A head start while the curves are short and cheap: the first frame already shows folds.
  for(let i=0;i<100;i++)grow();
}
function cellOf(v,size){return Math.min(size-1,Math.max(0,Math.floor(v/RR)+1));}
function step(branch){
  const n=X.length;
  if(link.length<n)link=new Int32Array(n*2);
  cellHead.fill(-1);
  for(let i=0;i<n;i++){const c=cellOf(Y[i],gh)*gw+cellOf(X[i],gw);link[i]=cellHead[c];cellHead[c]=i;}
  const NX=new Float64Array(n),NY=new Float64Array(n),att=0.12+0.25*p.smoothing,mg=RR*1.2;
  const push=p.interactive&&s.pointer.inside&&!s.reducedMotion,px=s.pointer.x/z,py=s.pointer.y/z;
  for(let i=0;i<n;i++){
    const x=X[i],y=Y[i],a=P[i],b=N[i],gx=cellOf(x,gw),gy=cellOf(y,gh);
    let fx=((X[a]+X[b])*0.5-x)*att,fy=((Y[a]+Y[b])*0.5-y)*att;
    for(let v=Math.max(0,gy-1);v<=Math.min(gh-1,gy+1);v++)for(let u=Math.max(0,gx-1);u<=Math.min(gw-1,gx+1);u++){
      for(let j=cellHead[v*gw+u];j>=0;j=link[j]){
        if(j===i)continue;
        const dx=x-X[j],dy=y-Y[j],d2=dx*dx+dy*dy;
        if(d2<R2&&d2>1e-6){const d=Math.sqrt(d2),f=(RR-d)/RR*0.5;fx+=dx/d*f;fy+=dy/d*f;}
      }
    }
    if(x<mg)fx+=(mg-x)*0.08;else if(x>W-mg)fx-=(x-W+mg)*0.08;
    if(y<mg)fy+=(mg-y)*0.08;else if(y>H-mg)fy-=(y-H+mg)*0.08;
    if(push){const dx=x-px,dy=y-py,d2=dx*dx+dy*dy;if(d2<6400){const d=Math.sqrt(d2)+1;fx+=dx/d*1.5;fy+=dy/d*1.5;}}
    fx+=s.noise2(x*0.01,y*0.01+steps*0.002)*0.08*s.dir;
    NX[i]=x+Math.max(-2,Math.min(2,fx));NY[i]=y+Math.max(-2,Math.min(2,fy));
  }
  for(let i=0;i<n;i++){X[i]=NX[i];Y[i]=NY[i];}
  // Split long edges, and now and then a short one, so the curves keep lengthening and buckle.
  for(let i=0;branch&&i<n&&X.length<cap;i++){
    const b=N[i],dx=X[b]-X[i],dy=Y[b]-Y[i];
    if(dx*dx+dy*dy>SPLIT*SPLIT||s.random()<RATE){
      const j=X.length;X.push((X[i]+X[b])*0.5);Y.push((Y[i]+Y[b])*0.5);P.push(i);N.push(b);N[i]=j;P[b]=j;
    }
  }
  steps++;
}
function trace(G){
  for(let h=0;h<heads.length;h++){
    const i0=heads[h];let i=i0;
    G.moveTo(X[i],Y[i]);
    for(let k=0;k<X.length;k++){i=N[i];if(i===i0)break;G.lineTo(X[i],Y[i]);}
    G.closePath();
  }
}
// A growth ring: the curves as they are now, stamped faintly into the render texture.
function ring(){
  ink.clear();trace(ink);
  ink.fill({color:C.colors[4],alpha:0.07}).stroke({width:0.8,color:rings%2?C.colors[1]:C.colors[4],alpha:0.36,join:'miter',miterLimit:2});
  R.render({container:stamp,target:rt,clear:false});
  rings++;mark=Math.round(X.length*1.28)+12;
}
function draw(){
  g.clear();trace(g);
  g.stroke({width:4,color:C.colors[1],alpha:0.14,join:'miter',miterLimit:2});
  trace(g);
  g.stroke({width:1.25,color:C.colors[0],alpha:0.95,join:'miter',miterLimit:2});
}
function grow(){step(true);if(rings<10&&X.length>=mark)ring();}
function layout(w,h){
  const sw=Math.max(1,w),sh=Math.max(1,h);
  z=Math.max(1,Math.min(2.4,Math.sqrt(sw*sh/(cap*R2*0.32))));
  W=sw/z;H=sh/z;world.scale.set(z);ink.scale.set(z);
  bg.clear().rect(0,0,sw,sh).fill(C.surface);
  rt=s.rt(sw,sh);view.texture=rt;
  gw=Math.ceil(W/RR)+3;gh=Math.ceil(H/RR)+3;cellHead=new Int32Array(gw*gh);
  seed();
}
layout(s.width,s.height);
s.onResize(layout);
s.tick(function(time){
  if(s.reducedMotion){
    const t0=performance.now();
    // The still: grow to the node budget, then let the reef relax outwards into the gaps.
    while(X.length<cap&&steps<1500&&performance.now()-t0<1500)grow();
    for(let k=0;k<240&&performance.now()-t0<2100;k++)step(false);
    draw();return;
  }
  // PACE steps a second whatever the frame rate, as many as fit 12 ms of a frame (a slow device
  // grows a little slower rather than stalling). Full: relax without splitting, then fade and regrow.
  const full=X.length>=cap,t0=performance.now();
  acc=Math.min(8,acc+PACE*p.speed*time.dt);
  while(acc>=1&&performance.now()-t0<12){acc-=1;if(full)step(false);else grow();}
  if(full){
    hold+=time.dt*Math.max(0.2,p.speed);
    g.alpha=view.alpha=Math.max(0,1-Math.max(0,hold-HOLD)/1.5);
    if(hold>HOLD+1.6)seed();
  }
  draw();
});
s.dispose(function(){X=[];Y=[];P=[];N=[];heads=[];stamp.destroy({children:true});});
`,
});
