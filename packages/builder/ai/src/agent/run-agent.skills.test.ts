import { describe, expect, it } from 'vitest';

import { createBuilder } from '@craftkit/builder-core';
import {
  fixedClock,
  fixtureBlocks,
  landingFixture,
  seededIds,
} from '@craftkit/builder-core/testing';

import { createAiSkillRegistry } from '../skills';
import type { AiPlan } from '../types';
import { runAiAgent } from './index';

/*
  `autoSkills: false` — a run whose request text is not the person's own ask.

  A build's section writer carries the whole page request "for subject
  matter", and matching skills on those words handed every writer the
  page-level skills (agent-audit.md P1-12, 2026-09-28). The switch leaves the
  explicitly selected skills, the always-on ones and their dependencies.
*/

const plan: AiPlan = {
  rationale: 'Update the selected hero.',
  commands: [{ command: 'setProp', args: { id: 'hero1', key: 'heading', value: 'Checked' } }],
};

function registry() {
  return createAiSkillRegistry([
    {
      schemaVersion: 1,
      id: 'craftkit.hero-copy',
      name: 'Hero copy',
      description: 'Improve selected hero copy.',
      version: '1.0.0',
      instructions: 'Keep the hero heading concise.',
      activation: { mode: 'auto', keywords: ['hero'], selectedBlockTypes: ['hero'] },
    },
    {
      schemaVersion: 1,
      id: 'craftkit.house-rules',
      name: 'House rules',
      description: 'Always on.',
      version: '1.0.0',
      instructions: 'Be kind.',
      activation: { mode: 'always' },
    },
  ]);
}

function run(options: { autoSkills?: boolean; selectedSkillIds?: readonly string[] }) {
  return runAiAgent({
    runId: 'skills',
    clock: fixedClock(0),
    kernel: createBuilder({
      document: landingFixture(),
      extensions: [fixtureBlocks],
      ports: { clock: fixedClock(1), ids: seededIds('skills') },
    }),
    provider: { propose: () => Promise.resolve(plan) },
    request: 'Improve this hero',
    selection: ['hero1'],
    validationPorts: { clock: fixedClock(2), ids: seededIds('skills-ports') },
    skillRegistry: registry(),
    apply: 'never',
    ...options,
  });
}

describe('runAiAgent — autoSkills', () => {
  it('matches skills on the request and the selection by default', async () => {
    const result = await run({});
    expect(result.proposal.skillActivations.map(({ id, reason }) => `${id}:${reason}`)).toEqual([
      'craftkit.house-rules:always',
      'craftkit.hero-copy:auto',
    ]);
  });

  it('activates nothing on its own when auto matching is off', async () => {
    const result = await run({ autoSkills: false });
    expect(result.proposal.skillActivations.map(({ id, reason }) => `${id}:${reason}`)).toEqual([
      'craftkit.house-rules:always',
    ]);
  });

  it('still honours an explicit selection when auto matching is off', async () => {
    const result = await run({ autoSkills: false, selectedSkillIds: ['craftkit.hero-copy'] });
    expect(result.proposal.skillActivations.map(({ id, reason }) => `${id}:${reason}`)).toEqual([
      'craftkit.hero-copy:explicit',
      'craftkit.house-rules:always',
    ]);
  });
});
