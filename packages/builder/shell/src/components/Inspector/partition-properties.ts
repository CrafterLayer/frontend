import type { BlockPropertyTab } from '@craftkit/builder-schema';

import { TAB_DEFINITIONS } from './constants';
import type {
  ErasedPropertyGroups,
  InspectorPairDeclaration,
  InspectorProperty,
  InspectorPropertyGroup,
  InspectorSectionEntry,
  InspectorTabModel,
} from './types';

export function usablePair(
  declaration: InspectorPropertyGroup | undefined,
): InspectorPairDeclaration | undefined {
  const pair = declaration?.pair;
  if (
    pair === undefined ||
    pair.id.trim() === '' ||
    pair.label.trim() === '' ||
    pair.cellLabel.trim() === ''
  ) {
    return undefined;
  }
  return pair;
}

export function sectionEntries(
  properties: readonly InspectorProperty[],
  declarations: ErasedPropertyGroups | undefined,
): readonly InspectorSectionEntry[] {
  const candidates = new Map<
    string,
    {
      readonly id: string;
      readonly label: string;
      readonly firstPropertyKey: string;
      readonly properties: {
        readonly property: InspectorProperty;
        readonly pair: InspectorPairDeclaration;
      }[];
    }
  >();

  for (const property of properties) {
    const [propKey] = property;
    const pair = usablePair(declarations?.[propKey]);
    if (pair === undefined) {
      continue;
    }
    const current = candidates.get(pair.id);
    if (current === undefined) {
      candidates.set(pair.id, {
        id: pair.id,
        label: pair.label,
        firstPropertyKey: propKey,
        properties: [{ property, pair }],
      });
    } else {
      current.properties.push({ property, pair });
    }
  }

  const pairs = new Map<string, Extract<InspectorSectionEntry, { kind: 'pair' }>>();
  for (const candidate of candidates.values()) {
    const isValidPair =
      candidate.properties.length === 2 &&
      candidate.properties.every((entry) => entry.pair.label === candidate.label) &&
      new Set(candidate.properties.map((entry) => entry.pair.cellLabel)).size === 2;
    if (isValidPair) {
      pairs.set(candidate.id, {
        kind: 'pair',
        id: candidate.id,
        label: candidate.label,
        properties: candidate.properties,
      });
    }
  }

  const firstPropertyForPair = new Map<string, string>();
  for (const candidate of candidates.values()) {
    if (pairs.has(candidate.id)) {
      firstPropertyForPair.set(candidate.id, candidate.firstPropertyKey);
    }
  }

  return properties.flatMap((property): readonly InspectorSectionEntry[] => {
    const [propKey] = property;
    const pair = usablePair(declarations?.[propKey]);
    if (pair === undefined) {
      return [{ kind: 'property', property }];
    }
    const grouped = pairs.get(pair.id);
    if (grouped === undefined || firstPropertyForPair.get(pair.id) !== propKey) {
      return grouped === undefined ? [{ kind: 'property', property }] : [];
    }
    return [grouped];
  });
}

export function partitionProperties(
  properties: readonly InspectorProperty[],
  declarations: ErasedPropertyGroups | undefined,
): readonly InspectorTabModel[] {
  const sectionsByTab = new Map<BlockPropertyTab, Map<string, InspectorProperty[]>>();

  for (const property of properties) {
    const [propKey] = property;
    const declaration = declarations?.[propKey];
    const tab = declaration?.tab ?? 'content';
    const tabLabel =
      TAB_DEFINITIONS.find((definition) => definition.id === tab)?.label ?? 'Content';
    const declaredSection = declaration?.section?.trim();
    const section =
      declaredSection === undefined || declaredSection === '' ? tabLabel : declaredSection;
    const tabSections = sectionsByTab.get(tab) ?? new Map<string, InspectorProperty[]>();
    const sectionProperties = tabSections.get(section) ?? [];
    sectionProperties.push(property);
    tabSections.set(section, sectionProperties);
    sectionsByTab.set(tab, tabSections);
  }

  return TAB_DEFINITIONS.flatMap((definition) => {
    const sections = sectionsByTab.get(definition.id);
    return sections === undefined
      ? []
      : [
          {
            ...definition,
            sections: [...sections].map(([name, groupedProperties]) => ({
              name,
              entries: sectionEntries(groupedProperties, declarations),
            })),
          },
        ];
  });
}
