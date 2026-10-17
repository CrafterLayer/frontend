/*
  A structural Pixi stand-in for the creative libraries' unit tests (jsdom has no WebGL). It
  records what the libraries draw and add, nothing more; real rendering is covered by the
  generated-runtime browser fixtures.
*/

import type { PixiApp, PixiNamespace } from './pixi-types';

class FakePoint {
  constructor(
    public x = 0,
    public y = 0,
  ) {}

  set(x: number, y = x): void {
    this.x = x;
    this.y = y;
  }
}

class FakeDisplay {
  x = 0;
  y = 0;
  alpha = 1;
  rotation = 0;
  visible = true;
  tint = 0xffffff;
  blendMode = 'normal';
  width = 0;
  height = 0;
  destroyed = false;
  scale = new FakePoint(1, 1);
  anchor = new FakePoint(0, 0);
  parent: FakeContainer | null = null;
  readonly children: FakeDisplay[] = [];

  get position(): FakePoint {
    // Arrow functions keep `this` bound to the display object inside the point's accessors.
    const readX = (): number => this.x;
    const readY = (): number => this.y;
    const write = (x: number, y: number): void => {
      this.x = x;
      this.y = y;
    };
    const point = {
      get x() {
        return readX();
      },
      get y() {
        return readY();
      },
      set(x: number, y = x) {
        write(x, y);
      },
    };
    return point;
  }

  destroy(): void {
    this.destroyed = true;
    this.removeFromParent();
    for (const child of this.children.slice()) child.destroy();
  }

  removeFromParent(): void {
    if (this.parent === null) return;
    const siblings = this.parent.children;
    siblings.splice(siblings.indexOf(this), 1);
    this.parent = null;
  }
}

class FakeContainer extends FakeDisplay {
  addChild<T extends FakeDisplay>(child: T): T {
    child.removeFromParent();
    child.parent = this;
    this.children.push(child);
    return child;
  }

  addChildAt<T extends FakeDisplay>(child: T, index: number): T {
    child.removeFromParent();
    child.parent = this;
    this.children.splice(index, 0, child);
    return child;
  }

  removeChildren(): FakeDisplay[] {
    const removed = this.children.splice(0);
    for (const child of removed) child.parent = null;
    return removed;
  }
}

class FakeGraphics extends FakeContainer {
  readonly ops: string[] = [];

  constructor() {
    super();
    return new Proxy(this, {
      get(target, key, receiver: unknown) {
        if (key in target) return Reflect.get(target, key, receiver) as unknown;
        return (...args: unknown[]) => {
          target.ops.push(`${String(key)}(${String(args.length)})`);
          return receiver;
        };
      },
    });
  }

  clear(): this {
    this.ops.length = 0;
    return this;
  }
}

/** Stands in for @pixi/tilemap's GL adaptor: the pipe only needs something to construct. */
class FakeTilemapAdaptor {
  readonly fake = true;
}

class FakeTexture {
  destroyed = false;

  constructor(
    readonly width = 32,
    readonly height = 32,
  ) {}

  destroy(): void {
    this.destroyed = true;
  }
}

class FakeSprite extends FakeContainer {
  constructor(public texture: FakeTexture = new FakeTexture()) {
    super();
  }
}

class FakeText extends FakeContainer {
  text: string;

  constructor(options: { text: string }) {
    super();
    this.text = options.text;
  }
}

export interface FakePixiApp extends PixiApp {
  readonly textures: FakeTexture[];
}

export function fakePixi(): { PIXI: PixiNamespace; app: FakePixiApp } {
  const textures: FakeTexture[] = [];
  const PIXI = {
    Container: FakeContainer,
    Graphics: FakeGraphics,
    Sprite: FakeSprite,
    Text: FakeText,
    Rectangle: class {
      constructor(
        readonly x: number,
        readonly y: number,
        readonly width: number,
        readonly height: number,
      ) {}
    },
    Texture: { WHITE: new FakeTexture(), EMPTY: new FakeTexture(0, 0) },
  } as unknown as PixiNamespace;
  const app = {
    stage: new FakeContainer(),
    screen: { width: 400, height: 300 },
    textures,
    renderer: {
      type: 1,
      renderPipes: {} as Record<string, unknown>,
      runners: {
        destroy: {
          items: [] as unknown[],
          add(item: unknown) {
            this.items.push(item);
          },
        },
      },
      config: { renderPipeAdaptors: [{ name: 'tilemap', value: FakeTilemapAdaptor }] },
      generateTexture() {
        const made = new FakeTexture();
        textures.push(made);
        return made;
      },
    },
  } as unknown as FakePixiApp;
  return { PIXI, app };
}
