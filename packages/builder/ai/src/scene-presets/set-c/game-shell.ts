/*
  The game shell (2026-10-13): the plain JavaScript every game kit shares, written once here and
  joined around each kit's own body, so all eight games agree on words, hooks, states, controls,
  sound, calm play and cleanup. It is ordinary scene code — the catalogue stores each kit's code
  whole, and the Studio shows it as written.

  A body defines six functions the shell calls — reset() for a new round, step(dt) to simulate
  while running, draw() to place what is drawn, idle(dt) for cosmetic motion, manual(code) for one
  reduced-motion step of a key, and point(x, y) for a tap on the playfield — plus `const STATS`, the
  stat keys the result line reads. It calls end(won), hud(key, value), tell(text), say(key),
  sfx(name), burst(x, y, colour, n), backdrop(top, bottom), hold(code, seconds) and listen(node,
  type, fn), and reads `mode` ('ready', 'running', 'paused', 'won', 'lost'). It draws with
  `gold` (reward), `danger` and `leaf` — palette colours leaning to gold, rose and green.

  States: ready → running ⇄ paused → won | lost → running (Start, Play again, Restart or Enter).
  The world is 1280 × 848 design units with the 1280 × 720 playfield (`field`) at y 64; the
  section's HUD and control rows sit over the two bands. The editor draws the ready frame and the
  buttons do nothing there; reduced motion runs no loop: each key, button or tap is one manual step
  and one render.
*/

/** Before the body: constants, words, the playfield, the stats, the status line and sound. */
export const GAME_SHELL_HEAD = String.raw`
// ── CraftKit game kit shell: words and hooks from the section, states, controls, sound ──
const P = s.PIXI, pal = s.palette, root = ck.root, calm = s.reducedMotion, live = !s.editor && !calm;
const W = 1280, H = 720, FY = 64;
const pace = Math.max(0.25, Number(p.speed) || 1);
const q = (sel) => root.querySelector(sel);
const part = (name) => q('[data-scene-part="' + name + '"]');
function say(key) {
  const item = q('[data-scene-part="says"] [data-scene-value="' + key + '"]');
  return item ? item.textContent.replace(/\s+/g, ' ').trim() : '';
}
// Reward, danger and life read the same in every game: the palette, leaning to gold, rose, green.
const gold = pal.mix(pal.colors[1], 0xfbbf24, 0.75), danger = pal.mix(pal.text, 0xf43f5e, 0.62), leaf = pal.mix(pal.colors[1], 0x22c55e, 0.6);
const field = new P.Container();
field.y = FY;
s.world.addChild(field);
const clip = new P.Graphics().roundRect(0, 0, W, H, 28).fill(0xffffff);
field.addChild(clip);
field.mask = clip;
function backdrop(top, bottom) {
  const fill = new P.FillGradient({ type: 'linear', start: { x: 0, y: 0 }, end: { x: 0, y: 1 }, colorStops: [{ offset: 0, color: top }, { offset: 1, color: bottom }] });
  s.dispose(() => fill.destroy());
  const g = new P.Graphics().rect(0, 0, W, H).fill(fill);
  field.addChild(g);
  return g;
}
s.canvas.setAttribute('role', 'img');
s.canvas.setAttribute('aria-label', [part('title'), part('intro')].map((n) => (n ? n.textContent.trim() : '')).filter(Boolean).join('. '));

// Every listener the kit adds to the page ends with the scene.
const listen = (node, type, fn) => {
  if (!node) return;
  node.addEventListener(type, fn);
  s.dispose(() => node.removeEventListener(type, fn));
};

// The stats row: only a changed value touches the page.
const shown = {};
function hud(name, value) {
  const text = String(value);
  if (shown[name] === text) return;
  shown[name] = text;
  const node = part(name);
  if (node) node.textContent = text;
}
function statText(name) {
  const node = part(name);
  if (!node) return '';
  const tag = node.previousElementSibling;
  return ((tag ? tag.textContent + ' ' : '') + node.textContent).trim();
}

// The polite status line: what changed, never every frame.
const statusLine = q('[data-game-status]');
let told = '';
function tell(text) {
  if (!statusLine || !text || text === told) return;
  told = text;
  statusLine.textContent = text;
}

// Sound only through the audio library, muted until the visitor presses Sound.
const audio = p.sound && !s.editor ? s.lib.audio.create(s, { muted: true }) : null;
const soundBtn = q('[data-game-action="sound"]');
if (soundBtn) soundBtn.hidden = !p.sound;
function sfx(name) {
  if (audio && !audio.muted) audio.sfx(name);
}

// Sparks: one shared shape, pooled, never in the editor or under reduced motion.
const sparkShape = new P.GraphicsContext().circle(0, 0, 6).fill(0xffffff);
const sparkLayer = new P.Container();
const sparks = [];
function burst(x, y, color, n) {
  if (!live) return;
  for (let i = 0; i < n; i++) {
    let o = sparks.find((k) => k.life <= 0);
    if (!o) {
      if (sparks.length >= 220) return;
      o = { g: new P.Graphics(sparkShape), life: 0, max: 1, vx: 0, vy: 0 };
      sparkLayer.addChild(o.g);
      sparks.push(o);
    }
    const a = s.rand(0, Math.PI * 2), v = s.rand(90, 360);
    o.vx = Math.cos(a) * v;
    o.vy = Math.sin(a) * v - 60;
    o.life = o.max = s.rand(0.35, 0.8);
    o.g.position.set(x, y);
    o.g.tint = color;
    o.g.scale.set(s.rand(0.4, 1.1));
    o.g.visible = true;
  }
}
function sparkStep(dt) {
  for (const o of sparks) {
    if (o.life <= 0) continue;
    o.life -= dt;
    o.vy += 520 * dt;
    o.g.x += o.vx * dt;
    o.g.y += o.vy * dt;
    o.g.alpha = Math.max(0, o.life / o.max);
    if (o.life <= 0) o.g.visible = false;
  }
}
s.dispose(() => sparkShape.destroy());
// ── the kit's own game ──
`;

