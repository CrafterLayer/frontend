import * as RadixAccordion from '@radix-ui/react-accordion';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { AccordionItem } from './AccordionItem';
import { accordionItemSchema } from './schema';

/*
  An item is rendered inside a Radix root, because that is the only place it is
  meaningful: it reads its open state and its keyboard position from there.
  Testing one bare would test a control that cannot be operated.
*/
function renderItem(title: string, children: React.ReactNode = <p>The answer.</p>) {
  const node: Node = { id: 'q1', type: 'accordionItem', props: { title } };
  return render(
    <RadixAccordion.Root type="single" collapsible>
      <AccordionItem
        node={node}
        props={accordionItemSchema.props.parse({ title })}
        slots={{ default: children }}
        data={{}}
        isCanvas={false}
      />
    </RadixAccordion.Root>,
  );
}

describe('AccordionItem', () => {
  it('is a button named by its visible title', () => {
    renderItem('How long does delivery take?');

    expect(
      screen.getByRole('button', { name: 'How long does delivery take?' }),
    ).toBeInTheDocument();
  });

  it('starts closed and opens when activated', async () => {
    renderItem('A question');
    const trigger = screen.getByRole('button', { name: 'A question' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens from the keyboard, not only the mouse', async () => {
    renderItem('A question');
    screen.getByRole('button', { name: 'A question' }).focus();

    await userEvent.keyboard('{Enter}');

    expect(screen.getByRole('button', { name: 'A question' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('reveals whatever its slot holds, having no opinion about it', async () => {
    renderItem(
      'What is included?',
      <ul>
        <li>Unlimited pages</li>
      </ul>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'What is included?' }));

    expect(screen.getByRole('listitem')).toHaveTextContent('Unlimited pages');
  });

  /*
    The title is rendered as a CHILD, never copied into an attribute. Inline
    editing swaps that property for a React element, and an element placed in
    `aria-label` stringifies to "[object Object]" — a defect this project has
    already been bitten by once.
  */
  it('takes its accessible name from the visible text, not from a copied attribute', () => {
    renderItem('A question');
    const trigger = screen.getByRole('button', { name: 'A question' });

    expect(trigger).not.toHaveAttribute('aria-label');
    expect(trigger).toHaveTextContent('A question');
  });

  it('hides the chevron from assistive technology', () => {
    const { container } = renderItem('A question');

    expect(container.querySelector('.pri-accordion-item__chevron')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('uses its node id as the value the accordion identifies it by', () => {
    const { container } = renderItem('A question');

    // Radix stamps the item's value onto its own data attributes.
    expect(container.querySelector('.pri-accordion-item')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'A question' })).toHaveAttribute('id');
  });

  it('refuses an empty title at the schema, before it can reach the DOM', () => {
    expect(accordionItemSchema.props.safeParse({ title: '' }).success).toBe(false);
  });

  it('stores no literal colour or length in its props', () => {
    const parsed = accordionItemSchema.props.parse({ title: 'A question' });

    expect(JSON.stringify(parsed)).not.toMatch(/#[0-9a-f]{3,8}\b/i);
    expect(JSON.stringify(parsed)).not.toMatch(/\d+px/);
  });
});
