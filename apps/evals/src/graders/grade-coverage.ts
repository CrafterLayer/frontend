import type { EvalCase } from '../corpus/types';
import type { EvalRunOutput } from '../harness/output';

import { commandNames, insertedBlockTypes } from './plan-inspect';
import type { GradeResult } from './types';

interface Clause {
  label: string;
  met: boolean;
}

/**
 * How much of what a GOOD answer does did this answer do?
 *
 * This grader never fails a run, and that is a decision rather than an
 * oversight. The clauses it checks are the aspirational half of a case — a
 * landing page wants four sections, a long brief wants ten — and a gate that
 * is red on the day it is written is a gate everybody learns to ignore. As a
 * number it does the job a gate cannot: it moves when a prompt change makes
 * the planner more or less complete, in either direction, on the very first
 * run after the change.
 *
 * Treat it as a ratchet. Read the score in the promptfoo summary, and when it
 * climbs, keep it there.
 */
export function gradeCoverage(output: EvalRunOutput, evalCase: EvalCase): GradeResult {
  const { should } = evalCase;
  const clauses: Clause[] = [];
  const plan = output.plan;
  const commands = plan === null ? [] : commandNames(plan);
  const blockTypes = new Set(plan === null ? [] : insertedBlockTypes(plan));

  if (should.minCommands !== undefined) {
    clauses.push({
      label: `at least ${String(should.minCommands)} command(s) (had ${String(commands.length)})`,
      met: commands.length >= should.minCommands,
    });
  }
  if (should.maxCommands !== undefined) {
    clauses.push({
      label: `at most ${String(should.maxCommands)} command(s) (had ${String(commands.length)})`,
      met: commands.length <= should.maxCommands,
    });
  }
  if (should.anyCommands !== undefined) {
    clauses.push({
      label: `uses one of ${should.anyCommands.join('/')}`,
      met: should.anyCommands.some((command) => commands.includes(command)),
    });
  }
  if (should.anyBlockTypes !== undefined) {
    clauses.push({
      label: `inserts one of ${should.anyBlockTypes.join('/')}`,
      met: should.anyBlockTypes.some((type) => blockTypes.has(type)),
    });
  }
  /*
    `allBlockTypes` counts one clause PER TYPE rather than one clause for the
    whole list. A ten-section brief that produced nine sections and a brief
    that produced none would otherwise score identically, which is precisely
    the distinction this number exists to make.
  */
  for (const type of should.allBlockTypes ?? []) {
    clauses.push({ label: `inserts a ${type}`, met: blockTypes.has(type) });
  }
  for (const type of should.forbiddenBlockTypes ?? []) {
    clauses.push({ label: `does not insert another ${type}`, met: !blockTypes.has(type) });
  }

  if (clauses.length === 0) {
    return { pass: true, score: 1, reason: 'This case declares no coverage clauses.' };
  }

  /*
    No plan means no coverage — zero, not partial.

    Half of these clauses are NEGATIVE: "at most six commands", "does not insert
    another hero". An answer that produced nothing satisfies every one of them
    vacuously, so a refusal to an answerable request was collecting free credit
    and scoring 0.2 while having covered exactly nothing. Free credit for
    inaction is the single thing a coverage metric must never give, because it
    makes refusing safer than trying — and a corpus that rewards refusal will
    quietly train the prompt toward it.

    `pass` stays true because this grader measures how MUCH of the brief was
    answered, not whether answering was required. Whether a refusal was
    legitimate is the outcome grader's question, and it is asked there against
    the case's own `must.outcome`.
  */
  if (plan === null) {
    return {
      pass: true,
      score: 0,
      reason: `Coverage 0% — no plan was produced, so none of the ${String(clauses.length)} clause(s) were covered.`,
    };
  }

  const met = clauses.filter((clause) => clause.met);
  const missed = clauses.filter((clause) => !clause.met);
  const score = met.length / clauses.length;
  return {
    pass: true,
    score,
    reason:
      missed.length === 0
        ? `Coverage 100%: all ${String(clauses.length)} clause(s) met.`
        : `Coverage ${String(Math.round(score * 100))}% — missing: ${missed
            .map((clause) => clause.label)
            .join('; ')}.`,
  };
}
