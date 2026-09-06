import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initialRunProgress, type RunProgress } from '../AssistantPanel/AssistantPanel.progress';
import { LiveStageClock } from './LiveStageClock';

/*
  Built through the real factory rather than by hand: the stage ids are a
  vocabulary `GenerationProgress` looks icons up by, and an invented one renders
  as `Cannot read properties of undefined`.
*/
function runAt(stageSince: number | null): RunProgress {
  const run = initialRunProgress('never', 0);
  return stageSince === null
    ? {
        ...run,
        stageSince: null,
        stages: run.stages.map((stage) => ({ ...stage, status: 'done' })),
      }
    : { ...run, stageSince };
}

describe('LiveStageClock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('names its region with the heading it was given', () => {
    render(<LiveStageClock heading="Working on Benefits" run={runAt(0)} />);
    expect(screen.getByRole('region', { name: 'Working on Benefits' })).toBeInTheDocument();
  });

  it('schedules NOTHING for a settled run — there is no open row to count', () => {
    /*
      A replayed run and a live one must render identically, so the timer is the
      only difference between them and it must not exist when the run is over.
    */
    render(<LiveStageClock heading="Done" run={runAt(null)} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ticks while a row is open', () => {
    render(<LiveStageClock heading="Working" run={runAt(0)} />);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('clears its interval on unmount, so a closed card stops counting', () => {
    const { unmount } = render(<LiveStageClock heading="Working" run={runAt(0)} />);
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('says a stage is slow — in words, never a warning colour', () => {
    /*
      Slow is not wrong. The line appears only after 90s, and it appears as
      muted prose: a build that takes its time has not failed.
    */
    const start = Date.now();
    vi.setSystemTime(start);
    render(<LiveStageClock heading="Working" run={{ ...runAt(start) }} />);

    expect(screen.queryByText('Taking longer than usual.')).not.toBeInTheDocument();

    act(() => {
      vi.setSystemTime(start + 95_000);
      vi.advanceTimersByTime(2_000);
    });

    expect(screen.getByText('Taking longer than usual.')).toBeVisible();
  });
});
