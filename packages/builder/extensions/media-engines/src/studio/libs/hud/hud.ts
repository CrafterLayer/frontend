/*
  `s.lib.hud.create(s, options?)` (game libraries, 2026-10-12): an in-canvas heads-up display
  built from @pixi/ui widgets — health/xp bars, sliders, buttons, check boxes, scrolling lists and
  score text — stacked in the canvas corners, coloured from the site's tokens (the scene's
  palette) unless the scene passes its own theme.

    const hud = s.lib.hud.create(s);
    const hp = hud.bar({ label: 'Health', value: 100, max: 100 });          // topStart
    const score = hud.text('Score 0', { corner: 'topEnd' });
    hud.button({ label: 'Pause', corner: 'bottomEnd', onPress: pause });
    hp.value -= 10; score.text = 'Score 40';

  The HUD is for glanceable game state. Menus, forms, story text and anything a person must read
  or operate belong in accessible DOM; every canvas control here also has a keyboard path — a
  native control in a visually hidden panel that appears when focused (mirror.ts). start/end
  corners follow the page direction, the layout follows resizes, the editor canvas shows a still,
  inert HUD, and dispose() (also registered with s.dispose) removes canvas and DOM alike.
*/

import type { PixiContainer, PixiNamespace } from '../shared/pixi-types';
import { createMirrorPanel } from './mirror';
import type {
  Hud,
  HudCorner,
  HudOptions,
  HudSceneLike,
  HudTheme,
  HudWidget,
  UiClasses,
  UiView,
} from './types';
import {
  clamp,
  HUD_LIMITS,
  makeBar,
  makeButton,
  makeCheckbox,
  makeList,
  makeSlider,
  makeText,
  type HudContext,
} from './widgets';

const CORNERS: readonly HudCorner[] = [
  'topStart',
  'topEnd',
  'bottomStart',
  'bottomEnd',
  'top',
  'bottom',
];

function isElement(value: unknown): value is HTMLElement {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { appendChild?: unknown }).appendChild === 'function'
  );
}

function themeOf(scene: HudSceneLike, given: Partial<HudTheme> | undefined): HudTheme {
  const palette = scene.palette;
  const surface = given?.surface ?? palette?.surface ?? 0x0f172a;
  const text = given?.text ?? palette?.text ?? 0xf8fafc;
  return {
    surface,
    text,
    accent: given?.accent ?? palette?.accent ?? 0x7c3aed,
    track:
      given?.track ??
      (typeof surface === 'number' && typeof text === 'number'
        ? mix(surface, text, 0.22)
        : surface),
  };
}

function mix(a: number, b: number, t: number): number {
  const channel = (shift: number) =>
    Math.round(((a >> shift) & 255) * (1 - t) + ((b >> shift) & 255) * t) << shift;
  return channel(16) | channel(8) | channel(0);
}

export function createHud(
  PIXI: PixiNamespace,
  ui: UiClasses,
  // Authored scene code is plain JavaScript: the scene or the options may be anything.
  input: HudSceneLike | null | undefined,
  options: HudOptions = {},
): Hud {
  const scene = input;
  const stage = scene?.stage as PixiContainer | undefined;
  if (scene === null || scene === undefined || typeof stage?.addChild !== 'function')
    throw new TypeError('hud.create(s) needs the scene');
  const mount: unknown = options.root ?? scene.canvas?.parentElement;
  if (!isElement(mount)) throw new TypeError('hud.create(s) needs the scene (or { root })');
  const root = mount;
  const rtl = scene.rtl === true;
  const lang = (root.closest('[lang]')?.getAttribute('lang') ?? '').toLowerCase();
  const panel = createMirrorPanel(
    root,
    options.label ?? (lang.startsWith('ar') ? 'واجهة اللعبة' : 'Game HUD'),
  );
  const view = new PIXI.Container() as UiView;
  stage.addChild(view);
  const margin = clamp(options.margin, 12, 0, 200);
  const gap = clamp(options.gap, 8, 0, 100);
  const theme = Object.freeze(themeOf(scene, options.theme));
  const placed = new Map<HudWidget, HudCorner>();
  let disposed = false;

  function layout(): void {
    if (disposed) return;
    const width = scene?.width ?? 0;
    const height = scene?.height ?? 0;
    for (const corner of CORNERS) {
      let offset = margin;
      for (const [widget, at] of placed) {
        if (at !== corner) continue;
        const w = widget.width;
        const start = rtl ? width - margin - w : margin;
        const end = rtl ? margin : width - margin - w;
        widget.view.x = corner.endsWith('Start')
          ? start
          : corner.endsWith('End')
            ? end
            : (width - w) / 2;
        widget.view.y = corner.startsWith('top') ? offset : height - offset - widget.height;
        offset += widget.height + gap;
      }
    }
  }

  const context: HudContext = {
    PIXI,
    ui,
    theme,
    rtl,
    interactive: scene.editor !== true,
    reducedMotion: scene.reducedMotion === true,
    doc: root.ownerDocument,
    panel,
    makeText(text, style) {
      const made =
        typeof scene.text === 'function' ? scene.text(text, style) : new PIXI.Text({ text, style });
      return made as UiView & { text: string };
    },
    relayout: layout,
  };

  function add<T extends HudWidget>(make: () => T, corner: unknown): T {
    if (disposed) throw new Error('hud: this HUD was disposed');
    if (placed.size >= HUD_LIMITS.widgets)
      throw new RangeError(`hud: at most ${String(HUD_LIMITS.widgets)} widgets`);
    const widget = make();
    const dispose = widget.dispose.bind(widget);
    view.addChild(widget.view);
    placed.set(widget, CORNERS.includes(corner as HudCorner) ? (corner as HudCorner) : 'topStart');
    widget.dispose = () => {
      if (!placed.delete(widget)) return;
      dispose();
      layout();
    };
    layout();
    return widget;
  }

  function dispose(): void {
    if (disposed) return;
    for (const widget of [...placed.keys()]) widget.dispose();
    disposed = true;
    view.destroy({ children: true });
    panel.remove();
  }
  scene.onResize?.(layout);
  scene.dispose?.(dispose);

  return {
    view,
    theme,
    bar: (o) => add(() => makeBar(context, o), o.corner),
    slider: (o) => add(() => makeSlider(context, o), o.corner),
    button: (o) => add(() => makeButton(context, o), o.corner),
    checkbox: (o) => add(() => makeCheckbox(context, o), o.corner),
    list: (o) => add(() => makeList(context, o), o.corner),
    text: (value, o) => add(() => makeText(context, value, o), o?.corner),
    layout,
    dispose,
  };
}
