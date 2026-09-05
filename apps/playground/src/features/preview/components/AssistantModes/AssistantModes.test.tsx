import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AssistantMode } from '../AssistantPanel/AssistantPanel.modes';
import { AssistantModes } from './AssistantModes';

function renderModes(mode: AssistantMode = 'ask', props: Partial<Parameters<typeof AssistantModes>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <AssistantModes
      mode={mode}
      onChange={onChange}
      busy={false}
      lockReasonId="lock"
      locale="ar"
      {...props}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

describe('AssistantModes', () => {
  it('is a named radio group with exactly one checked option', () => {
    renderModes('auto');

    expect(screen.getByRole('radiogroup', { name: 'Assistant mode' })).toBeInTheDocument();
    const checked = screen.getAllByRole('radio', { checked: true });
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAccessibleName('Auto');
  });

  it('costs ONE tab stop, on the chosen option', () => {
    /*
      Three separate tab stops made the composer's action row cost three presses
      to cross. A radio group is one stop by contract.
    */
    renderModes('plan');

    const stops = screen
      .getAllByRole('radio')
      .filter((radio) => radio.getAttribute('tabindex') === '0');
    expect(stops).toHaveLength(1);
    expect(stops[0]).toHaveAccessibleName('Plan');
  });

  it('answers the arrows, mirrored for Arabic, and wraps at the ends', async () => {
    /*
      Buttons with `role="radio"` do not answer arrows on their own. A person
      told "radio group" reaches for them; if nothing answers, the group is one
      only in the accessibility tree. In Arabic ArrowLeft is FORWARD.
    */
    const { onChange, user } = renderModes('ask');
    screen.getByRole('radio', { name: 'Ask' }).focus();

    await user.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith('auto');

    // Wraps: the ends of a radio group are not walls.
    await user.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith('plan');
  });

  it('does not answer keys that are not arrows', async () => {
    const { onChange, user } = renderModes('ask');
    screen.getByRole('radio', { name: 'Ask' }).focus();

    await user.keyboard('{a}{Tab}');

    expect(onChange).not.toHaveBeenCalled();
  });

  it('selects on click', async () => {
    const { onChange, user } = renderModes('ask');

    await user.click(screen.getByRole('radio', { name: 'Plan' }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith('plan');
  });

  it('locks every option while a run is in flight, and points at the reason', () => {
    /*
      A run captures its mode in a closure. Leaving this enabled let a person
      press Auto, change to Plan, and watch the page be written by the run they
      had just told to stop writing.
    */
    renderModes('auto', { busy: true });

    const group = screen.getByRole('radiogroup', { name: 'Assistant mode' });
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group).toHaveAttribute('aria-describedby', 'lock');
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled();
    }
  });

  it('points at no reason when there is nothing to explain', () => {
    renderModes('ask');
    expect(screen.getByRole('radiogroup', { name: 'Assistant mode' })).not.toHaveAttribute(
      'aria-describedby',
    );
  });
});
