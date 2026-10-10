import { definePreset, range, sharedParams } from './define';

/**
 * Stained glass from Lloyd-relaxed Voronoi cells (`s.delaunay(...).voronoi`):
 * palette glass with a soft inner glint, dark lead came between the cells, and
 * God rays sweeping through. The pointer tilts the light.
 */
export const VORONOI_STAINED_GLASS = definePreset({
  id: 'voronoi-stained-glass',
  name: { en: 'Voronoi stained glass', ar: 'زجاج معشّق فورونوي' },
  description: {
    en: 'Relaxed Voronoi cells become a stained-glass window in your palette, with lead lines and light rays sweeping through. The pointer tilts the light.',
    ar: 'خلايا فورونوي مُرخاة تصير نافذة زجاج معشّق بألوانك، بخطوط رصاص وأشعة ضوء تعبرها، ويميل المؤشر الضوء.',
  },
  tags: ['geometric', 'light', 'generative', 'hero'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 17, interactive: true }),
    range('cells', 'Cells', 'عدد الخلايا', 160, 30, 600, 10, 'look'),
    range('relax', 'Relaxation', 'الإرخاء', 2, 0, 5, 1, 'look'),
    range('leadWidth', 'Lead width', 'سماكة الرصاص', 4, 1, 10, 0.5, 'look'),
    range('lightAngle', 'Light angle', 'زاوية الضوء', 30, -60, 60, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:17,speed:1,density:1,interactive:true,cells:160,relax:2,leadWidth:4,lightAngle:30});
const s=await ck.scene({libs:['filters'],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,F=s.lib.filters;
const glass=new PIXI.Container(),pane=new PIXI.Graphics(),glint=new PIXI.Graphics(),lead=new PIXI.Graphics();
glass.addChild(pane,glint,lead);
s.stage.addChild(glass);
const ray=new F.GodrayFilter({angle:p.lightAngle*s.dir,gain:0.55,lacunarity:2.6,parallel:true,time:0,alpha:0.85});
glass.filters=[ray];
const came=0x16141c;
let W=1,H=1,angle=p.lightAngle*s.dir;

function centroid(c){
  let a=0,x=0,y=0;
  for(let i=0;i<c.length;i+=2){
    const j=(i+2)%c.length,f=c[i]*c[j+1]-c[j]*c[i+1];
    a+=f;x+=(c[i]+c[j])*f;y+=(c[i+1]+c[j+1])*f;
  }
  if(Math.abs(a)<1e-6)return [c[0],c[1]];
  return [x/(3*a),y/(3*a)];
}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  const n=Math.max(8,s.count(p.cells));
  let pts=[];
  for(let i=0;i<n;i++)pts.push([s.rand(0,W),s.rand(0,H)]);
  let cells=[];
  const k=Math.max(0,Math.round(p.relax));
  for(let r=0;r<=k;r++){
    cells=s.delaunay(pts).voronoi([0,0,W,H]);
    if(r<k)pts=cells.map(function(c,i){return c&&c.length>=6?centroid(c):pts[i];});
  }
  pane.clear();glint.clear();lead.clear();
  pane.rect(0,0,W,H).fill(came);
  for(let i=0;i<cells.length;i++){
    const c=cells[i];
    if(!c||c.length<6)continue;
    const m=centroid(c),nz=s.noise2(m[0]*0.003,m[1]*0.003);
    const col=C.mix(C.colors[i%5],nz>0?C.colors[1]:C.colors[4],Math.abs(nz)*0.6);
    pane.poly(c).fill({color:col,alpha:0.94});
    glint.poly(c.map(function(v,j){return j%2?m[1]+(v-m[1])*0.55:m[0]+(v-m[0])*0.55;})).fill({color:0xffffff,alpha:0.06+0.1*s.random()});
    lead.poly(c);
  }
  lead.stroke({width:p.leadWidth,color:came,join:'round'});
  lead.rect(0,0,W,H).stroke({width:p.leadWidth*2.5,color:came});
}
build(s.width,s.height);
s.onResize(build);
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  let target=p.lightAngle*s.dir;
  if(p.interactive&&s.pointer.inside&&!s.reducedMotion)target+=(s.pointer.x/W-0.5)*40;
  angle+=(target-angle)*0.05;
  ray.angle=angle;
  ray.time=T*0.35;
  glint.alpha=0.75+0.25*Math.sin(T*0.8);
});
s.dispose(function(){glass.filters=null;ray.destroy();});
`,
});
