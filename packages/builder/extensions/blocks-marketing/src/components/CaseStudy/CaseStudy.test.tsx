import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { CaseStudy } from './CaseStudy';
import { caseStudyExamples } from './examples';
import { caseStudySchema } from './schema';

const node: Node = { id: 'story', type: 'caseStudy', props: {} };
const STORY = {
  client: 'Northwind',
  quote: 'Everyone looks at the same parcel.',
  quoteAuthor: 'Omar Farouk',
  quoteRole: 'Head of Operations',
  imageSrc: '/assets/team.jpg',
  imageAlt: 'The operations team',
  actionLabel: 'Read the full story',
  actionHref: '/stories/northwind',
};

function renderStory(overrides: Record<string, unknown> = {}) {
  return render(
    <CaseStudy
      node={node}
      props={caseStudySchema.props.parse({ ...STORY, ...overrides })}
      slots={{}}
      data={{}}
      isCanvas={false}
    />,
  );
}

describe('CaseStudy', () => {
  it('names the section by its heading and shows the client beside the eyebrow', () => {
    renderStory({ eyebrow: 'Case study' });
    expect(
      screen.getByRole('region', { name: 'How one team cut delivery times by a third' }),
    ).toHaveClass('@container');
    expect(screen.getByText('Northwind')).toHaveClass('rounded-full');
    expect(screen.getByText('Case study')).toHaveClass('text-accent');
  });

  it('gives each result as a term and its value, the value drawn first', () => {
    const { container } = renderStory();
    const results = container.querySelectorAll('dl')[0]!;
    const terms = within(results as HTMLElement).getAllByRole('term');
    const values = within(results as HTMLElement).getAllByRole('definition');
    expect(terms.map((term) => term.textContent)).toEqual([
      'faster deliveries',
      'repeat orders',
      'from kickoff to launch',
    ]);
    expect(values[0]).toHaveTextContent('32%');
    expect(terms[0]?.parentElement).toHaveClass('flex-col-reverse', 'border-s-2');
  });

  it('tells the story as labelled points beside the image and the client quote', () => {
    const { container } = renderStory();
    const story = container.querySelectorAll('dl')[1] as HTMLElement;
    expect(
      within(story)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(['Challenge', 'Approach', 'Result']);
    expect(screen.getByRole('img', { name: 'The operations team' })).toHaveClass('aspect-4/3');
    const figure = screen.getByRole('figure');
    expect(figure.querySelector('blockquote')).toHaveTextContent(
      'Everyone looks at the same parcel.',
    );
    expect(within(figure).getByText('Omar Farouk')).toBeInTheDocument();
  });

  it('links to the full story with an arrow that mirrors in RTL', () => {
    renderStory();
    const link = screen.getByRole('link', { name: 'Read the full story' });
    expect(link).toHaveAttribute('href', '/stories/northwind');
    expect(link.querySelector('svg')).toHaveClass('rtl:-scale-x-100');
  });

  it('moves the image and quote to the inline start, and drops the column without them', () => {
    const { container, unmount } = renderStory({ mediaPosition: 'start' });
    expect(container.querySelector('[data-case-study-aside]')).toHaveClass('@4xl:order-first');
    unmount();
    const bare = renderStory({ imageSrc: undefined, quote: undefined }).container;
    expect(bare.querySelector('[data-case-study-aside]')).toBeNull();
    expect(bare.querySelector('.\\@4xl\\:grid-cols-2')).toBeNull();
  });

  it('keeps secondary text legible on a dark section', () => {
    renderStory({ tone: 'dark' });
    expect(screen.getByText('faster deliveries')).toHaveClass('opacity-80');
    expect(screen.getByText('Head of Operations')).toHaveClass('opacity-80');
  });

  it('combines token-based colour, typography, and logical spacing controls', () => {
    renderStory({ background: 'accent', fontFamily: 'serif', marginInlineEnd: 4 });
    const section = screen.getByRole('region', {
      name: 'How one team cut delivery times by a third',
    });
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(section.style.background).toBe('var(--t-accent)');
    expect(section.style.marginInlineEnd).toBe('calc(var(--t-space-unit, 4px) * 4)');
  });
});

describe('CaseStudy schema', () => {
  it('defaults to three results and three story points and maps every inspector prop', () => {
    const defaults = caseStudySchema.props.parse({});
    expect(defaults.metrics).toHaveLength(3);
    expect(defaults.points.map((point) => point.label)).toEqual([
      'Challenge',
      'Approach',
      'Result',
    ]);
    expect(defaults.width).toBe('wide');
    expect(Object.keys(caseStudySchema.propertyGroups ?? {}).sort()).toEqual(
      Object.keys(caseStudySchema.props.shape).sort(),
    );
  });

  it('bounds the results and points and refuses unsafe links', () => {
    const parse = (value: unknown) => caseStudySchema.props.safeParse(value).success;
    const metric = { value: '1', label: 'x' };
    expect(parse({ metrics: [metric, metric, metric, metric, metric] })).toBe(false);
    expect(parse({ metrics: [{ value: 'x'.repeat(17), label: 'x' }] })).toBe(false);
    expect(parse({ points: [{ label: '', text: 'x' }] })).toBe(false);
    expect(parse({ actionHref: 'javascript:alert(1)' })).toBe(false);
  });

  it('ships model-facing examples that parse, one of them in Arabic', () => {
    for (const example of caseStudyExamples) {
      const exampleNode = example.node as { type: string; props: unknown };
      expect(exampleNode.type).toBe('caseStudy');
      expect(caseStudySchema.props.safeParse(exampleNode.props).success, example.prompt).toBe(true);
    }
    expect(caseStudyExamples.some((example) => /[؀-ۿ]/u.test(example.prompt))).toBe(true);
  });
});
