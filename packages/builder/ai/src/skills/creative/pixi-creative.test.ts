import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

import { beforeAll, describe, expect, it, vi } from 'vitest';

import { createCraftkitAiSkillRegistry } from '../index';
import {
  PIXI_CREATIVE_SKILLS,
  PIXI_GAME_CONTROLS,
  PIXI_GAME_EXAMPLE,
  PIXI_MURAL_EXAMPLE,
  PIXI_STORY_CONTROLS,
  PIXI_STORY_EXAMPLE,
} from './pixi-creative';
import { pixiSkillExamples } from './pixi-v8';

const CORE = 'craftkit.pixi-v8-core';
const GAME = 'craftkit.pixi-games';
const STORY = 'craftkit.pixi-stories';
const MURAL = 'craftkit.pixi-murals';
const CREATIVE_IDS = PIXI_CREATIVE_SKILLS.map(({ id }) => id);

function activeIds(request: string): readonly string[] {
  return createCraftkitAiSkillRegistry()
    .prepare({ request })
    .active.map(({ id }) => id);
}

describe('Pixi creative skills — actual prompt activation', () => {
  it.each([
    ['Build a playable 2D game with start and restart', GAME],
    ['Make a game with a collecting objective', GAME],
    ['صمم لعبة تفاعلية لجمع النجوم', GAME],
    ['اعمل لعبة سيارات بسيطة', GAME],
    ['بدي لعبة تجمع فيها نجوم', GAME],
    ['بدي ألعاب تفاعلية احترافية', GAME],
    ['Create an interactive story about a traveller', STORY],
    ['A visual narrative with chapter scenes', STORY],
    ['اعمل قصة تفاعلية بالعربي', STORY],
    ['بدي قصص تفاعلية للأطفال', STORY],
    ['An illustrated generative art mural', MURAL],
    ['اعمل جداريات فنية بالألوان', MURAL],
  ])('activates %s with core and graphic guidance', (request, expected) => {
    expect(activeIds(request)).toEqual(
      expect.arrayContaining([CORE, 'craftkit.pixi-v8-graphics', expected]),
    );
  });

  it.each([
    'Build a landing page for our game studio',
    'Build a game studio landing page',
    'Create a game store website',
    'Make a game studio portfolio',
    'Add our story to the company about section',
    'Rewrite the customer success story',
    'Make the hero more professional',
    'صمم صفحة هبوط لمتجر ألعاب',
    'ابني موقع لاستوديو ألعاب',
    'اعمل متجر ألعاب إلكتروني',
    'صمم صفحة أعمال لاستوديو ألعاب',
    'بدي موقع لمتجر ألعاب',
    'بدي ألعاب لمتجري مع وصف المنتجات',
    'ضيف قصة الشركة في قسم من نحن',
    'اكتب قصة نجاح العميل',
  ])('does not activate scene playbooks for unrelated copy: %s', (request) => {
    expect(activeIds(request).filter((id) => id.startsWith('craftkit.pixi-'))).toEqual([]);
  });

  it('keeps dependency authority, canonical fingerprints and single-skill budget gates', () => {
    const registry = createCraftkitAiSkillRegistry();
    for (const skill of PIXI_CREATIVE_SKILLS) {
      expect(skill.dependencies).toEqual([CORE]);
      expect(skill.restrictToCommands).toBeUndefined();
      const prepared = registry.prepare({
        request: '',
        auto: false,
        selectedSkillIds: [skill.id],
      });
      expect(prepared.omitted).toEqual([]);
      expect(prepared.totalTokens).toBeLessThan(2_800);
      expect(prepared.active.find(({ id }) => id === skill.id)?.contentFingerprint).toMatch(
        /^skill-v1-sha256-[0-9a-f]{64}$/u,
      );
    }
  });

  it('fits a broad creative request without losing its specialized playbooks', () => {
    const prepared = createCraftkitAiSkillRegistry().prepare({
      request:
        'An interactive story, a playable 2D game and an interactive mural in PixiJS with sprites, particles and shaders',
    });
    expect(prepared.active.map(({ id }) => id)).toEqual(expect.arrayContaining(CREATIVE_IDS));
    expect(prepared.omitted).toEqual([]);
    expect(prepared.totalTokens).toBeLessThan(11_000);
  });

  it('ships opt-in, runtime-only and operational accessibility rules in every skill', () => {
    for (const skill of PIXI_CREATIVE_SKILLS) {
      expect(skill.instructions).toMatch(/(?:FREE CODE|Free code) OFF/u);
      expect(skill.instructions).toContain('media.add');
      expect(skill.instructions).toContain('ck.scene');
      expect(skill.instructions).toContain('s.dispose');
      expect(skill.instructions).toMatch(/(?:DOM|tree)/u);
      expect(skill.instructions).toMatch(/(?:reduced motion|reduced-motion)/u);
      expect(skill.instructions).toContain('CDN');
    }
    expect(PIXI_GAME_CONTROLS).toContain("aria-label='Game controls'");
    expect(PIXI_STORY_CONTROLS).toContain("aria-label='Story navigation'");
  });

  it('teaches calm bedtime pacing and an optional, visible read-aloud toggle', () => {
    const story = PIXI_CREATIVE_SKILLS.find(({ id }) => id === STORY)?.instructions ?? '';
    expect(story).toContain('BEDTIME');
    expect(story).toMatch(/no flash, shake, sudden sound, timer or auto-advance/u);
    expect(story).toContain('speechSynthesis');
    expect(PIXI_STORY_CONTROLS).toContain("data-story-voice aria-pressed='false'");
    // Silent until pressed, cancelled on page change and dispose, hidden where unsupported.
    expect(PIXI_STORY_EXAMPLE).toContain('if(reading)speak(i)');
    expect(PIXI_STORY_EXAMPLE).toContain('speech?.cancel()');
    expect(PIXI_STORY_EXAMPLE).toContain('voice.hidden=!speech');
  });
});

