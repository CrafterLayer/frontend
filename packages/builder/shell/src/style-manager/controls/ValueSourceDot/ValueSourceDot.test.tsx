import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { installBrowserStandIns } from '../../test-support';
import { ValueSourceDot } from './ValueSourceDot';
import { VALUE_SOURCE_DOT_LABELS_AR } from './ValueSourceDot.labels';

beforeAll(installBrowserStandIns);
afterEach(cleanup);

describe('ValueSourceDot', () => {
  it('names the property and where its value comes from', () => {
    render(<ValueSourceDot origin="larger-bucket" property="Padding" className="p-4" />);
    expect(
      screen.getByRole('button', { name: 'Padding: Inherited from a larger screen' }),
    ).toHaveAttribute('data-origin', 'larger-bucket');
  });

  it('opens a card with the class behind the value and resets only that class, once', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    render(
      <ValueSourceDot origin="here" property="Padding" className="max-md:p-4" onReset={onReset} />,
    );

    await user.click(screen.getByRole('button', { name: 'Padding: Set here' }));
    expect(screen.getByText('max-md:p-4')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reset' }));

    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('max-md:p-4')).not.toBeInTheDocument();
  });

  it('offers no Reset for an inherited value: there is nothing here to remove', async () => {
    const user = userEvent.setup();
    render(
      <ValueSourceDot origin="named-style" property="Colour" className="ck-s-card" onReset={vi.fn()} />,
    );
    await user.click(screen.getByRole('button', { name: 'Colour: From a named style' }));
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
  });

  it('flags a family that also lives at a custom breakpoint', async () => {
    const user = userEvent.setup();
    render(<ValueSourceDot origin="here" property="Gap" className="gap-4" customBreakpoint />);
    await user.click(screen.getByRole('button', { name: 'Gap: Set here' }));
    expect(screen.getByText('Also set at a custom breakpoint')).toBeInTheDocument();
  });

  it('speaks Arabic when given the Arabic labels', () => {
    render(
      <ValueSourceDot
        origin="here"
        property="الحشو"
        className="p-4"
        labels={VALUE_SOURCE_DOT_LABELS_AR}
      />,
    );
    expect(screen.getByRole('button', { name: 'الحشو: مضبوطة هنا' })).toBeInTheDocument();
  });
});
