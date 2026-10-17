import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it } from 'vitest';

import {
  ENHANCE_ANSWER_SCHEMA,
  ENHANCE_MAX_OUTPUT_TOKENS,
  ENHANCE_RULES_TEXT,
  buildEnhancePrompt,
  enhancePrompt,
  enhanceShapeCheck,
  impersonalUnderstood,
  readEnhanceAnswer,
  readEnhanceRequest,
  textLanguage,
  type EnhanceRequest,
} from './enhance';

/**
 * The prompt enhancer (2026-09-28) against a faked backend: what it asks for,
 * what it makes of an answer, and the contract's rules as the prompt states
 * them. The route itself — auth, the envelope, the model it picks — is in
 * handler.test.ts; the CLI end to end in cli-client.test.ts.
 */

function request(overrides: Partial<EnhanceRequest> = {}): EnhanceRequest {
  return {
    version: 1,
    text: 'بدي صفحه لمطعم مشاوي في عمان',
    locale: 'ar',
    intent: { kind: 'build-page', confidence: 0.85 },
    page: { empty: true, sections: [] },
    selection: null,
    answers: [],
    ...overrides,
  };
}

function answering(
  text: string,
  stop = 'end_turn',
): {
  client: Anthropic;
  seen: { params: Record<string, unknown>; options: unknown }[];
} {
  const seen: { params: Record<string, unknown>; options: unknown }[] = [];
  const client = {
    messages: {
      stream: (params: Record<string, unknown>, options: unknown) => {
        seen.push({ params, options });
        return {
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: stop,
              stop_details: null,
              content: [{ type: 'text', text }],
              usage: { input_tokens: 600, output_tokens: 90 },
            }),
        };
      },
    },
  } as unknown as Anthropic;
  return { client, seen };
}

const GOOD = {
  enhanced: 'بدي صفحة هبوط لمطعم مشاوي في عمّان: الهيرو، المنيو مع الأسعار، الحجز، التواصل.',
  understood: 'صفحة هبوط لمطعم مشاوي في عمّان.',
  changes: ['«صفحه» ← «صفحة»', 'رتبت الأقسام'],
  questions: [],
  language: 'ar',
};

describe('enhanceShapeCheck', () => {
  it('accepts the contract’s answer, with or without version', () => {
    expect(enhanceShapeCheck(GOOD)).toBe(true);
    expect(enhanceShapeCheck({ version: 1, ...GOOD })).toBe(true);
    expect(enhanceShapeCheck({ enhanced: 'x' })).toBe(true);
    expect(
      enhanceShapeCheck({
        ...GOOD,
        questions: [{ id: 'q1', text: 'أي مدينة؟', choices: ['عمّان', 'إربد'] }],
      }),
    ).toBe(true);
  });

  it('refuses what is not an enhancement, or has a key in the wrong object', () => {
    expect(enhanceShapeCheck([])).toBe(false);
    expect(enhanceShapeCheck('text')).toBe(false);
    expect(enhanceShapeCheck({ ...GOOD, enhanced: '' })).toBe(false);
    expect(enhanceShapeCheck({ ...GOOD, enhanced: 3 })).toBe(false);
    expect(enhanceShapeCheck({ ...GOOD, commands: [] })).toBe(false);
    expect(enhanceShapeCheck({ ...GOOD, changes: [1] })).toBe(false);
    expect(enhanceShapeCheck({ ...GOOD, questions: ['أي مدينة؟'] })).toBe(false);
    // A closer run that slid `language` into a question.
    expect(
      enhanceShapeCheck({
        ...GOOD,
        questions: [{ id: 'q1', text: 'q', choices: ['a', 'b'], language: 'ar' }],
      }),
    ).toBe(false);
  });

  it('decodes into a closed schema that names every contract field', () => {
    expect(Object.keys(ENHANCE_ANSWER_SCHEMA.properties)).toEqual([
      'enhanced',
      'understood',
      'changes',
      'questions',
      'language',
    ]);
    expect(ENHANCE_ANSWER_SCHEMA.additionalProperties).toBe(false);
  });
});