const AsyncFunction = (
  Object.getPrototypeOf(async function () {
    /* Compile the actual plain JS code-body contract. */
  }) as { constructor: new (name: string, body: string) => (ck: unknown) => Promise<unknown> }
).constructor;

const EXAMPLES = [
  { id: GAME, code: PIXI_GAME_EXAMPLE },
  { id: STORY, code: PIXI_STORY_EXAMPLE },
  { id: MURAL, code: PIXI_MURAL_EXAMPLE },
];

describe('Pixi creative skills — examples are exact, executable scene bodies', () => {
  it.each(EXAMPLES)(
    '$id compiles without deprecated Pixi stage or arbitrary package access',
    ({ code }) => {
      expect(() => new AsyncFunction('ck', code)).not.toThrow();
      expect(code).toContain('ck.scene(');
      expect(code).not.toMatch(
        /new P(?:IXI)?\.Application|app\.init|app\.view|\b(?:beginFill|endFill|drawRect|drawCircle|lineStyle)\b|\bimport\s*\(|https?:\/\//u,
      );
    },
  );

  it('teaches the exported examples rather than untested replacement snippets', () => {
    for (const skill of PIXI_CREATIVE_SKILLS) {
      const code = EXAMPLES.find(({ id }) => id === skill.id)?.code;
      expect(pixiSkillExamples(skill)).toEqual([code?.replace(/\n\s*/gu, ' ')]);
    }
  });
});

interface DisplayObject {
  x: number;
  y: number;
  visible: boolean;
  readonly children: readonly DisplayObject[];
  destroy(options?: { children: boolean }): void;
}

interface PixiNamespace {
  readonly Container: new () => DisplayObject;
}

class Control extends EventTarget {
  textContent = '';
  disabled = false;
  constructor(readonly code: string | null = null) {
    super();
  }
  getAttribute(): string | null {
    return this.code;
  }
  setPointerCapture(): void {
    /* Native pointer ownership is exercised by the browser runtime gate. */
    this.pointerCaptureCount += 1;
  }
  pointerCaptureCount = 0;
  click(): void {
    if (!this.disabled) this.dispatchEvent(Object.assign(new Event('click'), { detail: 0 }));
  }
}

interface Chapter {
  id: string;
  enter?: () => void;
  leave?: () => void;
}

/** Structural host only. Pixi objects are real; lifecycle/keyboard/GPU belong to runtime/browser tests. */
function harness(PIXI: PixiNamespace, reducedMotion = false, editor = false) {
  const controls = new Map<string, Control>();
  const buttons = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].map(
    (code) => new Control(code),
  );
  for (const action of ['start', 'pause', 'restart']) {
    controls.set(`[data-game-action=${action}]`, new Control());
  }
  for (const action of ['back', 'next', 'reset']) {
    controls.set(`[data-story-action=${action}]`, new Control());
  }
  for (const name of ['game-status', 'story-title', 'story-copy', 'story-status']) {
    controls.set(`[data-${name}]`, new Control());
  }
  const held = new Set<string>();
  const disposers: (() => void)[] = [];
  const ticks: ((time: { t: number; dt: number }) => void)[] = [];
  const fixed: ((dt: number) => void)[] = [];
  const resizes: (() => void)[] = [];
  const stage = new PIXI.Container();
  let width = 800;
  let height = 500;
  let randomState = 7;
  const random = () => {
    randomState = (randomState * 16_807) % 2_147_483_647;
    return randomState / 2_147_483_647;
  };
  const scene = {
    PIXI,
    stage,
    editor,
    reducedMotion,
    get width() {
      return width;
    },
    get height() {
      return height;
    },
    canvas: { setAttribute: vi.fn(), focus: vi.fn() },
    app: { render: vi.fn() },
    input: {
      down: (code: string) => held.has(code),
      axis: (negative: string[], positive: string[]) =>
        Number(positive.some((key) => held.has(key))) -
        Number(negative.some((key) => held.has(key))),
      set: (code: string, active: boolean) => {
        if (editor) return;
        if (active) held.add(code);
        else held.delete(code);
      },
      clear: () => {
        held.clear();
      },
    },
    fixedTick: (fn: (dt: number) => void) => {
      fixed.push(fn);
      return () => {
        const index = fixed.indexOf(fn);
        if (index >= 0) fixed.splice(index, 1);
      };
    },
    story: (chapters: Chapter[]) => {
      let current = 0;
      let disposed = false;
      const go = (next: number) => {
        if (disposed || next < 0 || next >= chapters.length || next === current) return false;
        chapters[current]?.leave?.();
        current = next;
        chapters[current]?.enter?.();
        return true;
      };
      chapters[0]?.enter?.();
      return {
        back: () => go(current - 1),
        next: () => go(current + 1),
        reset: () => go(0),
        dispose: () => {
          if (!disposed) chapters[current]?.leave?.();
          disposed = true;
        },
      };
    },
    dispose: (fn: () => void) => disposers.push(fn),
    onResize: (fn: () => void) => resizes.push(fn),
    tick: (fn: (time: { t: number; dt: number }) => void) => ticks.push(fn),
    random,
    rand: (a: number, b: number) => a + random() * (b - a),
    count: (n: number) => n,
    palette: { surface: 0x0f172a, accent: 0x67e8f9, ramp: () => [0x67e8f9, 0xc4b5fd, 0xfde68a] },
    pointer: { nx: 0.5 },
  };
  return {
    ck: {
      root: {
        querySelector: (selector: string) => controls.get(selector),
        querySelectorAll: () => buttons,
      },
      scene: () => Promise.resolve(scene),
    },
    scene,
    stage,
    controls,
    buttons,
    held,
    ticks,
    fixed,
    resize: (nextWidth = 400, nextHeight = 300) => {
      width = nextWidth;
      height = nextHeight;
      for (const callback of resizes) callback();
    },
    dispose: () => {
      for (const callback of [...disposers].reverse()) callback();
      stage.destroy({ children: true });
    },
  };
}

