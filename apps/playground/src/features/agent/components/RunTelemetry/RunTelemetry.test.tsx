import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RunTelemetry } from './RunTelemetry';

describe('RunTelemetry', () => {
  it('never presents the retained subset as a complete total after ledger overflow', () => {
    render(
      <RunTelemetry
        locale="en"
        state={{
          activity: [],
          overflowed: true,
          attempts: {
            'run/attempt-1': {
              inputTokens: 64,
              outputTokens: 64,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              costUsd: 0.64,
            },
          },
        }}
      />,
    );
    expect(screen.getAllByText('Not reported')).toHaveLength(4);
    expect(screen.queryByText('64')).not.toBeInTheDocument();
    expect(screen.queryByText(/0\.6400/u)).not.toBeInTheDocument();
  });
  it('shows public operational work before measured usage arrives, never estimates', () => {
    render(
      <RunTelemetry
        locale="en"
        live
        state={{
          activity: [{ stage: 'reading' }, { stage: 'writing', scope: 'Hero' }],
          attempts: { 'run/attempt-1': null },
        }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('Hero');
    expect(screen.getAllByText('Not reported')).toHaveLength(4);
    fireEvent.click(screen.getByText('Live activity'));
    expect(screen.getByText('Live activity').closest('details')).toHaveAttribute('open');
  });
  it('reports known counts with zero-charge cache hits and keeps missing fields unknown', () => {
    render(
      <RunTelemetry
        locale="en"
        state={{
          activity: [],
          attempts: {
            one: {
              inputTokens: 20,
              outputTokens: 8,
              cacheReadTokens: 0,
              cacheWriteTokens: null,
            },
            cached: {
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheWriteTokens: 0,
              cached: true,
            },
          },
        }}
      />,
    );
    expect(screen.getByText('20')).toBeVisible();
    expect(screen.getByText('8')).toBeVisible();
    expect(screen.getByText(/no new model charge/u)).toBeVisible();
    expect(screen.queryByText('Reported cost (USD)')).not.toBeInTheDocument();
  });
  it('supports Arabic attribution and an empty historical record', () => {
    const { rerender, container } = render(
      <RunTelemetry
        locale="ar"
        live
        state={{ activity: [{ stage: 'checking', scope: 'المشهد' }], attempts: {} }}
      />,
    );
    expect(screen.getByRole('status').textContent).toContain('المشهد');
    rerender(<RunTelemetry locale="en" state={{ activity: [], attempts: {} }} />);
    expect(container).toBeEmptyDOMElement();
  });
  it('does not present settled or restored work as still running', () => {
    render(
      <RunTelemetry locale="en" state={{ activity: [{ stage: 'checking' }], attempts: {} }} />,
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByText('Live activity').closest('details')).toBeInTheDocument();
  });
});
