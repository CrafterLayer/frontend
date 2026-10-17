import type { JsonValue } from '@craftkit/builder-schema';

import { json, photo, type PageNodes, type Props } from './build';
import type { TemplateLang } from './types';

/*
  Section builders the sector templates share (education, fitness, law firm,
  nonprofit, hotel and travel, personal brand).

  Each one writes the nodes a hand-built template would — the same props and
  slot shapes as the clinic or events page, under the hero ids the Library
  card and the tests look for — so a template stays plain data and reads top
  to bottom as its outline. They exist because those six pages repeat the same
  few patterns (a hero with two actions and one photo, a team with portraits,
  priced plans with a perk list and an action, a form's fields), and a pattern
  written six times drifts six ways. The first nine templates keep their own
  hand-written sections; nothing here changes them.
*/

export type SectionTone = 'transparent' | 'light' | 'dark';

/** `[topic, index]` of a verified photo in TEMPLATE_PHOTOS. */
export type PhotoRef = readonly [string, number];

export interface HeroCopy {
  readonly eyebrow: string;
  readonly heading: string;
  readonly body: string;
  readonly trustLine: string;
  /** The primary action's label. */
  readonly primary: string;
  /** The secondary action's label. */
  readonly secondary: string;
}

export interface HeroSpec {
  readonly copy: HeroCopy;
  readonly primaryHref: string;
  readonly secondaryHref: string;
  /** The hero photo; the Library card shows it as the thumbnail. */
  readonly photo: PhotoRef;
  readonly variant: 'centered' | 'split' | 'editorial';
  readonly ratio: 'square' | 'wide' | 'portrait';
  readonly align: 'start' | 'center';
  readonly tone: SectionTone;
  /** A typographic voice for the whole hero (a serif for a law firm). */
  readonly fontFamily?: 'serif';
}

/**
 * The opening section: two actions in `actions` and the photo in `media`,
 * under the ids the Library card and the template tests look for
 * (`hero`, `hero-primary`, `hero-secondary`, `hero-image`).
 */
export function heroSection(page: PageNodes, lang: TemplateLang, spec: HeroSpec): string {
  const [topic, index] = spec.photo;
  const image = photo(topic, index, lang);
  const primary = page.add('hero-primary', 'cta', {
    label: spec.copy.primary,
    href: spec.primaryHref,
    emphasis: 'primary',
    size: 'lg',
  });
  const secondary = page.add('hero-secondary', 'cta', {
    label: spec.copy.secondary,
    href: spec.secondaryHref,
    emphasis: 'ghost',
    size: 'lg',
  });
  const heroImage = page.add('hero-image', 'image', {
    src: image.src,
    alt: image.alt,
    fit: 'cover',
    ratio: spec.ratio,
    radius: 'md',
    width: 'full',
    align: 'center',
  });
  const props: Props = {
    variant: spec.variant,
    eyebrow: spec.copy.eyebrow,
    heading: spec.copy.heading,
    body: spec.copy.body,
    trustLine: spec.copy.trustLine,
    align: spec.align,
    tone: spec.tone,
    spacing: 'lg',
    width: 'wide',
  };
  if (spec.fontFamily !== undefined) props['fontFamily'] = spec.fontFamily;
  return page.section('hero', 'hero', props, { actions: [primary, secondary], media: [heroImage] });
}

export interface PersonCopy {
  readonly name: string;
  readonly role: string;
  readonly bio: string;
}

/**
 * Team members with a portrait each, in member order. A missing photo or
 * profile link throws in `photo()` or falls back to `fallbackHref`, so a
 * template with five people and four portraits fails its tests.
 */
export function membersWithPortraits(
  members: readonly PersonCopy[],
  portraits: readonly PhotoRef[],
  hrefs: readonly string[],
  fallbackHref: string,
  lang: TemplateLang,
): JsonValue {
  return json(
    members.map((member, index) => {
      const [topic, photoIndex] = portraits[index] ?? ['people', -1];
      const portrait = photo(topic, photoIndex, lang);
      return {
        ...member,
        imageSrc: portrait.src,
        imageAlt: portrait.alt,
        profileHref: hrefs[index] ?? fallbackHref,
      };
    }),
  );
}

/** A bulleted rich-text list: one list item per line. */
export function bulletList(lines: readonly string[]): JsonValue {
  return {
    type: 'doc',
    content: [
      {
        type: 'bulletList',
        content: lines.map((text) => ({
          type: 'listItem',
          content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
        })),
      },
    ],
  };
}

export interface PlanCopy {
  readonly name: string;
  readonly perks: readonly string[];
  /** The plan's own action label (never repeated on the page). */
  readonly action: string;
  /** Under the price: "per month", "one-time", "per night"… */
  readonly periodLabel: string;
}

export interface PlanSpec {
  /** Node-id stem: `plan-<key>`, `plan-<key>-perks`, `plan-<key>-cta`. */
  readonly key: string;
  /** Written with money() for the page language. */
  readonly price: string;
  readonly period: 'once' | 'month' | 'year';
  readonly href: string;
  readonly featured: boolean;
  /** The featured plan's badge. */
  readonly badge?: string;
}

/**
 * PricingPlan cards, each a perk list and one full-width action (the featured
 * plan's is primary). Returns the plan ids for the `pricing` section's slot.
 */
export function pricingPlans(
  page: PageNodes,
  plans: readonly { readonly copy: PlanCopy; readonly spec: PlanSpec }[],
): string[] {
  return plans.map(({ copy, spec }) => {
    const perks = page.add(`plan-${spec.key}-perks`, 'richText', {
      content: bulletList(copy.perks),
    });
    const action = page.add(`plan-${spec.key}-cta`, 'cta', {
      label: copy.action,
      href: spec.href,
      emphasis: spec.featured ? 'primary' : 'secondary',
      size: 'md',
      width: 'full',
    });
    const props: Props = {
      name: copy.name,
      price: spec.price,
      period: spec.period,
      periodLabel: copy.periodLabel,
      emphasis: spec.featured ? 'featured' : 'normal',
    };
    if (spec.badge !== undefined) props['badge'] = spec.badge;
    return page.add(`plan-${spec.key}`, 'pricingPlan', props, { default: [perks, action] });
  });
}

export type FieldType = 'text' | 'email' | 'tel' | 'date' | 'textarea' | 'select' | 'checkbox';

export interface FieldSpec {
  /** Both the field id and its submitted name. */
  readonly id: string;
  readonly type: FieldType;
  readonly label: string;
  readonly required: boolean;
  readonly width: 'full' | 'half';
  readonly autoComplete?: string;
  readonly rows?: number;
  /** A select's options: labels in the page language, values as identifiers. */
  readonly options?: readonly { readonly label: string; readonly value: string }[];
}

/** FormSection fields, the way the clinic's appointment form writes them. */
export function formFields(fields: readonly FieldSpec[]): JsonValue {
  return json(fields.map(({ id, ...rest }) => ({ id, name: id, ...rest })));
}

/** Select options from labels in the page language and identifier values, pairwise. */
export function selectOptions(
  labels: readonly string[],
  values: readonly string[],
): { readonly label: string; readonly value: string }[] {
  return labels.map((label, index) => ({
    label,
    value: values[index] ?? `option-${String(index + 1)}`,
  }));
}
