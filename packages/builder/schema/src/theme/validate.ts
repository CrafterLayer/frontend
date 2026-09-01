import {
  COLOR_TOKENS,
  TOKEN_NAMES,
  isColorToken,
  type DesignPairing,
  type DesignSystem,
} from './design-system';
import { checkContrast } from './contrast';
import type { Theme, TokenName } from './tokens';

export type DesignSystemIssueCode =
  | 'malformed-design-system'
  | 'unknown-token'
  | 'missing-token'
  | 'unknown-pairing-role'
  | 'contrast-below-minimum'
  | 'contrast-unmeasurable';

export interface DesignSystemIssue {
  readonly code: DesignSystemIssueCode;
  readonly message: string;
  readonly path: readonly (string | number)[];
}

export type DesignSystemValidationResult =
  | { readonly ok: true; readonly system: DesignSystem }
  | { readonly ok: false; readonly issues: readonly DesignSystemIssue[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/*
  The threshold is NOT restated here.

  An earlier draft carried a local `minimumFor(size)` beside the call to
  `checkContrast`, which already resolves the same minimum internally. A
  mutation test caught what that costs: changing the local copy altered the
  reported threshold while the enforced one stayed put, so the validator could
  report "below the 4.5:1 required" while having tested against 3:1. Below,
  every number in a message comes from the measurement that produced the
  verdict, so the two cannot disagree.
*/

/**
 * The design-system gate (FR-014).
 *
 * Two rules carry the weight. An unknown token key is a failure rather than an
 * ignored extra: a system carrying `brandBlue` would render as nothing at all,
 * because no block reads a variable the vocabulary never declared — so silently
 * accepting it ships a palette that cannot be seen. And every AUTHORIZED
 * pairing is measured, with an unmeasurable colour failing closed.
 *
 * That last point is the one worth stating twice. `checkContrast` returns
 * `undefined` when a colour cannot be parsed, and the tempting reading of
 * `undefined` is "no problem found". It is the opposite: it means the rule
 * could not be applied. Treating it as a pass is precisely how a palette that
 * was never measured ships wearing a validator's approval.
 */
export function validateDesignSystem(value: unknown): DesignSystemValidationResult {
  const issues: DesignSystemIssue[] = [];
  const fail = (code: DesignSystemIssueCode, message: string, path: (string | number)[]): void => {
    issues.push({ code, message, path });
  };

  if (!isRecord(value)) {
    return {
      ok: false,
      issues: [
        {
          code: 'malformed-design-system',
          message: 'A design system must be an object.',
          path: [],
        },
      ],
    };
  }

  // ── The shell ────────────────────────────────────────────────────────────
  const { name, seed, typography, tokens, pairings } = value;

  if (typeof name !== 'string' || name.trim() === '') {
    fail('malformed-design-system', 'A design system needs a non-empty name.', ['name']);
  }
  if (typeof seed !== 'string' || seed.trim() === '') {
    fail('malformed-design-system', 'A design system needs a non-empty seed.', ['seed']);
  }

  if (!isRecord(typography)) {
    fail('malformed-design-system', 'Typography must be an object.', ['typography']);
  } else {
    if (typeof typography['headingFamily'] !== 'string' || typography['headingFamily'] === '') {
      fail('malformed-design-system', 'A heading family is required.', [
        'typography',
        'headingFamily',
      ]);
    }
    if (typeof typography['bodyFamily'] !== 'string' || typography['bodyFamily'] === '') {
      fail('malformed-design-system', 'A body family is required.', ['typography', 'bodyFamily']);
    }
    const ratio = typography['scaleRatio'];
    if (typeof ratio !== 'number' || !Number.isFinite(ratio) || ratio <= 0) {
      fail('malformed-design-system', 'The type scale ratio must be a positive number.', [
        'typography',
        'scaleRatio',
      ]);
    }
  }

  // ── The token map: closed on both sides ──────────────────────────────────
  if (!isRecord(tokens)) {
    fail('malformed-design-system', 'Tokens must be an object.', ['tokens']);
  } else {
    for (const key of Object.keys(tokens)) {
      if (!TOKEN_NAMES.includes(key as TokenName)) {
        fail('unknown-token', `"${key}" is not a token this vocabulary declares.`, ['tokens', key]);
      }
    }
    for (const token of TOKEN_NAMES) {
      const assigned = tokens[token];
      if (typeof assigned !== 'string' || assigned === '') {
        fail('missing-token', `"${token}" has no value.`, ['tokens', token]);
      }
    }
  }

  // ── Every authorized pairing, measured ───────────────────────────────────
  /* Accepted pairings are COLLECTED as they are proved rather than re-asserted
     at the return. A cast there would only restate a proof this loop already
     has, and a cast is exactly the thing that keeps holding after the proof
     stops being true. */
  const accepted: DesignPairing[] = [];

  if (!Array.isArray(pairings)) {
    fail('malformed-design-system', 'Pairings must be an array.', ['pairings']);
  } else {
    pairings.forEach((pairing: unknown, index: number) => {
      const at = (segment: string): (string | number)[] => ['pairings', index, segment];

      if (!isRecord(pairing)) {
        fail('malformed-design-system', 'A pairing must be an object.', ['pairings', index]);
        return;
      }

      const { text, background, size } = pairing;

      /* A measurement is not a colour: admitting one here would feed a spacing
         step into a contrast calculation, which can only produce a number that
         means nothing. */
      if (!isColorToken(text)) {
        fail(
          'unknown-pairing-role',
          `"${String(text)}" is not one of the colour roles (${COLOR_TOKENS.join(', ')}).`,
          at('text'),
        );
      }
      if (!isColorToken(background)) {
        fail(
          'unknown-pairing-role',
          `"${String(background)}" is not one of the colour roles.`,
          at('background'),
        );
      }
      if (size !== 'normal' && size !== 'large') {
        fail('malformed-design-system', 'A pairing size is "normal" or "large".', at('size'));
      }

      if (
        !isColorToken(text) ||
        !isColorToken(background) ||
        (size !== 'normal' && size !== 'large')
      ) {
        return;
      }
      if (!isRecord(tokens)) return;

      const foreground = tokens[text];
      const backdrop = tokens[background];
      if (typeof foreground !== 'string' || typeof backdrop !== 'string') {
        return; // already reported as a missing token
      }

      accepted.push({ text, background, size });

      const measured = checkContrast(foreground, backdrop, size);

      if (measured === undefined) {
        fail(
          'contrast-unmeasurable',
          `Contrast between ${text} (${foreground}) and ${background} (${backdrop}) could not be computed, so the minimum for ${size} text cannot be shown to hold.`,
          ['pairings', index],
        );
        return;
      }

      if (!measured.passes) {
        fail(
          'contrast-below-minimum',
          `${text} on ${background} is ${measured.ratio.toFixed(2)}:1, below the ${String(measured.required)}:1 required for ${size} text.`,
          ['pairings', index],
        );
      }
    });
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  /* Reaching here means no branch above objected, so each guard below is
     already known to hold — but writing them out keeps the returned value's
     type derived from real narrowing instead of an assertion, and gives the
     compiler something to re-check if a rule above is ever weakened.

     Every field is COPIED. Handing back the caller's own objects would mean a
     later edit on their side silently rewrites a system that already passed. */
  if (
    typeof name !== 'string' ||
    typeof seed !== 'string' ||
    !isRecord(tokens) ||
    !isRecord(typography) ||
    typeof typography['headingFamily'] !== 'string' ||
    typeof typography['bodyFamily'] !== 'string' ||
    typeof typography['scaleRatio'] !== 'number'
  ) {
    return {
      ok: false,
      issues: [
        {
          code: 'malformed-design-system',
          message: 'The design system is malformed.',
          path: [],
        },
      ],
    };
  }

  return {
    ok: true,
    system: {
      name,
      seed,
      tokens: { ...tokens } as Theme,
      typography: {
        headingFamily: typography['headingFamily'],
        bodyFamily: typography['bodyFamily'],
        scaleRatio: typography['scaleRatio'],
      },
      pairings: accepted,
    },
  };
}
