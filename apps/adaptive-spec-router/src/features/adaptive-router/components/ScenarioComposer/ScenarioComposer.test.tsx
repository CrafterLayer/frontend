import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { initialScenario } from '../../model/demo-data';
import { ScenarioComposer } from './ScenarioComposer';

describe('ScenarioComposer', () => {
  it('submits a valid local scenario with its selected task signals', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();

    render(
      <ScenarioComposer scenario={initialScenario} onApply={onApply} onInvalid={() => undefined} />,
    );

    await user.clear(screen.getByLabelText('Task brief'));
    await user.type(
      screen.getByLabelText('Task brief'),
      'Harden the route policy with a review gate.',
    );
    await user.selectOptions(screen.getByLabelText('Work class'), 'security');
    await user.selectOptions(screen.getByLabelText('Risk level'), 'critical');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(onApply).toHaveBeenCalledWith({
      brief: 'Harden the route policy with a review gate.',
      workClass: 'security',
      risk: 'critical',
      orchestrationMode: 'codex-native',
      unavailableModel: null,
      availability: { claude: true, codex: true },
    });
  });

  it('keeps an invalid brief from manufacturing a route', async () => {
    const onApply = vi.fn();
    const user = userEvent.setup();

    const onInvalid = vi.fn();
    render(<ScenarioComposer scenario={initialScenario} onApply={onApply} onInvalid={onInvalid} />);

    await user.clear(screen.getByLabelText('Task brief'));
    await user.type(screen.getByLabelText('Task brief'), 'fix');
    await user.click(screen.getByRole('button', { name: 'Apply route signals' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Add at least 12 characters');
    expect(onApply).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledOnce();
  });
});
