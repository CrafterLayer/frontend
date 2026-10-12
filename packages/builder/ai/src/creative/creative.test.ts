import { describe, expect, it } from 'vitest';

import {
  createCreativeBriefContextProvider,
  createCreativeMemoryContextProvider,
  emptyCreativeMemory,
  learnCreativeMemory,
  learnCreativeMemoryFromScripts,
  literalArgumentsOf,
  mergeCreativeMemory,
  planCreativeBrief,
  readCreativeMemory,
  readLiteral,
  renderCreativeBrief,
  renderCreativeMemory,
} from './index';

const SCENE = `const s=await ck.scene({libs:['dialogue','anim','fx']});
const D=s.lib.dialogue;
const cast=D.cast([
  {id:'layla', name:'ليلى', color:'#f59e0b', title:'hero', portrait:'assets/layla.png', traits:['brave','curious']},
  {id:"omar", name:"Omar", color:0x38bdf8}, // the friend
]);
const sky=await s.texture('assets/sky.webp');
const talk=D.create({start:'a',nodes:{a:{speaker:'layla',text:'Hi',cue:{bg:'forest'}}}},{cast});`;

describe('literal reader', () => {
  it('reads JavaScript literals without evaluating anything', () => {
    expect(readLiteral('[{a:1, \'b\':"x", c:[true,null,0xff], d:-2.5e1,},]')?.value).toEqual([
      { a: 1, b: 'x', c: [true, null, 255], d: -25 },
    ]);
    expect(readLiteral('[name]')).toBeUndefined();
    expect(readLiteral('[`${x}`]')).toBeUndefined();
    expect(readLiteral('[fetch("/")]')).toBeUndefined();
    expect(readLiteral('{__proto__:{polluted:1}}')?.value).toEqual({});
    expect(({} as Record<string, unknown>)['polluted']).toBeUndefined();
  });

  it('finds literal first arguments of a method', () => {
    expect(literalArgumentsOf('x.cast([1]); y.cast(list); z . cast ( [2] )', 'cast')).toEqual([
      [1],
      [2],
    ]);
    expect(literalArgumentsOf('cast([1])', 'bad name!')).toEqual([]);
  });
});

describe('creative memory', () => {
  it('learns the cast, portraits, textures and locations from a written scene', () => {
    const memory = learnCreativeMemory(SCENE);
    expect(memory.characters).toEqual([
      {
        id: 'layla',
        name: 'ليلى',
        role: 'hero',
        color: '#f59e0b',
        traits: ['brave', 'curious'],
        portrait: 'assets/layla.png',
      },
      { id: 'omar', name: 'Omar', color: '#38bdf8' },
    ]);
    expect(memory.assets.map(({ kind, url, owner }) => [kind, url, owner])).toEqual([
      ['portrait', 'assets/layla.png', 'layla'],
      ['image', 'assets/sky.webp', undefined],
    ]);
    expect(memory.locations).toEqual([{ id: 'forest', name: 'forest' }]);
  });

  it('ignores casts built from variables and empty code', () => {
    const base = emptyCreativeMemory();
    expect(learnCreativeMemory('D.cast(people)', base)).toBe(base);
    expect(learnCreativeMemory('', base)).toBe(base);
  });

  it('validates loaded memory, drops unsafe assets and bounds everything', () => {
    const { memory, issues } = readCreativeMemory({
      schemaVersion: 1,
      characters: [
        { name: 'Layla Noor', color: 'f00', look: 'red scarf' },
        { id: 'x', name: 'A'.repeat(200) },
        'nonsense',
        {},
      ],
      assets: [
        { id: 'ok', url: 'https://cdn.example.com/a.png', kind: 'tileset' },
        { id: 'bad', url: 'javascript:alert(1)' },
        { id: 'svg', url: 'data:image/svg+xml,<svg onload=alert(1)>' },
      ],
      facts: ['Layla lost her lantern.', 'Layla lost her lantern.'],
    });
    expect(memory.characters.map(({ id }) => id)).toEqual(['layla-noor', 'x']);
    expect(memory.characters[0]?.color).toBeUndefined();
    expect(memory.characters[1]?.name).toHaveLength(80);
    expect(memory.assets.map(({ id }) => id)).toEqual(['ok']);
    expect(memory.facts).toEqual(['Layla lost her lantern.']);
    expect(issues.length).toBeGreaterThan(0);
    expect(readCreativeMemory('garbage').memory).toEqual(emptyCreativeMemory());
  });

  it('merges updates by id, field by field, keeping the newest within bounds', () => {
    const base = learnCreativeMemory(SCENE);
    const next = mergeCreativeMemory(base, {
      characters: [{ id: 'layla', name: 'ليلى', voice: 'quiet, curious' }],
      facts: ['The lantern is in the river.'],
      title: 'The Lantern',
    });
    expect(next.characters.find(({ id }) => id === 'layla')).toMatchObject({
      color: '#f59e0b',
      voice: 'quiet, curious',
    });
    expect(next.title).toBe('The Lantern');
    const many = learnCreativeMemoryFromScripts(
      Array.from(
        { length: 40 },
        (_, index) => `D.cast([{id:'c${String(index)}',name:'C${String(index)}'}])`,
      ),
    );
    expect(many.characters).toHaveLength(32);
    expect(many.characters.at(-1)?.id).toBe('c39');
  });

  it('renders compact canon text and serves it as a data fragment', () => {
    const memory = mergeCreativeMemory(learnCreativeMemory(SCENE), {
      facts: ['Omar fears water.'],
    });
    const text = renderCreativeMemory(memory);
    expect(text).toContain('layla = ليلى | hero | #f59e0b');
    expect(text).toContain('APPROVED ASSETS');
    expect(text).toContain('Omar fears water.');
    const fragment = createCreativeMemoryContextProvider({ load: () => memory }).collect(
      {} as never,
      [],
    );
    expect(fragment).toMatchObject({
      kind: 'data',
      trust: 'reviewed',
      source: 'host:creative-memory',
    });
    expect(fragment.body).toBe(text);
    const empty = createCreativeMemoryContextProvider({ load: () => undefined }).collect(
      {} as never,
      [],
    );
    expect(empty.body).toBe('');
  });
});

