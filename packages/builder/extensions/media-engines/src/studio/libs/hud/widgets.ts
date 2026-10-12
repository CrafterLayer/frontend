/*
  The widgets of `s.lib.hud` (game libraries, 2026-10-12): @pixi/ui ProgressBar, Slider,
  FancyButton, CheckBox and ScrollBox drawn from the scene's theme colours, each with its DOM
  counterpart (mirror.ts). Under RTL the bar and slider tracks run from the right and labels align
  right; text itself is the scene's RTL-aware `s.text`. Inputs are bounded: sizes, 100 list items
  and 80 characters per label or item.
*/

import type { PixiGraphics, PixiNamespace } from '../shared/pixi-types';
import { listen, mirrorRow, type MirrorPanel } from './mirror';
import type {
  BarOptions,
  ButtonOptions,
  CheckOptions,
  HudBar,
  HudButton,
  HudCheck,
  HudList,
  HudSlider,
  HudText,
  HudTheme,
  ListOptions,
  SliderOptions,
  TextOptions,
  UiClasses,
  UiView,
} from './types';

export const HUD_LIMITS = Object.freeze({ widgets: 32, items: 100, chars: 80 });

export interface HudContext {
  readonly PIXI: PixiNamespace;
  readonly ui: UiClasses;
  readonly theme: HudTheme;
  readonly rtl: boolean;
  readonly interactive: boolean;
  readonly reducedMotion: boolean;
  readonly doc: Document;
  readonly panel: MirrorPanel;
  makeText(text: string, style: Record<string, unknown>): UiView & { text: string };
  /** Re-run the corner layout (a text widget changed width). */
  relayout(): void;
}

const LABEL = { fontSize: 13, fontWeight: '700' } as const;
const LINE = 20;

export const clamp = (value: unknown, fallback: number, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, value))
    : fallback;

export const words = (value: unknown): string =>
  (typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '').slice(
    0,
    HUD_LIMITS.chars,
  );

function graphics(ctx: HudContext): PixiGraphics {
  return new ctx.PIXI.Graphics();
}

/** The label row above a track; right-aligned under RTL. */
function labelled(ctx: HudContext, text: string, width: number, track: UiView): UiView {
  const view = new ctx.PIXI.Container() as UiView;
  const label = ctx.makeText(text, { ...LABEL, fill: ctx.theme.text });
  label.x = ctx.rtl ? Math.max(0, width - label.width) : 0;
  const holder = new ctx.PIXI.Container();
  holder.y = LINE + 4;
  holder.addChild(track);
  if (ctx.rtl) {
    holder.scale.x = -1;
    holder.x = width;
  }
  view.addChild(label);
  view.addChild(holder);
  return view;
}

function finish(ctx: HudContext, view: UiView, row: HTMLElement, cleanups: (() => void)[]) {
  ctx.panel.add(row);
  return () => {
    for (const cleanup of cleanups.splice(0)) cleanup();
    view.destroy({ children: true });
    row.remove();
  };
}

export function makeBar(ctx: HudContext, options: BarOptions): HudBar {
  const width = clamp(options.width, 180, 40, 600);
  const height = clamp(options.height, 14, 4, 64);
  let max = clamp(options.max, 100, 1e-6, 1e9);
  let value = clamp(options.value, max, 0, max);
  const radius = height / 2;
  const bg = graphics(ctx).roundRect(0, 0, width, height, radius).fill(ctx.theme.track);
  const fill = graphics(ctx)
    .roundRect(0, 0, width, height, radius)
    .fill(options.color ?? ctx.theme.accent);
  const bar = new ctx.ui.ProgressBar({ bg, fill, progress: (value / max) * 100 });
  bar.eventMode = 'none';
  const label = words(options.label);
  const view = labelled(ctx, label, width, bar);
  const meter = ctx.doc.createElement('meter');
  const sync = (): void => {
    bar.progress = (value / max) * 100;
    meter.max = max;
    meter.value = value;
    meter.textContent = `${String(Math.round(value))} / ${String(Math.round(max))}`;
  };
  meter.min = 0;
  sync();
  const row = mirrorRow(ctx.doc, label, meter, false);
  const dispose = finish(ctx, view, row, []);
  return {
    view,
    width,
    height: LINE + 4 + height,
    mirror: row,
    get value() {
      return value;
    },
    set value(next: number) {
      value = clamp(next, value, 0, max);
      sync();
    },
    get max() {
      return max;
    },
    set max(next: number) {
      max = clamp(next, max, 1e-6, 1e9);
      value = Math.min(value, max);
      sync();
    },
    dispose,
  };
}

