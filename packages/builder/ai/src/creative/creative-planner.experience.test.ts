import { describe, expect, it } from 'vitest';

import { creativeBriefFor, planCreativeBrief, renderCreativeBrief } from './creative-planner';

describe('creative planner preserves the requested experience', () => {
  it.each([
    'اصنع جدارية فضاء فيها كواكب ونجوم',
    'جدارية عن سيارات في المدينة',
    'A mural of a maze garden',
    'Create a mural about a treasure hunt',
    'Paint a treasure hunt mural',
    'A dungeon mural',
    'A maze mural',
    'ارسم متاهة جدارية في الغابة',
    'Paint a mural of children playing a game',
    'A mural with a physics toy on a table',
    'اعمل قصة جدارية عن رحلة في الفضاء',
    'A story mural about a maze garden',
  ])('keeps the subjects of %s inside a mural', (request) => {
    const brief = planCreativeBrief(request);
    expect(brief).toMatchObject({ kind: 'scene', genre: 'mural' });
    expect(brief.libs).not.toContain('dialogue');
    expect(renderCreativeBrief(brief)).not.toContain('ready/running/paused/won/lost');
    expect(brief.accessibility.join(' ')).toMatch(/unless the person asked|إلا إذا طلبها/u);
  });

  it.each([
    ['A bedtime story about a maze in the forest', 'picture-book'],
    ['اصنع قصة أطفال عن كنز في الفضاء', 'picture-book'],
    ['Create an interactive story about a mural painter', 'chapter-story'],
    ['A story about a mural with a puzzle hidden inside it', 'chapter-story'],
    ['A visual novel about a platformer champion', 'visual-novel'],
  ])('keeps %s a story of the requested genre', (request, genre) => {
    expect(planCreativeBrief(request)).toMatchObject({ kind: 'story', genre });
  });

  it.each([
    ['اصنع لعبة فضاء بسيطة', 'arcade'],
    ['Create a game where the player paints a mural', 'arcade'],
    ['A game with a branching story about a mural', 'arcade'],
    ['Build a platformer about a mural painter', 'platformer'],
    ['A maze adventure game with a bedtime story introduction', 'maze-adventure'],
    ['A physics toy beside a mural', 'physics-toy'],
    ['Build a dungeon game beside a mural', 'maze-adventure'],
    ['اصنع لعبة متاهة بجانب جدارية', 'maze-adventure'],
  ])('preserves explicit game ownership in %s', (request, genre) => {
    expect(planCreativeBrief(request)).toMatchObject({ kind: 'game', genre });
  });

  it('lets separate sections own different experiences while retaining page context', () => {
    const page = 'A mural of a night city followed by a game about a painter named Layla';
    const mural = creativeBriefFor('A mural of a maze garden', page);
    const game = creativeBriefFor('A platformer mini game collecting stars', page);
    const story = creativeBriefFor('An interactive story about a mural painter', page);
    expect(mural).toMatchObject({ kind: 'scene', genre: 'mural' });
    expect(game).toMatchObject({ kind: 'game', genre: 'platformer' });
    expect(story).toMatchObject({ kind: 'story', genre: 'chapter-story' });
    for (const brief of [mural, game, story]) {
      expect(brief.cast.map(({ name }) => name)).toContain('Layla');
      expect(brief.settings).toContain('city');
    }
  });

  it('inherits the page experience when a section names only its pictured subject', () => {
    for (const section of [
      'رحلة إلى الفضاء',
      'سيارات في المدينة',
      'The maze garden',
      'The dungeon',
      'The treasure hunt',
      'المتاهة',
      'زنزانة',
      'البحث عن الكنز',
    ]) {
      expect(creativeBriefFor(section, 'اصنع جدارية عن رحلة عبر عوالم مختلفة')).toMatchObject({
        kind: 'scene',
        genre: 'mural',
      });
    }
    expect(
      creativeBriefFor('The maze in the forest', 'A bedtime story for children'),
    ).toMatchObject({
      kind: 'story',
      genre: 'picture-book',
    });
  });
});
