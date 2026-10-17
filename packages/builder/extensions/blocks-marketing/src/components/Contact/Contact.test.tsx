import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Contact } from './Contact';
import { contactSchema } from './schema';

const node: Node = { id: 'contact', type: 'contact', props: {} };

function renderContact(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <Contact
      node={node}
      props={contactSchema.props.parse({
        heading: 'Contact us',
        body: 'Tell us what you are building.',
        email: 'hello@example.com',
        phone: '+970 59 123 4567',
        address: 'Main Street\nRamallah',
        availability: 'Replies within one business day',
        formAction: '/contact',
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('Contact', () => {
  it('renders direct contact paths and a fully labelled form', () => {
    renderContact({ eyebrow: 'Say hello', formBody: 'A short note is enough.' });

    expect(screen.getByRole('region', { name: 'Contact us' })).toHaveClass('@container');
    expect(screen.getByText('Say hello')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(screen.getByRole('link', { name: '+970 59 123 4567' })).toHaveAttribute(
      'href',
      'tel:+970591234567',
    );
    expect(screen.getByRole('form', { name: 'Tell us about your project' })).toHaveAttribute(
      'action',
      '/contact',
    );
    expect(screen.getByRole('form', { name: 'Tell us about your project' })).toHaveClass(
      'rounded-xl',
      'shadow-soft',
    );
    expect(screen.getByLabelText('Name')).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText('Work email')).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText('How can we help?')).toBeRequired();
    expect(screen.getByRole('button', { name: 'Send enquiry' })).toHaveAttribute('type', 'submit');
  });

  it('prevents navigation when the form is rendered in the builder canvas', () => {
    renderContact({}, true);
    const form = screen.getByRole('form', { name: 'Tell us about your project' });
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
  });

  it.each(['split', 'card', 'centered'] as const)('renders the %s layout', (variant) => {
    renderContact({ variant, showForm: variant !== 'centered' });
    expect(screen.getByRole('region', { name: 'Contact us' }).firstElementChild).toHaveAttribute(
      'data-contact-layout',
      variant,
    );
    if (variant === 'centered') {
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    }
  });

  it('combines token colour, typography, and logical spacing controls', () => {
    renderContact({ background: 'surfaceInverse', fontSize: 'lg', paddingBlockEnd: 5 });
    const section = screen.getByRole('region', { name: 'Contact us' });
    expect(section).toHaveClass('mkt-type--size-lg');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.paddingBlockEnd).toBe('calc(var(--t-space-unit, 4px) * 5)');
  });

  it('rejects unsafe form actions and exposes every prop to the inspector', () => {
    const defaults = contactSchema.props.parse({});
    expect(defaults).toMatchObject({
      formTitle: 'Tell us about your project',
      heading: "Let's work together",
      method: 'post',
      showForm: true,
      spacing: 'lg',
      submitLabel: 'Send enquiry',
      variant: 'split',
      width: 'wide',
    });
    expect(Object.keys(contactSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(contactSchema.props.shape).sort(),
    );
    expect(contactSchema.props.safeParse({ formAction: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(contactSchema.props.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});
