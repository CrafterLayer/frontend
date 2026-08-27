import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { initialScenario } from '../../model/demo-data';
import { routeScenario } from '../../model/routing-policy';
import { RouteDecisionPanel } from './RouteDecisionPanel';

describe('RouteDecisionPanel', () => {
  it('shows one writer, one independent reviewer, and the policy rationale', () => {
    render(
      <RouteDecisionPanel decision={routeScenario(initialScenario)} scenario={initialScenario} />,
    );

    expect(screen.getByLabelText('Designated writer')).toHaveTextContent('Codex · Terra');
    expect(screen.getByLabelText('Independent reviewer')).toHaveTextContent('Codex · Sol');
    expect(screen.getByLabelText('Route decision signals')).toHaveTextContent(
      'never started automatically',
    );
    expect(screen.getByLabelText('Fallback status')).toHaveTextContent('Codex-native is active');
  });

  it('makes an unavailable provider fallback visible', () => {
    const decision = routeScenario({
      ...initialScenario,
      orchestrationMode: 'claude-adaptive',
      availability: { claude: true, codex: false },
    });

    render(
      <RouteDecisionPanel
        decision={decision}
        scenario={{
          ...initialScenario,
          orchestrationMode: 'claude-adaptive',
          availability: { claude: true, codex: false },
        }}
      />,
    );

    expect(screen.getByText(/Codex is unavailable/)).toBeVisible();
    expect(screen.getByText('Fresh session')).toBeVisible();
  });

  it('does not show a false route when a decision is unavailable', () => {
    render(<RouteDecisionPanel decision={null} scenario={initialScenario} />);

    expect(screen.getByRole('status')).toHaveTextContent('Add a clearer brief');
    expect(screen.queryByLabelText('Designated writer')).not.toBeInTheDocument();
  });
});
