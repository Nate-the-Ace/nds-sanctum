# Sanctum Engine Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the deterministic Sanctum rules engine (`@sanctum/engine`) with the TypeScript card-script API, so a full game turn (training, spells, movement, combat, capture, initiative) resolves headlessly under test.

**Architecture:** A pure TypeScript package. State is plain serializable data; every public function clones the state, runs rules on an internal mutable `Engine` draft, and returns the new state. Rule steps fire named events that bubble minion -> group -> square -> structure -> globe; card scripts are modules whose handlers run on those events through a typed `EventContext`. All randomness comes from a seeded PRNG stored in state.

**Tech Stack:** TypeScript (strict, ESM), npm workspaces, Vitest. No runtime dependencies.

**Scope note:** This is plan 1 of 3 for milestone 1 (spec: `docs/superpowers/specs/2026-10-16-sanctum-remake-design.md`). Plan 2 = `packages/cards` (War + Life card scripts) and `tools/scrape`. Plan 3 = `packages/web` hotseat client. Those plans are written after this one ships, against the real engine API.

**User decisions (already made):**
- "Faithful clone" of Sanctum, web browser target.
- Milestone 1 = "Engine + hotseat".
- Card data: "Scrape playsanctum.net/cards"; IP: "Private use only".
- Card scripts: "C" (full scripting power) and form = "TypeScript modules with hooks".
- "I trust your judgement on rules of play."

**Rule decisions made in this plan (deviations from the original, all listed so none is a surprise):**
1. Orders are submitted as one data object per player (not drag-by-drag). Training takes effect when the turn resolves, so spells cannot target recruits trained the same turn, and a recruit trained this turn cannot move this turn.
2. Terrain effects are engine built-ins, not spells. Ice sliding and swamp exit restrictions are not implemented (Veldt has no ice; swamp is rare). Blocking, desert/lava/volcano damage, drowning and void are implemented.
3. Movement events `group:exit`, `group:move`, `group:enter` fire after unstacking as notifications (not cancellable). Movement-cancelling cards act by clearing `moveOrder` during spell execution.
4. Group events visit every minion of the group, then the group's own spells, then square/structure/globe (original visits group spells per minion).
5. Pass II voting resolves each overstacked square among all its groups at once, not two at a time. The original moonwalk diagram still resolves identically (golden test in Task 10).
6. Board is a 10x10 grid minus the 3-square staircase at corners (0,0) and (9,9): 94 squares. Red Sanctum centre (2,2), blue (7,7). The centerline is x+y=9. Combat fight order for the precedence group is n, s, e, w (original NE, SW, SE, NW as seen from blue at the bottom).
7. Starting resources: 4 recruits (2 swordsmen, 2 archers) and 3 novices in each Sanctum. All numbers live in `rules.ts`.
8. The odd (5th) town goes on a random centre-line square (4,5) or (5,4); the original's "symmetric" option needs a centre square this board does not have.

---

## File structure

```
sanctum/
  package.json                      root workspaces + scripts
  tsconfig.base.json
  packages/engine/
    package.json  tsconfig.json  vitest.config.ts
    src/
      types.ts        all state types, MANA_TYPES, emptyPool
      rules.ts        RULES constants, recruitBase()
      rng.ts          seeded PRNG: nextRandom, randInt, shuffle
      houses.ts       HOUSES table (primary/secondary mana)
      board.ts        layout, geometry, sanctum squares, centerline
      terrain.ts      terrain table, blocking rule, harsh/damage data
      terrainfx.ts    applyTerrain (damage/drown/void), checkFatal, groupCanEnter
      mapgen.ts       town placement + terrain rolling (Veldt)
      engine.ts       Engine type + makeEngine
      cards.ts        CardDef, defineCard, indexCards, SummonDef
      query.ts        pure state queries (groupAt, sequence, hostile, spellsOn ...)
      spellstore.ts   raw active-spell list operations
      units.ts        create/spawn/remove groups and minions
      stats.ts        computed minion stats (base + spell deltas)
      ctx.ts          QueryContext / EventContext for card scripts
      events.ts       event names + bubbling dispatch
      damage.ts       Takes-Damage and Apply-Damage pipelines
      death.ts        minion death pipeline
      spells.ts       targeting, cast/execute, persistence recheck, expiry
      deck.ts         drawCards
      turn.ts         beginTurn / finishTurnStart / resolveTurn
      orders.ts       validateOrders
      movement.ts     two-pass movement
      combat.ts       combat pipeline
      api.ts          createGame, submitOrders, confirmOrders, chooseMana
      index.ts        public exports
    test/             one test file per module + helpers.ts
```

Dependency note: `events.ts`, `ctx.ts`, `damage.ts`, `death.ts`, `spells.ts` import each other (card handlers call back into the engine). ES module cycles are safe here because every cross-module use is inside a function body, never at module load. Do not add top-level code that calls across them.

---

### Task 0: Monorepo scaffold

**Goal:** An installable npm-workspaces repo where `npm test` runs Vitest in `packages/engine`.

**Files:**
- Create: `package.json`, `tsconfig.base.json`, `packages/engine/package.json`, `packages/engine/tsconfig.json`, `packages/engine/vitest.config.ts`, `packages/engine/src/index.ts`, `packages/engine/test/smoke.test.ts`

**Acceptance Criteria:**
- [ ] `npm install` succeeds at repo root
- [ ] `npm test` runs one passing test
- [ ] `npm run typecheck` exits 0

**Verify:** `npm test` -> `1 passed`

**Steps:**

- [ ] **Step 1: Write root `package.json`**

```json
{
  "name": "sanctum",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "npm test -w @sanctum/engine",
    "typecheck": "npm run typecheck -w @sanctum/engine"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^5.0.5"
  }
}
```

- [ ] **Step 2: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "esModuleInterop": true
  }
}
```

- [ ] **Step 3: Write the engine package files**

`packages/engine/package.json`:
```json
{
  "name": "@sanctum/engine",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p . --noEmit"
  }
}
```

`packages/engine/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src", "test", "vitest.config.ts"]
}
```

`packages/engine/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```

`packages/engine/src/index.ts`:
```ts
export const ENGINE_VERSION = '0.0.0';
```

`packages/engine/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ENGINE_VERSION } from '../src/index';

