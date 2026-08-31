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
