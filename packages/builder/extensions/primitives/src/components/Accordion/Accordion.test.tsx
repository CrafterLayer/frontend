import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AccordionItem } from '../AccordionItem/AccordionItem';
import { accordionItemSchema } from '../AccordionItem/schema';
import { Accordion } from './Accordion';
import { accordionSchema } from './schema';

function item(id: string, title: string) {
  const node: Node = { id, type: 'accordionItem', props: { title } };
  return (
    <AccordionItem
      key={id}
      node={node}
      props={accordionItemSchema.props.parse({ title })}
      slots={{ default: <p>{`${title} answer`}</p> }}
      data={{}}
      isCanvas={false}
    />
  );
}

function renderAccordion(props: Record<string, unknown>, ids = ['q1', 'q2', 'q3']) {
  const node: Node = {
    id: 'faq',
    type: 'accordion',
    props: {},
    slots: { default: ids },
  };
  return render(
    <Accordion
      node={node}
      props={accordionSchema.props.parse(props)}
      slots={{ default: ids.map((id, index) => item(id, `Question ${String(index + 1)}`)) }}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Accordion', () => {
  it('renders each item as a button named by its visible title', () => {
    renderAccordion({});

    expect(screen.getByRole('button', { name: 'Question 1' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Question 3' })).toBeInTheDocument();
  });

  it('starts closed by default', () => {
    renderAccordion({});

    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('reveals an item content when its trigger is activated', async () => {
    renderAccordion({});

    await userEvent.click(screen.getByRole('button', { name: 'Question 2' }));

    expect(screen.getByRole('button', { name: 'Question 2' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Question 2 answer')).toBeVisible();
  });

  /*
    The behaviour a person means by "single": opening one closes the last. It is
    asserted here rather than trusted because it is the difference between an
    FAQ and a wall of open text, and it is the reason `mode` exists at all.
  */
  it('closes the previous item in single mode', async () => {
    renderAccordion({ mode: 'single' });

    await userEvent.click(screen.getByRole('button', { name: 'Question 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Question 2' }));

    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('holds several open in multiple mode', async () => {
    renderAccordion({ mode: 'multiple' });

    await userEvent.click(screen.getByRole('button', { name: 'Question 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Question 2' }));

    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Question 2' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  /*
    The bug this test exists for. The first attempt read the open item's id off
    the rendered CHILD elements via `data-bldr-node` — canvas scaffolding that
    is present in the editor and absent from static output. The accordion would
    have opened correctly while editing and opened nothing once published.
    `node.slots` is document data and reads the same on both paths, so this
    renders with `isCanvas: false` on purpose.
  */
  it('opens the first item from the DOCUMENT, not from canvas scaffolding', () => {
    renderAccordion({ defaultOpen: 'first' });

    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Question 2' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('opens nothing when the document does not ask for it', () => {
    renderAccordion({ defaultOpen: 'none' });

    for (const name of ['Question 1', 'Question 2', 'Question 3']) {
      expect(screen.getByRole('button', { name })).toHaveAttribute('aria-expanded', 'false');
    }
  });

  it('survives an empty accordion asked to open its first item', () => {
    const { container } = renderAccordion({ defaultOpen: 'first' }, []);

    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  /*
    `single` and `multiple` are separate elements — Radix types `defaultValue`
    as a string for one and an array for the other — so `defaultOpen` has TWO
    implementations and each needs proving. Only the `single` one was covered,
    which means the multiple-mode branch could have shipped opening nothing (or
    throwing on an empty accordion) with the suite still green.
  */
  it('opens the first item in MULTIPLE mode too', () => {
    renderAccordion({ mode: 'multiple', defaultOpen: 'first' });

    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Question 2' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('survives an EMPTY accordion in multiple mode asked to open its first item', () => {
    const { container } = renderAccordion({ mode: 'multiple', defaultOpen: 'first' }, []);

    expect(container.querySelectorAll('button')).toHaveLength(0);
  });

  /*
    The keyboard model is the reason this primitive is vendored rather than
    written. It comes from Radix; this test is what proves the wrapper did not
    quietly break it.
  */
  it('moves between items with arrow keys', async () => {
    renderAccordion({});
    const first = screen.getByRole('button', { name: 'Question 1' });

    first.focus();
    await userEvent.keyboard('{ArrowDown}');

    expect(screen.getByRole('button', { name: 'Question 2' })).toHaveFocus();
  });

  it('jumps to the last item with End and back with Home', async () => {
    renderAccordion({});
    screen.getByRole('button', { name: 'Question 1' }).focus();

    await userEvent.keyboard('{End}');
    expect(screen.getByRole('button', { name: 'Question 3' })).toHaveFocus();

    await userEvent.keyboard('{Home}');
    expect(screen.getByRole('button', { name: 'Question 1' })).toHaveFocus();
  });

  it('carries motion as attributes, never as an inline timing', () => {
    const { container } = renderAccordion({ motion: { reveal: 'fade-up', duration: 'slow' } });
    const root = container.firstElementChild;

    expect(root?.className).toContain('bldr-motion');
    expect(root?.getAttribute('data-reveal')).toBe('fade-up');
    expect(root?.outerHTML ?? '').not.toMatch(/\d+ms/);
  });

  it('stores no literal colour or length in its props', () => {
    const parsed = accordionSchema.props.parse({ mode: 'single' });

    expect(JSON.stringify(parsed)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(JSON.stringify(parsed)).not.toMatch(/\d+px/);
  });
});