/** After the body: states, buttons, keys, taps, the loop and the first frame. */
export const GAME_SHELL_TAIL = String.raw`
// ── CraftKit game kit shell: states and controls ──
let mode = 'ready';
const card = part('card'), message = part('message'), intro = part('intro');
const startBtn = q('[data-game-action="start"]'), pauseBtn = q('[data-game-action="pause"]');
const startText = startBtn ? startBtn.textContent : '';
function show(next, line) {
  mode = next;
  const over = next === 'won' || next === 'lost';
  if (card) card.hidden = next === 'running';
  if (intro) intro.hidden = over || next === 'paused';
  if (message) {
    message.textContent = line || '';
    message.hidden = !line;
  }
  if (startBtn) startBtn.textContent = next === 'paused' ? say('resume') || startText : over ? say('again') || startText : startText;
  if (pauseBtn) {
    pauseBtn.disabled = next !== 'running' && next !== 'paused';
    pauseBtn.setAttribute('aria-pressed', String(next === 'paused'));
  }
  // While a round runs, a finger on the playfield steers, swipes or taps instead of scrolling.
  if (!s.editor) s.canvas.style.touchAction = next === 'running' ? 'none' : '';
}
function paint() {
  draw();
  if (calm) s.app.render();
}
function focusPlay() {
  try {
    s.canvas.focus({ preventScroll: true });
  } catch (error) {
    // A canvas that cannot take focus still plays from the buttons.
  }
}
function begin() {
  s.input.clear();
  reset();
  show('running');
  tell(say('running'));
  sfx('click');
  focusPlay();
  paint();
}
function pause() {
  if (mode !== 'running') return;
  s.input.clear();
  show('paused', say('paused'));
  tell(say('paused'));
  paint();
}
function resume() {
  if (mode !== 'paused') return;
  show('running');
  tell(say('running'));
  focusPlay();
}
function summary() {
  return STATS.map(statText).filter(Boolean).join(' · ');
}
function end(won) {
  if (mode !== 'running') return;
  s.input.clear();
  const line = say(won ? 'won' : 'lost') + ' ' + summary();
  show(won ? 'won' : 'lost', line.trim());
  tell(line.trim());
  sfx(won ? 'win' : 'lose');
  if (won) for (let i = 0; i < 5; i++) burst(s.rand(160, W - 160), s.rand(120, H - 200), pal.colors[i % 5], 22);
  if (startBtn) startBtn.focus({ preventScroll: true });
  paint();
}
function advance(seconds) {
  for (let left = seconds; left > 1e-6 && mode === 'running'; left -= 1 / 60) step(Math.min(1 / 60, left));
}
function hold(code, seconds) {
  s.input.set(code, true);
  advance(seconds);
  s.input.set(code, false);
}

listen(startBtn, 'click', () => {
  if (s.editor) return;
  if (mode === 'paused') resume();
  else begin();
});
listen(q('[data-game-action="restart"]'), 'click', () => {
  if (!s.editor) begin();
});
listen(pauseBtn, 'click', () => {
  if (s.editor) return;
  if (mode === 'running') pause();
  else resume();
});
listen(soundBtn, 'click', () => {
  if (s.editor || !audio) return;
  if (audio.muted) audio.unmute();
  else audio.mute();
  soundBtn.setAttribute('aria-pressed', String(!audio.muted));
  sfx('click');
});
// Touch and mouse: a held button is a held key; a keyboard click (or reduced motion) is one step.
for (const button of root.querySelectorAll('[data-game-key]')) {
  const code = button.getAttribute('data-game-key');
  listen(button, 'pointerdown', (e) => {
    if (s.editor || mode !== 'running') return;
    try {
      button.setPointerCapture(e.pointerId);
    } catch (error) {
      // Capture is a nicety: the release listeners below still end the hold.
    }
    s.input.set(code, true);
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, type, () => s.input.set(code, false));
  listen(button, 'click', (e) => {
    if (s.editor || mode !== 'running') return;
    if (calm || e.detail === 0) {
      manual(code);
      paint();
    }
  });
}
// Keys reach the game only while its canvas has focus (s.input); P or Escape pause, Enter starts.
const PLAY_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'];
listen(s.canvas, 'keydown', (e) => {
  if (s.editor) return;
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (mode === 'running') pause();
    else resume();
    return;
  }
  if (e.code === 'Enter' || e.code === 'NumpadEnter') {
    if (mode === 'paused') resume();
    else if (mode !== 'running') begin();
    return;
  }
  if (calm && mode === 'running' && PLAY_KEYS.includes(e.code)) {
    e.preventDefault();
    manual(e.code);
    paint();
  }
});
// A tap on the playfield (design units, the field's own coordinates).
s.pointer.onDown((ptr) => {
  if (s.editor || mode !== 'running') return;
  const x = ptr.x, y = ptr.y - FY;
  if (x < 0 || y < 0 || x > W || y > H) return;
  point(x, y);
  if (calm) paint();
});
// A hidden page pauses the round rather than freezing it mid-move.
listen(document, 'visibilitychange', () => {
  if (document.hidden) pause();
});

field.addChild(sparkLayer);
s.world.addChild(new P.Graphics().roundRect(1.5, FY + 1.5, W - 3, H - 3, 27).stroke({ width: 3, color: pal.mix(pal.surface, pal.accent, 0.4) }));
reset();
show('ready');
if (!s.editor) s.input.down('Space');
draw();
if (live) {
  s.dispose(s.fixedTick((dt) => {
    if (mode === 'running') step(dt * pace);
  }, { step: 1 / 60, maxSteps: 5 }));
  s.tick(({ dt }) => {
    if (mode !== 'paused') {
      idle(dt);
      sparkStep(dt);
    }
    draw();
  });
} else if (calm) s.still(draw);
`;

/** A kit's whole body: the shell around the game. */
export function gameBody(game: string): string {
  return `${GAME_SHELL_HEAD.trim()}\n${game.trim()}\n${GAME_SHELL_TAIL.trim()}`;
}
