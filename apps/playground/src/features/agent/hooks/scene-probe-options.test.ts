/**
 * The scene probe rides only on a free-code build (2026-10-12): without free code no scene
 * program is written, so no build pays for a hidden frame it cannot use.
 */
import { describe, expect, it } from 'vitest';

import { sceneProbeOptions } from './agent-controller/scene-probe-options';

describe('sceneProbeOptions', () => {
  it('adds the probe when free code is on', () => {
    expect(typeof sceneProbeOptions(true).sceneProbe).toBe('function');
  });

  it('adds nothing when free code is off or unset', () => {
    expect(sceneProbeOptions(false)).toEqual({});
    expect(sceneProbeOptions(undefined)).toEqual({});
  });
});
