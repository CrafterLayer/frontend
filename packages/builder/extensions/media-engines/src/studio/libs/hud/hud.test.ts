import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakePixi } from '../shared/fake-pixi.test-util';
import type { PixiNamespace } from '../shared/pixi-types';
import { createHud } from './hud';
import type { HudSceneLike, UiClasses } from './types';
import { HUD_LIMITS } from './widgets';

/* Structural stand-ins for @pixi/ui: what the HUD constructs, sets and listens to. */
class FakeSignal<Args extends unknown[]> {
  readonly fns: ((...args: Args) => void)[] = [];

  connect(fn: (...args: Args) => void) {
    this.fns.push(fn);
    return {
      disconnect: () => {
        this.fns.splice(this.fns.indexOf(fn), 1);
      },
    };
  }

  emit(...args: Args): void {
    for (const fn of this.fns.slice()) fn(...args);
  }
}

function fakeUi(PIXI: PixiNamespace) {
  const Base = PIXI.Container as unknown as new () => { eventMode?: string };
  class ProgressBar extends Base {
    progress: number;

    constructor(readonly options: Record<string, unknown>) {
      super();
      this.progress = Number(options['progress']);
    }
  }
  class Slider extends Base {
    readonly onUpdate = new FakeSignal<[number]>();
    private current: number;

    constructor(readonly options: Record<string, unknown>) {
      super();
      this.current = Number(options['value']);
    }

    get value(): number {
      return this.current;
    }

    set value(next: number) {
      if (next === this.current) return;
      this.current = next;
      this.onUpdate.emit(next);
    }
  }
  class FancyButton extends Base {
    readonly onPress = new FakeSignal<unknown[]>();
    enabled = true;

    constructor(readonly options: Record<string, unknown>) {
      super();
    }
  }
  class CheckBox extends Base {
    readonly onCheck = new FakeSignal<[boolean]>();
    private on: boolean;

    constructor(readonly options: Record<string, unknown>) {
      super();
      this.on = options['checked'] === true;
    }

    get checked(): boolean {
      return this.on;
    }

    set checked(next: boolean) {
      if (next === this.on) return;
      this.on = next;
      this.onCheck.emit(next);
    }
  }
  class ScrollBox extends Base {
    readonly items: unknown[] = [];

    constructor(readonly options: Record<string, unknown>) {
      super();
    }

    addItems(items: unknown[]): void {
      this.items.push(...items);
    }

    removeItems(): void {
      this.items.length = 0;
    }
  }
  return { ProgressBar, Slider, FancyButton, CheckBox, ScrollBox };
}

/** The scene stand-in; its size changes to exercise the resize layout. */
interface TestScene extends Omit<HudSceneLike, 'width' | 'height'> {
  width: number;
  height: number;
}

