import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';

import { defaultBlocks } from '../../default-blocks';
import { Builder } from './Builder';

function presetKernel() {
  return createBuilder({
    extensions: [defaultBlocks],
    ports: { clock: fixedClock(), ids: seededIds('b') },
  });
}

function frameDocument(): Document {
  const frame = screen.getByTitle<HTMLIFrameElement>('Preview');
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error('no contentDocument');
  }
  return doc;
}

describe('Builder (preset entrypoint)', () => {
  it('mounts the page root inside the isolation frame with theme tokens present', async () => {
    render(<Builder kernel={presetKernel()} />);
    await waitFor(() => {
      expect(frameDocument().querySelector('main.bldr-page')).not.toBeNull();
      expect(frameDocument().getElementById('bldr-theme-tokens')?.textContent).toContain(
        '--t-surface',
      );
    });
  });

  it('follows the DOCUMENT direction live through setDocMeta (undoable)', async () => {
    const kernel = presetKernel();
    render(<Builder kernel={kernel} />);
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('ltr');
    });

    act(() => {
      kernel.dispatch('setDocMeta', { dir: 'rtl' });
    });
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('rtl');
    });

    act(() => {
      kernel.undo();
    });
    await waitFor(() => {
      expect(frameDocument().documentElement.getAttribute('dir')).toBe('ltr');
    });
  });
});
