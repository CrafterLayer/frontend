/**
 * Levels that can be finished (T231c, 2026-10-12): a literal tile level whose exit or pickups sit
 * behind solid tiles is flagged with where they are; a level that can be finished, a grid with no
 * legend, and code with no grid at all are left alone — and so is every taught example.
 */
import { describe, expect, it } from 'vitest';

import * as creativeEngines from '../../skills/creative/creative-engines';
import * as gameEngines from '../../skills/creative/game-engines';
import { levelFindings } from './scene-levels';
import { readSceneSource } from './scene-source';

const LEGEND = `legend:{'#':{style:'stone',solid:true},'=':{oneWay:true},c:{kind:'coin',marker:true},p:{kind:'player',marker:true},e:{kind:'exit'}}`;

function world(...levels: (readonly string[])[]): string {
  return levels
    .map(
      (rows) =>
        `T.world(s.app,{tileSize:32,rows:[${rows.map((row) => `'${row}'`).join(',')}],${LEGEND}});`,
    )
    .join('\n');
}

const OPEN = ['##########', '#p..c...e#', '#..====..#', '##########'];
const SEALED_EXIT = ['##########', '#p..c.#e.#', '#.....####', '##########'];
// The exit is reached by the bottom corridor; the coin is walled in on all four sides.
const BOXED_COIN = ['##########', '#p..#c#.e#', '#...###..#', '#........#', '##########'];

const findings = (code: string) => levelFindings(readSceneSource(code));

describe('levelFindings', () => {
  it('leaves a level that can be finished alone', () => {
    expect(findings(world(OPEN))).toEqual([]);
  });

  it('flags an exit behind solid tiles, with where it is and where the player starts', () => {
    const [issue, ...rest] = findings(world(SEALED_EXIT));
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({ code: 'scene-level', path: 'js line 1' });
    expect(issue?.message).toContain('the exit at column 8, row 2');
    expect(issue?.message).toContain('the player at column 2, row 2');
  });

  it('flags a pickup boxed in, and names the level when there are several', () => {
    const [issue, ...rest] = findings(world(OPEN, BOXED_COIN));
    expect(rest).toEqual([]);
    expect(issue?.message).toMatch(/^Level 2: the coin at column 6, row 2 cannot be reached/u);
  });

  it('stays silent where it cannot read a level', () => {
    // No solid tile in the legend: the walls are unknown.
    expect(findings(world(SEALED_EXIT).replace('solid:true', 'solid:false'))).toEqual([]);
    // No player marker.
    expect(findings(world(SEALED_EXIT).replace("kind:'player'", "kind:'npc'"))).toEqual([]);
    // Arrays that are not grids.
    expect(findings("const s=await ck.scene({libs:['physics','fx','tilemap']});")).toEqual([]);
  });

  it('finds nothing wrong in any taught example', () => {
    const examples = [creativeEngines, gameEngines]
      .flatMap((module) => Object.entries(module) as [string, unknown][])
      .filter(
        (entry): entry is [string, string] =>
          entry[0].endsWith('_EXAMPLE') && typeof entry[1] === 'string',
      );
    expect(examples.length).toBeGreaterThan(3);
    for (const [name, code] of examples) expect(findings(code), name).toEqual([]);
  });
});
