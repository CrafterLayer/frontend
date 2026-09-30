import { describe, expect, it } from 'vitest';

import { applyAiPlan } from '../plan/apply-plan';
import { validateAiPlan } from '../plan/validate-plan';
import { resolveAiCommandPolicy } from '../skills';
import type { AgentTool } from '../tools/agent/types';
import type { AiPlan } from '../types';
import { SEO_AUTOFIX_LABEL, seoAutofixPlan } from './autofix';
import { checkSeo } from './check-seo';
import {
  AR_DESCRIPTION,
  AR_TITLE,
  CAFE_PHOTO,
  cleanArabicRegions,
  dirtyArabicRegions,
  kernelFor,
  pageDocument,
  toolContext,
  validationPorts,
} from './seo.fixtures';
import { SEO_TOOLS } from './tools';

const AR_ROOT = { title: AR_TITLE, description: AR_DESCRIPTION, lang: 'ar' };

function tool(name: string): AgentTool {
  const found = SEO_TOOLS.find((entry) => entry.name === name);
  if (found === undefined) throw new Error(`no tool ${name}`);
  return found;
}

type Kernel = ReturnType<typeof kernelFor>;

/** Parse, run and validate a tool call through the door; returns the steps. */
function throughTheDoor(kernel: Kernel, name: string, input: unknown, samples: readonly string[] = []) {
  const parsed = tool(name).parse(input);
  if (!parsed.ok) throw new Error(parsed.error);
  const run = tool(name).run(parsed.value, toolContext(kernel, samples));
  if (!run.ok) throw new Error(run.error);
  if (run.steps.length === 0) return run.steps;
  const plan = { rationale: name, commands: run.steps };
  const result = validateAiPlan(plan, kernel, validationPorts());
  if (!result.ok) throw new Error(result.issues.map((issue) => issue.message).join('; '));
  return run.steps;
}

function apply(kernel: Kernel, plan: AiPlan, label?: string) {
  return applyAiPlan({
    kernel,
    plan,
    policy: resolveAiCommandPolicy({ registeredCommands: kernel.context.registry.commandNames() }),
    validationPorts: validationPorts(),
    ...(label === undefined ? {} : { label }),
  });
}

describe('seoAutofixPlan', () => {
  it('fixes every safe issue in ONE validated transaction, and is idempotent', () => {
    const kernel = kernelFor(pageDocument(dirtyArabicRegions(), AR_ROOT));
    const plan = seoAutofixPlan(kernel);
    expect(plan).toBeDefined();
    if (plan === undefined) return;

    // One setProp per region, not one per fix.
    const treeSteps = plan.commands.filter((step) => (step.args as { key?: string }).key === 'tree');
    expect(treeSteps.map((step) => (step.args as { id: string }).id)).toEqual(['hero', 'menu']);
    expect(validateAiPlan(plan, kernel, validationPorts()).ok).toBe(true);

    const applied = apply(kernel, plan, SEO_AUTOFIX_LABEL);
    expect(applied.transactions).toHaveLength(1);

    const document = kernel.getDocument();
    const hero = document.nodes['hero']?.props['tree'] as { children: { attributes: Record<string, string>; children: { tag: string; text?: string; attributes?: Record<string, string> }[] }[] };
    const menu = document.nodes['menu']?.props['tree'] as typeof hero;
    expect(hero.children[0]?.attributes['aria-labelledby']).toBe('hero-title');
    expect(hero.children[0]?.children[2]?.attributes).toMatchObject({
      alt: CAFE_PHOTO.alt.ar,
      loading: 'eager',
      fetchpriority: 'high',
      width: String(CAFE_PHOTO.width),
    });
    expect(menu.children[0]?.children[0]?.tag).toBe('h2');
    expect(menu.children[0]?.children[2]?.attributes?.['loading']).toBe('lazy');
    expect(menu.children[0]?.children[3]?.text).toBe('اقرأ المزيد عن قائمة المشروبات');

    expect(seoAutofixPlan(kernel)).toBeUndefined();
    expect(checkSeo(document).filter((issue) => issue.fix?.safe === true)).toEqual([]);
  });

  it('returns undefined for a clean page', () => {
    expect(seoAutofixPlan(kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT)))).toBeUndefined();
  });

  it('keeps the fixes the door accepts when one region is refused', () => {
    const regions = dirtyArabicRegions();
    // A class with no generated CSS: this region's tree can never pass the door.
    const broken = { id: 'broken', tree: { kind: 'root', children: [{ kind: 'element', tag: 'section', className: 'totally-made-up', children: [{ kind: 'element', tag: 'h2', text: 'قسم' }, { kind: 'element', tag: 'p', text: 'نص' }] }] } };
    const kernel = kernelFor(pageDocument([...regions, broken], AR_ROOT));
    const plan = seoAutofixPlan(kernel);
    expect(plan).toBeDefined();
    const ids = plan?.commands.map((step) => (step.args as { id: string }).id);
    expect(ids).toContain('hero');
    expect(ids).not.toContain('broken');
    // The refused region costs nothing elsewhere: the hero keeps its priority hint.
    expect(JSON.stringify(plan?.commands)).toContain('"fetchpriority":"high"');
  });
});

