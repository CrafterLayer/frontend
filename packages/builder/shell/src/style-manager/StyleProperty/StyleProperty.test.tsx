import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { StylePropertyId } from '@craftkit/builder-schema';

import { installBrowserStandIns } from '../test-support';
import { viewStyles, type PropertyView } from '../style-view';
import { STYLE_PANEL_LABELS_AR, STYLE_PANEL_LABELS_EN } from '../StylePanel/StylePanel.labels';
import { StyleProperty, type StylePropertyProps } from './StyleProperty';

beforeAll(installBrowserStandIns);

function viewOf(views: ReadonlyMap<StylePropertyId, PropertyView>, id: StylePropertyId): PropertyView {
  const view = views.get(id);
  if (view === undefined) throw new Error(`no view for ${id}`);
  return view;
}
afterEach(cleanup);

function setup(className: string, id: StylePropertyId, overrides: Partial<StylePropertyProps> = {}) {
  const views = viewStyles([className], { bucket: 'base', state: 'default' });
  const onEdit = vi.fn();
  render(
    <StyleProperty
      view={viewOf(views, id)}
      mode="free"
      dir="ltr"
      tokens={[{ id: 'accent', name: 'Accent', css: '#2563eb' }]}
      palette={[]}
      onEdit={onEdit}
      labels={STYLE_PANEL_LABELS_EN}
      {...overrides}
    />,
  );
  return onEdit;
}

describe('StyleProperty', () => {
  it('a radio row writes a keyword', async () => {
    const user = userEvent.setup();
    const onEdit = setup('flex', 'display');
    await user.click(screen.getByRole('radio', { name: 'Grid' }));
    expect(onEdit).toHaveBeenCalledWith([{ property: 'display', value: { kind: 'keyword', keyword: 'grid' } }], 'Display');
  });

  it('a number row steps on the scale', () => {
    const onEdit = setup('gap-4', 'gap');
    fireEvent.keyDown(screen.getByRole('spinbutton', { name: 'Gap' }), { key: 'PageUp' });
    expect(onEdit).toHaveBeenCalledWith([{ property: 'gap', value: { kind: 'token', token: '5' } }], 'Gap');
  });

  it('Reset removes only the class behind the value', async () => {
    const user = userEvent.setup();
    const onEdit = setup('text-lg', 'fontSize');
    await user.click(screen.getByRole('button', { name: 'Size: Set here' }));
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(onEdit).toHaveBeenCalledWith([{ property: 'fontSize', value: null }], 'Size');
  });

  it('padding and margin share one box model; each ring writes its own property', () => {
    const views = viewStyles(['p-4'], { bucket: 'base', state: 'default' });
    const onEdit = vi.fn();
    render(
      <StyleProperty
        view={viewOf(views, 'padding')}
        companion={viewOf(views, 'margin')}
        mode="free"
        dir="ltr"
        tokens={[]}
        palette={[]}
        onEdit={onEdit}
        labels={STYLE_PANEL_LABELS_EN}
      />,
    );
    const side = screen.getByRole('button', { name: /^Margin block-end/u });
    fireEvent.pointerDown(side, { pointerId: 1, button: 0, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(side, { pointerId: 1, clientX: 0, clientY: 16 });
    fireEvent.pointerUp(side, { pointerId: 1, clientX: 0, clientY: 16 });
    expect(onEdit).toHaveBeenCalledWith(
      [{ property: 'margin', value: { kind: 'token', token: '2' }, side: 'block-end' }],
      'Margin',
    );
  });

  it('shows the custom breakpoint badge and Arabic labels', () => {
    setup('text-sm xl:text-lg', 'fontSize', { labels: STYLE_PANEL_LABELS_AR });
    expect(screen.getByText('نقطة توقف مخصّصة')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'الحجم' })).toBeInTheDocument();
  });
});
