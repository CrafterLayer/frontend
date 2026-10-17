import { definePreset, range, sharedParams } from './define';

/**
 * Soft bodies. Each blob is a ring of small matter-js circles held to a centre and to each other
 * by springy constraints, so blobs squish against one another, the walls and the pointer (a
 * moving collider). Every node paints a soft disc; a metaball threshold shader (`#include noise`
 * wobbles the edge) melts the discs of each blob — and of touching blobs — into one gooey skin.
 */
export const SOFT_BLOB_CLUSTER = definePreset({
  id: 'soft-blob-cluster',
  name: { en: 'Soft blob cluster', ar: 'عنقود الكتل الطرية' },
  description: {
    en: 'Jelly-soft blobs that squish against each other and the pointer, melting together where they touch, in your palette.',
    ar: 'كتل طرية كالهلام تنضغط على بعضها وعلى المؤشر، وتذوب معاً حيث تتلامس، بألوان موقعك.',
  },
  tags: ['interactive', 'physics', 'generative', 'calm', 'background'],
  libs: ['kit', 'physics'],
  params: [
    ...sharedParams({ seed: 37 }),
    range('blobs', 'Blobs', 'عدد الكتل', 7, 3, 14, 1, 'look'),
    range('softness', 'Softness', 'الطراوة', 0.5, 0, 1, 0.05, 'motion'),
    range('merge', 'Merge', 'الاندماج', 0.6, 0, 1, 0.05, 'look'),
    range('size', 'Size', 'الحجم', 1, 0.5, 2, 0.05, 'look'),
  ],
  code: String.raw`
const p = ck.params({ palette: 'theme', seed: 37, speed: 1, density: 1, interactive: true, blobs: 7, softness: 0.5, merge: 0.6, size: 1 });
const s = await ck.scene({ libs: ['physics'], pointer: false });
const P = s.PIXI, M = s.lib.physics, pal = s.palette;
const engine = M.Engine.create({ gravity: { x: 0, y: 0.35, scale: 0.001 } });
s.dispose(() => { M.Composite.clear(engine.world, false); M.Engine.clear(engine); });

let walls = [];
function bounds(w, h) {
  if (walls.length) M.Composite.remove(engine.world, walls);
  const T = 200;
  walls = [
    M.Bodies.rectangle(w / 2, h + T / 2, w * 3, T, { isStatic: true }),
    M.Bodies.rectangle(w / 2, -T / 2, w * 3, T, { isStatic: true }),
    M.Bodies.rectangle(-T / 2, h / 2, T, h * 3, { isStatic: true }),
    M.Bodies.rectangle(w + T / 2, h / 2, T, h * 3, { isStatic: true }),
  ];
  M.Composite.add(engine.world, walls);
}
bounds(s.width, s.height);
s.onResize(bounds);
const hand = M.Bodies.circle(-999, -999, 46, { isStatic: true });
M.Composite.add(engine.world, hand);

const disc = new P.Graphics();
for (let i = 0; i <= 12; i++) disc.circle(64, 64, 64 - i * 5).fill({ color: 0xffffff, alpha: 0.12 });
const tex = s.app.renderer.generateTexture(disc);
disc.destroy();
s.dispose(() => tex.destroy(true));

const goo = new P.Container();
s.stage.addChild(goo);
const frag = [
  'in vec2 vTextureCoord;',
  'out vec4 finalColor;',
  'uniform sampler2D uTexture;',
  'uniform highp vec4 uInputSize;',
  'uniform float uTime;',
  'uniform float uEdge;',
  '#include noise',
  'void main(){',
  ' vec4 c=texture(uTexture,vTextureCoord);',
  ' vec2 px=vTextureCoord*uInputSize.xy;',
  ' float a=c.a+snoise(vec3(px*0.01,uTime*0.25))*0.035;',
  ' float m=smoothstep(uEdge-0.03,uEdge+0.03,a);',
  ' vec3 col=c.a>0.001?c.rgb/c.a:vec3(0.0);',
  ' float rim=1.0-smoothstep(uEdge,uEdge+0.35,a);',
  ' col=mix(col,min(col*1.25+0.12,vec3(1.0)),rim*0.55);',
  ' finalColor=vec4(col*m,m);',
  '}',
].join('\n');
const skin = s.shader(frag, { uEdge: 0.5 });
goo.filters = [skin];
s.dispose(() => { goo.filters = null; });

const B = Math.max(3, Math.min(16, Math.round(p.blobs * Math.sqrt(p.density))));
const K = s.quality < 1 ? 8 : 10, stiff = 0.02 + (1 - p.softness) * 0.2;
const blobs = [];
for (let b = 0; b < B; b++) {
  const R = Math.min(s.width, s.height) * 0.1 * p.size * s.rand(0.8, 1.25);
  const cx = s.width * (s.dir > 0 ? 0.15 + 0.7 * ((b + 0.5) / B) : 0.85 - 0.7 * ((b + 0.5) / B)), cy = s.height * s.rand(0.3, 0.7);
  const group = M.Body.nextGroup(true);
  const centre = M.Bodies.circle(cx, cy, R * 0.35, { collisionFilter: { group }, frictionAir: 0.02 });
  const nodes = [];
  const parts = [centre];
  for (let k = 0; k < K; k++) {
    const a = (k / K) * Math.PI * 2;
    const n = M.Bodies.circle(cx + Math.cos(a) * R, cy + Math.sin(a) * R, R * 0.22, { collisionFilter: { group }, frictionAir: 0.02, restitution: 0.2 });
    nodes.push(n);
    parts.push(n);
  }
  const links = [];
  for (let k = 0; k < K; k++) {
    links.push(M.Constraint.create({ bodyA: centre, bodyB: nodes[k], stiffness: stiff, damping: 0.08 }));
    links.push(M.Constraint.create({ bodyA: nodes[k], bodyB: nodes[(k + 1) % K], stiffness: stiff * 1.5, damping: 0.08 }));
  }
  M.Composite.add(engine.world, parts);
  M.Composite.add(engine.world, links);
  const color = pal.colors[b % 5];
  const sprites = parts.map((body, i) => {
    const sp = new P.Sprite(tex);
    sp.anchor.set(0.5);
    sp.tint = color;
    sp.scale.set((R * (i === 0 ? 1.1 : 0.62) * (0.8 + p.merge * 0.9)) / 64);
    goo.addChild(sp);
    return sp;
  });
  blobs.push({ centre, parts, sprites, ph: s.rand(0, 100) });
}
function layout(w, h) { goo.filterArea = new P.Rectangle(0, 0, w, h); }
layout(s.width, s.height);
s.onResize(layout);

// reduced motion: let the cluster settle before the single frame
if (s.reducedMotion) for (let i = 0; i < 240; i++) M.Engine.update(engine, 1000 / 60);

s.tick(({ t, dt }) => {
  const live = p.interactive && s.pointer.inside;
  M.Body.setPosition(hand, live ? { x: s.pointer.x, y: s.pointer.y } : { x: -999, y: -999 });
  if (!s.reducedMotion) {
    for (const b of blobs) {
      const c = b.centre, n = s.noise2(b.ph, t * 0.2 * p.speed), m = s.noise2(b.ph + 40, t * 0.2 * p.speed);
      M.Body.applyForce(c, c.position, { x: (n * 0.5 + 0.12 * s.dir) * c.mass * 0.0006, y: (m * 0.5 - 0.3) * c.mass * 0.0006 });
    }
    const ms = Math.min(dt, 1 / 30) * 1000 * p.speed;
    if (ms > 0.5) M.Engine.update(engine, ms);
  }
  for (const b of blobs) {
    for (let i = 0; i < b.parts.length; i++) b.sprites[i].position.set(b.parts[i].position.x, b.parts[i].position.y);
  }
});
`,
});
