import { render } from '@testing-library/react';
import { useState } from 'react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';

import { IconSend } from './AssistantPanel.icons';

/*
  Measured in the live panel (2026-09-28): the first click on Send was lost.
  Each render handed React a NEW `{ __html }` object, React rewrote the
  glyph's innerHTML, the path under the pointer was replaced between
  pointerdown and pointerup, and the browser fired no click at all.
*/
describe('assistant icons', () => {
  it('keeps the same glyph node across re-renders, so a click cannot be torn out mid-press', () => {
    let bump: () => void = () => undefined;
    function Host() {
      const [count, setCount] = useState(0);
      bump = () => {
        setCount((value) => value + 1);
      };
      return (
        <button type="button" data-count={count}>
          <IconSend />
        </button>
      );
    }
    const { container } = render(<Host />);
    const before = container.querySelector('svg path');

    act(() => {
      bump();
    });

    expect(container.querySelector('svg path')).toBe(before);
  });
});
