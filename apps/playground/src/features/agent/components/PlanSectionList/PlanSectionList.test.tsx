/**
 * PlanSectionList (SPEC §4.11): the plan's sections, reorderable three ways (a drag of the
 * handle, Alt+↑ / Alt+↓, the row menu), each the same `move` op.
 *
 * What is ours to prove: the list is named with its count; every reorder sends one op with
 * the section's new index; focus stays on the moved row's control (SPEC §4.11 "focus stays
 * on the moved row's handle"), asserted by name, even when the row's element is re-inserted;
 * a removal hands focus to the row that took its place; and the controller's announcement
 * is the sentence LiveStatus speaks.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Locale, PlanOp, PlanSectionView } from '../../model/view-types';
import { dentalDraft, planReady, useLivePlan } from '../../testing/wp-13-decisions-fixtures';

import { PlanSectionList, planRowTransitionName } from './PlanSectionList';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const CSS = readFileSync(
  join(
    process.cwd(),
    'src',
    'features',
    'agent',
    'components',
    'PlanSectionList',
    'PlanSectionList.css',
  ),
  'utf8',
).replace(/\/\*[\s\S]*?\*\//g, '');

function Live({ locale = 'en' }: { readonly locale?: Locale }) {
  const plan = useLivePlan(locale, dentalDraft(locale));
  return (
    <>
      <PlanSectionList
        locale={locale}
        sections={plan.view.sections}
        editable
        accepts={plan.accepts}
        onEdit={(op) => {
          plan.edit(plan.view.turnId, op);
        }}
      />
      <output data-testid="said">{plan.announcement ?? ''}</output>
    </>
  );
}

function sections(locale: Locale = 'en'): readonly PlanSectionView[] {
  return planReady(locale).sections;
}

function titles(): string[] {
  return within(screen.getByRole('list'))
    .getAllByRole('listitem')
    .map((row) => row.querySelector('.ck-agent-plan-row__title')?.textContent ?? '');
}

function pointer(type: string, init: PointerEventInit) {
  act(() => {
    window.dispatchEvent(new PointerEvent(type, { bubbles: true, ...init }));
  });
}

describe('PlanSectionList', () => {
  it('is a list named with its count, one row per section in page order', () => {
    render(<PlanSectionList locale="en" sections={sections()} editable onEdit={vi.fn()} />);
    const list = screen.getByRole('list', { name: 'Sections (8)' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    expect(titles()[0]).toBe('Header');
    expect(titles()[7]).toBe('Contact');
  });

  it('numbers the rows for the eye only: the position is not read twice', () => {
    render(<PlanSectionList locale="ar" sections={sections('ar')} editable onEdit={vi.fn()} />);
    const numbers = screen
      .getAllByRole('listitem')
      .map((row) => row.querySelector('.ck-agent-plan-row__number'));
    expect(numbers[2]).toHaveTextContent('3');
    expect(numbers[2]).toHaveAttribute('aria-hidden', 'true');
  });

  it('sends one move op with the new index for Alt+↓ and Alt+↑', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn<(op: PlanOp) => void>();
    render(<PlanSectionList locale="en" sections={sections()} editable onEdit={onEdit} />);
    screen.getByRole('button', { name: 'Reorder Doctors' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'move', key: 'doctors', to: 5 });
    await user.keyboard('{Alt>}{ArrowUp}{/Alt}');
    expect(onEdit).toHaveBeenLastCalledWith({ kind: 'move', key: 'doctors', to: 3 });
  });

  it('keeps focus on the moved row’s handle when the row moves down, and announces it', async () => {
    const user = userEvent.setup();
    render(<Live />);
    screen.getByRole('button', { name: 'Reorder Why us' }).focus();
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');
    await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

    expect(titles().slice(3, 6)).toEqual(['Doctors', 'Testimonials', 'Why us']);
    expect(screen.getByTestId('said')).toHaveTextContent('Moved Why us to position 6 of 8');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Reorder Why us' })).toHaveFocus();
    });
  });

  it('offers a move the engine would refuse as unavailable (the header stays first)', async () => {
    const user = userEvent.setup();
    render(<Live />);
    await user.click(screen.getByRole('button', { name: 'Options for Hero' }));
    expect(screen.getByRole('menuitem', { name: 'Move up' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('moves from the row menu and returns focus to that row’s [⋯]', async () => {
    const user = userEvent.setup();
    render(<Live />);
    await user.click(screen.getByRole('button', { name: 'Options for Testimonials' }));
    await user.click(screen.getByRole('menuitem', { name: 'Move down' }));
    expect(titles().slice(5, 7)).toEqual(['FAQ', 'Testimonials']);
    expect(screen.getByTestId('said')).toHaveTextContent('Moved Testimonials to position 7 of 8');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Options for Testimonials' })).toHaveFocus();
    });
  });

  it('drags a row by its handle: rows make way, and the drop is one move op', () => {
    const onEdit = vi.fn<(op: PlanOp) => void>();
    const { container } = render(
      <PlanSectionList locale="en" sections={sections()} editable onEdit={onEdit} />,
    );
    const handle = screen.getByRole('button', { name: 'Reorder Services' });
    fireEvent.pointerDown(handle, { pointerId: 7, button: 0, clientY: 100 });
    // A few pixels is a press, not a drag.
    pointer('pointermove', { pointerId: 7, clientY: 102 });
    expect(container.querySelector('[data-lifted]')).toBeNull();

    // Two rows down (jsdom lays nothing out: a row counts as its 32px fine-pointer height).
    pointer('pointermove', { pointerId: 7, clientY: 166 });
    const lifted = container.querySelector<HTMLElement>('[data-lifted]');
    expect(lifted).toHaveAttribute('data-key', 'services');
    expect(lifted?.style.getPropertyValue('--ck-agent-plan-row-shift')).toBe('0 66px');
    const whyUs = container.querySelector<HTMLElement>('[data-key="why-us"]');
    expect(whyUs?.style.getPropertyValue('--ck-agent-plan-row-shift')).toBe('0 -32px');
    const faq = container.querySelector<HTMLElement>('[data-key="faq"]');
    expect(faq?.style.getPropertyValue('--ck-agent-plan-row-shift')).toBe('');

    pointer('pointerup', { pointerId: 7, clientY: 166 });
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledWith({ kind: 'move', key: 'services', to: 4 });
    expect(container.querySelector('[data-lifted]')).toBeNull();
  });

  it('cancels a drag on Esc: nothing moves', () => {
    const onEdit = vi.fn<(op: PlanOp) => void>();
    const { container } = render(
      <PlanSectionList locale="en" sections={sections()} editable onEdit={onEdit} />,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Reorder Services' }), {
      pointerId: 3,
      button: 0,
      clientY: 100,
    });
    pointer('pointermove', { pointerId: 3, clientY: 180 });
    expect(container.querySelector('[data-lifted]')).not.toBeNull();
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    pointer('pointerup', { pointerId: 3, clientY: 180 });
    expect(onEdit).not.toHaveBeenCalled();
    expect(container.querySelector('[data-lifted]')).toBeNull();
  });

  it('after a removal, hands focus to the row that took the removed one’s place', async () => {
    const user = userEvent.setup();
    render(<Live />);
    await user.click(screen.getByRole('button', { name: 'Options for Services' }));
    await user.click(screen.getByRole('menuitem', { name: 'Remove section' }));
    expect(titles()).not.toContain('Services');
    expect(screen.getByTestId('said')).toHaveTextContent('Removed Services from the plan');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Options for Why us' })).toHaveFocus();
    });
  });

  it('read-only: no handle, no menu, nothing to drag', () => {
    render(<PlanSectionList locale="en" sections={sections()} editable={false} onEdit={vi.fn()} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('names each row for the plan-to-build morph only when asked', () => {
    const { container, rerender } = render(
      <PlanSectionList locale="en" sections={sections()} editable onEdit={vi.fn()} />,
    );
    const name = () =>
      container
        .querySelector<HTMLElement>('[data-key="why-us"]')
        ?.style.getPropertyValue('--ck-agent-plan-row-name');
    expect(name()).toBe('');
    rerender(<PlanSectionList locale="en" sections={sections()} editable onEdit={vi.fn()} morph />);
    expect(name()).toBe('ck-plan-row-why-us');
    expect(planRowTransitionName('قسم 2')).toMatch(/^ck-plan-row-[A-Za-z0-9_-]+$/u);
  });

  it('styles with logical properties and theme tokens only', () => {
    expect(CSS).not.toMatch(
      /(?:^|[\s;{])(?:left|right|margin-left|margin-right|padding-left|padding-right|border-left|border-right)\s*:/mu,
    );
    expect(CSS).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/iu);
  });
});
