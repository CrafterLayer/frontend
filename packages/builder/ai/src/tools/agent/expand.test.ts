import { describe, expect, it } from 'vitest';

import { serializeTreeMarkup } from '../../plan/tree-markup';
import { fixtureKernel, toolPlan } from './agent-tools.fixtures';
import { agentToolPrompt, agentToolPromptMaxChars, AGENT_TOOL_PROMPT_MAX_CHARS } from './catalog-prompt';
import { expandAgentTools } from './expand';
import { AGENT_TOOLS, agentTool, agentToolsForLane } from './registry';
import { AGENT_TOOL_LANES, defineAgentTool } from './types';

describe('the registry', () => {
  it('holds unique names, each defined within the catalog limits', () => {
    const names = AGENT_TOOLS.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of ['theme.apply', 'fonts.set', 'copy.set', 'direction.set', 'image.set', 'icon.set', 'section.ops', 'nav.sync', 'behavior.attach']) {
      expect(agentTool(name)?.name).toBe(name);
    }
    expect(agentTool('nope.tool')).toBeUndefined();
    expect(agentToolsForLane('section').every((tool) => tool.lanes.includes('section'))).toBe(true);
  });

  it('refuses a tool definition outside the limits', () => {
    const base = { lanes: ['edit'] as const, signature: '{}', parse: () => ({ ok: true as const, value: {} }), run: () => ({ ok: true as const, steps: [] }) };
    expect(() => defineAgentTool({ ...base, name: 'Bad', summary: 'ok' })).toThrow(/dotted/u);
    expect(() => defineAgentTool({ ...base, name: 'a.b', summary: 'one two three four five six seven eight nine' })).toThrow(/summary/u);
    expect(() => defineAgentTool({ ...base, name: 'a.b', summary: 'ok', signature: 'x'.repeat(121) })).toThrow(/signature/u);
  });
});

describe('expandAgentTools', () => {
  it('returns the same plan when it has no tool step', () => {
    const plan = { rationale: 'x', commands: [{ command: 'setProp', args: { id: 'root', key: 'title', value: 'A' } }] };
    const expanded = expandAgentTools(plan, fixtureKernel());
    expect(expanded.plan).toBe(plan);
    expect(expanded.issues).toEqual([]);
  });

  it('lands two tools on one region in sequence, the later reading the earlier', () => {
    const kernel = fixtureKernel();
    const plan = {
      rationale: 'two edits',
      commands: [
        { command: 'tool', title: 'Retitle', args: { name: 'copy.set', input: { edits: [{ find: 'Our story', text: 'Roots' }] } } },
        { command: 'tool', args: { name: 'behavior.attach', input: { id: 'r-story', find: 'Roots', behavior: 'reveal' } } },
      ],
    };
    const expanded = expandAgentTools(plan, kernel);
    expect(expanded.issues).toEqual([]);
    const steps = (expanded.plan as { commands: { command: string; title?: string; args: { value?: unknown } }[] }).commands;
    expect(steps).toHaveLength(2);
    expect(steps[0]?.title).toBe('Retitle');
    const last = serializeTreeMarkup(steps[1]?.args.value) ?? '';
    expect(last).toContain('>Roots</h2>');
    expect(last).toContain("data-ck-behavior='reveal'");
  });

  it('reports an unknown tool with the valid names, and keeps the step for the repair', () => {
    const expanded = expandAgentTools(toolPlan('paint.everything', {}), fixtureKernel());
    expect(expanded.issues).toHaveLength(1);
    expect(expanded.issues[0]).toMatchObject({ code: 'invalid-args', step: 0 });
    expect(expanded.issues[0]?.message).toMatch(/^Step 0 \(tool paint\.everything\): unknown tool/u);
    expect(expanded.issues[0]?.message).toContain('copy.set');
  });

  it('treats a tool outside the allowed lanes as unknown', () => {
    const expanded = expandAgentTools(toolPlan('theme.apply', { accent: 'red-700' }), fixtureKernel(), { lanes: ['section'] });
    expect(expanded.issues[0]?.message).toMatch(/unknown tool "theme\.apply"/u);
    expect(expanded.issues[0]?.message).not.toContain('theme.apply,');
  });

  it('turns a parse or run failure into an invalid-args issue naming the tool', () => {
    const expanded = expandAgentTools(toolPlan('copy.set', { edits: [{ find: 'Missing text', text: 'x' }] }), fixtureKernel());
    expect(expanded.issues[0]?.message).toMatch(/^Step 0 \(tool copy\.set\): edit 1: text "Missing text" was not found/u);
  });
});

describe('agentToolPrompt', () => {
  it('names every shared preset without losing the high-value edit signatures', () => {
    const prompt = agentToolPrompt('edit');
    for (const line of [
      'element.insert preset:feature-card',
      'fonts.set {display?,body?:verified family}',
      'image.set {id,find:src,subject,aspect?,alt}',
      "kit.section {id,kit,slots,heading?:'h1'|'h2'}",
      'palette.set {colors:[{name,value}]',
    ]) expect(prompt).toContain(line);
  });
  // Recipe guidance keeps edit/section bounded while retaining existing signatures.
  it('stays within its lane cap and shows one example step', () => {
    expect(agentToolPromptMaxChars('edit')).toBe(2_290);
    expect(agentToolPromptMaxChars('section')).toBe(1_200);
    expect(agentToolPromptMaxChars('build')).toBe(1_270);
    expect(agentToolPromptMaxChars('seo')).toBe(AGENT_TOOL_PROMPT_MAX_CHARS);
    for (const lane of AGENT_TOOL_LANES) {
      const prompt = agentToolPrompt(lane);
      expect(prompt.length).toBeLessThanOrEqual(agentToolPromptMaxChars(lane));
      if (agentToolsForLane(lane).length === 0) continue;
      expect(prompt).toContain('"command":"tool"');
      for (const tool of agentToolsForLane(lane)) expect(prompt).toContain(tool.name);
    }
  });
});
