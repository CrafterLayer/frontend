import { describe, expect, it } from 'vitest';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import { createCraftkitAiSkillRegistry } from '../skills/builtins';
import { CRAFTKIT_DEFAULT_SKILLS } from '../skills/defaults';
import { serializeTreeMarkup } from '../plan/tree-markup';
import { CAFE_PHOTO, fixtureKernel } from '../tools/agent/agent-tools.fixtures';
import type { AiPlan } from '../types';
import { lessonOf } from './build-lessons';
import { runAiAgent } from './run-agent';

describe('screen redesign through the actual generation/application boundary', () => {
  it('delivers composition freedom, applies a target rewrite and restores everything with one Undo', async () => {
    const kernel = fixtureKernel();
    const before = kernel.getDocument();
    let contextText = '';
    const plan: AiPlan = {
      rationale: 'Use a compact workspace beside the retained content.',
      commands: [
        {
          command: 'setProp',
          args: {
            id: 'r-hero',
            key: 'tree',
            value: `<section id='hero' class='ck-workspace'><aside><nav aria-label='Workspace'><a href='#menu'>See the menu</a></nav></aside><div><h1>Fresh coffee daily</h1><p>Roasted every morning.</p><img src='${CAFE_PHOTO}' alt='Coffee'/></div></section>`,
          },
        },
        {
          command: 'setProp',
          args: {
            id: 'r-hero',
            key: 'css',
            value:
              '.ck-workspace{display:grid;grid-template-columns:10rem minmax(0,1fr);gap:2rem}.ck-workspace img{max-width:100%}@media(max-width:600px){.ck-workspace{grid-template-columns:1fr}}',
          },
        },
      ],
    };
    const result = await runAiAgent({
      runId: 'screen-redesign',
      clock: fixedClock(1),
      kernel,
      request:
        'Redesign the selected region as a compact workspace; change its layout while retaining its supplied content and destination.',
      selection: ['r-hero'],
      directEdits: false,
      apply: 'auto',
      skillRegistry: createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS),
      validationPorts: { clock: fixedClock(2), ids: seededIds('screen-redesign') },
      provider: {
        propose: (_request, context) => {
          contextText = context.fragments.map((fragment) => fragment.body).join('\n');
          return Promise.resolve(plan);
        },
      },
    });
    expect(result.status).toBe('applied');
    expect(contextText).toContain('explicit redesign/recomposition may reorder or replace');
    expect(contextText).toContain('selected span never grants page-wide scope');
    expect(contextText).not.toContain('RESTYLE an existing region with editTree, never a rewrite');
    const after = kernel.getDocument();
    expect(serializeTreeMarkup(after.nodes['r-hero']?.props['tree'])).toContain('<aside>');
    expect(after.nodes['r-hero']?.props['css']).toContain('grid-template-columns');
    for (const [id, node] of Object.entries(before.nodes))
      if (id !== 'r-hero') expect(after.nodes[id]).toEqual(node);
    expect(kernel.transactions()).toHaveLength(1);
    expect(kernel.undo()).toBe(true);
    expect(kernel.getDocument()).toEqual(before);
  });

  it('does not let repair lessons restore palette/font ceilings or invented missing facts', () => {
    const font = lessonOf({ code: 'foreign-font', message: 'Invalid extra face' })?.text ?? '';
    expect(font).toContain('verified extra faces');
    expect(font).toContain('legacy/hybrid');
    const contrast = lessonOf({ code: 'contrast', message: 'Unreadable text' })?.text ?? '';
    expect(contrast).toContain('actual ground');
    expect(contrast).toContain('preserving');
    expect(lessonOf({ code: 'placeholder-left', message: 'Missing fact' })?.text).toContain(
      'never invent',
    );
  });
});
