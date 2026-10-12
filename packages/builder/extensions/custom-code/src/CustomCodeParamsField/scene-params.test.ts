import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import {
  customCodeJsMeta,
  customCodeJsParams,
  type FieldSibling,
  type ScriptParamSpec,
} from '@craftkit/builder-schema';

import {
  declaredSceneSpec,
  inferredSceneSpec,
  mergeSceneParams,
  sceneParamsHidden,
  sceneParamsModel,
} from './scene-params';

const SPEC: ScriptParamSpec[] = [
  {
    key: 'speed',
    type: 'range',
    label: { en: 'Speed', ar: 'السرعة' },
    default: 1,
    min: 0,
    max: 3,
    step: 0.5,
  },
  { key: 'tint', type: 'color', label: { en: 'Tint', ar: 'اللون' }, default: '#e8a33d' },
];

function metaSibling(value: unknown, key = 'jsMeta'): FieldSibling {
  return { key, schema: customCodeJsMeta(), value };
}

describe('declaredSceneSpec — the spec found by its declaration', () => {
  it('reads jsMeta.params from the sibling carrying the customCodeJsMeta() marker', () => {
    expect(declaredSceneSpec([metaSibling({ params: SPEC })]).map((entry) => entry.key)).toEqual([
      'speed',
      'tint',
    ]);
  });

  it('finds the marker under any prop name, and ignores a look-alike named jsMeta', () => {
    expect(declaredSceneSpec([metaSibling({ params: SPEC }, 'studio')])).toHaveLength(2);
    const lookAlike: FieldSibling = {
      key: 'jsMeta',
      schema: z.object({ params: z.array(z.unknown()) }).optional(),
      value: { params: SPEC },
    };
    expect(declaredSceneSpec([lookAlike])).toEqual([]);
  });

  it('drops an entry that does not parse and a repeated key, keeping the rest in order', () => {
    const broken = { key: 'Bad Key', type: 'number', label: { en: 'x', ar: 'x' }, default: 1 };
    const params = [SPEC[0], broken, SPEC[1], SPEC[0]];
    expect(declaredSceneSpec([metaSibling({ params })]).map((entry) => entry.key)).toEqual([
      'speed',
      'tint',
    ]);
  });

  it('is empty without a sibling, without params, or for a non-object', () => {
    expect(declaredSceneSpec(undefined)).toEqual([]);
    expect(declaredSceneSpec([metaSibling(undefined)])).toEqual([]);
    expect(declaredSceneSpec([metaSibling({ ref: undefined })])).toEqual([]);
    expect(declaredSceneSpec([metaSibling('params')])).toEqual([]);
  });
});

describe('inferredSceneSpec — a plain control per stored key', () => {
  it('types each control by its value, defaulting to the value itself', () => {
    const spec = inferredSceneSpec({
      count: 4,
      glow: true,
      tint: '#ABCDEF',
      title: 'Hello',
      colours: ['#FF0000', '#00ff00'],
      palette: 'theme',
    });
    expect(spec.map(({ key, type, default: value }) => [key, type, value])).toEqual([
      ['count', 'number', 4],
      ['glow', 'toggle', true],
      ['tint', 'color', '#abcdef'],
      ['title', 'text', 'Hello'],
      ['colours', 'palette', ['#ff0000', '#00ff00']],
      ['palette', 'palette', 'theme'],
    ]);
    // Labels come from the Studio's shared table (the key humanised when it has none).
    expect(spec[0]?.label).toEqual({ en: 'Count', ar: 'العدد' });
  });

  it('skips keys outside the param-key pattern and values with no plain control', () => {
    const long = 'x'.repeat(501);
    expect(
      inferredSceneSpec({ 'bad-key': 1, list: ['not a colour'], long, ok: 2 }).map(
        (entry) => entry.key,
      ),
    ).toEqual(['ok']);
    expect(inferredSceneSpec(undefined)).toEqual([]);
  });
});

describe('sceneParamsModel and the hidden rule', () => {
  it('prefers the declared spec, and infers only when there is none', () => {
    expect(sceneParamsModel({ speed: 2 }, [metaSibling({ params: SPEC })]).source).toBe('declared');
    expect(sceneParamsModel({ speed: 2 }, [metaSibling({ params: [] })])).toMatchObject({
      source: 'inferred',
      spec: [{ key: 'speed', type: 'number' }],
    });
  });

  it('hides the row only when there is nothing to tune', () => {
    expect(sceneParamsHidden({ value: undefined, siblings: [] })).toBe(true);
    expect(sceneParamsHidden({ value: {}, siblings: [metaSibling({ params: [] })] })).toBe(true);
    expect(sceneParamsHidden({ value: { seed: 3 }, siblings: [] })).toBe(false);
    expect(sceneParamsHidden({ value: undefined, siblings: [metaSibling({ params: SPEC })] })).toBe(
      false,
    );
  });
});

describe('mergeSceneParams — one write, merged into the stored record', () => {
  const declared = sceneParamsModel(undefined, [metaSibling({ params: SPEC })]);

  it('writes what the form chose and keeps keys outside the spec', () => {
    expect(mergeSceneParams({ legacy: 'kept', speed: 2 }, declared, { speed: 3 })).toEqual({
      legacy: 'kept',
      speed: 3,
    });
  });

  it('does not write a value equal to its default (the form left it out)', () => {
    expect(mergeSceneParams({ speed: 2, legacy: 1 }, declared, {})).toEqual({ legacy: 1 });
    expect(mergeSceneParams(undefined, declared, { tint: '#112233' })).toEqual({
      tint: '#112233',
    });
  });

  it('returns undefined when nothing changed, so no transaction is made', () => {
    expect(mergeSceneParams({ speed: 2 }, declared, { speed: 2 })).toBeUndefined();
    expect(mergeSceneParams(undefined, declared, {})).toBeUndefined();
  });

  it('lays an inferred change over the record without dropping the other keys', () => {
    const inferred = sceneParamsModel({ count: 4, glow: true }, undefined);
    expect(mergeSceneParams({ count: 4, glow: true }, inferred, { count: 6 })).toEqual({
      count: 6,
      glow: true,
    });
  });

  it('is the shape the jsParams declaration accepts', () => {
    const written = mergeSceneParams({ legacy: 'kept' }, declared, { speed: 2.5 });
    expect(customCodeJsParams().safeParse(written).success).toBe(true);
  });
});
