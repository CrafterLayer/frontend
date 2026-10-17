import { z } from 'zod';

import type { BlockSchema } from './blocks/define-block-schema';
import type { RegisteredCommand } from './commands';
import type { JsonValue } from './json/json-value';

/**
 * Derive the JSON Schema for a block's props — the AI-context half of the
 * "one manifest → many consumers" derivation chain. `defineBlockSchema` already
 * guarantees representability, so this never throws for accepted blocks.
 */
export function blockPropsJsonSchema(block: BlockSchema): JsonValue {
  return z.toJSONSchema(block.props) as JsonValue;
}

/**
 * Derive a JSON-only argument contract without exposing the registered command
 * implementation or its live Zod object to AI context collectors.
 */
export function commandArgsJsonSchema(command: Pick<RegisteredCommand, 'argsSchema'>): JsonValue {
  return z.toJSONSchema(command.argsSchema, { unrepresentable: 'any' }) as JsonValue;
}
