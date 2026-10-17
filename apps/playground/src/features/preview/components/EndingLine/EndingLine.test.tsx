import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EndingLine } from './EndingLine';

describe('EndingLine', () => {
  it('says how it ended, how long it ran, and where it stopped', () => {
    const { container } = render(
      <EndingLine
        verb="Stopped"
        receipt={{ elapsed: '00:04.210', stage: 'structure', stageLabel: 'Structure' }}
      />,
    );
    expect(container.textContent).toBe('Stopped after 00:04.210 at Structure');
  });

  it('takes its verb from the card', () => {
    render(
      <EndingLine
        verb="Failed"
        receipt={{ elapsed: '00:01.000', stage: null, stageLabel: null }}
      />,
    );
    expect(screen.getByText(/^Failed after/)).toBeInTheDocument();
  });

  it('drops the whole clause when no row was open', () => {
    const { container } = render(
      <EndingLine
        verb="Stopped"
        receipt={{ elapsed: '00:00.180', stage: null, stageLabel: null }}
      />,
    );
    expect(container.textContent).toBe('Stopped after 00:00.180');
  });

  it("shows the provider's last words after a dash", () => {
    const { container } = render(
      <EndingLine
        verb="Stopped"
        receipt={{
          elapsed: '00:06.400',
          stage: 'sitemap',
          stageLabel: 'Plan',
          lastLine: 'أفكر في ترتيب الأقسام…',
        }}
      />,
    );
    expect(container.textContent).toBe('Stopped after 00:06.400 at Plan — أفكر في ترتيب الأقسام…');
  });

  it('lets that text declare its own direction', () => {
    render(
      <EndingLine
        verb="Stopped"
        receipt={{ elapsed: '00:06.400', stage: null, stageLabel: null, lastLine: 'مرحبا' }}
      />,
    );
    expect(screen.getByText('مرحبا')).toHaveAttribute('dir', 'auto');
  });

  it('writes no dash when there is no line to follow it', () => {
    const { container } = render(
      <EndingLine
        verb="Stopped"
        receipt={{ elapsed: '00:01.000', stage: null, stageLabel: null }}
      />,
    );
    expect(container.textContent).not.toContain('—');
  });

  it('renders nothing at all for a revived card', () => {
    const { container } = render(<EndingLine verb="Stopped" receipt={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