describe('scaffold', () => {
  it('loads the engine package', () => {
    expect(ENGINE_VERSION).toBe('0.0.0');
  });
});
```

- [ ] **Step 4: Install and run**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm install && npm test && npm run typecheck`
Expected: `1 passed`, typecheck exits 0.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.base.json packages package-lock.json
git commit -m "chore: scaffold npm workspaces monorepo with engine package"
```

---

### Task 1: Core types, rules constants, RNG, houses

**Goal:** The shared vocabulary every later module imports, plus the seeded PRNG.

**Files:**
- Create: `packages/engine/src/types.ts`, `rules.ts`, `rng.ts`, `houses.ts`
- Test: `packages/engine/test/rng.test.ts`, `packages/engine/test/houses.test.ts`

**Acceptance Criteria:**
- [ ] `nextRandom` is deterministic per seed and returns values in [0,1)
- [ ] `shuffle` is a deterministic permutation
- [ ] `HOUSES` has 12 houses; war = strife/clarity, life = clarity/world

**Verify:** `npx vitest run test/rng.test.ts test/houses.test.ts` (from `packages/engine`) -> all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`test/rng.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { nextRandom, randInt, shuffle } from '../src/rng';

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = { seed: 42 };
    const b = { seed: 42 };
    expect([nextRandom(a), nextRandom(a), nextRandom(a)]).toEqual([nextRandom(b), nextRandom(b), nextRandom(b)]);
  });

  it('returns values in [0,1)', () => {
    const s = { seed: 7 };
    for (let i = 0; i < 1000; i++) {
      const v = nextRandom(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('randInt stays in range', () => {
    const s = { seed: 9 };
    for (let i = 0; i < 500; i++) {
      const v = randInt(s, 6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });

  it('shuffle keeps the elements and is deterministic', () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle({ seed: 5 }, input);
    const b = shuffle({ seed: 5 }, input);
    expect(a).toEqual(b);
    expect([...a].sort()).toEqual(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
```

`test/houses.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { HOUSES } from '../src/houses';

describe('houses', () => {
  it('has 12 houses with distinct primary and secondary mana', () => {
    const ids = Object.keys(HOUSES);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const h = HOUSES[id as keyof typeof HOUSES];
      expect(h.primary).not.toBe(h.secondary);
    }
  });

  it('matches the original table for war and life', () => {
    expect(HOUSES.war).toEqual({ primary: 'strife', secondary: 'clarity' });
    expect(HOUSES.life).toEqual({ primary: 'clarity', secondary: 'world' });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/engine && npx vitest run test/rng.test.ts test/houses.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Write `src/types.ts`**

```ts
export type Side = 'red' | 'blue';
export type PlayerId = Side | 'neutral';
export const SIDES: Side[] = ['red', 'blue'];

export type Mana = 'clarity' | 'mystery' | 'order' | 'strife' | 'will' | 'world';
export const MANA_TYPES: Mana[] = ['clarity', 'mystery', 'order', 'strife', 'will', 'world'];
export type ManaPool = Record<Mana, number>;
export const emptyPool = (): ManaPool => ({ clarity: 0, mystery: 0, order: 0, strife: 0, will: 0, world: 0 });

export type TerrainId =
  | 'plains' | 'barren' | 'forest' | 'ice' | 'mountain' | 'swamp'
  | 'desert' | 'lava' | 'volcano' | 'water' | 'void';
export type Walk = 'desert' | 'water' | 'mountain' | 'fire' | 'flight';

export interface Pos { x: number; y: number }
export type Dir = 'n' | 'e' | 's' | 'w';

export type HouseId =
  | 'abomination' | 'body' | 'death' | 'despair' | 'hope' | 'justice'
  | 'life' | 'making' | 'mind' | 'nature' | 'unmaking' | 'war';

export interface BaseStats {
  hp: number;
  level: number;
  armor: number;
  hand: number;
  handAttacks: number;
  missile: number;
  missileAttacks: number;
  walks: Walk[];
}

export interface MinionSpec {
  kind: 'recruit' | 'monster';
  cls: 'swordsman' | 'archer' | 'monster';
  name: string;
  base: BaseStats;
}

export interface SummonDef {
  owner: PlayerId;
  pos: Pos;
  control?: 'player' | 'computer';
  botId?: string | null;
  minions: MinionSpec[];
}

export type Ref =
  | { kind: 'minion'; id: number }
  | { kind: 'group'; id: number }
  | { kind: 'square'; pos: Pos }
  | { kind: 'structure'; id: number }
  | { kind: 'globe' };

export interface Minion {
  id: number;
  kind: 'recruit' | 'monster';
  cls: 'swordsman' | 'archer' | 'monster';
  name: string;
  owner: PlayerId;
  groupId: number;
  hp: number;
  maxHp: number;
  base: BaseStats;
  status: 'alive' | 'dying' | 'dead';
  expQualified: boolean;
  hasExp: boolean;
  combat: { armor: number; handLeft: number; missileLeft: number; misses: number; victim: number | null };
}

export interface Group {
  id: number;
  kind: 'recruit' | 'monster';
  owner: PlayerId;
  minionIds: number[];
  pos: Pos | null;
  control: 'player' | 'computer';
  botId: string | null;
  moveOrder: Dir | null;
}

export interface Structure {
  id: number;
  kind: 'sanctum' | 'town' | 'colony';
  pos: Pos;
  owner: PlayerId;
  manaType: Mana | null;
  novices: number;
  turnCount: number;
  captured: boolean;
}

export interface ActiveSpell {
  id: number;
  cardId: string;
  owner: PlayerId;
  host: Ref;
  visible: boolean;
  turnsLeft: number | null;
  tokens: Record<string, number>;
}

export interface TrainOrder { structureId: number; as: 'swordsman' | 'archer' | Mana }
export interface CastOrder { handIndex: number; target: Ref }
export interface MoveOrder { groupId: number; dir: Dir }
export interface Orders {
  train: TrainOrder[];
  cast: CastOrder[];
  move: MoveOrder[];
  discard: number | null;
}
export const emptyOrders = (): Orders => ({ train: [], cast: [], move: [], discard: null });

export interface PlayerState {
  id: Side;
  house: HouseId;
  mana: ManaPool;
  deck: string[];
  hand: string[];
  discard: string[];
  orders: Orders | null;
  confirmed: boolean;
}

export interface LogEntry { type: string; [key: string]: unknown }

export interface GameState {
  turn: number;
  phase: 'choose-mana' | 'orders' | 'over';
  initiative: Side;
  winner: Side | null;
  seed: number;
  cells: string[];
  terrain: Record<string, TerrainId>;
  structures: Record<number, Structure>;
  groups: Record<number, Group>;
  minions: Record<number, Minion>;
  spells: ActiveSpell[];
  graveyard: number[];
  groupSeq: Record<PlayerId, number[]>;
  players: Record<Side, PlayerState>;
  pendingMana: number[];
  nextId: number;
  log: LogEntry[];
}
```

- [ ] **Step 4: Write `src/rules.ts`**

```ts
import type { BaseStats } from './types';

export const RULES = {
  handSize: 5,
  maxGroup: 8,
  maxNovices: 8,
  sanctumNoviceRate: 4,
  townNoviceRate: 2,
  startNovices: 3,
  startGroup: ['swordsman', 'swordsman', 'archer', 'archer'] as const,
  minDeck: 30,
  maxCopies: 4,
  recruitHp: 7,
  recruitLevel: 1,
  combatRounds: 10,
  maxLevel: 5,
  towns: 5,
} as const;

export function recruitBase(cls: 'swordsman' | 'archer'): BaseStats {
  return cls === 'swordsman'
    ? { hp: RULES.recruitHp, level: RULES.recruitLevel, armor: 1, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] }
    : { hp: RULES.recruitHp, level: RULES.recruitLevel, armor: 0, hand: 0, handAttacks: 0, missile: 2, missileAttacks: 1, walks: [] };
}
```

- [ ] **Step 5: Write `src/rng.ts`**

```ts
export interface Seeded { seed: number }

/** mulberry32. Mutates `s.seed`, returns a float in [0,1). */
export function nextRandom(s: Seeded): number {
  s.seed = (s.seed + 0x6d2b79f5) | 0;
  let t = s.seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export function randInt(s: Seeded, n: number): number {
  return Math.floor(nextRandom(s) * n);
}

/** Fisher-Yates on a copy. */
export function shuffle<T>(s: Seeded, input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(s, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick<T>(s: Seeded, input: readonly T[]): T {
  return input[randInt(s, input.length)];
}
```

- [ ] **Step 6: Write `src/houses.ts`**

```ts
import type { HouseId, Mana } from './types';

/** From Axioms/houses: each house has a primary and secondary mana type. */
export const HOUSES: Record<HouseId, { primary: Mana; secondary: Mana }> = {
  justice: { primary: 'order', secondary: 'mystery' },
  making: { primary: 'order', secondary: 'will' },
  hope: { primary: 'clarity', secondary: 'order' },
  life: { primary: 'clarity', secondary: 'world' },
  body: { primary: 'world', secondary: 'mystery' },
  nature: { primary: 'world', secondary: 'order' },
  unmaking: { primary: 'strife', secondary: 'world' },
  war: { primary: 'strife', secondary: 'clarity' },
  death: { primary: 'mystery', secondary: 'will' },
  despair: { primary: 'mystery', secondary: 'strife' },
  mind: { primary: 'will', secondary: 'clarity' },
  abomination: { primary: 'will', secondary: 'strife' },
};

export function houseMana(h: HouseId): Mana[] {
  return [HOUSES[h].primary, HOUSES[h].secondary];
}
```

- [ ] **Step 7: Run to verify pass, then commit**

Run: `cd packages/engine && npx vitest run test/rng.test.ts test/houses.test.ts`
Expected: PASS.

```bash
git add packages/engine
git commit -m "feat(engine): core types, rules constants, seeded rng, houses table"
```

---

### Task 2: Board geometry

**Goal:** The 94-square layout and geometry helpers.

**Files:**
- Create: `packages/engine/src/board.ts`
- Test: `packages/engine/test/board.test.ts`

**Acceptance Criteria:**
- [ ] `createCells()` returns 94 unique `"x,y"` keys and is 180-degree symmetric
- [ ] `sanctumSquares('red')` is the plus shape at (2,2); entrances are its 4 neighbours
- [ ] `step`, `neighbors`, `distance2`, `onCenterline` behave as specified

**Verify:** `npx vitest run test/board.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/board.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createCells, sanctumSquares, entrances, step, key, distance2, onCenterline, rotate, isEdge } from '../src/board';

describe('board', () => {
  const cells = new Set(createCells());

  it('has 94 unique squares', () => {
    expect(cells.size).toBe(94);
    expect(cells.has('0,0')).toBe(false);
    expect(cells.has('1,0')).toBe(false);
    expect(cells.has('0,1')).toBe(false);
    expect(cells.has('9,9')).toBe(false);
    expect(cells.has('1,1')).toBe(true);
  });

  it('is symmetric under 180 degree rotation', () => {
    for (const k of cells) {
      const [x, y] = k.split(',').map(Number);
      expect(cells.has(key(rotate({ x, y })))).toBe(true);
    }
  });

  it('builds sanctum plus shapes', () => {
    const red = sanctumSquares('red').map(key).sort();
    expect(red).toEqual(['1,2', '2,1', '2,2', '2,3', '3,2']);
    expect(entrances('red').map(key).sort()).toEqual(['1,2', '2,1', '2,3', '3,2']);
    expect(sanctumSquares('blue').map(key).sort()).toEqual(['6,7', '7,6', '7,7', '7,8', '8,7']);
  });

  it('steps in four directions', () => {
    expect(step({ x: 4, y: 4 }, 'n')).toEqual({ x: 4, y: 3 });
    expect(step({ x: 4, y: 4 }, 'e')).toEqual({ x: 5, y: 4 });
    expect(step({ x: 4, y: 4 }, 's')).toEqual({ x: 4, y: 5 });
    expect(step({ x: 4, y: 4 }, 'w')).toEqual({ x: 3, y: 4 });
  });

  it('measures distance and centerline', () => {
    expect(distance2({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(25);
    expect(onCenterline({ x: 4, y: 5 })).toBe(true);
    expect(onCenterline({ x: 4, y: 4 })).toBe(false);
    expect(isEdge({ x: 0, y: 5 })).toBe(true);
    expect(isEdge({ x: 5, y: 5 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`npx vitest run test/board.test.ts` -> module not found)

- [ ] **Step 3: Write `src/board.ts`**

```ts
import type { Dir, Pos, Side } from './types';

export const BOARD_SIZE = 10;
const REMOVED = new Set(['0,0', '1,0', '0,1', '9,9', '8,9', '9,8']);

export const SANCTUM_POS: Record<Side, Pos> = { red: { x: 2, y: 2 }, blue: { x: 7, y: 7 } };
export const DIRS: Record<Dir, Pos> = { n: { x: 0, y: -1 }, e: { x: 1, y: 0 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 } };
export const DIR_LIST: Dir[] = ['n', 'e', 's', 'w'];

export const key = (p: Pos): string => `${p.x},${p.y}`;
export const parseKey = (k: string): Pos => {
  const [x, y] = k.split(',').map(Number);
  return { x, y };
};
export const samePos = (a: Pos, b: Pos): boolean => a.x === b.x && a.y === b.y;

export function createCells(): string[] {
  const out: string[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      const k = `${x},${y}`;
      if (!REMOVED.has(k)) out.push(k);
    }
  }
  return out;
}

export function step(p: Pos, d: Dir): Pos {
  return { x: p.x + DIRS[d].x, y: p.y + DIRS[d].y };
}

export function neighborPositions(p: Pos): Array<{ dir: Dir; pos: Pos }> {
  return DIR_LIST.map((dir) => ({ dir, pos: step(p, dir) }));
}

export function rotate(p: Pos): Pos {
  return { x: BOARD_SIZE - 1 - p.x, y: BOARD_SIZE - 1 - p.y };
}

export function entrances(side: Side): Pos[] {
  return DIR_LIST.map((d) => step(SANCTUM_POS[side], d));
}

export function sanctumSquares(side: Side): Pos[] {
  return [SANCTUM_POS[side], ...entrances(side)];
}

export function distance2(a: Pos, b: Pos): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

/** The line equidistant between the two Sancta. */
export function onCenterline(p: Pos): boolean {
  return p.x + p.y === BOARD_SIZE - 1;
}

export function isEdge(p: Pos): boolean {
  return p.x === 0 || p.y === 0 || p.x === BOARD_SIZE - 1 || p.y === BOARD_SIZE - 1;
}

export function isSanctumArea(p: Pos): boolean {
  return (['red', 'blue'] as Side[]).some((s) => sanctumSquares(s).some((q) => samePos(p, q)));
}
```

- [ ] **Step 4: Run to verify pass, commit**

```bash
git add packages/engine
git commit -m "feat(engine): 94-square board geometry"
```

---

### Task 3: Terrain table and map generation

**Goal:** Terrain rules (blocking, damage) as data, and Veldt map generation (towns + terrain).

**Files:**
- Create: `packages/engine/src/terrain.ts` (data + blocking rule only; effects live in `terrainfx.ts`, Task 8), `packages/engine/src/mapgen.ts`
- Test: `packages/engine/test/mapgen.test.ts`

**Acceptance Criteria:**
- [ ] `terrainBlocks` follows the Terrainwalks table (mountain/volcano need mountain walk, water needs water walk, flight crosses everything)
- [ ] `placeTowns(rng, 5)` returns 5 positions: none on an edge, none on/adjacent to the centerline except the odd centre town, none adjacent to a Sanctum entrance, none orthogonally adjacent to another town; first 4 come in rotated pairs
- [ ] `rollTerrain` is deterministic per seed, forces plains on Sancta/entrances/towns, and no town has more than one blocking/deadly neighbour

**Verify:** `npx vitest run test/mapgen.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/mapgen.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { placeTowns, rollTerrain } from '../src/mapgen';
import { terrainBlocks } from '../src/terrain';
import { createCells, entrances, isEdge, key, neighborPositions, onCenterline, rotate, sanctumSquares, samePos } from '../src/board';
import type { Pos } from '../src/types';

const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

describe('terrainBlocks', () => {
  it('follows the walk table', () => {
    expect(terrainBlocks('mountain', [])).toBe(true);
    expect(terrainBlocks('mountain', ['mountain'])).toBe(false);
    expect(terrainBlocks('volcano', ['fire'])).toBe(true);
    expect(terrainBlocks('volcano', ['mountain'])).toBe(false);
    expect(terrainBlocks('water', [])).toBe(true);
    expect(terrainBlocks('water', ['water'])).toBe(false);
    expect(terrainBlocks('water', ['flight'])).toBe(false);
    expect(terrainBlocks('plains', [])).toBe(false);
    expect(terrainBlocks('forest', [])).toBe(false);
  });
});

describe('placeTowns', () => {
  it('places 5 legal towns for many seeds', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const towns = placeTowns({ seed }, 5);
      expect(towns).toHaveLength(5);
      const entr = [...entrances('red'), ...entrances('blue')];
      const odd = towns[4];
      expect(onCenterline(odd)).toBe(true);
      for (const t of towns.slice(0, 4)) {
        expect(isEdge(t)).toBe(false);
        expect([8, 9, 10]).not.toContain(t.x + t.y);
      }
      for (const t of towns) {
        for (const e of entr) expect(adjacent(t, e)).toBe(false);
      }
      for (let i = 0; i < towns.length; i++) {
        for (let j = i + 1; j < towns.length; j++) expect(adjacent(towns[i], towns[j])).toBe(false);
      }
      for (let i = 0; i < 2; i++) expect(samePos(rotate(towns[i]), towns[i + 2])).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(placeTowns({ seed: 3 }, 5)).toEqual(placeTowns({ seed: 3 }, 5));
  });

  it('places a single town on the centerline', () => {
    const t = placeTowns({ seed: 11 }, 1);
    expect(t).toHaveLength(1);
    expect(onCenterline(t[0])).toBe(true);
  });
});

describe('rollTerrain', () => {
  it('forces plains on structures and keeps towns open', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rng = { seed };
      const towns = placeTowns(rng, 5);
      const terrain = rollTerrain(rng, createCells(), towns);
      for (const s of [...sanctumSquares('red'), ...sanctumSquares('blue'), ...towns]) {
        expect(terrain[key(s)]).toBe('plains');
      }
      const blocking = ['mountain', 'volcano', 'swamp', 'water', 'void'];
      for (const t of towns) {
        const n = neighborPositions(t).filter((q) => blocking.includes(terrain[key(q.pos)] ?? 'plains')).length;
        expect(n).toBeLessThanOrEqual(1);
      }
    }
  });

  it('is deterministic and covers every cell', () => {
    const cells = createCells();
    const a = rollTerrain({ seed: 4 }, cells, []);
    const b = rollTerrain({ seed: 4 }, cells, []);
    expect(a).toEqual(b);
    expect(Object.keys(a).sort()).toEqual([...cells].sort());
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/terrain.ts`**

```ts
import type { TerrainId, Walk } from './types';

/** True if a group whose members all have `walks` cannot enter or exit this terrain. */
export function terrainBlocks(t: TerrainId, walks: Walk[]): boolean {
  if (walks.includes('flight')) return false;
  switch (t) {
    case 'mountain':
    case 'volcano':
      return !walks.includes('mountain');
    case 'water':
      return !walks.includes('water');
    default:
      return false;
  }
}

/** Terrains that block movement or are deadly (the "max 1 per town" map rule). */
export const HARSH: TerrainId[] = ['mountain', 'volcano', 'swamp', 'water', 'void'];

/** Damage dealt after start of turn, and the walk that prevents it. */
export const TERRAIN_DAMAGE: Partial<Record<TerrainId, { damage: number; immune: Walk }>> = {
  desert: { damage: 1, immune: 'desert' },
  lava: { damage: 3, immune: 'fire' },
  volcano: { damage: 5, immune: 'fire' },
};
```

- [ ] **Step 4: Write `src/mapgen.ts`**

```ts
import type { Pos, TerrainId } from './types';
import { nextRandom, pick, type Seeded } from './rng';
import {
  BOARD_SIZE, createCells, entrances, isEdge, key, neighborPositions, onCenterline, parseKey, rotate, sanctumSquares, samePos,
} from './board';
import { HARSH } from './terrain';

const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

function eligible(p: Pos, placed: Pos[]): boolean {
  if (isEdge(p)) return false;
  const s = p.x + p.y;
  if (s >= BOARD_SIZE - 2 && s <= BOARD_SIZE + 0) return false; // centerline (9) and its two neighbours (8, 10)
  const entr = [...entrances('red'), ...entrances('blue')];
  if (entr.some((e) => adjacent(e, p) || samePos(e, p))) return false;
  if (sanctumSquares('red').concat(sanctumSquares('blue')).some((q) => samePos(q, p))) return false;
  if (placed.some((t) => adjacent(t, p) || samePos(t, p))) return false;
  return true;
}

/** Half the towns (rounded down) random on the red half, rotated onto the blue half; an odd town goes on a centre-line square. */
export function placeTowns(rng: Seeded, count: number): Pos[] {
  const half = Math.floor(count / 2);
  const redHalf = createCells().map(parseKey).filter((p) => p.x + p.y < BOARD_SIZE - 2);
  const first: Pos[] = [];
  for (let i = 0; i < half; i++) {
    const placed = [...first, ...first.map(rotate)];
    const options = redHalf.filter((p) => eligible(p, placed) && eligible(rotate(p), placed));
    first.push(pick(rng, options));
  }
  const result = [...first, ...first.map(rotate)];
  if (count % 2 === 1) result.push(pick(rng, [{ x: 4, y: 5 }, { x: 5, y: 4 }]));
  return result;
}

const VELDT: Array<[TerrainId, number]> = [
  ['plains', 57], ['forest', 19.5], ['water', 4], ['mountain', 2.5], ['desert', 0.5], ['swamp', 0.5],
];
const DEFAULT_TERRAIN: TerrainId = 'plains';

function roll(rng: Seeded): TerrainId {
  const total = VELDT.reduce((a, [, w]) => a + w, 0);
  let r = nextRandom(rng) * total;
  for (const [t, w] of VELDT) {
    if (r < w) return t;
    r -= w;
  }
  return DEFAULT_TERRAIN;
}

/** Roll half the squares, mirror the rest, then apply the structure/default/max-1 rules. */
export function rollTerrain(rng: Seeded, cells: string[], towns: Pos[]): Record<string, TerrainId> {
  const terrain: Record<string, TerrainId> = {};
  const cellSet = new Set(cells);
  for (const k of cells) {
    const p = parseKey(k);
    if (p.x + p.y < BOARD_SIZE - 1 || onCenterline(p)) {
      terrain[k] = roll(rng);
    }
  }
  for (const k of cells) {
    if (terrain[k] !== undefined) continue;
    const r = key(rotate(parseKey(k)));
    terrain[k] = terrain[r] ?? DEFAULT_TERRAIN;
  }
  // default terrain next to each entrance (distance 2 from a Sanctum)
  for (const side of ['red', 'blue'] as const) {
    const area = sanctumSquares(side);
    for (const e of entrances(side)) {
      for (const n of neighborPositions(e)) {
        if (!cellSet.has(key(n.pos)) || area.some((q) => samePos(q, n.pos))) continue;
        terrain[key(n.pos)] = DEFAULT_TERRAIN;
      }
    }
  }
  // plains under structures
  for (const p of [...sanctumSquares('red'), ...sanctumSquares('blue'), ...towns]) terrain[key(p)] = 'plains';
  // max one blocking/deadly neighbour per town
  for (const t of towns) {
    let seen = 0;
    for (const n of neighborPositions(t)) {
      const k = key(n.pos);
      if (!cellSet.has(k)) continue;
      if (HARSH.includes(terrain[k])) {
        seen++;
        if (seen > 1) terrain[k] = DEFAULT_TERRAIN;
      }
    }
  }
  return terrain;
}
```

- [ ] **Step 5: Run to verify pass, commit**

Run: `cd packages/engine && npx vitest run test/mapgen.test.ts`
Expected: PASS. The result array is `[t1, t2, rot(t1), rot(t2), odd]`.

```bash
git add packages/engine
git commit -m "feat(engine): terrain blocking table and Veldt map generation"
```

---

### Task 4: Engine plumbing and the card API surface

**Goal:** Everything card scripts and rule pipelines are built on: the `Engine` draft, `CardDef`/`defineCard`, state queries, the raw spell store, unit creation, computed stats, `QueryContext`/`EventContext`, and bubbling event dispatch.

**Files:**
- Create: `src/engine.ts`, `src/cards.ts`, `src/query.ts`, `src/spellstore.ts`, `src/units.ts`, `src/stats.ts`, `src/ctx.ts`, `src/events.ts`, `src/state.ts`
- Test: `test/helpers.ts`, `test/events.test.ts`, `test/stats.test.ts`, `test/units.test.ts`

**Acceptance Criteria:**
- [ ] An event on a minion reaches spells hosted on the minion, its group, its square, the structure on that square, then the globe, in that order
- [ ] An untargeted event reaches spells grouped by owner in initiative order (initiative, other, neutral), oldest first within an owner
- [ ] A handler calling `ctx.cancel()` sets `event.data.cancel`; a spell removed mid-dispatch is not invoked
- [ ] `computeStats` adds spell deltas to base stats and clamps level to 0..5 and armor/damage to >= 0
- [ ] `addRecruit` joins an existing friendly recruit group in the square, otherwise creates a group

**Verify:** `npx vitest run test/events.test.ts test/stats.test.ts test/units.test.ts` -> all pass

**Steps:**

- [ ] **Step 1: Write `src/engine.ts`**

```ts
import type { CardIndex } from './cards';
import type { GameState } from './types';

/** Internal mutable draft: a cloned state plus the card index. Public API functions build one per call. */
export interface Engine {
  state: GameState;
  cards: CardIndex;
}

export function makeEngine(state: GameState, cards: CardIndex): Engine {
  return { state: structuredClone(state), cards };
}
```

- [ ] **Step 2: Write `src/cards.ts`**

```ts
import type { EventContext, QueryContext } from './ctx';
import type { EventType, GameEvent } from './events';
import type { StatDelta } from './stats';
import type { ActiveSpell, Dir, HouseId, ManaPool, Ref } from './types';

export type SpellType = 'alteration' | 'conjuration' | 'manifestation' | 'summoning' | 'hero';
export type TargetType =
  | 'recruit' | 'monster' | 'minion'
  | 'recruitGroup' | 'monsterGroup' | 'group'
  | 'square' | 'structure' | 'globe';

export interface CardDef {
  id: string;
  name: string;
  house: HouseId;
  cost: Partial<ManaPool>;
  type: SpellType;
  target: TargetType;
  text?: string;
  /** Alterations/conjurations are visible (dispellable, exclusive) unless this is false. */
  visible?: boolean;
  exclusive?: boolean;
  /** Individual spells normally cannot target enemy minions concealed in forest. */
  ignoresConcealment?: boolean;
  /** Conjuration lifetime. Counts the casting turn: `{ turns: 1 }` expires at the end of the turn it is cast. */
  duration?: { turns: number };
  /** Casting-time requirement. Checked while ordering and again just before execution. */
  canCast?: (q: QueryContext, target: Ref) => boolean;
  /** Persistent requirement. Rechecked after spell/structure flux; failure dispels the spell. */
  persistent?: (q: QueryContext, host: Ref) => boolean;
  /** Computed stat contribution for a minion this spell reaches (host minion, group, square, structure or globe). */
  stats?: (q: QueryContext, minionId: number, spell: ActiveSpell) => StatDelta;
  /** Runs when the spell executes successfully. */
  onCast?: (c: EventContext, target: Ref) => void;
  /** Event handlers, keyed by event type. */
  on?: Partial<Record<EventType, (c: EventContext, ev: GameEvent) => void>>;
  /** Movement AI for computer-controlled groups this card summons. Return null to stand still. */
  bot?: (q: QueryContext, groupId: number) => Dir | null;
}

export type CardIndex = Record<string, CardDef>;

export function defineCard(def: CardDef): CardDef {
  return def;
}

export function indexCards(defs: CardDef[]): CardIndex {
  const out: CardIndex = {};
  for (const d of defs) {
    if (out[d.id]) throw new Error(`duplicate card id ${d.id}`);
    out[d.id] = d;
  }
  return out;
}
```

- [ ] **Step 3: Write `src/query.ts`**

```ts
import { key, samePos } from './board';
import type { ActiveSpell, GameState, Group, Minion, PlayerId, Pos, Ref, Side, Structure } from './types';

export const otherSide = (s: Side): Side => (s === 'red' ? 'blue' : 'red');

/** Initiative sequence: initiative, non-initiative, neutral. */
export function sequence(s: GameState): PlayerId[] {
  return [s.initiative, otherSide(s.initiative), 'neutral'];
}

/** Combat/voting precedence rank: initiative 0, neutral 1, non-initiative 2. */
export function ownerRank(s: GameState, owner: PlayerId): number {
  return owner === s.initiative ? 0 : owner === 'neutral' ? 1 : 2;
}

export function groupsAt(s: GameState, pos: Pos): Group[] {
  return Object.values(s.groups).filter((g) => g.pos !== null && samePos(g.pos, pos));
}

export function groupAt(s: GameState, pos: Pos): Group | undefined {
  return groupsAt(s, pos)[0];
}

export function structureAt(s: GameState, pos: Pos): Structure | undefined {
  return Object.values(s.structures).find((st) => samePos(st.pos, pos));
}

/** Live (not dead) members of a group, in group order. */
export function minionsOf(s: GameState, groupId: number): Minion[] {
  const g = s.groups[groupId];
  if (!g) return [];
  return g.minionIds.map((id) => s.minions[id]).filter((m): m is Minion => !!m && m.status !== 'dead');
}

/** Groups are hostile when owned by different players; neutral groups are hostile even to each other. */
export function hostile(a: Group, b: Group): boolean {
  if (a.id === b.id) return false;
  return a.owner !== b.owner || a.owner === 'neutral';
}

export function sameRef(a: Ref, b: Ref): boolean {
  if (a.kind !== b.kind) return false;
  switch (a.kind) {
    case 'minion':
    case 'group':
    case 'structure':
      return a.id === (b as typeof a).id;
    case 'square':
      return samePos(a.pos, (b as typeof a).pos);
    case 'globe':
      return true;
  }
}

export function spellsOn(s: GameState, ref: Ref): ActiveSpell[] {
  return s.spells.filter((sp) => sameRef(sp.host, ref));
}

export function minionPos(s: GameState, m: Minion): Pos | null {
  return s.groups[m.groupId]?.pos ?? null;
}

export function isConcealed(s: GameState, m: Minion): boolean {
  const p = minionPos(s, m);
  return p !== null && s.terrain[key(p)] === 'forest';
}
```

- [ ] **Step 4: Write `src/spellstore.ts`**

```ts
import { sameRef } from './query';
import type { ActiveSpell, GameState, Ref } from './types';

export function addSpellRecord(s: GameState, rec: Omit<ActiveSpell, 'id'>): ActiveSpell {
  const sp: ActiveSpell = { id: s.nextId++, ...rec };
  s.spells.push(sp);
  return sp;
}

export function removeSpellRecord(s: GameState, id: number): ActiveSpell | undefined {
  const i = s.spells.findIndex((sp) => sp.id === id);
  if (i < 0) return undefined;
  return s.spells.splice(i, 1)[0];
}

/** Silently drops every spell on a host (host died or left play). */
export function removeSpellsOn(s: GameState, ref: Ref): void {
  s.spells = s.spells.filter((sp) => !sameRef(sp.host, ref));
}
```

- [ ] **Step 5: Write `src/units.ts`**

```ts
import type { Engine } from './engine';
import { groupAt } from './query';
import { RULES, recruitBase } from './rules';
import { removeSpellsOn } from './spellstore';
import type { Group, Minion, MinionSpec, PlayerId, Pos, Side, SummonDef } from './types';

export function recruitSpec(cls: 'swordsman' | 'archer'): MinionSpec {
  return { kind: 'recruit', cls, name: cls, base: recruitBase(cls) };
}

export function createGroup(
  e: Engine, owner: PlayerId, pos: Pos, kind: 'recruit' | 'monster', control: 'player' | 'computer', botId: string | null = null,
): Group {
  const s = e.state;
  const g: Group = { id: s.nextId++, kind, owner, minionIds: [], pos: { ...pos }, control, botId, moveOrder: null };
  s.groups[g.id] = g;
  s.groupSeq[owner].push(g.id);
  return g;
}

export function spawnMinion(e: Engine, groupId: number, spec: MinionSpec): Minion {
  const s = e.state;
  const g = s.groups[groupId];
  const m: Minion = {
    id: s.nextId++, kind: spec.kind, cls: spec.cls, name: spec.name, owner: g.owner, groupId,
    hp: spec.base.hp, maxHp: spec.base.hp, base: { ...spec.base, walks: [...spec.base.walks] },
    status: 'alive', expQualified: false, hasExp: false,
    combat: { armor: 0, handLeft: 0, missileLeft: 0, misses: 0, victim: null },
  };
  s.minions[m.id] = m;
  g.minionIds.push(m.id);
  return m;
}

/** New recruit joins the friendly player-controlled recruit group in the square if it has room, else starts a group. */
export function addRecruit(e: Engine, owner: Side, pos: Pos, cls: 'swordsman' | 'archer'): Minion {
  const existing = groupAt(e.state, pos);
  const usable =
    existing && existing.owner === owner && existing.kind === 'recruit' &&
    existing.control === 'player' && existing.minionIds.length < RULES.maxGroup;
  const g = usable ? existing : createGroup(e, owner, pos, 'recruit', 'player');
  return spawnMinion(e, g.id, recruitSpec(cls));
}

/** Deletes a group record and its group spells. Does not touch its minions. */
export function removeGroup(e: Engine, groupId: number): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g) return;
  delete s.groups[groupId];
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  removeSpellsOn(s, { kind: 'group', id: groupId });
}

export function summonGroup(e: Engine, def: SummonDef): Group {
  const kind = def.minions.every((m) => m.kind === 'recruit') ? 'recruit' : 'monster';
  const g = createGroup(e, def.owner, def.pos, kind, def.control ?? 'computer', def.botId ?? null);
  for (const spec of def.minions) spawnMinion(e, g.id, spec);
  return g;
}
```

- [ ] **Step 6: Write `src/stats.ts`**

```ts
import { makeQuery } from './ctx';
import type { Engine } from './engine';
import { spellsOn, structureAt } from './query';
import { RULES } from './rules';
import type { Ref, Walk } from './types';

export interface StatDelta {
  hand?: number;
  missile?: number;
  armor?: number;
  level?: number;
  handAttacks?: number;
  missileAttacks?: number;
  walks?: Walk[];
  noDamage?: boolean;
}

export interface Stats {
  hand: number;
  missile: number;
  armor: number;
  level: number;
  handAttacks: number;
  missileAttacks: number;
  walks: Walk[];
  noDamage: boolean;
}

/** Base stats plus the `stats` contribution of every active spell that reaches this minion. Never stored. */
export function computeStats(e: Engine, minionId: number): Stats {
  const s = e.state;
  const m = s.minions[minionId];
  if (!m) throw new Error(`no minion ${minionId}`);
  const b = m.base;
  const out: Stats = {
    hand: b.hand, missile: b.missile, armor: b.armor, level: b.level,
    handAttacks: b.handAttacks, missileAttacks: b.missileAttacks, walks: [...b.walks], noDamage: false,
  };
  const g = s.groups[m.groupId];
  const refs: Ref[] = [{ kind: 'minion', id: m.id }, { kind: 'group', id: m.groupId }];
  if (g?.pos) {
    refs.push({ kind: 'square', pos: g.pos });
    const st = structureAt(s, g.pos);
    if (st) refs.push({ kind: 'structure', id: st.id });
  }
  refs.push({ kind: 'globe' });
  const q = makeQuery(e, m.owner);
  for (const ref of refs) {
    for (const sp of spellsOn(s, ref)) {
      const d = e.cards[sp.cardId]?.stats?.(q, minionId, sp);
      if (!d) continue;
      out.hand += d.hand ?? 0;
      out.missile += d.missile ?? 0;
      out.armor += d.armor ?? 0;
      out.level += d.level ?? 0;
      out.handAttacks += d.handAttacks ?? 0;
      out.missileAttacks += d.missileAttacks ?? 0;
      if (d.walks) out.walks.push(...d.walks);
      if (d.noDamage) out.noDamage = true;
    }
  }
  out.level = Math.max(0, Math.min(RULES.maxLevel, out.level));
  out.hand = Math.max(0, out.hand);
  out.missile = Math.max(0, out.missile);
  out.armor = Math.max(0, out.armor);
  out.handAttacks = Math.max(0, out.handAttacks);
  out.missileAttacks = Math.max(0, out.missileAttacks);
  return out;
}
```

- [ ] **Step 7: Write `src/ctx.ts`** (query surface and non-damage actions; Task 6 adds `damage/heal/kill`, Task 7 adds `dispel/summon/setTerrain/draw`)

```ts
import { key } from './board';
import type { Engine } from './engine';
import type { GameEvent } from './events';
import { groupAt, hostile, minionsOf, structureAt } from './query';
import { nextRandom } from './rng';
import { computeStats, type Stats } from './stats';
import type { ActiveSpell, GameState, Group, Minion, PlayerId, Pos, Ref, Structure, TerrainId } from './types';

/** Read-only view handed to canCast / persistent / stats callbacks. */
export interface QueryContext {
  readonly caster: PlayerId;
  readonly state: Readonly<GameState>;
  minion(id: number): Minion | undefined;
  group(id: number): Group | undefined;
  structure(id: number): Structure | undefined;
  groupAt(pos: Pos): Group | undefined;
  structureAt(pos: Pos): Structure | undefined;
  terrainAt(pos: Pos): TerrainId | undefined;
  minionsOf(groupId: number): Minion[];
  stats(minionId: number): Stats;
  hostile(a: Group, b: Group): boolean;
}

/** Handed to onCast and event handlers. Scripts change the game only through these methods. */
export interface EventContext extends QueryContext {
  readonly spell: ActiveSpell;
  readonly host: Ref;
  readonly event: GameEvent | undefined;
  random(): number;
  /** Marks the current event cancelled (`event.data.cancel = true`). */
  cancel(): void;
  token(name: string): number;
  setToken(name: string, value: number): void;
}

export function makeQuery(e: Engine, caster: PlayerId): QueryContext {
  const s = e.state;
  return {
    caster,
    state: s,
    minion: (id) => s.minions[id],
    group: (id) => s.groups[id],
    structure: (id) => s.structures[id],
    groupAt: (pos) => groupAt(s, pos),
    structureAt: (pos) => structureAt(s, pos),
    terrainAt: (pos) => s.terrain[key(pos)],
    minionsOf: (id) => minionsOf(s, id),
    stats: (id) => computeStats(e, id),
    hostile,
  };
}

export function makeCtx(e: Engine, spell: ActiveSpell, event?: GameEvent): EventContext {
  return {
    ...makeQuery(e, spell.owner),
    spell,
    host: spell.host,
    event,
    random: () => nextRandom(e.state),
    cancel: () => {
      if (event) event.data.cancel = true;
    },
    token: (name) => spell.tokens[name] ?? 0,
    setToken: (name, value) => {
      spell.tokens[name] = value;
    },
  };
}
```

- [ ] **Step 8: Write `src/events.ts`**

```ts
import { makeCtx } from './ctx';
import type { Engine } from './engine';
import { sequence, spellsOn, structureAt } from './query';
import type { ActiveSpell, GameState, Pos, Ref } from './types';

export type EventType =
  // untargeted (all players)
  | 'turn:start' | 'turn:startAfter' | 'movement:before' | 'movement:after' | 'combat:before' | 'turn:afterCombat'
  // group
  | 'group:exit' | 'group:move' | 'group:enter' | 'combat:start' | 'round:start' | 'combat:end' | 'combat:after'
  // minion
  | 'attack:beforeArmor' | 'attack:hit' | 'armor:after'
  | 'minion:dying' | 'minion:killed' | 'minion:dies'
  | 'attacker:hits' | 'attacker:damages' | 'attacker:kills';

export interface GameEvent {
  type: EventType;
  ref?: Ref;
  /** Mutable payload. Handlers may change documented fields (e.g. `damage`) or set `cancel`. */
  data: Record<string, any>;
}

/** Spells that see an event on `ref`, in bubbling order. */
function chain(s: GameState, ref: Ref): ActiveSpell[] {
  const out: ActiveSpell[] = [];
  const add = (r: Ref) => out.push(...spellsOn(s, r));
  let pos: Pos | null = null;
  if (ref.kind === 'minion') {
    const m = s.minions[ref.id];
    if (m) {
      add(ref);
      const g = s.groups[m.groupId];
      if (g) {
        add({ kind: 'group', id: g.id });
        pos = g.pos;
      }
    }
  } else if (ref.kind === 'group') {
    const g = s.groups[ref.id];
    if (g) {
      for (const mid of g.minionIds) add({ kind: 'minion', id: mid });
      add(ref);
      pos = g.pos;
    }
  } else if (ref.kind === 'structure') {
    pos = s.structures[ref.id]?.pos ?? null;
  } else if (ref.kind === 'square') {
    pos = ref.pos;
  }
  if (pos) {
    add({ kind: 'square', pos });
    const st = structureAt(s, pos);
    if (st) add({ kind: 'structure', id: st.id });
  }
  add({ kind: 'globe' });
  return out;
}

export function dispatch(e: Engine, type: EventType, ref?: Ref, data: Record<string, any> = {}): GameEvent {
  const s = e.state;
  const ev: GameEvent = { type, ref, data };
  const spells = ref ? chain(s, ref) : sequence(s).flatMap((p) => s.spells.filter((sp) => sp.owner === p));
  for (const sp of spells) {
    if (!s.spells.some((x) => x.id === sp.id)) continue; // dispelled by an earlier handler
    const fn = e.cards[sp.cardId]?.on?.[type];
    if (fn) fn(makeCtx(e, sp, ev), ev);
  }
  return ev;
}
```

- [ ] **Step 9: Write `src/state.ts`** (a blank game used by `createGame` and tests)

```ts
import { createCells } from './board';
import { emptyPool } from './types';
import type { GameState, HouseId, PlayerState, Side, TerrainId } from './types';

function player(id: Side, house: HouseId): PlayerState {
  return { id, house, mana: emptyPool(), deck: [], hand: [], discard: [], orders: null, confirmed: false };
}

/** Flat plains board, no structures, no units. Red has initiative. */
export function blankState(seed: number, houses: Record<Side, HouseId> = { red: 'war', blue: 'war' }): GameState {
  const cells = createCells();
  const terrain: Record<string, TerrainId> = {};
  for (const k of cells) terrain[k] = 'plains';
  return {
    turn: 1, phase: 'orders', initiative: 'red', winner: null, seed,
    cells, terrain,
    structures: {}, groups: {}, minions: {}, spells: [], graveyard: [],
    groupSeq: { red: [], blue: [], neutral: [] },
    players: { red: player('red', houses.red), blue: player('blue', houses.blue) },
    pendingMana: [], nextId: 1, log: [],
  };
}
```

- [ ] **Step 10: Write the test helpers and tests**

`test/helpers.ts`:
```ts
import { makeEngine, type Engine } from '../src/engine';
import { indexCards, type CardDef } from '../src/cards';
import { blankState } from '../src/state';
import { createGroup, recruitSpec, spawnMinion } from '../src/units';
import type { Group, PlayerId, Pos } from '../src/types';

/** Flat plains board, no structures or units. */
export function blankEngine(defs: CardDef[] = []): Engine {
  return makeEngine(blankState(1), indexCards(defs));
}

export function put(
  e: Engine, owner: PlayerId, pos: Pos, classes: Array<'swordsman' | 'archer'>, control: 'player' | 'computer' = 'player',
): Group {
  const g = createGroup(e, owner, pos, 'recruit', control);
  for (const c of classes) spawnMinion(e, g.id, recruitSpec(c));
  return g;
}
```

`test/events.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { dispatch } from '../src/events';
import { addSpellRecord, removeSpellRecord } from '../src/spellstore';
import type { PlayerId, Ref } from '../src/types';
import { blankEngine, put } from './helpers';

const logger = (id: string, order: string[], event: 'attack:hit' | 'turn:start') =>
  defineCard({
    id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'globe',
    on: { [event]: () => { order.push(id); } },
  });

const host = (e: ReturnType<typeof blankEngine>, cardId: string, owner: PlayerId, h: Ref) =>
  addSpellRecord(e.state, { cardId, owner, host: h, visible: true, turnsLeft: null, tokens: {} });

describe('event bubbling', () => {
  it('goes minion -> group -> square -> structure -> globe', () => {
    const order: string[] = [];
    const e = blankEngine(['m', 'g', 'sq', 'st', 'gl'].map((id) => logger(id, order, 'attack:hit')));
    const grp = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.structures[900] = {
      id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'neutral', manaType: null, novices: 0, turnCount: 2, captured: false,
    };
    host(e, 'gl', 'red', { kind: 'globe' });
    host(e, 'st', 'red', { kind: 'structure', id: 900 });
    host(e, 'sq', 'red', { kind: 'square', pos: { x: 4, y: 4 } });
    host(e, 'g', 'red', { kind: 'group', id: grp.id });
    host(e, 'm', 'red', { kind: 'minion', id: grp.minionIds[0] });
    dispatch(e, 'attack:hit', { kind: 'minion', id: grp.minionIds[0] });
    expect(order).toEqual(['m', 'g', 'sq', 'st', 'gl']);
  });

  it('group events visit each minion, then the group, then the square', () => {
    const order: string[] = [];
    const e = blankEngine(['m1', 'm2', 'g', 'sq'].map((id) => logger(id, order, 'attack:hit')));
    const grp = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    host(e, 'sq', 'red', { kind: 'square', pos: { x: 4, y: 4 } });
    host(e, 'g', 'red', { kind: 'group', id: grp.id });
    host(e, 'm2', 'red', { kind: 'minion', id: grp.minionIds[1] });
    host(e, 'm1', 'red', { kind: 'minion', id: grp.minionIds[0] });
    dispatch(e, 'attack:hit', { kind: 'group', id: grp.id });
    expect(order).toEqual(['m1', 'm2', 'g', 'sq']);
  });

  it('untargeted events follow initiative order', () => {
    const order: string[] = [];
    const e = blankEngine(['n', 'b', 'r'].map((id) => logger(id, order, 'turn:start')));
    host(e, 'n', 'neutral', { kind: 'globe' });
    host(e, 'b', 'blue', { kind: 'globe' });
    host(e, 'r', 'red', { kind: 'globe' });
    e.state.initiative = 'red';
    dispatch(e, 'turn:start');
    expect(order).toEqual(['r', 'b', 'n']);
    order.length = 0;
    e.state.initiative = 'blue';
    dispatch(e, 'turn:start');
    expect(order).toEqual(['b', 'r', 'n']);
  });

  it('lets a handler cancel the event', () => {
    const cancel = defineCard({
      id: 'c', name: 'c', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: { 'attack:hit': (c) => c.cancel() },
    });
    const e = blankEngine([cancel]);
    host(e, 'c', 'red', { kind: 'globe' });
    expect(dispatch(e, 'attack:hit', { kind: 'globe' }).data.cancel).toBe(true);
  });

  it('skips a spell removed by an earlier handler', () => {
    const order: string[] = [];
    let victimId = -1;
    const killer = defineCard({
      id: 'k', name: 'k', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: { 'turn:start': (c) => { order.push('k'); removeSpellRecord(c.state as never, victimId); } },
    });
    const victim = logger('v', order, 'turn:start');
    const e = blankEngine([killer, victim]);
    host(e, 'k', 'red', { kind: 'globe' });
    victimId = host(e, 'v', 'red', { kind: 'globe' }).id;
    dispatch(e, 'turn:start');
    expect(order).toEqual(['k']);
  });
});
```
(`c.state as never` exists only because `ctx.state` is typed `Readonly<GameState>`; keep the cast.)

`test/stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { computeStats, type StatDelta } from '../src/stats';
import { blankEngine, put } from './helpers';

const buff = (id: string, d: StatDelta) =>
  defineCard({ id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'group', stats: () => d });

const onGroup = (e: ReturnType<typeof blankEngine>, cardId: string, groupId: number) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'group', id: groupId }, visible: true, turnsLeft: null, tokens: {} });

describe('computeStats', () => {
  it('returns base stats with no spells', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(computeStats(e, g.minionIds[0])).toMatchObject({ hand: 2, armor: 1, level: 1, handAttacks: 1, missileAttacks: 0 });
    expect(computeStats(e, g.minionIds[1])).toMatchObject({ missile: 2, armor: 0, missileAttacks: 1 });
  });

  it('adds group spell deltas and walks', () => {
    const e = blankEngine([buff('b', { armor: 2, hand: 1, walks: ['water'] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'b', g.id);
    const st = computeStats(e, g.minionIds[0]);
    expect(st.armor).toBe(3);
    expect(st.hand).toBe(3);
    expect(st.walks).toContain('water');
  });

  it('clamps level to 0..5 and numbers to >= 0', () => {
    const e = blankEngine([buff('hi', { level: 10 }), buff('lo', { armor: -9, hand: -9 })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'hi', g.id);
    expect(computeStats(e, g.minionIds[0]).level).toBe(5);
    onGroup(e, 'lo', g.id);
    const st = computeStats(e, g.minionIds[0]);
    expect(st.armor).toBe(0);
    expect(st.hand).toBe(0);
  });

  it('carries the noDamage flag', () => {
    const e = blankEngine([buff('nd', { noDamage: true })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    onGroup(e, 'nd', g.id);
    expect(computeStats(e, g.minionIds[0]).noDamage).toBe(true);
  });
});
```

`test/units.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { addRecruit, removeGroup } from '../src/units';
import { blankEngine, put } from './helpers';

describe('units', () => {
  it('addRecruit joins a friendly group in the square', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const m = addRecruit(e, 'red', { x: 4, y: 4 }, 'archer');
    expect(m.groupId).toBe(g.id);
    expect(e.state.groups[g.id].minionIds).toHaveLength(2);
  });

  it('addRecruit starts a new group in an empty square and registers it in the group sequence', () => {
    const e = blankEngine();
    const m = addRecruit(e, 'blue', { x: 5, y: 5 }, 'swordsman');
    expect(e.state.groups[m.groupId].owner).toBe('blue');
    expect(e.state.groupSeq.blue).toContain(m.groupId);
  });

  it('addRecruit starts a new group when the existing one is full', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, Array(8).fill('swordsman'));
    const m = addRecruit(e, 'red', { x: 4, y: 4 }, 'archer');
    expect(m.groupId).not.toBe(g.id);
  });

  it('removeGroup clears the sequence entry', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    removeGroup(e, g.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(e.state.groupSeq.red).not.toContain(g.id);
  });
});
```

- [ ] **Step 11: Run tests and typecheck**

Run: `cd packages/engine && npx vitest run test/events.test.ts test/stats.test.ts test/units.test.ts && npx tsc -p . --noEmit`
Expected: all pass; typecheck exits 0.

- [ ] **Step 12: Commit**

```bash
git add packages/engine
git commit -m "feat(engine): engine draft, card API types, queries, stats, bubbling event dispatch"
```

---

### Task 5: Game creation

**Goal:** `createGame(config, cards)` builds a full starting state (map, structures, starting units, shuffled decks) and `validateDeck` enforces the deck rules.

**Files:**
- Create: `src/api.ts` (createGame + validateDeck for now; later tasks add the rest of the public API)
- Modify: `test/helpers.ts` (add `gameEngine`)
- Test: `test/create.test.ts`

**Acceptance Criteria:**
- [ ] Each Sanctum structure exists at its centre with 3 novices and rate 4; 5 neutral towns by default
- [ ] Each side starts with one group of 2 swordsmen + 2 archers on its Sanctum
- [ ] Decks are shuffled deterministically per seed
- [ ] `validateDeck` rejects < 30 cards, > 4 copies, unknown ids

**Verify:** `npx vitest run test/create.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/create.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard, indexCards } from '../src/cards';
import { createGame, validateDeck } from '../src/api';
import { SANCTUM_POS } from '../src/board';

const dummy = defineCard({ id: 'dummy', name: 'Dummy', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const other = defineCard({ id: 'other', name: 'Other', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const cards = indexCards([dummy, other]);
const deck = (n: number) => ({ house: 'war' as const, cards: Array.from({ length: n }, (_, i) => (i % 2 ? 'dummy' : 'other')) });

describe('validateDeck', () => {
  it('rejects short decks', () => {
    expect(validateDeck(deck(10), cards)).toMatch(/30/);
  });
  it('rejects more than 4 copies', () => {
    expect(validateDeck({ house: 'war', cards: Array(30).fill('dummy') }, cards)).toMatch(/4/);
  });
  it('rejects unknown cards', () => {
    expect(validateDeck({ house: 'war', cards: ['nope'] }, cards, { minDeck: 1 })).toMatch(/nope/);
  });
  it('accepts a legal deck', () => {
    const legal = { house: 'war' as const, cards: [...Array(4).fill('dummy'), ...Array(4).fill('other')] };
    expect(validateDeck(legal, cards, { minDeck: 8 })).toBeNull();
  });
});

describe('createGame', () => {
  const config = { seed: 5, decks: { red: deck(12), blue: deck(12) }, options: { skipDeckRules: true } };

  it('builds sanctums, towns and starting groups', () => {
    const s = createGame(config, cards);
    const structs = Object.values(s.structures);
    expect(structs.filter((x) => x.kind === 'sanctum')).toHaveLength(2);
    expect(structs.filter((x) => x.kind === 'town')).toHaveLength(5);
    const red = structs.find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    expect(red.pos).toEqual(SANCTUM_POS.red);
    expect(red.novices).toBe(3);
    const g = Object.values(s.groups).filter((x) => x.owner === 'red');
    expect(g).toHaveLength(1);
    expect(g[0].minionIds.map((id) => s.minions[id].cls)).toEqual(['swordsman', 'swordsman', 'archer', 'archer']);
    expect(g[0].pos).toEqual(SANCTUM_POS.red);
  });

  it('is deterministic per seed and differs across seeds', () => {
    const a = createGame(config, cards);
    const b = createGame(config, cards);
    const c = createGame({ ...config, seed: 6 }, cards);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.players.red.deck).not.toEqual(c.players.red.deck);
  });

  it('supports flat terrain and zero towns for tests', () => {
    const s = createGame({ ...config, options: { skipDeckRules: true, towns: 0, flatTerrain: true } }, cards);
    expect(Object.values(s.structures).filter((x) => x.kind === 'town')).toHaveLength(0);
    expect(new Set(Object.values(s.terrain))).toEqual(new Set(['plains']));
  });

  it('throws for an illegal deck unless rules are skipped', () => {
    expect(() => createGame({ seed: 1, decks: { red: deck(5), blue: deck(5) } }, cards)).toThrow(/deck/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/api.ts`**

```ts
import { SANCTUM_POS } from './board';
import type { CardIndex } from './cards';
import { makeEngine } from './engine';
import { placeTowns, rollTerrain } from './mapgen';
import { shuffle } from './rng';
import { RULES } from './rules';
import { blankState } from './state';
import { addRecruit } from './units';
import { SIDES } from './types';
import type { GameState, HouseId, Side, TerrainId } from './types';

export interface DeckConfig {
  house: HouseId;
  cards: string[];
}

export interface GameConfig {
  seed: number;
  decks: Record<Side, DeckConfig>;
  options?: { towns?: number; flatTerrain?: boolean; skipDeckRules?: boolean };
}

/** Returns an error message, or null if the deck is legal. */
export function validateDeck(deck: DeckConfig, cards: CardIndex, limits: { minDeck?: number } = {}): string | null {
  const min = limits.minDeck ?? RULES.minDeck;
  if (deck.cards.length < min) return `needs at least ${min} cards`;
  const counts: Record<string, number> = {};
  for (const id of deck.cards) {
    if (!cards[id]) return `unknown card "${id}"`;
    counts[id] = (counts[id] ?? 0) + 1;
    if (counts[id] > RULES.maxCopies) return `more than ${RULES.maxCopies} copies of "${id}"`;
  }
  return null;
}

export function createGame(config: GameConfig, cards: CardIndex): GameState {
  const opts = config.options ?? {};
  for (const side of SIDES) {
    const deck = config.decks[side];
    if (opts.skipDeckRules) {
      for (const id of deck.cards) if (!cards[id]) throw new Error(`${side} deck: unknown card "${id}"`);
    } else {
      const err = validateDeck(deck, cards);
      if (err) throw new Error(`${side} deck: ${err}`);
    }
  }
  const e = makeEngine(blankState(config.seed, { red: config.decks.red.house, blue: config.decks.blue.house }), cards);
  const s = e.state;
  const towns = placeTowns(s, opts.towns ?? RULES.towns);
  if (opts.flatTerrain) {
    const flat: Record<string, TerrainId> = {};
    for (const k of s.cells) flat[k] = 'plains';
    s.terrain = flat;
  } else {
    s.terrain = rollTerrain(s, s.cells, towns);
  }
  for (const side of SIDES) {
    s.structures[s.nextId] = {
      id: s.nextId++, kind: 'sanctum', pos: { ...SANCTUM_POS[side] }, owner: side, manaType: null,
      novices: RULES.startNovices, turnCount: RULES.sanctumNoviceRate, captured: false,
    };
    s.players[side].deck = shuffle(s, config.decks[side].cards);
  }
  for (const pos of towns) {
    s.structures[s.nextId] = {
      id: s.nextId++, kind: 'town', pos: { ...pos }, owner: 'neutral', manaType: null,
      novices: 0, turnCount: RULES.townNoviceRate, captured: false,
    };
  }
  for (const side of SIDES) {
    for (const cls of RULES.startGroup) addRecruit(e, side, SANCTUM_POS[side], cls);
  }
  return e.state;
}
```

- [ ] **Step 4: Add `gameEngine` to `test/helpers.ts`**

Add to the imports: `import { createGame, type GameConfig } from '../src/api';` and append:
```ts
/** A real created game (flat terrain, no towns unless overridden), wrapped in an Engine. */
export function gameEngine(defs: CardDef[] = [], deckCards: string[] = [], options: GameConfig['options'] = {}): Engine {
  const cards = indexCards(defs);
  const deck = { house: 'war' as const, cards: deckCards };
  const state = createGame(
    { seed: 1, decks: { red: deck, blue: deck }, options: { towns: 0, flatTerrain: true, skipDeckRules: true, ...options } },
    cards,
  );
  return makeEngine(state, cards);
}
```

- [ ] **Step 5: Run to verify pass, commit**

Run: `cd packages/engine && npx vitest run test/create.test.ts && npx tsc -p . --noEmit`

```bash
git add packages/engine
git commit -m "feat(engine): createGame with map, structures, starting units and deck validation"
```

---

### Task 6: Damage and death pipelines

**Goal:** The Takes-Damage pipeline (D1-D4), Apply-Damage (spell damage) and the Minion Death pipeline (E1-E3), plus `damage/heal/kill` on `EventContext`.

**Files:**
- Create: `src/damage.ts`, `src/death.ts`
- Modify: `src/ctx.ts` (add `damage`, `heal`, `kill`)
- Test: `test/damage.test.ts`

**Acceptance Criteria:**
- [ ] Non-magical damage soaks into current armor first; fully soaked returns `bounced`; excess reduces hit points (`damaged`) or kills
- [ ] Magical damage skips armor; a 0-damage magical hit returns `damaged`
- [ ] `attack:beforeArmor` handlers can raise `data.damage`; `armor:after` handlers can cancel (bounced)
- [ ] Death pipeline: `minion:dying` can cancel (alive if hp > 0); `kills` fires `minion:killed` then `minion:dies`, `dies` fires only `minion:dies`; burial removes the minion and its spells, deletes an emptied group, and appends to the graveyard

**Verify:** `npx vitest run test/damage.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/damage.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard, type CardDef } from '../src/cards';
import { applyDamage, takeDamage } from '../src/damage';
import { killMinion } from '../src/death';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

function fresh(defs: CardDef[] = []) {
  const e = blankEngine(defs);
  const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
  const m = e.state.minions[g.minionIds[0]];
  m.combat.armor = 1;
  return { e, g, m };
}

const onMinion = (e: ReturnType<typeof blankEngine>, cardId: string, id: number) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'minion', id }, visible: true, turnsLeft: null, tokens: {} });

describe('takeDamage', () => {
  it('fully soaked damage bounces', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 1, hand, null)).toBe('bounced');
    expect(m.combat.armor).toBe(0);
    expect(m.hp).toBe(7);
  });

  it('excess damage reduces hit points', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 3, hand, null)).toBe('damaged');
    expect(m.hp).toBe(5);
  });

  it('lethal damage returns killed with hp 0', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 20, hand, null)).toBe('killed');
    expect(m.hp).toBe(0);
  });

  it('magical damage ignores armor, and a 0-point magical hit is "damaged"', () => {
    const { e, m } = fresh();
    expect(takeDamage(e, m.id, 2, { kind: 'spell', ignoresArmor: true, magical: true }, null)).toBe('damaged');
    expect(m.hp).toBe(5);
    expect(takeDamage(e, m.id, 0, { kind: 'spell', ignoresArmor: true, magical: true }, null)).toBe('damaged');
    expect(m.hp).toBe(5);
  });

  it('a beforeArmor handler can raise damage even from a 0-damage hit', () => {
    const despond = defineCard({
      id: 'despond', name: 'Despond', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attack:beforeArmor': (_c, ev) => { ev.data.damage += 3; } },
    });
    const { e, m } = fresh([despond]);
    onMinion(e, 'despond', m.id);
    expect(takeDamage(e, m.id, 0, hand, 99)).toBe('damaged'); // 3 - 1 armor = 2
    expect(m.hp).toBe(5);
  });

  it('an armor:after handler can cancel the damage', () => {
    const ward = defineCard({
      id: 'ward', name: 'Ward', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'armor:after': (c) => c.cancel() },
    });
    const { e, m } = fresh([ward]);
    onMinion(e, 'ward', m.id);
    expect(takeDamage(e, m.id, 5, hand, null)).toBe('bounced');
    expect(m.hp).toBe(7);
  });
});

describe('applyDamage and death', () => {
  it('spell damage kills, buries and empties the group', () => {
    const { e, g, m } = fresh();
    applyDamage(e, m.id, 20);
    expect(m.status).toBe('dead');
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(e.state.graveyard).toContain(m.id);
  });

  it('a dying handler can cancel death while hp is positive', () => {
    const phoenix = defineCard({
      id: 'phoenix', name: 'Phoenix', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'minion:dying': (c) => c.cancel() },
    });
    const { e, m } = fresh([phoenix]);
    onMinion(e, 'phoenix', m.id);
    m.hp = 3;
    expect(killMinion(e, m.id, null, 'dies')).toBe('cancelled');
    expect(m.status).toBe('alive');
  });

  it('kills fires killed then dies; dies fires only dies; burial removes minion spells', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: {
        'minion:killed': () => { seen.push('killed'); },
        'minion:dies': () => { seen.push('dies'); },
      },
    });
    const a = fresh([watcher]);
    onMinion(a.e, 'watch', a.m.id);
    killMinion(a.e, a.m.id, 77, 'kills');
    expect(seen).toEqual(['killed', 'dies']);
    expect(a.e.state.spells).toHaveLength(0);

    seen.length = 0;
    const b = fresh([watcher]);
    onMinion(b.e, 'watch', b.m.id);
    killMinion(b.e, b.m.id, null, 'dies');
    expect(seen).toEqual(['dies']);
  });

  it('removed-from-game skips events', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'minion:dies': () => { seen.push('dies'); } },
    });
    const { e, m } = fresh([watcher]);
    onMinion(e, 'watch', m.id);
    killMinion(e, m.id, null, 'removed');
    expect(seen).toEqual([]);
    expect(m.status).toBe('dead');
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/damage.ts`**

```ts
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import type { Ref } from './types';

