import type { JsonValue } from '@craftkit/builder-schema';

import type {
  AiBlockContext,
  AiBlockExampleContext,
  AiPlan,
  AiPlanProvider,
  AssembledAiContext,
} from '../types';

const NUMBER_WORDS: Readonly<Record<string, number>> = Object.freeze({
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  واحد: 1,
  واحدة: 1,
  اثنان: 2,
  اثنين: 2,
  اثنتان: 2,
  اثنتين: 2,
  ثلاث: 3,
  ثلاثة: 3,
  أربع: 4,
  اربعة: 4,
  أربعة: 4,
});

const NON_SPACING_MARKS = /\p{M}+/gu;
const WORDS = /[\p{L}\p{N}]+/gu;
const ARABIC_INDIC_DIGITS = /[٠-٩۰-۹]/gu;
const DIGIT_VALUE: Readonly<Record<string, string>> = Object.freeze({
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
  '۰': '0',
  '۱': '1',
  '۲': '2',
  '۳': '3',
  '۴': '4',
  '۵': '5',
  '۶': '6',
  '۷': '7',
  '۸': '8',
  '۹': '9',
});

const REQUEST_STOP_WORDS: ReadonlySet<string> = new Set([
  'a',
  'add',
  'an',
  'create',
  'for',
  'insert',
  'make',
  'please',
  'put',
  'the',
  'to',
  'with',
]);

export class LocalAiProviderError extends Error {
  override readonly name = 'LocalAiProviderError';
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalize(value: string): string {
  return value.normalize('NFKD').replace(NON_SPACING_MARKS, '').toLowerCase();
}

function words(value: string): readonly string[] {
  return normalize(value).match(WORDS) ?? [];
}

function wordSet(value: string): ReadonlySet<string> {
  return new Set(words(value).filter((word) => !REQUEST_STOP_WORDS.has(word)));
}

function singular(value: string): string {
  return value.endsWith('s') && value.length > 1 ? value.slice(0, -1) : value;
}

function overlapScore(requestWords: ReadonlySet<string>, text: string, weight: number): number {
  let score = 0;
  for (const word of wordSet(text)) {
    if (requestWords.has(word) || requestWords.has(singular(word))) {
      score += weight;
    }
  }
  return score;
}

function isJsonRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map(cloneJson);
  }
  if (!isJsonRecord(value)) {
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, cloneJson(child)]));
}

function schemaProperties(block: AiBlockContext): Record<string, JsonValue> {
  if (!isJsonRecord(block.propsSchema)) {
    return {};
  }
  const properties = block.propsSchema['properties'];
  return isJsonRecord(properties) ? properties : {};
}

function scoreBlock(block: AiBlockContext, request: string): number {
  const requestWords = wordSet(request);
  const normalizedRequest = normalize(request);
  const normalizedType = normalize(block.type);
  let score = normalizedRequest.includes(normalizedType) ? 100 : 0;
  score += overlapScore(requestWords, block.type, 16);
  score += overlapScore(requestWords, block.description, 4);
  for (const key of Object.keys(schemaProperties(block))) {
    score += overlapScore(requestWords, key, 8);
  }
  for (const example of block.examples) {
    score += overlapScore(requestWords, example.prompt, 6);
  }
  return score;
}

function findInsertionTarget(
  context: AssembledAiContext,
  childType: string,
): { parentId: string; slot: string } | undefined {
  const nodes = new Map(context.document.nodes.map((node) => [node.id, node]));
  const blocks = new Map(context.blocks.map((block) => [block.type, block]));
  const ids = [
    ...context.selection.ids,
    context.document.rootId,
    ...context.document.nodes.map((node) => node.id).sort(compareText),
  ];

  for (const parentId of new Set(ids)) {
    const parent = nodes.get(parentId);
    const parentBlock = parent === undefined ? undefined : blocks.get(parent.type);
    if (parent === undefined || parentBlock === undefined) {
      continue;
    }
    for (const slot of parentBlock.slots) {
      const occupancy = parent.slots[slot.name]?.length ?? 0;
      if (slot.allow.includes(childType) && (slot.max === undefined || occupancy < slot.max)) {
        return { parentId, slot: slot.name };
      }
    }
  }
  return undefined;
}

function exampleScore(example: AiBlockExampleContext, requestWords: ReadonlySet<string>): number {
  return overlapScore(requestWords, example.prompt, 4);
}

function propsFromBestExample(
  block: AiBlockContext,
  requestWords: ReadonlySet<string>,
): Record<string, JsonValue> {
  const ranked = block.examples
    .map((example, index) => ({ example, index, score: exampleScore(example, requestWords) }))
    .sort((left, right) => right.score - left.score || left.index - right.index);

  for (const { example } of ranked) {
    if (!isJsonRecord(example.node)) {
      continue;
    }
    const exampleType = example.node['type'];
    const exampleProps = example.node['props'];
    if (exampleType === block.type && isJsonRecord(exampleProps)) {
      return cloneJson(exampleProps) as Record<string, JsonValue>;
    }
  }
  return {};
}

