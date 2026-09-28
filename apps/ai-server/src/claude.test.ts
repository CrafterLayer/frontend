import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';

import type { AiPlanWireRequest } from '@craftkit/builder/wire';

import { proposePagePlan, proposePlan } from './claude';
import { createOpenRouterClient, type OpenRouterFetch } from './openrouter-client';
import { PAGE_PLAN_ANSWER_SCHEMA, PAGE_PLAN_EXAMPLE } from './plan-shape';
import { PAGE_PLAN_CONTRACT_MARK } from './prompt';

/**
 * `proposePlan` against a faked backend: what it ASKS for, and what it makes
 * of an answer. The handler tests cover the wire around it; these cover the
 * two things only this file decides — the request's own parameters, and the
 * one judged salvage every backend's answer goes through.
 */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rationale: { type: 'string' },
    commands: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { command: { type: 'string' }, args: {}, title: { type: 'string' } },
      },
    },
    followUp: { type: 'string' },
  },
};

const REQUEST = {
  version: 1,
  request: 'Fill the drinks section',
  context: {
    fragments: [],
    totalTokens: 0,
    blocks: [],
    document: { schemaVersion: 1, surface: 'site', dir: 'ltr', rootId: 'root', nodes: [] },
    selection: { ids: [] },
    commands: [
      {
        name: 'setProp',
        argsSchema: {
          type: 'object',
          additionalProperties: false,
          properties: { id: { type: 'string' }, key: { type: 'string' }, value: {} },
        },
      },
    ],
    outputContract: { version: 1, schema: SCHEMA },
  },
} as unknown as AiPlanWireRequest;

const PLAN = {
  rationale: 'Fill the drinks section.',
  commands: [
    { command: 'setProp', args: { id: 'pg-1', key: 'title', value: 'Drinks' }, title: 'First' },
    {
      command: 'setProp',
      args: {
        id: 'pg-2',
        key: 'tree',
        value: {
          kind: 'root',
          children: [
            {
              kind: 'element',
              tag: 'section',
              children: [
                {
                  kind: 'element',
                  tag: 'ul',
                  children: [
                    { kind: 'element', tag: 'li', children: [{ kind: 'text', text: 'Espresso' }] },
                  ],
                },
              ],
            },
          ],
        },
      },
      title: 'Second',
    },
  ],
};

interface Recorded {
  readonly params: Record<string, unknown>;
  readonly options: { readonly headers?: Record<string, string> } | undefined;
}

/** A client that records what `proposePlan` asked for and answers with `PLAN`. */
function recordingClient(): { client: Anthropic; seen: Recorded[] } {
  const seen: Recorded[] = [];
  const client = {
    messages: {
      stream: (params: Record<string, unknown>, options?: Recorded['options']) => {
        seen.push({ params, options });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text: JSON.stringify(PLAN) }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, seen };
}

describe('proposePlan request', () => {
  /*
    The section writer's budget used to travel only as a private header, which
    the OpenRouter and CLI shims read and the real Messages API ignores — so on
    the default `sdk` backend, CRAFTKIT_AI_SECTION_EFFORT=low changed nothing.
  */
  it('asks the Messages API for the call budget as output_config.effort', async () => {
    const { client, seen } = recordingClient();

    const outcome = await proposePlan(REQUEST, { client, effort: 'low' });

    expect(outcome.kind).toBe('plan');
    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: SCHEMA },
      effort: 'low',
    });
    // Still on the header too, for the CLI shim that reads nothing else.
    expect(seen[0]?.options?.headers).toEqual({ 'x-craftkit-internal-reasoning-effort': 'low' });
  });

  it("leaves the budget to the backend's default when the call names none", async () => {
    const { client, seen } = recordingClient();

    await proposePlan(REQUEST, { client });

    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: SCHEMA },
    });
    expect(seen[0]?.options?.headers).toBeUndefined();
  });
});

