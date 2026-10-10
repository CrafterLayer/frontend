import { definePreset, range, sharedParams } from './define';

/**
 * Differential growth: a closed curve whose nodes attract their neighbours,
 * repel everything nearby (spatial hash) and keep splitting, so it buckles into
 * coral and brain folds. Growth rings stay behind as faint contours; when the
 * curve is full it fades and grows again. The pointer pushes the curve away.
 */
export const DIFFERENTIAL_GROWTH_CORAL = definePreset({
  id: 'differential-growth-coral',
  name: { en: 'Differential growth coral', ar: 'مرجان النموّ التفاضلي' },
  description: {
    en: 'A living line that grows, repels itself and folds into coral and brain shapes, leaving growth rings behind. The pointer pushes it.',
    ar: 'خطٌّ حيّ ينمو ويتنافر مع نفسه فينطوي في أشكال مرجانية ودماغية تاركاً حلقات نموّ خلفه، ويدفعه المؤشر.',
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
const PIXI=s.PIXI,C=s.palette,TAU=Math.PI*2;
const bg=new PIXI.Graphics(),rings=new PIXI.Graphics(),g=new PIXI.Graphics();
s.stage.addChild(bg,rings,g);
const RR=Math.max(4,p.repulsion),R2=RR*RR,cap=Math.max(60,s.count(p.maxNodes));
let W=1,H=1,X=[],Y=[],hist=[],steps=0,hold=0,acc=0;

function seed(){
  X=[];Y=[];hist=[];steps=0;hold=0;g.alpha=1;rings.alpha=1;
  const cx=W*0.5,cy=H*0.5,r=Math.min(W,H)*0.05+RR,n=Math.max(12,Math.round(TAU*r/(RR*0.6)));
  for(let i=0;i<n;i++){
    const a=i/n*TAU,j=1+0.08*s.noise2(Math.cos(a)*2,Math.sin(a)*2);
    X.push(cx+Math.cos(a)*r*j);Y.push(cy+Math.sin(a)*r*j);
  }
}
function step(){
  const n=X.length,grid=new Map();
  for(let i=0;i<n;i++){
    const k=(Math.floor(X[i]/RR)+2)*65536+Math.floor(Y[i]/RR)+2;
    let b=grid.get(k);if(!b){b=[];grid.set(k,b);}b.push(i);
  }
  const NX=new Float64Array(n),NY=new Float64Array(n);
  const att=0.12+0.25*p.smoothing,ex=W*0.47,ey=H*0.45,cx=W/2,cy=H/2;
  const push=p.interactive&&s.pointer.inside&&!s.reducedMotion;
  for(let i=0;i<n;i++){
    const x=X[i],y=Y[i],a=(i+n-1)%n,b=(i+1)%n;
    let fx=((X[a]+X[b])*0.5-x)*att,fy=((Y[a]+Y[b])*0.5-y)*att;
    const gx=Math.floor(x/RR)+2,gy=Math.floor(y/RR)+2;
    for(let u=-1;u<=1;u++)for(let v=-1;v<=1;v++){
      const bucket=grid.get((gx+u)*65536+gy+v);
      if(!bucket)continue;
      for(const j of bucket){
        if(j===i)continue;
        const dx=x-X[j],dy=y-Y[j],d2=dx*dx+dy*dy;
        if(d2<R2&&d2>1e-6){const d=Math.sqrt(d2),f=(RR-d)/RR*0.5;fx+=dx/d*f;fy+=dy/d*f;}
      }
    }
    const qx=(x-cx)/ex,qy=(y-cy)/ey,q=qx*qx+qy*qy;
    if(q>1){fx-=qx*(q-1)*4;fy-=qy*(q-1)*4;}
    if(push){const dx=x-s.pointer.x,dy=y-s.pointer.y,d2=dx*dx+dy*dy;if(d2<6400){const d=Math.sqrt(d2)+1;fx+=dx/d*1.5;fy+=dy/d*1.5;}}
    fx+=s.noise2(x*0.01,y*0.01+steps*0.002)*0.08*s.dir;
    NX[i]=x+Math.max(-2,Math.min(2,fx));NY[i]=y+Math.max(-2,Math.min(2,fy));
  }
  const OX=[],OY=[],split=RR*0.75;
  for(let i=0;i<n;i++){
    OX.push(NX[i]);OY.push(NY[i]);
    const b=(i+1)%n,dx=NX[b]-NX[i],dy=NY[b]-NY[i];
    if(OX.length+n-i<cap&&(dx*dx+dy*dy>split*split||s.random()<p.growthRate*0.004)){OX.push((NX[i]+NX[b])*0.5);OY.push((NY[i]+NY[b])*0.5);}
  }
  X=OX;Y=OY;steps++;
  if(steps%40===0){hist.push({x:X.slice(),y:Y.slice()});if(hist.length>7)hist.shift();}
}
function poly(G,x,y){G.moveTo(x[0],y[0]);for(let i=1;i<x.length;i++)G.lineTo(x[i],y[i]);G.closePath();}
function draw(){
  rings.clear();
  for(let k=0;k<hist.length;k++){
    poly(rings,hist[k].x,hist[k].y);
    rings.stroke({width:1,color:k%2?C.colors[1]:C.colors[4],alpha:0.14+0.07*k});
  }
  g.clear();
  if(X.length<3)return;
  poly(g,X,Y);
  g.fill({color:C.colors[0],alpha:0.16}).stroke({width:1.6,color:C.colors[0],alpha:0.95,join:'round'});
}
function layout(w,h){W=Math.max(1,w);H=Math.max(1,h);bg.clear().rect(0,0,W,H).fill(C.surface);seed();}
layout(s.width,s.height);
s.onResize(layout);
s.tick(function(time){
  if(s.reducedMotion){for(let k=0;k<700&&X.length<cap;k++)step();draw();return;}
  if(X.length>=cap){
    hold+=time.dt*Math.max(0.2,p.speed);
    g.alpha=rings.alpha=Math.max(0,1-Math.max(0,hold-4)/1.5);
    if(hold>5.6)seed();
  }else{
    acc=Math.min(6,acc+2*p.speed*Math.min(time.dt,0.05)*60);
    while(acc>=1){step();acc-=1;}
  }
  draw();
});
s.dispose(function(){X=[];Y=[];hist=[];});
`,
});
