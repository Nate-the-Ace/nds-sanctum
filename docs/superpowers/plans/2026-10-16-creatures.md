# Creatures: Monsters, Heroes and Nations Implementation Plan (plan 2c)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 18 creature cards of backlog group E1 (10 War, 8 Life) in the keyword language, with the engine support they need: nations, minion creation, monster behaviours, off-board combat-hoppers, conditional damage, hero once-per-game, initiative effects.

**Architecture:** Small, general engine extensions first (nations as a minion property, creation APIs on `ctx`, new events and stat fields, monster home squares and bot context, hide/appear for off-board groups). Then a creature layer in `packages/cards/src/lang` (`Monster`, `Create`, `Hero`, `Ambush`, behaviours, `Against`, `Immune`, `Aura`, `Taunt`) so every card is a keyword declaration. A summoned minion carries a non-visible spell of its own card, which is how a summoning card's hooks run.

**Tech Stack:** TypeScript (strict, ESM), Vitest, npm workspaces. Branch `engine-core` (tag `keyword-language` is the starting point).

**User decisions (already made):**
- Faithful clone; private use only; "I trust your judgement on rules of play."
- Card scripts are TypeScript modules; cards are declared with the keyword language (`card({... keywords})`) and "Keywords generate the card text".
- Plan 2c comes after the keyword language ("Write plan 2c: monsters, heroes and nations in the keyword language").
- Questing Beast is deferred (needs random-square summoning and a hunted group); the other 18 E1 cards are in scope.

**Plan decisions (mine, from "I trust your judgement"):**
1. **Nations.** 12 nations from `research/rules/Axioms_houses.txt`: Imp, Cyclops, Keeper, Shadow, Vision, Gargoyle, Elf, Dwarf, Djinn, Satyr, Misfit, Human. Abilities: 9 HP (Cyclops, Gargoyle, Misfit), +1 hand damage in round 2 (Imp, Keeper, Human), +1 missile damage in round 1 (Elf, Satyr), Mountainwalk (Dwarf, Shadow), Waterwalk (Djinn, Vision). Recruits made by the game (starting group, training) take the nation of their owner's house. Recruits made by test helpers (`recruitSpec(cls)` with no nation) stay nationless, so every existing test keeps its numbers.
2. **House on minions.** Every minion records the house it serves: a recruit's is its nation's house, a monster's is its summoning card's house. Needed by Hellion, Prismatic Serpent and Arboriads.
3. **Summoned creatures carry a spell of their own card.** `Monster`/`Create`/`Ambush` cast a non-visible spell of the same card on each created minion (via `ctx.createSpell`). That is what makes a card's `on`/`stats` hooks run for a type that is not persistent (`summoning`, `hero`). Such cards declare `host: 'minion'`, which tells keyword validation that their spell sits on a minion.
4. **Stat lines are the final stats.** A creature card's printed `H:5 A:1 HP:7 L:2` already includes its own bonus spells (Warlord H2 base +2 +1; Decoy A1 base +2). The creature definition holds the base; the bonus is a helper spell.
5. **Monster AI** (the original's exact AI is unknown): Immobile never moves. Territorial hunts the nearest hostile recruit group within 2 squares of its home square (Chebyshev) but never leaves its 3x3 territory. Nomadic hunts the nearest hostile recruit group anywhere, and wanders randomly when none exists. Nobody steps into an occupied square (combat happens between adjacent groups).
6. **Hero rule.** `PlayerState.heroesCast` records hero card ids; a hero card whose id is recorded fails `castCheck` and squanders. Heroes are level 2 recruits (the "veteran" level, see Warlord/Ngozi/Lienna stat lines).
7. **Off-board groups** (`pos === null`) receive no events for spells on them or their minions (rules: "Time stops when you're off the board"). Combat-hoppers are a globe-hosted controller spell holding the group id in a token.
8. **Metadata.** Monster cards with no "Cast on" clause (Hellion, Prismatic Serpent, Sylph, Salamander) are cast on a square; `meta.test.ts` gets an explicit list for them.

**Starting state:** `engine-core` at tag `keyword-language`: engine 143 tests, scrape 6, cards 232; 68 cards (60 playable, 8 helpers).

---

## File structure

Engine (`packages/engine/src`):
- Create: `nations.ts` (nation table), `test/nations.test.ts`, `test/creation.test.ts`, `test/hooks.test.ts`, `test/monsters.test.ts`
- Modify: `types.ts` (Nation, minion nation/house, Group.home, Structure.noviceNations, PlayerState.heroesCast, SummonDef.pos null), `units.ts`, `combat.ts`, `api.ts`, `turn.ts`, `state.ts`, `stats.ts`, `cards.ts` (BotContext, groupAura), `ctx.ts`, `events.ts`, `query.ts`, `spells.ts`, `movement.ts`, `index.ts`, `testing.ts`

Cards (`packages/cards`):
- Create: `src/lang/keywords/{creature,behavior,versus}.ts`, creature card files (listed per task), tests `test/lang-creature.test.ts`, `test/creatures-*.test.ts`
- Modify: `src/lang/{types,card,hosts,target,merge,effects,triggers,index}.ts`, `src/lang/keywords/statics.ts` (export two helpers), `src/war/index.ts`, `src/life/index.ts`, `test/{meta,faces,lang-migration}.test.ts`, `docs/superpowers/plans/cards-backlog.md`, docs

---

### Task 0: Nations and the house of a minion

**Goal:** Minions carry a nation and a house; the 12 nations' abilities work; the game's recruits get their house's nation.

**Files:**
- Create: `packages/engine/src/nations.ts`, `packages/engine/test/nations.test.ts`
- Modify: `packages/engine/src/{types,units,combat,api,turn,index,testing}.ts`

**Acceptance Criteria:**
- [ ] `NATIONS` has 12 entries, one per house, with the abilities in plan decision 1; `nationOfHouse(house)` inverts it
- [ ] `recruitSpec(cls, nation)` gives 9 hp for Cyclops/Gargoyle/Misfit, Mountainwalk for Dwarf/Shadow, Waterwalk for Djinn/Vision, and records `nation` and `house`; `recruitSpec(cls)` is unchanged
- [ ] A human basher deals +1 hand damage in round 2 only; an elf shooter +1 missile damage in round 1 only
- [ ] `createGame` gives every starting recruit and every trained recruit the nation of its owner's house
- [ ] All existing engine, scrape and cards tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/nations.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createGame } from '../src/api';
import { fight } from '../src/combat';
import { indexCards } from '../src/cards';
import { makeEngine } from '../src/engine';
import { HOUSES } from '../src/houses';
import { NATION_LIST, NATIONS, nationOfHouse } from '../src/nations';
import { recruitSpec, createGroup, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine } from './helpers';

describe('nation table', () => {
  it('has 12 nations, one per house', () => {
    expect(NATION_LIST).toHaveLength(12);
    expect(new Set(NATION_LIST.map((n) => NATIONS[n].house))).toEqual(new Set(Object.keys(HOUSES)));
    for (const h of Object.keys(HOUSES) as Array<keyof typeof HOUSES>) expect(NATIONS[nationOfHouse(h)].house).toBe(h);
  });

  it('applies abilities to the recruit base', () => {
    expect(recruitSpec('swordsman', 'cyclops').base.hp).toBe(9);
    expect(recruitSpec('archer', 'misfit').base.hp).toBe(9);
    expect(recruitSpec('swordsman', 'human').base.hp).toBe(7);
    expect(recruitSpec('swordsman', 'dwarf').base.walks).toEqual(['mountain']);
    expect(recruitSpec('swordsman', 'djinn').base.walks).toEqual(['water']);
    expect(recruitSpec('swordsman', 'human')).toMatchObject({ nation: 'human', house: 'war' });
    expect(recruitSpec('swordsman').nation).toBeUndefined();
  });
});

describe('game recruits take their house nation', () => {
  it('starting groups', () => {
    const cards = indexCards([]);
    const state = createGame(
      { seed: 1, decks: { red: { house: 'life', cards: [] }, blue: { house: 'body', cards: [] } },
        options: { towns: 0, flatTerrain: true, skipDeckRules: true } },
      cards,
    );
    const ms = Object.values(state.minions);
    expect(ms.filter((m) => m.owner === 'red').every((m) => m.nation === 'elf' && m.house === 'life' && m.hp === 7)).toBe(true);
    expect(ms.filter((m) => m.owner === 'blue').every((m) => m.nation === 'cyclops' && m.hp === 9 && m.maxHp === 9)).toBe(true);
  });
});

describe('combat nation abilities', () => {
  const dummy = (): MinionSpec => ({
    kind: 'monster', cls: 'monster', name: 'dummy',
    base: { hp: 100, level: 1, armor: 0, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
  });
  const duel = (nation?: 'human') => {
    const e = blankEngine();
    const a = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    spawnMinion(e, a.id, recruitSpec('swordsman', nation));
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    fight(e, a.id, b.id);
    return e.state.minions[v.id].hp;
  };
  it('a human basher adds 1 hand damage in round 2 only', () => {
    // rounds 2..10 = 9 attacks of 2 damage
    expect(duel()).toBe(100 - 18);
    expect(duel('human')).toBe(100 - 19);
  });
});
```
(`makeEngine` import is unused; remove it if lint complains.)

- [ ] **Step 2: Run to verify failure** (`nations` module does not exist)

- [ ] **Step 3: Write `packages/engine/src/nations.ts` and the type changes**

```ts
import type { BaseStats, HouseId, Nation, Walk } from './types';

export interface NationDef {
  house: HouseId;
  hp: 7 | 9;
  walks: Walk[];
  /** +1 damage: hand attacks in round 2, or missile attacks in round 1. */
  combat: 'hand2' | 'missile1' | null;
}

/** From `research/rules/Axioms_houses.txt`. */
export const NATIONS: Record<Nation, NationDef> = {
  imp: { house: 'abomination', hp: 7, walks: [], combat: 'hand2' },
  cyclops: { house: 'body', hp: 9, walks: [], combat: null },
  keeper: { house: 'death', hp: 7, walks: [], combat: 'hand2' },
  shadow: { house: 'despair', hp: 7, walks: ['mountain'], combat: null },
  vision: { house: 'hope', hp: 7, walks: ['water'], combat: null },
  gargoyle: { house: 'justice', hp: 9, walks: [], combat: null },
  elf: { house: 'life', hp: 7, walks: [], combat: 'missile1' },
  dwarf: { house: 'making', hp: 7, walks: ['mountain'], combat: null },
  djinn: { house: 'mind', hp: 7, walks: ['water'], combat: null },
  satyr: { house: 'nature', hp: 7, walks: [], combat: 'missile1' },
  misfit: { house: 'unmaking', hp: 9, walks: [], combat: null },
  human: { house: 'war', hp: 7, walks: [], combat: 'hand2' },
};
export const NATION_LIST = Object.keys(NATIONS) as Nation[];

export const nationOfHouse = (house: HouseId): Nation => NATION_LIST.find((n) => NATIONS[n].house === house)!;

export function applyNation(base: BaseStats, nation: Nation): BaseStats {
  return { ...base, hp: NATIONS[nation].hp, walks: [...base.walks, ...NATIONS[nation].walks] };
}
```
`types.ts`: add
```ts
export type Nation =
  | 'imp' | 'cyclops' | 'keeper' | 'shadow' | 'vision' | 'gargoyle'
  | 'elf' | 'dwarf' | 'djinn' | 'satyr' | 'misfit' | 'human';
```
add `nation?: Nation; house?: HouseId;` to `MinionSpec`, and `nation: Nation | null; house: HouseId | null;` to `Minion`.

- [ ] **Step 4: Spawn, recruitSpec, addRecruit, combat bonus, game recruits**

`units.ts`: import `applyNation, NATIONS` from './nations'; `Nation` from './types'.
```ts
export function recruitSpec(cls: 'swordsman' | 'archer', nation?: Nation): MinionSpec {
  const base = recruitBase(cls);
  if (!nation) return { kind: 'recruit', cls, name: cls, base };
  return { kind: 'recruit', cls, name: cls, base: applyNation(base, nation), nation, house: NATIONS[nation].house };
}
```
In `spawnMinion`, add `nation: spec.nation ?? null, house: spec.house ?? null` to the `Minion` literal. Change `addRecruit(e, owner, pos, cls, nation?: Nation)` to call `spawnMinion(e, g.id, recruitSpec(cls, nation))`.

`combat.ts`: import `NATIONS`; add
```ts
const nationBonus = (m: Minion, useMissile: boolean, round: number): number => {
  const c = m.nation ? NATIONS[m.nation].combat : null;
  return (c === 'hand2' && !useMissile && round === 2) || (c === 'missile1' && useMissile && round === 1) ? 1 : 0;
};
```
and change the A2 lines of `attack` to
```ts
  let dmg = useMissile ? st.missile - (round === 1 ? 1 : 0) : st.hand;
  dmg += nationBonus(m, useMissile, round);
  dmg = st.noDamage ? 0 : Math.max(0, dmg);
```
`api.ts` (`createGame`): `for (const cls of RULES.startGroup) addRecruit(e, side, SANCTUM_POS[side], cls, nationOfHouse(s.players[side].house));` (import `nationOfHouse`). `turn.ts` `applyTraining`: `addRecruit(e, side, st.pos, t.as, nationOfHouse(s.players[side].house))` (import it).
`index.ts`: export `NATIONS, NATION_LIST, nationOfHouse` and type `Nation`, and `recruitSpec` from `./units`. `testing.ts` already exports `recruitSpec`.

- [ ] **Step 5: Run the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. If a game-level engine test now differs because starting recruits are human (war decks) and a +1 hand in round 2 changes a number, fix that test's expectation and report it; helper-built groups are nationless and must not change.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): nations and the house of a minion"
```

---

### Task 1: Creation API

**Goal:** Spells can add a minion to a group, create a recruit in a structure, create novices of a nation, and change a group's side; `createSpell` can set tokens.

**Files:**
- Create: `packages/engine/test/creation.test.ts`
- Modify: `packages/engine/src/{types,units,ctx,turn,index}.ts`

**Acceptance Criteria:**
- [ ] `ctx.addMinion(groupId, spec)` adds to the group and returns the id, or returns `null` when the group has 8 minions or is gone
- [ ] `ctx.createRecruit(structureId, spec)` joins the friendly player group on the structure's square or starts one; returns `null` when another side's group is there or the group is full; dispatches `minion:created` on the structure
- [ ] `ctx.addNovices(structureId, n, nation?)` raises `novices` to at most 8 and queues the nation; training takes queued nations first, then the house nation
- [ ] `ctx.changeSides(groupId)` flips a recruit or monster group (and its minions, and the spells on them) to the other side and fixes `groupSeq`
- [ ] `ctx.createSpell(cardId, host, { tokens })` sets initial tokens
- [ ] A recruit created while a capture empties a structure's novices also clears its nation queue

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/creation.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard, indexCards, type CardDef } from '../src/cards';
import { executeCast } from '../src/spells';
import { resolveTurn } from '../src/turn';
import { addSpellRecord } from '../src/spellstore';
import { recruitSpec } from '../src/units';
import { RULES } from '../src/rules';
import type { Structure } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number): Structure => ({
  id, kind: 'town', pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false,
});
const probe = (fn: CardDef['onCast']): CardDef =>
  defineCard({ id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'manifestation', target: 'globe', onCast: fn });
const globe = { kind: 'globe' as const };

