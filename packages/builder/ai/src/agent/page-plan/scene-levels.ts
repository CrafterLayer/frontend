import { finding, type SceneLiteral, type SceneSource } from './scene-source';
import type { SectionCheckIssue } from './types';

/*
  Levels that can be finished (T231c, 2026-10-12). A tile game is written as rows of characters
  and a legend (`T.world(app,{rows:['#####','#p.e#',…],legend:{'#':{solid:true},p:{kind:'player'},
  e:{kind:'exit'}}})`), and the commonest broken level is one whose exit or coin sits behind
  solid tiles: the game runs, draws, and can never be won — no probe sees it. This rule reads
  every grid the code writes literally, with its legend, and walks from the player through every
  tile that is not solid, up, down and sideways, ignoring gravity and jump height. That walk is
  more generous than any platformer, so a target it cannot reach is unreachable in the game too:
  the rule never flags a level that can be finished, and stays silent when it cannot read one.
*/

/** A grid row: 5-80 characters, no space or quote. */
const ROW = /^[^\s'"`\\]{5,80}$/u;
const MIN_ROWS = 3;
/** A legend entry: a one-character key, quoted or bare, and its object. */
const ENTRY = /(?:(['"])([^'"\\])\1|(?<![\w$])([A-Za-z0-9_$]))\s*:\s*\{([^{}]{0,400})\}/gu;
const SOLID = /\bsolid\s*:\s*(?:true|!0)\b/u;
const KIND = /\bkind\s*:\s*['"]([\w-]{1,24})['"]/u;
const EXITS = new Set(['exit', 'goal', 'door', 'flag', 'portal', 'finish']);
const PICKUPS = new Set(['coin', 'star', 'gem', 'key', 'pickup', 'item', 'collectible']);
const MAX_REPORTED = 3;

interface Legend {
  readonly solid: ReadonlySet<string>;
  readonly kinds: ReadonlyMap<string, string>;
}

function legendOf(source: SceneSource): Legend {
  const solid = new Set<string>();
  const kinds = new Map<string, string>();
  for (const match of source.code.matchAll(ENTRY)) {
    const key = match[2] ?? match[3] ?? '';
    const body = match[4] ?? '';
    if (key === '') continue;
    if (SOLID.test(body)) solid.add(key);
    const kind = KIND.exec(body)?.[1];
    if (kind !== undefined) kinds.set(key, kind.toLowerCase());
  }
  return { solid, kinds };
}

/** The literal-only arrays of equal rows: the grids the code writes. */
function gridsOf(source: SceneSource): readonly (readonly string[])[] {
  const grids: string[][] = [];
  let run: SceneLiteral[] = [];
  const close = (): void => {
    const rows = run.map(({ text }) => text);
    const width = rows[0]?.length ?? 0;
    if (rows.length >= MIN_ROWS && rows.every((row) => ROW.test(row) && row.length === width)) {
      grids.push(rows);
    }
    run = [];
  };
  for (const literal of source.literals) {
    const previous = run.at(-1);
    // Consecutive elements of one array: only a comma and space between them.
    const joined =
      previous !== undefined && /^\s*,\s*$/u.test(source.bare.slice(previous.end, literal.start));
    if (!joined) close();
    const opens = run.length > 0 || /\[\s*$/u.test(source.bare.slice(0, literal.start));
    if (opens) run.push(literal);
  }
  close();
  return grids;
}

interface Cell {
  readonly col: number;
  readonly row: number;
}

function cellsOf(grid: readonly string[], keys: ReadonlySet<string>): Cell[] {
  const cells: Cell[] = [];
  // By index, as the walk reads a tile (`grid[row][col]`): rows are tile codes, one per unit.
  grid.forEach((line, row) => {
    for (let col = 0; col < line.length; col += 1) {
      if (keys.has(line.charAt(col))) cells.push({ col, row });
    }
  });
  return cells;
}

function reachable(grid: readonly string[], solid: ReadonlySet<string>, from: readonly Cell[]) {
  const seen = new Set<string>();
  const queue = [...from];
  const key = ({ col, row }: Cell): string => `${String(col)},${String(row)}`;
  for (const cell of from) seen.add(key(cell));
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const cell = { col: next.col + dc, row: next.row + dr };
      const char = grid[cell.row]?.[cell.col];
      if (char === undefined || solid.has(char) || seen.has(key(cell))) continue;
      seen.add(key(cell));
      queue.push(cell);
    }
  }
  return (cell: Cell): boolean => seen.has(key(cell));
}

const place = ({ col, row }: Cell): string => `column ${String(col + 1)}, row ${String(row + 1)}`;

/** Every literal level whose exit or pickups the player cannot reach, as the repair to make. */
export function levelFindings(source: SceneSource): readonly SectionCheckIssue[] {
  const grids = gridsOf(source);
  if (grids.length === 0) return [];
  const legend = legendOf(source);
  const keysOf = (kinds: ReadonlySet<string>): Set<string> =>
    new Set([...legend.kinds].filter(([, kind]) => kinds.has(kind)).map(([key]) => key));
  const players = keysOf(new Set(['player', 'hero', 'start', 'spawn']));
  const targets = keysOf(new Set([...EXITS, ...PICKUPS]));
  if (legend.solid.size === 0 || players.size === 0 || targets.size === 0) return [];
  const findings: SectionCheckIssue[] = [];
  grids.forEach((grid, index) => {
    const start = cellsOf(grid, players);
    if (start.length === 0) return;
    const reaches = reachable(grid, legend.solid, start);
    const stuck = cellsOf(grid, targets)
      .filter((cell) => !reaches(cell))
      .slice(0, MAX_REPORTED);
    if (stuck.length === 0) return;
    const what = stuck
      .map(
        (cell) =>
          `the ${legend.kinds.get(grid[cell.row]?.[cell.col] ?? '') ?? 'target'} at ${place(cell)}`,
      )
      .join(', ');
    const walls = [...legend.solid].join(' ');
    const level = grids.length > 1 ? `Level ${String(index + 1)}: ` : 'The level: ';
    const first = source.code.indexOf(grid[0] ?? '');
    findings.push(
      finding(
        'scene-level',
        `${level}${what} cannot be reached from the player at ${place(start[0] ?? { col: 0, row: 0 })} — solid tiles (${walls}) close it off even without gravity. Open a path to it, or move it where the player can go.`,
        source,
        first < 0 ? 0 : first,
      ),
    );
  });
  return findings;
}
