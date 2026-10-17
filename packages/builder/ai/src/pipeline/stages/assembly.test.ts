import { describe, expect, it } from 'vitest';

import { validateAssembly } from './assembly';
import { StageRejectedError } from './errors';
import type { AssemblyResponse } from '../wire';

const answer = (commands: readonly unknown[]): AssemblyResponse =>
  ({ stage: 'assembly', commands }) as AssemblyResponse;

const ALLOWED = ['insertNode', 'setProps'];

const reasonsOf = (call: () => unknown): readonly string[] => {
  try {
    call();
  } catch (error: unknown) {
    if (error instanceof StageRejectedError) return error.reasons;
    throw error;
  }
  throw new Error('expected the stage to be rejected');
};

describe('validateAssembly — asset references (FR-045)', () => {
  it('accepts a reference the run was actually given', () => {
    const steps = validateAssembly(
      answer([{ command: 'setProps', args: { id: 'n1', props: { image: { assetId: 'kiln' } } } }]),
      ALLOWED,
      ['kiln'],
    );

    expect(steps).toHaveLength(1);
  });

  it('REFUSES an id that is not in the site asset table', () => {
    /*
      The door cannot catch this one: `{ assetId: 'hero-1' }` satisfies the
      block schema exactly, so the site would store it, validate, and render a
      hole. This is the whole reason the check exists here.
    */
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          { command: 'setProps', args: { id: 'n1', props: { image: { assetId: 'hero-1' } } } },
        ]),
        ALLOWED,
        ['kiln'],
      ),
    );

    expect(reasons).toContain(
      'Command 1 references the picture "hero-1", which is not in this site\'s asset table.',
    );
  });

  it('says something DIFFERENT when the run had no library at all', () => {
    /*
      "Not in the table" sends a person looking for a picture they think they
      uploaded. "There is no library" sends them to wire one up. Two failures,
      two sentences.
    */
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([{ command: 'setProps', args: { props: { image: { assetId: 'hero-1' } } } }]),
        ALLOWED,
        [],
      ),
    );

    expect(reasons[0]).toContain('this run has no asset library');
  });

  it('finds a reference wherever the block chose to put it', () => {
    /*
      A walk, not a lookup at `props.image`: the registry owns where an image
      prop lives, and a check that only looked in one place would pass a site
      full of unresolvable pictures the moment a block nested them.
    */
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          {
            command: 'insertNode',
            args: { props: { items: [{ label: 'a' }, { photo: { assetId: 'ghost' } }] } },
          },
        ]),
        ALLOWED,
        ['kiln'],
      ),
    );

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('"ghost"');
  });

  it('leaves a command with no pictures alone', () => {
    expect(
      validateAssembly(
        answer([{ command: 'insertNode', args: { props: { title: 'Hello' } } }]),
        ALLOWED,
        [],
      ),
    ).toHaveLength(1);
  });

  it('reports EVERY unresolvable reference, not just the first', () => {
    /*
      One reason per round trip is one round trip per picture. A stage that is
      told all of them at once can fix all of them at once.
    */
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          { command: 'setProps', args: { props: { image: { assetId: 'a' } } } },
          { command: 'setProps', args: { props: { image: { assetId: 'b' } } } },
        ]),
        ALLOWED,
        ['kiln'],
      ),
    );

    expect(reasons).toHaveLength(2);
  });
});

describe('validateAssembly — invented addresses (SC-012)', () => {
  it('REFUSES an image address a stage wrote for itself', () => {
    /*
      Found by an independent review, and it was a real hole. The catalogue
      withholds URLs so a stage cannot COPY one — but nothing stopped it
      INVENTING one into `src`, and such a command satisfied the block schema,
      the door, and `validateSite`. It rendered a broken image on a stranger's
      site, which is the exact failure the asset design exists to prevent.
    */
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          {
            command: 'insertNode',
            args: { type: 'image', props: { src: 'https://images.example.com/kiln.jpg' } },
          },
        ]),
        ALLOWED,
        ['kiln'],
      ),
    );

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('https://images.example.com/kiln.jpg');
    expect(reasons[0]).toContain('asset table');
  });

  it('refuses a `poster` and an `imageUrl` too, not only `src`', () => {
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          { command: 'insertNode', args: { props: { poster: 'https://a.example/p.jpg' } } },
          { command: 'insertNode', args: { props: { imageUrl: 'https://a.example/q.jpg' } } },
        ]),
        ALLOWED,
        [],
      ),
    );

    expect(reasons).toHaveLength(2);
  });

  it('finds one nested inside a list of items', () => {
    const reasons = reasonsOf(() =>
      validateAssembly(
        answer([
          {
            command: 'insertNode',
            args: { props: { items: [{ caption: 'a' }, { src: 'https://a.example/b.jpg' }] } },
          },
        ]),
        ALLOWED,
        [],
      ),
    );

    expect(reasons).toHaveLength(1);
  });

  it('leaves a LINK alone, because a business legitimately has one', () => {
    /*
      The rule is not "no addresses". A booking page, an Instagram profile, a
      map pin — refusing those would break the sites this is meant to build. A
      picture is the special case: it has exactly one legitimate source.
    */
    const steps = validateAssembly(
      answer([
        {
          command: 'insertNode',
          args: { props: { href: 'https://instagram.com/the-studio', label: 'Follow us' } },
        },
      ]),
      ALLOWED,
      [],
    );

    expect(steps).toHaveLength(1);
  });

  it('leaves an empty `src` alone — that is an absence, not an address', () => {
    const steps = validateAssembly(
      answer([{ command: 'insertNode', args: { props: { src: '' } } }]),
      ALLOWED,
      [],
    );

    expect(steps).toHaveLength(1);
  });
});
