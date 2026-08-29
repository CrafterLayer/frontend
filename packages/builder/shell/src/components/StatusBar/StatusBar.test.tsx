import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusBar, type RecentChange, type StatusBarTool } from './StatusBar';

const CSS_SOURCE = readFileSync(
  join(process.cwd(), 'src', 'components', 'StatusBar', 'StatusBar.css'),
  'utf8',
);

const CHANGES = [
  { id: 'assistant-change', door: 'assistant', label: 'heading + cta' },
  { id: 'code-change', door: 'code', label: 'pricing tokens' },
  { id: 'canvas-change', door: 'canvas', label: 'hero spacing' },
] as const satisfies readonly RecentChange[];

const TOOLS = [
  {
    id: 'history',
    label: 'Open history',
    icon: (
      <svg viewBox="0 0 16 16">
        <path d="M2 8h12" />
      </svg>
    ),
  },
] as const satisfies readonly StatusBarTool[];

afterEach(cleanup);

describe('StatusBar', () => {
  it('names the region and every change with both its door and label', () => {
    render(<StatusBar changes={CHANGES} onChangeSelect={() => undefined} />);

    expect(screen.getByRole('region', { name: 'Editor status' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Assistant: heading + cta' })).toHaveAccessibleName(
      'Assistant: heading + cta',
    );
    expect(screen.getByRole('button', { name: 'Code: pricing tokens' })).toHaveAccessibleName(
      'Code: pricing tokens',
    );
    expect(screen.getByRole('button', { name: 'Canvas: hero spacing' })).toHaveAccessibleName(
      'Canvas: hero spacing',
    );
  });

  it('marks only the newest change as current for assistive technology', () => {
    render(<StatusBar changes={CHANGES} onChangeSelect={() => undefined} />);

    expect(screen.getByRole('button', { name: 'Assistant: heading + cta' })).toHaveAttribute(
      'aria-current',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Code: pricing tokens' })).not.toHaveAttribute(
      'aria-current',
    );
    expect(screen.getByRole('button', { name: 'Canvas: hero spacing' })).not.toHaveAttribute(
      'aria-current',
    );
  });

  it('renders recent changes as static provenance when no selection action exists', () => {
    render(<StatusBar changes={CHANGES} />);
    const changes = screen.getByRole('list', { name: 'Recent changes' });

    expect(within(changes).getByText('Assistant: heading + cta')).toBeInTheDocument();
    expect(within(changes).getByText('Code: pricing tokens')).toBeInTheDocument();
    // Mutation that kills this gate: always render the no-handler branch as a
    // button. This exact zero-button assertion must then fail.
    expect(within(changes).queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks the newest static provenance item as current', () => {
    render(<StatusBar changes={CHANGES} />);
    const changes = screen.getByRole('list', { name: 'Recent changes' });

    // Mutation that kills this gate: delete aria-current from the static span.
    // This exact assertion must then fail while the interactive branch remains green.
    expect(
      within(changes).getByText('Assistant: heading + cta').closest('.bldr-statusbar__change'),
    ).toHaveAttribute('aria-current', 'true');
    expect(
      within(changes).getByText('Code: pricing tokens').closest('.bldr-statusbar__change'),
    ).not.toHaveAttribute('aria-current');
  });

  it('calls onChangeSelect with the activated change id', async () => {
    const user = userEvent.setup();
    const onChangeSelect = vi.fn();
    render(<StatusBar changes={CHANGES} onChangeSelect={onChangeSelect} />);

    await user.click(screen.getByRole('button', { name: 'Code: pricing tokens' }));

    expect(onChangeSelect).toHaveBeenCalledTimes(1);
    expect(onChangeSelect).toHaveBeenCalledWith('code-change');
  });

  it('gives icon-only tools accessible names and emits their ids', async () => {
    const user = userEvent.setup();
    const onToolSelect = vi.fn();
    render(<StatusBar tools={TOOLS} onToolSelect={onToolSelect} />);
    const tool = screen.getByRole('button', { name: 'Open history' });

    expect(tool).toHaveAccessibleName('Open history');
    await user.click(tool);

    expect(onToolSelect).toHaveBeenCalledTimes(1);
    expect(onToolSelect).toHaveBeenCalledWith('history');
  });

  it('does not announce or render tools without a real action', () => {
    const { rerender } = render(<StatusBar />);

    // Mutation that kills this gate: restore the unconditional group role and
    // name. The first absence assertion must fail on the empty default.
    expect(screen.queryByRole('group', { name: 'Status bar tools' })).not.toBeInTheDocument();

    rerender(<StatusBar tools={TOOLS} />);
    // A supplied icon without its action is not a disabled feature; it is no
    // feature. Mutating the render guard to check only `tools.length` makes
    // both assertions below fail.
    expect(screen.queryByRole('group', { name: 'Status bar tools' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open history' })).not.toBeInTheDocument();
  });

  it('does not announce an empty editor details group', () => {
    const { rerender } = render(<StatusBar />);

    // Mutation that kills this gate: restore the unconditional details group
    // role and name. This absence assertion must then fail on the empty default.
    expect(screen.queryByRole('group', { name: 'Editor details' })).not.toBeInTheDocument();

    rerender(<StatusBar deviceLabel="Tablet · 834 px" />);
    expect(screen.getByRole('group', { name: 'Editor details' })).toHaveTextContent(
      'Tablet · 834 px',
    );
  });

  it.each([
    ['saved', 'Saved'],
    ['saving', 'Saving'],
    ['error', 'Save failed'],
  ] as const)('renders %s with distinct semantic text', (saveState, visibleText) => {
    render(<StatusBar saveState={saveState} />);

    expect(screen.getByRole('status', { name: 'Save status' })).toHaveTextContent(visibleText);
  });

  it('renders an honest empty provenance state', () => {
    render(<StatusBar changes={[]} />);

    expect(screen.getByRole('status')).toHaveTextContent('No recent changes');
    expect(screen.queryByRole('list', { name: 'Recent changes' })).not.toBeInTheDocument();
  });

  it('uses token-sized hit targets, semantic state colours, tabular figures, and reduced motion', () => {
    render(
      <StatusBar
        tools={TOOLS}
        onToolSelect={() => undefined}
        changes={CHANGES}
        onChangeSelect={() => undefined}
      />,
    );
    expect(screen.getByRole('button', { name: 'Open history' })).toHaveAttribute('data-size', 'lg');
    expect(screen.getByRole('button', { name: 'Open history' })).toHaveAttribute(
      'data-variant',
      'icon',
    );
    expect(screen.getByRole('button', { name: 'Assistant: heading + cta' })).toHaveAttribute(
      'data-size',
      'sm',
    );
    expect(screen.getByRole('button', { name: 'Assistant: heading + cta' })).toHaveAttribute(
      'data-variant',
      'quiet',
    );
    expect(CSS_SOURCE).toMatch(/font-variant-numeric:\s*tabular-nums;/u);
    expect(CSS_SOURCE).toMatch(
      /\.bldr-statusbar__save--saved\s*\{[^}]*color:\s*var\(--bldr-success\);[^}]*\}/su,
    );
    expect(CSS_SOURCE).toMatch(
      /\.bldr-statusbar__save--saving\s*\{[^}]*color:\s*var\(--bldr-warning\);[^}]*\}/su,
    );
    expect(CSS_SOURCE).toMatch(
      /\.bldr-statusbar__save--error\s*\{[^}]*color:\s*var\(--bldr-danger\);[^}]*\}/su,
    );
    expect(CSS_SOURCE).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*\.bldr-statusbar__save--saving \.bldr-statusbar__save-indicator\s*\{[^}]*animation:\s*none;/su,
    );
    expect(CSS_SOURCE).toMatch(
      /\.bldr-statusbar__centre\s*\{[^}]*padding-block:\s*calc\(var\(--bldr-focus-ring-width\) \+ var\(--bldr-focus-ring-offset\)\);[^}]*padding-inline:\s*calc\(var\(--bldr-focus-ring-width\) \+ var\(--bldr-focus-ring-offset\)\);[^}]*\}/su,
    );
    expect(CSS_SOURCE).not.toMatch(/#[\da-f]{3,8}\b/iu);
    expect(CSS_SOURCE).not.toMatch(/\b\d*\.?\d+(?:px|rem|em)\b/u);
    expect(CSS_SOURCE).not.toMatch(/\bopacity\s*:/u);
  });
});
