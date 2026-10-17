/**
 * Why a request did not read the prompt cache (2026-10-13). Ours to prove: a request that
 * reads the cache in full says nothing; one that writes is named by the first thing that
 * differs from the previous request of its kind and settings — rules, catalog, skills, then
 * the history — or as new settings, the first of its kind, or an entry past its lifetime; on
 * `api:` slugs the request asks the API, whose answer wins and is narrowed to the block that
 * changed; a refused beta falls back to the local comparison, in the call itself.
 */
import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { createCacheDoctor, isDiagnosisRefusal, type DoctorParams } from './cache-doctor';
import { proposePlan } from './claude';

const CC = { type: 'ephemeral', ttl: '1h' };

function params(
  overrides: Partial<Record<'rules' | 'catalog' | 'skills', string>> = {},
  extra: Partial<DoctorParams> = {},
): DoctorParams {
  return {
    model: 'api:claude-opus-5-5',
    output_config: { effort: 'low' },
    system: [
      { text: overrides.rules ?? 'You turn a request into a PLAN.', cache_control: CC },
      { text: `# Block catalog\n${overrides.catalog ?? '[]'}`, cache_control: CC },
      { text: `# Active skills\n${overrides.skills ?? 'design'}`, cache_control: CC },
    ],
    messages: [{ content: 'earlier' }, { content: 'now' }],
    ...extra,
  };
}

const wrote = (id: string, tokens = 1_000) => ({
  id,
  usage: { cache_read_input_tokens: 0, cache_creation_input_tokens: tokens },
});

function clock(start = 0) {
  let at = start;
  return { now: () => at, advance: (ms: number) => (at += ms) };
}

describe('the cache doctor', () => {
  it('says nothing when the cache was read in full, and names the first of its kind', () => {
    const doctor = createCacheDoctor({ apiDiagnosis: false });
    expect(doctor.visit(params()).done(wrote('m1'))).toEqual({
      reason: 'first',
      missedTokens: null,
      source: 'local',
    });
    const read = {
      id: 'm2',
      usage: { cache_read_input_tokens: 9_000, cache_creation_input_tokens: 0 },
    };
    expect(doctor.visit(params()).done(read)).toBeUndefined();
  });

  it('names the first block that changed, the settings before them and the history after', () => {
    const doctor = createCacheDoctor({ apiDiagnosis: false });
    doctor.visit(params()).done(wrote('m1'));
    expect(doctor.visit(params({ skills: 'game' })).done(wrote('m2'))?.reason).toBe('skills');
    expect(doctor.visit(params({ catalog: '[1]', skills: 'x' })).done(wrote('m3'))?.reason).toBe(
      'catalog',
    );
    const base = params({ catalog: '[1]', skills: 'x' });
    expect(
      doctor.visit({ ...base, output_config: { effort: 'high' } }).done(wrote('m4'))?.reason,
    ).toBe('settings');
    doctor.visit(base).done(wrote('m5'));
    const longer = { ...base, messages: [{ content: 'other' }, { content: 'now' }] };
    expect(doctor.visit(longer).done(wrote('m6'))?.reason).toBe('history');
    // A different rules text is another kind of request: its first.
    expect(doctor.visit(params({ rules: 'You edit.' })).done(wrote('m7'))?.reason).toBe('first');
  });

  it('compares a call with the last one under the same thinking and effort', () => {
    const doctor = createCacheDoctor();
    const scene = (skills: string) =>
      params({ skills }, { thinking: { type: 'adaptive' }, output_config: { effort: 'medium' } });
    doctor.visit(params()).done(wrote('msg_1')); // a section writer: thinking off
    expect(doctor.visit(scene('game')).done(wrote('msg_2'))?.reason).toBe('settings');
    doctor.visit(params()).done(wrote('msg_3'));
    // The next scene writer is compared with the last scene writer, not the section writer.
    const next = doctor.visit(scene('film'));
    expect(next.body).toEqual({ diagnostics: { previous_message_id: 'msg_2' } });
    expect(next.done(wrote('msg_4'))?.reason).toBe('skills');
  });

  it('names an entry past its lifetime', () => {
    const time = clock();
    const doctor = createCacheDoctor({ apiDiagnosis: false, now: time.now });
    doctor.visit(params()).done(wrote('m1'));
    time.advance(61 * 60 * 1000);
    expect(doctor.visit(params()).done(wrote('m2'))?.reason).toBe('expired');
  });

  it('asks the API on api: slugs only, naming the previous answer of the same kind', () => {
    const doctor = createCacheDoctor();
    const first = doctor.visit(params());
    expect(first.body).toEqual({ diagnostics: { previous_message_id: null } });
    expect(first.headers).toEqual({ 'anthropic-beta': 'cache-diagnosis-2026-04-07' });
    first.done(wrote('msg_1'));
    expect(doctor.visit(params()).body).toEqual({ diagnostics: { previous_message_id: 'msg_1' } });
    const openrouter = doctor.visit(params({}, { model: 'anthropic/claude-opus-5' }));
    expect(openrouter.body).toEqual({});
    expect(openrouter.headers).toEqual({});
  });

  it('takes the API’s verdict, narrowed to the block the local comparison found', () => {
    const doctor = createCacheDoctor();
    doctor.visit(params()).done(wrote('msg_1'));
    const system = {
      ...wrote('msg_2'),
      diagnostics: {
        cache_miss_reason: { type: 'system_changed', cache_missed_input_tokens: 4_321 },
      },
    };
    expect(doctor.visit(params({ skills: 'game' })).done(system)).toEqual({
      reason: 'skills',
      missedTokens: 4_321,
      source: 'api',
    });
    const model = {
      ...wrote('msg_3'),
      diagnostics: {
        cache_miss_reason: { type: 'model_changed', cache_missed_input_tokens: 9_000 },
      },
    };
    expect(doctor.visit(params({ skills: 'game' })).done(model)).toMatchObject({
      reason: 'model',
      source: 'api',
    });
    // A pending or unknown diagnosis leaves the local answer.
    const pending = { ...wrote('msg_4'), diagnostics: { cache_miss_reason: null } };
    expect(doctor.visit(params({ skills: 'film' })).done(pending)).toMatchObject({
      reason: 'skills',
      source: 'local',
    });
  });

  it('knows a refused beta', () => {
    expect(
      isDiagnosisRefusal({ status: 400, message: 'diagnostics: Extra inputs are not permitted' }),
    ).toBe(true);
    expect(isDiagnosisRefusal({ status: 400, message: 'max_tokens: too large' })).toBe(false);
    expect(isDiagnosisRefusal({ status: 429, message: 'diagnostics' })).toBe(false);
  });
});

