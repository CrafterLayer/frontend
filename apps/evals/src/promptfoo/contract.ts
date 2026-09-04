/**
 * The slice of promptfoo's contract this package actually touches, declared
 * structurally.
 *
 * promptfoo is a devDependency and its published types would be importable —
 * but importing them would make every file in `src/promptfoo/` depend on a
 * 200-file type graph in order to say "this object has an `id()` and a
 * `callApi()`". Worse, it would couple the harness's compilation to a tool it
 * only needs at the very edge. Six interfaces are cheaper and they document
 * the integration in one place, which is what someone debugging a loading
 * failure needs to read.
 *
 * The runtime contract these mirror (promptfoo 0.122.x):
 *   - a `file://` provider module's DEFAULT export is a class, constructed as
 *     `new Provider({ ...providerOptions, id })`;
 *   - a `tests: file://` module's default export may be a function, awaited
 *     and expected to return test cases;
 *   - a `javascript` assertion whose `value` is a function is called as
 *     `value(outputString, context)` and may return a boolean, a number, or a
 *     `{ pass, score, reason }` object.
 */

export interface PromptfooProviderOptions {
  id?: string;
  label?: string;
  config?: Record<string, unknown>;
}

export interface PromptfooCallContext {
  vars?: Record<string, unknown>;
}

export interface PromptfooProviderResponse {
  output?: string;
  error?: string;
  tokenUsage?: { total?: number; prompt?: number; completion?: number };
  cost?: number;
}

export interface PromptfooGradingResult {
  pass: boolean;
  score: number;
  reason: string;
}

export interface PromptfooAssertion {
  type: 'javascript' | 'llm-rubric';
  metric?: string;
  weight?: number;
  value: string | ((output: string, context: unknown) => PromptfooGradingResult);
}

export interface PromptfooTestCase {
  description: string;
  vars: Record<string, string>;
  assert: PromptfooAssertion[];
}
