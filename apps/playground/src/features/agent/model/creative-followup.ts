import type { BuilderDocument, IntentRoute, Node } from '@craftkit/builder';

import { outcomeKeyOf, type Turn } from './turns';

export type CreativeFollowupResolution =
  | { readonly kind: 'none' }
  | { readonly kind: 'target'; readonly id: string }
  | { readonly kind: 'clarify'; readonly reason: 'missing' | 'ambiguous' };

interface FollowupInput {
  readonly request: string;
  readonly route: IntentRoute;
  readonly document: BuilderDocument;
  readonly pointed: readonly string[];
  readonly turns: readonly Turn[];
  /** Live build records prove these turns belong to another page. */
  readonly otherPageBuilds?: ReadonlySet<string>;
  readonly otherPageEdits?: ReadonlySet<string>;
  readonly transactionIds?: ReadonlySet<string>;
  readonly predecessorTurnId?: string | undefined;
}

const NONE: CreativeFollowupResolution = { kind: 'none' };

function normalized(text: string): string {
  return text
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064b-\u065f\u0670\u0640]/gu, '')
    .replace(/[أإآ]/gu, 'ا')
    .replace(/ة/gu, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** A conservative fast path, never a language gate for the ordinary edit writer. */
function refersToArtifact(request: string): boolean {
  return /(?:^| )(?:it|its|this|that|them|same|continue|extend|mural|scene|story|game|جداريه|الجداريه|جداريات|مشهد|المشهد|قصه|القصه|لعبه|اللعبه|اكمل|كمل|خليها|خليه|عدلها|عدله|فيها|فيه|عليها|عليه|لها|له|هاي|هذي|هذه|هذا)(?: |$)/u.test(
    request,
  );
}

function continuesArtifact(request: string): boolean {
  return (
    /(?:^| )(?:continue|extend|اكمل|كمل|واصل|تابع)(?: |$)/u.test(request) &&
    refersToArtifact(request)
  );
}

function namesCreativeArtifact(request: string): boolean {
  return /(?:^| )(?:mural|scene|story|game|جداريه|الجداريه|جداريات|مشهد|المشهد|قصه|القصه|لعبه|اللعبه)(?: |$)/u.test(
    request,
  );
}

type Medium = 'mural' | 'story' | 'game';

function mediaIn(text: string): Medium[] {
  const kinds: Medium[] = [];
  if (/(?:^| )(?:mural|جداريه|الجداريه|جداريات)(?: |$)/u.test(text)) kinds.push('mural');
  if (/(?:^| )(?:story|قصه|القصه)(?: |$)/u.test(text)) kinds.push('story');
  if (/(?:^| )(?:game|لعبه|اللعبه)(?: |$)/u.test(text)) kinds.push('game');
  return kinds;
}

function namedMedium(text: string): Medium | undefined {
  const kinds = mediaIn(text);
  return kinds.length === 1 ? kinds[0] : undefined;
}

/** Distinguish an added object ("a game") from its destination ("inside the mural"). */
function targetMedium(request: string): {
  medium?: Medium;
  anaphoric?: true;
  destination?: true;
  ambiguous?: true;
} {
  const destination =
    /(?:^| )(?:to|inside|within|in|on|في|داخل|على|الى) (?:(?:the|this|existing|current) )*(\S+)/u.exec(
      request,
    )?.[1];
  const named = destination === undefined ? undefined : namedMedium(destination);
  if (named !== undefined) return { medium: named, destination: true };
  for (const word of request.split(' ')) {
    const attached = /^[لب]/u.test(word)
      ? namedMedium(word.replace(/^(?:لل|بال|ل|ب)/u, ''))
      : undefined;
    if (attached !== undefined) return { medium: attached, destination: true };
  }
  if (
    /(?:^| )(?:to|inside|within|in|on) (?:it|them)(?: |$)|(?:^| )(?:فيها|فيه|عليها|عليه|لها|له|اليها|اليه|خليها|خليه|عدلها|عدله)(?: |$)/u.test(
      request,
    ) ||
    /^(?:make|change|update|extend|continue) it(?: |$)/u.test(request)
  )
    return { anaphoric: true };
  const medium = namedMedium(request);
  return medium !== undefined ? { medium } : mediaIn(request).length > 1 ? { ambiguous: true } : {};
}

function mediumOf(node: Node): Medium | undefined {
  const label = node.props['label'];
  const named = typeof label === 'string' ? namedMedium(normalized(label)) : undefined;
  if (named !== undefined) return named;
  const js = node.props['js'];
  if (typeof js !== 'string') return undefined;
  const libraries = (['mural', 'story', 'game'] as const).filter(
    (name) =>
      js.includes(`.lib.${name}.`) ||
      new RegExp(`\\blibs\\s*:\\s*\\[[^\\]]*['"]${name}['"]`, 'u').test(js),
  );
  return libraries.length === 1 ? libraries[0] : undefined;
}

function isCreative(node: Node): boolean {
  const js = node.props['js'];
  return (
    node.type === 'customCode' &&
    typeof js === 'string' &&
    /\bck\s*\.\s*(?:scene|stage)\s*\(/u.test(js)
  );
}

/** Only reachable current-page nodes count; detached objects are not visible targets. */
function pageNodes(document: BuilderDocument): Node[] {
  const found: Node[] = [];
  const seen = new Set<string>([document.rootId]);
  const stack = Object.values(document.nodes[document.rootId]?.slots ?? {}).flat();
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = document.nodes[id];
    if (node === undefined) continue;
    found.push(node);
    stack.push(...Object.values(node.slots ?? {}).flat());
  }
  return found;
}

function latestTargets(input: FollowupInput): readonly string[] | undefined {
  const unavailable = input.predecessorTurnId === undefined ? undefined : [];
  const turns =
    input.predecessorTurnId === undefined
      ? [...input.turns].reverse()
      : input.turns.filter((turn) => turn.id === input.predecessorTurnId);
  for (const turn of turns) {
    if (
      turn.kind === 'edit' &&
      (turn.status === 'done' ||
        (input.predecessorTurnId !== undefined && turn.status === 'noChange')) &&
      turn.outcome?.kind !== 'undone'
    ) {
      // Reload discarded page/runtime authority; a matching id alone cannot restore it.
      if (turn.revived === true) return unavailable;
      if (input.otherPageEdits?.has(turn.id) === true) return [];
      if (
        turn.transactionId !== undefined &&
        input.transactionIds !== undefined &&
        !input.transactionIds.has(turn.transactionId)
      )
        return [];
      return turn.targetNodeId === undefined ? unavailable : [turn.targetNodeId];
    }
    if (
      input.predecessorTurnId !== undefined &&
      turn.kind === 'proposal' &&
      turn.status === 'ready'
    ) {
      if (input.otherPageEdits?.has(turn.id) === true) return [];
      return turn.targetNodeId === undefined ? unavailable : [turn.targetNodeId];
    }
    if (turn.kind === 'build' && turn.status === 'settled' && turn.undone !== true) {
      if (turn.revived === true) return unavailable;
      if (input.otherPageBuilds?.has(turn.id) === true) return [];
      const creative = turn.progress.tasks.filter((task) => {
        const node = input.document.nodes[task.id];
        return node === undefined || isCreative(node);
      });
      if (creative.length === 0) return unavailable;
      return creative
        .filter(
          (task) =>
            task.status === 'landed' && turn.outcomes[outcomeKeyOf(task)]?.kind !== 'undone',
        )
        .map((task) => task.id);
    }
  }
  // A failed/stopped/removed predecessor must not silently revive an older target.
  return unavailable;
}

/**
 * Resolve ownership from authored labels and applied records, never from assistant prose.
 * Explicit creation, questions and generic page edits retain their existing routing.
 */
export function resolveCreativeFollowup(input: FollowupInput): CreativeFollowupResolution {
  if (input.route.kind !== 'edit') return NONE;
  const nodes = pageNodes(input.document);
  const reachable = new Set(nodes.map((node) => node.id));
  if (input.pointed.length > 0) {
    return input.pointed.every((id) => reachable.has(id))
      ? NONE
      : { kind: 'clarify', reason: 'missing' };
  }
  const request = normalized(input.request);
  if (
    /(?:^| )(?:page|website|site|صفحه|الصفحه|الموقع)(?: |$)/u.test(request) ||
    /(?:^| )(?:all|both|every)(?: the| existing)? (?:murals?|scenes?|stories|games?|sections?)(?: |$)|(?:^| )(?:كل|جميع|كلا) (?:ال)?(?:جداريات|مشاهد|قصص|العاب|اقسام)(?: |$)/u.test(
      request,
    )
  )
    return NONE;
  const target = targetMedium(request);
  const named = nodes.filter((node) => {
    if (target.anaphoric === true) return false;
    if (target.destination === true && mediumOf(node) !== target.medium) return false;
    const raw = node.props['label'];
    const label = typeof raw === 'string' ? normalized(raw) : '';
    return label.length >= 2 && ` ${request} `.includes(` ${label} `);
  });
  // A named ordinary section also wins over an older creative target.
  if (named.length > 0) {
    if (named.length > 1 && named.some((node) => !isCreative(node))) return NONE;
    const first = named[0];
    return named.length === 1 && first !== undefined
      ? { kind: 'target', id: first.id }
      : { kind: 'clarify', reason: 'ambiguous' };
  }
  if (!refersToArtifact(request)) return NONE;
  const creative = nodes.filter(isCreative);
  if (target.ambiguous === true && creative.length > 1)
    return { kind: 'clarify', reason: 'ambiguous' };
  const medium = target.medium;
  const matching = medium === undefined ? [] : creative.filter((node) => mediumOf(node) === medium);
  const relevant = matching.length > 0 ? matching : creative;
  const previous = latestTargets(input);
  if (previous !== undefined) {
    const current = relevant.filter(
      (node) => previous.includes(node.id) && (medium === undefined || mediumOf(node) === medium),
    );
    const first = current[0];
    if (current.length === 1 && first !== undefined) return { kind: 'target', id: first.id };
    if (current.length > 1) return { kind: 'clarify', reason: 'ambiguous' };
    if (previous.length === 0 || previous.every((id) => !reachable.has(id)))
      return { kind: 'clarify', reason: 'missing' };
    const ordinary = nodes.filter((node) => previous.includes(node.id));
    const last = ordinary[0];
    if (
      (!namesCreativeArtifact(request) || target.anaphoric === true) &&
      ordinary.length === 1 &&
      last !== undefined
    )
      return { kind: 'target', id: last.id };
    if (!namesCreativeArtifact(request)) return NONE;
  }
  const first = relevant[0];
  if (relevant.length === 1 && first !== undefined) {
    const known = mediumOf(first);
    return medium !== undefined && known !== undefined && medium !== known
      ? { kind: 'clarify', reason: 'missing' }
      : { kind: 'target', id: first.id };
  }
  if (relevant.length > 1) return { kind: 'clarify', reason: 'ambiguous' };
  return continuesArtifact(request) ? { kind: 'clarify', reason: 'missing' } : NONE;
}