describe('SEO_TOOLS through the door', () => {
  it('lists the four seo tools with valid catalog entries', () => {
    expect(SEO_TOOLS.map((entry) => entry.name)).toEqual(['seo.meta', 'seo.business', 'seo.schema', 'seo.fix']);
  });

  it('seo.meta fills title, description, slug and keyword from the page, in Arabic', () => {
    const kernel = kernelFor(pageDocument(cleanArabicRegions(), { lang: 'ar' }));
    const steps = throughTheDoor(kernel, 'seo.meta', { keyword: 'قهوة مختصة عمان' });
    const byKey: Record<string, unknown> = Object.fromEntries(
      steps.map((step) => [String(step.args['key']), step.args['value']]),
    );
    expect(byKey['title']).toBe('قهوة تُحمّص كل صباح');
    expect(byKey['description']).toBe('محمصة صغيرة في قلب عمّان تقدّم قهوة مختصة طازجة.');
    expect(byKey['slug']).toBe('قهوة-تحمص-كل-صباح');
    expect(byKey['seo']).toEqual({ keyword: 'قهوة مختصة عمان' });
  });

  it('seo.meta refuses a title in the wrong script, saying how to fix it', () => {
    const kernel = kernelFor(pageDocument(cleanArabicRegions(), { lang: 'ar' }));
    const run = tool('seo.meta').run({ title: 'Fresh coffee in Amman every day' }, toolContext(kernel));
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error).toContain('Arabic');
  });

  it('seo.business writes seo.site.business on the home root', () => {
    const kernel = kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT));
    const steps = throughTheDoor(kernel, 'seo.business', {
      type: 'CafeOrCoffeeShop',
      name: 'بُن',
      telephone: '+962 6 555 1234',
      address: { city: 'عمّان', country: 'JO' },
      hours: 'Sa-Th 08:00-23:00',
      cuisine: 'قهوة',
    });
    expect(steps[0]?.args['value']).toEqual({
      site: {
        business: {
          type: 'CafeOrCoffeeShop',
          name: 'بُن',
          telephone: '+962 6 555 1234',
          address: { city: 'عمّان', country: 'JO' },
          openingHours: ['Sa-Th 08:00-23:00'],
          servesCuisine: ['قهوة'],
        },
      },
    });
  });

  it('seo.business refuses a sample value and tells the model to ask the owner', () => {
    const kernel = kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT));
    const parsed = tool('seo.business').parse({ type: 'CafeOrCoffeeShop', name: 'بُن', telephone: '0790000000' });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const run = tool('seo.business').run(parsed.value, toolContext(kernel, ['079 000 0000']));
    expect(run.ok).toBe(false);
    if (!run.ok) expect(run.error).toContain('Ask the owner');
  });

  it('seo.business refuses an invalid shape with the field named', () => {
    const parsed = tool('seo.business').parse({ type: 'Spaceport', name: 'x' });
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.error).toContain('type');
  });

  it('seo.schema writes seo.schemaKinds', () => {
    const kernel = kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT));
    const steps = throughTheDoor(kernel, 'seo.schema', { kinds: ['Menu', 'FAQPage', 'Menu'] });
    expect(steps[0]?.args['value']).toEqual({ schemaKinds: ['Menu', 'FAQPage'] });
    expect(tool('seo.schema').parse({ kinds: ['Recipe'] }).ok).toBe(false);
  });

  it('seo.fix returns the auto-fix steps, which the door accepts', () => {
    const kernel = kernelFor(pageDocument(dirtyArabicRegions(), AR_ROOT));
    const steps = throughTheDoor(kernel, 'seo.fix', {});
    expect(steps.length).toBeGreaterThan(0);
    const clean = kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT));
    expect(throughTheDoor(clean, 'seo.fix', {})).toEqual([]);
  });

  it('seo.fix reads trees as the plan’s earlier steps leave them', () => {
    const kernel = kernelFor(pageDocument(dirtyArabicRegions(), AR_ROOT));
    const fixedMenu = kernelFor(pageDocument(cleanArabicRegions(), AR_ROOT)).getDocument().nodes['menu']?.props['tree'];
    const context = {
      ...toolContext(kernel),
      readProp: (id: string, key: string) =>
        id === 'menu' && key === 'tree' ? fixedMenu : kernel.getDocument().nodes[id]?.props[key],
    };
    const run = tool('seo.fix').run({}, context);
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    expect(run.steps.map((step) => step.args['id'])).toEqual(['hero']);
  });
});