describe('the enhancer’s rules', () => {
  const rules = ENHANCE_RULES_TEXT;

  it('keeps Arabic in Arabic: same script, spelling fixed, the person’s own words kept', () => {
    expect(rules).toContain('SAME LANGUAGE AND SCRIPT');
    expect(rules).toContain('never translate');
    expect(rules).toContain('Arabic stays Arabic');
    expect(rules).toContain('«صفحه» → «صفحة»');
    expect(rules).toContain('«ال صفحه» → «الصفحة»');
    expect(rules).toContain(
      "Keep the person's own names, brands, numbers, prices, phone numbers, links and quoted text exactly as written",
    );
  });

  it('asks questions only when essential information is missing or the text is ambiguous', () => {
    expect(rules).toContain(
      'ONLY when essential information is missing or the text is ambiguous — 0 to 3 questions, each with 2 to 4 short choices',
    );
    expect(rules).toContain('Otherwise [].');
    expect(rules).toContain('fold the answers into "enhanced" and ask nothing already answered');
  });

  it('keeps the intent, invents no facts, and holds a build to a 600-character brief', () => {
    expect(rules).toContain('KEEP THE INTENT');
    expect(rules).toContain('NEVER INVENT FACTS');
    expect(rules).toContain('at most 600 characters');
    expect(rules).toContain('never grows into a new page');
    expect(rules).toContain('A QUESTION stays a question');
  });

  it('names builder parts in plain Arabic, asks a link target, and forbids a second-person understood', () => {
    expect(rules).toContain('the hero is «القسم الرئيسي» (or «الواجهة»), never «هيرو»');
    expect(rules).toContain('the call to action is «زر الإجراء», never «الدعوة الرئيسية»');
    expect(rules).toContain('NEVER GUESS A LINK TARGET');
    expect(rules).toContain('"understood": a short NOUN PHRASE');
    expect(rules).toContain('no «تريد», «تريدين», «بدك», no "You want"');
    const lines = rules.split('\n');
    const examples = lines
      .filter((_line, at) => at > 0 && (lines[at - 1] ?? '').includes('shape only'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    for (const example of examples) {
      const understood = String(example['understood']);
      expect(impersonalUnderstood(understood)).toBe(understood);
      expect(String(example['enhanced'])).not.toMatch(/هيرو/u);
    }
  });

  it('shows a build becoming a brief in English, beside the Arabic edit', () => {
    expect(rules).toContain('a short build request with nothing misspelled still becomes a brief');
    expect(rules).toContain('The shape of a build, for «make a website for my bakery»');
    // Every example is a whole answer the schema accepts, and a build's is a real brief.
    const lines = rules.split('\n');
    const examples = lines
      .filter((_line, at) => at > 0 && (lines[at - 1] ?? '').includes('shape only'))
      .map((line) => JSON.parse(line) as Record<string, unknown>);
    expect(examples.map((example) => example['language'])).toEqual(['ar', 'en']);
    expect(examples.every(enhanceShapeCheck)).toBe(true);
    const brief = String(examples[1]?.['enhanced']);
    expect(Array.from(brief).length).toBeLessThanOrEqual(600);
    expect(brief).toMatch(/call to action/u);
  });

  it('hands the model the draft, the UI language, the route, the page and the answers', () => {
    const { system, messages } = buildEnhancePrompt(
      request({
        locale: 'en',
        page: { empty: false, sections: ['Header', 'Hero', 'Menu'] },
        selection: 'Hero',
        intent: { kind: 'edit', confidence: 0.8 },
        answers: [{ question: 'أي لون؟', answer: 'أخضر' }],
      }),
    );
    const turn = messages[0]?.content ?? '';

    // The rules are the same for every request: cached for an hour, like every plan's.
    expect(system).toEqual([
      { type: 'text', text: ENHANCE_RULES_TEXT, cache_control: { type: 'ephemeral', ttl: '1h' } },
    ]);
    expect(turn).toContain('بدي صفحه لمطعم مشاوي في عمان');
    expect(turn).toContain('English');
    expect(turn).toContain('edit (confidence 0.80)');
    expect(turn).toContain('3 sections: Header · Hero · Menu');
    expect(turn).toContain('# The selected block\nHero');
    expect(turn).toContain('- أي لون؟ → أخضر');
  });
});

describe('readEnhanceRequest', () => {
  it('reads the contract’s request', () => {
    const read = readEnhanceRequest({ ...request(), answers: [{ question: 'q', answer: 'a' }] });

    expect(read).toEqual({ request: { ...request(), answers: [{ question: 'q', answer: 'a' }] } });
  });

  it('forgives what an older client leaves out, and trims what runs past the limits', () => {
    const read = readEnhanceRequest({
      version: 1,
      text: 'make the hero darker',
      page: {
        empty: false,
        sections: [...Array.from({ length: 25 }, (_unused, at) => `Section ${String(at)}`), 7],
      },
    });

    expect('request' in read).toBe(true);
    const parsed = (read as { request: EnhanceRequest }).request;
    expect(parsed.locale).toBe('en');
    expect(parsed.intent).toBeNull();
    expect(parsed.selection).toBeNull();
    expect(parsed.answers).toEqual([]);
    expect(parsed.page.sections).toHaveLength(20);
  });

  it('names what is wrong with a malformed request', () => {
    /** The sentence a request is refused with; '' when it was read. */
    const refusal = (body: unknown): string => {
      const read = readEnhanceRequest(body);
      return 'error' in read ? read.error : '';
    };

    expect(refusal({ ...request(), version: 2 })).toMatch(/version/u);
    expect(refusal({ ...request(), text: '' })).toMatch(/text/u);
    expect(refusal({ ...request(), locale: 'fr' })).toMatch(/locale/u);
    expect(refusal({ ...request(), intent: { kind: 'edit', confidence: 'high' } })).toMatch(
      /intent/u,
    );
    expect(refusal({ ...request(), selection: 3 })).toMatch(/selection/u);
    expect(refusal({ ...request(), text: 'x'.repeat(8_001) })).toMatch(/longer/u);
  });
});

describe('textLanguage', () => {
  it('reads Arabic with a Latin brand in it as Arabic, and English as English', () => {
    expect(textLanguage('بدي صفحة لمتجر أحذية رياضية فيها Nike و Adidas', 'en')).toBe('ar');
    expect(textLanguage('make the hero title say Welcome', 'ar')).toBe('en');
    expect(textLanguage('2025', 'ar')).toBe('ar');
  });
});

describe('enhancePrompt', () => {
  it('asks the backend for a small, fast answer: no thinking, low effort, 900 tokens, the schema', async () => {
    const { client, seen } = answering(JSON.stringify(GOOD));

    const outcome = await enhancePrompt(request(), { client, model: 'cli:haiku' });

    expect(outcome).toMatchObject({ kind: 'enhanced', response: { version: 1, ...GOOD } });
    expect(seen[0]?.params).toMatchObject({
      model: 'cli:haiku',
      max_tokens: ENHANCE_MAX_OUTPUT_TOKENS,
      thinking: { type: 'disabled' },
      output_config: { format: { type: 'json_schema', schema: ENHANCE_ANSWER_SCHEMA } },
    });
    expect((seen[0]?.params['output_config'] as Record<string, unknown>)['effort']).toBeUndefined();
    expect(seen[0]?.options).toMatchObject({
      headers: { 'x-craftkit-internal-reasoning-effort': 'low' },
    });
  });

  it('salvages a fenced answer, and holds changes and questions to the contract', async () => {
    const answer = {
      ...GOOD,
      changes: ['1', '2', '3', '4', '5', '6', '2'],
      questions: [
        { id: 'x', text: 'أي نوع من المشاوي؟', choices: ['لحوم', 'دجاج', 'لحوم'] },
        { id: 'x', text: 'Which city?', choices: ['Amman', 'Irbid'] },
        { id: 'q9', text: 'ما لون الصفحة؟', choices: ['أخضر'] },
        { text: 'هل تريد قسم حجز؟', choices: ['نعم', 'لا', 'ربما', 'لاحقاً', 'أبداً'] },
        { text: 'ما اسم المطعم؟', choices: ['أكتبه لاحقاً', 'بدون اسم'] },
        { text: 'سؤال خامس؟', choices: ['أ', 'ب'] },
      ],
    };
    const { client } = answering(`Here you go:\n\`\`\`json\n${JSON.stringify(answer)}\n\`\`\``);

    const outcome = await enhancePrompt(
      request({ answers: [{ question: 'ما اسم المطعم؟', answer: 'مشاوي الريف' }] }),
      { client },
    );

    const response = outcome.kind === 'enhanced' ? outcome.response : undefined;
    expect(response?.changes).toEqual(['1', '2', '3', '4', '5']);
    // English question on an Arabic text, one choice, and the answered one are dropped; three at most.
    expect(response?.questions).toEqual([
      { id: 'q1', text: 'أي نوع من المشاوي؟', choices: ['لحوم', 'دجاج'] },
      { id: 'q2', text: 'هل تريد قسم حجز؟', choices: ['نعم', 'لا', 'ربما', 'لاحقاً'] },
      { id: 'q3', text: 'سؤال خامس؟', choices: ['أ', 'ب'] },
    ]);
  });

  it('never hands an Arabic request back in English: the person’s own text stands', async () => {
    const logged: string[] = [];
    const { client } = answering(
      JSON.stringify({
        ...GOOD,
        enhanced: 'Build a landing page for a grill restaurant in Amman.',
        questions: [{ id: 'q1', text: 'هل تريد قسم حجز؟', choices: ['نعم', 'لا'] }],
        language: 'en',
      }),
    );

    const outcome = await enhancePrompt(request(), {
      client,
      onLog: (line) => {
        logged.push(line);
      },
    });

    expect(outcome).toMatchObject({
      kind: 'enhanced',
      response: { enhanced: 'بدي صفحه لمطعم مشاوي في عمان', changes: [], language: 'ar' },
    });
    expect(logged[0]).toMatch(/another script/u);
  });

  /*
    Found by the final test (2026-09-29, cli:haiku, thinking off): «make a site for my gym»
    came back word for word, no brief and nothing asked, after 15 s — and the panel called
    it improved.
  */
  describe('an answer that hands the request back unchanged', () => {
    const GYM = request({
      text: 'make a site for my gym',
      locale: 'ar',
      intent: { kind: 'build-site', confidence: 0.9 },
    });
    const echo = (text: string, extra: Record<string, unknown> = {}): Anthropic =>
      answering(
        JSON.stringify({
          enhanced: text,
          understood: 'موقع لنادٍ رياضي.',
          changes: [],
          questions: [],
          language: 'en',
          ...extra,
        }),
      ).client;

    it('is no enhancement of a build: the rules demand a brief', async () => {
      const logged: string[] = [];
      for (const text of ['make a site for my gym', 'Make a site for my gym.']) {
        const outcome = await enhancePrompt(GYM, {
          client: echo(text),
          onLog: (line) => {
            logged.push(line);
          },
        });
        expect(outcome.kind).toBe('invalid-output');
        expect(outcome.kind === 'invalid-output' ? outcome.message : '').toMatch(/unchanged/u);
      }
      expect(logged[0]).toMatch(/unchanged/u);
      // Nor is an answer in another script, which the reader swaps for the person's own text.
      const flipped = await enhancePrompt(request(), {
        client: echo('Build a landing page for a grill restaurant in Amman.'),
      });
      expect(flipped.kind).toBe('invalid-output');
    });

    it('stands on a build that asks something, and on anything but a build', async () => {
      const asking = await enhancePrompt(GYM, {
        client: echo('make a site for my gym', {
          questions: [{ id: 'q1', text: 'Which classes?', choices: ['Weights', 'Yoga'] }],
        }),
      });
      expect(asking.kind).toBe('enhanced');
      const edit = await enhancePrompt(
        request({ text: 'Make the hero darker.', intent: { kind: 'edit', confidence: 0.9 } }),
        { client: echo('Make the hero darker.') },
      );
      expect(edit.kind).toBe('enhanced');
      const unrouted = await enhancePrompt(
        request({ text: 'Make the hero darker.', intent: null }),
        {
          client: echo('Make the hero darker.'),
        },
      );
      expect(unrouted.kind).toBe('enhanced');
    });

    it('is no enhancement when the person’s answers never reached the text', async () => {
      const outcome = await enhancePrompt(
        request({
          text: 'Make the hero darker.',
          intent: { kind: 'edit', confidence: 0.9 },
          answers: [{ question: 'How dark?', answer: 'Almost black' }],
        }),
        {
          client: echo('Make the hero darker.', {
            questions: [{ id: 'q1', text: 'Which hero?', choices: ['Top', 'Bottom'] }],
          }),
        },
      );
      expect(outcome.kind).toBe('invalid-output');
      expect(outcome.kind === 'invalid-output' ? outcome.message : '').toMatch(/answers/u);
    });
  });

  it('writes understood as a noun phrase: no gendered second-person verb reaches the panel', () => {
    expect(impersonalUnderstood('تريد ربط هذه الصفحة بقائمة التنقل.')).toBe(
      'ربط هذه الصفحة بقائمة التنقل.',
    );
    expect(impersonalUnderstood('تريدين صفحة هبوط لمطعم')).toBe('صفحة هبوط لمطعم');
    expect(impersonalUnderstood('أنت تريد أن تغيّر اللون')).toBe('تغيّر اللون');
    expect(impersonalUnderstood('You want a website for your bakery.')).toBe(
      'A website for your bakery.',
    );
    expect(impersonalUnderstood('you want to link this page')).toBe('Link this page');
    expect(impersonalUnderstood('صفحة هبوط لمطعم')).toBe('صفحة هبوط لمطعم');
    expect(impersonalUnderstood('تريد')).toBe('تريد');
    expect(
      readEnhanceAnswer({ ...GOOD, understood: 'تريد صفحة هبوط لمطعم.' }, request())?.understood,
    ).toBe('صفحة هبوط لمطعم.');
  });

  it('states the language of the person’s text, whatever the model claimed', () => {
    expect(readEnhanceAnswer({ ...GOOD, language: 'en' }, request())?.language).toBe('ar');
    expect(
      readEnhanceAnswer(
        { ...GOOD, enhanced: 'Make the hero darker.' },
        request({ text: 'make hero darker', locale: 'ar' }),
      )?.language,
    ).toBe('en');
  });

  it('reads a refusal, a cut-off answer, an empty one and prose for what each is', async () => {
    const declined = {
      messages: {
        stream: () => ({
          on: () => undefined,
          finalMessage: () =>
            Promise.resolve({
              stop_reason: 'refusal',
              stop_details: { explanation: 'No.' },
              content: [],
              usage: { input_tokens: 1, output_tokens: 1 },
            }),
        }),
      },
    } as unknown as Anthropic;

    expect(await enhancePrompt(request(), { client: declined })).toEqual({
      kind: 'refusal',
      message: 'No.',
    });
    const cut = await enhancePrompt(request(), {
      client: answering('{"enhanced":"بدي', 'max_tokens').client,
    });
    expect(cut.kind).toBe('invalid-output');
    expect(cut.kind === 'invalid-output' ? cut.message : '').toMatch(/cut off/u);
    expect(await enhancePrompt(request(), { client: answering('').client })).toMatchObject({
      kind: 'invalid-output',
    });
    expect(
      await enhancePrompt(request(), { client: answering('I would add a menu.').client }),
    ).toMatchObject({ kind: 'invalid-output' });
    const unwritten = await enhancePrompt(request(), {
      client: answering('{"understood":"x"}').client,
    });
    expect(unwritten.kind).toBe('invalid-output');
    expect(unwritten.kind === 'invalid-output' ? unwritten.message : '').toMatch(
      /without an improved request/u,
    );
  });
});
