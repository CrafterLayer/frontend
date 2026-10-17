import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { defineBlockSchema } from '../blocks/define-block-schema';
import type { BuilderDocument } from '../document/types';
import { validateDocument } from '../document/validate';
import {
  CUSTOM_CODE_REGION_JS_MAX,
  customCss,
  customJs,
  isCustomCssSchema,
  isCustomJsSchema,
} from './custom-code-tree';

/*
  `customJs()` is the declaration a region's script prop makes. Like `customCss()`
  it is recognised by MARKER, never by the prop's name, and it is the only door a
  script has: the tree cannot express one.
*/

describe('customJs() declaration', () => {
  it('defaults to an empty script, so an existing document needs no migration', () => {
    expect(customJs().parse(undefined)).toBe('');
  });

  it('caps the source at 32 000 characters', () => {
    expect(CUSTOM_CODE_REGION_JS_MAX).toBe(32_000);
    expect(customJs().safeParse('a'.repeat(32_000)).success).toBe(true);
    expect(customJs().safeParse('a'.repeat(32_001)).success).toBe(false);
  });

  it('honours an explicit ceiling', () => {
    expect(customJs(10).safeParse('a'.repeat(11)).success).toBe(false);
  });

  it('marks the schema, and unwraps wrappers to find the mark', () => {
    expect(isCustomJsSchema(customJs())).toBe(true);
    expect(isCustomJsSchema(customJs().optional() as z.ZodType)).toBe(true);
    expect(isCustomJsSchema(customJs().nullable() as z.ZodType)).toBe(true);
  });

  it('is not confused with a stylesheet or a plain string', () => {
    expect(isCustomJsSchema(customCss())).toBe(false);
    expect(isCustomCssSchema(customJs())).toBe(false);
    expect(isCustomJsSchema(z.string().default(''))).toBe(false);
  });
});

describe('the raw-literal law and a region script', () => {
  const region = defineBlockSchema({
    type: 'region',
    description: 'A region with a script.',
    props: z.object({
      js: customJs(),
      script: customJs(), // exempt by DECLARATION, whatever the prop is called
      caption: z.string().default(''), // a plain string: still governed
    }),
    examples: [],
  });

  function documentWith(props: Record<string, unknown>): BuilderDocument {
    return {
      schemaVersion: 1,
      surface: 'site',
      dir: 'ltr',
      rootId: 'r',
      nodes: { r: { id: 'r', type: 'region', props: props as never } },
    };
  }

  const lookup = (type: string) => (type === 'region' ? region : undefined);
  const rawLiteralPaths = (props: Record<string, unknown>) =>
    validateDocument(documentWith(props), lookup)
      .filter((error) => error.code === 'doc/raw-style-literal')
      .map((error) => error.path);

  it('lets a script carry colour codes and pixel lengths', () => {
    const code =
      "const g = new PIXI.Graphics().rect(0, 0, 16, 16).fill('#1e3a8a'); el.style.width = '16px';";

    expect(rawLiteralPaths({ js: code })).toEqual([]);
  });

  it('exempts by the customJs() marker, not by the prop being named js', () => {
    expect(rawLiteralPaths({ script: "ctx.fillStyle = '#fff'" })).toEqual([]);
  });

  it('still governs a plain string prop — the law did not move', () => {
    expect(rawLiteralPaths({ caption: 'Use #ff0000 here' })).toEqual([
      ['nodes', 'r', 'props', 'caption'],
    ]);
  });
});
