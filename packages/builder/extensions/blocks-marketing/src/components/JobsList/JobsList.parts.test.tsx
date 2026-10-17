import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { JobsList } from './JobsList';
import { jobsListSchema, type JobsListProps } from './schema';

/*
  Block parts (DESIGN §4.3): the introduction, the list, every position and
  its title, team, location and type, the shared apply label, the empty
  message and the action are addressable on the canvas, carry nothing extra
  when published, and render an inline editor at its bind exactly once.
*/
const node: Node = { id: 'jobs-parts', type: 'jobsList', props: {} };
const FULL = {
  eyebrow: 'Careers',
  body: 'Join us.',
  actionLabel: 'Apply openly',
  actionHref: '/apply',
};

type Swap = (props: JobsListProps) => JobsListProps;

function renderBlock(overrides: Record<string, unknown>, isCanvas: boolean, swap?: Swap) {
  const parsed = jobsListSchema.props.parse({ ...FULL, ...overrides });
  const props = swap === undefined ? parsed : swap(parsed);
  return render(<JobsList node={node} props={props} slots={{}} data={{}} isCanvas={isCanvas} />);
}

function partsNamed(container: HTMLElement, name: string): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-ck-part]')].filter(
    (element) => element.dataset['ckPart'] === name,
  );
}

const swapped = (key: string) => (<span data-swap={key} />) as unknown as string;

describe('JobsList parts', () => {
  it('stamps every position and its words, and one apply label per linked row', () => {
    const { container } = renderBlock({}, true);
    expect(partsNamed(container, 'jobs')[0]?.tagName).toBe('UL');
    expect(partsNamed(container, 'job')[1]).toHaveAttribute('data-ck-bind', 'jobs.1');
    expect(partsNamed(container, 'job.title')[2]).toHaveAttribute('data-ck-bind', 'jobs.2.title');
    expect(partsNamed(container, 'job.location').map((place) => place.dataset['ckBind'])).toEqual([
      'jobs.0.location',
      'jobs.1.location',
      'jobs.2.location',
    ]);
    expect(partsNamed(container, 'applyLabel')).toHaveLength(3);
    expect(partsNamed(container, 'action')[0]).toHaveAttribute('data-ck-bind', 'actionLabel');
  });

  it('stamps the empty message when nothing is open', () => {
    const { container } = renderBlock({ jobs: [] }, true);
    expect(partsNamed(container, 'emptyMessage')[0]).toHaveAttribute(
      'data-ck-bind',
      'emptyMessage',
    );
  });

  it('publishes no part markers', () => {
    const { container } = renderBlock({}, false);
    expect(
      container.querySelectorAll('[data-ck-part],[data-ck-part-index],[data-ck-bind]'),
    ).toHaveLength(0);
  });

  it('applies an all-items style and a this-item style, this winning', () => {
    const { container } = renderBlock(
      {
        partStyles: {
          'job.type': { className: 'font-bold' },
          'job.type@1': { className: 'font-regular', dir: 'ltr' },
        },
      },
      true,
    );
    const types = partsNamed(container, 'job.type');
    expect(types[0]).toHaveClass('font-bold');
    expect(types[1]).toHaveClass('font-regular');
    expect(types[1]).toHaveAttribute('dir', 'ltr');
  });

  it('renders an element swapped in at each text bind exactly once, never in an attribute', () => {
    const { container } = renderBlock({}, true, (props) => ({
      ...props,
      heading: swapped('heading'),
      applyLabel: swapped('applyLabel'),
      jobs: props.jobs.map((job, index) => ({
        ...job,
        title: swapped(`jobs.${String(index)}.title`),
        team: swapped(`jobs.${String(index)}.team`),
      })),
      actionLabel: swapped('actionLabel'),
    }));
    expect(container.innerHTML).not.toContain('[object Object]');
    for (const key of ['heading', 'applyLabel', 'jobs.0.title', 'jobs.2.team', 'actionLabel']) {
      const found = [...container.querySelectorAll('[data-swap]')].filter(
        (element) => element.getAttribute('data-swap') === key,
      );
      expect(found, key).toHaveLength(1);
      expect(found[0]?.closest('[data-ck-bind]')).toHaveAttribute('data-ck-bind', key);
    }
  });
});
