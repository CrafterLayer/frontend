import { describe, expect, it } from 'vitest';

import type { AiPromptEnhanceInput } from '../types';
import { AiTaskUnsupportedError, createRemoteAiPlanProvider } from './remote-provider';

/*
  The enhancer's client half (contract 2026-09-28): POST <origin>/v1/prompt/enhance
  with the same bearer as /plan, its own short deadline, and an answer held
  to the contract's limits before any UI sees it.
*/

const ENDPOINT = 'https://assistant.example.test/plan';
const ENHANCE_URL = 'https://assistant.example.test/v1/prompt/enhance';

function input(overrides: Partial<AiPromptEnhanceInput> = {}): AiPromptEnhanceInput {
  return {
    text: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
    locale: 'ar',
    intent: { kind: 'edit', confidence: 0.4 },
    page: { empty: false, sections: ['Hero', 'Menu'] },
    selection: 'Hero',
    answers: [],
    ...overrides,
  };
}

const ANSWER = {
  version: 1,
  enhanced: 'اربط زر «اطلب الآن» في قسم البطل بقسم القائمة في الصفحة نفسها.',
  understood: 'تريد ربط الزر بقسم في الصفحة.',
  changes: ['صححت «ال صفحه» إلى «الصفحة»'],
  questions: [],
  language: 'ar',
} as const;

interface RecordedCall {
  readonly input: string;
  readonly init: RequestInit;
  readonly body: unknown;
}

