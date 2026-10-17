import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { initialDemoRun } from '../../model/demo-data';
import { EvidenceConsole } from './EvidenceConsole';

describe('EvidenceConsole', () => {
  it('shows one active writer lease and traceable evidence records', () => {
    render(<EvidenceConsole run={initialDemoRun} />);

    expect(screen.getByLabelText('Active writer lease')).toHaveTextContent('Codex · Terra');
    expect(screen.getByLabelText('Active writer lease')).toHaveTextContent(
      'Parallel writers are not permitted',
    );
    expect(screen.getByLabelText('Evidence ledger')).toHaveTextContent('EV-014');
    expect(screen.getByLabelText('Evidence ledger')).toHaveTextContent('Dual review freshness');
  });

  it('uses text to make a blocked release gate explicit', () => {
    render(<EvidenceConsole run={{ ...initialDemoRun, releaseGate: 'blocked' }} />);

    expect(screen.getByText('Release blocked')).toBeVisible();
    expect(screen.getByLabelText('Run timeline')).toHaveTextContent('Implement');
  });
});
