import { createElement } from 'react';

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Inspector, type BuilderKernel } from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';

/*
  The customCode Studio props through the REAL custom-code extension and the
  real Inspector (jsParams Scene settings, 2026-10-12): `jsParams` is edited as
  controls built from the spec in `jsMeta.params`, and `jsMeta` itself never
  shows — no row, no JSON.
*/

const SPEC = [
  {
    key: 'speed',
    type: 'range',
    label: { en: 'Speed', ar: 'السرعة' },
    default: 1,
    min: 0,
    max: 3,
    step: 0.5,
  },
  {
    key: 'interactive',
    type: 'toggle',
    label: { en: 'Follow the pointer', ar: 'تتبع المؤشر' },
    default: false,
  },
];

afterEach(cleanup);

function insertScene(kernel: BuilderKernel, props: Record<string, unknown>): string {
  kernel.dispatch('insertNode', {
    type: 'customCode',
    parentId: 'root',
    props: {
      label: 'Starfield',
      tree: { kind: 'root', children: [] },
      js: 'const s = ck.params({ speed: 1, interactive: false });',
      ...props,
    },
  });
  const node = Object.values(kernel.getDocument().nodes).find(
    (candidate) => candidate.type === 'customCode',
  );
  if (node === undefined) throw new Error('The scene was not inserted.');
  kernel.setSelection([node.id]);
  return node.id;
}

function jsonRows(): readonly string[] {
  return [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')]
    .map((element) => element.value)
    .filter((value) => /^\s*[[{]/u.test(value) && /"[a-zA-Z]+"\s*:/u.test(value));
}

describe('Scene settings — customCode jsParams through the real extension', () => {
  it('edits the values from the spec in one undoable setProp, and never shows jsMeta', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    const id = insertScene(kernel, {
      jsMeta: { ref: { tier: 'builtin', id: 'starfield', version: 1 }, params: SPEC },
      jsParams: { speed: 2, legacy: 'kept' },
    });
    const user = userEvent.setup();
    render(createElement(Inspector, { kernel }));

    expect(screen.getByRole('heading', { name: 'Scene settings' })).toBeInTheDocument();
    const pointer = await screen.findByRole(
      'switch',
      { name: 'Follow the pointer' },
      { timeout: 8000 },
    );
    expect(screen.getByRole('slider', { name: 'Speed' })).toHaveValue('2');
    // jsMeta has no row of its own, and nothing renders as JSON.
    expect(screen.queryByText('Js meta')).toBeNull();
    expect(jsonRows()).toEqual([]);

    const before = kernel.transactions().length;
    await user.click(pointer);
    expect(kernel.transactions()).toHaveLength(before + 1);
    expect(kernel.getDocument().nodes[id]?.props['jsParams']).toEqual({
      speed: 2,
      legacy: 'kept',
      interactive: true,
    });

    act(() => {
      kernel.undo();
    });
    expect(kernel.getDocument().nodes[id]?.props['jsParams']).toEqual({ speed: 2, legacy: 'kept' });
    expect(screen.getByRole('switch', { name: 'Follow the pointer' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('leaves the section out of a region with nothing to tune', () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    insertScene(kernel, {});
    render(createElement(Inspector, { kernel }));
    expect(screen.getByRole('heading', { name: 'Composition' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Scene settings' })).toBeNull();
  });

  it('speaks Arabic in an Arabic editor', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'landing' });
    insertScene(kernel, { jsMeta: { params: SPEC } });
    render(createElement(Inspector, { kernel, locale: 'ar' }));
    expect(screen.getByRole('heading', { name: 'إعدادات المشهد' })).toBeInTheDocument();
    expect(
      await screen.findByRole('switch', { name: 'تتبع المؤشر' }, { timeout: 8000 }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'إعدادات السكربت' })).toHaveAttribute('dir', 'rtl');
  });
});
