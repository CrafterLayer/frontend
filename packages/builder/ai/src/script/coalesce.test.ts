import { describe, expect, it } from 'vitest';

import type { BuilderKernel } from '@craftkit/builder-core';

import { validateAiPlan } from '../plan/validate-plan';
import { asTreeRoot } from '../style-tools/tree-steps';
import { expandAgentTools } from '../tools/agent/expand';
import type { AgentToolStep } from '../tools/agent/types';
import { coalesceScriptSteps, scriptDefaultTitle } from './coalesce';
import { buttonsKernel, policyOf, scriptPorts } from './script.fixtures';

function live(kernel: BuilderKernel) {
  return (id: string, key: string): unknown => kernel.getDocument().nodes[id]?.props[key];
}

/** element.style borderRadius full on every ck-btn of the 14-button page, expanded to kernel steps. */
function roundEveryButton(kernel: BuilderKernel): readonly AgentToolStep[] {
  const regions: Readonly<Record<string, readonly (readonly number[])[]>> = {
    'r-a': [1, 2, 3, 4, 5].map((at) => [0, at]),
    'r-b': [0, 1, 2, 3, 4].map((at) => [0, 1, at]),
    'r-c': [1, 2, 3, 4].map((at) => [0, at]),
  };
  const tools = Object.entries(regions).flatMap(([id, paths]) =>
    paths.map((path) => ({
      command: 'tool',
      args: { name: 'element.style', input: { id, path: [...path], styles: [{ property: 'borderRadius', value: 'full' }] } },
    })),
  );
  const expanded = expandAgentTools({ rationale: 'round', commands: tools }, kernel);
  expect(expanded.issues).toEqual([]);
  return (expanded.plan as { commands: AgentToolStep[] }).commands;
}

describe('coalesceScriptSteps', () => {
  it('folds 14 button styles over 3 regions into 3 setProps that pass the door', () => {
    const kernel = buttonsKernel();
    const steps = roundEveryButton(kernel);
    expect(steps).toHaveLength(14);
    const folded = coalesceScriptSteps(steps, live(kernel), { title: 'Round every button' });
    expect(folded.ok).toBe(true);
    if (!folded.ok) return;
    expect(folded.steps.map(({ command, args }) => [command, args['id'], args['key']])).toEqual([
      ['setProp', 'r-a', 'tree'],
      ['setProp', 'r-b', 'tree'],
      ['setProp', 'r-c', 'tree'],
    ]);
    expect(folded.steps[0]?.title).toBe('Round every button');
    expect(JSON.stringify(folded.steps).match(/rounded-full/gu)).toHaveLength(14);
    const judged = validateAiPlan({ rationale: 'round', commands: folded.steps }, kernel, scriptPorts(), policyOf(kernel));
    expect(judged.ok).toBe(true);
  });

  it('folds tree commands into the same region write as the setProps around them', () => {
    const kernel = buttonsKernel();
    const style = (at: number) => ({
      command: 'tool',
      args: { name: 'element.style', input: { id: 'r-a', path: [0, at], styles: [{ property: 'borderRadius', value: 'full' }] } },
    });
    // Expanded together, as expand-scripts does: a later tool reads the tree an earlier patch left.
    const expanded = expandAgentTools(
      {
        rationale: 'mix',
        commands: [
          { command: 'patchTreeNode', args: { id: 'r-a', path: [0, 0], set: { text: 'Hello' } } },
          style(1),
          style(2),
          { command: 'patchTreeNode', args: { id: 'r-a', path: [0, 1], set: { text: 'First' } } },
        ],
      },
      kernel,
    );
    const steps = (expanded.plan as { commands: AgentToolStep[] }).commands;
    expect(steps.map(({ command }) => command)).toEqual(['patchTreeNode', 'patchTreeNode', 'patchTreeNode', 'patchTreeNode']);
    const folded = coalesceScriptSteps(steps, live(kernel));
    expect(folded.ok && folded.steps.length).toBe(1);
    if (!folded.ok) return;
    const tree = asTreeRoot(folded.steps[0]?.args['value']);
    const text = JSON.stringify(tree);
    expect(text).toContain('"text":"Hello"');
    expect(text).toContain('"text":"First"');
    expect(text.match(/rounded-full/gu)).toHaveLength(2);
  });

  it('keeps structural steps in order and writes each prop at its last write', () => {
    const steps: AgentToolStep[] = [
      { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'One' } },
      { command: 'insertNode', args: { type: 'customCode', parentId: 'root', props: { label: 'New' } } },
      { command: 'setProp', args: { id: 'n-1', key: 'label', value: 'Fresh' } },
      { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'Two' } },
      { command: 'removeNode', args: { id: 'r-c' } },
    ];
    const folded = coalesceScriptSteps(steps, () => undefined);
    expect(folded.ok && folded.steps.map(({ command, args }) => [command, args['id'] ?? args['type'], args['value']])).toEqual([
      ['insertNode', 'customCode', undefined],
      ['setProp', 'n-1', 'Fresh'],
      ['setProp', 'r-a', 'Two'],
      ['removeNode', 'r-c', undefined],
    ]);
  });

  it('drops a write whose final value is the value before the script', () => {
    const kernel = buttonsKernel();
    const steps: AgentToolStep[] = [
      { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'Changed' } },
      { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'Hero' } },
      { command: 'setProp', args: { id: 'r-b', key: 'label', value: 'Deals' } },
    ];
    const folded = coalesceScriptSteps(steps, live(kernel));
    expect(folded.ok && folded.steps).toEqual([{ command: 'setProp', args: { id: 'r-b', key: 'label', value: 'Deals' } }]);
  });

  it('reports the step a refused tree command came from', () => {
    const kernel = buttonsKernel();
    const folded = coalesceScriptSteps(
      [
        { command: 'setProp', args: { id: 'r-a', key: 'label', value: 'x' } },
        { command: 'patchTreeNode', args: { id: 'r-a', path: [0, 40], set: { text: 'x' } } },
      ],
      live(kernel),
    );
    expect(folded.ok).toBe(false);
    expect(!folded.ok && folded.step).toBe(1);
  });

  it('names the default history label in the page language', () => {
    expect(scriptDefaultTitle(14, 'en')).toBe('Script: 14 edits');
    expect(scriptDefaultTitle(1, 'en')).toBe('Script: 1 edit');
    expect(scriptDefaultTitle(3, 'ar')).toBe('سكربت: 3 تعديل');
  });
});
