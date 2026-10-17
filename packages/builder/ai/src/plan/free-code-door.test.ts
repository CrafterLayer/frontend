import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createBuilder } from '@craftkit/builder-core';
import { fixedClock, seededIds } from '@craftkit/builder-core/testing';
import {
  customCss,
  defineBlockSchema,
  type BuilderDocument,
  type TrustedExtensionManifest,
} from '@craftkit/builder-schema';

import { assembleAiContext } from '../context';
import { resolveAiCompositionPolicy } from '../context/composition-policy';
import type { AiPlan, AiPlanProvider, AiPlanValidationIssue, AiProposeOptions } from '../types';
import { applyAiPlan } from './apply-plan';
import { generateAiPlan } from './generate-plan';
import { previewAiPlan } from './preview-plan';
import { createAiValidatedProposal } from './validated-proposal';
import {
  AUTHORED_PLAN_DOOR,
  CUSTOM_CODE_JS_MAX_LENGTH,
  assertValidAiPlan,
  validateAiPlan,
} from './validate-plan';

/**
 * The page-code door (free code mode, 2026-10-09).
 *
 * The composer's «وضع الكود الحر» switch decides whether the assistant may
 * AUTHOR a customCode block's `js`. Off, the plan is refused here — before the
 * dry run, which would take any string of the right length — with a reason
 * that names the switch; on, the code is held to its size and to the one
 * literal that would close the page's own script element.
 */

const codeHost: TrustedExtensionManifest = {
  tier: 1,
  name: 'free-code-host',
  version: '0.0.0',
  contributes: {
    blocks: [
      {
        schema: defineBlockSchema({
          type: 'page',
          description: 'A page root.',
          props: z.object({ title: z.string().default('') }),
          slots: { default: { allow: ['customCode', 'plain'] } },
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'customCode',
          description: 'A freely composed region that may carry page code.',
          props: z.object({
            label: z.string().default('region'),
            tree: z.string().default(''),
            css: customCss(8_000),
            js: z.string().max(CUSTOM_CODE_JS_MAX_LENGTH).default(''),
          }),
          examples: [],
        }),
        render: () => null,
      },
      {
        schema: defineBlockSchema({
          type: 'plain',
          description: 'A block whose string prop happens to be called js: a caption.',
          props: z.object({ js: z.string().default('') }),
          examples: [],
        }),
        render: () => null,
      },
    ],
  },
};

function codeDocument(): BuilderDocument {
  return {
    schemaVersion: 1,
    surface: 'site',
    dir: 'ltr',
    rootId: 'root',
    nodes: {
      root: {
        id: 'root',
        type: 'page',
        props: { title: 'Home' },
        slots: { default: ['stage', 'caption'] },
      },
      stage: { id: 'stage', type: 'customCode', props: { label: 'stage', tree: '', css: '', js: '' } },
      caption: { id: 'caption', type: 'plain', props: { js: 'a caption' } },
    },
  };
}

function codeKernel() {
  return createBuilder({
    document: codeDocument(),
    extensions: [codeHost],
    ports: { clock: fixedClock(10), ids: seededIds('free-code-live') },
  });
}

const ports = (seed = 'free-code') => ({ clock: fixedClock(20), ids: seededIds(seed) });

const ON = { freeCode: true } as const;
const SCENE = "const {app}=await ck.stage();app.ticker.add(()=>{});";

function insertRegion(js: string): AiPlan {
  return {
    rationale: 'add a scene',
    commands: [
      {
        command: 'insertNode',
        args: { type: 'customCode', parentId: 'root', props: { label: 'scene', css: '', js } },
      },
    ],
  };
}

function setJs(js: unknown): AiPlan {
  return {
    rationale: 'write the scene',
    commands: [{ command: 'setProp', args: { id: 'stage', key: 'js', value: js } }],
  };
}

function patchJs(js: string): AiPlan {
  return {
    rationale: 'patch the scene',
    commands: [
      {
        command: 'applyPatches',
        args: { patches: [{ op: 'replace', path: ['nodes', 'stage', 'props', 'js'], value: js }] },
      },
    ],
  };
}

