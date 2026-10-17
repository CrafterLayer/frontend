import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { landingFixture } from '@craftkit/builder-core/testing';

import { Slot } from './Slot';

const hero = landingFixture().nodes['hero1'];
if (hero === undefined) {
  throw new Error('landing fixture changed: hero1 missing');
}

describe('Slot', () => {
  it('hands ordered child ids to the render-prop (document order)', () => {
    render(
      <Slot node={hero} name="actions">
        {(ids) => <output>{ids.join(',')}</output>}
      </Slot>,
    );
    expect(screen.getByRole('status')).toHaveTextContent('cta1,cta2');
  });

  it('hands a frozen empty list for undeclared slots', () => {
    let received: readonly string[] = ['sentinel'];
    render(
      <Slot node={hero} name="nope">
        {(ids) => {
          received = ids;
          return null;
        }}
      </Slot>,
    );
    expect(received).toEqual([]);
    expect(Object.isFrozen(received)).toBe(true);
  });
});