describe('a plan call with the doctor', () => {
  const CONTEXT = {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    outputContract: { version: 1, schema: { type: 'object' } },
  };
  const WIRE = {
    version: 1,
    request: 'add a hero',
    context: CONTEXT,
  } as unknown as AiPlanWireRequest;
  const ANSWER = {
    id: 'msg_ok',
    type: 'message',
    role: 'assistant',
    model: 'claude-opus-5-5',
    stop_reason: 'end_turn',
    content: [{ type: 'text', text: JSON.stringify({ rationale: 'ok', commands: [] }) }],
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 800,
    },
  };

  it('reports why it wrote, and drops a refused beta for the retry and after', async () => {
    const sent: { body: Record<string, unknown>; headers: unknown }[] = [];
    const client = {
      messages: {
        stream: (body: Record<string, unknown>, options: { headers?: unknown } = {}) => {
          sent.push({ body, headers: options.headers });
          const refused = sent.length === 1;
          return {
            on: () => undefined,
            finalMessage: () =>
              refused
                ? Promise.reject(
                    Object.assign(new Error('diagnostics: not permitted'), { status: 400 }),
                  )
                : Promise.resolve(ANSWER),
          };
        },
      },
    } as unknown as Anthropic;
    const doctor = createCacheDoctor();
    const usages: unknown[] = [];
    const logs: string[] = [];
    await proposePlan(WIRE, {
      client,
      model: 'api:claude-opus-5-5',
      cacheDoctor: doctor,
      onUsage: (usage) => usages.push(usage),
      onLog: (line) => logs.push(line),
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]?.body).toHaveProperty('diagnostics');
    expect(sent[1]?.body).not.toHaveProperty('diagnostics');
    expect(doctor.apiDiagnosis).toBe(false);
    expect(usages).toEqual([
      expect.objectContaining({
        cacheWriteTokens: 800,
        cacheMiss: { reason: 'first', missedTokens: null, source: 'local' },
      }),
    ]);
    expect(logs.some((line) => line.startsWith('cache: read 0, wrote 800 — first'))).toBe(true);
  });
});
