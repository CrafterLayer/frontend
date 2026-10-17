import { describe, expect, it } from 'vitest';

import { BEHAVIOR_CSS } from './behaviors-css';

/*
  One owner per entrance (walk 2026-10-08): a stagger grid that a timeline
  also animated stayed at opacity 0 on the published page, because the
  stagger CSS held the children hidden while the timeline tweened them from
  hidden to hidden. An element a timeline owns is never hidden by the
  reveal/stagger rules.
*/

/** The selectors of the rule that hides content before it is revealed. */
function hidingSelectors(): readonly string[] {
  const match = /\{\s*([^{}]+?)\s*\{\s*opacity: 0;/u.exec(BEHAVIOR_CSS);
  expect(match).not.toBeNull();
  return (match?.[1] ?? '').split(',').map((selector) => selector.trim());
}

function hidden(markup: string, probe: string): boolean {
  document.body.innerHTML = markup;
  const element = document.querySelector(probe);
  expect(element).not.toBeNull();
  return hidingSelectors().some((selector) => element?.matches(selector) === true);
}

describe('reveal and stagger never fight a timeline', () => {
  it('holds a stagger item hidden until it is revealed, when no timeline owns it', () => {
    expect(
      hidden("<ul data-ck-behavior='stagger' data-ck-mounted=''><li id='item'>A</li></ul>", '#item'),
    ).toBe(true);
  });

  it('leaves the items of a timeline-owned stagger grid to the timeline', () => {
    expect(
      hidden(
        "<ul data-ck-behavior='stagger' data-ck-timeline='stagger-in' data-ck-mounted=''><li id='item'>A</li></ul>",
        '#item',
      ),
    ).toBe(false);
    expect(
      hidden("<section id='s' data-ck-behavior='reveal' data-ck-timeline='fade-in' data-ck-mounted=''></section>", '#s'),
    ).toBe(false);
  });
});