function nestedInsert(js: string): AiPlan {
  return {
    rationale: 'add a region that holds another',
    commands: [
      {
        command: 'insertNode',
        args: {
          type: 'customCode',
          parentId: 'root',
          props: {
            label: 'outer',
            tree: {
              kind: 'root',
              children: [{ kind: 'component', type: 'customCode', props: { js } }],
            },
          },
        },
      },
    ],
  };
}

describe('page code with free code mode OFF', () => {
  it.each([
    ['insertNode props', insertRegion(SCENE)],
    ['setProp key "js"', setJs(SCENE)],
    ['a JSON patch path ending in "js"', patchJs(SCENE)],
    ['a region nested in an inserted tree', nestedInsert(SCENE)],
  ])('refuses %s, naming the switch in both languages', (_label, plan) => {
    const result = validateAiPlan(plan, codeKernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.issues[0];
    expect(issue?.code).toBe('policy-rejected');
    expect(issue?.step).toBe(0);
    expect(issue?.message).toContain('free code mode is OFF');
    expect(issue?.message).toContain('«وضع الكود الحر»');
    expect(issue?.message).toContain('composer');
    expect(issue?.message).toContain('صندوق الكتابة');
    // The way around it, for the repair round.
    expect(issue?.message).toMatch(/closed motion scene/u);
  });

  it('is the default: an absent composition and a false switch both refuse', () => {
    expect(validateAiPlan(setJs(SCENE), codeKernel(), ports()).ok).toBe(false);
    expect(validateAiPlan(setJs(SCENE), codeKernel(), ports(), undefined, {}).ok).toBe(false);
    expect(
      validateAiPlan(setJs(SCENE), codeKernel(), ports(), undefined, { freeCode: false }).ok,
    ).toBe(false);
    expect(
      validateAiPlan(
        setJs(SCENE),
        codeKernel(),
        ports(),
        undefined,
        resolveAiCompositionPolicy(undefined),
      ).ok,
    ).toBe(false);
  });

  it('refuses before the dry run, which would take the string happily', () => {
    const result = validateAiPlan(setJs(SCENE), codeKernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues.every((issue) => issue.code !== 'door-rejected')).toBe(true);
    // The same plan is a valid document once the person allows it.
    expect(validateAiPlan(setJs(SCENE), codeKernel(), ports(), undefined, ON).ok).toBe(true);
  });

  it('says it once per step however many regions the step writes', () => {
    const plan: AiPlan = {
      rationale: 'two scenes in one step',
      commands: [
        {
          command: 'insertNode',
          args: {
            type: 'customCode',
            parentId: 'root',
            props: {
              js: SCENE,
              tree: { kind: 'root', children: [{ kind: 'component', type: 'customCode', props: { js: SCENE } }] },
            },
          },
        },
      ],
    };
    const result = validateAiPlan(plan, codeKernel(), ports());

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
  });

  it('lets an empty or blank js through: that is the default, not code', () => {
    expect(validateAiPlan(insertRegion(''), codeKernel(), ports()).ok).toBe(true);
    expect(validateAiPlan(setJs(''), codeKernel(), ports()).ok).toBe(true);
    expect(validateAiPlan(setJs('  \n '), codeKernel(), ports()).ok).toBe(true);
  });

  it('leaves a block that merely calls a prop "js" alone', () => {
    const caption: AiPlan = {
      rationale: 'rewrite the caption',
      commands: [{ command: 'setProp', args: { id: 'caption', key: 'js', value: 'new caption' } }],
    };

    expect(validateAiPlan(caption, codeKernel(), ports()).ok).toBe(true);
  });

  it('leaves ordinary plans, css included, exactly as they were', () => {
    const style: AiPlan = {
      rationale: 'style the stage',
      commands: [{ command: 'setProp', args: { id: 'stage', key: 'css', value: '.a{color:#1e3a8a}' } }],
    };

    expect(validateAiPlan(style, codeKernel(), ports()).ok).toBe(true);
  });
});

describe('page code with free code mode ON', () => {
  it.each([
    ['insertNode props', insertRegion(SCENE)],
    ['setProp key "js"', setJs(SCENE)],
    ['a JSON patch path ending in "js"', patchJs(SCENE)],
  ])('accepts %s', (_label, plan) => {
    const result = validateAiPlan(plan, codeKernel(), ports(), undefined, ON);

    expect(result.ok).toBe(true);
  });

  it('accepts the maximum and refuses one character more, naming the limit', () => {
    const atLimit = validateAiPlan(
      setJs('/'.repeat(CUSTOM_CODE_JS_MAX_LENGTH)),
      codeKernel(),
      ports(),
      undefined,
      ON,
    );
    expect(atLimit.ok).toBe(true);

    const over = validateAiPlan(
      setJs('/'.repeat(CUSTOM_CODE_JS_MAX_LENGTH + 1)),
      codeKernel(),
      ports(),
      undefined,
      ON,
    );
    expect(over.ok).toBe(false);
    if (over.ok) return;
    expect(over.issues[0]?.code).toBe('invalid-args');
    expect(over.issues[0]?.message).toContain('32001');
    expect(over.issues[0]?.message).toContain('32000');
  });

  it('refuses the literal </script in any case, which would close the page script early', () => {
    for (const js of ['x();</script><b>', 'x();</SCRIPT >', "const s='</Script';"]) {
      const result = validateAiPlan(setJs(js), codeKernel(), ports(), undefined, ON);

      expect(result.ok, js).toBe(false);
      if (result.ok) continue;
      expect(result.issues[0]?.message).toContain('</script');
    }
    // The escaped spelling is a different string and stays legal.
    expect(
      validateAiPlan(setJs("const s='<\\/script>';"), codeKernel(), ports(), undefined, ON).ok,
    ).toBe(true);
  });

  it('refuses a js that does not parse, with its line, and takes it once it does (Phase 1 B)', () => {
    const broken = 'const {app}=await ck.stage();\nconst speed = ;\napp.ticker.add(()=>{});';
    const result = validateAiPlan(setJs(broken), codeKernel(), ports(), undefined, ON);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe('invalid-args');
    expect(result.issues[0]?.step).toBe(0);
    expect(result.issues[0]?.message).toContain('syntax error at line 2');
    expect(result.issues[0]?.message).toContain('async (ck)=>{…}');
    // An insert and a patch are held to the same parse.
    for (const plan of [insertRegion(broken), patchJs(broken)]) {
      expect(validateAiPlan(plan, codeKernel(), ports(), undefined, ON).ok).toBe(false);
    }
    // Top-level await and a comment-only body are the runtime's own wrapper's to take.
    for (const js of [SCENE, '// nothing yet', broken.replace('= ;', '= 2;')]) {
      expect(validateAiPlan(setJs(js), codeKernel(), ports(), undefined, ON).ok, js).toBe(true);
    }
    // Off, the switch is the reason: no parse is reported for code that may not land at all.
    const off = validateAiPlan(setJs(broken), codeKernel(), ports());
    expect(off.ok).toBe(false);
    if (off.ok) return;
    expect(off.issues.map(({ code }) => code)).toEqual(['policy-rejected']);
  });

  it('refuses a js that is not a string, with or without the mode', () => {
    for (const composition of [undefined, ON]) {
      for (const value of [42, null, { code: 'x' }]) {
        const result = validateAiPlan(setJs(value), codeKernel(), ports(), undefined, composition);

        expect(result.ok).toBe(false);
        if (result.ok) continue;
        expect(result.issues[0]?.code).toBe('invalid-args');
        expect(result.issues[0]?.message).toContain('string');
      }
    }
  });
});

describe('page code on its way to the document', () => {
  const policy = { allowedCommands: ['setProp'], maxCommands: 4, maxOperations: 4 };

  it('lands through applyAiPlan and previews, though the apply door has no run composition', () => {
    const live = codeKernel();
    // Generation's door ruled with the mode on; apply and preview must not ask again with the default.
    const generated = validateAiPlan(setJs(SCENE), live, ports('gen'), undefined, ON);
    expect(generated.ok).toBe(true);
    if (!generated.ok) return;
    const proposal = createAiValidatedProposal({
      plan: generated.plan,
      policy,
      skillActivations: [],
      context: assembleAiContext(live.context),
    });

    const preview = previewAiPlan({ kernel: live, proposal, validationPorts: ports('preview') });
    expect(preview.nodes['stage']?.props['js']).toBe(SCENE);

    applyAiPlan({ kernel: live, proposal, validationPorts: ports('apply') });
    expect(live.getDocument().nodes['stage']?.props['js']).toBe(SCENE);
  });

  it('keeps the default door strict wherever no composition is named', () => {
    const live = codeKernel();

    expect(() => assertValidAiPlan(setJs(SCENE), live, ports('direct'), undefined)).toThrow(
      /free code mode is OFF/u,
    );
    expect(
      assertValidAiPlan(setJs(SCENE), live, ports('named'), undefined, AUTHORED_PLAN_DOOR).commands,
    ).toHaveLength(1);
  });

  it('still holds applied code to its size and to </script', () => {
    const kernel = codeKernel();

    expect(() =>
      assertValidAiPlan(setJs('x</script>'), kernel, ports('apply'), undefined, AUTHORED_PLAN_DOOR),
    ).toThrow(/<\/script/u);
  });
});

describe('page code through generateAiPlan', () => {
  const written = setJs(SCENE);
  const closed: AiPlan = {
    rationale: 'a closed scene instead',
    commands: [{ command: 'setProp', args: { id: 'stage', key: 'css', value: '.a{color:#1e3a8a}' } }],
  };

  it('turns the model back with the switch named when the mode is off, then takes the closed answer', async () => {
    let seen: readonly AiPlanValidationIssue[] = [];
    const lives: (AiProposeOptions | undefined)[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, _context, live) => {
        lives.push(live);
        return Promise.resolve(written);
      },
      repair: (_request, _context, _plan, issues, live) => {
        seen = issues;
        lives.push(live);
        return Promise.resolve(closed);
      },
    };

    const plan = await generateAiPlan({
      kernel: codeKernel(),
      provider,
      request: 'a custom PixiJS scene with moving characters',
      validationPorts: ports('off'),
    });

    expect(plan).toEqual(closed);
    expect(seen[0]?.message).toContain('«وضع الكود الحر»');
    // Off: nothing on the live options for a wire provider to carry.
    expect(lives.every((live) => live === undefined || !('freeCode' in live))).toBe(true);
  });

  it('accepts the code and hands every provider call the mode when it is on', async () => {
    const lives: (AiProposeOptions | undefined)[] = [];
    const provider: AiPlanProvider = {
      propose: (_request, _context, live) => {
        lives.push(live);
        return Promise.resolve(written);
      },
    };

    const plan = await generateAiPlan({
      kernel: codeKernel(),
      provider,
      request: 'a custom PixiJS scene with moving characters',
      validationPorts: ports('on'),
      composition: { freeCode: true },
    });

    expect(plan).toEqual(written);
    expect(lives).toHaveLength(1);
    expect(lives[0]?.freeCode).toBe(true);
  });

  it('sends a scene that does not parse back to the repair round with its line, then takes the fix', async () => {
    let seen: readonly AiPlanValidationIssue[] = [];
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(setJs('const {app}=await ck.stage();\napp.ticker.add(t=>{)')),
      repair: (_request, _context, _plan, issues) => {
        seen = issues;
        return Promise.resolve(written);
      },
    };

    const plan = await generateAiPlan({
      kernel: codeKernel(),
      provider,
      request: 'a custom PixiJS scene with moving characters',
      validationPorts: ports('parse'),
      composition: { freeCode: true },
    });

    expect(plan).toEqual(written);
    expect(seen[0]?.message).toContain('syntax error at line 2');
  });

  it('keeps the code and drops nothing else when only the stage step is refused (salvage)', async () => {
    const mixed: AiPlan = {
      rationale: 'style the stage and give it a scene',
      commands: [
        { command: 'setProp', args: { id: 'stage', key: 'css', value: '.a{color:#1e3a8a}' } },
        { command: 'setProp', args: { id: 'stage', key: 'js', value: SCENE } },
      ],
    };
    const provider: AiPlanProvider = {
      propose: () => Promise.resolve(mixed),
      repair: () => Promise.resolve(mixed),
    };
    const dropped: number[] = [];

    const plan = await generateAiPlan({
      kernel: codeKernel(),
      provider,
      request: 'style the stage and give it a scene',
      validationPorts: ports('salvage'),
      salvage: true,
      onSalvage: ({ dropped: steps }) => {
        dropped.push(...steps.map(({ step }) => step));
      },
    });

    expect(plan.commands).toHaveLength(1);
    expect(dropped).toEqual([2]);
  });
});
