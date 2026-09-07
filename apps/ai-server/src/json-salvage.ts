/**
 * Bare JSON out of an answer a model dressed up.
 *
 * Every backend does it sometimes — the CLI's Sonnet as readily as a free
 * OpenRouter model: a plan inside a ```json fence, a sentence before or after
 * it, a reasoning model's `<think>` block left in the content, a trailing
 * comma. The object is what `claude.ts` parses, and the plan's CONTENT still
 * decides whether it is valid two layers later; this only undoes the
 * wrappers that would fail it for reasons that have nothing to do with the
 * plan. An answer with no object in it is returned as it was.
 */
export function salvageJson(text: string): string {
  return salvageCommas(objectIn(text));
}

function objectIn(text: string): string {
  // Some providers leave the reasoning model's own <think> block in the content.
  const trimmed = text.replace(/<think>[\s\S]*?<\/think>/giu, '').trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  const fenced = /^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/u.exec(trimmed);
  if (fenced?.[1] !== undefined) return objectIn(fenced[1]);
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  return start >= 0 && end > start ? trimmed.slice(start, end + 1) : text;
}

/** Whether `JSON.parse` accepts the text as it is. */
export function parsesAsJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * A trailing comma is the commonest way a model breaks otherwise-sound JSON.
 * Eased only when the text does not parse as it is and does afterwards, so a
 * valid answer is never touched and an invalid one is never made worse.
 */
function salvageCommas(text: string): string {
  if (parsesAsJson(text)) return text;
  const eased = text.replace(/,\s*([}\]])/gu, '$1');
  return parsesAsJson(eased) ? eased : text;
}

/** `JSON.parse`'s own complaint, with the position it names — the owner's shortest path to the defect. */
export function jsonParseError(text: string): string | undefined {
  try {
    JSON.parse(text);
    return undefined;
  } catch (cause) {
    return cause instanceof Error ? cause.message : String(cause);
  }
}