describe('proposePlan answer', () => {
  /*
    Measured through the real OpenRouter shim: the last `}` of the second
    command's tree dropped. Repaired without a judge, `title` lands inside
    `args` and the strict argument schema refuses the plan; repaired with the
    request's shape judge, it comes back exactly as meant.
  */
  it("repairs an OpenRouter answer with the plan's shape judge and logs the model's own words", async () => {
    const good = JSON.stringify(PLAN);
    const end = good.indexOf(',"title":"Second"');
    const written = `${good.slice(0, end - 1)}${good.slice(end)}`;
    expect(() => JSON.parse(written) as unknown).toThrow();
    const frame = {
      choices: [{ index: 0, delta: { content: written }, finish_reason: 'stop' }],
    };
    const fetch = vi.fn<OpenRouterFetch>(() =>
      Promise.resolve(
        new Response(`data: ${JSON.stringify(frame)}\n\ndata: [DONE]\n\n`, {
          status: 200,
          headers: { 'content-type': 'text/event-stream' },
        }),
      ),
    );
    const answers: string[] = [];

    const outcome = await proposePlan(REQUEST, {
      client: createOpenRouterClient({ apiKey: 'k', model: 'vendor/model', fetch }),
      onAnswer: (text) => {
        answers.push(text);
      },
    });

    expect(answers).toEqual([written]);
    expect(outcome).toMatchObject({ kind: 'plan', plan: PLAN });
  });
});

describe('proposePagePlan', () => {
  const PAGE_PLAN_REQUEST = {
    ...REQUEST,
    request: 'Build a page for my roastery',
    task: 'page-plan',
  } as unknown as AiPlanWireRequest;
  const ANSWER = { rationale: PAGE_PLAN_EXAMPLE.rationale, pagePlan: PAGE_PLAN_EXAMPLE.pagePlan };

  function answeringClient(text: string): { client: Anthropic; seen: Recorded[] } {
    const seen: Recorded[] = [];
    const client = {
      messages: {
        stream: (params: Record<string, unknown>, options?: Recorded['options']) => {
          seen.push({ params, options });
          return {
            on: () => undefined,
            finalMessage: () =>
              Promise.resolve({
                stop_reason: 'end_turn',
                stop_details: null,
                content: [{ type: 'text', text }],
                usage: { input_tokens: 1, output_tokens: 1 },
              }),
          };
        },
      },
    } as unknown as Anthropic;
    return { client, seen };
  }

  /*
    The request's own outputContract is the COMMANDS plan's schema — the
    client assembles one context for both tasks. Decoding a page plan into it
    would force `commands` into the answer, so the page plan brings its own.
  */
  it("decodes into the page-plan answer schema, never the context's plan contract", async () => {
    const { client, seen } = answeringClient(JSON.stringify(ANSWER));

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, { client });

    expect(outcome).toMatchObject({ kind: 'page-plan', ...ANSWER });
    expect(seen[0]?.params['output_config']).toEqual({
      format: { type: 'json_schema', schema: PAGE_PLAN_ANSWER_SCHEMA },
    });
    expect(seen[0]?.params['thinking']).toEqual({ type: 'adaptive', display: 'summarized' });
    const system = seen[0]?.params['system'] as { text: string }[];
    expect(system[0]?.text).toContain(PAGE_PLAN_CONTRACT_MARK);
  });

  it('salvages a dropped closer before reading the page plan, and logs what the model wrote', async () => {
    const good = JSON.stringify(ANSWER);
    const cut = good.indexOf('},{"key":"menu"');
    const written = `${good.slice(0, cut)}${good.slice(cut + 1)}`;
    const answers: string[] = [];
    const { client } = answeringClient(written);

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, {
      client,
      onAnswer: (text) => {
        answers.push(text);
      },
    });

    expect(answers).toEqual([written]);
    expect(outcome).toMatchObject({ kind: 'page-plan', ...ANSWER });
  });

  it('reads a non-JSON answer as invalid output that names the page plan', async () => {
    const { client } = answeringClient('I would design a warm café page.');

    const outcome = await proposePagePlan(PAGE_PLAN_REQUEST, { client });

    expect(outcome.kind).toBe('invalid-output');
    expect(outcome.kind === 'invalid-output' ? outcome.message : '').toMatch(/page plan/u);
  });
});

