import * as builder from '@craftkit/builder';
import { describe, expect, it } from 'vitest';

import { capabilitiesFromEngine, type EngineSurface } from './capabilities';

/** The facade with one export taken out, as an older or a trimmed engine would be. */
function without(name: keyof EngineSurface): EngineSurface {
  return { ...builder, [name]: undefined };
}

describe('capabilitiesFromEngine (SPEC §7.6: every fallback is a flag read off the engine)', () => {
  it('reads what the engine in this tree offers today', () => {
    expect(capabilitiesFromEngine()).toEqual({
      rowUndo: true,
      undoBuild: false,
      restore: false,
      facts: true,
      failureClasses: true,
      editablePlan: true,
      structuredDirection: true,
      estimate: true,
      canvasStage: false,
    });
  });

  it('drops a flag when the function behind it is missing', () => {
    expect(capabilitiesFromEngine(without('revertBuildSection')).rowUndo).toBe(false);
    expect(capabilitiesFromEngine(without('planAiPage')).editablePlan).toBe(false);
    const unchecked = capabilitiesFromEngine(without('validatePagePlan'));
    expect(unchecked.editablePlan).toBe(false);
    expect(unchecked.structuredDirection).toBe(false);
  });

  it('offers Undo build and Restore only once E3 ships them, never by composing section reverts', () => {
    // revertBuildSection + removeUnfilledSections cannot undo the skeleton's own writes.
    expect(capabilitiesFromEngine({ ...builder }).undoBuild).toBe(false);
    const e3: EngineSurface = {
      ...builder,
      revertBuild: () => undefined,
      restoreBefore: () => undefined,
    };
    expect(capabilitiesFromEngine(e3)).toMatchObject({ undoBuild: true, restore: true });
  });

  it('never claims the canvas stage, which is the shell’s, not the engine’s (E8)', () => {
    expect(
      capabilitiesFromEngine({ ...builder, createStageMarks: () => undefined } as EngineSurface)
        .canvasStage,
    ).toBe(false);
  });
});
