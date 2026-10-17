import { describe, expect, it } from 'vitest';

import { loadMotionStage, needsMotionEngine } from './index';

/*
  The containment tests prove no OTHER package imports the engine. These prove
  the owner's own front door does not drag it in either: a static re-export here
  would put `motion` in the module graph of the preset, and therefore of every
  application, while every containment check still passed.
*/
describe('the engine is reached only through a dynamic door', () => {
  it('answers "no engine needed" for everything the stylesheet already handles', () => {
    expect(needsMotionEngine(undefined)).toBe(false);
    expect(needsMotionEngine({})).toBe(false);
    expect(needsMotionEngine({ scroll: 'parallax-slow' })).toBe(false);
    expect(needsMotionEngine({ stagger: 'none' })).toBe(false);
  });

  it('asks for the engine only for pinning and for a real cascade', () => {
    expect(needsMotionEngine({ scroll: 'pin' })).toBe(true);
    expect(needsMotionEngine({ stagger: 'normal' })).toBe(true);
  });

  it('loads a usable component when it is genuinely asked for', async () => {
    const Stage = await loadMotionStage();

    expect(typeof Stage).toBe('function');
  });
});