/*
  The live answers the verify round saved (scratchpad verify-ew2/server/r2-dump,
  cli:haiku on the build of 2026-09-28 06:45), verbatim: an Arabic Dubai car
  dealer whose accentInk is the shade name "red-400" — refused by the client's
  palette, a whole repair round — and whose phone is "+971 4 XXX XXXX"; and an
  English Dubai garage whose phone is "+971 4 XXXX XXXX".
*/
const LIVE_DEALER_AR = "{\"rationale\":\"صفحة معرض سيارات فاخرة مستعملة في دبي، بتصميم داكن فاخر وألوان حمراء مشرقة، مع خطوط Changa و IBM Plex Sans Arabic.\",\"pagePlan\":{\"intent\":\"new-page\",\"locale\":{\"lang\":\"ar\",\"dir\":\"rtl\"},\"title\":\"دبي لوكس موتورز - معرض سيارات فاخرة مستعملة\",\"description\":\"معرض متخصص في السيارات الفاخرة المستعملة بدبي، يوفر سيارات معتمدة مع خدمات تمويل وضمانات شاملة.\",\"tokens\":{\"bg\":\"neutral-950\",\"surface\":\"neutral-900\",\"ink\":\"neutral-50\",\"muted\":\"neutral-400\",\"accent\":\"red-600\",\"onAccent\":\"white\",\"accentInk\":\"red-400\",\"border\":\"#2a2a2a\",\"fontDisplay\":{\"family\":\"Changa\",\"weights\":[600,800]},\"fontBody\":{\"family\":\"IBM Plex Sans Arabic\",\"weights\":[400,500]},\"radius\":\"full\",\"signature\":\"السيارة بدون إطار على الخلفية الداكنة\",\"deckRowId\":\"auto\"},\"primaryCta\":{\"label\":\"احجز اختبار قيادة\",\"href\":\"#test-drive\"},\"nav\":[{\"label\":\"السيارات\",\"anchorId\":\"inventory\"},{\"label\":\"التمويل\",\"anchorId\":\"financing\"},{\"label\":\"اختبار القيادة\",\"anchorId\":\"test-drive\"}],\"sections\":[{\"key\":\"header\",\"role\":\"header\",\"title\":\"رأس الصفحة\",\"anchorId\":\"top\",\"purpose\":\"العلامة التجارية والتنقل الرئيسي.\"},{\"key\":\"hero\",\"role\":\"hero\",\"title\":\"سيارات فاخرة منتقاة\",\"anchorId\":\"hero\",\"purpose\":\"عرض أفخر السيارات المستعملة المتاحة مع دعوة للشراء.\",\"mustSay\":[\"سيارات معتمدة وآمنة\",\"ضمانات شاملة\"],\"mustNotRepeat\":[],\"variant\":\"overlay\",\"images\":[{\"subject\":\"car\",\"aspect\":\"landscape\",\"alt\":\"سيارة فاخرة مستعملة عالية الجودة\"}]},{\"key\":\"inventory\",\"role\":\"band\",\"title\":\"السيارات المتاحة\",\"anchorId\":\"inventory\",\"purpose\":\"قائمة بالسيارات الفاخرة مع الأسعار والمواصفات التفصيلية.\",\"mustSay\":[],\"mustNotRepeat\":[\"سيارات معتمدة وآمنة\"],\"variant\":\"listing\",\"images\":[{\"subject\":\"car\",\"aspect\":\"landscape\",\"alt\":\"مجموعة من السيارات الفاخرة المستعملة\"}]},{\"key\":\"financing\",\"role\":\"band\",\"title\":\"خطط التمويل والشراء\",\"anchorId\":\"financing\",\"purpose\":\"خطوات سهلة وسريعة لشراء السيارة بالتمويل.\",\"mustSay\":[],\"mustNotRepeat\":[],\"variant\":\"steps\"},{\"key\":\"test-drive\",\"role\":\"cta\",\"title\":\"احجز اختبار القيادة\",\"anchorId\":\"test-drive\",\"purpose\":\"طريقة واضحة لحجز اختبار قيادة للسيارة المختارة.\",\"variant\":\"contact\"},{\"key\":\"footer\",\"role\":\"footer\",\"title\":\"تذييل الصفحة\",\"anchorId\":\"footer\",\"purpose\":\"معلومات التواصل والعنوان وساعات العمل.\",\"variant\":\"footer\"}],\"facts\":[{\"key\":\"dealership-name\",\"sample\":\"دبي لوكس موتورز\",\"section\":\"header\"},{\"key\":\"phone\",\"sample\":\"+971 4 XXX XXXX\",\"section\":\"footer\"},{\"key\":\"address\",\"sample\":\"دبي، الإمارات العربية المتحدة\",\"section\":\"footer\"},{\"key\":\"warranty-years\",\"sample\":\"ضمان 3 سنوات على جميع السيارات\",\"section\":\"hero\"}]}}";
const LIVE_GARAGE_EN = "{\"rationale\":\"A professional, trustworthy landing page for a car repair garage in Dubai, featuring service categories, customer assurance, and easy booking.\",\"pagePlan\":{\"intent\":\"new-page\",\"locale\":{\"lang\":\"en\",\"dir\":\"ltr\"},\"title\":\"Premium Car Repair & Maintenance — Dubai\",\"description\":\"Expert car repair, maintenance, and diagnostics in Dubai. Fast service, certified mechanics, genuine parts.\",\"tokens\":{\"bg\":\"#ffffff\",\"surface\":\"#f5f5f4\",\"ink\":\"#1c1917\",\"muted\":\"#57534e\",\"accent\":\"#2563eb\",\"onAccent\":\"#ffffff\",\"accentInk\":\"#1e40af\",\"border\":\"#e7e5e4\",\"fontDisplay\":{\"family\":\"Outfit\",\"weights\":[600,700]},\"fontBody\":{\"family\":\"Outfit\",\"weights\":[400,500]},\"radius\":\"md\",\"signature\":\"The garage location and certified badge anchored in the footer.\"},\"primaryCta\":{\"label\":\"Book Service\",\"href\":\"#booking\"},\"nav\":[{\"label\":\"Services\",\"anchorId\":\"services\"},{\"label\":\"Why Us\",\"anchorId\":\"why-us\"},{\"label\":\"Book Service\",\"anchorId\":\"booking\"}],\"sections\":[{\"key\":\"header\",\"role\":\"header\",\"title\":\"Header\",\"anchorId\":\"top\",\"purpose\":\"Brand and navigation for the repair garage.\"},{\"key\":\"hero\",\"role\":\"hero\",\"title\":\"Expert Car Care in Dubai\",\"anchorId\":\"hero\",\"purpose\":\"Introduce the garage and its core promise of expert, fast, reliable service.\",\"mustSay\":[\"Professional mechanics\",\"Fast turnaround\",\"Genuine parts\"],\"mustNotRepeat\":[],\"variant\":\"split\",\"images\":[{\"subject\":\"car\",\"aspect\":\"landscape\",\"alt\":\"Professional car repair service in progress\"}]},{\"key\":\"services\",\"role\":\"band\",\"title\":\"Services\",\"anchorId\":\"services\",\"purpose\":\"Display the range of repair and maintenance services offered.\",\"variant\":\"grid\"},{\"key\":\"why-us\",\"role\":\"band\",\"title\":\"Why Choose Us\",\"anchorId\":\"why-us\",\"purpose\":\"Build trust with certifications, experience, and customer satisfaction metrics.\",\"mustSay\":[\"15+ years experience\",\"ASE certified mechanics\"],\"mustNotRepeat\":[\"Professional mechanics\"],\"variant\":\"stats\"},{\"key\":\"process\",\"role\":\"band\",\"title\":\"Our Process\",\"anchorId\":\"process\",\"purpose\":\"Show customers how the repair process works from drop-off to pickup.\",\"variant\":\"steps\"},{\"key\":\"booking\",\"role\":\"cta\",\"title\":\"Schedule Service\",\"anchorId\":\"booking\",\"purpose\":\"Clear call-to-action for booking an appointment or consultation.\",\"variant\":\"cta-split\"},{\"key\":\"footer\",\"role\":\"footer\",\"title\":\"Footer\",\"anchorId\":\"footer\",\"purpose\":\"Location, hours, phone, and contact information.\",\"variant\":\"footer\"}],\"facts\":[{\"key\":\"phone\",\"sample\":\"+971 4 XXXX XXXX\",\"section\":\"footer\"},{\"key\":\"address\",\"sample\":\"Al Baraha, Dubai, UAE\",\"section\":\"footer\"},{\"key\":\"experience-years\",\"sample\":\"15\",\"section\":\"why-us\"},{\"key\":\"mechanic-count\",\"sample\":\"8 certified mechanics\",\"section\":\"why-us\"}]}}";

