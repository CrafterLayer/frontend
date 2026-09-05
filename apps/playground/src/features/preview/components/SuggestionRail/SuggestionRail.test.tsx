import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Suggestion } from '../AssistantPanel/AssistantPanel.suggestions';
import { SuggestionRail } from './SuggestionRail';

const SUGGESTIONS: readonly Suggestion[] = [
  { id: 'followUp:now add pricing', kind: 'followUp', text: 'now add pricing' },
  { id: 'selection:rewrite the hero text', kind: 'selection', text: 'rewrite the hero text' },
  { id: 'example:قسم افتتاحي عربي', kind: 'example', text: 'قسم افتتاحي عربي' },
];

describe('SuggestionRail', () => {
  it('renders nothing at all when there is nothing to offer', () => {
    const { container } = render(
      <SuggestionRail suggestions={[]} layout="rail" busy={false} onPick={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('sends the suggestion VERBATIM — the chip is the request', () => {
    const onPick = vi.fn();
    render(
      <SuggestionRail suggestions={SUGGESTIONS} layout="rail" busy={false} onPick={onPick} />,
    );

    return userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'قسم افتتاحي عربي' }))
      .then(() => {
        expect(onPick).toHaveBeenCalledWith('قسم افتتاحي عربي');
      });
  });

  it('carries the whole sentence in the accessible name, even though the chip truncates', () => {
    render(
      <SuggestionRail suggestions={SUGGESTIONS} layout="rail" busy={false} onPick={vi.fn()} />,
    );

    for (const chip of within(screen.getByRole('list')).getAllByRole('button')) {
      expect(chip.getAttribute('title')).toBe(chip.textContent);
    }
  });

  it('marks each chip with the language of its OWN text, not the panel’s', () => {
    /*
      A rail can hold an Arabic example beside an English follow-up. Announcing
      one in the other's voice is the failure `lang` exists to prevent.
    */
    render(
      <SuggestionRail suggestions={SUGGESTIONS} layout="rail" busy={false} onPick={vi.fn()} />,
    );

    expect(screen.getByRole('button', { name: 'قسم افتتاحي عربي' })).toHaveAttribute('lang', 'ar');
    expect(screen.getByRole('button', { name: 'now add pricing' })).toHaveAttribute('lang', 'en');
  });

  it('stays present but unpressable while the assistant works', () => {
    /*
      Unmounting it took the chip out from under the finger that had just
      pressed it — focus fell to `<body>` — and dropped the composer by the
      strip's whole height. Disabled keeps the height, the focus, and the truth:
      these are still your options, in a moment.
    */
    render(<SuggestionRail suggestions={SUGGESTIONS} layout="rail" busy onPick={vi.fn()} />);

    const chips = within(screen.getByRole('list')).getAllByRole('button');
    expect(chips).toHaveLength(3);
    for (const chip of chips) {
      expect(chip).toBeDisabled();
    }
  });

  it('publishes its layout, because the two are styled differently', () => {
    const { rerender } = render(
      <SuggestionRail suggestions={SUGGESTIONS} layout="stack" busy={false} onPick={vi.fn()} />,
    );
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'stack');

    rerender(
      <SuggestionRail suggestions={SUGGESTIONS} layout="rail" busy={false} onPick={vi.fn()} />,
    );
    expect(screen.getByRole('list')).toHaveAttribute('data-layout', 'rail');
  });

  it('does not scroll a stack, whatever the wheel does', () => {
    /*
      The wheel handler exists for the rail. Running it on a stack would fight
      the vertical scroll the stack is meant to have.
    */
    const { container } = render(
      <SuggestionRail suggestions={SUGGESTIONS} layout="stack" busy={false} onPick={vi.fn()} />,
    );
    const list = screen.getByRole('list');
    const scrollBy = vi.fn();
    Object.defineProperty(list, 'scrollBy', { value: scrollBy, configurable: true });
    Object.defineProperty(list, 'scrollWidth', { value: 900, configurable: true });
    Object.defineProperty(list, 'clientWidth', { value: 300, configurable: true });

    list.dispatchEvent(new WheelEvent('wheel', { deltaY: 120, bubbles: true }));

    expect(scrollBy).not.toHaveBeenCalled();
    expect(container.querySelector('[data-layout="stack"]')).not.toBeNull();
  });
});
