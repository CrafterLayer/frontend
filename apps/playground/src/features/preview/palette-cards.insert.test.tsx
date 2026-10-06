import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { Palette } from '@craftkit/builder';

import { createPlaygroundKernel } from './create-playground-kernel';

/*
  block-parts fix pass (2026-10-06): inserting "Custom Code Symbol" from the
  Blocks library threw «Props for "customCodeSymbol" failed its schema» and
  inserted nothing. A card inserts with no props, so every card the palette
  shows must default; symbol instances are placed from the Symbols panel.
*/

afterEach(cleanup);

describe('every Blocks library card inserts (library-insert smoke)', () => {
  it('lists no card whose block cannot be inserted with its defaults', () => {
    const kernel = createPlaygroundKernel({ fixture: 'inline' });
    render(<Palette kernel={kernel} />);
    expect(screen.queryByRole('button', { name: /Custom Code Symbol/iu })).toBeNull();
    const surface = kernel.getDocument().surface;
    const listed = kernel.context.registry
      .blocks(surface)
      .filter((entry) => entry.schema.props.safeParse({}).success);
    expect(listed.length).toBeGreaterThan(50);
  });

  it('every listed block inserts into the page without a schema failure', () => {
    const kernel = createPlaygroundKernel({ fixture: 'inline' });
    const surface = kernel.getDocument().surface;
    const failures: string[] = [];
    for (const entry of kernel.context.registry.blocks(surface)) {
      if (!entry.schema.props.safeParse({}).success) continue;
      try {
        kernel.dispatch('insertNode', { type: entry.schema.type, parentId: kernel.getDocument().rootId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // A block the page root does not accept is a placement question, not a broken card.
        if (message.includes('failed its schema')) failures.push(`${entry.schema.type}: ${message}`);
      }
    }
    expect(failures).toEqual([]);
  });
});
