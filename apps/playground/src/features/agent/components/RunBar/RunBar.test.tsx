/**
 * RunBar (SPEC §4.17, §4.3): the live run's one visible line, fused to the top of the
 * composer. What is ours to prove: it says what the run is doing in the catalog's words
 * (titles isolated in `<bdi>`), "Stopping…" outranks any stage while it stops, it is NOT a
 * live region (LiveStatus is the panel's only one, SPEC §6.1), the clock is hidden from
 * assistive technology, Stop keeps its place and its word, and a leaving bar is inert.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { t } from '../../copy';
import { liveRun, stoppingRun } from '../../testing/wp-14-composer-fixtures';

import { RunBar } from './RunBar';
import { useExitPresence } from './use-exit-presence';

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe = (): void => undefined;
    unobserve = (): void => undefined;
    disconnect = (): void => undefined;
  };
});

const NOW = Date.now();

describe('RunBar', () => {
  it('says what the run is doing, in the catalog’s words, its figure isolated', () => {
    const { container } = render(<RunBar locale="en" run={liveRun(NOW)} onStop={vi.fn()} />);
    const status = container.querySelector('.ck-agent-runbar__status');
    expect(status).toHaveTextContent('Writing 4 sections');
    expect(status?.querySelector('bdi')).toHaveTextContent('4');
    expect(screen.getByRole('button', { name: 'Stop' })).toHaveTextContent('Stop');
  });

  it('speaks Arabic with Arabic plurals, and keeps Latin digits', () => {
    const { container } = render(
      <RunBar locale="ar" run={liveRun(NOW, 'build.writing', { n: 2 })} onStop={vi.fn()} />,
    );
    expect(container.querySelector('.ck-agent-runbar__status')).toHaveTextContent(
      t('ar', 'build.writing', { n: 2 }),
    );
    expect(container.textContent).not.toMatch(/[٠-٩]/u);
  });

  it('isolates an interpolated title in <bdi>', () => {
    const { container } = render(
      <RunBar locale="en" run={liveRun(NOW, 'build.blocked', { title: 'الواجهة' })} onStop={vi.fn()} />,
    );
    expect(container.querySelector('.ck-agent-runbar__status bdi')).toHaveTextContent('الواجهة');
  });

  it('reads “Stopping…” while it stops, whatever stage the run last reported', () => {
    render(
      <RunBar
        locale="en"
        run={{ ...liveRun(NOW, 'edit.checking', {}), stopping: true }}
        onStop={vi.fn()}
      />,
    );
    expect(screen.getByText(t('en', 'stopping'))).toBeInTheDocument();
    expect(screen.queryByText(t('en', 'edit.checking'))).toBeNull();
    expect(screen.getByRole('button', { name: t('en', 'stopping') })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('is not a live region, and hides its clock from assistive technology', () => {
    const { container } = render(<RunBar locale="en" run={liveRun(NOW)} onStop={vi.fn()} />);
    expect(container.querySelector('[aria-live], [role="status"], [role="log"], [role="alert"]')).toBeNull();
    const clock = container.querySelector('.ck-agent-runbar__clock');
    expect(clock?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('calls onStop from Stop, once', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<RunBar locale="en" run={liveRun(NOW)} onStop={onStop} />);
    await user.click(screen.getByRole('button', { name: 'Stop' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });

  it('does not call onStop while stopping', async () => {
    const user = userEvent.setup();
    const onStop = vi.fn();
    render(<RunBar locale="en" run={stoppingRun(NOW)} onStop={onStop} />);
    await user.click(screen.getByRole('button', { name: t('en', 'stopping') }));
    expect(onStop).not.toHaveBeenCalled();
  });

  it('is inert while it leaves, so nothing in it can be focused or pressed', () => {
    const { container } = render(
      <RunBar locale="en" run={liveRun(NOW)} onStop={vi.fn()} leaving />,
    );
    expect(container.querySelector('.ck-agent-runbar')).toHaveAttribute('inert');
  });
});

describe('useExitPresence', () => {
  it('holds a value, then drops it at once where motion is not allowed (jsdom)', () => {
    const { result, rerender } = renderHook(({ value }) => useExitPresence(value), {
      initialProps: { value: 'run' as string | null },
    });
    expect(result.current).toEqual({ value: 'run', leaving: false });
    rerender({ value: null });
    expect(result.current).toEqual({ value: null, leaving: false });
  });

  it('keeps the last value for its exit when motion is allowed, then lets it go', () => {
    vi.useFakeTimers();
    const matchMedia = vi.fn(() => ({ matches: false }) as MediaQueryList);
    vi.stubGlobal('matchMedia', matchMedia);
    try {
      const { result, rerender } = renderHook(({ value }) => useExitPresence(value, 140), {
        initialProps: { value: 'run' as string | null },
      });
      rerender({ value: null });
      expect(result.current).toEqual({ value: 'run', leaving: true });
      act(() => {
        vi.advanceTimersByTime(140);
      });
      expect(result.current).toEqual({ value: null, leaving: false });
    } finally {
      vi.unstubAllGlobals();
      vi.useRealTimers();
    }
  });
});