describe('addMinion', () => {
  it('adds to a group until it is full', () => {
    let first: number | null = -1;
    let overflow: number | null = -1;
    const e = blankEngine([probe((c) => {
      const gid = Object.keys(c.state.groups).map(Number)[0];
      first = c.addMinion(gid, recruitSpec('swordsman', 'human'));
      overflow = c.addMinion(gid, recruitSpec('swordsman'));
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman', 'swordsman']);
    executeCast(e, 'red', 'probe', globe);
    expect(first).not.toBeNull();
    expect(e.state.groups[g.id].minionIds).toHaveLength(RULES.maxGroup);
    expect(e.state.minions[first!].nation).toBe('human');
    expect(overflow).toBeNull();
  });
});

describe('createRecruit', () => {
  it('joins the friendly group on the structure, or starts one; refuses a hostile occupant', () => {
    const ids: Array<number | null> = [];
    const e = blankEngine([probe((c) => {
      ids.push(c.createRecruit(10, recruitSpec('swordsman')));
      ids.push(c.createRecruit(11, recruitSpec('swordsman')));
      ids.push(c.createRecruit(12, recruitSpec('swordsman')));
    })]);
    e.state.structures[10] = town(10, 'red', 3, 3);
    e.state.structures[11] = town(11, 'red', 6, 6);
    e.state.structures[12] = town(12, 'red', 8, 2);
    const mine = put(e, 'red', { x: 3, y: 3 }, ['archer']);
    put(e, 'blue', { x: 8, y: 2 }, ['archer']);
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.groups[mine.id].minionIds).toHaveLength(2);
    expect(ids[0]).not.toBeNull();
    expect(Object.values(e.state.groups).find((g) => g.pos?.x === 6 && g.pos?.y === 6)?.minionIds).toHaveLength(1);
    expect(ids[2]).toBeNull();
  });

  it('dispatches minion:created on the structure', () => {
    const watch = defineCard({
      id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'structure', visible: false,
      on: { 'minion:created': (c, ev) => c.setToken('seen', ev.data.minionId) },
    });
    const e = blankEngine([watch, probe((c) => { c.createRecruit(10, recruitSpec('archer')); })]);
    e.state.structures[10] = town(10, 'red', 3, 3);
    const sp = addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'structure', id: 10 }, visible: false, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(sp.tokens.seen).toBeGreaterThan(0);
  });
});

describe('novices', () => {
  it('addNovices caps at the maximum and training uses the queued nation first', () => {
    const e = gameEngine([probe((c) => {
      const sid = Object.values(c.state.structures).find((s) => s.kind === 'sanctum' && s.owner === 'red')!.id;
      c.addNovices(sid, 2, 'elf');
      c.addNovices(sid, 99, 'dwarf');
    })]);
    executeCast(e, 'red', 'probe', globe);
    const sanctum = Object.values(e.state.structures).find((s) => s.kind === 'sanctum' && s.owner === 'red')!;
    expect(sanctum.novices).toBe(RULES.maxNovices);
    expect(sanctum.noviceNations).toEqual(['elf', 'elf', 'dwarf', 'dwarf', 'dwarf']);
    // train one swordsman: it is an elf
    e.state.players.red.orders = { train: [{ structureId: sanctum.id, as: 'swordsman' }], cast: [], move: [], discard: null };
    const before = new Set(Object.keys(e.state.minions));
    resolveTurn(e);
    const fresh = Object.values(e.state.minions).filter((m) => !before.has(String(m.id)) && m.owner === 'red');
    expect(fresh[0].nation).toBe('elf');
    expect(e.state.structures[sanctum.id].noviceNations).toEqual(['elf', 'dwarf', 'dwarf', 'dwarf']);
  });
});

describe('changeSides', () => {
  it('flips the group, its minions and the spells on them', () => {
    const mark = defineCard({ id: 'mark', name: 'mark', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
    const e = blankEngine([mark, probe((c) => { c.changeSides(Object.keys(c.state.groups).map(Number)[0]); })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = addSpellRecord(e.state, { cardId: 'mark', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.groups[g.id].owner).toBe('blue');
    expect(e.state.minions[g.minionIds[0]].owner).toBe('blue');
    expect(sp.owner).toBe('blue');
    expect(e.state.groupSeq.red).not.toContain(g.id);
    expect(e.state.groupSeq.blue).toContain(g.id);
  });
});

describe('createSpell tokens', () => {
  it('sets initial tokens', () => {
    const watch = defineCard({ id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', visible: false });
    const e = blankEngine([watch, probe((c) => { c.createSpell('watch', globe, { tokens: { gid: 7 } }); })]);
    executeCast(e, 'red', 'probe', globe);
    expect(e.state.spells.find((s) => s.cardId === 'watch')?.tokens.gid).toBe(7);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Types and unit helpers**

`types.ts`: `Structure` gets `noviceNations?: Nation[];` (optional so existing literals still compile).

`units.ts`: add
```ts
import { RULES } from './rules'; // already imported
/** Adds a minion to an existing group; null when the group is gone or full. */
export function joinGroup(e: Engine, groupId: number, spec: MinionSpec): Minion | null {
  const g = e.state.groups[groupId];
  if (!g || g.minionIds.length >= RULES.maxGroup) return null;
  return spawnMinion(e, groupId, spec);
}

/** Recruit created on a square: joins the friendly player group there or starts one. Null when the square is blocked. */
export function placeRecruit(e: Engine, owner: Side, pos: Pos, spec: MinionSpec): Minion | null {
  const existing = groupAt(e.state, pos);
  if (!existing) {
    const g = createGroup(e, owner, pos, 'recruit', 'player');
    return spawnMinion(e, g.id, spec);
  }
  const usable = existing.owner === owner && existing.kind === 'recruit' && existing.control === 'player';
  return usable ? joinGroup(e, existing.id, spec) : null;
}

/** Flips a recruit or monster group to the other side (minions and the spells on them go with it). */
export function flipGroup(e: Engine, groupId: number): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g || g.owner === 'neutral') return;
  const to: Side = g.owner === 'red' ? 'blue' : 'red';
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  s.groupSeq[to].push(groupId);
  g.owner = to;
  for (const mid of g.minionIds) if (s.minions[mid]) s.minions[mid].owner = to;
  for (const sp of s.spells) {
    const onGroup = sp.host.kind === 'group' && sp.host.id === groupId;
    const onMinion = sp.host.kind === 'minion' && g.minionIds.includes(sp.host.id);
    if (onGroup || onMinion) sp.owner = to;
  }
}
```
(`Side` is already imported in units.ts.)

- [ ] **Step 4: ctx methods**

`ctx.ts`: import `{ flipGroup, joinGroup, placeRecruit }` from './units' (summonGroup already), `Nation` and `MinionSpec` types. Add to `EventContext`:
```ts
  /** Adds a minion to a group. Returns its id, or null when the group is full or gone. */
  addMinion(groupId: number, spec: MinionSpec): number | null;
  /** Creates a recruit on a structure's square (joins the friendly player group there). Null when blocked or full. */
  createRecruit(structureId: number, spec: MinionSpec): number | null;
  /** Adds novices (up to the maximum) to a structure; `nation` marks them to train as that nation. */
  addNovices(structureId: number, count: number, nation?: Nation): void;
  /** The group changes sides. */
  changeSides(groupId: number): void;
```
Change `createSpell`'s `opts` type to `{ owner?: PlayerId; turns?: number | null; tokens?: Record<string, number> }` and its record to `tokens: { ...opts?.tokens }`. Implement in `makeCtx`:
```ts
    addMinion: (groupId, spec) => joinGroup(e, groupId, spec)?.id ?? null,
    createRecruit: (structureId, spec) => {
      const st = e.state.structures[structureId];
      if (!st || st.owner === 'neutral') return null;
      const m = placeRecruit(e, st.owner, st.pos, spec);
      if (!m) return null;
      dispatch(e, 'minion:created', { kind: 'structure', id: structureId }, { minionId: m.id });
      return m.id;
    },
    addNovices: (structureId, count, nation) => {
      const st = e.state.structures[structureId];
      if (!st) return;
      const added = Math.max(0, Math.min(count, RULES.maxNovices - st.novices));
      st.novices += added;
      if (nation) st.noviceNations = [...(st.noviceNations ?? []), ...Array<Nation>(added).fill(nation)];
    },
    changeSides: (groupId) => flipGroup(e, groupId),
```
(import `RULES` from './rules'.)

- [ ] **Step 5: Training takes queued nations; capture clears the queue**

`turn.ts` `applyTraining`:
```ts
    st.novices--;
    const queued = st.noviceNations?.shift();
    if (st.noviceNations && st.noviceNations.length > st.novices) st.noviceNations.length = st.novices;
    if (t.as === 'swordsman' || t.as === 'archer') {
      const m = addRecruit(e, side, st.pos, t.as, queued ?? nationOfHouse(s.players[side].house));
```
Wait: the queue shift must happen only when training a recruit; a novice trained as mana must not consume a queued nation but its slot is gone. Write it as: `const queued = (t.as === 'swordsman' || t.as === 'archer') ? st.noviceNations?.shift() : undefined;` then the length clamp. In `beginTurn`'s capture block, add `st.noviceNations = [];` next to `st.novices = 0;`.

`index.ts`: export `type EventContext` already; nothing new.

- [ ] **Step 6: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. If a plan test number is off for an explainable reason (e.g. the sanctum already holds novices), fix the test and report it.
```bash
git add -A
git commit -m "feat(engine): creation API (addMinion, createRecruit, novices, changeSides, spell tokens)"
```

---

### Task 2: Engine hooks (aura, strikes, taunt, initiative, hero rule, off-board events)

**Goal:** The remaining generic hooks the creature cards need.

**Files:**
- Create: `packages/engine/test/hooks.test.ts`
- Modify: `packages/engine/src/{cards,stats,combat,events,turn,ctx,state,types,query,spells,index}.ts`, `packages/cards/src/lang/merge.ts`

**Acceptance Criteria:**
- [ ] A spell whose card has `groupAura: true` and sits on a minion contributes its `stats` to every minion in that minion's group
- [ ] `attacker:strikes` fires before each attack's damage is decided on the attacker's minion; handlers may change `ev.data.damage`; `noDamage` still wins
- [ ] A minion with stat `taunt` is chosen by every enemy that chooses its victim wisely (shooters and unpaired bashers)
- [ ] `initiative:decide` fires after structure deltas at turn start; `ctx.setInitiative(side)` sets it
- [ ] A `hero` card whose id is in `heroesCast` cannot be cast again; a successful hero cast records it
- [ ] Spells hosted on a group or minion that is off the board (`pos === null`) receive no events

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`packages/engine/test/hooks.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight } from '../src/combat';
import { dispatch } from '../src/events';
import { executeCast } from '../src/spells';
import { computeStats } from '../src/stats';
import { beginTurn } from '../src/turn';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, recruitSpec, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const host = (e: ReturnType<typeof blankEngine>, cardId: string, minionId: number, owner: 'red' | 'blue' = 'red') =>
  addSpellRecord(e.state, { cardId, owner, host: { kind: 'minion', id: minionId }, visible: false, turnsLeft: null, tokens: {} });
const dummy = (extra: Partial<MinionSpec['base']> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor: 0, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [], ...extra },
});

describe('groupAura', () => {
  it('applies a minion-hosted spell to its whole group', () => {
    const aura = defineCard({
      id: 'aura', name: 'aura', house: 'war', cost: {}, type: 'alteration', target: 'recruit', groupAura: true,
      stats: (q, id, sp) => (sp.host.kind === 'minion' && sp.host.id === id ? {} : { hand: 1 }),
    });
    const e = blankEngine([aura]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const other = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    host(e, 'aura', g.minionIds[0]);
    expect(computeStats(e, g.minionIds[0]).hand).toBe(2);
    expect(computeStats(e, g.minionIds[1]).hand).toBe(3);
    expect(computeStats(e, other.minionIds[0]).hand).toBe(2);
  });
});

describe('attacker:strikes', () => {
  it('lets a handler change the damage of an attack', () => {
    const boost = defineCard({
      id: 'boost', name: 'boost', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attacker:strikes': (_c, ev) => { ev.data.damage += 5; } },
    });
    const e = blankEngine([boost]);
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    host(e, 'boost', a.minionIds[0]);
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    fight(e, a.id, b.id);
    expect(e.state.minions[v.id].hp).toBe(100 - 9 * 7); // 9 attacks of 2 + 5
  });
});

describe('taunt', () => {
  it('makes shooters pick the taunting minion', () => {
    const decoy = defineCard({ id: 'decoy', name: 'decoy', house: 'war', cost: {}, type: 'alteration', target: 'recruit', stats: () => ({ taunt: true }) });
    const probe = defineCard({
      id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
      on: { 'attacker:strikes': (c, ev) => { c.setToken('victim', ev.data.victimId); } },
    });
    const e = blankEngine([decoy, probe]);
    const shooter = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const sp = host(e, 'probe', shooter.minionIds[0]);
    const foes = put(e, 'blue', { x: 5, y: 4 }, ['swordsman', 'swordsman']);
    host(e, 'decoy', foes.minionIds[1], 'blue');
    fight(e, shooter.id, foes.id);
    expect(sp.tokens.victim).toBe(foes.minionIds[1]);
  });
});

describe('initiative:decide', () => {
  it('lets a spell set the initiative after the structure deltas', () => {
    const lien = defineCard({
      id: 'lien', name: 'lien', house: 'life', cost: {}, type: 'alteration', target: 'globe', visible: false,
      on: { 'initiative:decide': (c) => { if (c.spell.owner !== 'neutral') c.setInitiative(c.spell.owner); } },
    });
    const e = blankEngine([lien]);
    addSpellRecord(e.state, { cardId: 'lien', owner: 'blue', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} });
    expect(e.state.initiative).toBe('red');
    beginTurn(e, false);
    expect(e.state.initiative).toBe('blue');
  });
});

describe('hero once per game', () => {
  it('squanders a second cast of the same hero', () => {
    const hero = defineCard({ id: 'hero1', name: 'Hero', house: 'war', cost: {}, type: 'hero', target: 'globe' });
    const e = blankEngine([hero]);
    expect(executeCast(e, 'red', 'hero1', { kind: 'globe' })).toBe('cast');
    expect(e.state.players.red.heroesCast).toEqual(['hero1']);
    expect(executeCast(e, 'red', 'hero1', { kind: 'globe' })).toBe('squandered');
    expect(executeCast(e, 'blue', 'hero1', { kind: 'globe' })).toBe('cast');
  });
});

describe('off-board groups', () => {
  it('receive no events', () => {
    const tick = defineCard({
      id: 'tick', name: 'tick', house: 'war', cost: {}, type: 'alteration', target: 'recruit', visible: false,
      on: { 'turn:start': (c) => c.setToken('n', c.token('n') + 1) },
    });
    const e = blankEngine([tick]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = host(e, 'tick', g.minionIds[0]);
    dispatch(e, 'turn:start');
    expect(sp.tokens.n).toBe(1);
    e.state.groups[g.id].pos = null;
    dispatch(e, 'turn:start');
    expect(sp.tokens.n).toBe(1);
  });
});
```
(`recruitSpec` import may be unused; remove if lint complains.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`types.ts`: `PlayerState` gets `heroesCast: string[];`. `state.ts` `player()` adds `heroesCast: []`.

`cards.ts`: add to `CardDef`:
```ts
  /** On a minion-hosted spell: `stats` also applies to every other minion in the host minion's group. */
  groupAura?: boolean;
```
`stats.ts`: add `taunt?: boolean` to `StatDelta` and `taunt: boolean` to `Stats` (default `false`, `if (d.taunt) out.taunt = true`). Replace the contribution loop body with a local `add(d)` helper and, after the `refs` loop, add the aura pass:
```ts
  if (g) {
    for (const mid of g.minionIds) {
      if (mid === m.id) continue;
      for (const sp of spellsOn(s, { kind: 'minion', id: mid })) {
        const card = e.cards[sp.cardId];
        if (card?.groupAura) add(card.stats?.(q, minionId, sp));
      }
    }
  }
```
`events.ts`: add `'attacker:strikes'` and `'initiative:decide'` to `EventType`; in `dispatch`'s loop add `if (isOffBoard(s, sp.host)) continue;` (import `isOffBoard` from './query'). `query.ts`:
```ts
/** Spells on a group or minion that is off the board are suspended (rules: time stops off the board). */
export function isOffBoard(s: GameState, ref: Ref): boolean {
  if (ref.kind === 'group') return !!s.groups[ref.id] && s.groups[ref.id].pos === null;
  if (ref.kind === 'minion') {
    const m = s.minions[ref.id];
    return !!m && s.groups[m.groupId]?.pos === null;
  }
  return false;
}
```
`combat.ts`: in `attack`, replace the A2 block (as changed in Task 0) with
```ts
  let dmg = useMissile ? st.missile - (round === 1 ? 1 : 0) : st.hand;
  dmg += nationBonus(m, useMissile, round);
  const strike = { victimId: v.id, kind: useMissile ? 'missile' : 'hand', round, damage: dmg };
  dispatch(e, 'attacker:strikes', { kind: 'minion', id: m.id }, strike);
  dmg = st.noDamage ? 0 : Math.max(0, strike.damage);
```
and at the top of `chooseWisely`, after `foes` is computed and the empty check:
```ts
  const taunter = foes.find((x) => computeStats(e, x.id).taunt);
  if (taunter) return taunter;
```
`turn.ts` `beginTurn`: after `if (delta.red !== delta.blue) s.initiative = ...;` add `dispatch(e, 'initiative:decide');`. `ctx.ts`: add `setInitiative(side: Side): void;` to `EventContext` and `setInitiative: (side) => { e.state.initiative = side; },` to `makeCtx`.
`spells.ts`: at the top of `castCheck` add
```ts
  if (card.type === 'hero' && caster !== 'neutral' && e.state.players[caster].heroesCast.includes(card.id)) return false;
```
and in `executeCast`, right before `s.log.push({ type: 'cast', ... })`:
```ts
  if (card.type === 'hero' && caster !== 'neutral') s.players[caster].heroesCast.push(card.id);
```
`packages/cards/src/lang/merge.ts`: add `taunt: either,` to `STAT_MERGERS` and `groupAura: (vs) => (vs.includes(true) ? true : undefined),` to `MERGERS` (these fail to compile until added; that is the guard working).

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass (hand-computed numbers: if the strike/combat numbers are off by an explainable amount, fix the test and report).
```bash
git add -A
git commit -m "feat(engine): group auras, strike hook, taunt, initiative hook, hero once per game, off-board events"
```

---

### Task 3: Monster support in the engine (home square, bot context, hide and appear)

**Goal:** Groups can be summoned off the board, monster groups remember a home square, bots get a random source and the legal directions, and a spell can hide a group and make it appear.

**Files:**
- Create: `packages/engine/test/monsters.test.ts`
- Modify: `packages/engine/src/{types,units,cards,ctx,movement,index,testing}.ts`

**Acceptance Criteria:**
- [ ] `createGroup` sets `home` to the summon square for monster groups and `null` for recruit groups; `SummonDef.pos` may be `null` (an off-board group)
- [ ] A card's `bot(q, groupId)` receives a `BotContext` with `random()` and `legalDirections(groupId)`; off-board computer groups are skipped by the movement phase
- [ ] `ctx.hide(groupId)` takes a group off the board; `ctx.appear(groupId, pos)` puts it on an empty square without any movement events and returns whether it did; `ctx.setHome(groupId, pos)` moves the home square
- [ ] The cards package can import `step`, `DIR_LIST`, `key`, `isSanctumArea` from `@sanctum/engine`

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/monsters.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { dispatch } from '../src/events';
import { runMovement } from '../src/movement';
import { executeCast } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const spec = (): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'beast',
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const globe = { kind: 'globe' as const };

describe('home square', () => {
  it('is set for monster groups only', () => {
    const e = blankEngine();
    expect(createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer').home).toEqual({ x: 3, y: 3 });
    expect(createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player').home).toBeNull();
    expect(createGroup(e, 'red', null, 'monster', 'computer').pos).toBeNull();
  });
});

describe('bot context', () => {
  it('gives bots random() and legalDirections()', () => {
    const walker = defineCard({
      id: 'walker', name: 'walker', house: 'war', cost: {}, type: 'summoning', target: 'square',
      bot: (q, gid) => (q.random() < 2 && q.legalDirections(gid).includes('e') ? 'e' : null),
    });
    const e = blankEngine([walker]);
    const g = createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer', 'walker');
    spawnMinion(e, g.id, spec());
    const hidden = createGroup(e, 'red', null, 'monster', 'computer', 'walker');
    spawnMinion(e, hidden.id, spec());
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 3 });
    expect(hidden.pos).toBeNull();
  });
});

describe('hide, appear and setHome', () => {
  const probe = (fn: (c: Parameters<NonNullable<ReturnType<typeof defineCard>['onCast']>>[0], gid: number) => void) =>
    defineCard({
      id: 'probe', name: 'probe', house: 'war', cost: {}, type: 'manifestation', target: 'globe',
      onCast: (c) => fn(c, Object.keys(c.state.groups).map(Number)[0]),
    });

  it('hide takes a group off the board and appear brings it back without movement events', () => {
    let appeared: boolean[] = [];
    const e = blankEngine([probe((c, gid) => {
      c.hide(gid);
      appeared.push(c.appear(gid, { x: 5, y: 5 }));
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const watch = defineCard({
      id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', visible: false,
      on: { 'group:enter': (c) => c.setToken('moved', 1) },
    });
    e.cards.watch = watch;
    const sp = addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: globe, visible: false, turnsLeft: null, tokens: {} });
    executeCast(e, 'red', 'probe', globe);
    expect(appeared).toEqual([true]);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    expect(sp.tokens.moved).toBeUndefined();
  });

  it('appear refuses an occupied square', () => {
    let ok: boolean | undefined;
    const e = blankEngine([probe((c, gid) => {
      c.hide(gid);
      ok = c.appear(gid, { x: 6, y: 6 });
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    executeCast(e, 'red', 'probe', globe);
    expect(ok).toBe(false);
    expect(g.pos).toBeNull();
  });

  it('setHome moves the home square', () => {
    const e = blankEngine([probe((c, gid) => c.setHome(gid, { x: 8, y: 8 }))]);
    const g = createGroup(e, 'red', { x: 3, y: 3 }, 'monster', 'computer');
    spawnMinion(e, g.id, spec());
    executeCast(e, 'red', 'probe', globe);
    expect(g.home).toEqual({ x: 8, y: 8 });
  });
});

describe('summon', () => {
  it('can create an off-board group', () => {
    const e = blankEngine([defineCard({
      id: 'sm', name: 'sm', house: 'war', cost: {}, type: 'summoning', target: 'globe',
      onCast: (c) => { c.summon({ pos: null, control: 'computer', minions: [spec()] }); },
    })]);
    executeCast(e, 'red', 'sm', globe);
    const g = Object.values(e.state.groups)[0];
    expect(g.pos).toBeNull();
    expect(g.kind).toBe('monster');
  });
});
```
(`dispatch` import unused; remove it if lint complains. Add `e.cards.watch = watch;` only because `blankEngine` takes cards at construction; alternatively pass `watch` into the `blankEngine([...])` list, which is cleaner: move the `watch` definition above the engine and pass both.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`types.ts`: `Group` gets `/** Monster groups: the centre of the 3x3 territory a Territorial monster keeps to. */ home: Pos | null;`. `SummonDef.pos` becomes `Pos | null`.

`units.ts` `createGroup`: signature `pos: Pos | null`, and the literal gets
```ts
    pos: pos ? { ...pos } : null,
    home: kind === 'monster' && pos ? { ...pos } : null,
```
(replace the existing `pos: { ...pos }`).

`ctx.ts`: add
```ts
/** What a card's `bot` sees: the query view plus a random source and the legal steps of a group. */
export interface BotContext extends QueryContext {
  random(): number;
  legalDirections(groupId: number): Dir[];
}

function legalDirs(e: Engine, id: number): Dir[] {
  const g = e.state.groups[id];
  if (!g || !g.pos) return [];
  const from = g.pos;
  return DIR_LIST.filter((d) => canEnterSquare(e, g, step(from, d)));
}

export function makeBotContext(e: Engine, owner: PlayerId): BotContext {
  return { ...makeQuery(e, owner), random: () => nextRandom(e.state), legalDirections: (id) => legalDirs(e, id) };
}
```
Make `makeCtx`'s `legalDirections` use `legalDirs(e, id)`. Add to `EventContext`:
```ts
  /** The group leaves the board ("disappears"). Its spells are suspended until it appears again. */
  hide(groupId: number): void;
  /** An off-board group appears on an empty square, not by moving: no movement events. Returns whether it did. */
  appear(groupId: number, pos: Pos): boolean;
  /** Sets a monster group's home square. */
  setHome(groupId: number, pos: Pos): void;
```
and implementations in `makeCtx`:
```ts
    hide: (id) => {
      const g = e.state.groups[id];
      if (!g || !g.pos) return;
      const from = g.pos;
      g.pos = null;
      g.moveOrder = null;
      recheckSquare(e, from);
    },
    appear: (id, pos) => {
      const s = e.state;
      const g = s.groups[id];
      if (!g || g.pos !== null || !s.cells.includes(key(pos)) || groupAt(s, pos) || structureAt(s, pos)) return false;
      g.pos = { ...pos };
      checkFatal(e, g);
      recheckSquare(e, pos);
      return true;
    },
    setHome: (id, pos) => {
      const g = e.state.groups[id];
      if (g) g.home = { ...pos };
    },
```
`cards.ts`: `bot?: (q: BotContext, groupId: number) => Dir | null;` (import `BotContext` from './ctx').
`movement.ts`: `botMove` uses `makeBotContext(e, g.owner)`; in `runMovement`: `if (g.control === 'computer' && g.pos) g.moveOrder = botMove(e, g);`.
`index.ts`: `export type { BotContext, EventContext, QueryContext } from './ctx';` and extend the board export: `export { createCells, SANCTUM_POS, sanctumSquares, entrances, step, DIR_LIST, key, isSanctumArea } from './board';`.

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(engine): monster home square, bot context, hide and appear for off-board groups"
```

---

### Task 4: The creature layer of the keyword language

**Goal:** `Monster`, `Create`, `Hero`, `Ambush`, `Territorial`/`Nomadic`/`Immobile`, `Against`, `Immune`, `Taunt`, `Aura`, the `Novices` effect, `Terraform(..., 'aroundGroup')`, `When.moves`, and `Target.in(...)`.

**Files:**
- Create: `packages/cards/src/lang/keywords/{creature,behavior,versus}.ts`, `packages/cards/test/lang-creature.test.ts`
- Modify: `packages/cards/src/lang/{types,card,hosts,target,effects,triggers,index}.ts`, `packages/cards/src/lang/keywords/statics.ts`

**Acceptance Criteria:**
- [ ] `host: 'minion'` on a card input tells keyword validation the spell sits on minions (a monster card has a square target); `Monster` without it throws
- [ ] `Monster` summons a computer-controlled group (owner caster, or neutral) on the target square and puts a non-visible spell of the same card on each minion
- [ ] `Create` makes recruits in a structure or group (helper spells, full heal, random nations, one-per-group); `Hero` demands spell type `hero`
- [ ] `Ambush` summons an off-board group, makes it appear before combat next to a non-friendly group on allowed terrain (optionally changing that square's terrain), hides it after all combat, and dispels itself when the group is killed
- [ ] `Territorial`, `Nomadic`, `Immobile` give monsters the AI of plan decision 5; a Territorial monster forced out of its territory gets a new home
- [ ] `Against` adds damage against victims of given houses; `Immune` blocks individual spells of given houses on the host; `Taunt` sets the stat; `Aura` is a group aura
- [ ] Every new keyword and effect has a glossary entry and prints text

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/lang-creature.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, runMovement, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import {
  Aura, Against, Ambush, card, Create, creatureSpec, faceOf, Grant, Hero, Immobile, Immune, Monster, Nomadic, Novices,
  On, OnCast, resetCards, statLine, Taunt, Target, Terraform, Territorial, When,
} from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

beforeEach(() => resetCards());
const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const dummy = (over: Partial<MinionSpec> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'x', ...over,
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const monster = (id: string, ...kw: Parameters<typeof card>[0]['keywords']) =>
  card({
    id, name: id, house: 'war', cost: {}, type: 'summoning', host: 'minion', target: Target.square,
    keywords: [...kw, Monster({ name: id, cls: 'monster', hand: 2, hp: 9 })],
  });

describe('creature definitions', () => {
  it('builds monster and recruit specs and prints their stat lines', () => {
    const dragon = creatureSpec({ name: 'Dragon', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 2, walks: ['flight'] }, 'war');
    expect(dragon).toMatchObject({ kind: 'monster', cls: 'monster', house: 'war' });
    expect(dragon.base).toMatchObject({ hand: 4, handAttacks: 1, hp: 16 });
    expect(statLine(dragon)).toBe('H:4 A:1 HP:16 L:2, Flight');
    const sylph = creatureSpec({ name: 'Sylph', cls: 'monster', missile: 3, missileAttacks: 2, hp: 15 }, 'life');
    expect(statLine(sylph)).toBe('M:3(x2) A:0 HP:15 L:1');
    const bard = creatureSpec({ name: 'Bard', cls: 'swordsman', nation: 'elf', hand: 0, armor: 3 }, 'life');
    expect(bard).toMatchObject({ kind: 'recruit', cls: 'swordsman', nation: 'elf', house: 'life' });
    expect(bard.base).toMatchObject({ hand: 0, handAttacks: 0, armor: 3, hp: 7 });
    expect(statLine(bard)).toBe('H:0 A:3 HP:7 L:1');
  });
});

describe('Monster', () => {
  it('summons a computer group with a hidden spell on each minion', () => {
    const e = mini([monster('grub', Territorial())]);
    expect(castMini(e, 'red', 'grub', sq(5, 5))).toBe('cast');
    const g = Object.values(e.state.groups)[0];
    expect(g).toMatchObject({ kind: 'monster', owner: 'red', control: 'computer', home: { x: 5, y: 5 }, botId: 'grub' });
    const m = e.state.minions[g.minionIds[0]];
    expect(m).toMatchObject({ name: 'grub', house: 'war', kind: 'monster' });
    expect(e.state.spells).toHaveLength(1);
    expect(e.state.spells[0]).toMatchObject({ cardId: 'grub', visible: false, owner: 'red', host: { kind: 'minion', id: m.id } });
    expect(faceOf('grub')!.lines).toEqual(['Square.', 'Territorial.', 'Summon grub (H:2 A:0 HP:9 L:1).']);
  });

  it('can be neutral, and needs host: minion', () => {
    const e = mini([card({
      id: 'neu', name: 'neu', house: 'war', cost: {}, type: 'summoning', host: 'minion', target: Target.square,
      keywords: [Monster({ name: 'neu', cls: 'monster', hand: 1, hp: 3 }, { neutral: true })],
    })]);
    castMini(e, 'red', 'neu', sq(5, 5));
    expect(Object.values(e.state.groups)[0].owner).toBe('neutral');
    expect(e.state.spells[0].owner).toBe('neutral');
    expect(() => card({
      id: 'bad', name: 'bad', house: 'war', cost: {}, type: 'summoning', target: Target.square,
      keywords: [Monster({ name: 'bad', cls: 'monster', hp: 3 })],
    })).toThrow(/Monster needs/);
  });
});

describe('Create and Hero', () => {
  it('creates a recruit in a structure, applies helpers and heals it', () => {
    const e = mini([
      card({ id: 'vet', name: 'Vet', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Grant({ maxHp: 4 })] }),
      card({
        id: 'chief', name: 'Chief', house: 'war', cost: {}, type: 'summoning', target: Target.structure.friendly,
        keywords: [Create({ name: 'Chief', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['vet'] })],
      }),
    ]);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'chief', { kind: 'structure', id: 900 })).toBe('cast');
    const m = Object.values(e.state.minions)[0];
    expect(m).toMatchObject({ name: 'Chief', nation: 'human', house: 'war', hp: 11, maxHp: 11, owner: 'red' });
    expect(m.base.level).toBe(2);
    expect(e.state.spells).toHaveLength(1);
    expect(faceOf('chief')!.lines[1]).toBe('Create Chief (H:2 A:1 HP:7 L:2) with Vet (+4 HP).');
  });

  it('joins a group, once per group, and can make several recruits of random nations', () => {
    const e = mini([
      card({ id: 'guard', name: 'Guard', house: 'war', cost: {}, type: 'summoning', target: Target.recruitGroup,
        keywords: [Create({ name: 'Guard', cls: 'swordsman' }, { onePerGroup: true })] }),
      card({ id: 'teeth', name: 'Teeth', house: 'war', cost: {}, type: 'summoning', target: Target.structure.friendly,
        keywords: [Create({ name: 'swordsman', cls: 'swordsman' }, { count: 2, randomNation: true })] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'guard', { kind: 'group', id: g.id })).toBe('cast');
    expect(g.minionIds).toHaveLength(2);
    expect(castMini(e, 'red', 'guard', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.structures[900] = town(900, 'red', 7, 2);
    expect(castMini(e, 'red', 'teeth', { kind: 'structure', id: 900 })).toBe('cast');
    const made = Object.values(e.state.minions).filter((m) => m.name === 'swordsman');
    expect(made).toHaveLength(2);
    expect(made.every((m) => m.nation !== null)).toBe(true);
  });

  it('Hero needs spell type hero', () => {
    expect(() => card({ id: 'h', name: 'h', house: 'war', cost: {}, type: 'manifestation', target: Target.globe, keywords: [Hero()] })).toThrow(/Hero needs/);
    card({ id: 'h2', name: 'h2', house: 'war', cost: {}, type: 'hero', target: Target.structure, keywords: [Hero()] });
    expect(faceOf('h2')!.lines).toEqual(['Town or colony.', 'Hero.']);
  });
});

describe('behaviours', () => {
  it('Territorial hunts within 2 squares of home, stays in its territory and re-homes when forced out', () => {
    const e = mini([monster('terr', Territorial())]);
    castMini(e, 'red', 'terr', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    const foe = put(e, 'blue', { x: 5, y: 9 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    foe.pos = { x: 5, y: 7 };
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 6 });
    expect(g.home).toEqual({ x: 5, y: 5 });
    g.pos = { x: 5, y: 8 };
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 5, y: 6 }, to: { x: 5, y: 8 } });
    expect(g.home).toEqual({ x: 5, y: 8 });
  });

  it('Nomadic hunts anywhere and roams when alone', () => {
    const e = mini([monster('nom', Nomadic())]);
    castMini(e, 'red', 'nom', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    const foe = put(e, 'blue', { x: 9, y: 9 }, ['swordsman']);
    runMovement(e);
    expect(Math.abs(g.pos!.x - 9) + Math.abs(g.pos!.y - 9)).toBe(7);
    foe.pos = null;
    const at = { ...g.pos! };
    runMovement(e);
    expect(g.pos).not.toEqual(at);
  });

  it('Immobile never moves, whatever the order', () => {
    const e = mini([monster('imm', Immobile())]);
    castMini(e, 'red', 'imm', sq(5, 5));
    const g = Object.values(e.state.groups)[0];
    g.moveOrder = 'e';
    put(e, 'blue', { x: 5, y: 7 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
  });
});

describe('Against, Immune, Taunt, Aura', () => {
  it('Against adds hand damage versus a house, monsters only when asked', () => {
    const e = mini([monster('serp', Against(['death', 'despair'], { hand: 4, monstersOnly: true }))]);
    castMini(e, 'red', 'serp', sq(5, 5));
    const me = Object.values(e.state.minions)[0].id;
    const foe = createGroup(e, 'blue', { x: 6, y: 5 }, 'monster', 'computer');
    const dead = spawnMinion(e, foe.id, dummy({ house: 'death' }));
    const recruit = put(e, 'blue', { x: 7, y: 5 }, ['swordsman']);
    const strike = (victimId: number, kind = 'hand') =>
      dispatch(e, 'attacker:strikes', { kind: 'minion', id: me }, { victimId, kind, round: 2, damage: 2 }).data.damage;
    expect(strike(dead.id)).toBe(6);
    expect(strike(dead.id, 'missile')).toBe(2);
    expect(strike(recruit.minionIds[0])).toBe(2);
    expect(faceOf('serp')!.lines).toContain('+4 H against Death or Despair monsters.');
  });

  it('Immune blocks individual spells of those houses on the host only', () => {
    const e = mini([
      monster('shield', Immune(['death'])),
      card({ id: 'dprobe', name: 'd', house: 'death', cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] }),
      card({ id: 'wprobe', name: 'w', house: 'war', cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] }),
    ]);
    castMini(e, 'red', 'shield', sq(5, 5));
    const me = Object.values(e.state.minions)[0].id;
    expect(castMini(e, 'blue', 'dprobe', { kind: 'minion', id: me })).toBe('squandered');
    expect(castMini(e, 'blue', 'wprobe', { kind: 'minion', id: me })).toBe('cast');
  });

  it('Taunt sets the stat and Aura is a group aura with a different bonus for the host', () => {
    const e = mini([
      card({ id: 'ruse', name: 'Ruse', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit, keywords: [Taunt()] }),
      card({ id: 'cmd', name: 'Command', house: 'war', cost: {}, type: 'alteration', helper: true, target: Target.recruit,
        keywords: [Aura({ hand: 1 }, { to: 'swordsmen', self: { hand: 3 } })] }),
    ]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer']);
    const [a, b, c] = g.minionIds;
    e.state.spells.push(
      { id: 800, cardId: 'ruse', owner: 'red', host: { kind: 'minion', id: a }, visible: false, turnsLeft: null, tokens: {} },
      { id: 801, cardId: 'cmd', owner: 'red', host: { kind: 'minion', id: a }, visible: false, turnsLeft: null, tokens: {} },
    );
    expect(computeStats(e, a).taunt).toBe(true);
    expect(computeStats(e, b).taunt).toBe(false);
    expect(computeStats(e, a).hand).toBe(5);
    expect(computeStats(e, b).hand).toBe(3);
    expect(computeStats(e, c).hand).toBe(0);
    expect(faceOf('cmd')!.lines).toEqual(['Recruit.', 'Group aura: swordsmen +1 H; this minion +3 H.']);
    expect(faceOf('ruse')!.lines).toEqual(['Recruit.', 'Taunt.']);
  });
});

describe('Ambush', () => {
  const amb = () =>
    card({
      id: 'amb', name: 'Amb', house: 'life', cost: {}, type: 'summoning', host: 'minion', target: Target.globe,
      keywords: [Ambush({ name: 'Wisp', cls: 'monster', hand: 3, hp: 7 }, { terrain: ['forest'], next: 'recruit', becomes: 'lava' })],
    });

  it('appears before combat next to a non-friendly recruit group, hides after, and ends when killed', () => {
    const e = mini([amb()]);
    e.state.terrain['5,4'] = 'forest';
    castMini(e, 'red', 'amb', { kind: 'globe' });
    const hopper = Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
    expect(hopper.pos).toBeNull();
    expect(e.state.spells).toHaveLength(2); // one on the minion, one controller on the globe
    put(e, 'red', { x: 5, y: 3 }, ['swordsman']); // friendly: not a victim
    dispatch(e, 'combat:before');
    expect(hopper.pos).toBeNull();
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(hopper.pos).toEqual({ x: 5, y: 4 });
    expect(e.state.terrain['5,4']).toBe('lava');
    dispatch(e, 'turn:afterCombat');
    expect(hopper.pos).toBeNull();
    e.state.minions[hopper.minionIds[0]].status = 'dead';
    dispatch(e, 'minion:dies', { kind: 'minion', id: hopper.minionIds[0] }, {});
    expect(e.state.spells.filter((s) => s.host.kind === 'globe')).toHaveLength(0);
    expect(faceOf('amb')!.lines[1]).toContain('Summon Wisp (H:3 A:0 HP:7 L:1) off the board.');
  });
});

describe('target, effects and triggers', () => {
  it('Target.in needs the target to stand on that terrain', () => {
    const e = mini([card({ id: 'forestcast', name: 'f', house: 'life', cost: {}, type: 'manifestation', target: Target.recruitGroup.in('forest'), keywords: [] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'forestcast', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.terrain['4,4'] = 'forest';
    expect(castMini(e, 'red', 'forestcast', { kind: 'group', id: g.id })).toBe('cast');
    expect(faceOf('forestcast')!.lines[0]).toBe('Recruit group in forest.');
    expect(() => Target.square.in('forest')).toThrow();
  });

  it('Novices adds novices to the target structure', () => {
    const e = mini([card({ id: 'allies', name: 'a', house: 'life', cost: {}, type: 'manifestation', target: Target.structure.friendly, keywords: [OnCast(Novices(2, 'elf'))] })]);
    e.state.structures[900] = town(900, 'red', 6, 6);
    castMini(e, 'red', 'allies', { kind: 'structure', id: 900 });
    expect(e.state.structures[900].novices).toBe(2);
    expect(e.state.structures[900].noviceNations).toEqual(['elf', 'elf']);
    expect(faceOf('allies')!.lines[1]).toBe('Create 2 Elf novices in the town.');
  });

  it('Terraform aroundGroup and When.moves work for a minion host', () => {
    const e = mini([card({
      id: 'blight', name: 'Blight', house: 'war', cost: {}, type: 'alteration', target: Target.recruit,
      keywords: [On(When.beforeMovement, Terraform('barren', 'aroundGroup')), On(When.moves, Terraform('barren', 'aroundGroup'))],
    })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'blight', { kind: 'minion', id: g.minionIds[0] });
    dispatch(e, 'movement:before');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    g.pos = { x: 6, y: 6 };
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 4, y: 4 }, to: { x: 6, y: 6 } });
    expect(e.state.terrain['7,6']).toBe('barren');
    expect(faceOf('blight')!.lines).toEqual([
      'Recruit.', 'Before movement: Squares next to its group become barren.', 'After it moves: Squares next to its group become barren.',
    ]);
  });
});
```
(If the Ambush face index in the last assertion differs because the renderer orders lines differently, assert with `toContain` on the whole `lines` array instead.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Core type, host and target changes**

`src/lang/types.ts`: add `export type HostKind = 'group' | 'minion' | 'globe';`; `TargetSpec` gets `/** Group or single-minion targets: the target's square must have one of these terrains. */ in?: TerrainId[];`; `CompileCtx` gets `house: HouseId; /** Where the spell sits when it differs from the target: summoned creatures carry it on their minions. */ host?: HostKind;`; `CardSpec` gets `host?: HostKind;`.

`src/lang/hosts.ts`: replace the local `HostKind` with `import type { CompileCtx, HostKind } from './types'; export type { HostKind };` and make the check
```ts
export function requireHost(ctx: CompileCtx, host: HostKind, what: string): void {
  const ok = ctx.host ? ctx.host === host : ACCEPTS[host](ctx.target.type);
  if (!ok) throw new Error(`card "${ctx.cardId}": ${what} needs ${NOUN[host]}, not "${ctx.host ?? ctx.target.type}"`);
}
```
`src/lang/card.ts`: `CardInput` gets `host?: HostKind` (import the type), copy it into the spec (`host: input.host`), and `ctxOf` returns `{ target: spec.target, type: spec.type, cardId: spec.id, index, house: spec.house, host: spec.host }`.

`src/lang/target.ts`: add the builder method
```ts
  /** Group or single-minion targets: the target must stand on one of these terrains. */
  in(...terrain: TerrainId[]): TargetBuilder {
    if (['square', 'globe', 'structure'].includes(this.spec.type)) throw new Error(`Target: .in(terrain) needs a group or minion target, not "${this.spec.type}"`);
    return new TargetBuilder({ ...this.spec, in: terrain });
  }
```
In `targetFragment` add
```ts
  if (t.in) {
    checks.push((q, r) => {
      const g = r.kind === 'group' ? q.group(r.id) : r.kind === 'minion' ? q.group(q.minion(r.id)?.groupId ?? -1) : undefined;
      return !!g?.pos && t.in!.includes(q.terrainAt(g.pos) as TerrainId);
    });
  }
```
and in `printTarget`, right after the `with` line: `if (t.in) noun += \` in ${t.in.join(' or ')}\`;` (use a normal template string).

`src/lang/keywords/statics.ts`: change `function appliesTo` and `function toDelta` to `export function`.

- [ ] **Step 4: Effects and triggers**

`src/lang/effects.ts`: import `Nation` type from `@sanctum/engine` and `hostGroupId` from './scopes'. Extend the union with `| { kind: 'novices'; count: number; nation?: Nation }` and make the terraform `area` `'target' | 'adjacent' | 'contiguous' | 'aroundGroup'`. Add `export const Novices = (count: number, nation?: Nation): Effect => ({ kind: 'novices', count, nation });` and widen `Terraform`'s `area` parameter type the same way. In `runEffect`'s terraform branch add before the final `else if`:
```ts
      } else if (e.area === 'aroundGroup') {
        const gid = hostGroupId(c);
        const g = gid === undefined ? undefined : c.group(gid);
        if (g?.pos) for (const d of ADJACENT) c.setTerrain({ x: g.pos.x + d.x, y: g.pos.y + d.y }, e.terrain);
```
and a `case 'novices': if (target?.kind === 'structure') c.addNovices(target.id, e.count, e.nation); return;`. In `printEffect`: terraform `aroundGroup` -> `` `Squares next to its group become ${e.terrain}` ``; `case 'novices': return \`Create ${e.count} ${e.nation ? cap(e.nation) + ' ' : ''}novices in the town\`;`. In `VERBS` add `novices: { term: 'Create novices', gloss: 'Novices are added to the structure (at most 8 there). Trained as recruits, queued novices are of the named nation.' },`.

`src/lang/triggers.ts`: add `| { when: 'moves' }` to the union, `moves: { when: 'moves' } as Trigger,` to `When`, `case 'moves': return 'group:move';` in `triggerEvent`, `case 'moves': return 'After it moves';` in `triggerLabel`, and `case 'moves': return groupMatches(c, ev);` in `triggerApplies`.

- [ ] **Step 5: `creature.ts`**

`src/lang/keywords/creature.ts`:
```ts
import { DIR_LIST, isSanctumArea, key, NATION_LIST, RULES, recruitSpec, step } from '@sanctum/engine';
import type { HouseId, MinionSpec, Nation, Pos, TerrainId, Walk } from '@sanctum/engine';
import { requireHost } from '../hosts';
import { defineKeyword } from '../registry';
import { helperSummary } from '../render';
import type { Keyword } from '../types';

/** A creature as a card describes it. Monsters and recruits share the shape. */
export interface CreatureDef {
  name: string;
  cls: 'swordsman' | 'archer' | 'monster';
  hand?: number;
  handAttacks?: number;
  missile?: number;
  missileAttacks?: number;
  armor?: number;
  hp?: number;
  level?: number;
  nation?: Nation;
  walks?: Walk[];
}

/** The minion this definition creates. Recruits start from the class base (and nation); monsters from zero. */
export function creatureSpec(def: CreatureDef, house: HouseId, nation: Nation | undefined = def.nation): MinionSpec {
  if (def.cls === 'monster') {
    const hand = def.hand ?? 0;
    const missile = def.missile ?? 0;
    return {
      kind: 'monster', cls: 'monster', name: def.name, house,
      base: {
        hp: def.hp ?? 7, level: def.level ?? 1, armor: def.armor ?? 0, hand, handAttacks: def.handAttacks ?? (hand > 0 ? 1 : 0),
        missile, missileAttacks: def.missileAttacks ?? (missile > 0 ? 1 : 0), walks: [...(def.walks ?? [])],
      },
    };
  }
  const spec = recruitSpec(def.cls, nation);
  const b = spec.base;
  const hand = def.hand ?? b.hand;
  const missile = def.missile ?? b.missile;
  spec.name = def.name;
  spec.base = {
    ...b, hp: def.hp ?? b.hp, level: def.level ?? b.level, armor: def.armor ?? b.armor, hand, missile,
    handAttacks: def.handAttacks ?? (def.hand === undefined ? b.handAttacks : hand > 0 ? 1 : 0),
    missileAttacks: def.missileAttacks ?? (def.missile === undefined ? b.missileAttacks : missile > 0 ? 1 : 0),
    walks: [...b.walks, ...(def.walks ?? [])],
  };
  return spec;
}

const WALK_NAME: Record<Walk, string> = { flight: 'Flight', fire: 'Firewalk', water: 'Waterwalk', mountain: 'Mountainwalk', desert: 'Desertwalk' };

/** "H:4 A:1 HP:16 L:2, Flight": the printed stat line (xN = N attacks per round). */
export function statLine(spec: MinionSpec): string {
  const b = spec.base;
  const atk = (label: string, dmg: number, n: number) => `${label}:${dmg}${n > 1 ? `(x${n})` : ''}`;
  const parts: string[] = [];
  if (b.missile > 0 || b.missileAttacks > 0) parts.push(atk('M', b.missile, b.missileAttacks));
  if (b.hand > 0 || b.handAttacks > 0 || parts.length === 0) parts.push(atk('H', b.hand, b.handAttacks));
  parts.push(`A:${b.armor}`, `HP:${b.hp}`, `L:${b.level}`);
  return [parts.join(' '), ...b.walks.map((w) => WALK_NAME[w])].join(', ');
}

const lineOf = (def: CreatureDef) => statLine(creatureSpec(def, 'war'));

/* ---------- Monster ---------- */

export interface MonsterKeyword extends Keyword {
  kind: 'monster';
  def: CreatureDef;
  neutral: boolean;
}
/** Summons a monster group on the target square, computer-controlled; `neutral` makes it belong to nobody. */
export const Monster = (def: CreatureDef, opts: { neutral?: boolean } = {}): MonsterKeyword => ({ kind: 'monster', def, neutral: opts.neutral ?? false });

defineKeyword<MonsterKeyword>({
  kind: 'monster', term: 'Monster', tier: 'core',
  gloss: 'Summons a computer-controlled monster on the target square. Stat line: H hand damage, M missile damage (xN = N attacks), A armor, HP hit points, L level. Monsters never join groups or enter structures, and take the same terrain effects as recruits unless they walk it.',
  print: (k) => ({ layout: 'line', section: 'effect', text: `Summon ${k.neutral ? 'neutral ' : ''}${k.def.name} (${lineOf(k.def)}).` }),
  compile: (k, ctx) => {
    if (ctx.target.type !== 'square') throw new Error(`card "${ctx.cardId}": Monster needs a square target`);
    return {
      visible: false,
      onCast: (c, t) => {
        if (t.kind !== 'square') return;
        const owner = k.neutral ? 'neutral' : c.spell.owner;
        const gid = c.summon({ owner, pos: t.pos, control: 'computer', minions: [creatureSpec(k.def, ctx.house)] });
        for (const mid of c.group(gid)!.minionIds) c.createSpell(ctx.cardId, { kind: 'minion', id: mid }, { owner });
      },
    };
  },
  validate: (_k, _m, ctx) => requireHost(ctx, 'minion', 'Monster'),
});

/* ---------- Create ---------- */

export interface CreateKeyword extends Keyword {
  kind: 'create';
  def: CreatureDef;
  count: number;
  randomNation: boolean;
  withSpells: string[];
  onePerGroup: boolean;
}
/**
 * Creates recruits in the target structure (a new recruit there) or target group (joins it). Helper spells in `with`
 * are cast on each new minion, and it ends at full health.
 */
export const Create = (
  def: CreatureDef,
  opts: { count?: number; randomNation?: boolean; with?: string[]; onePerGroup?: boolean } = {},
): CreateKeyword => ({
  kind: 'create', def, count: opts.count ?? 1, randomNation: opts.randomNation ?? false,
  withSpells: opts.with ?? [], onePerGroup: opts.onePerGroup ?? false,
});

defineKeyword<CreateKeyword>({
  kind: 'create', term: 'Create', tier: 'core',
  gloss: 'Creates recruits where the spell is cast: a structure makes a new recruit there, a group gains a member. They start at full health with the named helper spells. If there is no room, the spell squanders.',
  print: (k) => {
    const many = k.count > 1 ? `${k.count} ` : '';
    const stats = lineOf(k.def) + (k.randomNation ? ', random nations' : '');
    const helpers = k.withSpells.length ? ` with ${k.withSpells.map(helperSummary).join(' and ')}` : '';
    return { layout: 'line', section: 'effect', text: `Create ${many}${k.def.name}${k.count > 1 ? 's' : ''} (${stats})${helpers}.` };
  },
  compile: (k, ctx) => ({
    canCast: (q, t) => {
      if (t.kind === 'structure') {
        const st = q.structure(t.id);
        if (!st) return false;
        const g = q.groupAt(st.pos);
        return !g || (g.owner === st.owner && g.kind === 'recruit' && g.control === 'player' && g.minionIds.length + k.count <= RULES.maxGroup);
      }
      if (t.kind === 'group') {
        const g = q.group(t.id);
        if (!g || g.minionIds.length + k.count > RULES.maxGroup) return false;
        return !k.onePerGroup || !q.minionsOf(t.id).some((m) => m.name === k.def.name);
      }
      return false;
    },
    onCast: (c, t) => {
      for (let i = 0; i < k.count; i++) {
        const nation = k.randomNation ? NATION_LIST[Math.floor(c.random() * NATION_LIST.length)] : k.def.nation;
        const spec = creatureSpec(k.def, ctx.house, nation);
        const id = t.kind === 'structure' ? c.createRecruit(t.id, spec) : t.kind === 'group' ? c.addMinion(t.id, spec) : null;
        if (id === null) continue;
        for (const h of k.withSpells) c.createSpell(h, { kind: 'minion', id });
        c.heal(id, 999);
      }
    },
  }),
  validate: (_k, _m, ctx) => {
    if (!['structure', 'recruitGroup', 'group'].includes(ctx.target.type)) {
      throw new Error(`card "${ctx.cardId}": Create needs a structure or group target, not "${ctx.target.type}"`);
    }
  },
});

/* ---------- Hero ---------- */

export interface HeroKeyword extends Keyword {
  kind: 'hero';
}
/** Marks a hero card: each Hero may be cast only once per game (enforced by the engine for spell type `hero`). */
export const Hero = (): HeroKeyword => ({ kind: 'hero' });

defineKeyword<HeroKeyword>({
  kind: 'hero', term: 'Hero', tier: 'house',
  gloss: 'Each Hero may be cast only once per game. A Hero is a named level 2 recruit.',
  print: () => ({ layout: 'inline', text: 'Hero' }),
  compile: () => ({}),
  validate: (_k, _m, ctx) => {
    if (ctx.type !== 'hero') throw new Error(`card "${ctx.cardId}": Hero needs spell type 'hero'`);
  },
});

/* ---------- Ambush (combat-hopper) ---------- */

export interface AmbushKeyword extends Keyword {
  kind: 'ambush';
  def: CreatureDef;
  terrain: TerrainId[];
  next: 'recruit' | 'any';
  becomes?: TerrainId;
  count: number;
}
/**
 * A combat-hopper: summoned off the board. Before combat it appears on an empty square of the given terrain next to a
 * non-friendly group; after all combat it disappears; it is dispelled when killed.
 */
export const Ambush = (
  def: CreatureDef,
  opts: { terrain: TerrainId[]; next?: 'recruit' | 'any'; becomes?: TerrainId; count?: number },
): AmbushKeyword => ({ kind: 'ambush', def, terrain: opts.terrain, next: opts.next ?? 'recruit', becomes: opts.becomes, count: opts.count ?? 1 });

defineKeyword<AmbushKeyword>({
  kind: 'ambush', term: 'Ambush', tier: 'house',
  gloss: 'A combat-hopper: it waits off the board, appears before combat in an eligible square next to a non-friendly group, and disappears again after all combat. It is dispelled when killed.',
  print: (k) => ({
    layout: 'line', section: 'effect',
    text: `Summon ${k.count > 1 ? `${k.count} ` : ''}${k.def.name} (${lineOf(k.def)}) off the board. Before combat it appears in ${k.terrain.join(' or ')} next to a non-friendly ${k.next === 'recruit' ? 'recruit group' : 'group'}${k.becomes ? `, and its square becomes ${k.becomes}` : ''}. After all combat it disappears. Dispelled when killed.`,
  }),
  compile: (k, ctx) => {
    if (ctx.target.type !== 'globe') throw new Error(`card "${ctx.cardId}": Ambush needs the globe as its target`);
    return {
      visible: false,
      onCast: (c) => {
        const gid = c.summon({ pos: null, control: 'computer', minions: Array.from({ length: k.count }, () => creatureSpec(k.def, ctx.house)) });
        for (const mid of c.group(gid)!.minionIds) c.createSpell(ctx.cardId, { kind: 'minion', id: mid });
        c.createSpell(ctx.cardId, { kind: 'globe' }, { tokens: { gid } });
      },
      on: {
        'combat:before': (c) => {
          if (c.host.kind !== 'globe') return;
          const gid = c.token('gid');
          const g = c.group(gid);
          if (!g || g.pos) return;
          const spots: Pos[] = [];
          for (const o of Object.values(c.state.groups)) {
            if (!o.pos || o.owner === c.spell.owner || (k.next === 'recruit' && o.kind !== 'recruit')) continue;
            for (const d of DIR_LIST) {
              const p = step(o.pos, d);
              if (!c.state.cells.includes(key(p)) || isSanctumArea(p) || c.groupAt(p) || c.structureAt(p)) continue;
              if (!k.terrain.includes(c.terrainAt(p) as TerrainId)) continue;
              if (!spots.some((s) => s.x === p.x && s.y === p.y)) spots.push(p);
            }
          }
          if (!spots.length) return;
          const p = spots[Math.floor(c.random() * spots.length)];
          if (c.appear(gid, p) && k.becomes) c.setTerrain(p, k.becomes);
        },
        'turn:afterCombat': (c) => {
          if (c.host.kind === 'globe') c.hide(c.token('gid'));
        },
        'minion:dies': (c, ev) => {
          if (c.host.kind !== 'globe' || ev.ref?.kind !== 'minion') return;
          const gid = c.token('gid');
          if (c.state.minions[ev.ref.id]?.groupId === gid && c.minionsOf(gid).length === 0) c.dispel();
        },
      },
    };
  },
  validate: (_k, _m, ctx) => requireHost(ctx, 'minion', 'Ambush'),
});
```

- [ ] **Step 6: `behavior.ts`**

`src/lang/keywords/behavior.ts`:
```ts
import { step } from '@sanctum/engine';
import type { BotContext, Dir, Pos } from '@sanctum/engine';
import { defineKeyword } from '../registry';
import { hostGroupId } from '../scopes';
import type { Keyword } from '../types';

const manhattan = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const chebyshev = (a: Pos, b: Pos) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

/** Nearest hostile recruit group (optionally only those `within` accepts), as a position. */
function nearestFoe(q: BotContext, gid: number, within?: (p: Pos) => boolean): Pos | null {
  const g = q.group(gid);
  if (!g?.pos) return null;
  let best: Pos | null = null;
  let bestD = Infinity;
  for (const o of Object.values(q.state.groups)) {
    if (!o.pos || o.kind !== 'recruit' || !q.hostile(g, o) || (within && !within(o.pos))) continue;
    const d = manhattan(g.pos, o.pos);
    if (d < bestD) {
      bestD = d;
      best = o.pos;
    }
  }
  return best;
}

/** One step that closes the distance (never onto the foe: combat happens between adjacent groups). */
function stepToward(q: BotContext, gid: number, target: Pos, allowed?: (p: Pos) => boolean): Dir | null {
  const from = q.group(gid)!.pos!;
  if (manhattan(from, target) <= 1) return null;
  const options = q.legalDirections(gid).filter((d) => {
    const p = step(from, d);
    return manhattan(p, target) < manhattan(from, target) && (!allowed || allowed(p));
  });
  return options.length ? options[Math.floor(q.random() * options.length)] : null;
}

export function territorialBot(q: BotContext, gid: number): Dir | null {
  const g = q.group(gid);
  const home = g?.home ?? g?.pos;
  if (!g || !home) return null;
  const foe = nearestFoe(q, gid, (p) => chebyshev(p, home) <= 2);
  return foe ? stepToward(q, gid, foe, (p) => chebyshev(p, home) <= 1) : null;
}

export function nomadicBot(q: BotContext, gid: number): Dir | null {
  const foe = nearestFoe(q, gid);
  if (foe) return stepToward(q, gid, foe);
  const dirs = q.legalDirections(gid);
  return dirs.length ? dirs[Math.floor(q.random() * dirs.length)] : null;
}

export const immobileBot = (): Dir | null => null;

export const Territorial = (): Keyword => ({ kind: 'territorial' });
export const Nomadic = (): Keyword => ({ kind: 'nomadic' });
export const Immobile = (): Keyword => ({ kind: 'immobile' });

defineKeyword({
  kind: 'territorial', term: 'Territorial', tier: 'core',
  gloss: 'The monster keeps to a 3x3 territory around its home square (where it was summoned) and hunts hostile recruit groups near it. If something forces it out, the square where it stops becomes its new home.',
  print: () => ({ layout: 'inline', text: 'Territorial' }),
  compile: () => ({
    bot: territorialBot,
    on: {
      'group:move': (c, ev) => {
        const gid = hostGroupId(c);
        if (gid === undefined || ev.ref?.kind !== 'group' || ev.ref.id !== gid) return;
        const g = c.group(gid);
        const to = ev.data.to as Pos;
        if (g?.home && chebyshev(to, g.home) > 1) c.setHome(gid, to);
      },
    },
  }),
});

defineKeyword({
  kind: 'nomadic', term: 'Nomadic', tier: 'core',
  gloss: 'The monster is unrestricted: it roams the whole board and hunts the nearest hostile recruit group.',
  print: () => ({ layout: 'inline', text: 'Nomadic' }),
  compile: () => ({ bot: nomadicBot }),
});

defineKeyword({
  kind: 'immobile', term: 'Immobile', tier: 'core',
  gloss: 'The monster cannot be moved at all; it ignores every order and effect that would move it.',
  print: () => ({ layout: 'inline', text: 'Immobile' }),
  compile: () => ({
    bot: immobileBot,
    on: {
      'movement:before': (c) => {
        const gid = hostGroupId(c);
        if (gid !== undefined) c.setMoveOrder(gid, null);
      },
    },
  }),
});
```

- [ ] **Step 7: `versus.ts`**

`src/lang/keywords/versus.ts`:
```ts
import type { HouseId } from '@sanctum/engine';
import { INDIVIDUAL_TARGETS, isHostMinion } from '../../helpers';
import { requireHost } from '../hosts';
import { defineKeyword } from '../registry';
import type { Keyword } from '../types';
import { appliesTo, toDelta, type GrantStats, type GrantTo } from './statics';

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const houses = (hs: HouseId[]) => hs.map(cap).join(' or ');
const statText = (s: GrantStats) => (['hand', 'missile', 'armor', 'level', 'maxHp'] as const)
  .filter((f) => s[f] !== undefined)
  .map((f) => `${s[f]! >= 0 ? '+' : '-'}${Math.abs(s[f]!)} ${{ hand: 'H', missile: 'M', armor: 'A', level: 'L', maxHp: 'HP' }[f]}`)
  .join(', ');

/* ---------- Against ---------- */

export interface AgainstKeyword extends Keyword {
  kind: 'against';
  houses: HouseId[];
  hand: number;
  missile: number;
  monstersOnly: boolean;
}
/** "+N H against <House> minions": extra damage when the host minion strikes a victim serving one of those houses. */
export const Against = (
  hs: HouseId[],
  opts: { hand?: number; missile?: number; monstersOnly?: boolean },
): AgainstKeyword => ({ kind: 'against', houses: hs, hand: opts.hand ?? 0, missile: opts.missile ?? 0, monstersOnly: opts.monstersOnly ?? false });

defineKeyword<AgainstKeyword>({
  kind: 'against', term: 'Against', tier: 'house',
  gloss: '"+N H against <House> minions": extra hand (or missile) damage when this minion strikes a victim that serves one of those houses.',
  print: (k) => {
    const stat = [k.hand ? `+${k.hand} H` : '', k.missile ? `+${k.missile} M` : ''].filter(Boolean).join(', ');
    return { layout: 'line', text: `${stat} against ${houses(k.houses)} ${k.monstersOnly ? 'monsters' : 'minions'}.` };
  },
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Against');
    return {
      on: {
        'attacker:strikes': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          if (!v || (k.monstersOnly && v.kind !== 'monster') || !v.house || !k.houses.includes(v.house)) return;
          ev.data.damage += (ev.data.kind === 'hand' ? k.hand : k.missile) ?? 0;
        },
      },
    };
  },
});

/* ---------- Immune ---------- */

export interface ImmuneKeyword extends Keyword {
  kind: 'immune';
  houses: HouseId[];
}
/** The host minion cannot be targeted by individual spells of these houses. */
export const Immune = (hs: HouseId[]): ImmuneKeyword => ({ kind: 'immune', houses: hs });

defineKeyword<ImmuneKeyword>({
  kind: 'immune', term: 'Immune', tier: 'house',
  gloss: 'Cannot be targeted by individual spells of the named houses.',
  print: (k) => ({ layout: 'line', text: `Cannot be targeted by ${houses(k.houses)} individual spells.` }),
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Immune');
    return {
      blocksCast: (_q, sp, a) =>
        k.houses.includes(a.card.house) && INDIVIDUAL_TARGETS.includes(a.card.target) &&
        a.target.kind === 'minion' && sp.host.kind === 'minion' && a.target.id === sp.host.id,
    };
  },
});

/* ---------- Taunt ---------- */

/** Enemies that choose their victim must choose this minion (unpaired bashers and all shooters). */
export const Taunt = (): Keyword => ({ kind: 'taunt' });
defineKeyword({
  kind: 'taunt', term: 'Taunt', tier: 'house',
  gloss: 'In combat, enemies that choose their victim (all archers and unpaired non-archers) must attack this minion.',
  print: () => ({ layout: 'inline', text: 'Taunt' }),
  compile: () => ({ stats: () => ({ taunt: true }) }),
});

/* ---------- Aura ---------- */

export interface AuraKeyword extends Keyword {
  kind: 'aura';
  others: GrantStats;
  to: GrantTo;
  self?: GrantStats;
}
/** A group aura: the host minion's group members (of class `to`) get `others`; the host itself gets `self`. */
export const Aura = (others: GrantStats, opts: { to?: GrantTo; self?: GrantStats } = {}): AuraKeyword => ({
  kind: 'aura', others, to: opts.to ?? 'all', self: opts.self,
});

defineKeyword<AuraKeyword>({
  kind: 'aura', term: 'Group aura', tier: 'house',
  gloss: 'A bonus for everyone in the host minion\'s group (including the host unless it says otherwise); it ends when the host dies and follows the host into another group.',
  print: (k) => ({
    layout: 'line',
    text: `Group aura: ${k.to === 'all' ? 'minions' : k.to} ${statText(k.others)}${k.self ? `; this minion ${statText(k.self)}` : ''}.`,
  }),
  compile: (k, ctx) => {
    requireHost(ctx, 'minion', 'Aura');
    return {
      groupAura: true,
      stats: (q, id, spell) => {
        const m = q.minion(id);
        if (!m) return {};
        const hostId = spell.host.kind === 'minion' ? spell.host.id : -1;
        if (id === hostId) return k.self ? toDelta(k.self, m) : {};
        return appliesTo(k.to, m, spell) ? toDelta(k.others, m) : {};
      },
    };
  },
});
```
`src/lang/index.ts`: append `export * from './keywords/creature'; export * from './keywords/behavior'; export * from './keywords/versus';`.

- [ ] **Step 8: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass, including the glossary ordering test and the lang-review tests. If a hand-computed expectation in `lang-creature.test.ts` differs for an explainable reason (stat line wording, spell counts), fix the test and report it; fix real defects in the keyword code.
```bash
git add -A
git commit -m "feat(cards): creature keywords (Monster, Create, Hero, Ambush, behaviours, Against, Immune, Taunt, Aura)"
```

---

### Task 5: The monsters (Salamander, Brimstone Dragon, Wyrmling, Hellion, Prismatic Serpent, Sylph, Undine)

**Goal:** Seven monster cards declared with keywords, plus the Wyrmling Hide helper.

**Files:**
- Create: `packages/cards/src/war/{salamander,brimstoneDragon,wyrmling,wyrmlingHide,hellion}.ts`, `packages/cards/src/life/{prismaticSerpent,sylph,undine}.ts`, `packages/cards/test/creatures-monsters.test.ts`
- Modify: `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/src/lang/index.ts` (export `hostGroupId`), `packages/cards/test/meta.test.ts`

**Acceptance Criteria:**
- [ ] Salamander (Territorial, Firewalk, makes its square lava), Brimstone Dragon (Territorial, Flight, only on mountain or volcano, 5 damage to the opposing group at start of combat), Wyrmling (neutral, Nomadic, Flight, only on volcano; a recruit group that kills it gets Wyrmling Hide), Hellion (Nomadic; changes sides after combat if it fought and met no Justice minion), Prismatic Serpent (Nomadic, +4 H against Death or Despair monsters, immune to their individual spells), Sylph (Territorial, two missile attacks, Warded), Undine (Immobile, water only, attracts enemy groups, dies out of water) behave as their text says
- [ ] `meta.test.ts` accepts "no Cast on clause" for Hellion, Prismatic Serpent, Sylph and Salamander as a square target and understands "water"
- [ ] All existing tests pass (counts that include card totals are updated in Task 9, so this task's `meta` change only adds the square rule; the registry-count test is updated here to 67 playable, see Step 5)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/creatures-monsters.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, killMinion, runMovement, spawnMinion, takeDamage } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import { card, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const monsterOf = (e: ReturnType<typeof mini>) => Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
const spec = (over: Partial<MinionSpec> = {}): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'x', ...over,
  base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

describe('Salamander', () => {
  it('summons a firewalking Territorial monster and makes its square lava', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'salamander', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    const m = e.state.minions[g.minionIds[0]];
    expect(m).toMatchObject({ name: 'Salamander', house: 'war' });
    expect(m.base).toMatchObject({ hand: 4, armor: 0, hp: 12, level: 1 });
    expect(computeStats(e, m.id).walks).toContain('fire');
    expect(e.state.terrain['5,5']).toBe('lava');
    put(e, 'blue', { x: 5, y: 7 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 6 });
  });
});

describe('Brimstone Dragon', () => {
  it('needs a mountain or volcano, flies, and casts Fireball at the start of combat', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'brimstone-dragon', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'volcano';
    expect(castMini(e, 'red', 'brimstone-dragon', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    expect(computeStats(e, g.minionIds[0]).walks).toContain('flight');
    const foes = put(e, 'blue', { x: 5, y: 6 }, ['swordsman', 'archer']);
    dispatch(e, 'combat:start', { kind: 'group', id: g.id }, { opponent: foes.id });
    for (const id of foes.minionIds) expect(e.state.minions[id].hp).toBe(2);
  });
});

describe('Wyrmling', () => {
  it('is neutral, needs a volcano, and gives Wyrmling Hide to the recruit group that kills it', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'wyrmling', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'volcano';
    e.state.terrain['8,2'] = 'volcano';
    expect(castMini(e, 'red', 'wyrmling', sq(5, 5))).toBe('cast');
    expect(castMini(e, 'red', 'wyrmling', sq(8, 2))).toBe('cast');
    const [first, second] = Object.values(e.state.groups).filter((g) => g.kind === 'monster');
    expect(first.owner).toBe('neutral');
    expect(e.state.minions[first.minionIds[0]].base.level).toBe(0);
    const killers = put(e, 'red', { x: 3, y: 3 }, ['swordsman', 'archer']);
    killMinion(e, first.minionIds[0], killers.minionIds[0], 'kills');
    expect(e.state.spells.some((s) => s.cardId === 'wyrmling-hide' && s.host.kind === 'group' && s.host.id === killers.id)).toBe(true);
    expect(computeStats(e, killers.minionIds[0]).armor).toBe(3);
    expect(computeStats(e, killers.minionIds[1]).armor).toBe(2);
    // killed by a monster: no hide
    const other = createGroup(e, 'blue', { x: 9, y: 9 }, 'monster', 'computer');
    const brute = spawnMinion(e, other.id, spec());
    killMinion(e, second.minionIds[0], brute.id, 'kills');
    expect(e.state.spells.filter((s) => s.cardId === 'wyrmling-hide')).toHaveLength(1);
  });
});

describe('Hellion', () => {
  const run = (house: 'justice' | null) => {
    const e = mini(allCards);
    castMini(e, 'red', 'hellion', sq(5, 5));
    const g = monsterOf(e);
    const foe = put(e, 'blue', { x: 5, y: 6 }, ['swordsman']);
    if (house) e.state.minions[foe.minionIds[0]].house = house;
    dispatch(e, 'combat:start', { kind: 'group', id: g.id }, { opponent: foe.id });
    dispatch(e, 'turn:afterCombat');
    return { e, g };
  };
  it('changes sides after fighting only non-Justice minions', () => {
    const { e, g } = run(null);
    expect(g.owner).toBe('blue');
    expect(e.state.minions[g.minionIds[0]].owner).toBe('blue');
    expect(e.state.spells.find((s) => s.cardId === 'hellion')!.owner).toBe('blue');
  });
  it('stays when it met a Justice minion, or when it did not fight', () => {
    expect(run('justice').g.owner).toBe('red');
    const e = mini(allCards);
    castMini(e, 'red', 'hellion', sq(5, 5));
    dispatch(e, 'turn:afterCombat');
    expect(monsterOf(e).owner).toBe('red');
  });
});

describe('Prismatic Serpent', () => {
  it('hits Death and Despair monsters harder and is immune to their individual spells', () => {
    const probe = (id: string, house: 'death' | 'war') =>
      card({ id, name: id, house, cost: {}, type: 'manifestation', target: { type: 'monster' }, keywords: [] });
    const e = mini([...allCards, probe('death-probe', 'death'), probe('war-probe', 'war')]);
    castMini(e, 'red', 'prismatic-serpent', sq(5, 5));
    const g = monsterOf(e);
    const me = g.minionIds[0];
    const foe = createGroup(e, 'blue', { x: 6, y: 5 }, 'monster', 'computer');
    const dead = spawnMinion(e, foe.id, spec({ house: 'despair' }));
    const plain = spawnMinion(e, foe.id, spec());
    const strike = (victimId: number) =>
      dispatch(e, 'attacker:strikes', { kind: 'minion', id: me }, { victimId, kind: 'hand', round: 2, damage: 4 }).data.damage;
    expect(strike(dead.id)).toBe(8);
    expect(strike(plain.id)).toBe(4);
    expect(castMini(e, 'blue', 'death-probe', { kind: 'minion', id: me })).toBe('squandered');
    expect(castMini(e, 'blue', 'war-probe', { kind: 'minion', id: me })).toBe('cast');
    expect(e.state.minions[me].base).toMatchObject({ hand: 4, armor: 2, hp: 12, level: 2 });
  });
});

describe('Sylph', () => {
  it('has two missile attacks and takes no combat damage from unenchanted recruits', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'sylph', sq(5, 5));
    const me = monsterOf(e).minionIds[0];
    expect(e.state.minions[me].base).toMatchObject({ missile: 3, missileAttacks: 2, hp: 15 });
    const attacker = put(e, 'blue', { x: 5, y: 6 }, ['swordsman']);
    e.state.minions[me].combat.armor = 0;
    expect(takeDamage(e, me, 3, hand, attacker.minionIds[0])).toBe('bounced');
    e.state.spells.push({ id: 900, cardId: 'veteran', owner: 'blue', host: { kind: 'group', id: attacker.id }, visible: true, turnsLeft: null, tokens: {} });
    expect(takeDamage(e, me, 3, hand, attacker.minionIds[0])).toBe('damaged');
  });
});

describe('Undine', () => {
  it('needs water, never moves, attracts enemy groups and dies out of water', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'undine', sq(5, 5))).toBe('squandered');
    e.state.terrain['5,5'] = 'water';
    expect(castMini(e, 'red', 'undine', sq(5, 5))).toBe('cast');
    const g = monsterOf(e);
    g.moveOrder = 'e';
    const foe = put(e, 'blue', { x: 5, y: 3 }, ['swordsman']);
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 5 });
    expect(foe.pos).toEqual({ x: 5, y: 4 });
    e.state.terrain['5,5'] = 'plains';
    dispatch(e, 'turn:startAfter');
    expect(e.state.minions[g.minionIds[0]]?.status).toBe('dead');
  });
});
```
(`veteran` is used only as an arbitrary visible spell that makes the attacker "enchanted". Do not call `resetCards()` in the creature tests: they use the real card modules, whose specs must stay registered.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the card files**

`src/lang/index.ts`: append `export { hostGroupId } from './scopes';`.

`src/war/salamander.ts`:
```ts
import { card, Monster, OnCast, Target, Terraform, Territorial } from '../lang';

export default card({ id: 'salamander', name: 'Salamander', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [Territorial(), Monster({ name: 'Salamander', cls: 'monster', hand: 4, hp: 12, level: 1, walks: ['fire'] }), OnCast(Terraform('lava'))] });
```
`src/war/brimstoneDragon.ts`:
```ts
import { card, Damage, Monster, On, Target, Territorial, When } from '../lang';

export default card({ id: 'brimstone-dragon', name: 'Brimstone Dragon', house: 'war', cost: { strife: 6, clarity: 3 }, type: 'summoning', host: 'minion',
  target: Target.square.on('mountain', 'volcano'),
  keywords: [
    Territorial(),
    Monster({ name: 'Brimstone Dragon', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 2, walks: ['flight'] }),
    On(When.startOfCombat(), Damage(5, 'opponent')),
  ] });
```
`src/war/wyrmlingHide.ts`:
```ts
import { card, Grant, Target } from '../lang';

export default card({ id: 'wyrmling-hide', name: 'Wyrmling Hide', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.group, keywords: [Grant({ armor: 2 })] });
```
`src/war/wyrmling.ts`:
```ts
import { card, Monster, Nomadic, Script, Target } from '../lang';

export default card({ id: 'wyrmling', name: 'Wyrmling', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square.on('volcano'),
  keywords: [
    Nomadic(),
    Monster({ name: 'Wyrmling', cls: 'monster', hand: 2, armor: 2, hp: 6, level: 0, walks: ['flight'] }, { neutral: true }),
    Script('If killed by a recruit group, that group gets Wyrmling Hide (all members +2 A).', {
      on: {
        'minion:killed': (c, ev) => {
          if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
          const killer = ev.data.blame == null ? undefined : c.minion(ev.data.blame);
          if (killer?.kind !== 'recruit') return;
          c.createSpell('wyrmling-hide', { kind: 'group', id: killer.groupId }, { owner: killer.owner });
        },
      },
    }),
  ] });
```
`src/war/hellion.ts`:
```ts
import { card, hostGroupId, Monster, Nomadic, Script, Target } from '../lang';

// RULING: "fought only non-Justice minions" needs at least one combat: a Hellion that did not fight stays put.
export default card({ id: 'hellion', name: 'Hellion', house: 'war', cost: { strife: 5, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [
    Nomadic(),
    Monster({ name: 'Hellion', cls: 'monster', hand: 4, armor: 1, hp: 16, level: 3 }),
    Script('After all combat, if she fought only non-Justice minions this turn, she changes sides.', {
      on: {
        'combat:start': (c, ev) => {
          const gid = hostGroupId(c);
          if (gid === undefined || ev.ref?.kind !== 'group' || ev.ref.id !== gid) return;
          c.setToken('fought', 1);
          if (c.minionsOf(ev.data.opponent).some((m) => m.house === 'justice')) c.setToken('justice', 1);
        },
        'turn:afterCombat': (c) => {
          const gid = hostGroupId(c);
          if (gid === undefined) return;
          const flip = c.token('fought') === 1 && c.token('justice') === 0;
          c.setToken('fought', 0);
          c.setToken('justice', 0);
          if (flip) c.changeSides(gid);
        },
      },
    }),
  ] });
```
`src/life/prismaticSerpent.ts`:
```ts
import { Against, card, Immune, Monster, Nomadic, Target } from '../lang';

export default card({ id: 'prismatic-serpent', name: 'Prismatic Serpent', house: 'life', cost: { clarity: 5, world: 3 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [
    Nomadic(),
    Monster({ name: 'Prismatic Serpent', cls: 'monster', hand: 4, armor: 2, hp: 12, level: 2 }),
    Against(['death', 'despair'], { hand: 4, monstersOnly: true }),
    Immune(['death', 'despair']),
  ] });
```
`src/life/sylph.ts`:
```ts
import { card, Monster, Target, Territorial, Warded } from '../lang';

export default card({ id: 'sylph', name: 'Sylph', house: 'life', cost: { clarity: 6, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.square,
  keywords: [Territorial(), Monster({ name: 'Sylph', cls: 'monster', missile: 3, missileAttacks: 2, hp: 15, level: 1 }), Warded()] });
```
`src/life/undine.ts`:
```ts
import { step } from '@sanctum/engine';
import type { EventContext, Pos, TerrainId } from '@sanctum/engine';
import { ADJACENT } from '../helpers';
import { card, hostGroupId, Immobile, Monster, Script, Target } from '../lang';

const ATTRACTING: TerrainId[] = ['plains', 'forest', 'desert'];

function myPos(c: EventContext): Pos | null {
  const gid = hostGroupId(c);
  return gid === undefined ? null : c.group(gid)?.pos ?? null;
}

/** Before movement, enemy player groups next to an attracting square must step onto one of them. */
function attract(c: EventContext): void {
  const me = myPos(c);
  if (!me) return;
  const spots = ADJACENT.map((d) => ({ x: me.x + d.x, y: me.y + d.y }))
    .filter((p) => c.state.cells.includes(`${p.x},${p.y}`) && ATTRACTING.includes(c.terrainAt(p) as TerrainId));
  if (!spots.length) return;
  for (const g of Object.values(c.state.groups)) {
    if (!g.pos || g.kind !== 'recruit' || g.owner === c.spell.owner || g.control !== 'player') continue;
    const from = g.pos;
    const moves = c.legalDirections(g.id).filter((d) => {
      const p = step(from, d);
      return spots.some((s) => s.x === p.x && s.y === p.y);
    });
    if (moves.length) c.setMoveOrder(g.id, moves[Math.floor(c.random() * moves.length)]);
  }
}

function dieOutOfWater(c: EventContext): void {
  const me = myPos(c);
  if (me && c.terrainAt(me) !== 'water' && c.host.kind === 'minion') c.kill(c.host.id);
}

// RULING: "dies if not in water" is checked at the start of the turn and before combat. Undine walks water
// (otherwise the engine would drown her where she is summoned).
export default card({ id: 'undine', name: 'Undine', house: 'life', cost: { clarity: 2, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.square.on('water'),
  keywords: [
    Immobile(),
    Monster({ name: 'Undine', cls: 'monster', hand: 2, hp: 15, level: 3, walks: ['water'] }),
    Script('Plains, forest and desert next to Undine attract enemy groups: a group next to one must move onto it. Undine dies if not in water.', {
      on: { 'movement:before': attract, 'turn:startAfter': dieOutOfWater, 'combat:before': dieOutOfWater },
    }),
  ] });
```
Register: add the 5 war files and 3 life files to `warCards`/`lifeCards` arrays in `src/war/index.ts` and `src/life/index.ts` (add imports and entries; keep the arrays' existing style).

- [ ] **Step 4: Metadata test understands monsters**

`test/meta.test.ts`: in `expectedTarget` change the square regex to `/^(square|forest|plains|mountain|volcano|water)\b/` and the structure regex to `/^(friendly )?town or colony\b/` (four of the new cards say "friendly town or colony"). Above the `describe`, add
```ts
/** Monster cards with no "Cast on" clause: they are summoned on a square. */
const SQUARE_MONSTERS = new Set(['hellion', 'prismatic-serpent', 'sylph', 'salamander']);
```
and replace the `castOn` assertions in the per-card test with
```ts
      if (rec!.castOn === null) {
        expect(SQUARE_MONSTERS.has(card.id), `"${card.name}" has no "Cast on" clause`).toBe(true);
        expect(card.target).toBe('square');
      } else {
        expect(card.target).toBe(expectedTarget(rec!.castOn));
      }
```
(delete the old `not.toBeNull()` assertion).

- [ ] **Step 5: Counts**

This task adds 7 playable cards (War: Salamander, Brimstone Dragon, Wyrmling, Hellion; Life: Prismatic Serpent, Sylph, Undine) and 1 helper (Wyrmling Hide). Update the registry-count assertions that fail: playable 67 (33 War, 34 Life), pending 35. Update the `faces.test.ts` length check from 68 to 76 (68 + 7 playable + 1 helper) and re-record its snapshot after reviewing the new faces. Task 9 sets the final numbers.

- [ ] **Step 6: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. Fix explainable arithmetic in the new tests; report any card whose behaviour needed a code change.
```bash
git add -A
git commit -m "feat(cards): seven monsters (Salamander, Brimstone Dragon, Wyrmling, Hellion, Prismatic Serpent, Sylph, Undine)"
```

---

### Task 6: The combat-hoppers (Arboriads, Firewyrm)

**Goal:** Arboriads and Firewyrm as `Ambush` cards.

**Files:**
- Create: `packages/cards/src/life/arboriads.ts`, `packages/cards/src/war/firewyrm.ts`, `packages/cards/test/creatures-hoppers.test.ts`
- Modify: `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/src/lang/keywords/creature.ts` (Ambush `count`), `packages/cards/test/{meta,faces}.test.ts`

**Acceptance Criteria:**
- [ ] Arboriads: cast on the globe, creates two Arboriads off the board; before combat they appear in forest next to a non-friendly recruit group; after all combat they disappear; they get +4 H against Death minions; dispelled when killed; may be cast more than once
- [ ] Firewyrm: one Firewyrm with two attacks; appears in lava or barren land next to any non-friendly group, and that square becomes lava; disappears again; dispelled when killed; may be cast more than once
- [ ] Nothing happens when no eligible square exists

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test** (`Ambush` already takes a `count` option from Task 4)

`packages/cards/test/creatures-hoppers.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, killMinion, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec } from '@sanctum/engine';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const globe = { kind: 'globe' as const };
const hopperOf = (e: ReturnType<typeof mini>) => Object.values(e.state.groups).find((g) => g.kind === 'monster')!;
const controllers = (e: ReturnType<typeof mini>) => e.state.spells.filter((s) => s.host.kind === 'globe');

describe('Arboriads', () => {
  it('waits off the board, ambushes in forest next to a non-friendly recruit group, then hides', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'arboriads', globe)).toBe('cast');
    const g = hopperOf(e);
    expect(g.pos).toBeNull();
    expect(g.minionIds).toHaveLength(2);
    expect(e.state.minions[g.minionIds[0]].base).toMatchObject({ hand: 3, armor: 1, hp: 7, level: 1 });
    e.state.terrain['5,4'] = 'forest';
    e.state.terrain['2,5'] = 'forest';
    put(e, 'red', { x: 2, y: 4 }, ['swordsman']); // friendly: its forest does not count
    dispatch(e, 'combat:before');
    expect(g.pos).toBeNull();
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(g.pos).toEqual({ x: 5, y: 4 });
    dispatch(e, 'turn:afterCombat');
    expect(g.pos).toBeNull();
  });

  it('may be cast twice, gets +4 H against Death minions, and is dispelled when killed', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'arboriads', globe);
    castMini(e, 'red', 'arboriads', globe);
    expect(controllers(e)).toHaveLength(2);
    const g = Object.values(e.state.groups).filter((x) => x.kind === 'monster')[0];
    const spec: MinionSpec = {
      kind: 'monster', cls: 'monster', name: 'd', house: 'death',
      base: { hp: 9, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
    };
    const foe = createGroup(e, 'blue', { x: 6, y: 6 }, 'monster', 'computer');
    const victim = spawnMinion(e, foe.id, spec);
    g.pos = { x: 5, y: 4 }; // spells on an off-board group are suspended, so put it on the board first
    const ev = dispatch(e, 'attacker:strikes', { kind: 'minion', id: g.minionIds[0] }, { victimId: victim.id, kind: 'hand', round: 2, damage: 3 });
    expect(ev.data.damage).toBe(7);
    for (const id of [...g.minionIds]) killMinion(e, id, null, 'dies');
    expect(controllers(e)).toHaveLength(1);
  });
});

describe('Firewyrm', () => {
  it('appears in lava or barren land next to any non-friendly group and makes that square lava', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'firewyrm', globe);
    const g = hopperOf(e);
    expect(e.state.minions[g.minionIds[0]].base).toMatchObject({ hand: 2, handAttacks: 2, hp: 12 });
    e.state.terrain['5,4'] = 'barren';
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(g.pos).toEqual({ x: 5, y: 4 });
    expect(e.state.terrain['5,4']).toBe('lava');
    dispatch(e, 'turn:afterCombat');
    expect(g.pos).toBeNull();
    expect(e.state.terrain['5,4']).toBe('lava');
  });

  it('stays off the board when there is no eligible square', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'firewyrm', globe);
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'combat:before');
    expect(hopperOf(e).pos).toBeNull();
  });
});
```
(`computeStats` import may be unused: remove it.)

- [ ] **Step 2: Write the cards**

`src/life/arboriads.ts`:
```ts
import { Against, Ambush, card, Stackable, Target } from '../lang';

export default card({ id: 'arboriads', name: 'Arboriads', house: 'life', cost: { clarity: 3, world: 2 }, type: 'summoning', host: 'minion',
  target: Target.globe,
  keywords: [
    Stackable(),
    Ambush({ name: 'Arboriads', cls: 'monster', hand: 3, armor: 1, hp: 7, level: 1 }, { terrain: ['forest'], next: 'recruit', count: 2 }),
    Against(['death'], { hand: 4 }),
  ] });
```
`src/war/firewyrm.ts`:
```ts
import { Ambush, card, Stackable, Target } from '../lang';

export default card({ id: 'firewyrm', name: 'Firewyrm', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'summoning', host: 'minion',
  target: Target.globe,
  keywords: [
    Stackable(),
    Ambush({ name: 'Firewyrm', cls: 'monster', hand: 2, handAttacks: 2, hp: 12, level: 1 }, { terrain: ['lava', 'barren'], next: 'any', becomes: 'lava' }),
  ] });
```
Register both in the war/life index arrays.

- [ ] **Step 3: Counts**

Two more playable cards: playable 69 (34 War, 35 Life), pending 33; `faces.test.ts` length 78. Re-record the snapshot after reading the two new faces.

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(cards): combat-hoppers Arboriads and Firewyrm"
```

---

### Task 7: The creators (Warlord, Bard, Decoy, Dragon's Teeth, Allies, Incarnate)

**Goal:** Six cards that create recruits or novices, with the Warlord, Bard and Decoy helpers.

**Files:**
- Create: `packages/cards/src/war/{warlord,warlordCommand,decoy,decoyRuse,dragonsTeeth}.ts`, `packages/cards/src/life/{bard,bardSong,allies,incarnate}.ts`, `packages/cards/test/creatures-creators.test.ts`
- Modify: `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`

**Acceptance Criteria:**
- [ ] Warlord creates a level 2 Human swordsman in a friendly town; Warlord gets +3 H (the card's +2 and +1) and swordsmen in his group get +1 H
- [ ] Bard creates an Elven swordsman (H0 A3, no attack) in a recruit group; other swordsmen in the group get +1 H
- [ ] Decoy creates a Human swordsman with +2 armor that deals no damage and taunts; only one per group
- [ ] Dragon's Teeth creates two level 1 swordsmen of random nations in a friendly town
- [ ] Allies adds two Elf novices to a friendly town; the next recruits trained there are Elves
- [ ] Incarnate: when the recruit dies, a recruit of the same nation and class appears in its owner's Sanctum, or is lost if the Sanctum is blocked

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/creatures-creators.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeStats, fight, killMinion } from '@sanctum/engine/src/testing';
import { card, Script, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const structure = (id: number) => ({ kind: 'structure' as const, id });

describe('Warlord', () => {
  it('creates a level 2 Human swordsman who leads his swordsmen', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    const crew = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(castMini(e, 'red', 'warlord', structure(900))).toBe('cast');
    const w = Object.values(e.state.minions).find((m) => m.name === 'Warlord')!;
    expect(w).toMatchObject({ nation: 'human', house: 'war', kind: 'recruit' });
    expect(w.base.level).toBe(2);
    expect(w.groupId).toBe(crew.id);
    const s = computeStats(e, w.id);
    expect([s.hand, s.armor, s.maxHp, s.level]).toEqual([5, 1, 7, 2]);
    expect(computeStats(e, crew.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, crew.minionIds[1]).hand).toBe(0);
  });
  it('cannot be cast on another side\'s town', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'blue', 4, 4);
    expect(castMini(e, 'red', 'warlord', structure(900))).toBe('squandered');
  });
});

describe('Bard', () => {
  it('joins a recruit group as an Elven swordsman who deals no damage and inspires the others', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(castMini(e, 'red', 'bard', { kind: 'group', id: g.id })).toBe('cast');
    const bard = Object.values(e.state.minions).find((m) => m.name === 'Bard')!;
    expect(bard).toMatchObject({ nation: 'elf', house: 'life' });
    const s = computeStats(e, bard.id);
    expect([s.hand, s.armor, s.maxHp, s.level, s.handAttacks]).toEqual([0, 3, 7, 1, 0]);
    expect(computeStats(e, g.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, g.minionIds[1]).hand).toBe(0);
  });
});

describe('Decoy', () => {
  it('is a taunting armored swordsman that deals no damage, one per group', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'decoy', { kind: 'group', id: g.id })).toBe('cast');
    expect(castMini(e, 'red', 'decoy', { kind: 'group', id: g.id })).toBe('squandered');
    const d = Object.values(e.state.minions).find((m) => m.name === 'Decoy')!;
    const s = computeStats(e, d.id);
    expect([s.armor, s.noDamage, s.taunt]).toEqual([3, true, true]);
    expect(s.handAttacks).toBeLessThanOrEqual(0);
  });

  it("draws the enemy archer's fire", () => {
    const probe = card({
      id: 'strike-probe', name: 'Probe', house: 'war', cost: {}, type: 'alteration', target: Target.recruit,
      keywords: [Script('probe', { on: { 'attacker:strikes': (c, ev) => c.setToken('victim', ev.data.victimId) } })],
    });
    const e = mini([...allCards, probe]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'decoy', { kind: 'group', id: g.id });
    const d = Object.values(e.state.minions).find((m) => m.name === 'Decoy')!;
    const archer = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    castMini(e, 'blue', 'strike-probe', { kind: 'minion', id: archer.minionIds[0] });
    fight(e, g.id, archer.id);
    // every shot went to the Decoy, not to the swordsman
    expect(e.state.spells.find((s) => s.cardId === 'strike-probe')!.tokens.victim).toBe(d.id);
  });
});

describe('Dragon\'s Teeth', () => {
  it('creates two level 1 swordsmen of random nations', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'dragons-teeth', structure(900))).toBe('cast');
    const ms = Object.values(e.state.minions);
    expect(ms).toHaveLength(2);
    for (const m of ms) {
      expect(m).toMatchObject({ kind: 'recruit', cls: 'swordsman' });
      expect(m.nation).not.toBeNull();
      expect(m.base.level).toBe(1);
    }
    expect(ms[0].groupId).toBe(ms[1].groupId);
  });
});

describe('Allies', () => {
  it('adds two Elf novices', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'allies', structure(900))).toBe('cast');
    expect(e.state.structures[900].novices).toBe(2);
    expect(e.state.structures[900].noviceNations).toEqual(['elf', 'elf']);
  });
});

