import { definePreset, range, sharedParams, toggle } from './define';

/**
 * Flying through stars. A 3D starfield (particles projected from x/z, stretched into streaks by
 * speed) over an fbm nebula drawn in a fragment shader (`#include noise`, the kit's stegu
 * simplex). Scrolling the page — or holding the pointer down — throws it into warp: streaks
 * lengthen and a ZoomBlur pulls toward the vanishing point, which steers toward the pointer.
 */
export const STARFIELD_WARP = definePreset({
  id: 'starfield-warp',
  name: { en: 'Starfield warp', ar: 'قفزة النجوم' },
  description: {
    en: 'A deep starfield over a drifting nebula that jumps to warp speed when you scroll or hold the pointer down, steering toward it.',
    ar: 'حقل نجوم عميق فوق سديم منساب، يقفز إلى سرعة الالتواء حين تمرّر الصفحة أو تضغط بالمؤشر، ويتّجه نحوه.',
  },
  tags: ['interactive', 'particles', 'light', 'hero', 'bold'],
  libs: ['kit', 'filters'],
  params: [
    ...sharedParams({ seed: 23 }),
    toggle('warpOnScroll', 'Warp on scroll', 'الالتواء مع التمرير', true, 'interaction'),
    range('nebula', 'Nebula', 'السديم', 0.6, 0, 1, 0.05, 'look'),
    range('cruise', 'Cruise speed', 'سرعة التجوال', 0.2, 0, 1, 0.05, 'motion'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 23, speed: 1, density: 1, interactive: true, warpOnScroll: true, nebula: 0.6, cruise: 0.2 });
const s = await ck.scene({ libs: ['filters'], pointer: false });
const P = s.PIXI, F = s.lib.filters, pal = s.palette;
function rgb(n) { return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]; }
const deep = rgb(pal.dark ? pal.surface : 0x05060f);

const frag = [
  'in vec2 vTextureCoord;',
  'out vec4 finalColor;',
  'uniform vec4 uInputSize;',
  'uniform vec4 uOutputFrame;',
  'uniform float uTime;',
  'uniform float uNebula;',
  'uniform float uDrift;',
  'uniform vec3 uDeep;',
  'uniform vec3 uA;',
  'uniform vec3 uB;',
  '#include noise',
  'float fbm(vec3 q){float a=0.5,v=0.0;for(int i=0;i<5;i++){v+=a*snoise(q);q=q*2.02+vec3(3.1,1.7,5.3);a*=0.5;}return v;}',
  'void main(){',
  ' vec2 uv=vTextureCoord*uInputSize.xy/uOutputFrame.zw;',
  ' vec2 q=(uv-0.5)*vec2(uOutputFrame.z/max(uOutputFrame.w,1.0),1.0)*2.2;',
  ' float t=uTime*0.03;',
  ' float n=fbm(vec3(q+vec2(uDrift*t,0.0),t));',
  ' float m=fbm(vec3(q*1.7+n,t*1.3+4.0));',
  ' float d=smoothstep(-0.15,0.85,n*0.6+m*0.5)*uNebula;',
  ' vec3 col=mix(uDeep,mix(uA,uB,clamp(m+0.5,0.0,1.0)),d);',
  ' col+=pow(d,3.0)*0.35;',
  ' finalColor=vec4(col,1.0);',
  '}',
].join('\n');
const neb = s.shader(frag, { uNebula: p.nebula, uDrift: s.dir, uDeep: deep, uA: rgb(pal.colors[0]), uB: rgb(pal.colors[4]) });
const sky = new P.Graphics();
sky.filters = [neb];
s.stage.addChild(sky);
s.dispose(() => { sky.filters = null; });

const streak = new P.Graphics();
for (let i = 0; i <= 5; i++) streak.roundRect(i * 2, 3 - (3 - i * 0.5), 32 - i * 2, (3 - i * 0.5) * 2, 3).fill({ color: 0xffffff, alpha: 0.18 + i * 0.1 });
const tex = s.app.renderer.generateTexture(streak);
streak.destroy();
s.dispose(() => tex.destroy(true));
const field = new P.Container();
s.stage.addChild(field);
const pc = new P.ParticleContainer({ dynamicProperties: { position: true, rotation: true, vertex: true, color: true, uvs: false } });
field.addChild(pc);
const zoom = new F.ZoomBlurFilter({ strength: 0, center: { x: s.width / 2, y: s.height / 2 }, innerRadius: 60 });
zoom.enabled = false;
field.filters = [zoom];
s.dispose(() => { field.filters = null; });

const N = Math.min(2400, s.count(700));
const stars = [];
const tints = [0xffffff, pal.colors[1], pal.mix(0xffffff, pal.colors[0], 0.4)];
for (let i = 0; i < N; i++) {
  const q = new P.Particle({ texture: tex, x: 0, y: 0, anchorX: 1, anchorY: 0.5, scaleX: 0.2, scaleY: 0.4, tint: tints[i % 3] });
  pc.addParticle(q);
  stars.push({ q, x: s.rand(-1, 1), y: s.rand(-1, 1), z: s.rand(0.05, 1) });
}
function layout(w, h) {
  sky.clear().rect(0, 0, w, h).fill(0xffffff);
  pc.boundsArea = new P.Rectangle(0, 0, w, h);
}
layout(s.width, s.height);
s.onResize(layout);

let warp = p.cruise, last = s.scroll.progress, sv = 0, cx = s.width / 2, cy = s.height / 2;
s.tick(({ t, dt }) => {
  const w = s.width, h = s.height, f = Math.min(w, h) * 0.55;
  if (dt > 0) {
    sv += (Math.min(3, Math.abs(s.scroll.progress - last) / dt) - sv) * Math.min(1, dt * 4);
    last = s.scroll.progress;
  }
  const live = p.interactive && s.pointer.inside;
  const want = p.cruise + (p.warpOnScroll ? sv * 1.2 : 0) + (live && s.pointer.down ? 1.4 : 0);
  warp += (Math.min(2.2, want) - warp) * (s.reducedMotion ? 1 : Math.min(1, dt * 2.5));
  const tx = w / 2 + (live ? (s.pointer.x - w / 2) * 0.18 : Math.sin(t * 0.07) * w * 0.04 * s.dir);
  const ty = h / 2 + (live ? (s.pointer.y - h / 2) * 0.18 : Math.cos(t * 0.05) * h * 0.03);
  const e = s.reducedMotion ? 1 : Math.min(1, dt * 3);
  cx += (tx - cx) * e;
  cy += (ty - cy) * e;
  const vz = (0.05 + warp * 0.9) * p.speed * dt;
  for (const st of stars) {
    st.z -= vz;
    let sx = cx + (st.x / st.z) * f, sy = cy + (st.y / st.z) * f;
    if (st.z < 0.03 || sx < -60 || sx > w + 60 || sy < -60 || sy > h + 60) {
      st.x = s.rand(-1, 1); st.y = s.rand(-1, 1); st.z = s.rand(0.7, 1);
      sx = cx + (st.x / st.z) * f; sy = cy + (st.y / st.z) * f;
    }
    const near = 1 - st.z;
    st.q.x = sx;
    st.q.y = sy;
    st.q.rotation = Math.atan2(sy - cy, sx - cx);
    st.q.scaleX = 0.08 + near * (0.2 + warp * 2.4 * near);
    st.q.scaleY = 0.25 + near * 0.55;
    st.q.alpha = Math.min(1, near * 1.6);
  }
  zoom.center = { x: cx, y: cy };
  zoom.strength = Math.max(0, warp - 0.35) * 0.16;
  zoom.enabled = zoom.strength > 0.01;
});
`,
});
