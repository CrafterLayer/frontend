import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { FormSection } from './FormSection';
import { formSectionSchema, type FormSectionProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, every field's label, hint and
  select choices, the submit button and the notes are addressable on the
  canvas, carry nothing extra when published, take classes and direction from
  `partStyles`, and render an inline editor swapped in at its bind exactly
  once. A placeholder stays an attribute, never text.
*/
const node: Node = { id: 'form-parts', type: 'formSection', props: {} };

const FULL = {
  eyebrow: 'Project enquiry',
  heading: 'Tell us what you need.',
  body: 'A concise brief is enough.',
  variant: 'card',
  footerNote: 'We reply within two business days.',
  successHint: 'You will receive a confirmation.',
  fields: [
    { id: 'name', name: 'name', label: 'Name', placeholder: 'Your name', helper: 'As on your ID.' },
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
    },
  ],
};

type Swap = (props: FormSectionProps) => FormSectionProps;

function renderForm(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = formSectionSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<FormSection node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('FormSection parts', () => {
  it('stamps each field, its label, hint and choices on the canvas', () => {
    const { container } = renderForm({}, true);
    expect(partsNamed(container, 'fields')[0]?.tagName).toBe('FORM');
    expect(partsNamed(container, 'field')[1]).toHaveAttribute('data-ck-bind', 'fields.1');
    expect(partsNamed(container, 'field.label').map((label) => label.dataset['ckBind'])).toEqual([
      'fields.0.label',
      'fields.1.label',
    ]);
    expect(partsNamed(container, 'field.helper')[0]).toHaveAttribute(
      'data-ck-bind',
      'fields.0.helper',
    );
    const options = partsNamed(container, 'field.option');
    expect(options.map((option) => option.dataset['ckPartIndex'])).toEqual(['1.0', '1.1']);
    expect(options[1]).toHaveAttribute('data-ck-bind', 'fields.1.options.1.label');
    for (const name of ['submitLabel', 'footerNote', 'successHint']) {
      expect(partsNamed(container, name)[0], name).toHaveAttribute('data-ck-bind', name);
    }
  });

  it('publishes no part markers and keeps every placeholder out of the text', () => {
    const { container } = renderForm({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(container.querySelector('input')).toHaveAttribute('placeholder', 'Your name');
    expect(container.querySelector('option[value=""]')).toHaveAttribute('label', 'Choose one');
    expect(container.textContent).not.toContain('Choose one');
  });

  it('applies an all-items style to every label and a this-item style to one, this winning', () => {
    const { container } = renderForm(
      {
        partStyles: {
          'field.label': { className: 'ps-4' },
          'field.label@1': { className: 'ps-8', dir: 'rtl' },
        },
      },
      true,
    );
    const labels = partsNamed(container, 'field.label');
    expect(labels[0]).toHaveClass('ps-4');
    expect(labels[0]).toHaveAttribute('dir', 'auto');
    expect(labels[1]).toHaveClass('ps-8');
    expect(labels[1]).not.toHaveClass('ps-4');
    expect(labels[1]).toHaveAttribute('dir', 'rtl');
  });

  it('gives text parts their own direction and leaves the fields to the page', () => {
    const { container } = renderForm({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('button')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('form')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderForm({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      submitLabel: swapped('submitLabel'),
      fields: props.fields.map((field, index) => ({
        ...field,
        label: swapped(`fields.${String(index)}.label`),
        options: field.options.map((option, at) => ({
          ...option,
          label: swapped(`fields.${String(index)}.options.${String(at)}.label`),
        })),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'submitLabel',
      'fields.0.label',
      'fields.1.label',
      'fields.1.options.1.label',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
