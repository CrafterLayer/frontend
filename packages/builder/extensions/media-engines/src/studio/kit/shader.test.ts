/**
 * expandShader (the scene kit's s.shader), the pure half. Ours to prove: `#include noise`
 * expands and an unknown include names what exists; missing declarations are added after
 * `#version`/`precision`; and a fragment that declares a vertex-stage uniform at its default
 * precision is promoted to highp, since the program otherwise fails to link and draws nothing
 * (2026-10-12: four curated presets were dead of exactly this).
 */
import { describe, expect, it } from 'vitest';

import { expandShader } from './shader';

describe('expandShader', () => {
  it('promotes the vertex-stage uniforms a fragment declares to highp', () => {
    const out = expandShader(
      'uniform vec4 uInputSize;\nuniform mediump vec4 uOutputFrame;\nvoid main(){finalColor=vec4(uInputSize.x+uOutputFrame.x);}',
    );
    expect(out).toContain('uniform highp vec4 uInputSize;');
    expect(out).toContain('uniform highp vec4 uOutputFrame;');
    expect(out).not.toMatch(/uniform (?:mediump )?vec4 u(?:InputSize|OutputFrame);/u);
  });

  it('leaves a fragment that does not declare them alone, and adds what it uses', () => {
    const out = expandShader('void main(){finalColor=texture(uTexture,vTextureCoord)*uTime;}');
    expect(out).toContain('uniform sampler2D uTexture;');
    expect(out).toContain('in vec2 vTextureCoord;');
    expect(out).toContain('uniform float uTime;');
    expect(out).not.toContain('uInputSize');
  });

  it('puts added declarations after #version and precision lines', () => {
    const out = expandShader(
      '#version 300 es\nprecision highp float;\nvoid main(){finalColor=vec4(uTime);}',
    );
    const lines = out.split('\n');
    expect(lines[0]).toBe('#version 300 es');
    expect(lines[1]).toBe('precision highp float;');
    // Every added declaration follows them (the output first, then the uniforms).
    expect(lines.slice(2, 4)).toEqual(['out vec4 finalColor;', 'uniform float uTime;']);
  });

  it('expands #include noise and names what exists for anything else', () => {
    expect(expandShader('#include noise\nvoid main(){}')).toContain('snoise');
    expect(() => expandShader('#include lighting\nvoid main(){}')).toThrow(/available: noise/u);
  });
});
