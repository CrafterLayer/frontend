import { describe, expect, it } from 'vitest';
import { creativeCreationRequest, routeIntent, type IntentDocumentSummary } from './route-intent';

const CONTENT: IntentDocumentSummary = {
  nodeCount: 5,
  placeholderOnly: false,
  sectionLabels: ['Garden mural'],
};
const EMPTY: IntentDocumentSummary = { nodeCount: 0, placeholderOnly: false, sectionLabels: [] };

describe('creative additions belong to their existing destination', () => {
  it.each([
    'Add an animated scene to the mural',
    'Add an animated scene with stars to the mural',
    'Add an interactive game with a fox inside this story',
    'ضيف مشهد تفاعلي مع شخصيات داخل الجدارية',
    'Add an interactive story inside this mural',
    'Create a playable game inside the existing scene',
    'أضف مشهد تفاعلي للجدارية',
    'ضيف قصة تفاعلية داخل الجدارية',
    'اعمل مشهد تفاعلي في الجدارية الحالية',
    'Add a new mural panel to this story',
    'Add a game to it',
    'ضيف جدارية عليها',
  ])('keeps an addition to existing art in the edit path: %s', (request) => {
    expect(routeIntent({ request, document: CONTENT }).kind).toBe('edit');
    expect(routeIntent({ request, document: EMPTY }).kind).toBe('edit');
    expect(creativeCreationRequest(request)).toBe(false);
  });

  it.each([
    'Add a new mural',
    'Create a new mural',
    'ضيف جدارية جديدة',
    'اصنع جدارية جديدة',
    'Add a game to this page',
    'Add a mural beside the current mural',
  ])('preserves explicit separate-artifact creation: %s', (request) => {
    expect(routeIntent({ request, document: CONTENT }).kind).toBe('add-section');
    expect(creativeCreationRequest(request)).toBe(true);
  });

  it.each(['How can I add a scene to the mural?', 'كيف أضيف مشهد للجدارية؟'])(
    'keeps questions non-mutating: %s',
    (request) => {
      expect(routeIntent({ request, document: CONTENT }).kind).toBe('question');
    },
  );
});
