import { createAiSkillRegistry } from './registry';
import type { AiSkillDefinitionV1, AiSkillRegistry } from './types';

function freezeData(value: unknown): void {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return;
  for (const child of Object.values(value)) freezeData(child);
  Object.freeze(value);
}

function builtin(definition: AiSkillDefinitionV1): AiSkillDefinitionV1 {
  freezeData(definition);
  return definition;
}

const PAGE_COMPOSITION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.page-composition',
  name: 'Professional page composition',
  description: 'Plan complete, coherent page hierarchy from the visitor goal outward.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 80,
  activation: {
    mode: 'auto',
    keywords: [
      'landing page',
      'full page',
      'complete page',
      'صفحة هبوط',
      'صفحة كاملة',
      'صمم لي صفحة',
    ],
  },
  tags: ['composition', 'design', 'page'],
  instructions:
    'Start from the primary visitor outcome. Build a deliberate narrative: promise, proof, mechanism, objections, and one clear next action. Reuse registered compositions when they fit. Prefer a small coherent hierarchy over repetitive filler. Preserve unrelated existing content and express every change only as registered kernel commands.',
  references: {
    'checks/page-quality.md':
      'Check information hierarchy, section purpose, scan rhythm, repetition, mobile order, RTL reading order, and whether every call to action has a clear destination.',
    'patterns/narrative.md':
      'A strong default sequence is outcome-led hero, credibility, benefits tied to proof, how it works, objections or FAQ, then a focused final action. Adapt it to the actual request instead of forcing every section.',
  },
});

const DESIGN_DIRECTION: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.design-direction',
  name: 'Coherent design direction',
  description: 'Turn a visual request into a consistent hierarchy instead of isolated styling.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 50,
  activation: {
    mode: 'auto',
    keywords: ['design system', 'visual direction', 'redesign', 'هوية بصرية', 'إعادة تصميم'],
  },
  tags: ['design', 'responsive', 'visual'],
  instructions:
    'Choose one explicit visual direction and apply it consistently through the registered property vocabulary. Establish hierarchy through type scale, spacing rhythm, contrast, grouping, and restrained emphasis. Keep responsive behavior and both LTR and RTL composition in mind. Do not invent props, tokens, or block types that are absent from context.',
  references: {
    'checks/consistency.md':
      'Verify that repeated roles share treatment, emphasis is scarce, spacing communicates grouping, and decorative choices support rather than compete with content.',
  },
});

const ACCESSIBILITY: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.accessibility-review',
  name: 'Accessible content and structure',
  description: 'Review proposed structure and copy for inclusive, keyboard-friendly outcomes.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 40,
  activation: {
    mode: 'auto',
    keywords: ['accessibility', 'accessible', 'a11y', 'contrast', 'إمكانية الوصول', 'سهولة الوصول'],
  },
  tags: ['accessibility', 'content', 'quality'],
  instructions:
    'Preserve meaningful reading order, clear labels, concise link and button purpose, and a logical heading hierarchy. Avoid relying on color alone. Use only accessibility-related props that the registered schema actually exposes; otherwise explain the limitation in the rationale instead of inventing data.',
  references: {
    'checks/accessibility.md':
      'Check semantic order, control names, action clarity, focusable-control intent, text alternatives when supported, contrast intent, and direction-aware reading order.',
  },
});

const PRECISE_EDIT: AiSkillDefinitionV1 = builtin({
  schemaVersion: 1,
  id: 'craftkit.precise-edit',
  name: 'Surgical existing-content edit',
  description: 'Constrain a run to focused property, binding, and responsive edits.',
  version: '1.0.0',
  source: 'builtin',
  trust: 'builtin',
  priority: 100,
  activation: { mode: 'explicit' },
  tags: ['content', 'precision', 'safe-edit'],
  instructions:
    'Make the smallest change that fully satisfies the request. Resolve the target from selection and document content, preserve every unrelated node and property, and do not restructure or delete content. If the target is ambiguous, keep the plan narrow and state the ambiguity in the rationale.',
  restrictToCommands: ['setBinding', 'setProp', 'setResponsive'],
  references: {
    'checks/precision.md':
      'Confirm the selected or text-matched target, change only named properties, and avoid cosmetic cleanup unrelated to the request.',
  },
});

/** Reviewed, data-only defaults. Hosts opt in by constructing this registry. */
export const CRAFTKIT_AI_SKILL_DEFINITIONS: readonly AiSkillDefinitionV1[] = Object.freeze([
  PAGE_COMPOSITION,
  DESIGN_DIRECTION,
  ACCESSIBILITY,
  PRECISE_EDIT,
]);

export function createCraftkitAiSkillRegistry(
  additionalSkills: readonly AiSkillDefinitionV1[] = [],
): AiSkillRegistry {
  return createAiSkillRegistry([...CRAFTKIT_AI_SKILL_DEFINITIONS, ...additionalSkills]);
}