export interface DamageSpec {
  kind: 'hand' | 'missile' | 'spell';
  ignoresArmor: boolean;
  magical: boolean;
}

/**
 * The Takes-Damage pipeline (rules: Pipelines/damage). Does not run the death pipeline;
 * callers do that when the result is 'killed'.
 * D1 before armor + is-hit-by, D2 armor soak, D3 cap + after armor, D4 apply.
 */
export function takeDamage(
  e: Engine, victimId: number, qty: number, dmg: DamageSpec, attackerId: number | null,
): 'bounced' | 'damaged' | 'killed' {
  const v = e.state.minions[victimId];
  const ref: Ref = { kind: 'minion', id: victimId };
  const data: Record<string, any> = {
    damage: qty, kind: dmg.kind, magical: dmg.magical, ignoresArmor: dmg.ignoresArmor, attackerId, victimId,
  };
  if (!dmg.magical) dispatch(e, 'attack:beforeArmor', ref, data);
  if (attackerId !== null) dispatch(e, 'attack:hit', ref, data);
  let q = Math.max(0, data.damage);
  if (!dmg.ignoresArmor && !dmg.magical) {
    const soak = Math.min(q, v.combat.armor);
    q -= soak;
    v.combat.armor -= soak;
    if (q === 0) return 'bounced';
  }
  data.damage = Math.min(q, v.hp);
  dispatch(e, 'armor:after', ref, data);
  if (data.cancel) return 'bounced';
  if (v.status === 'dead') return 'killed';
  v.hp -= Math.max(0, Math.min(data.damage, v.hp));
  return v.hp > 0 ? 'damaged' : 'killed';
}

