import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Separator } from './Separator';
import { separatorSchema } from './schema';

const node: Node = { id: 'separator', type: 'separator', props: {} };

function renderSeparator(overrides: Record<string, unknown> = {}) {
  return render(
    <Separator
      node={node}
      props={separatorSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Separator', () => {
  it('renders an unlabelled horizontal divider with native separator semantics', () => {
    renderSeparator();
    const separator = screen.getByRole('separator');
    expect(separator).toHaveAttribute('aria-orientation', 'horizontal');
    expect(separator).toHaveClass('w-full', 'border-t', 'border-text/15', 'my-6');
    expect(separator).toBeEmptyDOMElement();
  });

  it('renders a visible label between two decorative lines', () => {
    renderSeparator({ label: 'Next chapter', tone: 'accent', thickness: 'medium' });
    const separator = screen.getByRole('separator', { name: 'Next chapter' });
    expect(screen.getByText('Next chapter')).toHaveClass('text-accent');
    expect(separator.querySelectorAll('[aria-hidden="true"]')).toHaveLength(2);
    expect(separator.querySelector('[aria-hidden="true"]')).toHaveClass(
      'border-t-2',
      'border-accent',
    );
  });

  it('uses logical vertical borders and token spacing', () => {
    renderSeparator({
      label: 'Aside',
      orientation: 'vertical',
      spacing: 'roomy',
      style: 'dashed',
      thickness: 'strong',
      tone: 'accent',
    });
    const separator = screen.getByRole('separator', { name: 'Aside' });
    expect(separator).toHaveAttribute('aria-orientation', 'vertical');
    expect(separator).toHaveClass('flex-col', 'mx-10');
    expect(separator.querySelector('[aria-hidden="true"]')).toHaveClass(
      'border-s-4',
      'border-dashed',
      'border-accent',
    );
    expect(screen.getByText('Aside')).toHaveClass('-rotate-90');
  });

  it('exposes every prop and rejects unsupported values or unsafe utilities', () => {
    const defaults = separatorSchema.props.parse({});
    expect(defaults).toEqual({
      orientation: 'horizontal',
      spacing: 'regular',
      style: 'solid',
      thickness: 'hairline',
      tone: 'subtle',
    });
    expect(Object.keys(separatorSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(separatorSchema.props.shape).sort(),
    );
    expect(separatorSchema.props.safeParse({ orientation: 'diagonal' }).success).toBe(false);
    expect(separatorSchema.props.safeParse({ className: 'border-red-500' }).success).toBe(false);
    expect(separatorSchema.props.safeParse({ className: 'md:my-8' }).success).toBe(true);
  });
});
