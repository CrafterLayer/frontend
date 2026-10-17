/**
 * The scene probe rides only on a free-code build (2026-10-12): without free code no scene
 * program is written, so no build pays for a hidden frame it cannot use.
 */
import { describe, expect, it, vi } from 'vitest';

import type * as Builder from '@craftkit/builder';

import { sceneProbeOptions } from './agent-controller/scene-probe-options';

const probeScene = vi.hoisted(() => vi.fn(() => Promise.resolve({ status: 'done' })));
vi.mock('@craftkit/builder', async (original) => ({
  ...(await original<typeof Builder>()),
  probeScene,
}));

describe('sceneProbeOptions', () => {
  it('adds the probe when free code is on', () => {
    expect(typeof sceneProbeOptions(true).sceneProbe).toBe('function');
  });

  it('turns the visual review on, and takes pictures only when the build asks for them', async () => {
    const options = sceneProbeOptions(true);
    expect(options.visualReview).toBe(true);
    const section = { tree: null, js: 'await ck.scene({})' };
    await options.sceneProbe?.(section, { lang: 'ar', dir: 'rtl', thumbnails: true });
    expect(probeScene).toHaveBeenLastCalledWith(
      expect.objectContaining({ section, lang: 'ar', dir: 'rtl', thumbnails: true }),
    );
    await options.sceneProbe?.(section, { lang: 'en', dir: 'ltr' });
    expect(probeScene).toHaveBeenLastCalledWith(expect.not.objectContaining({ thumbnails: true }));
  });

  it('adds nothing when free code is off or unset', () => {
    expect(sceneProbeOptions(false)).toEqual({});
    expect(sceneProbeOptions(undefined)).toEqual({});
  });
});