const mediaEngines = fileURLToPath(
  new URL('../../../../extensions/media-engines/package.json', import.meta.url),
);
const pixiPath = createRequire(mediaEngines).resolve('pixi.js');

describe('Pixi creative examples — real v8 scene objects without GPU claims', () => {
  let PIXI: PixiNamespace;
  beforeAll(async () => {
    PIXI = (await import(pixiPath)) as PixiNamespace;
  }, 60_000);

  it('the game starts, moves, pauses, restarts, fails and releases its controls', async () => {
    const run = harness(PIXI);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    const status = run.controls.get('[data-game-status]');
    const hero = run.stage.children[2];
    expect(status?.textContent).toContain('ready');
    expect(run.fixed).toHaveLength(1);
    run.controls.get('[data-game-action=start]')?.click();
    expect(status?.textContent).toContain('running');
    const before = hero?.x ?? 0;
    run.held.add('ArrowRight');
    run.fixed[0]?.(1 / 60);
    expect(hero?.x).toBeGreaterThan(before);
    run.controls.get('[data-game-action=pause]')?.click();
    expect(status?.textContent).toContain('paused');
    const paused = hero?.x;
    run.fixed[0]?.(1 / 60);
    expect(hero?.x).toEqual(paused);
    expect(run.held.size).toBe(0);
    run.controls.get('[data-game-action=restart]')?.click();
    expect(status?.textContent).toContain('running · 0/3 · 30s');
    for (let frame = 0; frame < 1_801; frame += 1) run.fixed[0]?.(1 / 60);
    expect(status?.textContent).toContain('lost');
    run.controls.get('[data-game-action=restart]')?.click();
    run.resize();
    expect(hero?.x).toBeCloseTo(400 * 0.18);
    run.dispose();
    const settled = status?.textContent;
    run.controls.get('[data-game-action=pause]')?.click();
    expect(status?.textContent).toEqual(settled);
    expect(run.fixed).toHaveLength(0);
  });

  it('supports native keyboard-click movement in reduced motion without a loop', async () => {
    const run = harness(PIXI, true);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    run.controls.get('[data-game-action=start]')?.click();
    const before = run.stage.children[2]?.x ?? 0;
    run.buttons[1]?.click();
    expect(run.stage.children[2]?.x).toBeGreaterThan(before);
    expect(run.fixed).toEqual([]);
    expect(run.held.size).toBe(0);
    expect(run.controls.get('[data-game-status]')?.textContent).toContain('30s');
    expect(run.scene.app.render).toHaveBeenCalled();
    run.dispose();
  });

  it('wins through actual movement and collectible collisions, rather than a scripted success flag', async () => {
    const run = harness(PIXI);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    run.controls.get('[data-game-action=start]')?.click();
    const hero = run.stage.children[2];
    const move = (axis: 'x' | 'y', target: number) => {
      const dimension = axis === 'x' ? run.scene.width : run.scene.height;
      for (let frame = 0; frame < 200; frame += 1) {
        const current = (hero?.[axis] ?? 0) / dimension;
        if (Math.abs(current - target) < 0.008) break;
        run.held.clear();
        run.held.add(
          axis === 'x'
            ? current < target
              ? 'ArrowRight'
              : 'ArrowLeft'
            : current < target
              ? 'ArrowDown'
              : 'ArrowUp',
        );
        run.fixed[0]?.(1 / 60);
      }
      run.held.clear();
    };
    move('x', 0.72);
    move('y', 0.3);
    expect(run.controls.get('[data-game-status]')?.textContent).toContain('1/3');
    move('y', 0.25);
    move('x', 0.25);
    expect(run.controls.get('[data-game-status]')?.textContent).toContain('2/3');
    move('x', 0.8);
    move('y', 0.75);
    expect(run.controls.get('[data-game-status]')?.textContent).toContain('won · 3/3');
    expect(run.stage.children[1]?.visible).toBe(false);
    run.dispose();
  });

  it('releases held virtual movement on pointer cancellation and lost capture', async () => {
    const run = harness(PIXI);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    run.controls.get('[data-game-action=start]')?.click();
    const right = run.buttons[1];
    right?.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 }));
    expect(run.held.has('ArrowRight')).toBe(true);
    right?.dispatchEvent(new Event('pointercancel'));
    expect(run.held.size).toBe(0);
    right?.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 }));
    right?.dispatchEvent(new Event('lostpointercapture'));
    expect(run.held.size).toBe(0);
    run.dispose();
  });

  it.each([
    [1_600, 360],
    [360, 900],
  ])('matches rendered hazard and collectible contact on a %sx%s scene', async (width, height) => {
    const run = harness(PIXI);
    run.resize(width, height);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    const hero = run.stage.children[2];
    const hazard = run.stage.children[0];
    const goal = run.stage.children[1];
    const status = run.controls.get('[data-game-status]');
    const frame = () => run.fixed[0]?.(1 / 240);
    const alignY = (target: number) => {
      for (let step = 0; step < 400; step += 1) {
        const current = (hero?.y ?? 0) / height;
        if (Math.abs(current - target) < 0.002) break;
        run.held.clear();
        run.held.add(current < target ? 'ArrowDown' : 'ArrowUp');
        frame();
      }
      run.held.clear();
    };
    const distance = (target: DisplayObject | undefined) =>
      Math.hypot((hero?.x ?? 0) - (target?.x ?? 0), (hero?.y ?? 0) - (target?.y ?? 0));

    run.controls.get('[data-game-action=start]')?.click();
    alignY(0.5);
    run.held.add('ArrowRight');
    let previous = distance(hazard);
    for (let step = 0; step < 400 && !status?.textContent.startsWith('lost'); step += 1) {
      previous = distance(hazard);
      frame();
    }
    expect(status?.textContent).toContain('lost');
    expect(distance(hazard)).toBeLessThanOrEqual(26);
    expect(previous).toBeGreaterThan(26);

    run.controls.get('[data-game-action=restart]')?.click();
    alignY(0.3);
    run.held.add('ArrowRight');
    let previousGoal = distance(goal);
    for (let step = 0; step < 400 && !status?.textContent.includes('1/3'); step += 1) {
      previousGoal = distance(goal);
      frame();
    }
    expect(status?.textContent).toContain('running · 1/3');
    const firstGoalDistance = Math.hypot(
      (hero?.x ?? 0) - width * 0.72,
      (hero?.y ?? 0) - height * 0.3,
    );
    expect(firstGoalDistance).toBeLessThanOrEqual(22);
    expect(previousGoal).toBeGreaterThan(22);
    run.dispose();
  });

  it('does not start or capture manual game input while editing', async () => {
    const run = harness(PIXI, false, true);
    await new AsyncFunction('ck', PIXI_GAME_EXAMPLE)(run.ck);
    run.controls.get('[data-game-action=start]')?.click();
    run.buttons[1]?.click();
    run.buttons[1]?.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerId: 1 }));
    expect(run.controls.get('[data-game-status]')?.textContent).toContain('ready');
    expect(run.buttons[1]?.pointerCaptureCount).toBe(0);
    expect(run.fixed).toEqual([]);
    expect(run.held.size).toBe(0);
    run.dispose();
  });

  it.each([false, true])(
    'navigates/replays the story with DOM copy and no autoplay (reduced: %s)',
    async (reduced) => {
      const run = harness(PIXI, reduced);
      await new AsyncFunction('ck', PIXI_STORY_EXAMPLE)(run.ck);
      const back = run.controls.get('[data-story-action=back]');
      const next = run.controls.get('[data-story-action=next]');
      expect(run.controls.get('[data-story-title]')?.textContent).toBe('Dawn');
      expect(back?.disabled).toBe(true);
      next?.click();
      expect(run.controls.get('[data-story-title]')?.textContent).toBe('Crossing');
      expect(run.stage.children.filter(({ visible }) => visible)).toHaveLength(1);
      next?.click();
      expect(run.controls.get('[data-story-title]')?.textContent).toBe('Home');
      expect(next?.disabled).toBe(true);
      run.controls.get('[data-story-action=reset]')?.click();
      expect(run.controls.get('[data-story-title]')?.textContent).toBe('Dawn');
      expect(run.ticks).toEqual([]);
      expect(run.fixed).toEqual([]);
      run.dispose();
      next?.click();
      expect(run.controls.get('[data-story-title]')?.textContent).toBe('Dawn');
    },
  );

  it.each([false, true])(
    'builds and resizes an art-directed mural (reduced: %s)',
    async (reduced) => {
      const run = harness(PIXI, reduced);
      await new AsyncFunction('ck', PIXI_MURAL_EXAMPLE)(run.ck);
      expect(run.stage.children).toHaveLength(3);
      expect(run.stage.children[1]?.children).toHaveLength(3);
      expect(run.stage.children[2]?.children).toHaveLength(80);
      if (reduced) expect(run.ticks).toEqual([]);
      else {
        expect(run.ticks).toHaveLength(1);
        run.ticks[0]?.({ t: 1, dt: 1 / 60 });
        expect(run.stage.children[1]?.y).not.toBe(0);
      }
      run.resize();
      expect(run.stage.children[2]?.children[0]?.x).toBeLessThanOrEqual(400);
      run.dispose();
    },
  );
});
