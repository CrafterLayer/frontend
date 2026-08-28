import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AdaptiveSpecRouter } from './AdaptiveSpecRouter';

describe('AdaptiveSpecRouter', () => {
  it('updates the writer route from local task signals', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.selectOptions(screen.getByLabelText('Work class'), 'architecture');
    await user.selectOptions(screen.getByLabelText('Risk level'), 'critical');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByLabelText('Designated writer')).toHaveTextContent('Claude · Opus');
    expect(screen.getByLabelText('Independent reviewer')).toHaveTextContent('Codex · Sol');
    expect(screen.getByText('Critical lane')).toBeVisible();
    expect(screen.getByLabelText('Evidence ledger')).toHaveTextContent('Writer lease');
    expect(screen.getByLabelText('Evidence ledger')).toHaveTextContent('Verification suite');
  });

  it('does not issue an active writer lease before the dual plan-review gate is ready', () => {
    render(<AdaptiveSpecRouter />);

    expect(screen.getByLabelText('Reserved writer lease')).toHaveTextContent('Codex · Terra');
    expect(screen.queryByLabelText('Active writer lease')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Evidence ledger')).toHaveTextContent('No active writer lease');
  });

  it('clears the applied route when the current draft is rejected as insufficient', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.clear(screen.getByLabelText('Task brief'));
    await user.type(screen.getByLabelText('Task brief'), 'fix');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Add at least 12 characters');
    expect(screen.queryByLabelText('Designated writer')).not.toBeInTheDocument();
    expect(screen.getByLabelText('No writer lease')).toBeVisible();
  });

  it('blocks release when an invalid draft replaces an otherwise review-ready route', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));
    expect(screen.getByText('Release waiting')).toBeVisible();

    await user.clear(screen.getByLabelText('Task brief'));
    await user.type(screen.getByLabelText('Task brief'), 'fix');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByText('Release blocked')).toBeVisible();
  });

  it('exposes a model-tier fallback instead of silently keeping an unavailable preferred model', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.selectOptions(screen.getByLabelText('Work class'), 'architecture');
    await user.selectOptions(screen.getByLabelText('Risk level'), 'critical');
    await user.selectOptions(screen.getByLabelText('Unavailable model tier'), 'Opus');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByLabelText('Designated writer')).toHaveTextContent('Claude · Sonnet');
    expect(screen.getByLabelText('Fallback status')).toHaveTextContent('Opus is unavailable');
  });

  it('invalidates dual plan approval after a material revision', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));
    await user.click(screen.getByRole('button', { name: 'Simulate material revision' }));

    expect(screen.getByLabelText('Stale plan reviews')).toBeVisible();
    expect(screen.getAllByText('Reviews are stale')[0]).toBeVisible();
    expect(screen.getByText('Release blocked')).toBeVisible();
  });

  it('does not claim a dual plan review when Codex is unavailable in Claude-adaptive mode', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.click(screen.getByLabelText('Codex lane available'));
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByLabelText('Current plan reviews')).toHaveTextContent('Claude · Opus');
    expect(screen.getByRole('status')).toHaveTextContent('Reviews required');
    expect(screen.getByText('Release blocked')).toBeVisible();
  });

  it('resets the altered scenario and revision to the deterministic example', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.selectOptions(screen.getByLabelText('Workflow entry point'), 'claude-adaptive');
    await user.selectOptions(screen.getByLabelText('Work class'), 'architecture');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));
    await user.click(screen.getByRole('button', { name: 'Simulate material revision' }));
    await user.click(screen.getByRole('button', { name: 'Reset demo' }));

    expect(screen.getByLabelText('Task brief')).toHaveValue(
      'Add a resilient release approval gate to the workspace workflow.',
    );
    expect(screen.getAllByText('Reviews required')[0]).toBeVisible();
    expect(screen.getByText('Release blocked')).toBeVisible();
    expect(screen.getByLabelText('Designated writer')).toHaveTextContent('Codex · Terra');
    expect(screen.getByLabelText('Workflow entry point')).toHaveValue('codex-native');
  });

  it('resets an unapplied draft as well as the last applied scenario', async () => {
    const user = userEvent.setup({ delay: null });
    render(<AdaptiveSpecRouter />);

    await user.clear(screen.getByLabelText('Task brief'));
    await user.type(
      screen.getByLabelText('Task brief'),
      'Draft-only change that should be discarded.',
    );
    await user.selectOptions(screen.getByLabelText('Unavailable model tier'), 'Sol');
    await user.click(screen.getByRole('button', { name: 'Reset demo' }));

    expect(screen.getByLabelText('Task brief')).toHaveValue(
      'Add a resilient release approval gate to the workspace workflow.',
    );
    expect(screen.getByLabelText('Unavailable model tier')).toHaveValue('');
  });

  it('keeps the primary controls and text statuses available in RTL', () => {
    const previousDirection = document.documentElement.dir;
    document.documentElement.dir = 'rtl';

    try {
      render(<AdaptiveSpecRouter />);

      expect(screen.getByLabelText('Workflow entry point')).toBeVisible();
      expect(screen.getByLabelText('Unavailable model tier')).toBeVisible();
      expect(screen.getAllByText('Reviews required')[0]).toBeVisible();
      expect(screen.getByText('Release blocked')).toBeVisible();
    } finally {
      document.documentElement.dir = previousDirection;
    }
  });
});
