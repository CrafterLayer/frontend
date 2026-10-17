/**
 * What a run remembers of its conversation (2026-10-13).
 *
 * The person found the agent forgetting what was said a few messages back, and its prompt
 * cache rarely reading the conversation. Measured through the real client and server: the
 * history was the newest 12 messages, so after six exchanges every request dropped the
 * oldest one — the agent forgot it, and because the conversation changed from its FIRST
 * message, the cached conversation could never be read again. Three changes:
 *
 * - The window holds up to `HISTORY_MAX_MESSAGES`, and moves in steps of
 *   `HISTORY_STEP_MESSAGES` rather than one exchange at a time: between two steps every
 *   request only appends, so the cache reads the whole conversation before it.
 * - What the window leaves behind is not lost: the first kept request carries a short,
 *   deterministic digest of the earlier ones (each request and what came of it, clipped),
 *   which only changes when the window steps.
 * - The assistant's own line says more: a build names the sections it wrote, a page plan
 *   the sections it proposes, so "make the second section shorter" has something to point at.
 */
import type { AiChatTurn, AiSkillPrepareOptions, AiSkillRegistry } from '@craftkit/builder';

import type { Turn, UserTurn } from './turns';

/** The most messages sent as history; past this, the window steps forward. */
export const HISTORY_MAX_MESSAGES = 40;
/** How far the window steps at once: it stays still (and cached) for this many messages. */
export const HISTORY_STEP_MESSAGES = 16;
/** The longest a request or an answer stays inside the digest of earlier messages. */
const DIGEST_ENTRY_CHARS = 160;
/** The most earlier exchanges the digest lists; older ones are counted, not listed. */
const DIGEST_MAX_EXCHANGES = 24;

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
}

function sectionList(titles: readonly string[]): string {
  const named = titles.map((title) => title.trim()).filter((title) => title !== '');
  return named.length === 0 ? '' : ` Sections: ${named.join(', ')}.`;
}

/** The assistant's line for one turn: what it said, or what it did, in its own words. */
export function assistantWords(turn: Exclude<Turn, UserTurn>): string | null {
  switch (turn.kind) {
    case 'build': {
      const sections = sectionList(turn.progress.tasks.map((task) => task.title));
      const words = `${turn.progress.direction.trim()}${sections}`.trim();
      return words === '' ? null : words;
    }
    case 'edit':
      return turn.summary ?? null;
    case 'proposal':
      return turn.plan?.rationale ?? null;
    case 'page-plan': {
      const mood = turn.direction?.mood.trim() ?? '';
      const words = `${mood}${sectionList(turn.sections.map((section) => section.title))}`;
      return words.trim() === '' ? null : words.trim();
    }
    case 'step-plan':
      // The plan the assistant just wrote IS the answer: "do option two" needs it.
      return turn.text;
    case 'answer':
      return turn.text;
    case 'error':
      return turn.failure.message;
    case 'end':
      return null;
  }
}

function said(turns: readonly Turn[]): AiChatTurn[] {
  return turns.flatMap<AiChatTurn>((turn) => {
    if (turn.kind === 'user') return [{ role: 'user', text: turn.text }];
    const text = assistantWords(turn);
    return text === null || text.trim() === '' ? [] : [{ role: 'assistant', text }];
  });
}

/** The earlier messages as one short note: each request, then what came of it. */
function digestOf(earlier: readonly AiChatTurn[]): string {
  const exchanges: { request: string; answers: string[] }[] = [];
  for (const turn of earlier) {
    if (turn.role === 'user') exchanges.push({ request: turn.text, answers: [] });
    else exchanges.at(-1)?.answers.push(turn.text);
  }
  const listed = exchanges.slice(-DIGEST_MAX_EXCHANGES);
  const unlisted = exchanges.length - listed.length;
  const lines = listed.map(({ request, answers }) => {
    const answer = answers.length === 0 ? '' : ` → ${clip(answers.join(' '), DIGEST_ENTRY_CHARS)}`;
    return `- "${clip(request, DIGEST_ENTRY_CHARS)}"${answer}`;
  });
  return [
    `Earlier in this conversation (${String(exchanges.length)} older requests, oldest first):`,
    ...(unlisted > 0 ? [`- … ${String(unlisted)} more, not listed`] : []),
    ...lines,
  ].join('\n');
}

/**
 * The conversation a run carries: the person's words and the assistant's own, opening on a
 * person's turn (the Messages API's rule), never an empty line, in a window that moves in
 * steps and remembers what it left behind.
 */
export function historyOf(turns: readonly Turn[]): AiChatTurn[] {
  const all = said(turns);
  const step =
    all.length <= HISTORY_MAX_MESSAGES
      ? 0
      : Math.ceil((all.length - HISTORY_MAX_MESSAGES) / HISTORY_STEP_MESSAGES) *
        HISTORY_STEP_MESSAGES;
  const offset = all.slice(step).findIndex(({ role }) => role === 'user');
  if (offset === -1) return [];
  const start = step + offset;
  const window = all.slice(start);
  const earlier = all.slice(0, start);
  const first = window[0];
  if (first === undefined || !earlier.some(({ role }) => role === 'user')) return window;
  return [
    { role: 'user', text: `${digestOf(earlier)}\n\nThe request then:\n${first.text}` },
    ...window.slice(1),
  ];
}

/** The most skills a conversation keeps awake from its earlier turns. */
const MAX_CARRIED_SKILLS = 8;

/**
 * The skills that woke on their own (`auto`) in this conversation's recent turns, newest
 * first: carried into the next run (`carriedSkillIds`), so a follow-up in other words keeps
 * the skill set — and with it the cached prompt — of the conversation it continues.
 */
export function carriedSkillIdsOf(turns: readonly Turn[]): readonly string[] {
  const ids: string[] = [];
  for (const turn of [...turns].reverse()) {
    if (turn.kind === 'user') continue;
    for (const pin of ('skills' in turn ? turn.skills : undefined) ?? []) {
      if (pin.reason === 'auto' && !ids.includes(pin.id)) ids.push(pin.id);
    }
    if (ids.length >= MAX_CARRIED_SKILLS) break;
  }
  return ids.slice(0, MAX_CARRIED_SKILLS);
}

/** `registry` with this conversation's carried skills on every `prepare` it answers. */
export function withCarriedSkills(
  registry: AiSkillRegistry,
  carried: readonly string[],
): AiSkillRegistry {
  if (carried.length === 0) return registry;
  // Delegated by name, not spread: a host registry may keep its methods on a prototype.
  return Object.freeze({
    list: () => registry.list(),
    get: (id: string) => registry.get(id),
    readSkill: (id: string) => registry.readSkill(id),
    listReferences: (id: string) => registry.listReferences(id),
    readReference: (id: string, path: string) => registry.readReference(id, path),
    prepare: (options: AiSkillPrepareOptions) =>
      registry.prepare({
        ...options,
        carriedSkillIds: [...new Set([...(options.carriedSkillIds ?? []), ...carried])],
      }),
  });
}
