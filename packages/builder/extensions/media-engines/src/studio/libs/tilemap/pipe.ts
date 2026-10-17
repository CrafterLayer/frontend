/*
  Late registration of @pixi/tilemap's render pipe (creative engines, 2026-10-12).

  Pixi v8 builds a renderer's pipes once, at `app.init()`. `ck.scene({ libs: ['tilemap'] })`
  opens the stage and loads libraries in parallel, so the stage is usually ready BEFORE
  ck-lib-tilemap.js runs its `extensions.add(TilemapPipe, …)`. That registration still lands in
  the renderer's shared adaptor list (`renderer.config.renderPipeAdaptors` is the very array
  Pixi's extension system fills), so a live renderer can be given the pipe exactly as `_addPipes`
  would have built it — once, and destroyed with the renderer.
*/

import type { PixiRenderer, PixiTexture } from '../shared/pixi-types';

export interface CompositeTilemapLike {
  clear(): unknown;
  tile(
    texture: PixiTexture,
    x: number,
    y: number,
    options?: { tileWidth?: number; tileHeight?: number },
  ): unknown;
  destroy(options?: unknown): void;
}

export interface TilemapClasses {
  CompositeTilemap: new () => CompositeTilemapLike;
  TilemapPipe: new (renderer: unknown, adaptor: unknown) => unknown;
}

interface NamedExtension {
  name: string;
  value: new () => unknown;
}

interface RendererInternals {
  renderPipes?: Record<string, unknown>;
  runners?: { destroy?: { add(item: unknown): void } };
  config?: { renderPipeAdaptors?: readonly NamedExtension[] };
}

/** True when the renderer can draw tilemaps (the pipe already existed or was just added). */
export function ensureTilemapPipe(classes: TilemapClasses, renderer: PixiRenderer): boolean {
  const internals = renderer as unknown as RendererInternals;
  const pipes = internals.renderPipes;
  if (pipes === undefined) return false;
  if (pipes['tilemap'] !== undefined) return true;
  const adaptor = internals.config?.renderPipeAdaptors?.find((entry) => entry.name === 'tilemap');
  if (adaptor === undefined) return false;
  const pipe = new classes.TilemapPipe(renderer, new adaptor.value());
  pipes['tilemap'] = pipe;
  internals.runners?.destroy?.add(pipe);
  return true;
}