function setup(scene: Partial<HudSceneLike> = {}, lang = 'en') {
  const { PIXI, app } = fakePixi();
  const ui = fakeUi(PIXI);
  const root = document.createElement('div');
  root.setAttribute('lang', lang);
  const canvas = document.createElement('canvas');
  root.appendChild(canvas);
  document.body.appendChild(root);
  const resizers: (() => void)[] = [];
  const disposers: (() => void)[] = [];
  const s: TestScene = Object.assign(
    {
      stage: app.stage,
      width: 400,
      height: 300,
      canvas,
      palette: { accent: 0xff0000, text: 0xffffff, surface: 0x000000 },
      onResize: (fn: () => void) => resizers.push(fn),
      dispose: (fn: () => void) => disposers.push(fn),
    },
    scene,
  );
  const hud = createHud(PIXI, ui as unknown as UiClasses, s, {});
  const panel = root.querySelector<HTMLElement>('[data-ck-hud]');
  return { PIXI, app, ui, root, s, hud, panel, resizers, disposers };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('hud — bars, layout and theme', () => {
  it('draws a progress bar from the theme and mirrors it as a labelled meter', () => {
    const { hud, panel } = setup();
    const hp = hud.bar({ label: 'Health', value: 40, max: 80 });
    const bar = (hp.view.children[1] as unknown as { children: unknown[] }).children[0] as {
      progress: number;
      eventMode: string;
    };
    expect(bar.progress).toBe(50);
    expect(bar.eventMode).toBe('none');
    const meter = panel?.querySelector('meter');
    expect(meter?.value).toBe(40);
    expect(meter?.max).toBe(80);
    expect(panel?.textContent).toContain('Health');
    hp.value = 100;
    expect(hp.value).toBe(80);
    expect(bar.progress).toBe(100);
    hp.max = 20;
    expect(hp.value).toBe(20);
    expect(meter?.textContent).toBe('20 / 20');
    expect(hud.theme).toMatchObject({ accent: 0xff0000, text: 0xffffff, surface: 0x000000 });
  });

  it('stacks widgets in direction-aware corners and follows resizes', () => {
    const { hud, s, resizers } = setup();
    const hp = hud.bar({ label: 'HP' });
    const xp = hud.bar({ label: 'XP', corner: 'topStart' });
    const pause = hud.button({ label: 'Pause', corner: 'bottomEnd' });
    expect([hp.view.x, hp.view.y]).toEqual([12, 12]);
    expect(xp.view.y).toBe(12 + hp.height + 8);
    expect([pause.view.x, pause.view.y]).toEqual([400 - 12 - 120, 300 - 12 - 44]);
    s.width = 600;
    for (const resize of resizers) resize();
    expect(pause.view.x).toBe(600 - 12 - 120);
  });

  it('mirrors the layout and the bar tracks under RTL, with an Arabic panel name', () => {
    const { hud, panel } = setup({ rtl: true }, 'ar');
    const hp = hud.bar({ label: 'الصحة', width: 100 });
    expect(hp.view.x).toBe(400 - 12 - 100);
    const holder = hp.view.children[1] as unknown as { scale: { x: number }; x: number };
    expect(holder.scale.x).toBe(-1);
    expect(holder.x).toBe(100);
    expect(panel?.getAttribute('aria-label')).toBe('واجهة اللعبة');
  });
});

describe('hud — controls and their keyboard path', () => {
  it('drives a slider from the canvas or the range input, calling back once per change', () => {
    const { hud, panel } = setup();
    const onChange = vi.fn();
    const volume = hud.slider({ label: 'Volume', min: 0, max: 1, step: 0.1, value: 0.5, onChange });
    const input = panel?.querySelector<HTMLInputElement>('input[type=range]');
    expect(input?.value).toBe('0.5');
    if (input !== null && input !== undefined) {
      input.value = '0.8';
      input.dispatchEvent(new Event('input'));
    }
    expect(onChange).toHaveBeenLastCalledWith(0.8);
    const slider = (volume.view.children[1] as unknown as { children: unknown[] }).children[0] as {
      onUpdate: FakeSignal<[number]>;
    };
    slider.onUpdate.emit(0.2);
    expect(input?.value).toBe('0.2');
    expect(volume.value).toBe(0.2);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('presses a button from the canvas or the DOM, never while disabled', () => {
    const { hud, panel } = setup();
    const onPress = vi.fn();
    const pause = hud.button({ label: 'Pause', onPress });
    const dom = panel?.querySelector<HTMLButtonElement>('button');
    expect(dom?.textContent).toBe('Pause');
    dom?.click();
    (pause.view as unknown as { onPress: FakeSignal<unknown[]> }).onPress.emit();
    expect(onPress).toHaveBeenCalledTimes(2);
    pause.enabled = false;
    dom?.click();
    expect(onPress).toHaveBeenCalledTimes(2);
    expect(dom?.disabled).toBe(true);
  });

  it('keeps a check box and its native checkbox in step', () => {
    const { hud, panel } = setup();
    const onChange = vi.fn();
    const music = hud.checkbox({ label: 'Music', checked: true, onChange });
    const input = panel?.querySelector<HTMLInputElement>('input[type=checkbox]');
    expect(input?.checked).toBe(true);
    if (input !== null && input !== undefined) {
      input.checked = false;
      input.dispatchEvent(new Event('change'));
    }
    expect(onChange).toHaveBeenCalledWith(false);
    music.checked = true;
    expect(input?.checked).toBe(true);
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('is a still, inert HUD on the editor canvas', () => {
    const { hud, panel } = setup({ editor: true });
    const onPress = vi.fn();
    const pause = hud.button({ label: 'Pause', onPress });
    hud.slider({ label: 'Volume' });
    expect((pause.view as unknown as { eventMode: string }).eventMode).toBe('none');
    const controls = panel?.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input');
    expect([...(controls ?? [])].every((control) => control.disabled)).toBe(true);
    (pause.view as unknown as { onPress: FakeSignal<unknown[]> }).onPress.emit();
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('hud — lists, text, bounds and disposal', () => {
  it('fills a scroll box and a DOM list, bounded, and scrolls only under the pointer', () => {
    const { hud, panel } = setup({ reducedMotion: true });
    const items = Array.from({ length: 150 }, (_, i) => `Item ${String(i)} ${'x'.repeat(100)}`);
    const bag = hud.list({ label: 'Inventory', items });
    expect(bag.items).toHaveLength(HUD_LIMITS.items);
    expect(bag.items[0]).toHaveLength(HUD_LIMITS.chars);
    const box = bag.view.children[1] as unknown as {
      items: unknown[];
      options: Record<string, unknown>;
    };
    expect(box.items).toHaveLength(HUD_LIMITS.items);
    expect(box.options).toMatchObject({ globalScroll: false, disableEasing: true });
    bag.items = ['Key', 'Map'];
    expect([...(panel?.querySelectorAll('li') ?? [])].map((li) => li.textContent)).toEqual([
      'Key',
      'Map',
    ]);
  });

  it('shows score text and keeps its DOM line current', () => {
    const { hud, panel } = setup();
    const score = hud.text('Score 0', { corner: 'topEnd' });
    score.text = 'Score 40';
    expect(panel?.querySelector('p')?.textContent).toBe('Score 40');
    expect((score.view as unknown as { text: string }).text).toBe('Score 40');
  });

  it('bounds the number of widgets and refuses a missing scene', () => {
    const { hud } = setup();
    for (let i = 0; i < HUD_LIMITS.widgets; i += 1) hud.text(String(i));
    expect(() => hud.text('one more')).toThrow(RangeError);
    const { PIXI } = fakePixi();
    expect(() => createHud(PIXI, {} as UiClasses, null)).toThrow(TypeError);
  });

  it('disposes with the scene: canvas, DOM and listeners, once', () => {
    const { hud, panel, root, disposers, app } = setup();
    const onPress = vi.fn();
    const pause = hud.button({ label: 'Pause', onPress });
    const hp = hud.bar({ label: 'HP' });
    hp.dispose();
    expect(panel?.querySelector('meter')).toBeNull();
    expect(disposers).toHaveLength(1);
    disposers[0]?.();
    hud.dispose();
    expect(root.querySelector('[data-ck-hud]')).toBeNull();
    expect(app.stage.children).toHaveLength(0);
    (pause.view as unknown as { onPress: FakeSignal<unknown[]> }).onPress.emit();
    expect(onPress).not.toHaveBeenCalled();
    expect(() => hud.bar({ label: 'HP' })).toThrow(/disposed/u);
  });
});
