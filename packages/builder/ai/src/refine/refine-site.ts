import type { BuilderSiteKernel } from '@craftkit/builder-core';
import { isColorToken, type TokenName } from '@craftkit/builder-schema';

import { runAiAgent } from '../agent/run-agent';
import type { AiPlanProvider, AiValidationPorts } from '../types';
import { resolveRefineTarget, type RefineTarget } from './resolve-target';

/**
 * A follow-up that changes its target and nothing else (FR-036, FR-037).
 *
 * ## The order, and why it is not negotiable
 *
 * Resolve, refuse, propose, validate, apply. The refusal comes BEFORE a model
 * is asked anything: a request naming a page the site does not have cannot keep
 * the isolation promise, so spending a call to discover that is both slower and
 * more dangerous — a model asked about a page that does not exist will
 * helpfully change one that does.
 *
 * ## Why there is no second write path (FR-040)
 *
 * A page refinement is `generateAiPlan` + `applyAiPlan` against that page's
 * LENS — the identical machinery a generation uses, pointed at one page. There
 * is no refinement validator, no refinement applier, and no refinement command
 * policy. That is the whole design: a second path would be a second set of
 * rules about what an agent may write, and the day the two disagreed the
 * narrower one would be the one nobody remembered to update.
 *
 * A design-system refinement is the one exception in SHAPE, not in principle:
 * it goes through `setDesignToken`, the door that already owns legibility.
 */

export interface RefineSiteOptions {
  readonly site: BuilderSiteKernel;
  readonly request: string;
  readonly provider: AiPlanProvider;
  readonly validationPorts: AiValidationPorts;
  /** Skips resolution when the host already knows what a person clicked. */
  readonly target?: RefineTarget | undefined;
  readonly signal?: AbortSignal | undefined;
  readonly label?: string | undefined;
  /** Ids and timestamps come only from ports (Law D). */
  readonly runId: string;
  readonly clock: { now: () => number };
}

export interface RefineAdjustment {
  readonly token: TokenName;
  readonly asked: string;
  readonly used: string;
  readonly reason: string;
}

export type RefineSiteResult =
  | {
      readonly ok: true;
      readonly target: RefineTarget;
      /** What the door was told to do, so a caller can say what changed. */
      readonly steps: number;
      /** A value the door would have refused, and what was used instead (FR-039). */
      readonly adjustments: readonly RefineAdjustment[];
    }
  | { readonly ok: false; readonly reason: string; readonly target?: RefineTarget | undefined };

/** The lens a target names, or undefined for a target that is not a page. */
function pageOf(site: BuilderSiteKernel, target: RefineTarget) {
  if (target.kind !== 'page' && target.kind !== 'node') return undefined;
  return site.pages().includes(target.pageId) ? site.page(target.pageId) : undefined;
}

export async function refineSite(options: RefineSiteOptions): Promise<RefineSiteResult> {
  const { site, request, provider, validationPorts, signal, label } = options;

  /* 1. RESOLVE — and refuse here, before anything is proposed or written. */
  let target = options.target;
  if (target === undefined) {
    const resolved = resolveRefineTarget(site.getSite(), request);
    if (!resolved.ok) {
      return { ok: false, reason: resolved.reason };
    }
    target = resolved.target;
  }

  if (target.kind === 'page' || target.kind === 'node') {
    const lens = pageOf(site, target);
    if (lens === undefined) {
      return { ok: false, target, reason: `This site has no page "${target.pageId}".` };
    }

    /*
      2 and 3. PROPOSE, VALIDATE and APPLY — through `runAiAgent`, the ONE path
      a generation takes. Not `generateAiPlan` + `applyAiPlan` assembled here:
      that would be a second arrangement of the same parts, with its own chance
      to forget the validated-proposal authority the real path carries.
    */
    let run;
    try {
      run = await runAiAgent({
        runId: options.runId,
        clock: { now: options.clock.now },
        kernel: lens,
        provider,
        request,
        validationPorts,
        /*
          A refinement WRITES. `runAiAgent` defaults to `'never'` — proposing and
          waiting for a person — which is right for a panel and wrong here: the
          caller has already decided, and a refinement that only ever proposed
          would leave `refineSite` unable to keep the one promise it makes.
        */
        apply: 'auto',
        ...(target.kind === 'node' ? { selection: [target.nodeId] } : {}),
        ...(signal === undefined ? {} : { signal }),
      });
    } catch (error: unknown) {
      return {
        ok: false,
        target,
        reason: error instanceof Error ? error.message : 'The refinement could not be planned.',
      };
    }

    void label;
    return run.status === 'applied'
      ? { ok: true, target, steps: run.plan.commands.length, adjustments: [] }
      : {
          ok: false,
          target,
          reason: 'The refinement was proposed but not applied by this run.',
        };
  }

  if (target.kind === 'design-system') {
    return refineDesignSystem(site, request, target.token, label);
  }

  return {
    ok: false,
    target,
    reason: 'Refining the whole site is a regeneration, not a refinement.',
  };
}