export function makeSlider(ctx: HudContext, options: SliderOptions): HudSlider {
  const width = clamp(options.width, 180, 60, 600);
  const min = clamp(options.min, 0, -1e9, 1e9);
  const max = clamp(options.max, 1, min + 1e-6, 1e9);
  const step = clamp(options.step, (max - min) / 100, 1e-6, max - min);
  let value = clamp(options.value, min, min, max);
  const bg = graphics(ctx).roundRect(0, 0, width, 8, 4).fill(ctx.theme.track);
  const fill = graphics(ctx).roundRect(0, 0, width, 8, 4).fill(ctx.theme.accent);
  const handle = graphics(ctx)
    .circle(0, 0, 11)
    .fill(ctx.theme.accent)
    .stroke({ color: ctx.theme.surface, width: 2 });
  const slider = new ctx.ui.Slider({ bg, fill, slider: handle, min, max, step, value });
  slider.eventMode = ctx.interactive ? 'static' : 'none';
  const label = words(options.label);
  const view = labelled(ctx, label, width, slider);
  const input = ctx.doc.createElement('input');
  Object.assign(input, { type: 'range', min: String(min), max: String(max), step: String(step) });
  input.value = String(value);
  input.disabled = !ctx.interactive;
  const connection = slider.onUpdate.connect((next) => {
    if (next === value) return;
    value = next;
    input.value = String(next);
    options.onChange?.(next);
  });
  const cleanups = [
    () => connection.disconnect(),
    listen(input, 'input', () => {
      slider.value = Number(input.value);
    }),
  ];
  const row = mirrorRow(ctx.doc, label, input);
  const dispose = finish(ctx, view, row, cleanups);
  return {
    view,
    width,
    height: LINE + 4 + 22,
    mirror: row,
    get value() {
      return value;
    },
    set value(next: number) {
      slider.value = clamp(next, value, min, max);
    },
    dispose,
  };
}

export function makeButton(ctx: HudContext, options: ButtonOptions): HudButton {
  const width = clamp(options.width, 120, 44, 400);
  const height = clamp(options.height, 44, 32, 120);
  const face = (alpha: number) =>
    graphics(ctx).roundRect(0, 0, width, height, 12).fill({ color: ctx.theme.accent, alpha });
  const label = words(options.label);
  const text = ctx.makeText(label, { fontSize: 15, fontWeight: '700', fill: ctx.theme.surface });
  const button = new ctx.ui.FancyButton({
    defaultView: face(1),
    hoverView: face(0.88),
    pressedView: face(0.72),
    disabledView: face(0.4),
    text,
  });
  button.eventMode = ctx.interactive ? 'static' : 'none';
  let enabled = true;
  const dom = ctx.doc.createElement('button');
  dom.type = 'button';
  dom.textContent = label;
  dom.disabled = !ctx.interactive;
  const press = (): void => {
    if (enabled && ctx.interactive) options.onPress?.();
  };
  const connection = button.onPress.connect(press);
  const cleanups = [() => connection.disconnect(), listen(dom, 'click', press)];
  const dispose = finish(ctx, button, dom, cleanups);
  return {
    view: button,
    width,
    height,
    mirror: dom,
    get enabled() {
      return enabled;
    },
    set enabled(next: boolean) {
      enabled = next;
      button.enabled = next;
      dom.disabled = !next || !ctx.interactive;
    },
    dispose,
  };
}

