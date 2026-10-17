import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Countdown } from './Countdown';
import { countdownSchema, type CountdownProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the "Starts" lead-in and the
  time zone beside the date, each unit's label, the ended message and the
  action are addressable on the canvas, carry nothing extra when published,
  take classes from `partStyles`, and render an inline editor swapped in
  exactly once. The canvas leaves the polite summary empty: it would repeat
  the unit labels being edited.
*/
const node: Node = { id: 'countdown-parts', type: 'countdown', props: {} };
const FULL = {
  eyebrow: 'Launch',
  body: 'Be first in line.',
  target: '2027-03-01T10:00:00+03:00',
  timezoneLabel: 'Riyadh time',
  actionLabel: 'Register',
  actionHref: '/register',
};

type Swap = (props: CountdownProps) => CountdownProps;

function renderCountdown(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = countdownSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<Countdown node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] });
  vi.setSystemTime(Date.UTC(2027, 1, 1));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Countdown parts', () => {
  it('stamps the lead-in, time zone, unit labels and action on the canvas', () => {
    const { container } = renderCountdown({}, true);
    for (const name of [
      'startsLabel',
      'timezoneLabel',
      'daysLabel',
      'hoursLabel',
      'minutesLabel',
      'secondsLabel',
    ]) {
      expect(partsNamed(container, name), name).toHaveLength(1);
    }
    expect(partsNamed(container, 'action')[0]).toHaveAttribute('data-ck-bind', 'actionLabel');
    const ended = partsNamed(container, 'endedMessage')[0];
    expect(ended).toHaveAttribute('data-ck-bind', 'endedMessage');
    expect(ended).toHaveAttribute('hidden');
    expect(container.querySelector('[data-ck-countdown-summary]')?.textContent).toBe('');
    expect(partsNamed(container, 'secondsLabel')[0]).toHaveAttribute(
      'data-ck-countdown-label',
      'seconds',
    );
  });

  it('publishes no part markers', () => {
    const { container } = renderCountdown({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies a part style', () => {
    const { container } = renderCountdown(
      { partStyles: { daysLabel: { className: 'text-accent' } } },
      true,
    );
    expect(partsNamed(container, 'daysLabel')[0]).toHaveClass('text-accent');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderCountdown({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      startsLabel: swapped('startsLabel'),
      timezoneLabel: swapped('timezoneLabel'),
      daysLabel: swapped('daysLabel'),
      actionLabel: swapped('actionLabel'),
      endedMessage: swapped('endedMessage'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of [
      'heading',
      'startsLabel',
      'timezoneLabel',
      'daysLabel',
      'actionLabel',
      'endedMessage',
    ]) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
