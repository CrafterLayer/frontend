const INDENT = '  ';

const unprojectable = (reason: string): string => JSON.stringify(`[Unprojectable: ${reason}]`);

const indentation = (depth: number): string => INDENT.repeat(depth);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Deterministic JSON text for the document projection.
 *
 * Stored documents are JSON-pure, but this boundary is deliberately total over
 * `unknown`: a corrupt runtime value remains VISIBLE as a JSON string instead
 * of being omitted the way native `JSON.stringify` omits object properties.
 */
export function canonicalJson(value: unknown): string {
  try {
    return printValue(value, 0, new Set<object>());
  } catch {
    // Hostile proxies may throw even while their keys or prototype are read.
    return unprojectable('unreadable value');
  }
}

function printValue(value: unknown, depth: number, ancestors: Set<object>): string {
  switch (typeof value) {
    case 'string':
      return JSON.stringify(value);
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) {
        return unprojectable('non-finite number');
      }
      // The storage boundary already canonicalises -0, but the printer remains
      // total when called directly with one.
      return Object.is(value, -0) ? '0' : JSON.stringify(value);
    case 'undefined':
      return unprojectable('undefined');
    case 'bigint':
      return unprojectable('bigint');
    case 'function':
      return unprojectable('function');
    case 'symbol':
      return unprojectable('symbol');
    case 'object':
      break;
  }

  if (value === null) {
    return 'null';
  }
  if (ancestors.has(value)) {
    return unprojectable('circular reference');
  }

  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      return printArray(value, depth, ancestors);
    }

    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return unprojectable('unsupported object');
    }
    return isRecord(value)
      ? printObject(value, depth, ancestors)
      : unprojectable('unsupported object');
  } finally {
    ancestors.delete(value);
  }
}

function printArray(value: unknown[], depth: number, ancestors: Set<object>): string {
  if (value.length === 0) {
    return '[]';
  }

  const entries: string[] = [];
  for (let index = 0; index < value.length; index += 1) {
    const printed =
      index in value ? printValue(value[index], depth + 1, ancestors) : unprojectable('array hole');
    entries.push(`${indentation(depth + 1)}${printed}`);
  }
  return `[\n${entries.join(',\n')}\n${indentation(depth)}]`;
}

function printObject(
  value: Record<string, unknown>,
  depth: number,
  ancestors: Set<object>,
): string {
  const keys = Object.keys(value).sort();
  if (keys.length === 0) {
    return '{}';
  }

  const entries = keys.map((key) => {
    let printed: string;
    try {
      printed = printValue(value[key], depth + 1, ancestors);
    } catch {
      printed = unprojectable('unreadable property');
    }
    const encodedKey = JSON.stringify(key);
    return `${indentation(depth + 1)}${encodedKey}: ${printed}`;
  });
  return `{\n${entries.join(',\n')}\n${indentation(depth)}}`;
}
