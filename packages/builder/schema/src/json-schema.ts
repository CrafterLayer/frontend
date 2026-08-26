import { z } from 'zod';

import type { BlockSchema } from './blocks/define-block-schema';
import type { JsonValue } from './json/json-value';

/**
 * Derive the JSON Schema for a block's props — the AI-context half of the
 * "one manifest → many consumers" derivation chain. `defineBlockSchema` already
 * guarantees representability, so this never throws for accepted blocks.
 */
export function blockPropsJsonSchema(block: BlockSchema): JsonValue {
  return z.toJSONSchema(block.props) as JsonValue;
}