describe('creative planner', () => {
  it.each([
    [
      'Build a platformer where a fox named Rumi collects stars in a forest',
      'platformer',
      'game',
      ['tilemap', 'anim', 'fx'],
    ],
    [
      'اعمل لعبة منصات فيها بطل اسمه عمر يقفز فوق الحمم',
      'platformer',
      'game',
      ['tilemap', 'anim', 'fx'],
    ],
    [
      'A maze adventure to find the treasure',
      'maze-adventure',
      'game',
      ['tilemap', 'anim', 'fx', 'dialogue'],
    ],
    [
      'بدي رواية مرئية فيها خيارات ونهايات مختلفة',
      'visual-novel',
      'story',
      ['dialogue', 'anim', 'fx'],
    ],
    [
      'قصة تفاعلية للأطفال قبل النوم عن قمر صغير',
      'picture-book',
      'story',
      ['dialogue', 'anim', 'fx'],
    ],
    [
      'Create an interactive story about a traveller',
      'chapter-story',
      'story',
      ['dialogue', 'anim', 'fx'],
    ],
    ['A playable 2D space game with asteroids', 'arcade', 'game', ['anim', 'fx']],
    ['An illustrated generative art mural', 'mural', 'scene', ['fx', 'anim']],
  ])('plans %s', (request, genre, kind, libs) => {
    const brief = planCreativeBrief(request);
    expect(brief).toMatchObject({ genre, kind });
    expect(brief.libs).toEqual(libs);
  });

  it('matches effects and weather to the setting', () => {
    const forest = planCreativeBrief('An interactive story in a magic forest at night');
    expect(forest.weather).toEqual(['leaves', 'fireflies']);
    expect(forest.effects).toEqual(expect.arrayContaining(['magic', 'sparkle']));
    expect(planCreativeBrief('لعبة تحت الماء').weather).toEqual(['bubbles']);
    expect(planCreativeBrief('a platformer in winter snow').weather).toEqual(['snow']);
  });

  it('builds the cast from the story bible first, then names in the brief', () => {
    const memory = learnCreativeMemory(SCENE);
    const brief = planCreativeBrief(
      'An interactive story where Layla meets a cat called Miso and «Omar»',
      { memory },
    );
    expect(brief.cast.map(({ id }) => id)).toEqual(['layla', 'omar', 'miso']);
    const arabic = planCreativeBrief('قصة تفاعلية بطلها سامي واسمها ليلى');
    expect(arabic.cast.map(({ name }) => name)).toEqual(['سامي', 'ليلى']);
    expect(arabic.language).toBe('ar');
    // A descriptor followed by a naming verb is the character's kind: the fox is called Rumi.
    const fox = planCreativeBrief('لعبة منصات في غابة، بطلها ثعلب اسمه رومي يجمع النجوم');
    expect(fox.cast.map(({ name, role }) => [name, role])).toEqual([['رومي', 'hero']]);
  });

  it('adds Ink, viewport and filters only when asked', () => {
    expect(planCreativeBrief('A branching story written in ink').libs).toContain('ink');
    expect(planCreativeBrief('A maze game with a big map and zoom').libs).toContain('viewport');
    expect(planCreativeBrief('A neon retro arcade game').libs).toContain('filters');
    expect(planCreativeBrief('An arcade game').libs).not.toContain('ink');
  });

  it('renders a deterministic brief with literal libs and checks', () => {
    const request = 'اعمل لعبة منصات في غابة';
    const text = renderCreativeBrief(planCreativeBrief(request));
    expect(text).toContain("LIBS: ck.scene({ libs: ['tilemap', 'anim', 'fx'] })");
    expect(text).toContain("fx.weather('leaves')");
    expect(text).toContain('ANIMATE: rig states idle, run, jump, hurt, celebrate');
    expect(text).toContain('LANGUAGE: ar');
    expect(renderCreativeBrief(planCreativeBrief(request))).toBe(text);
    const fragment = createCreativeBriefContextProvider(request).collect({} as never, []);
    expect(fragment).toMatchObject({ kind: 'data', source: 'craftkit:creative-brief', body: text });
  });
});
