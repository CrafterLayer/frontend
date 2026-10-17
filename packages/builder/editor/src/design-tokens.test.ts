import { describe, expect, it } from 'vitest';

import { onePageSite } from '@craftkit/builder-schema/testing';

import {
  createSiteBuilder,
  defaultDesignSystem,
  siteCommands,
  type BuilderSite,
  type BuilderSiteKernel,
} from './index';
import { fixedClock, seededIds } from './testing';

/**
 * The design-token surface, reached the way an application reaches it (T086).
 *
 * ADR 0003 lets an app depend on `@craftkit/builder` and nothing deeper, so a
 * panel that recolours a site can only get here through this barrel. What the
 * test insists on is not that the names exist — a barrel makes that trivial —
 * but that using them costs ONE transaction per commit. A colour picker that
 * dispatched per keystroke would fill history with a hundred entries and make
 * "undo the recolour" a hundred presses.
 */

const kernelFor = (site: BuilderSite = onePageSite()): BuilderSiteKernel =>
  createSiteBuilder({
    site,
    ports: { clock: fixedClock(), ids: seededIds('tokens') },
  });

describe('the design-token surface', () => {
  it('is reachable through the preset, both the command names and their argument types', () => {
    expect(Object.keys(siteCommands)).toEqual(
      expect.arrayContaining(['setDesignToken', 'setDesignSystem']),
    );
  });

  it('costs ONE transaction per token commit', () => {
    const kernel = kernelFor();
    kernel.dispatch('setDesignToken', { token: 'accent', value: '#0b5cff' }, 'user');

    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getSite().designSystem.tokens.accent).toBe('#0b5cff');
  });

  it('costs ONE transaction for a whole palette, not one per token', () => {
    const kernel = kernelFor();
    const base = defaultDesignSystem();

    kernel.dispatchGroup(
      [
        { command: 'setDesignToken', args: { token: 'accent', value: '#0b5cff' } },
        { command: 'setDesignToken', args: { token: 'accentText', value: '#ffffff' } },
        { command: 'setDesignToken', args: { token: 'success', value: '#0f7a3d' } },
      ],
      { author: 'user', label: 'Recolour the accent' },
    );

    /*
      Three edits, one entry in history. A picker that dispatched per change
      would make "undo the recolour" three presses — and a picker that dragged
      would make it a hundred.
    */
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.getSite().designSystem.tokens.accent).toBe('#0b5cff');
    expect(kernel.getSite().designSystem.tokens.success).toBe('#0f7a3d');
    expect(base.tokens.accent).not.toBe('#0b5cff');
  });

  it('reverses a whole palette change in ONE undo', () => {
    const kernel = kernelFor();
    const before = JSON.stringify(kernel.getSite().designSystem);

    kernel.dispatch(
      'setDesignSystem',
      { system: { ...defaultDesignSystem(), name: 'Warm' } },
      'user',
    );
    expect(kernel.getSite().designSystem.name).toBe('Warm');

    expect(kernel.undo()).toBe(true);
    expect(JSON.stringify(kernel.getSite().designSystem)).toBe(before);
  });

  it('REFUSES a token change that would make its own pairings illegible', () => {
    const kernel = kernelFor();
    /*
      The door owns legibility, not the panel. A picker that validated its own
      colours would be a second answer to "is this readable", and the day the
      two disagreed a site would ship text nobody could read.
    */
    expect(() => {
      kernel.dispatch('setDesignToken', { token: 'text', value: '#fefefe' }, 'user');
    }).toThrow();
    expect(kernel.transactions()).toHaveLength(0);
  });

  it('changes no page document when the palette changes (FR-012)', () => {
    const kernel = kernelFor();
    const pagesBefore = JSON.stringify(kernel.getSite().pages);

    kernel.dispatch('setDesignToken', { token: 'accent', value: '#0b5cff' }, 'user');

    expect(JSON.stringify(kernel.getSite().pages)).toBe(pagesBefore);
  });
});
