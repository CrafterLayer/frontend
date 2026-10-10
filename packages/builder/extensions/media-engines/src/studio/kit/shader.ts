/*
  s.shader(fragment, uniforms?) for the scene kit (pixi-studio §B.2).

  A fragment shader becomes a Pixi v8 Filter:
  - `#include noise` expands to the stegu simplex chunk plus fbm (glsl-noise.ts). Any other
    `#include` throws, naming what exists.
  - The kit feeds `uTime` (seconds), `uResolution` (CSS px of the scene) and `uPointer` (0..1
    over the scene) every tick.
  - Declarations are added for what the code USES but did not declare, so a short agent shader
    stays short: vTextureCoord, vUv (0..1 over the filtered area), finalColor, uTexture, the
    three fed uniforms, and each user uniform (float / vec2 / vec3 / vec4 / sampler2D).
  - The vertex shader is Pixi's default filter vertex plus `vUv`.
*/

import { GLSL_NOISE } from './glsl-noise';

/** Pixi v8's default filter vertex (lib/filters/defaults/defaultFilter.vert) plus a vUv varying. */
export const SCENE_FILTER_VERTEX = `in vec2 aPosition;
out vec2 vTextureCoord;
out vec2 vUv;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
    vUv = aPosition;
}
`;

export const SHADER_INCLUDES: Readonly<Record<string, string>> = { noise: GLSL_NOISE };

export type UniformKind = 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>' | 'texture';

/** The GLSL type a JS uniform value maps to, or undefined when it cannot be a uniform. */
export function uniformKind(value: unknown): UniformKind | undefined {
  if (typeof value === 'number' || typeof value === 'boolean') return 'f32';
  if (Array.isArray(value) || value instanceof Float32Array) {
    const size = value.length;
    if (size === 2) return 'vec2<f32>';
    if (size === 3) return 'vec3<f32>';
    if (size === 4) return 'vec4<f32>';
    return undefined;
  }
  if (typeof value === 'object' && value !== null && 'source' in value) return 'texture';
  return undefined;
}

const GLSL_TYPE: Readonly<Record<UniformKind, string>> = {
  f32: 'float',
  'vec2<f32>': 'vec2',
  'vec3<f32>': 'vec3',
  'vec4<f32>': 'vec4',
  texture: 'sampler2D',
};

const UNIFORM_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,63}$/u;

function declares(code: string, name: string): boolean {
  return new RegExp(`\\b(?:uniform|in|out|varying)\\s+(?:(?:lowp|mediump|highp)\\s+)?\\w+\\s+${name}\\b`, 'u').test(code);
}

function uses(code: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`, 'u').test(code);
}

/**
 * Expand includes and add missing declarations. Pure, so it is unit-tested without WebGL.
 * `extra` maps user uniform names to their kinds.
 */
export function expandShader(fragment: string, extra: Readonly<Record<string, UniformKind>> = {}): string {
  if (typeof fragment !== 'string' || fragment.trim() === '') {
    throw new Error('s.shader(fragment): the fragment shader is empty');
  }
  let body = fragment.replace(
    /^[ \t]*#include[ \t]+[<"]?([A-Za-z0-9_-]+)[>"]?[ \t]*$/gmu,
    function include(_line: string, name: string): string {
      const chunk = SHADER_INCLUDES[name];
      if (chunk === undefined) {
        throw new Error(
          `s.shader: unknown "#include ${name}"; available: ${Object.keys(SHADER_INCLUDES).join(', ')}`,
        );
      }
      return chunk;
    },
  );

  const wanted: [string, string][] = [
    ['vTextureCoord', 'in vec2 vTextureCoord;'],
    ['vUv', 'in vec2 vUv;'],
    ['finalColor', 'out vec4 finalColor;'],
    ['uTexture', 'uniform sampler2D uTexture;'],
    ['uTime', 'uniform float uTime;'],
    ['uResolution', 'uniform vec2 uResolution;'],
    ['uPointer', 'uniform vec2 uPointer;'],
  ];
  for (const [name, kind] of Object.entries(extra)) {
    wanted.push([name, `uniform ${GLSL_TYPE[kind]} ${name};`]);
  }
  const header: string[] = [];
  for (const [name, declaration] of wanted) {
    if (uses(body, name) && !declares(body, name)) header.push(declaration);
  }
  if (header.length === 0) return body;

  // Declarations go after `#version` and any `precision` lines if the author wrote them.
  const lines = body.split('\n');
  let insertAt = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? '').trim();
    if (line.startsWith('#version') || line.startsWith('precision ') || line === '') {
      if (line !== '') insertAt = index + 1;
      continue;
    }
    break;
  }
  lines.splice(insertAt, 0, ...header);
  body = lines.join('\n');
  return body;
}

export interface ShaderHandle {
  filter: unknown;
  /** Feed the per-tick uniforms. */
  update(time: number, width: number, height: number, pointerX: number, pointerY: number): void;
  destroy(): void;
}

interface FilterLike {
  resources: Record<string, { uniforms?: Record<string, unknown> } | undefined>;
  destroy(): void;
}

interface PixiShaderNamespace {
  Filter: { from(options: Record<string, unknown>): FilterLike };
}

/** Build the Filter. `PIXI` is the page's one namespace (D2). */
export function createShaderFilter(
  PIXI: unknown,
  fragment: string,
  uniforms: Readonly<Record<string, unknown>> = {},
  size: { width: number; height: number } = { width: 1, height: 1 },
): ShaderHandle {
  const kinds: Record<string, UniformKind> = {};
  const values: Record<string, { value: unknown; type: string }> = {};
  const textures: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(uniforms)) {
    if (!UNIFORM_NAME.test(name) || name === 'uTime' || name === 'uResolution' || name === 'uPointer') {
      continue;
    }
    const kind = uniformKind(value);
    if (kind === undefined) continue;
    kinds[name] = kind;
    if (kind === 'texture') {
      textures[name] = (value as { source: unknown }).source;
    } else if (kind === 'f32') {
      values[name] = { value: Number(value), type: kind };
    } else {
      values[name] = { value: Float32Array.from(value as ArrayLike<number>), type: kind };
    }
  }
  const resolution = new Float32Array([size.width, size.height]);
  const pointer = new Float32Array([0.5, 0.5]);
  const namespace = PIXI as PixiShaderNamespace;
  const filter = namespace.Filter.from({
    gl: { vertex: SCENE_FILTER_VERTEX, fragment: expandShader(fragment, kinds), name: 'ck-scene-shader' },
    resources: {
      ckUniforms: {
        uTime: { value: 0, type: 'f32' },
        uResolution: { value: resolution, type: 'vec2<f32>' },
        uPointer: { value: pointer, type: 'vec2<f32>' },
        ...values,
      },
      ...textures,
    },
  });
  let destroyed = false;
  return {
    filter,
    update(time, width, height, pointerX, pointerY): void {
      if (destroyed) return;
      const group = filter.resources['ckUniforms']?.uniforms;
      if (group === undefined) return;
      group['uTime'] = time;
      resolution[0] = width;
      resolution[1] = height;
      pointer[0] = pointerX;
      pointer[1] = pointerY;
      group['uResolution'] = resolution;
      group['uPointer'] = pointer;
    },
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      try {
        filter.destroy();
      } catch {
        // Already torn down with its renderer.
      }
    },
  };
}
