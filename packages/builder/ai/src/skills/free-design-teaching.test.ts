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

  it('delivers adaptable chrome advice to ordinary edits and section additions', () => {
    for (const request of ['Redesign the navbar to match this page', 'Add a site footer']) {
      const active = registry.prepare({ request, intent: 'add-section' }).active;
      const chrome = active.find(({ id }) => id === 'craftkit.structure-recipes');
      expect(chrome).toBeDefined();
      expect(chrome?.instructions).toContain('existing page design');
      expect(chrome?.instructions).toContain('Explicitly requested templates remain valid');
      expect(chrome?.instructions).toContain(
        'never hide navigation without an accessible alternative',
      );
      expect(chrome?.instructions).not.toContain('max-w-6xl');
      expect(chrome?.instructions).not.toContain('md:grid-cols-4');
      expect(chrome?.instructions).not.toContain('bg-white');
    }
  });

  it('delivers page guidance without imposing its former marketing sequence', () => {
    const teaching = registry
      .prepare({ request: 'Create a complete page' })
      .active.find(({ id }) => id === 'craftkit.page-composition')?.instructions;
    expect(teaching).toBeDefined();
    expect(teaching).toContain('No fixed section order');
    expect(teaching).toContain('Navigation and footer are optional');
    expect(teaching).toContain('supplied references take precedence');
    expect(teaching).not.toContain('build these sections in order');
    expect(teaching).not.toContain('8 FOOTER:');
    expect(teaching).not.toContain('realistic samples');
  });

  it('keeps writer and copy guidance aligned on supplied facts and requested template samples', () => {
    for (const id of ['craftkit.build-fill', 'craftkit.copywriting']) {
      const teaching = registry.readSkill(id);
      expect(teaching).toContain('Only an explicitly requested template');
      expect(teaching).toContain('never become real contact links');
      expect(teaching).not.toContain('realistic, specific sample');
      expect(teaching).not.toContain('is a realistic sample for its trade');
    }
  });
});
