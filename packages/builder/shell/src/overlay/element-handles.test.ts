import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { CustomCodeRoot } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../style-manager/test-support';
import { bandRect, createElementHandles } from './element-handles';
import { permissiveUtilityOracle, storedTree, treeKernel } from './tree-test-kit';

const TREE: CustomCodeRoot = {
  kind: 'root',
  children: [{ kind: 'element', tag: 'h2', className: 'text-2xl', text: 'Our story' }],
};

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = permissiveUtilityOracle();
});
afterAll(() => {
  restoreOracle();
});

afterEach(() => {
  document.body.innerHTML = '';
});

function setup(dir: 'ltr' | 'rtl' = 'ltr') {
  const kernel = treeKernel([TREE], dir);
  const layer = document.createElement('div');
  const element = document.createElement('h2');
  element.className = 'text-2xl';
  element.style.paddingTop = '16px';
  element.style.paddingLeft = '8px';
  document.body.append(layer, element);
  const announce = vi.fn();
  const handles = createElementHandles({
    layer,
    kernel,
    bucket: () => 'base',
    state: () => 'default',
    dir: () => dir,
    scale: () => 1,
    announce,
  });
  const target = { kind: 'tree' as const, nodeId: 'r1', path: [0] };
  handles.update(target, element, { x: 10, y: 10, width: 200, height: 60 });
  const band = (property: string, side: string) =>
    layer.querySelector<HTMLElement>(`[data-property="${property}"][data-side="${side}"]`)!;
  return { kernel, layer, element, handles, band, announce };
}

const pointer = (type: string, x: number, y: number, extra: PointerEventInit = {}) =>
  new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, ...extra });

describe('spacing handles (DESIGN §A.6)', () => {
  it('a scrub previews on the canvas DOM and commits ONCE on release', () => {
    const { kernel, element, band } = setup();
    const top = band('padding', 'block-start');
    const before = kernel.transactions().length;
    top.dispatchEvent(pointer('pointerdown', 100, 100));
    top.dispatchEvent(pointer('pointermove', 100, 90));
    top.dispatchEvent(pointer('pointermove', 100, 80));
    // Preview only: the DOM wears the scrubbed class, the document is untouched.
    expect(element.className).toContain('pbs-6');
    expect(kernel.transactions().length - before).toBe(0);
    top.dispatchEvent(pointer('pointerup', 100, 80));
    expect(kernel.transactions().length - before).toBe(1);
    expect(element.className).toBe('text-2xl');
    const node = storedTree(kernel).children[0];
    expect(node?.kind === 'element' ? node.className : '').toBe('text-2xl pbs-6');
  });

  it('a press without travel writes nothing', () => {
    const { kernel, band } = setup();
    const top = band('padding', 'block-start');
    const before = kernel.transactions().length;
    top.dispatchEvent(pointer('pointerdown', 100, 100));
    top.dispatchEvent(pointer('pointerup', 100, 100));
    expect(kernel.transactions().length - before).toBe(0);
  });

  it('cancel puts the DOM back and writes nothing', () => {
    const { kernel, element, band, handles } = setup();
    const top = band('padding', 'block-start');
    top.dispatchEvent(pointer('pointerdown', 100, 100));
    top.dispatchEvent(pointer('pointermove', 100, 70));
    expect(handles.isScrubbing()).toBe(true);
    handles.cancel();
    expect(element.className).toBe('text-2xl');
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('Shift scrubs all four sides at once', () => {
    const { kernel, band } = setup();
    const top = band('padding', 'block-start');
    top.dispatchEvent(pointer('pointerdown', 100, 100));
    top.dispatchEvent(pointer('pointermove', 100, 80, { shiftKey: true }));
    top.dispatchEvent(pointer('pointerup', 100, 80, { shiftKey: true }));
    const node = storedTree(kernel).children[0];
    expect(node?.kind === 'element' ? node.className : '').toBe('text-2xl p-6');
  });

  it('places inline-start on the right of an RTL page', () => {
    const rect = { x: 10, y: 10, width: 200, height: 60 };
    expect(bandRect(rect, 'padding', 'right', 8)).toEqual({ x: 202, y: 10, width: 8, height: 60 });
    const { band } = setup('rtl');
    expect(band('padding', 'inline-start').dataset['physical']).toBe('right');
  });
});
