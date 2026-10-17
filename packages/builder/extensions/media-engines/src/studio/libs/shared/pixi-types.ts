/*
  The structural slice of the page's Pixi v8 namespace the fx and tilemap libraries use. They
  receive the ONE namespace at run time (D2), so these are shapes, not imports of pixi.js.
*/

export interface PixiPoint {
  x: number;
  y: number;
  set(x: number, y?: number): void;
}

export interface PixiDisplay {
  x: number;
  y: number;
  alpha: number;
  rotation: number;
  visible: boolean;
  tint: number;
  blendMode: string;
  scale: PixiPoint;
  position: PixiPoint;
  anchor?: PixiPoint;
  parent: PixiContainer | null;
  destroyed?: boolean;
  destroy(options?: unknown): void;
  removeFromParent(): void;
}

export interface PixiContainer extends PixiDisplay {
  readonly children: readonly PixiDisplay[];
  addChild<T extends PixiDisplay>(child: T): T;
  addChildAt<T extends PixiDisplay>(child: T, index: number): T;
  removeChildren(): PixiDisplay[];
  sortableChildren?: boolean;
  zIndex?: number;
}

export interface PixiGraphics extends PixiContainer {
  clear(): PixiGraphics;
  circle(x: number, y: number, r: number): PixiGraphics;
  rect(x: number, y: number, w: number, h: number): PixiGraphics;
  roundRect(x: number, y: number, w: number, h: number, r: number): PixiGraphics;
  star(x: number, y: number, points: number, radius: number, inner?: number): PixiGraphics;
  poly(points: number[], close?: boolean): PixiGraphics;
  moveTo(x: number, y: number): PixiGraphics;
  lineTo(x: number, y: number): PixiGraphics;
  ellipse(x: number, y: number, rx: number, ry: number): PixiGraphics;
  fill(style: unknown): PixiGraphics;
  stroke(style: unknown): PixiGraphics;
}

export interface PixiTexture {
  readonly width: number;
  readonly height: number;
  destroy(destroySource?: boolean): void;
}

export interface PixiRenderer {
  readonly type?: number;
  generateTexture(options: unknown): PixiTexture;
  readonly renderPipes?: Record<string, unknown>;
  readonly runners?: { destroy: { add(item: unknown): void } };
}

export interface PixiApp {
  readonly stage: PixiContainer;
  readonly renderer: PixiRenderer;
  readonly screen: { readonly width: number; readonly height: number };
}

export interface PixiNamespace {
  Container: new () => PixiContainer;
  Graphics: new () => PixiGraphics;
  Sprite: new (
    texture?: PixiTexture,
  ) => PixiDisplay & { texture: PixiTexture; width: number; height: number };
  Text: new (options: {
    text: string;
    style?: Record<string, unknown>;
  }) => PixiDisplay & { text: string };
  Rectangle: new (x: number, y: number, w: number, h: number) => unknown;
  Texture: { readonly WHITE: PixiTexture; readonly EMPTY: PixiTexture };
}
