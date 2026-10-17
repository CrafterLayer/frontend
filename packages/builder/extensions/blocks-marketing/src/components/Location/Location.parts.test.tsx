import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Location } from './Location';
import { locationSchema, type LocationProps } from './schema';

/*
  Block parts (DESIGN §4.3): the address and its label, the maps button, every
  hours row with its days and time, the note, and each contact link's label and
  value are addressable on the canvas, carry nothing extra when published, and
  render an inline editor swapped in exactly once — never inside an href.
*/
const node: Node = { id: 'location-parts', type: 'location', props: {} };
const FULL = {
  hoursNote: 'Closed on public holidays.',
  phone: '+1 555 0100',
  email: 'hello@example.com',
  whatsapp: '+971 50 123 4567',
};

type Swap = (props: LocationProps) => LocationProps;

function renderLocation(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = locationSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Location node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('Location parts', () => {
  it('stamps the address, hours rows and contact links on the canvas', () => {
    const { container } = renderLocation({}, true);
    expect(partsNamed(container, 'address')[0]?.tagName).toBe('ADDRESS');
    expect(partsNamed(container, 'mapsLabel')[0]?.closest('a')).toHaveAttribute(
      'data-location-maps',
    );
    expect(partsNamed(container, 'hours')[0]?.tagName).toBe('DL');
    expect(partsNamed(container, 'hour')[2]).toHaveAttribute('data-ck-bind', 'hours.2');
    expect(partsNamed(container, 'hour.days')[0]).toHaveAttribute('data-ck-bind', 'hours.0.days');
    expect(partsNamed(container, 'hour.time')[1]).toHaveAttribute('data-ck-bind', 'hours.1.time');
    for (const name of [
      'phone',
      'email',
      'whatsapp',
      'phoneLabel',
      'emailLabel',
      'whatsappLabel',
      'contactLabel',
      'hoursNote',
    ]) {
      expect(partsNamed(container, name), name).toHaveLength(1);
    }
    /* A number keeps reading left to right even as an editable part. */
    expect(partsNamed(container, 'phone')[0]).toHaveAttribute('dir', 'ltr');
  });

  it('publishes no part markers', () => {
    const { container } = renderLocation({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('renders an element swapped in at each text bind exactly once, never in an href', () => {
    const { container } = renderLocation({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      address: swapped('address'),
      phone: swapped('phone'),
      hours: props.hours.map((row, index) => ({
        ...row,
        days: swapped(`hours.${String(index)}.days`),
      })),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'address', 'hours.1.days']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
    /* Mid-edit, the call link waits for a committed number; the maps link searches what is committed. */
    expect(container.querySelector('[data-location-link="phone"]')).toBeNull();
    expect(container.querySelector('[data-location-maps]')).toHaveAttribute(
      'href',
      'https://www.openstreetmap.org/search?query=',
    );
  });
});
