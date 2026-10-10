import { definePreset, range, select, sharedParams } from './define';

/**
 * Gray–Scott reaction–diffusion on the GPU: two `s.rt` render textures
 * ping-pong through an `s.shader` step. Each chemical is packed into two 8-bit
 * channels (16-bit precision without float textures), so it runs on every
 * WebGL device. A second shader maps the pattern to the palette with an emboss
 * light, like skin or coral. The pointer paints new growth.
 */
export const REACTION_DIFFUSION_SKIN = definePreset({
  id: 'reaction-diffusion-skin',
  name: { en: 'Reaction–diffusion skin', ar: 'جلد التفاعل والانتشار' },
  description: {
    en: 'Gray–Scott chemistry simulated on the GPU grows coral, mitosis, maze or spot patterns with an embossed sheen. Paint new growth with the pointer.',
    ar: 'كيمياء غراي-سكوت تُحاكى على معالج الرسوميات فتنمو أنماط المرجان والانقسام والمتاهة والبقع بلمعة بارزة، وارسم نموّاً جديداً بالمؤشر.',
  },
  tags: ['generative', 'interactive', 'background', 'loop'],
  libs: ['kit'],
  params: [
    ...sharedParams({ seed: 13, interactive: true }),
    select(
      'pattern',
      'Pattern',
      'النمط',
      'coral',
      [
        ['coral', 'Coral', 'مرجان'],
        ['mitosis', 'Mitosis', 'انقسام'],
        ['maze', 'Maze', 'متاهة'],
        ['spots', 'Spots', 'بقع'],
        ['waves', 'Waves', 'أمواج'],
        ['custom', 'Custom feed/kill', 'تغذية وإزالة مخصّصتان'],
      ],
      'look',
    ),
    range('feed', 'Feed (custom)', 'التغذية (مخصّص)', 0.0545, 0.01, 0.08, 0.0005, 'look'),
    range('kill', 'Kill (custom)', 'الإزالة (مخصّص)', 0.062, 0.04, 0.07, 0.0005, 'look'),
    range('cell', 'Cell size', 'حجم الخلية', 2, 1, 4, 1, 'look'),
  ],
  code: String.raw`
const p=ck.params({palette:'theme',seed:13,speed:1,density:1,interactive:true,pattern:'coral',feed:0.0545,kill:0.062,cell:2});
const s=await ck.scene({libs:[],seed:p.seed});
const PIXI=s.PIXI,C=s.palette,R=s.app.renderer;
const FK={coral:[0.0545,0.062],mitosis:[0.0367,0.0649],maze:[0.029,0.057],spots:[0.035,0.065],waves:[0.014,0.045]}[p.pattern]||[p.feed,p.kill];
function f(x){return (+x).toFixed(4);}
function v3(c){return 'vec3('+[16,8,0].map(function(b){return ((c>>b&255)/255).toFixed(3);}).join(',')+')';}
const head='in vec2 vTextureCoord;\nout vec4 finalColor;\nuniform sampler2D uTexture;\nuniform vec4 uInputSize;\nuniform vec4 uOutputFrame;\n';
const codec='vec2 M;vec2 E;\nvec2 dec(vec4 c){return vec2(c.r+c.g/255.,c.b+c.a/255.);}\nvec4 enc(vec2 v){v=clamp(v,0.,1.);vec2 h=floor(v*255.)/255.;vec2 l=fract(v*255.);return vec4(h.x,l.x,h.y,l.y);}\n';
const res0=s.rt(1,1).source.resolution||1;
const step=s.shader(head+'uniform float uBx;\nuniform float uBy;\nuniform float uBr;\n'+codec+
  'vec2 at(vec2 uv,vec2 o){return dec(texture(uTexture,clamp(uv+o*E,E*.5,M-E*.5)));}\n'+
  'void main(){E=uInputSize.zw/'+f(res0)+';M=uOutputFrame.zw*uInputSize.zw;vec2 uv=vTextureCoord;\n'+
  'vec2 c=at(uv,vec2(0.));\n'+
  'vec2 l=-c+.2*(at(uv,vec2(1.,0.))+at(uv,vec2(-1.,0.))+at(uv,vec2(0.,1.))+at(uv,vec2(0.,-1.)))+.05*(at(uv,vec2(1.))+at(uv,vec2(-1.))+at(uv,vec2(1.,-1.))+at(uv,vec2(-1.,1.)));\n'+
  'float r=c.x*c.y*c.y;\n'+
  'vec2 n=c+vec2(l.x-r+'+f(FK[0])+'*(1.-c.x),.5*l.y+r-('+f(FK[0]+FK[1])+')*c.y);\n'+
  'if(uBr>0.&&distance(uv/M*uOutputFrame.zw,vec2(uBx,uBy))<uBr)n.y=.9;\n'+
  'finalColor=enc(n);}',{uBx:0,uBy:0,uBr:0});
const seedFx=s.shader(head+'#include noise\n'+codec+
  'void main(){M=uOutputFrame.zw*uInputSize.zw;vec2 px=vTextureCoord/M*uOutputFrame.zw;\n'+
  'float n=snoise(vec3(px*.045,'+f(s.rand(0,50))+'))+.4*snoise(vec3(px*.17,'+f(s.rand(50,99))+'));\n'+
  'float b=step(.72,n);finalColor=enc(vec2(1.-b*.5,b*.25));}');
const look=s.shader(head+codec+
  'float B(vec2 uv){vec4 c=texture(uTexture,clamp(uv,E*.5,M-E*.5));return c.b+c.a/255.;}\n'+
  'void main(){E=uInputSize.zw;M=uOutputFrame.zw*uInputSize.zw;vec2 uv=vTextureCoord;\n'+
  'float b=B(uv);float gx=B(uv+vec2(E.x*2.,0.))-B(uv-vec2(E.x*2.,0.));float gy=B(uv+vec2(0.,E.y*2.))-B(uv-vec2(0.,E.y*2.));\n'+
  'vec3 nm=normalize(vec3(-gx*7.*'+s.dir+'.,-gy*7.,1.));float li=dot(nm,normalize(vec3(-.5*'+s.dir+'.,-.6,.8)));\n'+
  'float v=smoothstep(.08,.3,b);vec3 col=mix('+v3(C.surface)+',mix('+v3(C.colors[4])+','+v3(C.colors[1])+',smoothstep(.2,.38,b)),v);\n'+
  'col*=.8+.4*li;col+=pow(max(li,0.),18.)*.22*v;finalColor=vec4(col,1.);}');
function uniforms(filter){const r=filter.resources||{};for(const k in r){const q=r[k];if(q&&q.uniforms&&'uBr' in q.uniforms)return q.uniforms;}return null;}
const u=uniforms(step);
step.resolution=res0;seedFx.resolution=res0;
const sim=new PIXI.Sprite(),view=new PIXI.Sprite();
sim.filters=[step];view.filters=[look];
s.stage.addChild(view);
let W=1,H=1,sw=1,sh=1,a=null,b=null,fresh=true,acc=0;

function layout(w,h){
  W=Math.max(1,w);H=Math.max(1,h);
  const cell=Math.max(1,Math.round(p.cell))/Math.sqrt(Math.max(0.25,s.quality));
  sw=Math.max(8,Math.ceil(W/cell/res0));sh=Math.max(8,Math.ceil(H/cell/res0));
  a=s.rt(sw,sh);b=s.rt(sw,sh);
  const seedSprite=new PIXI.Sprite(PIXI.Texture.WHITE);
  seedSprite.width=sw;seedSprite.height=sh;seedSprite.filters=[seedFx];
  R.render({container:seedSprite,target:a,clear:true});
  seedSprite.destroy();
  view.texture=a;view.width=W;view.height=H;
  fresh=true;
}
function run(n){
  for(let i=0;i<n;i++){sim.texture=a;R.render({container:sim,target:b,clear:true});const t=a;a=b;b=t;}
  view.texture=a;view.width=W;view.height=H;
}
layout(s.width,s.height);
s.onResize(layout);
s.tick(function(time){
  if(fresh){fresh=false;run(s.reducedMotion?800:160);return;}
  if(s.reducedMotion)return;
  if(u){
    const on=p.interactive&&(s.pointer.down||s.pointer.inside);
    u.uBx=s.pointer.x*sw/W;u.uBy=s.pointer.y*sh/H;u.uBr=on?(s.pointer.down?6:3):0;
  }
  acc=Math.min(24,acc+8*p.speed*Math.min(time.dt,0.05)*60);
  const n=Math.floor(acc);acc-=n;
  if(n>0)run(n);
});
s.dispose(function(){sim.filters=null;view.filters=null;sim.destroy();});
`,
});
