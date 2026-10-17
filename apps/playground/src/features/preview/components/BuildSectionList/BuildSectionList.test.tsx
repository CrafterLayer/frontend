import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { initialRunProgress } from '../AssistantPanel/AssistantPanel.progress';
import type { BuildProgress, BuildTask } from '../AssistantPanel/AssistantPanel.build';
import { BuildSectionList } from './BuildSectionList';

const task = (position: number, title: string, status: BuildTask['status']): BuildTask => ({
  id: `t${String(position)}`,
  position,
  title,
  status,
  attempts: 0,
});

function progress(tasks: readonly BuildTask[], running = true): BuildProgress {
  return {
    runId: 'run-1',
    phase: 'building',
    direction: 'A calm clinic page.',
    tasks,
    startedAt: 0,
    applied: tasks.filter((entry) => entry.status === 'applied').length,
    skipped: 0,
    run: running ? initialRunProgress('auto', 0) : null,
  };
}

describe('BuildSectionList', () => {
  it('is a named list, so the sections are findable rather than loose text', () => {
    render(
      <BuildSectionList
        progress={progress([task(1, 'Hero', 'applied'), task(2, 'Pricing', 'running')])}
        turnId="turn"
      />,
    );
    expect(screen.getByRole('list', { name: 'Sections' })).toBeInTheDocument();
  });

  it('publishes each section’s state, which is what the stories and the app read', () => {
    render(
      <BuildSectionList
        progress={progress([
          task(1, 'Hero', 'applied'),
          task(2, 'Pricing', 'running'),
          task(3, 'Contact', 'waiting'),
        ])}
        turnId="turn"
      />,
    );

    /*
      DIRECT children only. A running row nests a `GenerationProgress` whose
      stages are list items too, so an unscoped `getAllByRole('listitem')`
      counts the clock's rows as sections.
    */
    const rows = [
      ...screen
        .getByRole('list', { name: 'Sections' })
        .querySelectorAll<HTMLElement>(':scope > li'),
    ];
    expect(rows.map((row) => row.getAttribute('data-status'))).toEqual([
      'applied',
      'running',
      'waiting',
    ]);
    expect(rows[0]?.textContent).toContain('Done');
    expect(rows[2]?.textContent).toContain('Waiting');
  });

  it('gives EVERY running section its own named clock', () => {
    /*
      The fill loop writes with a pool, so more than one section is in flight —
      and a person watching needs to know which ones. One clock with no name
      would say the build is working without saying at what.
    */
    render(
      <BuildSectionList
        progress={progress([
          task(1, 'Hero', 'running'),
          task(2, 'Pricing', 'running'),
          task(3, 'Contact', 'waiting'),
        ])}
        turnId="turn"
      />,
    );

    expect(screen.getByRole('region', { name: 'Working on Hero' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Working on Pricing' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Working on Contact' })).not.toBeInTheDocument();
  });

  it('shows no clock at all once the wave has settled', () => {
    render(
      <BuildSectionList progress={progress([task(1, 'Hero', 'applied')], false)} turnId="turn" />,
    );
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('lets a section title keep the language it was written in', () => {
    render(
      <BuildSectionList progress={progress([task(1, 'الافتتاحية', 'waiting')])} turnId="turn" />,
    );
    expect(screen.getByText('الافتتاحية')).toHaveAttribute('dir', 'auto');
  });

  describe('jump to section', () => {
    it('makes a written section reachable on the canvas', async () => {
      const onJump = vi.fn();
      render(
        <BuildSectionList
          progress={progress([
            { ...task(1, 'Hero', 'applied'), id: 'n1' },
            { ...task(2, 'Pricing', 'waiting'), id: 'n2' },
          ])}
          turnId="t"
          onJump={onJump}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Hero' }));
      expect(onJump).toHaveBeenCalledExactlyOnceWith('n1');
    });

    it('leaves a section still WAITING as plain text — it has no node yet', () => {
      render(
        <BuildSectionList
          progress={progress([{ ...task(1, 'Hero', 'waiting'), id: 'n1' }])}
          turnId="t"
          onJump={() => undefined}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Hero' })).toBeNull();
      expect(screen.getByText('Hero')).toBeInTheDocument();
    });

    it('leaves a section with no node id as plain text', () => {
      render(
        <BuildSectionList
          progress={progress([{ ...task(1, 'Hero', 'applied'), id: '' }])}
          turnId="t"
          onJump={() => undefined}
        />,
      );
      expect(screen.queryByRole('button', { name: 'Hero' })).toBeNull();
    });

    it('offers no jump at all when the host has nowhere to go', () => {
      render(
        <BuildSectionList
          progress={progress([{ ...task(1, 'Hero', 'applied'), id: 'n1' }])}
          turnId="t"
        />,
      );
      expect(screen.queryByRole('button', { name: 'Hero' })).toBeNull();
    });
  });
});
