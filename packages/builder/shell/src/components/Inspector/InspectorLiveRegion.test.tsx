import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InspectorLiveRegion } from './InspectorLiveRegion';
import { createAnnouncer } from './use-inspector-announcer';

describe('InspectorLiveRegion', () => {
  it('is the polite status named Inspector messages', () => {
    render(<InspectorLiveRegion announcer={createAnnouncer()} />);
    const region = screen.getByRole('status', { name: 'Inspector messages' });
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveClass('bldr-visually-hidden');
    expect(region).toHaveTextContent('');
  });

  it('mutates the text node even when the same message repeats', () => {
    const announcer = createAnnouncer();
    render(<InspectorLiveRegion announcer={announcer} />);
    const region = screen.getByRole('status', { name: 'Inspector messages' });

    act(() => {
      announcer.announce('title updated');
    });
    const first = region.textContent;
    expect(region).toHaveTextContent('title updated');

    act(() => {
      announcer.announce('title updated');
    });
    expect(region).toHaveTextContent('title updated');
    expect(region.textContent).not.toBe(first);
  });
});
