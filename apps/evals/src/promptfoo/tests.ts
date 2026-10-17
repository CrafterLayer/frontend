import { loadCorpus } from '../corpus/load';

import { assertionsFor } from './assert';
import type { PromptfooTestCase } from './contract';

/**
 * The suite, generated from the corpus at load time.
 *
 * Written as a function rather than as a YAML list so that adding a case is
 * dropping one JSON file into `apps/evals/corpus/` and nothing else. A YAML
 * list would be a second place to remember, and the day someone forgets it the
 * eval silently stops covering the case they just wrote.
 */
export function evalTestCases(): PromptfooTestCase[] {
  return loadCorpus().map((evalCase) => ({
    description: `${evalCase.id} — ${evalCase.title}`,
    vars: {
      caseId: evalCase.id,
      /*
        Shown in the report so a row is readable without opening the corpus.
        The provider deliberately does NOT run this value — it re-reads the
        request from the case file — because three of these requests are
        prompt injections and must not pass through a template engine first.
      */
      request: evalCase.request,
      category: evalCase.category,
    },
    assert: assertionsFor(evalCase),
  }));
}

export default evalTestCases;
