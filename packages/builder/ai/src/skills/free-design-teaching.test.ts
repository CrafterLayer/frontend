import { describe, expect, it } from 'vitest';

import { createCraftkitAiSkillRegistry } from './builtins';
import { CRAFTKIT_DEFAULT_SKILLS, DESIGN_ROWS } from './defaults';

const registry = createCraftkitAiSkillRegistry(CRAFTKIT_DEFAULT_SKILLS);

describe('free-composition teaching delivered to the model', () => {
  it('keeps CV facts, contacts, print and RTL grounded without a fixed markup recipe', () => {
    const teaching = registry.readSkill('craftkit.cv-page');
    expect(teaching).toContain("a person's own facts are never invented");
    expect(teaching).toContain('Never attach mailto:, tel: or external URLs to placeholders');
    expect(teaching).toContain('@media print');
    expect(teaching).toContain('RTL uses logical alignment');
    expect(teaching).toContain('distinguish a résumé/CV');
    expect(teaching).not.toContain('One region per block, in this order');
    expect(teaching).not.toContain('md:grid-cols-3');
  });

  it('does not override a bespoke contract with the shared floor or writer recipe', () => {
    const floor = registry.readSkill('craftkit.craft-manual');
    const writer = registry.readSkill('craftkit.build-fill');
    const scaffold = registry.readSkill('craftkit.build-scaffold');
    expect(scaffold).toContain('1–12 coherent regions');
    expect(scaffold).toContain('complete page composition');
    expect(scaffold).not.toContain('Three to twelve');
    expect(floor).toContain('no fixed shell or kit');
    expect(floor).not.toContain('py-16 md:py-24');
    expect(writer).toContain('cohesive whole-page composition');
    expect(writer).not.toContain('build exactly that one');
    expect(writer).not.toContain('Aim for 20-70 nodes');
  });

  it('makes industry rows optional and distinguishes résumé priorities from selected work', () => {
    const teaching = registry.readSkill('craftkit.pro-max-design');
    expect(teaching).toContain('ROWS ARE OPTIONAL INSPIRATION');
    expect(teaching).toContain('No fixed section order');
    expect(teaching).not.toContain('one accent at about 10%');
    expect(DESIGN_ROWS.find(({ kind }) => kind === 'CV, résumé')?.show).toContain('dates');
    expect(DESIGN_ROWS.find(({ kind }) => kind === 'portfolio')?.show).toContain('work context');
  });

  it('keeps mandatory direction and explicitly selected landing advice subordinate to bespoke design', () => {
    const direction = registry.readSkill('craftkit.direction-deck');
    const landing = registry.readSkill('craftkit.pro-max-landing');
    expect(direction).toContain('BESPOKE: rows are optional inspiration');
    expect(direction).not.toContain('never a palette from outside the row');
    expect(landing).toContain('even when this skill was explicitly selected');
    expect(landing).toContain('never cut or reorder content to fit a recipe');
    expect(landing).not.toContain('a section that serves none of them is cut');
  });
});