describe('Incarnate', () => {
  const setup = () => {
    const e = mini(allCards);
    e.state.structures[1] = { id: 1, kind: 'sanctum', pos: { x: 2, y: 2 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false };
    const g = put(e, 'red', { x: 5, y: 5 }, ['archer']);
    e.state.minions[g.minionIds[0]].nation = 'human';
    castMini(e, 'red', 'incarnate', { kind: 'minion', id: g.minionIds[0] });
    return { e, g };
  };
  it('creates a recruit of the same class and nation in the owner\'s Sanctum when the recruit dies', () => {
    const { e, g } = setup();
    killMinion(e, g.minionIds[0], null, 'dies');
    const fresh = Object.values(e.state.minions).filter((m) => m.status === 'alive');
    expect(fresh).toHaveLength(1);
    expect(fresh[0]).toMatchObject({ cls: 'archer', owner: 'red' });
    expect(e.state.groups[fresh[0].groupId].pos).toEqual({ x: 2, y: 2 });
  });
  it('is lost when the Sanctum is blocked', () => {
    const { e, g } = setup();
    put(e, 'blue', { x: 2, y: 2 }, ['swordsman']);
    killMinion(e, g.minionIds[0], null, 'dies');
    expect(Object.values(e.state.minions).filter((m) => m.status === 'alive' && m.owner === 'red')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the cards**

War, `src/war/warlordCommand.ts`:
```ts
import { Aura, card, Target } from '../lang';

export default card({ id: 'warlord-command', name: 'Warlord Command', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Aura({ hand: 1 }, { to: 'swordsmen', self: { hand: 3 } })] });
```
`src/war/warlord.ts`:
```ts
import { card, Create, Target } from '../lang';

// RULING: the printed H:5 is base 2 + the card's +2 + the group's +1; the +3 lives in Warlord Command.
export default card({ id: 'warlord', name: 'Warlord', house: 'war', cost: { strife: 4, clarity: 3 }, type: 'summoning',
  target: Target.structure.friendly,
  keywords: [Create({ name: 'Warlord', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['warlord-command'] })] });
```
`src/war/decoyRuse.ts`:
```ts
import { card, Grant, Pacified, Target, Taunt } from '../lang';

export default card({ id: 'decoy-ruse', name: 'Decoy Ruse', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ armor: 2 }), Pacified(), Taunt()] });
```
`src/war/decoy.ts`:
```ts
import { card, Create, Target } from '../lang';

export default card({ id: 'decoy', name: 'Decoy', house: 'war', cost: { strife: 4, clarity: 2 }, type: 'summoning',
  target: Target.recruitGroup.friendly,
  keywords: [Create({ name: 'Decoy', cls: 'swordsman', nation: 'human' }, { with: ['decoy-ruse'], onePerGroup: true })] });
```
`src/war/dragonsTeeth.ts`:
```ts
import { card, Create, Target } from '../lang';

export default card({ id: 'dragons-teeth', name: "Dragon's Teeth", house: 'war', cost: { strife: 3, clarity: 3 }, type: 'summoning',
  target: Target.structure.friendly,
  keywords: [Create({ name: 'swordsman', cls: 'swordsman', level: 1 }, { count: 2, randomNation: true })] });
```
Life, `src/life/bardSong.ts`:
```ts
import { Aura, card, Target } from '../lang';

export default card({ id: 'bard-song', name: 'Bard Song', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Aura({ hand: 1 }, { to: 'swordsmen' })] });
```
`src/life/bard.ts`:
```ts
import { card, Create, Target } from '../lang';

export default card({ id: 'bard', name: 'Bard', house: 'life', cost: { clarity: 4, world: 2 }, type: 'summoning',
  target: Target.recruitGroup,
  keywords: [Create({ name: 'Bard', cls: 'swordsman', nation: 'elf', hand: 0, armor: 3 }, { with: ['bard-song'] })] });
```
`src/life/allies.ts`:
```ts
import { card, Novices, OnCast, Target } from '../lang';

export default card({ id: 'allies', name: 'Allies', house: 'life', cost: { clarity: 4, world: 3 }, type: 'manifestation',
  target: Target.structure.friendly, keywords: [OnCast(Novices(2, 'elf'))] });
```
`src/life/incarnate.ts`:
```ts
import { recruitSpec } from '@sanctum/engine';
import { isHostMinion } from '../helpers';
import { card, Script, Target } from '../lang';

export default card({ id: 'incarnate', name: 'Incarnate', house: 'life', cost: { clarity: 1 }, type: 'alteration',
  target: Target.recruit,
  keywords: [
    Script("When the recruit dies, a recruit of the same nation and class is created in its owner's Sanctum (lost if it cannot be created this turn).", {
      on: {
        'minion:dies': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const m = c.minion(ev.ref!.kind === 'minion' ? ev.ref!.id : -1);
          if (!m || m.owner === 'neutral' || (m.cls !== 'swordsman' && m.cls !== 'archer')) return;
          const sanctum = Object.values(c.state.structures).find((s) => s.kind === 'sanctum' && s.owner === m.owner);
          if (sanctum) c.createRecruit(sanctum.id, recruitSpec(m.cls, m.nation ?? undefined));
        },
      },
    }),
  ] });
```
Register the 5 war and 4 life files in the index arrays.

- [ ] **Step 4: Counts**

Six more playable cards (War: Warlord, Decoy, Dragon's Teeth; Life: Bard, Allies, Incarnate) and three helpers (Warlord Command, Decoy Ruse, Bard Song): playable 75 (37 War, 38 Life), pending 27; `faces.test.ts` length 87. Re-record the snapshot after reading the new faces.

- [ ] **Step 5: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(cards): creators Warlord, Bard, Decoy, Dragon's Teeth, Allies, Incarnate"
```

---

### Task 8: The heroes (Ngozi, Vlad Hrothgar, Lienna)

**Goal:** Three hero cards with the once-per-game rule, plus their helpers and the Rite of Growth helper.

**Files:**
- Create: `packages/cards/src/war/{ngozi,ngozisBlight,vladHrothgar,riteOfGrowth}.ts`, `packages/cards/src/life/{lienna,liennasPresence}.ts`, `packages/cards/test/creatures-heroes.test.ts`
- Modify: `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`

**Acceptance Criteria:**
- [ ] Ngozi: a level 2 Human swordsman joins the recruit group; before movement and after her group moves, the four squares next to her group become barren
- [ ] Vlad Hrothgar: two heroes appear in a friendly town: Vlad (Human, Veteran: H3 A2 HP11 L2) and Oro (Cyclops, Rite of Growth: H3 A1 HP13 L2), both at full health
- [ ] Lienna: castable only on a recruit group standing in forest; an Elven archer hero (M2 A0 HP7 L2) joins; while she is in play her caster's side has initiative
- [ ] Each hero can be cast once per player per game
- [ ] Rite of Growth exists as a Body-house helper (+1 H, +4 maximum HP)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/creatures-heroes.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { beginTurn, computeStats, dispatch, killMinion } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const find = (e: ReturnType<typeof mini>, name: string) => Object.values(e.state.minions).find((m) => m.name === name)!;

describe('Ngozi', () => {
  it('joins a group and scorches the squares around it, once per game', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'ngozi', { kind: 'group', id: g.id })).toBe('cast');
    const n = find(e, 'Ngozi');
    expect(n).toMatchObject({ nation: 'human', groupId: g.id });
    const s = computeStats(e, n.id);
    expect([s.hand, s.armor, s.maxHp, s.level]).toEqual([2, 1, 7, 2]);
    dispatch(e, 'movement:before');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    g.pos = { x: 6, y: 3 };
    dispatch(e, 'group:move', { kind: 'group', id: g.id }, { from: { x: 4, y: 4 }, to: { x: 6, y: 3 } });
    expect(e.state.terrain['7,3']).toBe('barren');
    expect(castMini(e, 'red', 'ngozi', { kind: 'group', id: g.id })).toBe('squandered');
    expect(castMini(e, 'blue', 'ngozi', { kind: 'group', id: put(e, 'blue', { x: 8, y: 4 }, ['archer']).id })).toBe('cast');
  });
});

describe('Vlad Hrothgar', () => {
  it('creates Vlad (Veteran) and Oro (Rite of Growth) at full health', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'red', 'vlad-hrothgar', { kind: 'structure', id: 900 })).toBe('cast');
    const vlad = computeStats(e, find(e, 'Vlad Hrothgar').id);
    expect([vlad.hand, vlad.armor, vlad.maxHp, vlad.level]).toEqual([3, 2, 11, 2]);
    const oro = find(e, 'Oro');
    expect(oro.nation).toBe('cyclops');
    const o = computeStats(e, oro.id);
    expect([o.hand, o.armor, o.maxHp, o.level]).toEqual([3, 1, 13, 2]);
    expect(find(e, 'Vlad Hrothgar').hp).toBe(11);
    expect(oro.hp).toBe(13);
    expect(castMini(e, 'red', 'vlad-hrothgar', { kind: 'structure', id: 900 })).toBe('squandered');
  });
});

describe('Lienna', () => {
  it('needs a group in forest, is an Elven archer hero, and gives her side the initiative', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'lienna', { kind: 'group', id: g.id })).toBe('squandered');
    e.state.terrain['4,4'] = 'forest';
    expect(castMini(e, 'red', 'lienna', { kind: 'group', id: g.id })).toBe('cast');
    const l = find(e, 'Lienna');
    expect(l).toMatchObject({ nation: 'elf', cls: 'archer' });
    const s = computeStats(e, l.id);
    expect([s.missile, s.armor, s.maxHp, s.level]).toEqual([2, 0, 7, 2]);
    e.state.initiative = 'blue';
    beginTurn(e, false);
    expect(e.state.initiative).toBe('red');
    killMinion(e, l.id, null, 'dies');
    e.state.initiative = 'blue';
    beginTurn(e, false);
    expect(e.state.initiative).toBe('blue');
  });
});

describe('Rite of Growth', () => {
  it('is a Body helper: +1 H and +4 maximum HP', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    e.state.spells.push({ id: 900, cardId: 'rite-of-growth', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    const s = computeStats(e, g.minionIds[0]);
    expect([s.hand, s.maxHp]).toEqual([3, 11]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the cards**

`src/war/riteOfGrowth.ts`:
```ts
import { card, Grant, Target } from '../lang';

/** Body house helper (Vlad Hrothgar's Oro starts with it). */
export default card({ id: 'rite-of-growth', name: 'Rite of Growth', house: 'body', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Grant({ hand: 1, maxHp: 4 })] });
```
`src/war/ngozisBlight.ts`:
```ts
import { card, On, Target, Terraform, When } from '../lang';

export default card({ id: 'ngozis-blight', name: "Ngozi's Blight", house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    On(When.beforeMovement, Terraform('barren', 'aroundGroup')),
    On(When.moves, Terraform('barren', 'aroundGroup')),
  ] });
```
`src/war/ngozi.ts`:
```ts
import { card, Create, Hero, Target } from '../lang';

export default card({ id: 'ngozi', name: 'Ngozi', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'hero',
  target: Target.recruitGroup,
  keywords: [Hero(), Create({ name: 'Ngozi', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['ngozis-blight'] })] });
```
`src/war/vladHrothgar.ts`:
```ts
import { card, Create, Hero, Target } from '../lang';

// RULING: the two heroes are created independently, so a town whose group has room for only one of them gets one.
export default card({ id: 'vlad-hrothgar', name: 'Vlad Hrothgar', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'hero',
  target: Target.structure.friendly,
  keywords: [
    Hero(),
    Create({ name: 'Vlad Hrothgar', cls: 'swordsman', nation: 'human', level: 2 }, { with: ['veteran'] }),
    Create({ name: 'Oro', cls: 'swordsman', nation: 'cyclops', level: 2 }, { with: ['rite-of-growth'] }),
  ] });
```
`src/life/liennasPresence.ts`:
```ts
import { card, Script, Target } from '../lang';

// RULING: when Lienna leaves play the initiative is simply recomputed at the next start of turn, as the card says.
export default card({ id: 'liennas-presence', name: "Lienna's Presence", house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Script("While Lienna is in play, her caster's side has Initiative.", {
      on: { 'initiative:decide': (c) => { if (c.spell.owner !== 'neutral') c.setInitiative(c.spell.owner); } },
    }),
  ] });
```
`src/life/lienna.ts`:
```ts
import { card, Create, Hero, Target } from '../lang';

export default card({ id: 'lienna', name: 'Lienna', house: 'life', cost: { clarity: 4, world: 4 }, type: 'hero',
  target: Target.recruitGroup.in('forest'),
  keywords: [Hero(), Create({ name: 'Lienna', cls: 'archer', nation: 'elf', level: 2 }, { with: ['liennas-presence'] })] });
```
Register the four war files (`ngozi`, `ngozisBlight`, `vladHrothgar`, `riteOfGrowth`) and two life files in the index arrays.

- [ ] **Step 4: Counts**

Three more playable cards (Ngozi, Vlad, Lienna) and three helpers (Ngozi's Blight, Rite of Growth, Lienna's Presence): playable 78 (39 War, 39 Life), pending 24. `faces.test.ts` length 93 (68 + 18 playable + 7 helpers). Re-record the snapshot after reading the new faces.

- [ ] **Step 5: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(cards): heroes Ngozi, Vlad Hrothgar and Lienna"
```

---

### Task 9: Backlog, docs, final counts and tag

**Goal:** The backlog, docs and counts reflect the 18 new cards; a face snapshot pins everything; tag `creatures`.

**Files:**
- Modify: `docs/superpowers/plans/cards-backlog.md`, `docs/keyword-design.md`, `docs/card-text-guide.md`, `packages/cards/test/{meta,faces,lang-migration}.test.ts`

**Acceptance Criteria:**
- [ ] `cards-backlog.md` lists exactly the 24 pending cards; the E1 group now holds only Questing Beast with its remaining requirements
- [ ] `meta.test.ts` says 78 playable (39 War, 39 Life) and 24 pending; `faces.test.ts` pins every card in `allCards` (the real total, expected 93) and its snapshot is reviewed
- [ ] The docs describe the creature keywords, nations, and the new engine hooks
- [ ] Tag `creatures` points at the final commit

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Backlog**

In `cards-backlog.md`, replace the whole E1 section (heading, "Needs" paragraph and 19 bullets) with:
```markdown
## E1. Hunted-group monsters (1)
Needs: summoning in a random square, a recruit group that leaves player control and hunts a monster until it leaves
play, "cannot join groups / create recruits / enter structures" restrictions, and a start-of-combat "dies unless free"
check. (The other 18 creature cards shipped in plan 2c.)
- Questing Beast (Life)
```
Update the header sentence ("Implemented: 60 ...") to `Implemented: 78 (39 War, 39 Life)`.

- [ ] **Step 2: Counts and snapshot**

Make sure `meta.test.ts` asserts 78 playable (39 War, 39 Life) and 24 pending, and `faces.test.ts` asserts `Object.keys(faces)` equals `allCards.length` (hard-code the real number). Regenerate the snapshot (`cd packages/cards && npx vitest run test/faces.test.ts -u`), then read the whole snapshot once: every new card must read as short keyword text with no `undefined`, no empty lines, and no double parentheses; fix wording in the keyword definitions (not in the snapshot) and record again.

- [ ] **Step 3: Docs**

`docs/keyword-design.md`, section 6 ("As built"): add a line for creatures: `Monster`, `Create`, `Hero`, `Ambush` (words from section 3; `Flurry N` is unnecessary because a stat line's `(xN)` sets the attack count), behaviours `Territorial`, `Nomadic`, `Immobile`, combat `Against`, `Immune`, `Taunt`, `Aura`, effect `Novices`, trigger `When.moves`, target `.in(terrain)`; and note `Unique` became `Hero` plus the engine's once-per-game rule. `docs/card-text-guide.md`: replace section 7 ("Creature keywords") with a short description of the creature layer (summoned minions carry a non-visible spell of their own card, `host: 'minion'`; nations and houses on minions; stat lines are final stats, helper spells hold the bonuses), add `attacker:strikes` and `initiative:decide` rows to the event table in section 4, and `addMinion`, `createRecruit`, `addNovices`, `changeSides`, `hide`, `appear`, `setHome`, `setInitiative` to the action table in section 8.

- [ ] **Step 4: Run the whole repo, commit and tag**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "docs: creatures backlog, counts and keyword docs; pin faces of all cards"
git tag creatures
```

---

## After this plan

- Questing Beast (E1 remainder), then E6 (Faerie Circle), E8 (initiative and structures), E9 (conditional damage kinds), E10 (tokens and copies), E11 (one-offs), each as its own small plan in the keyword language.
- Plan 3: the hotseat web UI renders `cardFace(id)` and `keywordGlossary()`; nations and houses are already on every minion for the unit tiles.
- The scaffolder (scraped text to keyword list) now has creature stat lines and `Create`/`Monster` patterns to target.
