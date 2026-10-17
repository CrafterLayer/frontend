import { StageRejectedError } from './errors';
import type { SiteStage } from '../wire';

/**
 * A stage answer's SHAPE, checked before its content.
 *
 * ## Why this file exists
 *
 * The wire types are TypeScript, and TypeScript is not on the wire. A remote
 * provider parses JSON a server produced; a scripted one returns whatever a
 * test hands it; a model can answer with a site object where commands were
 * asked for. Every one of those arrives as `unknown` wearing a type it may not
 * have.
 *
 * Before these guards existed, each validator reached straight for its field —
 * `response.commands.length`, `for (const page of response.pages)` — and a
 * malformed answer produced `Cannot read properties of undefined (reading
 * 'length')`. That is a message about JavaScript at the exact moment a person
 * needs a message about the model, and it escaped the stage machinery as a
 * TypeError rather than a `StageRejectedError`: no retry, no `stage.rejected`
 * event, no reason anyone could act on.
 *
 * So the shape is a REFUSAL like any other, and refusals are what the pipeline
 * is built to handle.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** The named field as an array, or a refusal that says what arrived instead. */
export function stageArray(
  stage: SiteStage,
  response: unknown,
  field: string,
  expectation: string,
): readonly unknown[] {
  const value = isRecord(response) ? response[field] : undefined;
  if (!Array.isArray(value)) {
    throw new StageRejectedError(stage, [`${expectation} ${describe(value)}`]);
  }
  return value;
}

/** The response itself as an object, or a refusal. */
export function stageRecord(
  stage: SiteStage,
  response: unknown,
  expectation: string,
): Record<string, unknown> {
  if (!isRecord(response)) {
    throw new StageRejectedError(stage, [`${expectation} ${describe(response)}`]);
  }
  return response;
}

/**
 * What arrived, in words a person can act on.
 *
 * Named rather than dumped: printing the value would put a whole site object
 * into an error message, and the useful fact is its KIND, not its contents.
 */
export function describe(value: unknown): string {
  if (value === null) return 'It sent null.';
  if (value === undefined) return 'It sent nothing there at all.';
  if (Array.isArray(value)) return 'It sent a list.';
  if (isRecord(value)) {
    const keys = Object.keys(value).slice(0, 4);
    return keys.length === 0
      ? 'It sent an empty object.'
      : `It sent an object with ${keys.map((key) => `"${key}"`).join(', ')}.`;
  }
  return `It sent a ${typeof value}.`;
}
