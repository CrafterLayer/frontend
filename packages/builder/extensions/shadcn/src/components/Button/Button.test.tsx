import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Button } from './Button';
import { buttonSchema } from './schema';

const node: Node = { id: 'button', type: 'button', props: {} };

function renderButton(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Button
      node={node}
      props={buttonSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('Button', () => {
  it('renders a native button when no destination is configured', () => {
    renderButton({ label: 'Save', type: 'submit' });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('type', 'submit');
  });

  it('renders a safe link and protects new tabs', () => {
    renderButton({ label: 'Open docs', href: 'https://example.com/docs', openInNewTab: true });
    expect(screen.getByRole('link', { name: 'Open docs' })).toHaveAttribute(
      'href',
      'https://example.com/docs',
    );
    expect(screen.getByRole('link', { name: 'Open docs' })).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link', { name: 'Open docs' })).toHaveAttribute(
      'rel',
      'noreferrer noopener',
    );
  });

  it('keeps authored destinations visible but suppresses navigation on the canvas', () => {
    renderButton({ label: 'Canvas action', href: '/destination' }, true);
    const link = screen.getByRole('link', { name: 'Canvas action' });
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(link).toHaveAttribute('href', '/destination');
  });

  it('applies visual, sizing, alignment, and icon controls', () => {
    renderButton({
      align: 'center',
      icon: 'arrow',
      iconPosition: 'start',
      radius: 'pill',
      size: 'large',
      variant: 'outline',
      width: 'full',
    });
    const button = screen.getByRole('button', { name: 'Get started' });
    expect(button).toHaveClass('w-full', 'rounded-full', 'min-h-12', 'bg-transparent');
    expect(button.parentElement).toHaveClass('justify-center');
    expect(button.firstElementChild).toHaveTextContent('→');
  });

  it('exposes all props and rejects unsafe links or utilities', () => {
    expect(Object.keys(buttonSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(buttonSchema.props.shape).sort(),
    );
    expect(buttonSchema.props.safeParse({ href: 'javascript:alert(1)' }).success).toBe(false);
    expect(buttonSchema.props.safeParse({ href: '//evil.example/action' }).success).toBe(false);
    expect(buttonSchema.props.safeParse({ className: 'text-red-600' }).success).toBe(false);
    expect(buttonSchema.props.safeParse({ className: 'md:px-6' }).success).toBe(true);
  });
});