/** Spell/terrain damage: magical by default, nobody to blame, death is a "dies" death. */
export function applyDamage(e: Engine, victimId: number, qty: number, opts: { ignoresArmor?: boolean } = {}): void {
  const s = e.state;
  const v = s.minions[victimId];
  if (!v || v.status === 'dead') return;
  if (s.groups[v.groupId]?.pos == null) return;
  const res = takeDamage(e, victimId, qty, { kind: 'spell', ignoresArmor: opts.ignoresArmor ?? true, magical: true }, null);
  if (res === 'killed') killMinion(e, victimId, null, 'dies');
}
```

- [ ] **Step 4: Write `src/death.ts`**

```ts
import type { Engine } from './engine';
import { dispatch } from './events';
import { removeSpellsOn } from './spellstore';
import type { Ref } from './types';
import { removeGroup } from './units';

export type DeathCategory = 'kills' | 'dies' | 'removed';

/**
 * The Minion Death pipeline (rules: Pipelines/death).
 * E1 is-dying (cancellable), E2 death events, E3 burial. 'removed' skips E1 and E2.
 */
export function killMinion(e: Engine, id: number, blame: number | null, category: DeathCategory): 'dead' | 'cancelled' {
  const s = e.state;
  const m = s.minions[id];
  if (!m || m.status === 'dead') return 'dead';
  const ref: Ref = { kind: 'minion', id };
  if (category !== 'removed') {
    m.status = 'dying';
    const ev = dispatch(e, 'minion:dying', ref, { blame, category });
    if (ev.data.cancel) {
      m.status = 'alive';
      if (m.hp > 0) return 'cancelled';
    }
    m.status = 'dead';
    if (category === 'kills') dispatch(e, 'minion:killed', ref, { blame });
    dispatch(e, 'minion:dies', ref, { blame, category });
  } else {
    m.status = 'dead';
  }
  removeSpellsOn(s, ref);
  const g = s.groups[m.groupId];
  if (g) {
    g.minionIds = g.minionIds.filter((x) => x !== id);
    if (g.minionIds.length === 0) removeGroup(e, g.id);
  }
  s.graveyard.push(id);
  s.log.push({ type: 'death', minion: id, category, blame });
  return 'dead';
}
```

- [ ] **Step 5: Extend `src/ctx.ts`**

Add these imports at the top:
```ts
import { applyDamage } from './damage';
import { killMinion } from './death';
```
Add to the `EventContext` interface, after `setToken(...)`:
```ts
  /** Magical spell damage (ignores armor by default). Nobody is blamed, so a death is a "dies" death. */
  damage(minionId: number, amount: number, opts?: { ignoresArmor?: boolean }): void;
  heal(minionId: number, amount: number): void;
  /** Instant death ("dies" category). */
  kill(minionId: number): void;
```
Add to the object returned by `makeCtx`, after `setToken`:
```ts
    damage: (id, amount, opts) => applyDamage(e, id, amount, opts),
    heal: (id, amount) => {
      const m = e.state.minions[id];
      if (m && m.status !== 'dead') m.hp = Math.min(m.maxHp, m.hp + Math.max(0, amount));
    },
    kill: (id) => {
      killMinion(e, id, null, 'dies');
    },
```

- [ ] **Step 6: Run tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
Expected: all tests so far pass.

```bash
git add packages/engine
git commit -m "feat(engine): damage and death pipelines with ctx damage/heal/kill"
```

---

### Task 7: Spell lifecycle

**Goal:** Targeting rules, casting and execution (including squandering), exclusivity, persistent-requirement rechecks, duration expiry, and the `dispel/summon/draw` actions on `EventContext`.

**Files:**
- Create: `src/spells.ts`, `src/deck.ts`
- Modify: `src/ctx.ts` (add `dispel`, `summon`, `draw`)
- Test: `test/spells.test.ts`

**Acceptance Criteria:**
- [ ] `targetLegal` enforces target types, enemy-forest concealment (unless `ignoresConcealment`), and empty/non-sanctum squares for square spells
- [ ] `executeCast` returns `'cast'` or `'squandered'` (dead target, failed `canCast`, exclusive duplicate) and logs it
- [ ] Alterations/conjurations become active spells; manifestations never do
- [ ] `recheck` dispels a spell whose `persistent` fails; dispelling one spell makes its host recheck the others (spell flux)
- [ ] `expireSpells` counts the casting turn: `duration: { turns: 2 }` survives one call and is removed by the second
- [ ] `ctx.summon` creates a computer-controlled monster group; `ctx.draw` draws for a side

**Verify:** `npx vitest run test/spells.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/spells.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { killMinion } from '../src/death';
import { dispel, executeCast, expireSpells, recheck, targetLegal } from '../src/spells';
import { spellsOn } from '../src/query';
import { gameEngine, blankEngine, put } from './helpers';
import type { BaseStats } from '../src/types';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.damage(t.id, 3); },
});
const ward = defineCard({
  id: 'ward', name: 'Ward', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup',
  persistent: (q, host) => host.kind === 'group' && q.terrainAt(q.group(host.id)!.pos!) !== 'water',
});
const shield = defineCard({
  id: 'shield', name: 'Shield', house: 'war', cost: {}, type: 'conjuration', target: 'recruitGroup', duration: { turns: 2 },
});
const picky = defineCard({
  id: 'picky', name: 'Picky', house: 'war', cost: {}, type: 'manifestation', target: 'recruit', canCast: () => false,
});
const wolfBase: BaseStats = { hp: 5, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] };
const wolves = defineCard({
  id: 'wolves', name: 'Wolves', house: 'war', cost: {}, type: 'summoning', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.summon({ pos: t.pos, minions: [{ kind: 'monster', cls: 'monster', name: 'wolf', base: wolfBase }] });
  },
});
const draw2 = defineCard({
  id: 'draw2', name: 'Draw Two', house: 'war', cost: {}, type: 'manifestation', target: 'globe',
  onCast: (c) => { c.draw('red', 2); },
});
const needsB = defineCard({
  id: 'needsB', name: 'Needs B', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  persistent: (q) => q.state.spells.some((sp) => sp.cardId === 'b'),
});
const b = defineCard({ id: 'b', name: 'B', house: 'war', cost: {}, type: 'alteration', target: 'globe' });

