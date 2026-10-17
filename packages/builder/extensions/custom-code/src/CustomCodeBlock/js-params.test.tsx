/**
 * The block's jsParams reach the page (2026-10-12). They were stored (by the Inspector's scene
 * settings and by the agent's scene.preset) but never handed to the region, so `ck.params`
 * always read the defaults. Ours to prove: a script with params carries them as
 * `data-ck-params` on the canvas and on the published page; no params, no attribute.
 */
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { BlockRenderProps, Node } from '@craftkit/builder-schema';

import { CustomCodeBlock } from './CustomCodeBlock';
import type { CustomCodeBlockProps } from './schema';

const node: Node = { id: 'r1', type: 'customCode', props: {} };

function renderBlock(jsParams: CustomCodeBlockProps['jsParams'], isCanvas: boolean) {
  const props = {
    label: 'Scene',
    css: '',
    js: 'const p=ck.params({speed:1});',
    tree: { kind: 'root', children: [] },
    ...(jsParams === undefined ? {} : { jsParams }),
  } as CustomCodeBlockProps;
  const renderProps: BlockRenderProps<CustomCodeBlockProps> = {
    node,
    props,
    slots: {},
    data: {},
    isCanvas,
  };
  return render(<CustomCodeBlock {...renderProps} />);
}

describe('jsParams on the region', () => {
  it.each([true, false])('rides as data-ck-params (canvas: %s)', (isCanvas) => {
    const { container } = renderBlock({ speed: 3, mood: 'calm' }, isCanvas);
    const region = container.querySelector('[data-ck-js]');
    expect(region).not.toBeNull();
    expect(JSON.parse(region?.getAttribute('data-ck-params') ?? '{}')).toEqual({
      speed: 3,
      mood: 'calm',
    });
  });

  it('is absent when there are no params', () => {
    const { container } = renderBlock(undefined, false);
    expect(container.querySelector('[data-ck-params]')).toBeNull();
  });
});
