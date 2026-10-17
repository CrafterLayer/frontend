import { render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';

import {
  CUSTOM_CODE_REGION_JS_MAX,
  customCss,
  customJs,
  type BlockRenderProps,
  type Node,
} from '@craftkit/builder-schema';

import { builderCustomCode } from '../index';
import { CustomCodeBlock } from './CustomCodeBlock';
import { customCodeSchema, type CustomCodeBlockProps } from './schema';

/*
  Free-code mode (2026-10-09): the block's `js` prop. The runtime that evaluates it is tested in
  the renderer (packs/scripts.test.ts); here is what is the BLOCK's: the declaration, the field,
  and the handoff to the region wrapper.
*/

const node: Node = { id: 'r1', type: 'customCode', props: {} };

function renderBlock(js: string, isCanvas = false) {
  const props: CustomCodeBlockProps = {
    label: 'Region',
    css: '',
    js,
    tree: { kind: 'root', children: [{ kind: 'element', tag: 'p', text: 'Hello' }] },
  };
  const renderProps: BlockRenderProps<CustomCodeBlockProps> = {
    node,
    props,
    slots: {},
    data: {},
    isCanvas,
  };
  return render(<CustomCodeBlock {...renderProps} />);
}

afterEach(() => {
  localStorage.clear();
});

describe('the js prop declaration', () => {
  const shape = (customCodeSchema.props._zod.def as { shape: Record<string, z.ZodType> }).shape;

  it('is declared with customJs(), so it is found by marker and not by name', () => {
    const js = shape['js'];
    expect(js).toBeDefined();
    expect(js?.safeParse(undefined).data).toBe('');
    expect(js?.safeParse('a'.repeat(CUSTOM_CODE_REGION_JS_MAX)).success).toBe(true);
    expect(js?.safeParse('a'.repeat(CUSTOM_CODE_REGION_JS_MAX + 1)).success).toBe(false);
  });

  it('defaults to empty, so a document saved before this prop existed still validates', () => {
    const parsed = customCodeSchema.props.parse({
      label: 'Old',
      tree: { kind: 'root', children: [] },
    });
    expect(parsed.js).toBe('');
  });

  it('sits in the Advanced tab, under Custom JS, beside Custom CSS', () => {
    expect(customCodeSchema.propertyGroups?.js).toEqual({ tab: 'advanced', section: 'Custom JS' });
    expect(customCodeSchema.propertyGroups?.css).toEqual({
      tab: 'advanced',
      section: 'Custom CSS',
    });
  });
});

describe('the Inspector field', () => {
  const types = builderCustomCode.contributes?.fieldTypes ?? [];
  const jsType = types.find((type) => type.id === 'craftkit.custom-code.js');
  const cssType = types.find((type) => type.id === 'craftkit.custom-code.css');

  it('is registered, and matches the customJs() declaration only', () => {
    expect(jsType?.match(customJs())).toBe(100);
    expect(jsType?.match(customJs().optional() as z.ZodType)).toBe(100);
    // A plain string — a title, a slug — and a stylesheet must not capture the script editor.
    expect(jsType?.match(z.string().max(32_000).default(''))).toBe(0);
    expect(jsType?.match(customCss())).toBe(0);
  });

  it('does not take the stylesheet field either', () => {
    expect(cssType?.match(customJs())).toBe(0);
  });

  it('loads its control lazily', async () => {
    const loaded = await jsType?.load();
    expect(typeof loaded?.default).toBe('function');
  });
});

describe('the region wrapper', () => {
  it('carries the script as data-ck-js with the node id, and the block writes no <script>', () => {
    const { container } = renderBlock("ck.root.dataset.on = '1';");
    const region = container.querySelector('[data-ck="r1"]');

    expect(region?.getAttribute('data-ck-js')).toBe("ck.root.dataset.on = '1';");
    expect(region?.getAttribute('data-ck-js-id')).toBe('r1');
    expect(container.querySelector('script')).toBeNull();
  });

  it('writes neither attribute for an empty script', () => {
    const region = renderBlock('').container.querySelector('[data-ck="r1"]');

    expect(region?.hasAttribute('data-ck-js')).toBe(false);
    expect(region?.hasAttribute('data-ck-js-id')).toBe(false);
  });

  it('runs on the live page and on the canvas alike: a block that carries js always runs', () => {
    const code = "ck.root.setAttribute('data-ran', ck.editor ? 'editor' : 'page');";

    expect(
      renderBlock(code).container.querySelector('[data-ck="r1"]')?.getAttribute('data-ran'),
    ).toBe('page');
    expect(
      renderBlock(code, true).container.querySelector('[data-ck="r1"]')?.getAttribute('data-ran'),
    ).toBe('editor');
  });
});
