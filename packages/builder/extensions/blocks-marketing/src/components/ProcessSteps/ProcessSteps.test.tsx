import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Node } from '@craftkit/builder-schema';

import { ProcessSteps } from './ProcessSteps';
import { processStepsSchema } from './schema';

const node: Node = { id: 'process', type: 'processSteps', props: {} };

describe('ProcessSteps', () => {
  it('renders a labelled ordered process with visible stage content', () => {
    render(
      <ProcessSteps
        node={node}
        props={processStepsSchema.props.parse({
          heading: 'From brief to launch',
          layout: 'horizontal',
          columns: '3',
          steps: [
            { title: 'Discover', body: 'Understand the problem.', meta: 'Day one' },
            { title: 'Design', body: 'Make the direction tangible.' },
            { title: 'Deliver', body: 'Build and validate the release.' },
          ],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(screen.getByRole('region', { name: 'From brief to launch' })).toHaveClass('@container');
    expect(screen.getByRole('list')).toHaveAttribute('data-process-list', 'horizontal');
    expect(screen.getByRole('list')).toHaveClass('grid', '@sm:grid-cols-3');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.getByText('Discover').closest('[data-process-step]')).toHaveClass(
      'rounded-xl',
      'shadow-soft',
    );
    expect(screen.getByRole('heading', { level: 3, name: 'Discover' })).toBeVisible();
    expect(screen.getByText('Day one')).toBeVisible();
  });

  it('uses decorative markers when numbers are disabled', () => {
    const { container } = render(
      <ProcessSteps
        node={node}
        props={processStepsSchema.props.parse({
          heading: 'Simple steps',
          showNumbers: false,
          steps: [{ title: 'Start', body: 'Begin with one clear decision.' }],
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    expect(container.querySelectorAll('[data-process-number]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-process-marker]')).toHaveLength(1);
  });

  it('applies vertical accented presentation and shared section controls', () => {
    render(
      <ProcessSteps
        node={node}
        props={processStepsSchema.props.parse({
          heading: 'Styled process',
          layout: 'vertical',
          variant: 'accented',
          steps: [{ title: 'Align', body: 'Agree on the outcome.' }],
          textColor: 'textInverse',
          fontFamily: 'serif',
          marginBlockStart: 3,
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );

    const section = screen.getByRole('region', { name: 'Styled process' });
    expect(section.style.color).toBe('var(--t-text-inverse)');
    expect(section.style.marginBlockStart).toBe('calc(var(--t-space-unit, 4px) * 3)');
    expect(section).toHaveClass('mkt-type--family-serif');
    expect(screen.getByRole('list')).toHaveClass('flex', 'max-w-content-standard');
    expect(screen.getByText('Align').closest('[data-process-step]')).toHaveClass('bg-accent');
  });

  it('ships complete defaults and rejects malformed steps', () => {
    const props = processStepsSchema.props.parse({});
    expect(props.steps).toHaveLength(4);
    expect(props).toMatchObject({
      variant: 'cards',
      layout: 'horizontal',
      columns: 'auto',
      showNumbers: true,
      spacing: 'lg',
      width: 'wide',
    });
    expect(
      processStepsSchema.props.safeParse({ steps: [{ title: '', body: 'A useful body.' }] })
        .success,
    ).toBe(false);
    expect(processStepsSchema.props.safeParse({ layout: 'diagonal' }).success).toBe(false);
  });
});

// blocks-polish additions (2026-10-08): the step number shows once.
describe('ProcessSteps step numbers', () => {
  function renderSteps(showNumbers: boolean, metas: readonly (string | undefined)[]) {
    return render(
      <ProcessSteps
        node={node}
        props={processStepsSchema.props.parse({
          heading: 'How we work',
          showNumbers,
          steps: metas.map((meta, index) => ({
            title: `Stage ${['one', 'two', 'three'][index] ?? 'more'}`,
            body: 'A short description of the stage.',
            ...(meta === undefined ? {} : { meta }),
          })),
        })}
        slots={{}}
        data={{}}
        isCanvas={false}
      />,
    );
  }

  it('drops a meta line that only repeats the badge number, in any digits', () => {
    const { container } = renderSteps(true, ['01', 'Step 2', 'الخطوة ٣']);
    const badges = [...container.querySelectorAll('[data-process-number]')].map((badge) => badge.textContent);
    expect(badges).toEqual(['01', '02', '03']);
    expect(screen.queryByText('Step 2')).toBeNull();
    expect(screen.queryByText('الخطوة ٣')).toBeNull();
    /* Each number is on the page exactly once: the badge. */
    expect(screen.getAllByText('01')).toHaveLength(1);
  });

  it('keeps a meta that says something else, and every meta once the badges are off', () => {
    renderSteps(true, ['Week 01', 'Discover', '07']);
    expect(screen.getByText('Week 01')).toBeInTheDocument();
    expect(screen.getByText('Discover')).toBeInTheDocument();
    /* "07" is not the third step's number, so it is information, not a repeat. */
    expect(screen.getByText('07')).toBeInTheDocument();
  });

  it('shows a number-only meta when the badge is switched off', () => {
    const { container } = renderSteps(false, ['01', '02']);
    expect(container.querySelector('[data-process-number]')).toBeNull();
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
  });
});
