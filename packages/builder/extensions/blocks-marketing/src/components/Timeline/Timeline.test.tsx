import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { Timeline } from './Timeline';
import { timelineExamples } from './examples';
import { timelineSchema } from './schema';

const node: Node = { id: 'timeline', type: 'timeline', props: {} };

function renderTimeline(overrides: Record<string, unknown> = {}) {
  return render(
    <Timeline
      node={node}
      props={timelineSchema.props.parse(overrides)}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('Timeline', () => {
  it('renders the milestones as an ordered list named by the heading', () => {
    renderTimeline({ eyebrow: 'Since 2019', body: 'How we got here.' });
    expect(screen.getByRole('region', { name: 'Our story' })).toHaveClass('@container');
    const list = screen.getByRole('list');
    expect(list.tagName).toBe('OL');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(
      within(items[0]!).getByRole('heading', { level: 3, name: 'Founded' }),
    ).toBeInTheDocument();
    expect(items[0]).toHaveTextContent('2019');
    expect(screen.getByText('Since 2019')).toBeInTheDocument();
    expect(screen.getByText('How we got here.')).toBeInTheDocument();
    expect(screen.getByText('Milestone')).toHaveClass('bg-accent', 'text-accent-text');
  });

  it('says each status in words and draws done filled, upcoming hollow', () => {
    const { container } = renderTimeline();
    const items = container.querySelectorAll('li');
    expect(items[0]).toHaveAttribute('data-timeline-status', 'done');
    expect(items[3]).toHaveAttribute('data-timeline-status', 'upcoming');
    /* The status is the dot's accessible name: never colour alone, never a second text node. */
    expect(within(items[0] as HTMLElement).getByRole('img', { name: 'Completed' })).toHaveClass(
      'bg-accent',
    );
    expect(within(items[3] as HTMLElement).getByRole('img', { name: 'Upcoming' })).toHaveClass(
      'bg-transparent',
    );
    expect(within(items[0] as HTMLElement).queryByText('Completed')).toBeNull();
    expect(container.querySelector('[data-timeline-connector]')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('dashes the connector into an upcoming milestone and draws none after the last', () => {
    const { container } = renderTimeline();
    const connectors = container.querySelectorAll('[data-timeline-connector]');
    expect(connectors[0]).toHaveClass('bg-current/20');
    expect(connectors[2]).toHaveClass('border-dashed');
    expect(connectors[3]).toHaveClass('hidden');
  });

  it('alternates sides on a wide container, nudging both halves onto one centre rail', () => {
    const { container } = renderTimeline({ layout: 'alternating' });
    expect(container.querySelector('ol')).toHaveAttribute('data-timeline-layout', 'alternating');
    const items = container.querySelectorAll('li');
    expect(items[0]).toHaveClass(
      '@3xl:w-1/2',
      '@3xl:flex-row-reverse',
      '@3xl:start-3',
      '@3xl:text-end',
    );
    expect(items[1]).toHaveClass('@3xl:ms-auto', '@3xl:-start-3');
    const vertical = renderTimeline().container.querySelector('li');
    expect(vertical).not.toHaveClass('@3xl:w-1/2');
  });

  it('keeps secondary text legible on a dark section', () => {
    renderTimeline({ tone: 'dark', body: 'Intro.' });
    expect(screen.getByText('Intro.')).toHaveClass('opacity-80');
    expect(screen.getAllByText('2019')[0]).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderTimeline({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', { name: 'Our story' });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('Timeline schema', () => {
  it('defaults to a four-milestone story and maps every inspector prop', () => {
    const defaults = timelineSchema.props.parse({});
    expect(defaults.items).toHaveLength(4);
    expect(defaults).toMatchObject({ heading: 'Our story', layout: 'vertical', width: 'wide' });
    expect(Object.keys(timelineSchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(timelineSchema.props.shape).sort(),
    );
  });

  it('bounds the milestones and their status', () => {
    const parse = (props: unknown) => timelineSchema.props.safeParse(props).success;
    expect(parse({ items: Array.from({ length: 21 }, () => ({ date: '1', title: 't' })) })).toBe(
      false,
    );
    expect(parse({ items: [{ date: '', title: 't' }] })).toBe(false);
    expect(parse({ items: [{ date: '1', title: 't', status: 'late' }] })).toBe(false);
    expect(
      timelineSchema.props.parse({ items: [{ date: '1', title: 't' }] }).items[0]?.status,
    ).toBe('done');
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of timelineExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('timeline');
      expect(timelineSchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(timelineExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