export function makeCheckbox(ctx: HudContext, options: CheckOptions): HudCheck {
  const size = 26;
  const box = (on: boolean): PixiGraphics => {
    const drawn = graphics(ctx)
      .roundRect(0, 0, size, size, 7)
      .fill(on ? ctx.theme.accent : ctx.theme.track);
    if (on)
      drawn
        .moveTo(7, 13)
        .lineTo(11, 18)
        .lineTo(19, 8)
        .stroke({ color: ctx.theme.surface, width: 3 });
    return drawn;
  };
  let checked = options.checked === true;
  const check = new ctx.ui.CheckBox({
    style: { checked: box(true), unchecked: box(false) },
    checked,
  });
  check.eventMode = ctx.interactive ? 'static' : 'none';
  const label = words(options.label);
  const text = ctx.makeText(label, { ...LABEL, fontSize: 14, fill: ctx.theme.text });
  const view = new ctx.PIXI.Container() as UiView;
  view.addChild(check);
  view.addChild(text);
  const width = size + 10 + text.width;
  text.y = (size - text.height) / 2;
  if (ctx.rtl) check.x = width - size;
  else text.x = size + 10;
  const input = ctx.doc.createElement('input');
  input.type = 'checkbox';
  input.checked = checked;
  input.disabled = !ctx.interactive;
  const connection = check.onCheck.connect((state) => {
    if (state === checked) return;
    checked = state;
    input.checked = state;
    options.onChange?.(state);
  });
  const cleanups = [
    () => connection.disconnect(),
    listen(input, 'change', () => {
      check.checked = input.checked;
    }),
  ];
  const row = mirrorRow(ctx.doc, label, input);
  const dispose = finish(ctx, view, row, cleanups);
  return {
    view,
    width,
    height: size,
    mirror: row,
    get checked() {
      return checked;
    },
    set checked(next: boolean) {
      check.checked = next;
    },
    dispose,
  };
}

export function makeList(ctx: HudContext, options: ListOptions): HudList {
  const width = clamp(options.width, 180, 80, 600);
  const height = clamp(options.height, 140, 48, 800);
  const box = new ctx.ui.ScrollBox({
    width,
    height,
    background: ctx.theme.surface,
    radius: 10,
    elementsMargin: 4,
    padding: 8,
    globalScroll: false,
    disableEasing: ctx.reducedMotion,
  });
  box.eventMode = ctx.interactive ? 'static' : 'none';
  const label = words(options.label);
  const view = new ctx.PIXI.Container() as UiView;
  const title = ctx.makeText(label, { ...LABEL, fill: ctx.theme.text });
  title.x = ctx.rtl ? Math.max(0, width - title.width) : 0;
  box.y = LINE + 4;
  view.addChild(title);
  view.addChild(box);
  const list = ctx.doc.createElement('ul');
  let items: readonly string[] = [];
  const fill = (next: readonly string[]): void => {
    items = next.slice(0, HUD_LIMITS.items).map(words);
    box.removeItems();
    const inner = width - 16;
    box.addItems(
      items.map((item) => {
        const line = new ctx.PIXI.Container();
        const text = ctx.makeText(item, { fontSize: 14, fill: ctx.theme.text });
        text.x = ctx.rtl ? Math.max(0, inner - text.width) : 0;
        line.addChild(text);
        return line;
      }),
    );
    list.replaceChildren(
      ...items.map((item) => {
        const entry = ctx.doc.createElement('li');
        entry.textContent = item;
        return entry;
      }),
    );
  };
  fill(Array.isArray(options.items) ? options.items : []);
  const row = mirrorRow(ctx.doc, label, list, false);
  const dispose = finish(ctx, view, row, []);
  return {
    view,
    width,
    height: LINE + 4 + height,
    mirror: row,
    get items() {
      return items;
    },
    set items(next: readonly string[]) {
      fill(Array.isArray(next) ? next : []);
    },
    dispose,
  };
}

export function makeText(ctx: HudContext, value: string, options: TextOptions = {}): HudText {
  const size = clamp(options.size, 18, 8, 72);
  const text = ctx.makeText(words(value), {
    fontSize: size,
    fontWeight: '700',
    fill: options.color ?? ctx.theme.text,
  });
  const line = ctx.doc.createElement('p');
  line.textContent = text.text;
  const dispose = finish(ctx, text, line, []);
  return {
    view: text,
    get width() {
      return text.width;
    },
    height: Math.round(size * 1.3),
    mirror: line,
    get text() {
      return text.text;
    },
    set text(next: string) {
      const shown = words(next);
      if (shown === text.text) return;
      text.text = shown;
      line.textContent = shown;
      ctx.relayout();
    },
    dispose,
  };
}
