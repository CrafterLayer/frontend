import { describe, expect, it } from 'vitest';

import type { AgentStorage } from './migrate-sessions';
import { createStoryBibleStore, sceneScriptsOf, STORY_BIBLE_KEY } from './story-bible';

function memoryStorage(seed?: string): AgentStorage & { readonly data: Map<string, string> } {
  const data = new Map<string, string>(seed === undefined ? [] : [[STORY_BIBLE_KEY, seed]]);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const SCENE = `const s=await ck.scene({libs:['dialogue']});
const cast=s.lib.dialogue.cast([{id:'layla',name:'Layla',color:'#f59e0b',title:'hero'}]);
await s.texture('assets/forest.webp');`;

describe('story bible store', () => {
  it('learns the cast and assets from written scenes and persists them', () => {
    const storage = memoryStorage();
    const bible = createStoryBibleStore(storage);
    let notified = 0;
    bible.subscribe(() => (notified += 1));
    expect(bible.isEmpty()).toBe(true);
    expect(bible.learn([SCENE])).toBe(true);
    expect(bible.get().characters).toEqual([
      { id: 'layla', name: 'Layla', role: 'hero', color: '#f59e0b' },
    ]);
    expect(bible.get().assets.map(({ url }) => url)).toEqual(['assets/forest.webp']);
    expect(notified).toBe(1);
    expect(bible.learn([SCENE])).toBe(false);
    expect(JSON.parse(storage.data.get(STORY_BIBLE_KEY) ?? '{}')).toMatchObject({
      schemaVersion: 1,
    });
    expect(createStoryBibleStore(storage).get()).toEqual(bible.get());
  });

  it('adds and removes characters, facts and assets', () => {
    const bible = createStoryBibleStore(undefined);
    expect(bible.addCharacter({ name: '  ', color: '#fff' })).toBe(false);
    expect(bible.addCharacter({ name: 'عمر', color: '#38BDF8', role: 'friend' })).toBe(true);
    expect(bible.get().characters).toEqual([
      { id: 'عمر', name: 'عمر', color: '#38bdf8', role: 'friend' },
    ]);
    expect(bible.addFact('Omar fears water.')).toBe(true);
    expect(bible.addFact('Omar fears water.')).toBe(false);
    bible.learn([SCENE]);
    bible.removeCharacter('عمر');
    bible.removeAsset(bible.get().assets[0]?.id ?? '');
    bible.removeFact('Omar fears water.');
    expect(bible.get().characters.map(({ id }) => id)).toEqual(['layla']);
    expect(bible.get().assets).toEqual([]);
    expect(bible.get().facts).toEqual([]);
    bible.clear();
    expect(bible.isEmpty()).toBe(true);
  });

  it('survives corrupt, hostile and blocked storage', () => {
    expect(createStoryBibleStore(memoryStorage('{not json')).isEmpty()).toBe(true);
    const hostile = createStoryBibleStore(
      memoryStorage(
        JSON.stringify({ schemaVersion: 1, assets: [{ id: 'x', url: 'javascript:alert(1)' }] }),
      ),
    );
    expect(hostile.get().assets).toEqual([]);
    const blocked = createStoryBibleStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('full');
      },
    });
    expect(blocked.addFact('Still works.')).toBe(true);
    expect(blocked.get().facts).toEqual(['Still works.']);
  });

  it('reads scene scripts from custom-code regions only', () => {
    expect(
      sceneScriptsOf({
        a: { type: 'customCode', props: { js: SCENE } },
        b: { type: 'customCode', props: { js: '   ' } },
        c: { type: 'heading', props: { js: 'nope' } },
      }),
    ).toEqual([SCENE]);
  });
});
