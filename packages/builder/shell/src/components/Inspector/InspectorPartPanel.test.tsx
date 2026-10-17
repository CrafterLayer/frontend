import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { blockPartsOf } from '@craftkit/builder-schema';

import {
  makePartTestKernel,
  PART_TEST_MANIFEST,
  partStyleAt,
  PROMO_ID,
  PROMO_PROPS,
  promoProps,
} from '../../style-manager/part-test-kernel';
import { installBrowserStandIns, installClassOracle } from '../../style-manager/test-support';
import { Inspector } from './Inspector';
import { partContentRows } from './part-panel-rows';

let restoreOracle: () => void = () => undefined;
beforeAll(() => {
  installBrowserStandIns();
  restoreOracle = installClassOracle();
});
afterAll(() => {
  restoreOracle();
});

const promoParts = () => {
  const schema = PART_TEST_MANIFEST.contributes?.blocks?.find((block) => block.schema.type === 'promo')?.schema;
  return blockPartsOf(schema);
};

const selectedName = () => screen.getByRole('paragraph', { name: 'Selected block' });

describe('partContentRows — the Content rows of each part kind', () => {
  const parts = promoParts();
  const rowsOf = (part: string, index: number[] = []) => {
    const decl = parts[part];
    if (decl === undefined) throw new Error(`no part ${part}`);
    return partContentRows(PROMO_PROPS, decl, { part, index }).map((row) => ({
      key: row.key,
      leaf: row.leaf,
      kind: row.propertyKind,
      caption: row.caption,
    }));
  };

  it('text: the bound prop; multiline text asks for the textarea', () => {
    expect(rowsOf('heading')).toEqual([{ key: 'heading', leaf: 'text', kind: undefined, caption: 'part' }]);
    expect(rowsOf('body')).toEqual([{ key: 'body', leaf: 'text', kind: 'multiline', caption: 'part' }]);
  });

  it('link over one object: ONE link row over the object', () => {
    expect(rowsOf('cta')).toEqual([{ key: 'cta', leaf: undefined, kind: 'link', caption: 'part' }]);
  });

  it('image: the src row (image field) and the alt row', () => {
    expect(rowsOf('image')).toEqual([
      { key: 'imageSrc', leaf: 'src', kind: 'image', caption: 'part' },
      { key: 'imageAlt', leaf: 'alt', kind: undefined, caption: 'altText' },
    ]);
  });

  it('item: the item’s whole group; an item sub-part: its own leaf; a list: the repeater; a box: nothing', () => {
    expect(rowsOf('item', [1])).toEqual([{ key: 'items.1', leaf: undefined, kind: undefined, caption: 'part' }]);
    expect(rowsOf('item.title', [2])).toEqual([
      { key: 'items.2.title', leaf: 'text', kind: undefined, caption: 'part' },
    ]);
    expect(rowsOf('items')).toEqual([{ key: 'items', leaf: undefined, kind: undefined, caption: 'part' }]);
    expect(rowsOf('frame')).toEqual([]);
  });
});

