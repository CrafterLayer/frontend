import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Contact } from './Contact';
import { contactSchema, type ContactProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, every contact detail, the
  availability note and the form's title, text, field labels and button are
  addressable on the canvas, carry nothing extra when published, take classes
  and direction from `partStyles`, and render an inline editor swapped in at
  its bind exactly once — the email and phone links never copy an editor into
  their address.
*/
const node: Node = { id: 'contact-parts', type: 'contact', props: {} };

const FULL = {
  eyebrow: 'Say hello',
  heading: 'Contact us.',
  body: 'Tell us what you are building.',
  email: 'hello@example.com',
  phone: '+970 59 123 4567',
  address: 'Main Street\nRamallah',
  availability: 'Replies within one business day',
  formBody: 'A short note is enough.',
};

const TEXT_PARTS = [
  'eyebrow',
  'heading',
  'body',
  'email',
  'phone',
  'address',
  'availability',
  'formTitle',
  'formBody',
  'nameLabel',
  'emailLabel',
  'messageLabel',
  'submitLabel',
] as const;

type Swap = (props: ContactProps) => ContactProps;

function renderContact(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = contactSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Contact node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Contact parts', () => {
  it('stamps every visible line of the details and the form on the canvas', () => {
    const { container } = renderContact({}, true);
    for (const name of TEXT_PARTS) {
      const found = partsNamed(container, name);
      expect(found, name).toHaveLength(1);
      expect(found[0], name).toHaveAttribute('data-ck-bind', name);
    }
    /* A field label part wraps its text, not the input it names. */
    expect(partsNamed(container, 'nameLabel')[0]?.querySelector('input')).toBeNull();
  });

  it('publishes no part markers and keeps the contact links and labels', () => {
    const { container } = renderContact({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'hello@example.com' })).toHaveAttribute(
      'href',
      'mailto:hello@example.com',
    );
    expect(screen.getByRole('link', { name: '+970 59 123 4567' })).toHaveAttribute(
      'href',
      'tel:+970591234567',
    );
    expect(screen.getByLabelText('Work email')).toHaveAttribute('type', 'email');
  });

  it('applies part styles and direction to exactly their element', () => {
    const { container } = renderContact(
      {
        partStyles: {
          phone: { className: 'ps-4', dir: 'ltr' },
          submitLabel: { className: 'w-full' },
        },
      },
      true,
    );
    expect(partsNamed(container, 'phone')[0]).toHaveClass('ps-4', 'font-semibold');
    expect(partsNamed(container, 'phone')[0]).toHaveAttribute('dir', 'ltr');
    expect(partsNamed(container, 'email')[0]).not.toHaveClass('ps-4');
    expect(partsNamed(container, 'submitLabel')[0]).toHaveClass('w-full', 'bg-accent');
  });

  it('gives text parts their own direction and leaves the form to the page', () => {
    const { container } = renderContact({}, false);
    expect(container.querySelector('h2')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('button')).toHaveAttribute('dir', 'auto');
    expect(container.querySelector('form')).not.toHaveAttribute('dir');
    expect(container.querySelector('label')).not.toHaveAttribute('dir');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderContact({}, true, (props) => {
      const next: Record<string, unknown> = { ...props };
      for (const key of TEXT_PARTS) next[key] = swapped(key);
      return next as ContactProps;
    });
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of TEXT_PARTS) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
