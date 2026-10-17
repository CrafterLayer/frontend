import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GenerationProgress, type GenerationStage } from './GenerationProgress';
import { GENERATION_STAGE_LABELS } from './constants';

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'GenerationProgress', 'GenerationProgress.css'),
  'utf8',
);

/* The pipeline mid-flight: four stages settled, the fifth working. */
const RUNNING = [
  { id: 'sitemap', status: 'done', detail: '00:01.123' },
  { id: 'structure', status: 'done', detail: '00:02.347' },
  { id: 'content', status: 'done', detail: '00:03.891' },
  { id: 'design', status: 'done', detail: '00:04.512' },
  { id: 'assembly', status: 'active' },
] as const satisfies readonly GenerationStage[];

const IDLE = [
  { id: 'sitemap', status: 'pending' },
  { id: 'structure', status: 'pending' },
  { id: 'content', status: 'pending' },
  { id: 'design', status: 'pending' },
  { id: 'assembly', status: 'pending' },
] as const satisfies readonly GenerationStage[];

const COMPLETE = [
  { id: 'sitemap', status: 'done' },
  { id: 'structure', status: 'done' },
  { id: 'content', status: 'done' },
  { id: 'design', status: 'done' },
  { id: 'assembly', status: 'done' },
] as const satisfies readonly GenerationStage[];

afterEach(cleanup);

describe('GenerationProgress', () => {
  it('names the region and lists all five stages in pipeline order', () => {
    render(<GenerationProgress stages={RUNNING} />);

    const region = screen.getByRole('region', { name: 'Building your page' });
    const names = within(region)
      .getAllByRole('listitem')
      .map((item) => within(item).getByTestId('stage-name').textContent);

    expect(names).toEqual(['Plan', 'Structure', 'Content', 'Design', 'Apply']);
  });

  it('gives every stage a status a screen reader can read, not colour alone', () => {
    render(<GenerationProgress stages={RUNNING} />);

    const items = screen.getAllByRole('listitem');
    expect(within(items[0]!).getByText('Done')).toBeInTheDocument();
    expect(within(items[4]!).getByText('Active')).toBeInTheDocument();
    expect(within(items[0]!).getByText('00:01.123')).toBeInTheDocument();
  });

  it('announces the running stage in a polite live region', () => {
    const { rerender } = render(<GenerationProgress stages={IDLE} />);

    const live = screen.getByRole('status');
    expect(live).toHaveAttribute('aria-live', 'polite');

    rerender(<GenerationProgress stages={RUNNING} />);
    expect(live).toHaveTextContent('Stage 5 of 5: Apply');
  });

  it('announces completion once every stage has settled', () => {
    render(<GenerationProgress stages={COMPLETE} />);

    expect(screen.getByRole('status')).toHaveTextContent('All 5 stages complete.');
  });

  it('announces by default', () => {
    render(<GenerationProgress stages={RUNNING} />);

    expect(screen.getByRole('status')).toHaveTextContent('Stage 5 of 5: Apply.');
  });

  /* A host that already narrates the run (the assistant panel's one
     `role="status"`) opts out here; the rows and their words stay. */
  it('stays silent when the host narrates', () => {
    render(<GenerationProgress stages={RUNNING} announce={false} />);

    expect(screen.queryByRole('status')).toBeNull();

    const region = screen.getByRole('region', { name: 'Building your page' });
    const items = within(region).getAllByRole('listitem');
    expect(items).toHaveLength(5);
    expect(within(items[0]!).getByText('Done')).toBeInTheDocument();
    expect(within(items[4]!).getByText('Active')).toBeInTheDocument();
  });

  /* The exported labels ARE the row labels — one source, so a host naming a
     stage in its own copy ("failed at Structure") can never drift from the card. */
  it('exports the labels the rows use', () => {
    expect(GENERATION_STAGE_LABELS.sitemap).toBe('Plan');

    render(<GenerationProgress stages={RUNNING} />);

    const names = screen.getAllByTestId('stage-name').map((name) => name.textContent);
    expect(names).toEqual(RUNNING.map((stage) => GENERATION_STAGE_LABELS[stage.id]));
  });

  it('offers a keyboard-reachable cancel while a stage is running', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    render(<GenerationProgress stages={RUNNING} onCancel={onCancel} />);

    const cancel = screen.getByRole('button', { name: 'Cancel generation' });
    await user.tab();
    expect(cancel).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('withdraws cancel once nothing is running', () => {
    render(<GenerationProgress stages={COMPLETE} onCancel={() => undefined} />);

    expect(screen.queryByRole('button', { name: 'Cancel generation' })).not.toBeInTheDocument();
  });

  it('shows the failure reason on the stage that failed', () => {
    render(
      <GenerationProgress
        stages={[
          { id: 'sitemap', status: 'done' },
          { id: 'structure', status: 'failed', detail: 'No block type named "carousel".' },
          { id: 'content', status: 'pending' },
          { id: 'design', status: 'pending' },
          { id: 'assembly', status: 'pending' },
        ]}
      />,
    );

    const failed = screen.getAllByRole('listitem')[1]!;
    expect(within(failed).getByText('Failed')).toBeInTheDocument();
    expect(within(failed).getByText('No block type named "carousel".')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Structure failed');
  });

  it('reports a cancelled run without calling it a failure', () => {
    render(
      <GenerationProgress
        stages={[
          { id: 'sitemap', status: 'done' },
          { id: 'structure', status: 'cancelled' },
          { id: 'content', status: 'pending' },
          { id: 'design', status: 'pending' },
          { id: 'assembly', status: 'pending' },
        ]}
      />,
    );

    expect(within(screen.getAllByRole('listitem')[1]!).getByText('Cancelled')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Generation cancelled');
    expect(screen.queryByText('Failed')).not.toBeInTheDocument();
  });

  /* A progress card that grabs focus interrupts whatever the person was typing
     in the composer. The announcement is the live region's job, never focus's. */
  it('never steals focus, on mount or when a stage advances', () => {
    const { rerender } = render(<GenerationProgress stages={IDLE} onCancel={() => undefined} />);
    expect(document.body).toHaveFocus();

    rerender(<GenerationProgress stages={RUNNING} onCancel={() => undefined} />);
    expect(document.body).toHaveFocus();
  });

  it('styles itself from chrome tokens only, never a literal colour', () => {
    const declarations = CSS_SOURCE.replace(/\/\*[\s\S]*?\*\//g, '');

    expect(declarations).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(declarations).not.toMatch(/\b(rgba?|hsla?)\(/);
    expect(declarations).toMatch(/var\(--bldr-/);
    /* The canvas theme belongs to the page being edited; chrome must not read
       it, or re-theming the user's site would restyle the builder. */
    expect(declarations).not.toMatch(/var\(--t-/);
  });
});
