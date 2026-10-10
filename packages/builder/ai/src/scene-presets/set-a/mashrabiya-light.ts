import { definePreset, range, select, sharedParams } from './define';

/**
 * A mashrabiya screen in front of a travelling sun: the lattice is a wood fill
 * with cut-out holes (star, hexagon or lozenge), God rays stream from the sun
 * through the holes, the light pattern falls onto the floor below, and dust
 * motes drift in the shafts. The pointer moves the sun.
 */
export const MASHRABIYA_LIGHT = definePreset({
  id: 'mashrabiya-light',
  name: { en: 'Mashrabiya light', ar: 'ضوء المشربية' },
  description: {
    en: 'Sunlight streams through a carved mashrabiya lattice and casts its pattern on the floor, with drifting dust in the shafts. The pointer moves the sun.',
    ar: 'ضوء الشمس ينساب عبر مشربية منحوتة ويلقي نقشها على الأرض، مع غبار يسبح في الأشعة، ويحرّك المؤشر الشمس.',
  },
  tags: ['arabic', 'geometric', 'light', 'hero', 'calm'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 8, interactive: true }),
    select(
      'lattice',
      'Lattice',
      'نقشة الشبك',
      'star',
      [
        ['star', 'Eight-point stars', 'نجوم ثمانية'],
        ['hex', 'Hexagons', 'سداسيات'],
        ['lozenge', 'Lozenges', 'معيّنات'],
      ],
      'look',
    ),
    range('cell', 'Lattice cell', 'خلية الشبك', 56, 24, 120, 2, 'look'),
    select(
      'sunPath',
      'Sun path',
      'مسار الشمس',
      'arc',
      [
        ['arc', 'Arc', 'قوس'],
        ['sweep', 'Level sweep', 'مسح أفقي'],
      ],
      'motion',
    ),
    range('shaftIntensity', 'Shaft intensity', 'شدّة الأشعة', 0.8, 0, 1.5, 0.05, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:8,speed:1,density:1,interactive:true,lattice:'star',cell:56,sunPath:'arc',shaftIntensity:0.8});
const s=await ck.scene({libs:['filters'],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,F=s.lib.filters,TAU=Math.PI*2;
const back=new PIXI.Graphics(),light=new PIXI.Container(),sun=new PIXI.Graphics(),screen=new PIXI.Graphics(),rim=new PIXI.Graphics();
const floor=new PIXI.Graphics(),spill=new PIXI.Graphics(),motes=new PIXI.Graphics();
light.addChild(sun);spill.blendMode='add';motes.blendMode='add';
s.stage.addChild(back,light,screen,rim,floor,spill,motes);
const rays=new F.GodrayFilter({parallel:false,center:{x:0,y:0},gain:0.6,lacunarity:2.8,alpha:p.shaftIntensity,time:0});
const soft=new PIXI.BlurFilter({strength:3});
light.filters=[rays];spill.filters=[soft];
const warm=C.mix(C.colors[1],0xffe2a8,0.6),wood=C.dark?C.mix(C.surface,0x000000,0.35):C.mix(C.text,C.colors[4],0.25);
let W=1,H=1,Ys=1,holes=[],dust=[],sx=0,sy=0;

function shape(cx,cy,n,R,r,rot){const v=[];for(let k=0;k<n*2;k++){const a=rot+Math.PI*k/n,q=k%2?r:R;v.push(cx+q*Math.cos(a),cy+q*Math.sin(a));}return v;}
function ngon(cx,cy,n,R,rot){const v=[];for(let k=0;k<n;k++){const a=rot+TAU*k/n;v.push(cx+R*Math.cos(a),cy+R*Math.sin(a));}return v;}
function build(w,h){
  W=Math.max(1,w);H=Math.max(1,h);Ys=H*0.74;
  const c=Math.max(16,p.cell/Math.sqrt(Math.max(0.2,p.density))),m=Math.max(12,c*0.35);
  holes=[];
  for(let y=m+c/2;y<Ys-m;y+=c)for(let x=m+c/2,i=0;x<W-m;x+=c,i++){
    if(p.lattice==='hex')holes.push(ngon(x+(Math.round(y/c)%2?c/2:0),y,6,c*0.4,Math.PI/6));
    else if(p.lattice==='lozenge')holes.push(ngon(x,y,4,c*0.42,0));
    else{holes.push(shape(x,y,8,c*0.4,c*0.4*0.765,0));if(x+c<W-m&&y+c<Ys-m)holes.push(ngon(x+c/2,y+c/2,4,c*0.12,0));}
  }
  back.clear().rect(0,0,W,Ys).fill(C.mix(warm,C.colors[0],0.3));
  screen.clear().rect(0,0,W,Ys).fill(wood);
  for(const v of holes)screen.poly(v);
  screen.cut();
  rim.clear();
  for(const v of holes)rim.poly(v);
  rim.stroke({width:2,color:C.mix(wood,0xffffff,0.22),alpha:0.7});
  rim.rect(0,0,W,Ys).stroke({width:m*0.8,color:C.mix(wood,0x000000,0.3)});
  light.filterArea=new PIXI.Rectangle(0,0,W,Ys);
  floor.clear().rect(0,Ys,W,H-Ys).fill(C.mix(wood,C.surface,0.55));
  dust=[];
  for(let i=0;i<s.count(70);i++)dust.push({x:s.rand(0,W),y:s.rand(Ys*0.2,H),r:s.rand(0.6,2),ph:s.rand(0,TAU)});
}
function sunAt(u){
  const x=W*(s.dir>0?0.12+0.76*u:0.88-0.76*u);
  const y=p.sunPath==='sweep'?Ys*0.22:Ys*(0.12+0.3*(1-Math.sin(u*Math.PI)));
  return [x,y];
}
build(s.width,s.height);
s.onResize(build);
s.tick(function(time){
  const T=s.reducedMotion?0:time.t*p.speed;
  let q=sunAt(s.reducedMotion?0.35:0.5-0.5*Math.cos(T*0.26));
  if(p.interactive&&s.pointer.inside&&!s.reducedMotion)q=[s.pointer.x,Math.min(s.pointer.y,Ys*0.6)];
  sx+=(q[0]-sx)*(sx?0.06:1);sy+=(q[1]-sy)*(sy?0.06:1);
  sun.clear();
  for(let i=7;i>=0;i--)sun.circle(sx,sy,Math.min(W,H)*(0.05+i*0.045)).fill({color:i?warm:0xffffff,alpha:i?0.1:0.95});
  rays.center={x:sx,y:sy};
  rays.time=T*0.4;
  spill.clear();
  for(const v of holes){
    const pts=[];
    for(let k=0;k<v.length;k+=2){
      const t=v[k+1]/Ys;
      pts.push(v[k]+(v[k]-sx)*0.35*(1-t),Ys+(H-Ys)*(0.08+0.9*(1-t))*0.9+(v[k+1]-Ys*0.5)*0.04);
    }
    spill.poly(pts);
  }
  spill.fill({color:warm,alpha:0.22*p.shaftIntensity});
  motes.clear();
  for(const d of dust){
    const x=(d.x+T*6*s.dir+W)%W,y=d.y+Math.sin(T*0.6+d.ph)*8;
    motes.circle(x,y,d.r).fill({color:warm,alpha:0.25+0.25*Math.sin(T*1.7+d.ph)});
  }
});
s.dispose(function(){light.filters=null;spill.filters=null;rays.destroy();soft.destroy();});
`,
});
