import { describe, expect, it } from 'vitest';
import type { AiPlan } from '../types';
import { guardFill } from './fill-guard';

describe('scene settings keep the section ownership and free-code boundary', () => {
  const task = { id: 'hero', title: 'Hero' };
  const plan: AiPlan = {
    rationale: 'Scene settings',
    commands: [
      { command: 'setProp', args: { id: 'hero', key: 'js', value: 'scene code' } },
      { command: 'setProp', args: { id: 'hero', key: 'jsMeta', value: {} } },
      { command: 'setProp', args: { id: 'hero', key: 'jsParams', value: { speed: 0.5 } } },
      { command: 'setProp', args: { id: 'other', key: 'jsParams', value: { speed: 1 } } },
      { command: 'setProp', args: { id: 'root', key: 'pageCss', value: 'hijack' } },
    ],
  };

  it('keeps same-region scene data and drops other regions and root writes', () => {
    const result = guardFill(plan, task, true);
    expect(result.keys).toEqual(['js', 'jsMeta', 'jsParams']);
    expect(result.commands).toEqual(plan.commands.slice(0, 3));
    expect(result.outOfScope).toEqual([
      expect.objectContaining({ id: 'other', key: 'jsParams' }),
      expect.objectContaining({ id: 'root', key: 'pageCss' }),
    ]);
  });

  it('drops all scene code and settings with free code off', () => {
    expect(guardFill(plan, task).commands).toEqual([]);
    expect(guardFill(plan, task).outOfScope).toHaveLength(5);
  });
});