describe('Inspector — a focused part of a registered block', () => {
  it('names the part and its block, offers the way back, and replaces the block rows', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);

    expect(selectedName()).toHaveTextContent('Heading · Promo');
    const tabs = within(screen.getByRole('tablist', { name: 'Part panel' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Content', 'Design']);
    // Only the heading is on the Content tab, not the block's other rows.
    expect(screen.getByRole('textbox', { name: 'heading' })).toHaveValue('Build faster');
    expect(screen.queryByRole('textbox', { name: 'badge' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to block' }));
    expect(kernel.context.store.getState().partFocus ?? null).toBeNull();
    expect(kernel.context.store.getState().selection).toEqual([PROMO_ID]);
    expect(selectedName()).toHaveTextContent('Promo');
    expect(screen.getByRole('textbox', { name: 'badge' })).toBeInTheDocument();
  });

  it('a text edit is ONE labelled transaction, undone in one step', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    const heading = screen.getByRole('textbox', { name: 'heading' });
    await user.clear(heading);
    await user.type(heading, 'Ship today{Enter}');
    expect(promoProps(kernel)['heading']).toBe('Ship today');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Edit text · Promo heading');
    expect(kernel.undo()).toBe(true);
    expect(promoProps(kernel)['heading']).toBe('Build faster');
  });

  it('shows the link’s words and address, the image’s address and alt text', () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'cta', index: [] });
    const view = render(<Inspector kernel={kernel} />);
    expect(selectedName()).toHaveTextContent('Button · Promo');
    expect(screen.getByDisplayValue('Start')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/start')).toBeInTheDocument();

    act(() => {
      kernel.focusPart(PROMO_ID, { part: 'image', index: [] });
    });
    expect(selectedName()).toHaveTextContent('Image · Promo');
    expect(screen.getByDisplayValue('https://example.com/hero.jpg')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A calm desk')).toBeInTheDocument();
    view.unmount();
  });

  it('an item shows its whole group; a nested title writes items.N.title as ONE setProp of items', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'item', index: [1] });
    const user = userEvent.setup();
    const view = render(<Inspector kernel={kernel} />);
    expect(selectedName()).toHaveTextContent('Feature 2 · Promo');
    expect(screen.getByDisplayValue('Safe')).toBeInTheDocument();
    expect(screen.getByDisplayValue('One undo')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Fast')).not.toBeInTheDocument();

    act(() => {
      kernel.focusPart(PROMO_ID, { part: 'item.title', index: [1] });
    });
    const title = screen.getByDisplayValue('Safe');
    await user.clear(title);
    await user.type(title, 'Safer');
    await user.tab();
    const items = promoProps(kernel)['items'] as { title: string }[];
    expect(items.map((item) => item.title)).toEqual(['Fast', 'Safer', 'Arabic']);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Edit text · Promo feature title 2');
    kernel.undo();
    expect((promoProps(kernel)['items'] as { title: string }[])[1]?.title).toBe('Safe');
    view.unmount();
  });

  it('Design: a style write lands in partStyles[part] as one transaction, one Undo', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(partStyleAt(kernel, 'heading')?.className).toBe('text-xs');
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.transactions()[0]?.command).toBe('Size · Promo Heading');
    kernel.undo();
    expect(partStyleAt(kernel, 'heading')).toBeUndefined();
  });

  it('Design: a repeated part offers This item / All items; This item writes name@i', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'item.title', index: [2] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const scope = screen.getByRole('radiogroup', { name: 'Apply to' });
    expect(within(scope).getByRole('radio', { name: 'All items' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(scope).getByRole('radio', { name: 'This item' }));
    act(() => {
      fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Size' }), { key: 'PageUp' });
    });
    expect(partStyleAt(kernel, 'item.title@2')?.className).toBe('text-xs');
    expect(partStyleAt(kernel, 'item.title')).toBeUndefined();
  });

  it('an unrepeated part has no scope switch', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    expect(screen.queryByRole('radiogroup', { name: 'Apply to' })).not.toBeInTheDocument();
  });

  it('Direction: RTL writes partStyles[part].dir, Auto clears it — each one transaction', async () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} />);
    await user.click(screen.getByRole('tab', { name: 'Design' }));
    const direction = screen.getByRole('radiogroup', { name: 'Text direction' });
    expect(within(direction).getByRole('radio', { name: 'Auto' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(direction).getByRole('radio', { name: 'Right to left' }));
    expect(partStyleAt(kernel, 'heading')?.dir).toBe('rtl');
    expect(within(direction).getByRole('radio', { name: 'Right to left' })).toHaveAttribute('aria-checked', 'true');
    await user.click(within(direction).getByRole('radio', { name: 'Auto' }));
    expect(partStyleAt(kernel, 'heading')).toBeUndefined();
    expect(kernel.transactions()).toHaveLength(2);
    expect(kernel.transactions()[0]?.command).toBe('Direction · Promo heading');
  });

  it('honours a focus request: Design at a sector, reported handled', () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const handled = vi.fn();
    render(
      <Inspector
        kernel={kernel}
        focusRequest={{ tab: 'design', sector: 'typography', nonce: 7 }}
        onFocusRequestHandled={handled}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Design' })).toHaveAttribute('aria-selected', 'true');
    expect(handled).toHaveBeenCalledWith(7);
  });

  it('a box part has no content of its own and says where to style it', () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'frame', index: [] });
    render(<Inspector kernel={kernel} />);
    expect(screen.getByText(/no content of its own/u)).toBeInTheDocument();
  });

  it('speaks Arabic: title, tabs, the way back and the direction choices', async () => {
    const kernel = makePartTestKernel({ dir: 'rtl' });
    kernel.focusPart(PROMO_ID, { part: 'heading', index: [] });
    const user = userEvent.setup();
    render(<Inspector kernel={kernel} locale="ar" />);
    expect(screen.getByRole('paragraph', { name: 'الكتلة المحددة' })).toHaveTextContent('العنوان');
    const tabs = within(screen.getByRole('tablist', { name: 'لوحة الجزء' }));
    expect(tabs.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['المحتوى', 'التصميم']);
    expect(screen.getByRole('button', { name: 'العودة إلى الكتلة' })).toBeInTheDocument();
    await user.click(tabs.getByRole('tab', { name: 'التصميم' }));
    const direction = screen.getByRole('radiogroup', { name: 'اتجاه النص' });
    expect(within(direction).getByRole('radio', { name: 'تلقائي' })).toBeInTheDocument();
    expect(within(direction).getByRole('radio', { name: 'من اليمين إلى اليسار' })).toBeInTheDocument();
  });

  it('a focus on another block, or on an undeclared part, is the ordinary block panel', () => {
    const kernel = makePartTestKernel();
    kernel.focusPart(PROMO_ID, { part: 'nope', index: [] });
    render(<Inspector kernel={kernel} />);
    expect(selectedName()).toHaveTextContent('Promo');
    expect(screen.queryByRole('tablist', { name: 'Part panel' })).not.toBeInTheDocument();
  });
});
