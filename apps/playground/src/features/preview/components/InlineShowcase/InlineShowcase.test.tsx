import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createPlaygroundKernel } from '../../create-playground-kernel';
import { InlineShowcase } from './InlineShowcase';

describe('InlineShowcase', () => {
  it('mounts the inline fixture on an editable canvas with the caption strip', async () => {
    const kernel = createPlaygroundKernel({ fixture: 'inline' });
    render(<InlineShowcase kernel={kernel} />);

    // The caption tells a visitor what to try; the canvas region is the stage.
    expect(screen.getByText(/Double-click text to edit it in place/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Editor canvas' })).toBeInTheDocument();

    // The fixture's rich block reaches the real frame. The HEADLINE behavior
    // (bubble, per-word bold) needs layout — the story's play() proves it in
    // Chromium; jsdom only smoke-checks the mount.
    const frame = screen.getByTitle<HTMLIFrameElement>('Editor canvas');
    await waitFor(() => {
      expect(frame.contentDocument?.querySelector('[data-bldr-node="tale"]')).not.toBeNull();
    });
  });
});