function fakeFetch(respond: (call: RecordedCall) => Response | Promise<Response>) {
  const calls: RecordedCall[] = [];
  const fetchImpl = (target: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (typeof target !== 'string' || typeof init?.body !== 'string') {
      throw new Error('The provider must POST a JSON string to a string URL.');
    }
    const call: RecordedCall = { input: target, init, body: JSON.parse(init.body) as unknown };
    calls.push(call);
    return Promise.resolve(respond(call));
  };
  return { calls, fetchImpl };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createRemoteAiPlanProvider — enhancePrompt (/v1/prompt/enhance)', () => {
  it('POSTs the contract body to the enhance route on the endpoint origin, with the same bearer', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(ANSWER));
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: fetchImpl,
      headers: { authorization: 'Bearer secret', 'x-craftkit-ai-model': 'm' },
    });

    const answer = await provider.enhancePrompt(input());

    expect(answer).toEqual({
      enhanced: ANSWER.enhanced,
      understood: ANSWER.understood,
      changes: ANSWER.changes,
      questions: [],
      language: 'ar',
    });
    const [call] = calls;
    expect(call?.input).toBe(ENHANCE_URL);
    expect(call?.init.method).toBe('POST');
    expect(call?.init.redirect).toBe('error');
    expect(call?.init.credentials).toBe('omit');
    const headers = new Headers(call?.init.headers);
    expect(headers.get('authorization')).toBe('Bearer secret');
    expect(headers.get('accept')).toBe('application/json');
    expect(headers.get('content-type')).toBe('application/json');
    expect(call?.body).toEqual({
      version: 1,
      text: 'هل يمكنك تربط ال صفحه هاي داخل عليها',
      locale: 'ar',
      intent: { kind: 'edit', confidence: 0.4 },
      page: { empty: false, sections: ['Hero', 'Menu'] },
      selection: 'Hero',
      answers: [],
    });
  });

  it('drops the endpoint path: an endpoint at "/" and one on a loopback port both reach the route', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(ANSWER));
    await createRemoteAiPlanProvider({
      endpoint: 'http://localhost:8787/plan',
      allowInsecureHttp: true,
      fetch: fetchImpl,
    }).enhancePrompt(input());
    await createRemoteAiPlanProvider({
      endpoint: 'https://assistant.example.test/',
      fetch: fetchImpl,
    }).enhancePrompt(input());

    expect(calls.map(({ input: target }) => target)).toEqual([
      'http://localhost:8787/v1/prompt/enhance',
      ENHANCE_URL,
    ]);
  });

  it('sends at most 20 section labels, and the answers as question/answer pairs', async () => {
    const { calls, fetchImpl } = fakeFetch(() => jsonResponse(ANSWER));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });
    const sections = Array.from({ length: 25 }, (_, index) => `Section ${String(index + 1)}`);

    await provider.enhancePrompt(
      input({
        intent: null,
        selection: null,
        page: { empty: false, sections },
        answers: [{ question: 'ما نوع النشاط؟', answer: 'مقهى' }],
      }),
    );

    const body = calls[0]?.body as {
      page: { sections: string[] };
      intent: unknown;
      selection: unknown;
      answers: unknown;
    };
    expect(body.page.sections).toEqual(sections.slice(0, 20));
    expect(body.intent).toBeNull();
    expect(body.selection).toBeNull();
    expect(body.answers).toEqual([{ question: 'ما نوع النشاط؟', answer: 'مقهى' }]);
  });

  it('holds an answer to the contract: ≤5 changes, ≤3 questions of ≤4 choices, blanks dropped', async () => {
    const { fetchImpl } = fakeFetch(() =>
      jsonResponse({
        version: 1,
        enhanced: '  Build a page for a café in Amman.  ',
        understood: '  A café\n page. ',
        changes: ['a', ' ', 'b', 'c', 'd', 'e', 'f', 'a'],
        questions: [
          { id: 'q1', text: 'Which city?', choices: ['Amman', 'Irbid', 'Zarqa', 'Aqaba', 'Salt'] },
          { id: 'q1', text: 'Menu?', choices: ['Yes', 'No'] },
          { text: '  ' },
          { id: 'q3', text: 'Tone?', choices: [] },
          { id: 'q4', text: 'Too many?', choices: ['x', 'y'] },
        ],
      }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    const answer = await provider.enhancePrompt(input({ text: 'build page cafe amman', locale: 'en' }));

    expect(answer.enhanced).toBe('Build a page for a café in Amman.');
    expect(answer.understood).toBe('A café page.');
    expect(answer.changes).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(answer.questions).toEqual([
      { id: 'q1', text: 'Which city?', choices: ['Amman', 'Irbid', 'Zarqa', 'Aqaba'] },
      // A repeated id is re-keyed by position, so the UI can key answers by it.
      { id: 'q2', text: 'Menu?', choices: ['Yes', 'No'] },
      { id: 'q3', text: 'Tone?', choices: [] },
    ]);
    // No `language` in the answer: the rewrite's own script decides.
    expect(answer.language).toBe('en');
  });

  it('refuses an answer without a rewrite as invalid output', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ version: 1, enhanced: '   ' }));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.enhancePrompt(input())).rejects.toMatchObject({
      code: 'invalid-output',
    });
  });

  it('reports a server without the route as the 404 it answered — terminal, not retryable', async () => {
    const { fetchImpl } = fakeFetch(() => jsonResponse({ error: 'Endpoint not found.' }, 404));
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.enhancePrompt(input())).rejects.toMatchObject({
      code: 'http-status',
      status: 404,
      retryable: false,
    });
  });

  it('reads an ordinary plan as a server that answers every POST as /plan, and stops asking it', async () => {
    const { calls, fetchImpl } = fakeFetch(() =>
      jsonResponse({ rationale: 'Added a hero.', commands: [] }),
    );
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: fetchImpl });

    await expect(provider.enhancePrompt(input())).rejects.toMatchObject({
      task: 'prompt-enhance',
    });
    await expect(provider.enhancePrompt(input())).rejects.toBeInstanceOf(AiTaskUnsupportedError);
    expect(calls).toHaveLength(1);
  });

  it('gives up on its own deadline — 45 s by default, never the plan deadline', async () => {
    let seen: AbortSignal | undefined;
    const hanging = (_target: string | URL | Request, init?: RequestInit): Promise<Response> => {
      seen = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    };
    const provider = createRemoteAiPlanProvider({
      endpoint: ENDPOINT,
      fetch: hanging,
      timeoutMs: 660_000,
      enhanceTimeoutMs: 20,
    });

    await expect(provider.enhancePrompt(input())).rejects.toMatchObject({
      code: 'timeout',
      message: 'The assistant server timed out after 20ms.',
    });
    expect(seen?.aborted).toBe(true);
    expect(() =>
      createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: hanging, enhanceTimeoutMs: 0 }),
    ).toThrow(RangeError);
  });

  it('stops for real when the caller aborts, as the platform AbortError', async () => {
    const controller = new AbortController();
    const hanging = (_target: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    const provider = createRemoteAiPlanProvider({ endpoint: ENDPOINT, fetch: hanging });

    const pending = provider.enhancePrompt(input(), { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
