import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyRichText, richText } from '@craftkit/builder-schema';

import { RichTextField } from './RichTextField';

class ResizeObserverStub {
  static readonly instances: ResizeObserverStub[] = [];

  readonly disconnect = vi.fn();
  readonly observe = vi.fn();

  constructor(_callback: ResizeObserverCallback) {
    ResizeObserverStub.instances.push(this);
  }
}

describe('RichTextToolbar', () => {
  it('positions the focused control tooltip in logical LTR and RTL coordinates and cleans its observer', () => {
    vi.stubGlobal('ResizeObserver', ResizeObserverStub);
    const view = render(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['props', 'body']}
        onChange={() => undefined}
      />,
    );
    const toolbar = screen.getByRole('group', { name: 'Formatting' });
    const bold = screen.getByRole('button', { name: 'Bold' });
    const italic = screen.getByRole('button', { name: 'Italic' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });
    let direction: 'ltr' | 'rtl' = 'ltr';
    const computedStyle = vi.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      if (element === toolbar) {
        return {
          direction,
          paddingBlockEnd: '5px',
          paddingBlockStart: '5px',
          paddingInlineEnd: '20px',
          paddingInlineStart: '10px',
        } as unknown as CSSStyleDeclaration;
      }
      return { paddingBlockStart: '4px' } as unknown as CSSStyleDeclaration;
    });
    vi.spyOn(toolbar, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 50, 200, 40));
    vi.spyOn(bold, 'getBoundingClientRect').mockReturnValue(new DOMRect(250, 55, 20, 20));
    vi.spyOn(italic, 'getBoundingClientRect').mockReturnValue(new DOMRect(250, 55, 20, 20));
    vi.spyOn(tooltip, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 80, 20));

    try {
      act(() => {
        fireEvent.focus(bold);
      });
      expect(tooltip).toHaveAttribute('data-visible', 'true');
      expect(tooltip).toHaveTextContent('Bold');
      expect(tooltip.style.insetInlineStart).toBe('100px');
      expect(tooltip.style.insetBlockStart).toBe('5px');
      expect(ResizeObserverStub.instances[0]?.observe).toHaveBeenCalledWith(toolbar);

      direction = 'rtl';
      act(() => {
        fireEvent.focus(italic);
      });
      expect(tooltip).toHaveTextContent('Italic');
      expect(tooltip.style.insetInlineStart).toBe('10px');

      const callsBeforeResize = computedStyle.mock.calls.length;
      act(() => {
        fireEvent(window, new Event('resize'));
      });
      expect(computedStyle).toHaveBeenCalledTimes(callsBeforeResize + 2);

      view.unmount();
      expect(ResizeObserverStub.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
    } finally {
      computedStyle.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it('refuses an unsafe link through the visible toolbar without changing the editor document', () => {
    const onChange = vi.fn();
    vi.stubGlobal(
      'prompt',
      vi.fn(() => 'javascript:alert(1)'),
    );
    try {
      render(
        <RichTextField
          schema={richText()}
          value={emptyRichText()}
          path={['props', 'body']}
          onChange={onChange}
        />,
      );

      act(() => {
        fireEvent.click(screen.getByRole('button', { name: 'Link' }));
      });

      expect(onChange).not.toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(
        'That link was refused: only http(s), mailto, and relative links are allowed.',
      );
      expect(screen.getByRole('button', { name: 'Link' })).toHaveAttribute('aria-pressed', 'false');
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses pointer hover to reveal and then clear the formatting tooltip', () => {
    render(
      <RichTextField
        schema={richText()}
        value={emptyRichText()}
        path={['props', 'body']}
        onChange={() => undefined}
      />,
    );
    const bold = screen.getByRole('button', { name: 'Bold' });
    const tooltip = screen.getByRole('tooltip', { hidden: true });

    fireEvent.mouseEnter(bold);
    expect(tooltip).toHaveAttribute('data-visible', 'true');
    expect(tooltip).toHaveTextContent('Bold');

    fireEvent.mouseLeave(bold);
    expect(tooltip).toHaveAttribute('data-visible', 'false');
    expect(tooltip).toHaveTextContent('');
  });
});
