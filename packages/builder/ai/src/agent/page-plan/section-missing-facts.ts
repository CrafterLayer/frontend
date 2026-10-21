import type { LandedNode } from './check-section';

/** Bounded, visibly marked missing information in any script; never an action label. */
export function plainMissingFact(label: string, line?: LandedNode): boolean {
  if (!/^\[[\p{L}\p{M}\p{N}\s'’.,/-]{1,80}\]$/u.test(label)) return false;
  for (let cursor = line; cursor !== undefined; cursor = cursor.parent) {
    if (cursor.node['tag'] === 'button') return false;
    if (cursor.node['tag'] !== 'a') continue;
    const attributes = cursor.node['attributes'];
    if (attributes === null || typeof attributes !== 'object') continue;
    const href = (attributes as Record<string, unknown>)['href'];
    if (typeof href === 'string') return false;
  }
  return true;
}

export function missingFactAdvice(found: string, contract: boolean, fact: boolean): string {
  if (contract)
    return `Replace "${found}" using only supplied facts. Omit missing details or mark them with a clear, plain missing-data label; never invent business or personal facts, metrics or contact details. Remove filler and fake addresses, including non-working links.`;
  return fact
    ? `Replace "${found}" with a supplied realistic value, or omit it and identify the missing information; never invent facts, use masks or fake contacts.`
    : `Replace "${found}" with supplied copy or a clear missing-data label; never invent facts or substitute filler.`;
}
