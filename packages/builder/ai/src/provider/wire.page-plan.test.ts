import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { validatePagePlan } from '../agent/page-plan';
import type { AssembledAiContext } from '../types';
import {
  AI_PLAN_WIRE_VERSION,
  estimateAiPlanWireRequestTokens,
  readAiPagePlanWireResponse,
  type AiPlanWireRequest,
} from './wire';

/*
  The page-plan task rides the EXISTING /plan endpoint, additively: a request
  without `task` is today's request byte for byte, and a server that has never
  heard of page plans answers it with an ordinary plan — which the client must
  recognise as "unsupported", not mistake for garbage or for a page plan.
*/

function context(): AssembledAiContext {
  return {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    templates: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [],
    outputContract: { version: 1, schema: { type: 'object' } },
    omissions: [],
  };
}

/** The JSON the server owner copies: it must pass the client's own validator, or the doc lies. */
function documentedExample(): unknown {
  const source = readFileSync(new URL('./wire.ts', import.meta.url), 'utf8');
  const start = source.indexOf('BEGIN PAGE PLAN WIRE EXAMPLE');
  const end = source.indexOf('END PAGE PLAN WIRE EXAMPLE');
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  const body = source
    .slice(source.indexOf('\n', start) + 1, source.lastIndexOf('\n', end))
    .split('\n')
    .map((line) => line.replace(/^\s*\*( |$)/u, ''))
    .join('\n');
  return JSON.parse(body) as unknown;
}

describe('the page-plan task on the plan wire', () => {
  it('leaves a request without a task exactly as it was, and counts the new fields when present', () => {
    const plain: AiPlanWireRequest = {
      version: AI_PLAN_WIRE_VERSION,
      request: 'Build a page for my café',
      context: context(),
    };
    const asked: AiPlanWireRequest = { ...plain, task: 'page-plan' };
    const repair: AiPlanWireRequest = {
      ...asked,
      pagePlanAttempt: {
        pagePlan: { title: 'x' },
        issues: [{ path: 'tokens', message: 'Write tokens as an object with bg, surface, ink…' }],
      },
    };
    expect(Object.keys(plain)).not.toContain('task');
    expect(estimateAiPlanWireRequestTokens(asked)).toBeGreaterThan(
      estimateAiPlanWireRequestTokens(plain),
    );
    expect(estimateAiPlanWireRequestTokens(repair)).toBeGreaterThan(
      estimateAiPlanWireRequestTokens(asked),
    );
  });

  it('documents a response the client reads and its validator accepts', () => {
    const reading = readAiPagePlanWireResponse(documentedExample());
    expect(reading.kind).toBe('page-plan');
    if (reading.kind !== 'page-plan') return;
    expect(reading.rationale).toMatch(/\S/u);
    const result = validatePagePlan(reading.pagePlan);
    expect(result.ok ? [] : result.issues).toEqual([]);
  });

  it('reads a refusal, an invalid-output report and a wrong version as what they are', () => {
    expect(readAiPagePlanWireResponse({ version: 1, refusal: 'Not a page request.' })).toEqual({
      kind: 'refusal',
      message: 'Not a page request.',
    });
    expect(
      readAiPagePlanWireResponse({ version: 1, invalidOutput: { message: '  cut   off ' } }),
    ).toEqual({ kind: 'invalid-output', message: 'cut off' });
    expect(readAiPagePlanWireResponse({ version: 2, pagePlan: {} }).kind).toBe('invalid-output');
    expect(readAiPagePlanWireResponse('<html>').kind).toBe('invalid-output');
    expect(readAiPagePlanWireResponse({ version: 1, pagePlan: [] }).kind).toBe('invalid-output');
  });

  it('recognises an older server that answered the page-plan task with an ordinary plan', () => {
    const reading = readAiPagePlanWireResponse({ rationale: 'Added a hero.', commands: [] });
    expect(reading.kind).toBe('unsupported');
  });
});