const all = [bolt, ward, shield, picky, wolves, draw2, needsB, b];

describe('targetLegal', () => {
  it('requires the right target kind and a live minion', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(targetLegal(e, bolt, 'red', { kind: 'minion', id: g.minionIds[0] })).toBe(true);
    expect(targetLegal(e, bolt, 'red', { kind: 'group', id: g.id })).toBe(false);
    expect(targetLegal(e, ward, 'red', { kind: 'group', id: g.id })).toBe(true);
  });

  it('hides enemy minions in forest unless the card ignores concealment', () => {
    const e = blankEngine(all);
    e.state.terrain['4,4'] = 'forest';
    const g = put(e, 'blue', { x: 4, y: 4 }, ['archer']);
    const ref = { kind: 'minion' as const, id: g.minionIds[0] };
    expect(targetLegal(e, bolt, 'red', ref)).toBe(false);
    expect(targetLegal(e, bolt, 'blue', ref)).toBe(true);
    expect(targetLegal(e, { ...bolt, ignoresConcealment: true }, 'red', ref)).toBe(true);
  });

  it('square spells need an empty square that is not part of a Sanctum', () => {
    const e = blankEngine(all);
    put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 4, y: 4 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 5, y: 5 } })).toBe(true);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 2, y: 2 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 3, y: 2 } })).toBe(false);
    expect(targetLegal(e, wolves, 'red', { kind: 'square', pos: { x: 40, y: 2 } })).toBe(false);
  });
});

describe('executeCast', () => {
  it('runs a manifestation and leaves nothing active', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id: g.minionIds[0] })).toBe('cast');
    expect(e.state.minions[g.minionIds[0]].hp).toBe(4);
    expect(e.state.spells).toHaveLength(0);
  });

  it('squanders when the target is already dead', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const id = g.minionIds[0];
    killMinion(e, id, null, 'dies');
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('squandered');
    expect(e.state.log.some((l) => l.type === 'squander')).toBe(true);
  });

  it('squanders when canCast fails', () => {
    const e = blankEngine(all);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    expect(executeCast(e, 'red', 'picky', { kind: 'minion', id: g.minionIds[0] })).toBe('squandered');
  });

  it('makes alterations active and rejects an exclusive duplicate on the same host', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    expect(executeCast(e, 'red', 'ward', ref)).toBe('cast');
    expect(spellsOn(e.state, ref)).toHaveLength(1);
    expect(executeCast(e, 'red', 'ward', ref)).toBe('squandered');
    expect(spellsOn(e.state, ref)).toHaveLength(1);
  });

  it('summoning creates a computer-controlled monster group owned by the caster', () => {
    const e = blankEngine(all);
    expect(executeCast(e, 'red', 'wolves', { kind: 'square', pos: { x: 5, y: 5 } })).toBe('cast');
    const g = Object.values(e.state.groups)[0];
    expect(g.kind).toBe('monster');
    expect(g.control).toBe('computer');
    expect(g.owner).toBe('red');
    expect(g.botId).toBe('wolves');
  });

  it('ctx.draw draws for a side', () => {
    const e = gameEngine(all, ['bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt', 'bolt']);
    const before = e.state.players.red.hand.length;
    executeCast(e, 'red', 'draw2', { kind: 'globe' });
    expect(e.state.players.red.hand.length).toBe(before + 2);
  });
});

