/**
 * Fixtures for the "Skills & memory" place (2026-10-12): seeded skills and notes in an
 * in-memory storage (so `useAgentKnowledge` loads them as it would from the browser), and an
 * in-memory checkpoint port whose restore answers what the story or test asks.
 */
import type { AgentCheckpoint, AgentCheckpointPort, CheckpointRestore } from '../model/checkpoints';
import type { AgentStorage } from '../model/migrate-sessions';
import { PROJECT_MEMORY_KEY, type MemoryNote } from '../model/project-memory';
import type { UserSkill } from '../model/user-skills';
import { USER_SKILLS_KEY } from '../model/user-skills-store';

export const SAMPLE_SKILLS: readonly UserSkill[] = [
  {
    id: 'user.skill-1',
    name: 'Brand voice',
    description: 'Headlines, buttons and every line of copy',
    instructions:
      'Write short, warm sentences in the second person. Never use exclamation marks. Buttons say what happens next: "Book a table", not "Submit".',
    keywords: ['copy', 'headline', 'button'],
    mode: 'auto',
    enabled: true,
  },
  {
    id: 'user.skill-2',
    name: 'House style',
    description: 'Every page',
    instructions:
      'Use generous white space, one accent colour per section and rounded corners of 12px. Every page ends with the booking band.',
    keywords: [],
    mode: 'always',
    enabled: true,
  },
  {
    id: 'user.skill-3',
    name: 'Seasonal menu',
    description: 'Menu pages in winter',
    instructions: 'Lead with soups and hot drinks; mark seasonal dishes with a small leaf icon.',
    keywords: ['menu', 'winter'],
    mode: 'auto',
    enabled: false,
  },
];

export const SAMPLE_SKILLS_AR: readonly UserSkill[] = [
  {
    id: 'user.skill-1',
    name: 'نبرة العلامة',
    description: 'العناوين والأزرار وكل النصوص',
    instructions: 'اكتب جملًا قصيرة ودافئة بصيغة المخاطب. الأزرار تقول ما سيحدث: «احجز طاولة».',
    keywords: ['نص', 'عنوان'],
    mode: 'auto',
    enabled: true,
  },
  {
    id: 'user.skill-2',
    name: 'أسلوب المنزل',
    description: 'كل الصفحات',
    instructions: 'مساحات بيضاء واسعة، ولون مميّز واحد لكل قسم، وكل صفحة تنتهي بشريط الحجز.',
    keywords: [],
    mode: 'always',
    enabled: true,
  },
];

export const SAMPLE_NOTES: readonly MemoryNote[] = [
  { id: 'note-1', kind: 'preference', text: 'Our brand colour is forest green; never use red.' },
  { id: 'note-2', kind: 'site-fact', text: 'The café is closed on Fridays.' },
  { id: 'note-3', kind: 'preference', text: 'Photos show people, not empty rooms.' },
];

export const SAMPLE_NOTES_AR: readonly MemoryNote[] = [
  { id: 'note-1', kind: 'preference', text: 'اكتب دائمًا بالعربية الفصحى المبسّطة.' },
  { id: 'note-2', kind: 'site-fact', text: 'المقهى مغلق يوم الجمعة.' },
];

/** Fixed times, so stories and screenshots never change between runs. */
const AT = Date.UTC(2026, 9, 12, 11, 40);

export const SAMPLE_CHECKPOINTS: readonly AgentCheckpoint[] = [
  { id: 'cp-3', label: 'Make the hero darker and add a booking button', at: AT, kind: 'auto' },
  { id: 'cp-2', label: 'Before the new menu', at: AT - 25 * 60_000, kind: 'manual' },
  { id: 'cp-1', label: 'Build a landing page for a café', at: AT - 60 * 60_000, kind: 'auto' },
];

export const SAMPLE_CHECKPOINTS_AR: readonly AgentCheckpoint[] = [
  { id: 'cp-2', label: 'اجعل الواجهة أغمق وأضف زر حجز', at: AT, kind: 'auto' },
  { id: 'cp-1', label: 'قبل القائمة الجديدة', at: AT - 25 * 60_000, kind: 'manual' },
];

/** An in-memory storage holding the given skills and notes under their real keys. */
export function seededStorage(
  skills: readonly UserSkill[] = [],
  notes: readonly MemoryNote[] = [],
): AgentStorage {
  const items = new Map<string, string>([
    [USER_SKILLS_KEY, JSON.stringify(skills)],
    [PROJECT_MEMORY_KEY, JSON.stringify(notes)],
  ]);
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => {
      items.set(key, value);
    },
  };
}

export interface FakeCheckpointsOptions {
  /** What every restore answers; `restored` by default. */
  readonly restore?: CheckpointRestore | undefined;
  /** Whether a save succeeds; `true` by default. */
  readonly saves?: boolean | undefined;
  /** A list that never arrives (the loading line). */
  readonly pending?: boolean | undefined;
}

/** An in-memory checkpoint port: saves prepend, `before` records the turn, restores answer. */
export function createFakeCheckpoints(
  initial: readonly AgentCheckpoint[] = SAMPLE_CHECKPOINTS,
  options: FakeCheckpointsOptions = {},
): AgentCheckpointPort & { readonly restored: string[]; readonly turns: Map<string, string> } {
  let points = [...initial];
  let next = points.length + 1;
  const listeners = new Set<() => void>();
  const restored: string[] = [];
  const turns = new Map<string, string>();
  const changed = () => {
    for (const listener of [...listeners]) listener();
  };
  const add = (label: string, kind: AgentCheckpoint['kind']): AgentCheckpoint => {
    const point: AgentCheckpoint = { id: `cp-new-${String(next)}`, label, at: AT, kind };
    next += 1;
    points = [point, ...points];
    changed();
    return point;
  };
  const answer = (id: string): Promise<CheckpointRestore> => {
    restored.push(id);
    return Promise.resolve(options.restore ?? 'restored');
  };
  return {
    restored,
    turns,
    before: (turnId, label) => {
      turns.set(turnId, add(label, 'auto').id);
    },
    restoreBefore: (turnId) => {
      const id = turns.get(turnId);
      return id === undefined ? Promise.resolve('missing') : answer(id);
    },
    list: () =>
      options.pending === true
        ? new Promise<readonly AgentCheckpoint[]>(() => undefined)
        : Promise.resolve(points),
    restore: answer,
    save: (label) => Promise.resolve(options.saves === false ? undefined : add(label, 'manual')),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
