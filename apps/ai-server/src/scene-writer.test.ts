/**
 * Scene writers keep thinking (2026-10-12). A section writer handed the Pixi playbooks with
 * free code on writes a program (a lib to load, a lifecycle to dispose, a layout to keep in
 * its region), and with thinking off that is where builds failed the scene checks. Ours to
 * prove: such a writer thinks at medium (or the section budget if higher) with the scene
 * output budget; every other section writer, scaffold and page plan is unchanged; and a
 * deployment's larger output budget is never lowered.
 */
import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { SCENE_MAX_TOKENS, callEffort } from './plan-request';

function wire(skills: readonly string[], extra: Record<string, unknown> = {}): AiPlanWireRequest {
  return {
    version: 1,
    request: 'Fill the story section',
    context: { skills: skills.map((id) => ({ id })) },
    ...extra,
  } as unknown as AiPlanWireRequest;
}

const SCENE = ['craftkit.build-fill', 'craftkit.pixi-stories'];

describe('callEffort for a scene writer', () => {
  it('keeps thinking on at medium with the scene budget', () => {
    expect(callEffort(wire(SCENE, { freeCode: true }), { sectionEffort: 'low' })).toEqual({
      effort: 'medium',
      maxTokens: SCENE_MAX_TOKENS,
    });
  });

  it('uses a higher section budget, and never lowers a larger deployment budget', () => {
    expect(
      callEffort(wire(SCENE, { freeCode: true }), { sectionEffort: 'high', maxTokens: 64_000 }),
    ).toEqual({ effort: 'high', maxTokens: 64_000 });
  });

  it('leaves every other call as it was', () => {
    // No free code: the playbooks cannot be used, so it is a plain writer.
    expect(callEffort(wire(SCENE), { sectionEffort: 'low' })).toEqual({
      effort: 'low',
      thinkingOff: true,
    });
    // A plain section writer.
    expect(
      callEffort(wire(['craftkit.build-fill'], { freeCode: true }), { sectionEffort: 'low' }),
    ).toEqual({ effort: 'low', thinkingOff: true });
    // A page plan, even with the playbooks pinned.
    expect(
      callEffort(wire(SCENE, { freeCode: true, task: 'page-plan' }), { sectionEffort: 'low' }),
    ).toEqual({ thinkingOff: true });
  });
});
