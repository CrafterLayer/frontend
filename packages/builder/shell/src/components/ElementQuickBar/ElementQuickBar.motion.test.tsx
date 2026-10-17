import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { setUtilityClassOracle, type CustomCodeNode, type CustomCodeRoot } from '@craftkit/builder-schema';

import { resolveElementActions } from '../../overlay/element-actions';
import { partTarget } from '../../overlay/part-target';
import { promoKernel, promoProps } from '../../overlay/part-test-kit';
import { permissiveUtilityOracle, storedTree, treeKernel } from '../../overlay/tree-test-kit';
import { installBrowserStandIns } from '../../style-manager/test-support';
import { createElementBarModel } from './element-bar-model';
import { ElementQuickBar } from './ElementQuickBar';
import { ELEMENT_QUICK_BAR_LABELS_AR } from './ElementQuickBar.labels';
import { createPartBarModel } from './part-bar-model';
import { quickGroupsForPart } from './quick-bar-groups';

/*
  gsap-pixi fix (2026-10-08): the quick bar's "Animation" popover reaches the
  engine. A customCode element gets the CSS presets THEN Cinematic motion (and
  an Animated background on a container); a registered block's PART gets
  Cinematic motion only, written into its partStyles. Each choice is ONE
  transaction.
*/

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [
    {
      kind: 'element',
      tag: 'section',
      className: 'flex gap-4',
      children: [
        { kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Our story', attributes: { 'data-ck-motion': 'fade-up' } },
      ],
    },
  ],
};

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
  setUtilityClassOracle(undefined);
});
afterEach(cleanup);

const TOKENS = [{ id: 'accent', name: 'Accent', css: '#4f46e5' }];

function treeBar(path: number[], dir: 'ltr' | 'rtl' = 'ltr') {
  const kernel = treeKernel([TREE], dir);
  kernel.focusElement('r1', path);
  const targets = [{ kind: 'tree' as const, nodeId: 'r1', path }];
  const model = createElementBarModel(kernel, targets, { bucket: 'base', state: 'default', pageDir: dir });
  render(
    <ElementQuickBar
      model={model ?? (undefined as never)}
      actions={resolveElementActions(kernel, targets)}
      onAction={vi.fn()}
      onMore={vi.fn()}
      onReturnFocus={vi.fn()}
      dir={dir}
      colorTokens={TOKENS}
      {...(dir === 'rtl' ? { labels: ELEMENT_QUICK_BAR_LABELS_AR } : {})}
    />,
  );
  return kernel;
}

function elementAt(kernel: ReturnType<typeof treeKernel>, path: readonly number[]): CustomCodeNode | undefined {
  let nodes: readonly CustomCodeNode[] = storedTree(kernel).children;
  let found: CustomCodeNode | undefined;
  for (const index of path) {
    found = nodes[index];
    nodes = found?.kind === 'element' ? (found.children ?? []) : [];
  }
  return found;
}

function attributesAt(kernel: ReturnType<typeof treeKernel>, path: readonly number[]) {
  const node = elementAt(kernel, path);
  return node?.kind === 'element' ? (node.attributes ?? {}) : {};
}

describe('quick bar Animation popover — engine motion', () => {
  it('a customCode heading: the CSS presets, then text recipes; a recipe replaces the preset in ONE write', async () => {
    const user = userEvent.setup();
    const kernel = treeBar([0, 0]);
    await user.click(screen.getByRole('button', { name: 'Animation' }));
    expect(await screen.findByRole('radiogroup', { name: 'Animation' })).toBeInTheDocument();
    const recipes = screen.getByRole('group', { name: 'Cinematic motion' });
    expect(within(recipes).getAllByRole('button').map((card) => card.getAttribute('data-value'))).toEqual([
      'none',
      'fade-in',
      'slide-in',
      'split-reveal',
    ]);
    // A heading has no animated background.
    expect(screen.queryByRole('group', { name: 'Animated background' })).toBeNull();
    const before = kernel.transactions().length;
    await user.click(within(recipes).getByRole('button', { name: 'Fade in' }));
    expect(kernel.transactions().length).toBe(before + 1);
    expect(attributesAt(kernel, [0, 0])).toEqual({ 'data-ck-timeline': 'fade-in' });
    kernel.undo();
    expect(attributesAt(kernel, [0, 0])).toEqual({ 'data-ck-motion': 'fade-up' });
  });

  it('a customCode section: container recipes AND Animated background cards; a scene is one attribute write', async () => {
    const user = userEvent.setup();
    const kernel = treeBar([0]);
    await user.click(screen.getByRole('button', { name: 'Animation' }));
    const scenes = await screen.findByRole('group', { name: 'Animated background' });
    expect(within(scenes).getAllByRole('button').map((card) => card.getAttribute('data-value'))).toEqual([
      'none',
      'particles',
      'mesh-gradient',
    ]);
    const recipes = screen.getByRole('group', { name: 'Cinematic motion' });
    expect(within(recipes).queryByRole('button', { name: 'Velocity marquee' })).toBeNull();
    expect(within(recipes).getByRole('button', { name: 'Stagger in' })).toBeInTheDocument();
    const before = kernel.transactions().length;
    await user.click(within(scenes).getByRole('button', { name: 'Particles' }));
    expect(kernel.transactions().length).toBe(before + 1);
    expect(attributesAt(kernel, [0])).toEqual({ 'data-ck-scene': 'particles' });
  });

  it('Arabic, RTL: the popover speaks Arabic and the recipe cards are named in Arabic', async () => {
    const user = userEvent.setup();
    treeBar([0, 0], 'rtl');
    await user.click(screen.getByRole('button', { name: 'الحركة' }));
    const recipes = await screen.findByRole('group', { name: 'حركة سينمائية' });
    expect(within(recipes).getByRole('button', { name: 'ظهور تدريجي' })).toBeInTheDocument();
  });

  it('a registered PART: Cinematic motion only, written into its partStyles as ONE transaction', async () => {
    const user = userEvent.setup();
    const kernel = promoKernel();
    const model = createPartBarModel(kernel, partTarget('promo', { part: 'heading', index: [] }), {
      bucket: 'base',
      state: 'default',
      pageDir: 'ltr',
    });
    render(
      <ElementQuickBar
        model={model ?? (undefined as never)}
        actions={[]}
        groups={quickGroupsForPart(model?.kind ?? 'text')}
        onAction={vi.fn()}
        onMore={vi.fn()}
        onReturnFocus={vi.fn()}
        dir="ltr"
        colorTokens={TOKENS}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Animation' }));
    const recipes = await screen.findByRole('group', { name: 'Cinematic motion' });
    // No CSS preset grid and no scene on a part.
    expect(screen.queryByRole('radiogroup', { name: 'Animation' })).toBeNull();
    expect(screen.queryByRole('group', { name: 'Animated background' })).toBeNull();
    const before = kernel.transactions().length;
    await user.click(within(recipes).getByRole('button', { name: 'Split reveal' }));
    expect(kernel.transactions().length).toBe(before + 1);
    expect(promoProps(kernel).partStyles).toEqual({ heading: { timeline: 'split-reveal' } });
    expect(kernel.transactions().at(-1)?.command).toBe('Cinematic motion · Promo heading');
  });
});