describe('proposePagePlan repairs in code what the live plans got wrong', () => {
  function answering(text: string): Anthropic {
    return {
      messages: {
        stream: () => ({
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'end_turn',
              stop_details: null,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
        }),
      },
    } as unknown as Anthropic;
  }
  const request = {
    ...REQUEST,
    request: 'صفحة لمعرض سيارات فاخرة في دبي',
    task: 'page-plan',
  } as unknown as AiPlanWireRequest;

  interface Plan {
    readonly tokens: Record<string, unknown>;
    readonly facts: readonly { readonly key: string; readonly sample: string }[];
  }

  it('hands the dealer plan over with every shade as hex and a real-looking phone, and logs both', async () => {
    const logged: string[] = [];

    const outcome = await proposePagePlan(request, {
      client: answering(LIVE_DEALER_AR),
      onLog: (line) => {
        logged.push(line);
      },
    });

    expect(outcome.kind).toBe('page-plan');
    const plan = (outcome as { pagePlan: Plan }).pagePlan;
    expect(plan.tokens).toMatchObject({
      bg: '#0a0a0a',
      surface: '#171717',
      ink: '#fafafa',
      muted: '#a3a3a3',
      accent: '#dc2626',
      onAccent: '#ffffff',
      accentInk: '#f87171',
      border: '#2a2a2a',
    });
    expect(plan.facts.find((fact) => fact.key === 'phone')?.sample).toBe('+971 4 234 5678');
    expect(plan.facts.find((fact) => fact.key === 'dealership-name')?.sample).toBe(
      'دبي لوكس موتورز',
    );
    expect(logged).toHaveLength(1);
    expect(logged[0]).toContain('tokens.accentInk "red-400" → "#f87171"');
    expect(logged[0]).toContain('"+971 4 XXX XXXX" → "+971 4 234 5678"');
  });

  it('fills the garage phone in its own grouping, and leaves a clean hex plan alone', async () => {
    const logged: string[] = [];

    const outcome = await proposePagePlan(request, {
      client: answering(LIVE_GARAGE_EN),
      onLog: (line) => {
        logged.push(line);
      },
    });

    const plan = (outcome as { pagePlan: Plan }).pagePlan;
    expect(plan.facts[0]?.sample).toBe('+971 4 2345 6789');
    expect(plan.tokens['accentInk']).toBe('#1e40af');
    expect(logged).toEqual([
      'page plan repaired in code: pagePlan.facts[0].sample "+971 4 XXXX XXXX" → "+971 4 2345 6789"',
    ]);

    const clean = await proposePagePlan(request, {
      client: answering(JSON.stringify(ANSWER_OF_EXAMPLE)),
      onLog: (line) => {
        logged.push(line);
      },
    });
    expect(clean).toMatchObject({ kind: 'page-plan', ...ANSWER_OF_EXAMPLE });
    expect(logged).toHaveLength(1);
  });

  it("still restores the dealer plan's dropped closer, placeholder and all", async () => {
    // The hero section's own `}` dropped, on top of both live defects.
    const cut = LIVE_DEALER_AR.indexOf('},{"key":"inventory"');
    const written = `${LIVE_DEALER_AR.slice(0, cut)}${LIVE_DEALER_AR.slice(cut + 1)}`;
    expect(() => JSON.parse(written) as unknown).toThrow();

    const outcome = await proposePagePlan(request, { client: answering(written) });

    const plan = (outcome as { pagePlan: Plan & { sections: unknown[] } }).pagePlan;
    expect(plan.sections).toHaveLength(6);
    expect(plan.tokens['accentInk']).toBe('#f87171');
    expect(plan.facts.find((fact) => fact.key === 'phone')?.sample).toBe('+971 4 234 5678');
  });
});

const ANSWER_OF_EXAMPLE = {
  rationale: PAGE_PLAN_EXAMPLE.rationale,
  pagePlan: PAGE_PLAN_EXAMPLE.pagePlan,
};
