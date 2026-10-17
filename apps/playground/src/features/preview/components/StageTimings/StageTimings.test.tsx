import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { RunProgress } from '../AssistantPanel/AssistantPanel.progress';
import { StageTimings } from './StageTimings';

const run = (stages: RunProgress['stages']): RunProgress => ({
  stages,
  startedAt: 0,
  stageSince: null,
  failedAt: null,
});

describe('StageTimings', () => {
  it('names each finished row and its duration', () => {
    const { container } = render(
      <StageTimings
        run={run([
          { id: 'sitemap', status: 'done', detail: '00:01.123' },
          { id: 'structure', status: 'done', detail: '00:00.310' },
        ])}
      />,
    );
    expect(container.textContent).toBe('Plan 00:01.123 · Structure 00:00.310');
  });

  it('leaves out a row that failed — its detail is a reason, not a time', () => {
    render(
      <StageTimings
        run={run([
          { id: 'sitemap', status: 'done', detail: '00:01.123' },
          { id: 'structure', status: 'failed', detail: 'refused' },
        ])}
      />,
    );
    expect(screen.queryByText(/refused/)).toBeNull();
  });

  it('leaves out a finished row with no duration', () => {
    const { container } = render(
      <StageTimings
        run={run([
          { id: 'sitemap', status: 'done', detail: '00:01.123' },
          { id: 'structure', status: 'done' },
        ])}
      />,
    );
    expect(container.textContent).toBe('Plan 00:01.123');
  });

  it('renders nothing at all for a revived card', () => {
    const { container } = render(<StageTimings run={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when no row ever settled', () => {
    const { container } = render(<StageTimings run={run([{ id: 'sitemap', status: 'active' }])} />);
    expect(container).toBeEmptyDOMElement();
  });
});