function normalizeDigits(value: string): string {
  return value.replace(ARABIC_INDIC_DIGITS, (digit) => DIGIT_VALUE[digit] ?? digit);
}

function requestedCount(request: string): number | undefined {
  for (const word of words(normalizeDigits(request))) {
    const fromWord = NUMBER_WORDS[word];
    if (fromWord !== undefined) {
      return fromWord;
    }
    if (/^\d+$/u.test(word)) {
      const parsed = Number(word);
      if (Number.isSafeInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }
  }
  return undefined;
}

function isArraySchema(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return isJsonRecord(value) && value['type'] === 'array';
}

function mentionedArrayKey(
  block: AiBlockContext,
  props: Readonly<Record<string, JsonValue>>,
  requestWords: ReadonlySet<string>,
): string | undefined {
  const properties = schemaProperties(block);
  return [...new Set([...Object.keys(properties), ...Object.keys(props)])]
    .filter((key) => Array.isArray(props[key]) || isArraySchema(properties[key]))
    .map((key) => ({
      key,
      score:
        (requestWords.has(normalize(key)) ? 2 : 0) +
        (requestWords.has(singular(normalize(key))) ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score || compareText(left.key, right.key))[0]?.key;
}

function arrayLimit(
  schema: JsonValue | undefined,
  key: 'minItems' | 'maxItems',
): number | undefined {
  if (!isArraySchema(schema)) {
    return undefined;
  }
  const value = schema[key];
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function personalizedItem(value: JsonValue, position: number): JsonValue {
  const cloned = cloneJson(value);
  if (!isJsonRecord(cloned)) {
    return cloned;
  }
  for (const [key, prefix] of [
    ['name', 'Plan'],
    ['title', 'Item'],
    ['label', 'Item'],
  ] as const) {
    if (typeof cloned[key] === 'string') {
      cloned[key] = `${prefix} ${String(position)}`;
      break;
    }
  }
  return cloned;
}

function adaptRequestedCount(
  block: AiBlockContext,
  props: Record<string, JsonValue>,
  request: string,
): Record<string, JsonValue> {
  const count = requestedCount(request);
  if (count === undefined) {
    return props;
  }
  const requestWords = wordSet(request);
  const key = mentionedArrayKey(block, props, requestWords);
  if (key === undefined) {
    return props;
  }
  const current = props[key];
  if (!Array.isArray(current) || current.length === 0) {
    return props;
  }

  const propertySchema = schemaProperties(block)[key];
  const minimum = arrayLimit(propertySchema, 'minItems') ?? 0;
  const maximum = arrayLimit(propertySchema, 'maxItems') ?? count;
  const target = Math.max(minimum, Math.min(count, maximum));
  const adjusted = Array.from({ length: target }, (_unused, index) => {
    const existing = current[index];
    if (existing !== undefined) {
      return cloneJson(existing);
    }
    const template = current[index % current.length];
    return template === undefined ? null : personalizedItem(template, index + 1);
  });
  props[key] = adjusted;

  const columns = props['columns'];
  const columnsSchema = schemaProperties(block)['columns'];
  const enumValues = isJsonRecord(columnsSchema) ? columnsSchema['enum'] : undefined;
  const countText = String(target);
  if (typeof columns === 'string' && Array.isArray(enumValues) && enumValues.includes(countText)) {
    props['columns'] = countText;
  }
  return props;
}

function chooseBlock(
  request: string,
  context: AssembledAiContext,
): { block: AiBlockContext; target: { parentId: string; slot: string } } {
  const ranked = context.blocks
    .map((block) => ({
      block,
      score: scoreBlock(block, request),
      target: findInsertionTarget(context, block.type),
    }))
    .filter(
      (
        candidate,
      ): candidate is {
        block: AiBlockContext;
        score: number;
        target: { parentId: string; slot: string };
      } => candidate.score > 0 && candidate.target !== undefined,
    )
    .sort(
      (left, right) => right.score - left.score || compareText(left.block.type, right.block.type),
    );
  const best = ranked[0];
  if (best === undefined) {
    throw new LocalAiProviderError('No registered block matches the request in an available slot.');
  }
  return { block: best.block, target: best.target };
}

function proposeLocally(request: string, context: AssembledAiContext): AiPlan {
  if (request.trim() === '') {
    throw new LocalAiProviderError('A non-empty request is required.');
  }
  const { block, target } = chooseBlock(request, context);
  const props = adaptRequestedCount(block, propsFromBestExample(block, wordSet(request)), request);
  return {
    rationale: `Add a ${block.type} block to ${target.parentId}.${target.slot} using the registered vocabulary that best matches the request.`,
    commands: [
      {
        command: 'insertNode',
        args: { type: block.type, props, parentId: target.parentId, slot: target.slot },
      },
    ],
  };
}

export function createLocalAiPlanProvider(): AiPlanProvider {
  return {
    propose(request, context) {
      return Promise.resolve().then(() => proposeLocally(request, context));
    },
  };
}
