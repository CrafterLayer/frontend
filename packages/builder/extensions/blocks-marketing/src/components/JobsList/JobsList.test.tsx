import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { JobsList } from './JobsList';
import { jobsListExamples } from './examples';
import { jobsListSchema } from './schema';

const node: Node = { id: 'jobs', type: 'jobsList', props: {} };

function renderJobs(overrides: Record<string, unknown> = {}, isCanvas = false) {
  return render(
    <JobsList
      node={node}
      props={jobsListSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={isCanvas}
    />,
  );
}

describe('JobsList', () => {
  it('lists every position as a titled list item whose title is the link', () => {
    renderJobs();
    expect(screen.getByRole('region', { name: 'Open positions' })).toHaveClass('@container');
    const list = screen.getAllByRole('list')[0]!;
    /* The positions are the list's own items; each also holds a meta list. */
    const jobs = within(list)
      .getAllByRole('listitem')
      .filter((item) => item.parentElement === list);
    expect(jobs).toHaveLength(3);
    const title = within(jobs[0]!).getByRole('heading', { level: 3 });
    /* The heading takes its direction from the title, so an Arabic title keeps the right edge. */
    expect(title).toHaveAttribute('dir', 'auto');
    expect(within(title).getByRole('link', { name: 'Senior Product Designer' })).toHaveAttribute(
      'href',
      '#',
    );
    expect(jobs[0]).toHaveTextContent('Design');
    expect(jobs[0]).toHaveTextContent('Riyadh');
    expect(jobs[0]).toHaveTextContent('Full-time');
  });

  it('stretches the link over the row when published, and not on the canvas', () => {
    const { unmount } = renderJobs();
    expect(screen.getByRole('link', { name: 'Backend Engineer' })).toHaveClass('after:absolute');
    unmount();
    renderJobs({}, true);
    expect(screen.getByRole('link', { name: 'Backend Engineer' })).not.toHaveClass(
      'after:absolute',
    );
  });

  it('shows the apply affordance beside linked jobs only, hidden from screen readers', () => {
    const { container } = renderJobs({
      jobs: [{ title: 'Designer', href: '/d' }, { title: 'Writer' }],
      applyLabel: 'View role',
    });
    expect(screen.getByText('View role').parentElement).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getAllByText('View role')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Writer' })).toBeNull();
    /* The arrow points to the inline end in either direction. */
    expect(container.querySelector('li svg.rtl\\:-scale-x-100')).not.toBeNull();
  });

  it('says so when nothing is open and still offers the open application', () => {
    renderJobs({
      jobs: [],
      actionLabel: 'Introduce yourself',
      actionHref: 'mailto:jobs@example.com',
    });
    expect(screen.getByText('No open roles right now — check back soon.')).toHaveClass(
      'border-dashed',
    );
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('link', { name: 'Introduce yourself' })).toHaveAttribute(
      'href',
      'mailto:jobs@example.com',
    );
  });

  it('lays the positions out as rows or as cards', () => {
    const { container, unmount } = renderJobs();
    expect(container.querySelector('[data-jobs-list-layout="rows"]')).toHaveClass('divide-y');
    unmount();
    const cards = renderJobs({ layout: 'cards' }).container;
    expect(cards.querySelector('[data-jobs-list-layout="cards"]')).toHaveClass('@2xl:grid-cols-2');
  });

  it('keeps the meta line legible on a dark section', () => {
    renderJobs({ tone: 'dark' });
    expect(screen.getAllByText('Design')[0]?.closest('ul')).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderJobs({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Open positions' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('JobsList schema', () => {
  it('defaults to three linked roles and maps every inspector prop', () => {
    const defaults = jobsListSchema.props.parse({});
    expect(defaults.jobs).toHaveLength(3);
    expect(defaults).toMatchObject({ applyLabel: 'Apply', layout: 'rows', width: 'wide' });
    expect(Object.keys(jobsListSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(jobsListSchema.props.shape).sort(),
    );
  });

  it('bounds the positions and refuses unsafe links', () => {
    const parse = (value: unknown) => jobsListSchema.props.safeParse(value).success;
    expect(parse({ jobs: Array.from({ length: 31 }, () => ({ title: 'x' })) })).toBe(false);
    expect(parse({ jobs: [{ title: '' }] })).toBe(false);
    expect(parse({ jobs: [{ title: 'x', href: 'javascript:alert(1)' }] })).toBe(false);
    expect(parse({ jobs: [{ title: 'x', href: 'https://jobs.example.com/1' }] })).toBe(true);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of jobsListExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('jobsList');
      expect(jobsListSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(jobsListExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