describe('persistence, dispel and expiry', () => {
  it('recheck dispels a spell whose persistent requirement fails', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    executeCast(e, 'red', 'ward', ref);
    e.state.terrain['4,4'] = 'water';
    recheck(e, ref);
    expect(spellsOn(e.state, ref)).toHaveLength(0);
  });

  it('dispelling one spell makes the host recheck the others', () => {
    const e = blankEngine(all);
    const globe = { kind: 'globe' as const };
    executeCast(e, 'red', 'b', globe);
    executeCast(e, 'red', 'needsB', globe);
    expect(e.state.spells).toHaveLength(2);
    dispel(e, e.state.spells.find((s) => s.cardId === 'b')!.id);
    expect(e.state.spells).toHaveLength(0);
  });

  it('conjuration duration counts the casting turn', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const ref = { kind: 'group' as const, id: g.id };
    executeCast(e, 'red', 'shield', ref);
    expireSpells(e);
    expect(spellsOn(e.state, ref)).toHaveLength(1);
    expect(spellsOn(e.state, ref)[0].turnsLeft).toBe(1);
    expireSpells(e);
    expect(spellsOn(e.state, ref)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/deck.ts`**

```ts
import type { Engine } from './engine';
import type { Side } from './types';

/** Draw up to `n` cards. Running out of cards has no penalty. */
export function drawCards(e: Engine, side: Side, n: number): void {
  const p = e.state.players[side];
  for (let i = 0; i < n && p.deck.length > 0; i++) p.hand.push(p.deck.shift()!);
}
```

- [ ] **Step 4: Write `src/spells.ts`**

```ts
import { isSanctumArea, key } from './board';
import type { CardDef } from './cards';
import { makeCtx, makeQuery } from './ctx';
import type { Engine } from './engine';
import { groupAt, isConcealed, spellsOn, structureAt } from './query';
import { addSpellRecord, removeSpellRecord } from './spellstore';
import type { ActiveSpell, PlayerId, Pos, Ref } from './types';

/** Is `ref` a legal target for `card` cast by `caster` right now? Checks type, concealment and occupancy only. */
export function targetLegal(e: Engine, card: CardDef, caster: PlayerId, ref: Ref): boolean {
  const s = e.state;
  switch (card.target) {
    case 'recruit':
    case 'monster':
    case 'minion': {
      if (ref.kind !== 'minion') return false;
      const m = s.minions[ref.id];
      if (!m || m.status !== 'alive') return false;
      const g = s.groups[m.groupId];
      if (!g || !g.pos) return false;
      if (card.target === 'recruit' && m.kind !== 'recruit') return false;
      if (card.target === 'monster' && m.kind !== 'monster') return false;
      if (!card.ignoresConcealment && m.owner !== caster && isConcealed(s, m)) return false;
      return true;
    }
    case 'recruitGroup':
    case 'monsterGroup':
    case 'group': {
      if (ref.kind !== 'group') return false;
      const g = s.groups[ref.id];
      if (!g || !g.pos || g.minionIds.length === 0) return false;
      if (card.target === 'recruitGroup' && g.kind !== 'recruit') return false;
      if (card.target === 'monsterGroup' && g.kind !== 'monster') return false;
      return true;
    }
    case 'square': {
      if (ref.kind !== 'square') return false;
      if (!s.cells.includes(key(ref.pos))) return false;
      if (isSanctumArea(ref.pos)) return false;
      return !groupAt(s, ref.pos) && !structureAt(s, ref.pos);
    }
    case 'structure': {
      if (ref.kind !== 'structure') return false;
      const st = s.structures[ref.id];
      return !!st && st.kind !== 'sanctum';
    }
    case 'globe':
      return ref.kind === 'globe';
  }
}

/** Target legality plus the card's own `canCast`. Used while ordering and again at execution. */
export function castCheck(e: Engine, caster: PlayerId, card: CardDef, ref: Ref): boolean {
  if (!targetLegal(e, card, caster, ref)) return false;
  return card.canCast ? card.canCast(makeQuery(e, caster), ref) : true;
}

/** Removes a spell, then lets its host recheck persistent requirements of the spells that remain (spell flux). */
export function dispel(e: Engine, spellId: number): void {
  const sp = removeSpellRecord(e.state, spellId);
  if (!sp) return;
  e.state.log.push({ type: 'dispel', card: sp.cardId });
  recheck(e, sp.host);
}

/** Dispels every spell on `ref` whose card `persistent` check now fails. */
export function recheck(e: Engine, ref: Ref): void {
  const s = e.state;
  for (const sp of spellsOn(s, ref)) {
    const card = e.cards[sp.cardId];
    if (!card?.persistent) continue;
    if (!s.spells.some((x) => x.id === sp.id)) continue;
    if (!card.persistent(makeQuery(e, sp.owner), sp.host)) dispel(e, sp.id);
  }
}

/** Recheck everything hosted on a square: the square, its structure, its group and the group's minions. */
export function recheckSquare(e: Engine, pos: Pos): void {
  const s = e.state;
  recheck(e, { kind: 'square', pos });
  const st = structureAt(s, pos);
  if (st) recheck(e, { kind: 'structure', id: st.id });
  const g = groupAt(s, pos);
  if (g) {
    recheck(e, { kind: 'group', id: g.id });
    for (const mid of g.minionIds) recheck(e, { kind: 'minion', id: mid });
  }
}

export function executeCast(e: Engine, caster: PlayerId, cardId: string, ref: Ref): 'cast' | 'squandered' {
  const s = e.state;
  const card = e.cards[cardId];
  const squander = (why: string): 'squandered' => {
    s.log.push({ type: 'squander', card: cardId, caster, why });
    return 'squandered';
  };
  if (!card) return squander('unknown card');
  if (!castCheck(e, caster, card, ref)) return squander('requirements failed');
  const persists = card.type === 'alteration' || card.type === 'conjuration';
  const visible = persists && card.visible !== false;
  if (persists && (card.exclusive ?? visible) && spellsOn(s, ref).some((sp) => sp.cardId === cardId)) {
    return squander('exclusive');
  }
  s.log.push({ type: 'cast', card: cardId, caster, target: ref });
  if (persists) {
    const sp = addSpellRecord(s, {
      cardId, owner: caster, host: ref, visible, turnsLeft: card.duration?.turns ?? null, tokens: {},
    });
    card.onCast?.(makeCtx(e, sp), ref);
    recheck(e, ref);
  } else {
    const transient: ActiveSpell = { id: -1, cardId, owner: caster, host: ref, visible: false, turnsLeft: null, tokens: {} };
    card.onCast?.(makeCtx(e, transient), ref);
  }
  return 'cast';
}

/** End-of-turn expiry. Spells with a finite duration lose one turn and are dispelled at zero. */
export function expireSpells(e: Engine): void {
  for (const sp of [...e.state.spells]) {
    if (sp.turnsLeft === null) continue;
    sp.turnsLeft -= 1;
    if (sp.turnsLeft <= 0) dispel(e, sp.id);
  }
}
```

- [ ] **Step 5: Extend `src/ctx.ts`**

Add imports:
```ts
import { drawCards } from './deck';
import { dispel } from './spells';
import { summonGroup } from './units';
```
and extend the existing type import to include `Side` and `SummonDef`:
```ts
import type { ActiveSpell, GameState, Group, Minion, PlayerId, Pos, Ref, Side, Structure, SummonDef, TerrainId } from './types';
```
Add to the `EventContext` interface:
```ts
  /** Dispels the given active spell (default: this spell). */
  dispel(spellId?: number): void;
  /** Creates a group at a square; returns its id. Owner defaults to this spell's owner; the group's bot is this card's `bot`. */
  summon(def: Omit<SummonDef, 'owner'> & { owner?: PlayerId }): number;
  draw(side: Side, count: number): void;
```
Add to the object returned by `makeCtx`:
```ts
    dispel: (id) => dispel(e, id ?? spell.id),
    summon: (def) =>
      summonGroup(e, { ...def, owner: def.owner ?? spell.owner, botId: def.botId ?? spell.cardId }).id,
    draw: (side, count) => drawCards(e, side, count),
```

- [ ] **Step 6: Run tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`

```bash
git add packages/engine
git commit -m "feat(engine): spell lifecycle - targeting, cast/squander, persistence recheck, expiry"
```

---

### Task 8: Terrain effects and start-of-turn

**Goal:** Built-in terrain effects (drowning, void, desert/lava/volcano damage, blocking helper) and the start-of-turn phase: experience, events, draw, capture, novice production, initiative, mana choice, mana generation, win check. `createGame` now starts turn 1.

**Files:**
- Create: `src/terrainfx.ts`, `src/turn.ts` (start-of-turn only for now)
- Modify: `src/api.ts` (call `beginTurn`, add `chooseMana` and `Result`), `src/ctx.ts` (add `setTerrain`)
- Test: `test/turnstart.test.ts`

**Acceptance Criteria:**
- [ ] A new game is in phase `orders` on turn 1; each player holds 5 cards (deck permitting)
- [ ] A Sanctum makes a novice every 4th turn after the first; owned towns every 2nd
- [ ] A hostile recruit group in a neutral town captures it at the next start of turn: novices cleared, owner set, mana choice pending (`phase: 'choose-mana'`); `chooseMana` finishes the turn start and the town then produces 1 mana of that type
- [ ] Structure delta moves initiative to the player with the higher delta; ties keep it
- [ ] A hostile recruit group in a Sanctum ends the game (`winner`, phase `over`)
- [ ] Desert deals 1 damage after start of turn (not to desertwalkers/fliers); water drowns non-walkers; void removes them
- [ ] A recruit that killed someone gets +1 level once at the next start of turn

**Verify:** `npx vitest run test/turnstart.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/turnstart.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chooseMana } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { makeCtx } from '../src/ctx';
import { beginTurn } from '../src/turn';
import { removeGroup } from '../src/units';
import type { ActiveSpell } from '../src/types';
import { gameEngine, put } from './helpers';

const dummy = defineCard({ id: 'dummy', name: 'Dummy', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });

function advance(e: ReturnType<typeof gameEngine>) {
  e.state.turn += 1;
  beginTurn(e, false);
}

describe('start of turn', () => {
  it('starts turn 1 in the orders phase with full hands', () => {
    const e = gameEngine([dummy], Array(10).fill('dummy'));
    expect(e.state.phase).toBe('orders');
    expect(e.state.turn).toBe(1);
    expect(e.state.players.red.hand).toHaveLength(5);
    expect(e.state.players.red.deck).toHaveLength(5);
  });

  it('produces a Sanctum novice every fourth turn', () => {
    const e = gameEngine();
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    expect(sanctum.novices).toBe(3);
    advance(e); advance(e); advance(e);
    expect(sanctum.novices).toBe(3);
    advance(e);
    expect(sanctum.novices).toBe(4);
    expect(sanctum.turnCount).toBe(4);
  });

  it('captures a neutral town, flips initiative, and waits for the mana choice', () => {
    const e = gameEngine([], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    put(e, 'red', town.pos, ['swordsman']);
    e.state.initiative = 'blue';
    advance(e);
    expect(town.owner).toBe('red');
    expect(e.state.phase).toBe('choose-mana');
    expect(e.state.pendingMana).toEqual([town.id]);
    expect(e.state.initiative).toBe('red');
    const r = chooseMana(e.state, e.cards, 'red', town.id, 'strife');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.state.phase).toBe('orders');
    expect(r.state.structures[town.id].manaType).toBe('strife');
    expect(r.state.players.red.mana.strife).toBe(1);
  });

  it('rejects a mana choice from the wrong player or at the wrong time', () => {
    const e = gameEngine([], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    expect(chooseMana(e.state, e.cards, 'red', town.id, 'strife').ok).toBe(false);
    put(e, 'red', town.pos, ['swordsman']);
    advance(e);
    expect(chooseMana(e.state, e.cards, 'blue', town.id, 'strife').ok).toBe(false);
  });

  it('keeps initiative on a tie', () => {
    const e = gameEngine();
    e.state.initiative = 'blue';
    advance(e);
    expect(e.state.initiative).toBe('blue');
  });

  it('ends the game when a hostile recruit group stands in a Sanctum', () => {
    const e = gameEngine();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') removeGroup(e, g.id);
    put(e, 'blue', SANCTUM_POS.red, ['swordsman']);
    advance(e);
    expect(e.state.winner).toBe('blue');
    expect(e.state.phase).toBe('over');
  });

  it('desert damages after start of turn unless the group has desertwalk', () => {
    const e = gameEngine();
    e.state.terrain['4,4'] = 'desert';
    e.state.terrain['5,5'] = 'desert';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 5, y: 5 }, ['swordsman']);
    e.state.minions[b.minionIds[0]].base.walks.push('desert');
    advance(e);
    expect(e.state.minions[a.minionIds[0]].hp).toBe(6);
    expect(e.state.minions[b.minionIds[0]].hp).toBe(7);
  });

  it('drowns minions standing in water without waterwalk', () => {
    const e = gameEngine();
    e.state.terrain['4,4'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    advance(e);
    expect(e.state.minions[a.minionIds[0]].status).toBe('dead');
    expect(e.state.groups[a.id]).toBeUndefined();
  });

  it('awards the experience level once', () => {
    const e = gameEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const m = e.state.minions[g.minionIds[0]];
    m.expQualified = true;
    advance(e);
    expect(m.base.level).toBe(2);
    expect(m.hasExp).toBe(true);
    advance(e);
    expect(m.base.level).toBe(2);
  });
});

describe('ctx.setTerrain', () => {
  it('changes terrain, applies fatal terrain immediately, and refuses structures', () => {
    const e = gameEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const spell: ActiveSpell = { id: -1, cardId: 'x', owner: 'red', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} };
    const ctx = makeCtx(e, spell);
    ctx.setTerrain({ x: 5, y: 5 }, 'forest');
    expect(e.state.terrain['5,5']).toBe('forest');
    ctx.setTerrain({ x: 2, y: 2 }, 'water');
    expect(e.state.terrain['2,2']).toBe('plains');
    ctx.setTerrain({ x: 4, y: 4 }, 'water');
    expect(e.state.minions[g.minionIds[0]].status).toBe('dead');
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/terrainfx.ts`**

```ts
import { key } from './board';
import { applyDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import { minionsOf } from './query';
import { computeStats } from './stats';
import { TERRAIN_DAMAGE, terrainBlocks } from './terrain';
import type { Group, TerrainId } from './types';

export type TerrainWhen = 'afterStart' | 'beforeMovement' | 'beforeCombat';

/** Water drowns and void removes minions without the walk. Also used when such terrain is created under a group. */
export function checkFatal(e: Engine, g: Group): void {
  if (!g.pos) return;
  const t = e.state.terrain[key(g.pos)];
  if (t !== 'water' && t !== 'void') return;
  for (const m of minionsOf(e.state, g.id)) {
    const walks = computeStats(e, m.id).walks;
    if (walks.includes('flight')) continue;
    if (t === 'water') {
      if (!walks.includes('water')) killMinion(e, m.id, null, 'dies');
    } else {
      killMinion(e, m.id, null, 'removed');
    }
  }
}

/** Built-in terrain effects. Fatal terrain is checked at all three times, damage only after start of turn. */
export function applyTerrain(e: Engine, when: TerrainWhen): void {
  const s = e.state;
  for (const g of Object.values(s.groups)) {
    if (!s.groups[g.id] || !g.pos) continue;
    checkFatal(e, g);
    if (when !== 'afterStart' || !s.groups[g.id]) continue;
    const dmg = TERRAIN_DAMAGE[s.terrain[key(g.pos)]];
    if (!dmg) continue;
    for (const m of minionsOf(s, g.id)) {
      const walks = computeStats(e, m.id).walks;
      if (walks.includes('flight') || walks.includes(dmg.immune)) continue;
      applyDamage(e, m.id, dmg.damage);
    }
  }
}

/** Movement is unanimous: every minion must be able to enter (or exit) the terrain. */
export function groupCanEnter(e: Engine, g: Group, t: TerrainId): boolean {
  return minionsOf(e.state, g.id).every((m) => !terrainBlocks(t, computeStats(e, m.id).walks));
}
```

- [ ] **Step 4: Write `src/turn.ts`** (start-of-turn; `resolveTurn` is added in Task 12)

```ts
import { drawCards } from './deck';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupAt } from './query';
import { RULES } from './rules';
import { applyTerrain } from './terrainfx';
import { emptyPool, SIDES } from './types';
import type { Side } from './types';

/**
 * Start-of-turn phase (rules: Pipelines/turnphases, phase 1), up to the mana choice.
 * Sets phase to 'choose-mana' if a capture needs a choice, else finishes the turn start.
 */
export function beginTurn(e: Engine, first: boolean): void {
  const s = e.state;
  s.log.push({ type: 'turn', turn: s.turn });
  for (const m of Object.values(s.minions)) {
    if (m.status === 'alive' && m.expQualified && !m.hasExp) {
      m.hasExp = true;
      m.base.level = Math.min(RULES.maxLevel, m.base.level + 1);
    }
  }
  dispatch(e, 'turn:start');
  dispatch(e, 'turn:startAfter');
  applyTerrain(e, 'afterStart');
  for (const side of SIDES) drawCards(e, side, Math.max(0, RULES.handSize - s.players[side].hand.length));

  const delta = { red: 0, blue: 0 };
  s.pendingMana = [];
  for (const st of Object.values(s.structures)) {
    const g = groupAt(s, st.pos);
    const captor = g && g.kind === 'recruit' && g.owner !== 'neutral' && g.owner !== st.owner ? g.owner : null;
    if (!captor) continue;
    if (st.kind === 'sanctum') {
      s.winner = captor;
      s.phase = 'over';
      s.log.push({ type: 'win', winner: captor });
      return;
    }
    if (st.owner !== 'neutral') delta[st.owner]--;
    delta[captor]++;
    st.owner = captor;
    st.novices = 0;
    st.turnCount = RULES.townNoviceRate;
    st.manaType = null;
    st.captured = true;
    s.pendingMana.push(st.id);
    s.log.push({ type: 'capture', structure: st.id, by: captor });
  }

  if (!first) {
    for (const st of Object.values(s.structures)) {
      if (st.owner === 'neutral' || st.captured) continue;
      st.turnCount = Math.max(0, st.turnCount - 1);
      if (st.turnCount === 0 && st.novices < RULES.maxNovices) {
        st.novices++;
        st.turnCount = st.kind === 'sanctum' ? RULES.sanctumNoviceRate : RULES.townNoviceRate;
      }
    }
  }
  for (const st of Object.values(s.structures)) st.captured = false;

  if (delta.red !== delta.blue) s.initiative = delta.red > delta.blue ? 'red' : 'blue';
  if (s.pendingMana.length > 0) {
    s.phase = 'choose-mana';
    return;
  }
  finishTurnStart(e);
}

/** Generate mana and open the orders phase. Called when no mana choice is pending. */
export function finishTurnStart(e: Engine): void {
  const s = e.state;
  for (const side of SIDES) {
    const p = s.players[side];
    p.mana = emptyPool();
    p.orders = null;
    p.confirmed = false;
  }
  for (const st of Object.values(s.structures)) {
    if (st.kind !== 'sanctum' && st.owner !== 'neutral' && st.manaType) {
      s.players[st.owner as Side].mana[st.manaType]++;
    }
  }
  s.phase = 'orders';
}
```

- [ ] **Step 5: Update `src/api.ts`**

Add imports:
```ts
import { beginTurn, finishTurnStart } from './turn';
import type { Mana } from './types';
```
Add the result type and `chooseMana` (append to the file):
```ts
export type Result = { ok: true; state: GameState } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

/** The owner of a freshly captured town picks the mana type it produces (any of the 6, fixed until lost). */
export function chooseMana(state: GameState, cards: CardIndex, side: Side, structureId: number, mana: Mana): Result {
  const e = makeEngine(state, cards);
  const s = e.state;
  if (s.phase !== 'choose-mana') return fail('not choosing mana');
  const st = s.structures[structureId];
  if (!st || !s.pendingMana.includes(structureId)) return fail('that structure is not awaiting a mana choice');
  if (st.owner !== side) return fail('not your structure');
  st.manaType = mana;
  s.pendingMana = s.pendingMana.filter((id) => id !== structureId);
  if (s.pendingMana.length === 0) finishTurnStart(e);
  return { ok: true, state: e.state };
}
```
In `createGame`, replace `return e.state;` with:
```ts
  beginTurn(e, true);
  return e.state;
```

- [ ] **Step 6: Extend `src/ctx.ts` with `setTerrain`**

Add imports:
```ts
import { isSanctumArea } from './board';
import { checkFatal } from './terrainfx';
```
(`key` is already imported from `./board`; merge the two imports into one line.) Extend the `./spells` import to `import { dispel, recheckSquare } from './spells';`.

Add to `EventContext`:
```ts
  /** Changes a square's terrain. Structures and Sanctum squares are immune. Fatal terrain applies at once. */
  setTerrain(pos: Pos, terrain: TerrainId): void;
```
Add to the object returned by `makeCtx`:
```ts
    setTerrain: (pos, terrain) => {
      const s = e.state;
      if (!s.cells.includes(key(pos)) || isSanctumArea(pos) || structureAt(s, pos)) return;
      s.terrain[key(pos)] = terrain;
      const g = groupAt(s, pos);
      if (g) checkFatal(e, g);
      recheckSquare(e, pos);
    },
```

- [ ] **Step 7: Run all tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass (the Task 5 `createGame` tests still pass; decks of 12 now draw 5 each at creation).

```bash
git add packages/engine
git commit -m "feat(engine): start-of-turn phase, captures, initiative, terrain effects, setTerrain"
```

---

### Task 9: Orders validation and submission

**Goal:** `validateOrders` plus the public `submitOrders` and `confirmOrders` entry points (resolution is wired in Task 12).

**Files:**
- Create: `src/orders.ts`
- Modify: `src/api.ts` (add `submitOrders`, `confirmOrders` stub that stores/flags only; Task 12 wires `resolveTurn`)
- Test: `test/orders.test.ts`

**Acceptance Criteria:**
- [ ] Training: structure must be owned with enough novices; only a Sanctum trains mana, at most 1 per turn, only a house mana type; recruit count must fit the group limit of 8 and not collide with an enemy group in the structure
- [ ] Casting: valid hand index, no repeats, cost payable from the turn's pool (+1 for a mana novice), target legal and `canCast` true
- [ ] Discard: valid index, not also cast
- [ ] Moves: own player-controlled group, one order per group, destination on the board, terrain enterable
- [ ] `submitOrders` stores a valid order set (replacing earlier ones) and refuses once confirmed

**Verify:** `npx vitest run test/orders.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/orders.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { submitOrders } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { validateOrders } from '../src/orders';
import { emptyOrders, type Orders } from '../src/types';
import { gameEngine, put } from './helpers';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
});
const deck = Array(10).fill('bolt');

function setup() {
  const e = gameEngine([bolt], deck);
  const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
  const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
  return { e, sanctum, blueMinion: blue.minionIds[0] };
}
const orders = (o: Partial<Orders>): Orders => ({ ...emptyOrders(), ...o });

describe('validateOrders: training', () => {
  it('accepts empty orders and mana training in the house', () => {
    const { e, sanctum } = setup();
    expect(validateOrders(e, 'red', emptyOrders())).toBeNull();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }] }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'clarity' }] }))).toBeNull();
  });

  it('rejects mana outside the house, a second mana novice, and over-training', () => {
    const { e, sanctum } = setup();
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'mystery' }] }))).toMatch(/house/);
    expect(
      validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }, { structureId: sanctum.id, as: 'clarity' }] })),
    ).toMatch(/one novice/);
    const four = Array(4).fill({ structureId: sanctum.id, as: 'swordsman' });
    expect(validateOrders(e, 'red', orders({ train: four }))).toMatch(/novices/);
  });

  it('rejects training at an enemy structure and group overflow', () => {
    const { e, sanctum } = setup();
    const blueSanctum = Object.values(e.state.structures).find((s) => s.owner === 'blue')!;
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: blueSanctum.id, as: 'archer' }] }))).toMatch(/cannot train/);
    sanctum.novices = 8;
    const five = Array(5).fill({ structureId: sanctum.id, as: 'archer' });
    expect(validateOrders(e, 'red', orders({ train: five }))).toMatch(/8/);
  });

  it('rejects training where an enemy group stands', () => {
    const { e, sanctum } = setup();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') g.owner = 'blue';
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'archer' }] }))).toMatch(/occupied/);
  });
});

describe('validateOrders: casting', () => {
  it('needs mana, which a mana novice provides', () => {
    const { e, sanctum, blueMinion } = setup();
    const cast = { handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } };
    expect(validateOrders(e, 'red', orders({ cast: [cast] }))).toMatch(/strife/);
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }], cast: [cast] }))).toBeNull();
    const two = [cast, { handIndex: 1, target: cast.target }];
    expect(validateOrders(e, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }], cast: two }))).toMatch(/strife/);
  });

  it('rejects bad targets, repeated or unknown hand indexes', () => {
    const { e, sanctum, blueMinion } = setup();
    const train = [{ structureId: sanctum.id, as: 'strife' as const }];
    expect(validateOrders(e, 'red', orders({ train, cast: [{ handIndex: 0, target: { kind: 'globe' } }] }))).toMatch(/cannot target/);
    const ok = { handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } };
    expect(validateOrders(e, 'red', orders({ train, cast: [ok, ok] }))).toMatch(/hand index/);
    expect(validateOrders(e, 'red', orders({ train, cast: [{ ...ok, handIndex: 9 }] }))).toMatch(/hand index/);
  });

  it('validates discard', () => {
    const { e, sanctum, blueMinion } = setup();
    expect(validateOrders(e, 'red', orders({ discard: 2 }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ discard: 9 }))).toMatch(/discard/);
    const train = [{ structureId: sanctum.id, as: 'strife' as const }];
    const cast = [{ handIndex: 0, target: { kind: 'minion' as const, id: blueMinion } }];
    expect(validateOrders(e, 'red', orders({ train, cast, discard: 0 }))).toMatch(/casting/);
  });
});

describe('validateOrders: movement', () => {
  it('accepts a legal move and rejects illegal ones', () => {
    const { e } = setup();
    const red = Object.values(e.state.groups).find((g) => g.owner === 'red')!;
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }] }))).toBeNull();
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }, { groupId: red.id, dir: 's' }] }))).toMatch(/one move/);
    const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: blue.id, dir: 'w' }] }))).toMatch(/move/);
    const edge = put(e, 'red', { x: 0, y: 5 }, ['swordsman']);
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: edge.id, dir: 'w' }] }))).toMatch(/board/);
    e.state.terrain[`${SANCTUM_POS.red.x + 1},${SANCTUM_POS.red.y}`] = 'water';
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: red.id, dir: 'e' }] }))).toMatch(/terrain/);
  });

  it('refuses computer-controlled groups', () => {
    const { e } = setup();
    const bot = put(e, 'red', { x: 5, y: 5 }, ['swordsman'], 'computer');
    expect(validateOrders(e, 'red', orders({ move: [{ groupId: bot.id, dir: 'e' }] }))).toMatch(/move/);
  });
});

describe('submitOrders', () => {
  it('stores valid orders, replaces earlier ones, and reports errors', () => {
    const { e, sanctum } = setup();
    const r1 = submitOrders(e.state, e.cards, 'red', orders({ train: [{ structureId: sanctum.id, as: 'strife' }] }));
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    expect(r1.state.players.red.orders?.train).toHaveLength(1);
    const r2 = submitOrders(r1.state, e.cards, 'red', emptyOrders());
    expect(r2.ok && r2.state.players.red.orders?.train).toHaveLength(0);
    const bad = submitOrders(e.state, e.cards, 'red', orders({ discard: 99 }));
    expect(bad.ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/orders.ts`**

```ts
import { key, step } from './board';
import type { Engine } from './engine';
import { houseMana } from './houses';
import { groupAt } from './query';
import { RULES } from './rules';
import { castCheck } from './spells';
import { groupCanEnter } from './terrainfx';
import type { Mana, Orders, Side } from './types';

const isRecruit = (as: string): boolean => as === 'swordsman' || as === 'archer';

/** Returns an error message, or null if `o` is a legal set of orders for `side` right now. */
export function validateOrders(e: Engine, side: Side, o: Orders): string | null {
  const s = e.state;
  const p = s.players[side];
  if (s.phase !== 'orders') return 'not in the orders phase';
  if (p.confirmed) return 'orders already confirmed';

  const pool = { ...p.mana };
  const perStructure: Record<number, number> = {};
  let manaTrained = 0;
  for (const t of o.train) {
    const st = s.structures[t.structureId];
    if (!st || st.owner !== side) return 'cannot train at that structure';
    perStructure[st.id] = (perStructure[st.id] ?? 0) + 1;
    if (perStructure[st.id] > st.novices) return 'not enough novices';
    if (isRecruit(t.as)) continue;
    if (st.kind !== 'sanctum') return 'only a Sanctum can train mana';
    if (!houseMana(p.house).includes(t.as as Mana)) return 'that mana type is not in your house';
    manaTrained++;
    if (manaTrained > 1) return 'only one novice can be trained as mana per turn';
    pool[t.as as Mana]++;
  }
  for (const idStr of Object.keys(perStructure)) {
    const st = s.structures[Number(idStr)];
    const recruits = o.train.filter((t) => t.structureId === st.id && isRecruit(t.as)).length;
    if (recruits === 0) continue;
    const g = groupAt(s, st.pos);
    if (g && (g.owner !== side || g.kind !== 'recruit' || g.control !== 'player')) return 'structure is occupied by another group';
    if ((g?.minionIds.length ?? 0) + recruits > RULES.maxGroup) return `a group can hold at most ${RULES.maxGroup} minions`;
  }

  const used = new Set<number>();
  for (const c of o.cast) {
    const id = p.hand[c.handIndex];
    if (id === undefined || used.has(c.handIndex)) return 'invalid hand index';
    used.add(c.handIndex);
    const card = e.cards[id];
    if (!card) return `unknown card "${id}"`;
    for (const [mana, n] of Object.entries(card.cost) as Array<[Mana, number]>) {
      pool[mana] -= n;
      if (pool[mana] < 0) return `not enough ${mana} mana for ${card.name}`;
    }
    if (!castCheck(e, side, card, c.target)) return `${card.name} cannot target that`;
  }
  if (o.discard !== null) {
    if (p.hand[o.discard] === undefined) return 'invalid discard';
    if (used.has(o.discard)) return 'cannot discard a card you are casting';
  }

  const moved = new Set<number>();
  for (const m of o.move) {
    const g = s.groups[m.groupId];
    if (!g || g.owner !== side || g.control !== 'player' || !g.pos) return 'you cannot move that group';
    if (moved.has(g.id)) return 'one move order per group';
    moved.add(g.id);
    const dest = step(g.pos, m.dir);
    if (!s.cells.includes(key(dest))) return 'cannot move off the board';
    if (!groupCanEnter(e, g, s.terrain[key(dest)])) return 'group cannot enter that terrain';
  }
  return null;
}
```

- [ ] **Step 4: Update `src/api.ts`**

Add imports:
```ts
import { validateOrders } from './orders';
import { emptyOrders } from './types';
import type { Orders } from './types';
```
(Merge `emptyOrders`/`Orders` into the existing `./types` imports.) Append:
```ts
/** Validate and store a player's orders for this turn, replacing any earlier submission. */
export function submitOrders(state: GameState, cards: CardIndex, side: Side, orders: Orders): Result {
  const e = makeEngine(state, cards);
  const err = validateOrders(e, side, orders);
  if (err) return fail(err);
  e.state.players[side].orders = structuredClone(orders);
  return { ok: true, state: e.state };
}

/** Lock a player's orders. Task 12 makes this resolve the turn once both players have confirmed. */
export function confirmOrders(state: GameState, cards: CardIndex, side: Side): Result {
  const e = makeEngine(state, cards);
  const s = e.state;
  if (s.phase !== 'orders') return fail('not in the orders phase');
  const p = s.players[side];
  if (p.confirmed) return fail('already confirmed');
  if (!p.orders) p.orders = emptyOrders();
  p.confirmed = true;
  return { ok: true, state: e.state };
}
```

- [ ] **Step 5: Run tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`

```bash
git add packages/engine
git commit -m "feat(engine): orders validation, submitOrders and confirmOrders"
```

---

### Task 10: Movement pipeline

**Goal:** The two-pass movement algorithm: overstacking, voting, unstacking (hostile bounce, friendly join), bounce-back and moonwalking, bot-driven computer groups, and the post-move events.

**Files:**
- Create: `src/movement.ts`
- Test: `test/movement.test.ts`

**Acceptance Criteria:**
- [ ] A group with a move order moves one square; moves into hostile-occupied, blocked-terrain, off-board squares fail in pass I
- [ ] Two groups contesting an empty square: the initiative player's group takes it, the other stays
- [ ] Friendly groups meeting in a square join if the total is <= 8, else the loser bounces back to its start
- [ ] A stationary group beats a mover that cannot join it
- [ ] Only player-controlled recruit groups enter structures; computer-controlled groups follow their card's `bot`
- [ ] The original moonwalk diagram resolves as documented: A bounces, loses its starting square to D, then moonwalks to the nearest free square
- [ ] `group:exit`, `group:move`, `group:enter` fire (in that order) for groups that ended in a new square, including joiners

**Verify:** `npx vitest run test/movement.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/movement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { distance2 } from '../src/board';
import { runMovement } from '../src/movement';
import { groupAt, groupsAt } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, spawnMinion, recruitSpec } from '../src/units';
import { blankEngine, gameEngine, put } from './helpers';

const sw = (n: number) => Array<'swordsman'>(n).fill('swordsman');

describe('movement', () => {
  it('moves a group one square and clears the order', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, sw(2));
    g.moveOrder = 'e';
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
    expect(g.moveOrder).toBeNull();
  });

  it('does not enter a hostile-occupied square', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(1));
    put(e, 'blue', { x: 5, y: 4 }, sw(1));
    a.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 4, y: 4 });
  });

  it('gives a contested empty square to the initiative player', () => {
    for (const init of ['red', 'blue'] as const) {
      const e = blankEngine();
      e.state.initiative = init;
      const r = put(e, 'red', { x: 4, y: 4 }, sw(1));
      const b = put(e, 'blue', { x: 6, y: 4 }, sw(1));
      r.moveOrder = 'e';
      b.moveOrder = 'w';
      runMovement(e);
      expect(groupAt(e.state, { x: 5, y: 4 })?.owner).toBe(init);
      expect(r.pos).toEqual(init === 'red' ? { x: 5, y: 4 } : { x: 4, y: 4 });
      expect(b.pos).toEqual(init === 'blue' ? { x: 5, y: 4 } : { x: 6, y: 4 });
    }
  });

  it('joins friendly groups meeting in a square when they fit', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(3));
    const b = put(e, 'red', { x: 6, y: 4 }, sw(4));
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    runMovement(e);
    const here = groupsAt(e.state, { x: 5, y: 4 });
    expect(here).toHaveLength(1);
    expect(here[0].minionIds).toHaveLength(7);
    expect(Object.keys(e.state.groups)).toHaveLength(1);
  });

  it('bounces the later group when two friendly groups cannot join', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, sw(5));
    const b = put(e, 'red', { x: 6, y: 4 }, sw(5));
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    runMovement(e);
    expect(a.pos).toEqual({ x: 5, y: 4 });
    expect(b.pos).toEqual({ x: 6, y: 4 });
  });

  it('lets a stationary group beat a mover that cannot join it', () => {
    const e = blankEngine();
    const s = put(e, 'red', { x: 5, y: 4 }, sw(5));
    const m = put(e, 'red', { x: 4, y: 4 }, sw(4));
    m.moveOrder = 'e';
    runMovement(e);
    expect(s.pos).toEqual({ x: 5, y: 4 });
    expect(m.pos).toEqual({ x: 4, y: 4 });
  });

  it('blocks on water unless every minion can swim', () => {
    const e = blankEngine();
    e.state.terrain['5,4'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, sw(1));
    const b = put(e, 'red', { x: 4, y: 6 }, sw(1));
    e.state.terrain['5,6'] = 'water';
    e.state.minions[b.minionIds[0]].base.walks.push('water');
    a.moveOrder = 'e';
    b.moveOrder = 'e';
    runMovement(e);
    expect(a.pos).toEqual({ x: 4, y: 4 });
    expect(b.pos).toEqual({ x: 5, y: 6 });
  });

  it('ignores move orders for neutral player-controlled groups', () => {
    const e = blankEngine();
    const n = put(e, 'neutral', { x: 4, y: 4 }, sw(1));
    n.moveOrder = 'e';
    runMovement(e);
    expect(n.pos).toEqual({ x: 4, y: 4 });
  });
});

