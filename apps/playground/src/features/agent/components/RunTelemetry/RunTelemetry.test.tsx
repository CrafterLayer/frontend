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
    // No count can be totalled, so no usage is drawn at all (2026-10-12): never a partial total.
    expect(screen.queryByText('Not reported')).not.toBeInTheDocument();
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
    // Nothing reported yet: no four "Not reported" cells in a narrow thread (2026-10-12).
    expect(screen.queryByText('Not reported')).not.toBeInTheDocument();
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
    expect(screen.queryByText('Reported cost in US dollars')).not.toBeInTheDocument();
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

  it('says why the cache was written instead of read, the latest cause, in either language', () => {
    const miss = (reason: 'first' | 'skills', missedTokens: number | null) => ({
      inputTokens: 300,
      outputTokens: 80,
      cacheReadTokens: 2_200,
      cacheWriteTokens: 1_300,
      cacheMiss: { reason, missedTokens, source: 'api' as const },
    });
    const state = {
      activity: [],
      attempts: { 'run/attempt-1': miss('first', null), 'run/attempt-2': miss('skills', 1_300) },
    };
    const { rerender } = render(<RunTelemetry locale="en" state={state} />);
    expect(
      screen.getByText('Cache not read: different skills woke for these words (~1,300 tokens).'),
    ).toBeInTheDocument();
    rerender(<RunTelemetry locale="ar" state={state} />);
    expect(screen.getByText(/^لم يُقرأ الكاش: نشطت مهارات مختلفة/u)).toBeInTheDocument();
  });
});