/*
  The colour vocabulary a follow-up may reach for, and the step each one moves.
  Deliberately small: "darker" and "lighter" are the two things a person says
  about a colour that a rule can honour without inventing a palette.
*/
const DARKER = [/\bdarker\b/iu, /\bdeeper\b/iu, /أغمق/u];
const LIGHTER = [/\blighter\b/iu, /\bpaler\b/iu, /أفتح/u];
const STEP = 0.12;

function shift(hex: string, amount: number): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((channel) => channel + channel)
          .join('')
      : value;
  const channels = [0, 2, 4].map((at) => Number.parseInt(full.slice(at, at + 2), 16));
  const moved = channels.map((channel) =>
    Math.max(0, Math.min(255, Math.round(channel + 255 * amount))),
  );
  return `#${moved.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * "Make it darker", resolved to a value the door will accept (FR-039).
 *
 * The adjustment is REPORTED rather than applied silently. A person who asked
 * for darker and got two steps darker because one was illegible has been
 * overruled, and being told is the difference between a tool that has taste and
 * one that ignores you.
 */
function refineDesignSystem(
  site: BuilderSiteKernel,
  request: string,
  token: TokenName | undefined,
  label: string | undefined,
): RefineSiteResult {
  const target: RefineTarget =
    token === undefined ? { kind: 'design-system' } : { kind: 'design-system', token };
  const name = token ?? 'accent';
  if (!isColorToken(name)) {
    return { ok: false, target, reason: `"${name}" is not a colour, so it cannot be shaded.` };
  }

  const direction = DARKER.some((pattern) => pattern.test(request))
    ? -1
    : LIGHTER.some((pattern) => pattern.test(request))
      ? 1
      : 0;
  if (direction === 0) {
    return {
      ok: false,
      target,
      reason: 'Say which way to move the colour — darker or lighter.',
    };
  }

  const current = site.getSite().designSystem.tokens[name];
  const adjustments: RefineAdjustment[] = [];

  /*
    Try the asked-for step first, then smaller ones. The DOOR decides: it owns
    legibility (FR-014), and a rule here that computed contrast would be a
    second answer to the same question.
  */
  for (const scale of [1, 0.66, 0.33]) {
    const value = shift(current, direction * STEP * scale);
    try {
      site.dispatch('setDesignToken', { token: name, value }, 'ai');
      if (scale !== 1) {
        adjustments.push({
          token: name,
          asked: shift(current, direction * STEP),
          used: value,
          reason: 'The colour asked for would have left text on it unreadable.',
        });
      }
      void label;
      return { ok: true, target, steps: 1, adjustments };
    } catch {
      /* Refused for legibility; try a smaller move. */
    }
  }

  return {
    ok: false,
    target,
    reason: 'Every shade in that direction would have made text on it unreadable.',
  };
}