describe('movement: structures and bots', () => {
  const east = defineCard({ id: 'east', name: 'East', house: 'war', cost: {}, type: 'summoning', target: 'square', bot: () => 'e' });
  const west = defineCard({ id: 'west', name: 'West', house: 'war', cost: {}, type: 'summoning', target: 'square', bot: () => 'w' });

  it('lets player-controlled recruits enter a town but not computer-controlled groups', () => {
    const e = gameEngine([east, west], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    const player = put(e, 'red', { x: town.pos.x - 1, y: town.pos.y }, sw(1));
    player.moveOrder = 'e';
    const bot = createGroup(e, 'blue', { x: town.pos.x + 1, y: town.pos.y }, 'recruit', 'computer', 'west');
    spawnMinion(e, bot.id, recruitSpec('swordsman'));
    runMovement(e);
    expect(player.pos).toEqual(town.pos);
    expect(bot.pos).toEqual({ x: town.pos.x + 1, y: town.pos.y });
  });

  it('moves a computer-controlled group by its card bot', () => {
    const e = blankEngine([east]);
    const g = createGroup(e, 'neutral', { x: 4, y: 4 }, 'recruit', 'computer', 'east');
    spawnMinion(e, g.id, recruitSpec('swordsman'));
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
  });
});

describe('movement events', () => {
  it('fires exit, move, enter for groups that changed square', () => {
    const seen: string[] = [];
    const watcher = defineCard({
      id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: {
        'group:exit': () => { seen.push('exit'); },
        'group:move': () => { seen.push('move'); },
        'group:enter': () => { seen.push('enter'); },
      },
    });
    const e = blankEngine([watcher]);
    addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });
    const mover = put(e, 'red', { x: 4, y: 4 }, sw(1));
    mover.moveOrder = 'e';
    runMovement(e);
    expect(seen).toEqual(['exit', 'move', 'enter']);
  });
});

describe('movement: the original moonwalk diagram', () => {
  it('bounces A, lets D take its square, and moonwalks A to the nearest free square', () => {
    const e = blankEngine();
    // squares: a=(4,4)  b=(3,4)  c=(3,5)  d=(4,5)
    // group sequence (= pass I order): D, A, C, B
    const D = put(e, 'red', { x: 4, y: 5 }, sw(5));
    const A = put(e, 'red', { x: 4, y: 4 }, sw(4));
    const C = put(e, 'red', { x: 3, y: 5 }, sw(5));
    const B = put(e, 'red', { x: 3, y: 4 }, sw(1));
    D.moveOrder = 'n'; // into a
    A.moveOrder = 'w'; // into b
    C.moveOrder = 'n'; // into b
    runMovement(e);
    expect(D.pos).toEqual({ x: 4, y: 4 });
    expect(e.state.groups[C.id]).toBeUndefined(); // C joined B
    expect(B.minionIds).toHaveLength(6);
    expect(B.pos).toEqual({ x: 3, y: 4 });
    expect(A.pos).not.toBeNull();
    expect(distance2(A.pos!, { x: 4, y: 4 })).toBe(1);
    expect(A.pos).toEqual({ x: 4, y: 3 });
    expect(groupsAt(e.state, A.pos!)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/movement.ts`**

```ts
import { distance2, key, parseKey, samePos, step } from './board';
import { makeQuery } from './ctx';
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupsAt, hostile, minionsOf, ownerRank, sequence, structureAt } from './query';
import { RULES } from './rules';
import { recheck } from './spells';
import { groupCanEnter } from './terrainfx';
import type { Dir, GameState, Group, Pos } from './types';
import { removeGroup } from './units';

interface Track {
  start: Pos;
  moved: boolean;
  bounced: boolean;
  seq: number;
  notified: boolean;
}
type Tracks = Map<number, Track>;

function botMove(e: Engine, g: Group): Dir | null {
  const card = g.botId ? e.cards[g.botId] : undefined;
  return card?.bot ? card.bot(makeQuery(e, g.owner), g.id) : null;
}

function canEnterSquare(e: Engine, g: Group, dest: Pos): boolean {
  const s = e.state;
  if (!s.cells.includes(key(dest))) return false;
  if (!groupCanEnter(e, g, s.terrain[key(dest)])) return false;
  if (!groupCanEnter(e, g, s.terrain[key(g.pos!)])) return false; // exit check
  if (structureAt(s, dest) && (g.kind !== 'recruit' || g.control !== 'player')) return false;
  return true;
}

function canJoin(a: Group, b: Group): boolean {
  return (
    a.kind === 'recruit' && b.kind === 'recruit' && a.owner === b.owner && a.owner !== 'neutral' &&
    a.control === 'player' && b.control === 'player' &&
    a.minionIds.length + b.minionIds.length <= RULES.maxGroup
  );
}

/** Pass II ranking: stationary first, then initiative/neutral/non-initiative, then larger, then orders sequence. */
function rank(s: GameState, tracks: Tracks, pos: Pos, a: Group, b: Group): number {
  const stationary = (g: Group) => {
    const t = tracks.get(g.id);
    return !!t && !t.moved && samePos(t.start, pos);
  };
  if (stationary(a) !== stationary(b)) return stationary(a) ? -1 : 1;
  const ra = ownerRank(s, a.owner);
  const rb = ownerRank(s, b.owner);
  if (ra !== rb) return ra - rb;
  if (a.minionIds.length !== b.minionIds.length) return b.minionIds.length - a.minionIds.length;
  return (tracks.get(a.id)?.seq ?? 0) - (tracks.get(b.id)?.seq ?? 0);
}

function notify(e: Engine, g: Group, t: Track): void {
  if (t.notified) return;
  t.notified = true;
  if (!t.moved || !g.pos || samePos(g.pos, t.start)) return;
  const ref = { kind: 'group' as const, id: g.id };
  dispatch(e, 'group:exit', ref, { from: t.start });
  dispatch(e, 'group:move', ref, { from: t.start, to: g.pos });
  dispatch(e, 'group:enter', ref, { to: g.pos });
}

function join(e: Engine, tracks: Tracks, winner: Group, g: Group): void {
  const s = e.state;
  notify(e, g, tracks.get(g.id)!);
  for (const mid of g.minionIds) {
    s.minions[mid].groupId = winner.id;
    winner.minionIds.push(mid);
  }
  g.minionIds = [];
  removeGroup(e, g.id);
  for (const mid of winner.minionIds) recheck(e, { kind: 'minion', id: mid });
  recheck(e, { kind: 'group', id: winner.id });
}

/** Second bounce: jump to the nearest empty, unoccupied, enterable square; if none exists, leave the game. */
function moonwalk(e: Engine, tracks: Tracks, g: Group): void {
  const s = e.state;
  const t = tracks.get(g.id)!;
  let best: Pos | null = null;
  let bestD = Infinity;
  for (const k of s.cells) {
    const p = parseKey(k);
    if (groupsAt(s, p).some((o) => o.id !== g.id) || structureAt(s, p)) continue;
    if (!groupCanEnter(e, g, s.terrain[k])) continue;
    const d = distance2(t.start, p);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  if (!best) {
    for (const m of minionsOf(s, g.id)) killMinion(e, m.id, null, 'removed');
    return;
  }
  g.pos = best;
  t.moved = true;
}

function bounce(e: Engine, tracks: Tracks, g: Group): void {
  const t = tracks.get(g.id)!;
  if (t.bounced) {
    moonwalk(e, tracks, g);
    return;
  }
  t.bounced = true;
  g.pos = { ...t.start };
}

function overstacks(s: GameState): Pos[] {
  const by = new Map<string, number>();
  for (const g of Object.values(s.groups)) {
    if (!g.pos) continue;
    by.set(key(g.pos), (by.get(key(g.pos)) ?? 0) + 1);
  }
  return [...by.entries()].filter(([, n]) => n > 1).map(([k]) => parseKey(k)).sort((a, b) => (key(a) < key(b) ? -1 : 1));
}

function resolveStacks(e: Engine, tracks: Tracks): void {
  const s = e.state;
  for (let guard = 0; guard < 200; guard++) {
    const piles = overstacks(s);
    if (piles.length === 0) return;
    for (const pos of piles) {
      const here = groupsAt(s, pos);
      if (here.length < 2) continue;
      const ranked = [...here].sort((a, b) => rank(s, tracks, pos, a, b));
      const winner = ranked[0];
      for (const g of ranked.slice(1)) {
        if (!s.groups[g.id] || !s.groups[winner.id] || !g.pos || !samePos(g.pos, pos)) continue;
        if (hostile(g, winner) || !canJoin(winner, g)) bounce(e, tracks, g);
        else join(e, tracks, winner, g);
      }
    }
  }
}

/**
 * The movement phase (rules: Pipelines/movement). Reads `moveOrder` from every group, then clears it.
 * Pass I moves everyone ignoring the stacking limit; pass II resolves each overstacked square.
 */
export function runMovement(e: Engine): void {
  const s = e.state;
  dispatch(e, 'movement:before');
  for (const g of Object.values(s.groups)) if (g.control === 'computer') g.moveOrder = botMove(e, g);

  const list: Group[] = [];
  for (const p of sequence(s)) {
    const mine = s.groupSeq[p].map((id) => s.groups[id]).filter((g): g is Group => !!g && g.pos !== null);
    list.push(...mine.filter((g) => g.control === 'player'), ...mine.filter((g) => g.control === 'computer'));
  }
  const tracks: Tracks = new Map();
  list.forEach((g, i) => tracks.set(g.id, { start: { ...g.pos! }, moved: false, bounced: false, seq: i, notified: false }));

  for (const g of list) {
    if (!g.moveOrder || !g.pos) continue;
    if (g.owner === 'neutral' && g.control === 'player') continue;
    const dest = step(g.pos, g.moveOrder);
    if (!canEnterSquare(e, g, dest)) continue;
    if (groupsAt(s, dest).some((o) => o.id !== g.id && hostile(g, o))) continue;
    g.pos = dest;
    tracks.get(g.id)!.moved = true;
  }
  resolveStacks(e, tracks);
  for (const g of list) {
    const cur = s.groups[g.id];
    if (cur) notify(e, cur, tracks.get(g.id)!);
  }
  for (const g of Object.values(s.groups)) g.moveOrder = null;
  dispatch(e, 'movement:after');
}
```

- [ ] **Step 4: Run tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run test/movement.test.ts && npx tsc -p . --noEmit`
Expected: PASS. (Moonwalk ties on distance go to the first square in `s.cells` order, which is row-major, so A lands on `(4,3)`.)

```bash
git add packages/engine
git commit -m "feat(engine): two-pass movement with overstacking, joining, bounce and moonwalk"
```

---

### Task 11: Combat pipeline

**Goal:** Adjacent hostile groups fight: 10 rounds, missile-only round 1 at -1, bashers pair up, wise targeting, level/miss cycle, armor soak per round, attack/kill events and experience.

**Files:**
- Create: `src/combat.ts`
- Test: `test/combat.test.ts`

**Acceptance Criteria:**
- [ ] Equal swordsmen duel: the initiative group wins with 1 hit point left (round 1 has no basher attacks; armor soaks 1 per round)
- [ ] Equal archers duel: round 1 deals 1 damage (missile -1); the initiative archer wins with 2 hit points left
- [ ] A level-0 attacker against a level-1 victim hits, then alternates miss/hit
- [ ] `runCombats` makes one combat per adjacent hostile pair, with precedence going to the initiative player; non-adjacent and friendly groups do not fight
- [ ] Killing with combat damage marks a recruit as qualifying for an experience level
- [ ] Combat events fire in order: `combat:start` x2, `round:start` per group per round, `combat:end`, `combat:after`

**Verify:** `npx vitest run test/combat.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/combat.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight, runCombats } from '../src/combat';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

type Cls = 'swordsman' | 'archer';

function duel(a: Cls[], b: Cls[], init: 'red' | 'blue' = 'red') {
  const e = blankEngine();
  e.state.initiative = init;
  const ga = put(e, 'red', { x: 4, y: 4 }, a);
  const gb = put(e, 'blue', { x: 5, y: 4 }, b);
  return { e, ga, gb };
}

describe('fight', () => {
  it('swordsman duel: the first-striking group wins with 1 hp', () => {
    const { e, ga, gb } = duel(['swordsman'], ['swordsman']);
    const winner = e.state.minions[ga.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    expect(winner.status).toBe('alive');
    expect(winner.hp).toBe(1);
    expect(winner.expQualified).toBe(true);
  });

  it('archer duel: round 1 volley at -1, winner left with 2 hp', () => {
    const { e, ga, gb } = duel(['archer'], ['archer']);
    const winner = e.state.minions[ga.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    expect(winner.hp).toBe(2);
  });

  it('a level-0 attacker misses every other attack against a level-1 victim', () => {
    const { e, ga, gb } = duel(['archer'], ['archer']);
    e.state.minions[ga.minionIds[0]].base.level = 0;
    const lo = e.state.minions[gb.minionIds[0]];
    fight(e, ga.id, gb.id);
    expect(e.state.groups[ga.id]).toBeUndefined();
    expect(lo.hp).toBe(4);
  });

  it('a group of two archers beats a lone archer', () => {
    const { e, ga, gb } = duel(['archer', 'archer'], ['archer']);
    fight(e, ga.id, gb.id);
    expect(e.state.groups[gb.id]).toBeUndefined();
    const hp = ga.minionIds.map((id) => e.state.minions[id].hp).reduce((a, b) => a + b, 0);
    expect(hp).toBe(11);
  });

  it('fires combat events in order', () => {
    const seen: string[] = [];
    const log = defineCard({
      id: 'log', name: 'Log', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: {
        'combat:start': () => { seen.push('start'); },
        'round:start': () => { seen.push('round'); },
        'combat:end': () => { seen.push('end'); },
        'combat:after': () => { seen.push('after'); },
      },
    });
    const e = blankEngine([log]);
    addSpellRecord(e.state, { cardId: 'log', owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });
    const ga = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const gb = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    fight(e, ga.id, gb.id);
    expect(seen.slice(0, 2)).toEqual(['start', 'start']);
    expect(seen.filter((x) => x === 'round')).toHaveLength(8);
    expect(seen.slice(-2)).toEqual(['end', 'after']);
  });
});

describe('runCombats', () => {
  it('gives precedence to the initiative player', () => {
    for (const init of ['red', 'blue'] as const) {
      const { e, ga, gb } = duel(['swordsman'], ['swordsman'], init);
      runCombats(e);
      const winner = init === 'red' ? ga : gb;
      const loser = init === 'red' ? gb : ga;
      expect(e.state.groups[loser.id]).toBeUndefined();
      expect(e.state.minions[winner.minionIds[0]].hp).toBe(1);
    }
  });

  it('does not fight at range or between friends', () => {
    const e = blankEngine();
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const far = put(e, 'blue', { x: 6, y: 4 }, ['swordsman']);
    const friend = put(e, 'red', { x: 4, y: 5 }, ['swordsman']);
    runCombats(e);
    for (const g of [a, far, friend]) expect(e.state.minions[g.minionIds[0]].hp).toBe(7);
  });

  it('fights each adjacent hostile pair once', () => {
    const e = blankEngine();
    e.state.initiative = 'red';
    const mid = put(e, 'red', { x: 4, y: 4 }, ['archer', 'archer', 'archer', 'archer']);
    const left = put(e, 'blue', { x: 3, y: 4 }, ['archer']);
    const right = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    runCombats(e);
    expect(e.state.groups[left.id]).toBeUndefined();
    expect(e.state.groups[right.id]).toBeUndefined();
    expect(e.state.groups[mid.id]).toBeDefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write `src/combat.ts`**

```ts
import { step } from './board';
import { takeDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupAt, hostile, minionsOf, ownerRank, sequence } from './query';
import { nextRandom, shuffle } from './rng';
import { RULES } from './rules';
import { computeStats } from './stats';
import type { Dir, GameState, Group, Minion } from './types';

/** Fight order for the precedence group: NE, SW, SE, NW as seen from blue at the bottom = n, s, e, w on our grid. */
const FIGHT_ORDER: Dir[] = ['n', 's', 'e', 'w'];
/** Stands in for the original's "infinite" misses: every minion's first attack of a combat hits. */
const FIRST_HIT = 99;

const attacksLeft = (m: Minion): number => m.combat.handLeft + m.combat.missileLeft;

function precedes(s: GameState, a: Group, b: Group): boolean {
  const ra = ownerRank(s, a.owner);
  const rb = ownerRank(s, b.owner);
  return ra !== rb ? ra < rb : a.id < b.id;
}

function victimOf(s: GameState, m: Minion, enemyGid: number): Minion | null {
  const v = m.combat.victim === null ? undefined : s.minions[m.combat.victim];
  return v && v.status !== 'dead' && v.groupId === enemyGid ? v : null;
}

function isBasher(e: Engine, m: Minion): boolean {
  const st = computeStats(e, m.id);
  return st.handAttacks > 0 && st.missileAttacks === 0;
}

function groupPotential(e: Engine, gid: number): number {
  let total = 0;
  for (const m of minionsOf(e.state, gid)) {
    const st = computeStats(e, m.id);
    total += Math.max(st.hand, st.missile) * attacksLeft(m);
  }
  return total;
}

/** Wise targeting tiebreakers: combatants first, then can-kill, highest armor, lowest hp, highest damage, random. */
function chooseWisely(e: Engine, m: Minion, enemyGid: number): Minion | null {
  const s = e.state;
  const foes = shuffle(s, minionsOf(s, enemyGid));
  if (foes.length === 0) return null;
  const potential = groupPotential(e, m.groupId);
  const keyed = foes.map((x) => {
    const st = computeStats(e, x.id);
    const combatant = st.handAttacks + st.missileAttacks > 0;
    return { x, k: [combatant ? 0 : 1, x.hp + x.combat.armor <= potential ? 0 : 1, -st.armor, x.hp, -Math.max(st.hand, st.missile)] };
  });
  keyed.sort((a, b) => {
    for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] - b.k[i];
    return 0;
  });
  return keyed[0].x;
}

function startRound(e: Engine, hiId: number, loId: number, round: number): void {
  const s = e.state;
  for (const gid of [hiId, loId]) {
    for (const m of minionsOf(s, gid)) {
      const st = computeStats(e, m.id);
      m.combat.armor = st.armor;
      m.combat.handLeft = round === 1 ? 0 : st.handAttacks;
      m.combat.missileLeft = st.missileAttacks;
      if (round === 1) m.combat.misses = FIRST_HIT;
    }
  }
  for (const gid of [hiId, loId]) if (s.groups[gid]) dispatch(e, 'round:start', { kind: 'group', id: gid }, { round });
}

function chooseVictims(e: Engine, hiId: number, loId: number, round: number): void {
  if (round === 1) return; // shooters choose just in time; bashers do not attack in round 1
  const s = e.state;
  const idleBashers = (gid: number, enemy: number) =>
    minionsOf(s, gid).filter((m) => isBasher(e, m) && attacksLeft(m) > 0 && !victimOf(s, m, enemy));
  const a = shuffle(s, idleBashers(hiId, loId));
  const b = shuffle(s, idleBashers(loId, hiId));
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    a[i].combat.victim = b[i].id;
    b[i].combat.victim = a[i].id;
  }
  for (const [gid, enemy] of [[hiId, loId], [loId, hiId]] as const) {
    for (const m of minionsOf(s, gid)) {
      if (attacksLeft(m) > 0 && !victimOf(s, m, enemy)) {
        const v = chooseWisely(e, m, enemy);
        if (v) m.combat.victim = v.id;
      }
    }
  }
}

/** One attack: pipeline steps A1-A8 from the rules. */
function attack(e: Engine, m: Minion, v: Minion, round: number): void {
  const st = computeStats(e, m.id);
  const useMissile = m.combat.missileLeft > 0;
  if (useMissile) m.combat.missileLeft--;
  else m.combat.handLeft--;
  // A1: level check
  if (computeStats(e, v.id).level > st.level + m.combat.misses) {
    m.combat.misses++;
    return;
  }
  m.combat.misses = 0;
  // A2: damage
  let dmg = useMissile ? st.missile - (round === 1 ? 1 : 0) : st.hand;
  dmg = st.noDamage ? 0 : Math.max(0, dmg);
  // A3: victim takes damage
  const res = takeDamage(e, v.id, dmg, { kind: useMissile ? 'missile' : 'hand', ignoresArmor: false, magical: false }, m.id);
  const buried = () => m.status === 'dead' || v.status === 'dead';
  if (!buried()) {
    dispatch(e, 'attacker:hits', { kind: 'minion', id: m.id }, { victimId: v.id });
    if (!buried() && res !== 'bounced') dispatch(e, 'attacker:damages', { kind: 'minion', id: m.id }, { victimId: v.id });
  }
  if (v.status === 'dead') return; // A6
  if (res !== 'killed') return; // A7
  if (killMinion(e, v.id, m.id, 'kills') === 'cancelled') return;
  if (m.status === 'alive') {
    dispatch(e, 'attacker:kills', { kind: 'minion', id: m.id }, { victimId: v.id }); // A8
    if (m.kind === 'recruit' && !m.hasExp) m.expQualified = true;
  }
}

function attackPhase(e: Engine, myId: number, enemyId: number, round: number): void {
  const s = e.state;
  if (!s.groups[myId]) return;
  for (const mid of [...s.groups[myId].minionIds]) {
    const m = s.minions[mid];
    if (!m || m.status !== 'alive' || m.groupId !== myId || attacksLeft(m) <= 0) continue;
    if (!s.groups[myId] || !s.groups[enemyId] || !hostile(s.groups[myId], s.groups[enemyId])) return;
    let v = victimOf(s, m, enemyId);
    if (!v) {
      if (computeStats(e, m.id).missileAttacks > 0) v = chooseWisely(e, m, enemyId); // shooters are wise
      else v = minionsOf(s, enemyId).find((x) => x.combat.victim === m.id) ?? null; // bashers retaliate
      if (!v) {
        m.combat.handLeft = 0; // basher forfeits
        m.combat.missileLeft = 0;
        continue;
      }
      m.combat.victim = v.id;
    }
    attack(e, m, v, round);
    while (attacksLeft(m) > 0 && m.status === 'alive' && s.groups[enemyId]) {
      const foes = minionsOf(s, enemyId);
      if (foes.length === 0) break;
      const t = foes[Math.floor(nextRandom(s) * foes.length)]; // extra attacks pick random victims
      m.combat.victim = t.id;
      attack(e, m, t, round);
    }
  }
}

/** A full combat between two hostile groups; `hiId` is the group with precedence. */
export function fight(e: Engine, hiId: number, loId: number): void {
  const s = e.state;
  const alive = (id: number) => !!s.groups[id] && s.groups[id].pos !== null;
  const stillHostile = () => alive(hiId) && alive(loId) && hostile(s.groups[hiId], s.groups[loId]);
  s.log.push({ type: 'combat', hi: hiId, lo: loId });
  for (const id of [hiId, loId]) dispatch(e, 'combat:start', { kind: 'group', id }, { opponent: id === hiId ? loId : hiId });
  for (const gid of [hiId, loId]) {
    for (const m of minionsOf(s, gid)) m.combat = { armor: 0, handLeft: 0, missileLeft: 0, misses: FIRST_HIT, victim: null };
  }
  for (let round = 1; round <= RULES.combatRounds; round++) {
    if (!stillHostile()) break;
    startRound(e, hiId, loId, round);
    if (!stillHostile()) break;
    chooseVictims(e, hiId, loId, round);
    attackPhase(e, hiId, loId, round);
    attackPhase(e, loId, hiId, round);
  }
  for (const id of [hiId, loId]) if (alive(id)) dispatch(e, 'combat:end', { kind: 'group', id }, {});
  for (const id of [hiId, loId]) if (alive(id)) dispatch(e, 'combat:after', { kind: 'group', id }, {});
}

/** Combat phase: every orthogonally adjacent hostile pair fights once; the group with precedence picks the fight. */
export function runCombats(e: Engine): void {
  const s = e.state;
  dispatch(e, 'combat:before');
  for (const p of sequence(s)) {
    for (const gid of [...s.groupSeq[p]]) {
      for (const dir of FIGHT_ORDER) {
        const g = s.groups[gid];
        if (!g || !g.pos) break;
        const h = groupAt(s, step(g.pos, dir));
        if (!h || !hostile(g, h) || !precedes(s, g, h)) continue;
        fight(e, g.id, h.id);
      }
    }
  }
  dispatch(e, 'turn:afterCombat');
}
```

- [ ] **Step 4: Run tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run test/combat.test.ts && npx tsc -p . --noEmit`
Expected: PASS. (In the two-archers test the lone archer's 3 points of damage all land on the pair, and neither can die from 3, so the total is always 14 - 3 = 11.)

```bash
git add packages/engine
git commit -m "feat(engine): combat pipeline - rounds, victims, hit/miss, damage, kills, experience"
```

---

### Task 12: Turn resolution, public API, integration

**Goal:** `resolveTurn` stitches training, spells, movement, combat and garbage collection together; `confirmOrders` resolves once both players confirm; the package exports its public API. A scripted two-player game runs end to end, deterministically, and the state round-trips through JSON.

**Files:**
- Modify: `src/turn.ts` (add `resolveTurn`, `applyTraining`, `collectGarbage`), `src/api.ts` (`confirmOrders` resolves), `src/index.ts`
- Test: `test/resolve.test.ts`

**Acceptance Criteria:**
- [ ] Confirming both players' orders advances the turn; confirming one does not
- [ ] Order of resolution: training, hand bookkeeping, spells (initiative player first), movement, combat, garbage collection, then the next start of turn
- [ ] A cast card and a discarded card move from hand to discard; the hand refills to 5
- [ ] A conjuration with `duration: { turns: 2 }` is gone after the second end of turn
- [ ] Capturing the enemy Sanctum ends the game; further confirms are refused
- [ ] The same script run twice gives byte-identical JSON; the state survives `JSON.parse(JSON.stringify(s))`

**Verify:** `npx vitest run` (all suites) and `npx tsc -p . --noEmit` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/resolve.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { confirmOrders, submitOrders, type Result } from '../src/api';
import { defineCard } from '../src/cards';
import { SANCTUM_POS } from '../src/board';
import { removeGroup } from '../src/units';
import { emptyOrders, type GameState, type Orders } from '../src/types';
import { gameEngine, put } from './helpers';

const bolt = defineCard({
  id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.damage(t.id, 3); },
});
const shield = defineCard({
  id: 'shield', name: 'Shield', house: 'war', cost: { strife: 1 }, type: 'conjuration', target: 'recruitGroup', duration: { turns: 2 },
});

function must(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}
const orders = (o: Partial<Orders>): Orders => ({ ...emptyOrders(), ...o });

function setup(defs = [bolt, shield], deck = Array(10).fill('bolt') as string[]) {
  const e = gameEngine(defs, deck);
  const redSanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
  const redGroup = Object.values(e.state.groups).find((g) => g.owner === 'red')!;
  const blueGroup = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
  return { e, redSanctum, redGroup, blueGroup };
}

function playBoltTurn() {
  const { e, redSanctum, blueGroup } = setup();
  const target = blueGroup.minionIds[0];
  let s = must(
    submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'minion', id: target } }],
    })),
  );
  s = must(confirmOrders(s, e.cards, 'red'));
  const mid = s;
  s = must(confirmOrders(s, e.cards, 'blue'));
  return { e, s, mid, target, redSanctum };
}

