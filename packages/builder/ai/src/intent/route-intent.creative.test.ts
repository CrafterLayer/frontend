import { describe, expect, it } from 'vitest';
import { creativeCreationRequest, routeIntent, type IntentDocumentSummary } from './route-intent';

const EMPTY: IntentDocumentSummary = { nodeCount: 0, placeholderOnly: false, sectionLabels: [] };
const CONTENT: IntentDocumentSummary = {
  nodeCount: 8,
  placeholderOnly: false,
  sectionLabels: ['Mural'],
};

describe('creative creation on an empty canvas', () => {
  it.each([
    'سوي الي جدارية لشخص يعيش في مدينة مع صديقه وبدي تضيف صور وشخصيات وخلي الجو بالليل',
    'اعمل جدارية افقية بواسطة سكرول وبدي تضيف صور',
    'بدي جدارية تفاعلية وخليها بالليل',
    'Create an interactive story about two friends and add photos then change the night lighting',
    'Make a scrolling mural and add animated characters',
    'Build a playable game and change the controls to Arabic',
    'Build a custom narrative mural of a winter landscape in Arabic',
    'Add a mural with night lighting and change its controls to Arabic',
    'Add a calm aurora mural section below the menu',
    'ضيف جدارية افقية مع شخصيات وبدي تغير الالوان',
  ])('builds the requested piece despite later edit verbs: %s', (request) => {
    expect(creativeCreationRequest(request)).toBe(true);
    expect(routeIntent({ request, document: EMPTY })).toMatchObject({
      kind: 'build-page',
      target: 'replace',
      confidence: 0.9,
    });
    expect(
      routeIntent({ request, document: { ...EMPTY, nodeCount: 3, placeholderOnly: true } }),
    ).toMatchObject({ kind: 'build-page', target: 'replace' });
  });

  it.each([
    'سوي الي جدارية لشخص في مدينة وبدي تضيف صور وخليها بالليل',
    'Create an interactive story and add photos',
  ])('preserves existing content and an explicit selection: %s', (request) => {
    expect(routeIntent({ request, document: CONTENT }).kind).toBe('edit');
    expect(routeIntent({ request }).kind).toBe('edit');
    expect(routeIntent({ request, document: EMPTY, selection: ['chosen'] }).kind).toBe('edit');
  });

  it.each([
    'غير لغة الجدارية الى العربية فقط',
    'لا تسوي جدارية غير اللغة فقط',
    'Change the scene language to Arabic',
    'Make the mural darker',
    'خلي الجدارية بالعربي',
    'خلي المشهد تفاعلي',
    'خلي هذا المشهد تفاعلي',
    'خلي القصة تفاعلية',
    'خلي اللعبة تفاعلية',
    'Create no mural; change the language only',
    'Add a link to a mural and change its color',
    'Make the title darker; create a mural later',
    'Create a pricing section about mural commissions and change its color',
  ])('does not treat a mentioned scene or ordinary edit as full creation: %s', (request) => {
    expect(creativeCreationRequest(request)).toBe(false);
    expect(routeIntent({ request, document: EMPTY }).kind).not.toBe('build-page');
  });

  it.each([
    'Create a welcome message for the mural',
    'Create a caption for a mural and change its color',
  ])('does not impose scene creation when the object is copy: %s', (request) => {
    expect(creativeCreationRequest(request)).toBe(false);
    expect(routeIntent({ request, document: EMPTY }).reason).not.toMatch(
      /asks to create|asks to add/u,
    );
    expect(routeIntent({ request, document: CONTENT }).kind).toBe('edit');
  });

  it.each([
    'How do I create a mural and add photos?',
    'ما معنى جدارية تفاعلية؟',
    'What if I create an interactive story and change the controls?',
  ])('answers questions without creating: %s', (request) => {
    expect(creativeCreationRequest(request)).toBe(false);
    expect(routeIntent({ request, document: EMPTY }).kind).toBe('question');
  });

  it.each(['Add a mural and change its night lighting', 'ضيف جدارية افقية مع شخصيات'])(
    'adds an explicit scene to existing content while honoring a selection: %s',
    (request) => {
      expect(creativeCreationRequest(request)).toBe(true);
      expect(routeIntent({ request, document: CONTENT })).toMatchObject({
        kind: 'add-section',
        target: 'append',
      });
      expect(routeIntent({ request, document: CONTENT, selection: ['chosen'] }).kind).toBe('edit');
    },
  );
});
