import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { FormSection } from './FormSection';
import { formSectionSchema } from './schema';

const node: Node = { id: 'lead-form', type: 'formSection', props: {} };

function renderForm(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <FormSection
      node={node}
      props={formSectionSchema.props.parse({
        eyebrow: 'Project enquiry',
        body: 'Tell us enough to recommend a useful next step.',
        footerNote: 'We reply within two business days.',
        successHint: 'You will receive a confirmation after submission.',
        action: '/enquiry',
        ...overrides,
      })}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('FormSection', () => {
  it('renders the default native fields with publishable form semantics', () => {
    renderForm();

    expect(screen.getByRole('region', { name: 'Tell us what you need' })).toHaveClass('@container');
    const form = screen.getByRole('form', { name: 'Tell us what you need' });
    expect(form).toHaveAttribute('action', '/enquiry');
    expect(form).toHaveAttribute('method', 'post');
    expect(screen.getByLabelText(/Name/)).toHaveAttribute('autocomplete', 'name');
    expect(screen.getByLabelText(/Work email/)).toHaveAttribute('type', 'email');
    expect(screen.getByLabelText(/How can we help/)).toBeRequired();
    expect(screen.getByRole('button', { name: 'Send request' })).toHaveAttribute('type', 'submit');
  });

  it('renders select, checkbox, and helper content accessibly', () => {
    renderForm({
      fields: [
        {
          id: 'service',
          name: 'service',
          type: 'select',
          label: 'Service',
          placeholder: 'Choose one',
          options: [
            { label: 'Strategy', value: 'strategy' },
            { label: 'Design', value: 'design' },
          ],
          required: true,
          width: 'half',
        },
        {
          id: 'consent',
          name: 'consent',
          type: 'checkbox',
          label: 'I agree to be contacted',
          helper: 'Only about this enquiry.',
          required: true,
          width: 'full',
        },
      ],
    });

    expect(screen.getByLabelText(/Service/)).toHaveDisplayValue('Choose one');
    expect(screen.getByRole('option', { name: 'Design' })).toHaveValue('design');
    const consent = screen.getByRole('checkbox', { name: /I agree to be contacted/ });
    expect(consent).toBeRequired();
    expect(consent).toHaveAccessibleDescription('Only about this enquiry.');
  });

  it('prevents form navigation while editing in the builder canvas', () => {
    renderForm({}, true);
    const form = screen.getByRole('form', { name: 'Tell us what you need' });
    const event = new Event('submit', { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it.each(['split', 'card', 'minimal'] as const)('renders the %s layout', (variant) => {
    renderForm({ variant });
    expect(
      screen
        .getByRole('region', { name: 'Tell us what you need' })
        .querySelector('[data-form-layout]'),
    ).toHaveAttribute('data-form-layout', variant);
  });

  it('applies button, density, and section token controls', () => {
    renderForm({
      background: 'surfaceInverse',
      buttonVariant: 'outline',
      buttonWidth: 'full',
      controlDensity: 'compact',
      controlRadius: 'small',
      fontSize: 'lg',
      paddingInlineStart: 4,
    });

    const section = screen.getByRole('region', { name: 'Tell us what you need' });
    expect(section).toHaveClass('mkt-type--size-lg');
    expect(section.style.background).toBe('var(--t-surface-inverse)');
    expect(section.style.paddingInlineStart).toBe('calc(var(--t-space-unit, 4px) * 4)');
    expect(screen.getByLabelText(/Name/)).toHaveClass('min-h-10', 'rounded');
    expect(screen.getByRole('button', { name: 'Send request' })).toHaveClass(
      'w-full',
      'bg-transparent',
    );
  });

  it('keeps every prop inspector-visible and rejects unsafe or ambiguous field contracts', () => {
    const defaults = formSectionSchema.props.parse({});
    expect(defaults).toMatchObject({
      buttonVariant: 'solid',
      controlDensity: 'comfortable',
      method: 'post',
      variant: 'split',
    });
    expect(defaults.fields.some((field) => field.name === 'email' && field.type === 'email')).toBe(
      true,
    );
    expect(Object.keys(formSectionSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(formSectionSchema.props.shape).sort(),
    );
    expect(formSectionSchema.props.safeParse({ action: 'javascript:alert(1)' }).success).toBe(
      false,
    );
    expect(formSectionSchema.props.safeParse({ action: '//evil.example/collect' }).success).toBe(
      false,
    );
    expect(
      formSectionSchema.props.safeParse({
        fields: [
          { id: 'same', name: 'first', label: 'First' },
          { id: 'same', name: 'second', label: 'Second' },
        ],
      }).success,
    ).toBe(false);
  });

  it('leaves native controls interactive outside submission', () => {
    renderForm();
    const name = screen.getByLabelText(/Name/);
    fireEvent.change(name, { target: { value: 'Mira' } });
    expect(name).toHaveValue('Mira');
  });
});