describe('resolveTurn', () => {
  it('does not resolve until both players confirm', () => {
    const { mid } = playBoltTurn();
    expect(mid.turn).toBe(1);
    expect(mid.players.red.confirmed).toBe(true);
  });

  it('trains mana, casts, discards, redraws and starts the next turn', () => {
    const { s, target, redSanctum } = playBoltTurn();
    expect(s.turn).toBe(2);
    expect(s.phase).toBe('orders');
    expect(s.minions[target].hp).toBe(4);
    expect(s.players.red.hand).toHaveLength(5);
    expect(s.players.red.discard).toEqual(['bolt']);
    expect(s.structures[redSanctum.id].novices).toBe(2);
    expect(s.players.red.confirmed).toBe(false);
  });

  it('trains recruits into the Sanctum group', () => {
    const { e, redSanctum, redGroup } = setup();
    let s = must(submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'swordsman' }, { structureId: redSanctum.id, as: 'archer' }],
    })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.groups[redGroup.id].minionIds).toHaveLength(6);
    expect(s.structures[redSanctum.id].novices).toBe(1);
  });

  it('moves groups by order', () => {
    const { e, redGroup } = setup();
    let s = must(submitOrders(e.state, e.cards, 'red', orders({ move: [{ groupId: redGroup.id, dir: 'e' }] })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.groups[redGroup.id].pos).toEqual({ x: 3, y: 2 });
  });

  it('expires a two-turn conjuration at the second end of turn', () => {
    const { e, redSanctum, redGroup } = setup([bolt, shield], Array(10).fill('shield'));
    let s = must(submitOrders(e.state, e.cards, 'red', orders({
      train: [{ structureId: redSanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'group', id: redGroup.id } }],
    })));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.spells).toHaveLength(1);
    expect(s.spells[0].turnsLeft).toBe(1);
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.spells).toHaveLength(0);
  });

  it('ends the game when a Sanctum is occupied, then refuses further orders', () => {
    const { e } = setup();
    for (const g of Object.values(e.state.groups)) if (g.owner === 'red') removeGroup(e, g.id);
    put(e, 'blue', SANCTUM_POS.red, ['swordsman']);
    let s = must(confirmOrders(e.state, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    expect(s.winner).toBe('blue');
    expect(s.phase).toBe('over');
    expect(confirmOrders(s, e.cards, 'red').ok).toBe(false);
  });

  it('refuses double confirmation and edits after confirmation', () => {
    const { e } = setup();
    const s = must(confirmOrders(e.state, e.cards, 'red'));
    expect(confirmOrders(s, e.cards, 'red').ok).toBe(false);
    expect(submitOrders(s, e.cards, 'red', emptyOrders()).ok).toBe(false);
  });
});

describe('determinism and serialization', () => {
  it('runs the same script to byte-identical JSON', () => {
    const a = playBoltTurn().s;
    const b = playBoltTurn().s;
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('survives a JSON round trip', () => {
    const { s } = playBoltTurn();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`resolveTurn` missing)

- [ ] **Step 3: Add `resolveTurn` to `src/turn.ts`**

Add these imports at the top of the file (merge with the existing ones):
```ts
import { runCombats } from './combat';
import { runMovement } from './movement';
import { otherSide } from './query';
import { executeCast, expireSpells } from './spells';
import { addRecruit } from './units';
import { emptyOrders } from './types';
import type { Orders, Ref } from './types';
```
Append:
```ts
function applyTraining(e: Engine, side: Side, o: Orders): void {
  const s = e.state;
  for (const t of o.train) {
    const st = s.structures[t.structureId];
    if (!st || st.owner !== side || st.novices <= 0) continue;
    st.novices--;
    if (t.as === 'swordsman' || t.as === 'archer') addRecruit(e, side, st.pos, t.as);
  }
}

/** Deletes the dead, then expires finite-duration spells. */
function collectGarbage(e: Engine): void {
  const s = e.state;
  for (const id of s.graveyard) delete s.minions[id];
  s.graveyard = [];
  expireSpells(e);
}

/**
 * Phases 3-6 of the turn, then the next start of turn.
 * Training, hand bookkeeping, spells (initiative first), movement, combat, garbage collection.
 */
export function resolveTurn(e: Engine): void {
  const s = e.state;
  s.log = [];
  const order: Side[] = [s.initiative, otherSide(s.initiative)];
  const orders = { red: s.players.red.orders ?? emptyOrders(), blue: s.players.blue.orders ?? emptyOrders() };

  const casts = {} as Record<Side, Array<{ cardId: string; target: Ref }>>;
  for (const side of SIDES) {
    const hand = s.players[side].hand;
    casts[side] = orders[side].cast.map((c) => ({ cardId: hand[c.handIndex], target: c.target }));
  }

  for (const side of order) applyTraining(e, side, orders[side]);

  for (const side of SIDES) {
    const p = s.players[side];
    const gone = new Set<number>(orders[side].cast.map((c) => c.handIndex));
    if (orders[side].discard !== null) gone.add(orders[side].discard as number);
    p.discard.push(...[...gone].sort((a, b) => a - b).map((i) => p.hand[i]));
    p.hand = p.hand.filter((_, i) => !gone.has(i));
  }

  for (const side of order) for (const c of casts[side]) executeCast(e, side, c.cardId, c.target);

  for (const g of Object.values(s.groups)) g.moveOrder = null;
  for (const side of SIDES) {
    for (const mo of orders[side].move) {
      const g = s.groups[mo.groupId];
      if (g && g.pos && g.owner === side && g.control === 'player') g.moveOrder = mo.dir;
    }
  }
  applyTerrain(e, 'beforeMovement');
  runMovement(e);
  applyTerrain(e, 'beforeCombat');
  runCombats(e);
  collectGarbage(e);

  s.turn++;
  beginTurn(e, false);
}
```

- [ ] **Step 4: Update `confirmOrders` in `src/api.ts`**

Add `import { resolveTurn } from './turn';` (merge with the existing `./turn` import) and replace the last two lines of `confirmOrders` (`p.confirmed = true; return ...`) with:
```ts
  p.confirmed = true;
  if (SIDES.every((x) => s.players[x].confirmed)) resolveTurn(e);
  return { ok: true, state: e.state };
```
Also update its doc comment to: `/** Lock a player's orders. When both players have confirmed, the turn resolves and the next one begins. */`

- [ ] **Step 5: Write `src/index.ts`**

```ts
export const ENGINE_VERSION = '0.1.0';

export { createGame, validateDeck, submitOrders, confirmOrders, chooseMana } from './api';
export type { GameConfig, DeckConfig, Result } from './api';
export { defineCard, indexCards } from './cards';
export type { CardDef, CardIndex, SpellType, TargetType } from './cards';
export type { EventContext, QueryContext } from './ctx';
export type { EventType, GameEvent } from './events';
export type { Stats, StatDelta } from './stats';
export { HOUSES, houseMana } from './houses';
export { RULES } from './rules';
export { validateOrders } from './orders';
export { createCells, SANCTUM_POS, sanctumSquares, entrances } from './board';
export { emptyOrders, emptyPool, MANA_TYPES, SIDES } from './types';
export type {
  ActiveSpell, BaseStats, Dir, GameState, Group, HouseId, LogEntry, Mana, ManaPool, Minion, MinionSpec,
  Orders, PlayerId, PlayerState, Pos, Ref, Side, Structure, SummonDef, TerrainId, Walk,
  TrainOrder, CastOrder, MoveOrder,
} from './types';
```
Update `test/smoke.test.ts` expectation to `'0.1.0'`.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: every suite passes (smoke, rng, houses, board, mapgen, events, stats, units, create, damage, spells, turnstart, orders, movement, combat, resolve); typecheck exits 0.

- [ ] **Step 7: Commit and tag**

```bash
git add -A
git commit -m "feat(engine): resolveTurn, confirm-to-resolve, public API; engine core complete"
git tag engine-core
```

---

## After this plan

Plan 2 (`packages/cards` + `tools/scrape`) and plan 3 (`packages/web` hotseat client) are written next, against the API exported from `packages/engine/src/index.ts`. Known engine gaps to schedule when cards need them (each is additive): ice sliding and swamp exit rule, concealment-aware group spells, heroes and boardhopping, `ctx.modifyMove` to cancel or redirect a move order during spell execution, structure creation/destruction actions, and the choose-victim immunity hook in wise targeting.
