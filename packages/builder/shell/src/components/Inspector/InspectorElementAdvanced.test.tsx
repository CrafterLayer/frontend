import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import type {
  BuilderDocument,
  CustomCodeElement,
  CustomCodeNode,
  CustomCodeRoot,
  JsonValue,
} from '@craftkit/builder-schema';

import { TREE_FIXTURE_VOCAB, treeFixtureDocument } from '../../clipboard/tree-commands.fixture';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { INSPECTOR_ELEMENT_LABELS_AR, INSPECTOR_ELEMENT_LABELS_EN } from './element-panel.labels';
import { InspectorElementAdvanced } from './InspectorElementAdvanced';

/*
  media-motion (2026-10-06): the Advanced group's typed media rows. A carousel,
  a mailto form and a toggle option get MediaParamFields; a scene layer gets
  the ScenePresetPicker. Every change is ONE labelled transaction through
  the group's own `patchTreeNode` write, and one Undo restores it.
*/

afterEach(cleanup);
beforeAll(() => {
  installBrowserStandIns();
});

function documentWith(children: CustomCodeNode[]): BuilderDocument {
  const doc = treeFixtureDocument();
  const region = doc.nodes['rA'];
  if (region !== undefined) region.props['tree'] = { kind: 'root', children } as unknown as JsonValue;
  return doc;
}

function setup(children: CustomCodeNode[], path: readonly number[], locale: 'en' | 'ar' = 'en') {
  const kernel = createBuilder({
    document: documentWith(children),
    extensions: [TREE_FIXTURE_VOCAB],
    ports: { clock: fixedClock(0, 5_000), ids: seededIds('adv') },
  });
  const target = { kind: 'tree' as const, nodeId: 'rA', path: [...path] };
  const element = (): CustomCodeNode => {
    let node: CustomCodeNode | undefined = (kernel.getDocument().nodes['rA']?.props['tree'] as unknown as CustomCodeRoot)
      .children[path[0] ?? 0];
    for (const index of path.slice(1)) node = node?.kind === 'element' ? node.children?.[index] : undefined;
    if (node === undefined) throw new Error('element gone');
    return node;
  };
  const view = () => (
    <InspectorElementAdvanced
      kernel={kernel}
      target={target}
      element={element()}
      elementName="Element"
      palette={[]}
      catalogVersion={0}
      announce={() => undefined}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      locale={locale}
      writeOptions={{}}
      namedStyles={[]}
      labels={locale === 'ar' ? INSPECTOR_ELEMENT_LABELS_AR : INSPECTOR_ELEMENT_LABELS_EN}
    />
  );
  const result = render(view());
  const rerender = () => {
    result.rerender(view());
  };
  return { kernel, element, rerender };
}

const attrs = (node: CustomCodeNode) => (node as CustomCodeElement).attributes ?? {};

const CAROUSEL: CustomCodeNode = {
  kind: 'element',
  tag: 'div',
  attributes: { 'data-ck-behavior': 'carousel', 'data-ck-indicator': 'dots' },
  children: [{ kind: 'element', tag: 'div', children: [{ kind: 'element', tag: 'p', text: 'Slide' }] }],
};

describe('InspectorElementAdvanced — typed media rows', () => {
  it('a carousel gets typed indicator / autoplay / speed rows, not free-text ones; one write each, one undo', async () => {
    const user = userEvent.setup();
    const { kernel, element } = setup([CAROUSEL], [0]);
    const media = screen.getByRole('group', { name: 'Media settings' });
    expect(within(media).getByRole('radio', { name: 'Dots' })).toHaveAttribute('aria-checked', 'true');
    // The free-text behaviour rows no longer offer what the typed rows own.
    expect(screen.queryByRole('textbox', { name: 'data-ck-indicator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'data-ck-email' })).not.toBeInTheDocument();

    await user.click(within(media).getByRole('radio', { name: 'Counter' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Position indicator · Element');
    expect(attrs(element())).toMatchObject({ 'data-ck-indicator': 'counter' });
    act(() => {
      kernel.undo();
    });
    expect(attrs(element())).toMatchObject({ 'data-ck-indicator': 'dots' });
  });

  it('a gallery shows no carousel or mailto params at all', () => {
    setup(
      [
        {
          kind: 'element',
          tag: 'div',
          attributes: { 'data-ck-behavior': 'gallery' },
          children: [{ kind: 'element', tag: 'img', attributes: { src: 'https://example.com/a.jpg', alt: 'A' } }],
        },
      ],
      [0],
    );
    expect(screen.queryByRole('group', { name: 'Media settings' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'data-ck-indicator' })).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'data-ck-autoplay' })).not.toBeInTheDocument();
  });

  it('a toggle option switches side and its no-script `hidden` together, in one write', async () => {
    const user = userEvent.setup();
    const { kernel, element } = setup(
      [
        {
          kind: 'element',
          tag: 'div',
          attributes: { 'data-ck-behavior': 'toggle-group' },
          children: [
            { kind: 'element', tag: 'button', attributes: { type: 'button' }, text: 'Monthly / Yearly' },
            { kind: 'element', tag: 'span', attributes: { 'data-ck-option': 'a' }, text: '$9' },
          ],
        },
      ],
      [0, 1],
    );
    await user.click(screen.getByRole('radio', { name: 'Second (yearly)' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(attrs(element())).toEqual({ 'data-ck-option': 'b', hidden: '' });
  });

  it('a scene layer gets the ScenePresetPicker; a change is one labelled write (Arabic, RTL)', async () => {
    const user = userEvent.setup();
    const { kernel, element } = setup(
      [
        {
          kind: 'element',
          tag: 'section',
          className: 'relative isolate overflow-hidden',
          children: [
            {
              kind: 'element',
              tag: 'div',
              className: 'pointer-events-none absolute inset-0 -z-10',
              attributes: {
                'data-ck-scene': 'particles',
                'data-ck-density': 'medium',
                'data-ck-palette': 'theme',
                'aria-hidden': 'true',
              },
            },
            { kind: 'element', tag: 'h2', text: 'مرحبًا' },
          ],
        },
      ],
      [0, 0],
      'ar',
    );
    const picker = screen.getByRole('group', { name: 'خلفية متحركة' });
    expect(picker).toHaveAttribute('dir', 'rtl');
    // No images in the layer: the mural refuses.
    expect(within(picker).getByRole('radio', { name: /جدارية/u })).toHaveAttribute('aria-disabled', 'true');
    await user.click(within(picker).getByRole('radio', { name: 'عالية' }));
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('خلفية متحركة · Element');
    expect(attrs(element())).toMatchObject({ 'data-ck-density': 'high', 'data-ck-scene': 'particles' });
  });
});
