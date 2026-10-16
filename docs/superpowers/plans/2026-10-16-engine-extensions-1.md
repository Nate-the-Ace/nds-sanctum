# Engine Extensions, Wave 1 (30 more War and Life cards) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the engine features that unlock 30 of the 72 backlog cards (helper spells, max-hit-point stat, mana generation, movement control, combat withdrawal, casting restrictions, recruit-creation events) and implement those cards with tests, taking the implemented set from 30 to 60 of 102.

**Architecture:** Each extension is a small, additive engine change (new `CardDef` hook, `EventContext` method, event, or stat) with its own engine tests, followed by the cards it enables with card tests. Nothing in plans 1-2 changes meaning: new fields are optional, new events only fire where no handler existed before. "Helper spells" (engine-cast, never in a deck) are the shared mechanism for effects that must sit on another host (scars, armor damage, concealment).

**Tech Stack:** TypeScript strict ESM, Vitest, npm workspaces. No new dependencies.

**User decisions (already made):**
- "Write plan 2b: engine extensions for the card backlog, starting with the groups that unlock the most cards."
- Faithful clone; card scripts are TypeScript modules with hooks; private use only.

**Scope decisions made in this plan:**
1. The biggest group, monsters/heroes/nations (19 cards, backlog E1), is **not** in this plan. It needs a design pass (stat-line summoning, monster behaviours such as Territorial/Nomadic, nations, off-board appearance) and is plan 2c. Everything else that fits an additive change is here: backlog groups E2, E3, E4, E5, E7 in full, E6 except Faerie Circle, and Clandestine/Auberol's Grace from E8-style structure effects.
2. Order is by dependency, then by cards unlocked: helper spells (3 cards, and 5 more cards use them), max HP (5), mana (4), movement control (4), withdrawal (4), casting restrictions (8), creation events and concealment (2).
3. Where an engine clause cannot be expressed exactly, the card gets a `// RULING:` comment: Lone Wolf's "cannot join groups / add new recruits" is omitted; Standoff does not stop computer-controlled recruit groups (the original rules say bots overwrite forced movement); Amok uses one random direction for both moves; Lienna's Steed's "diagonal toward the opponent's edge" is +1,+1 for red and -1,-1 for blue; Auberol's Grace omits "colony becomes town" (no colonies exist yet); Thermites omits the Gargoyle clause (no Gargoyles exist).
4. Helper cards are registered in `allCards` (so the engine can find them) but excluded from decks (`helper: true`, rejected by `validateDeck`) and from the metadata test (no scraped record).

**Starting state (verified 2026-10-16):** engine 115 tests, cards 85 tests, scrape 6 tests, all green on branch `engine-core`; `packages/cards/src/index.ts` exports `allCards`, `cardIndex`, `cardData`, `pendingCards`; 30 cards implemented.

---

## File structure

```
packages/engine/src/
  cards.ts        MODIFY  helper, onExpire, blocksCast, CastAttempt
  ctx.ts          MODIFY  createSpell, addMana, setMoveOrder, setMovesTwice, legalDirections, canEnter,
                          moveGroup, endCombat; heal uses computed max
  stats.ts        MODIFY  maxHp, concealed; syncHp()
  events.ts       MODIFY  'mana:generate', 'minion:created'
  types.ts        MODIFY  Group.movesTwice
  units.ts        MODIFY  createGroup initialises movesTwice
  spells.ts       MODIFY  castCheck blocks, expireSpells onExpire, syncHp calls, concealed targeting
  turn.ts         MODIFY  mana:generate dispatch, minion:created dispatch
  movement.ts     MODIFY  export canEnterSquare; movePass + second pass for "moves twice"
  combat.ts       MODIFY  endCombat flag, combat:before cancel
  api.ts          MODIFY  validateDeck rejects helper cards
  testing.ts      MODIFY  more re-exports
packages/cards/src/
  helpers.ts      MODIFY  isFriendlyGroup, GROUP_TARGETS, INDIVIDUAL_TARGETS
  index.ts        MODIFY  playableCards
  war/*.ts life/*.ts       30 card files + 8 helper-spell files
```

Conventions: engine tests run from `packages/engine`, card tests from `packages/cards` (`npx vitest run`); typecheck with `npx tsc -p . --noEmit` in each; commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`. Whenever a task implements cards, it also deletes those cards' lines from `docs/superpowers/plans/cards-backlog.md` (the backlog test fails until it matches `pendingCards`).

---

### Task 0: Helper spells (`ctx.createSpell`) and three cards

**Goal:** Cards can create engine-owned helper spells on any host. Implement Thermites, Fountain of Youth and Faerie Glade with their helper spells, and fix the tests that hard-code card counts.

**Files:**
- Modify: `packages/engine/src/{cards.ts,ctx.ts,api.ts,testing.ts}`, `packages/cards/src/{index.ts,helpers.ts}`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta.test.ts,game.test.ts,backlog.test.ts}`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/createspell.test.ts`, `packages/cards/src/war/{thermites,thermiteDamage}.ts`, `packages/cards/src/life/{fountainOfYouth,youth,faerieGlade,faerieGladeSquare}.ts`, `packages/cards/test/helper-spells.test.ts`

**Acceptance Criteria:**
- [ ] `ctx.createSpell(cardId, host, opts?)` adds a spell owned by the creator (or `opts.owner`), ignores targeting and exclusivity, honours `opts.turns`, and throws for an unknown card id
- [ ] `validateDeck` rejects a card with `helper: true`
- [ ] Thermites: each hit the host recruit lands gives the victim a cumulative -1 armor helper spell
- [ ] Fountain of Youth: a group entering the square is fully healed and each member gets a -1 level helper spell
- [ ] Faerie Glade: every contiguous forest square gets a helper spell giving enemy recruits there -1 level
- [ ] Meta/registry/game/backlog tests no longer hard-code card counts and ignore helper cards

**Verify:** `cd packages/engine && npx vitest run && cd ../cards && npx vitest run` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/createspell.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateDeck } from '../src/api';
import { defineCard, indexCards } from '../src/cards';
import { spellsOn } from '../src/query';
import { executeCast } from '../src/spells';
import { computeStats } from '../src/stats';
import { blankEngine, put } from './helpers';

const scar = defineCard({
  id: 'scar', name: 'Scar', house: 'war', cost: {}, type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ armor: 2 }),
});
const maker = defineCard({
  id: 'maker', name: 'Maker', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('scar', t); },
});
const timed = defineCard({
  id: 'timed', name: 'Timed', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('scar', t, { turns: 2 }); },
});
const broken = defineCard({
  id: 'broken', name: 'Broken', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.createSpell('nope', t); },
});
const all = [scar, maker, timed, broken];

describe('ctx.createSpell', () => {
  it('adds a helper spell owned by the caster and applies its stats', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(executeCast(e, 'red', 'maker', { kind: 'minion', id })).toBe('cast');
    const spells = spellsOn(e.state, { kind: 'minion', id });
    expect(spells).toHaveLength(1);
    expect(spells[0]).toMatchObject({ cardId: 'scar', owner: 'red', visible: true, turnsLeft: null });
    expect(computeStats(e, id).armor).toBe(3);
  });

  it('ignores exclusivity: creating twice stacks', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'maker', { kind: 'minion', id });
    executeCast(e, 'red', 'maker', { kind: 'minion', id });
    expect(computeStats(e, id).armor).toBe(5);
  });

  it('honours a turns override', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'timed', { kind: 'minion', id });
    expect(spellsOn(e.state, { kind: 'minion', id })[0].turnsLeft).toBe(2);
  });

  it('throws for an unknown card id', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(() => executeCast(e, 'red', 'broken', { kind: 'minion', id })).toThrow(/unknown card "nope"/);
  });
});

describe('helper cards and decks', () => {
  it('validateDeck rejects a helper card', () => {
    const cards = indexCards(all);
    expect(validateDeck({ house: 'war', cards: ['scar'] }, cards, { minDeck: 1 })).toMatch(/helper/);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`cd packages/engine && npx vitest run test/createspell.test.ts`)

- [ ] **Step 3: Engine changes**

`src/cards.ts`: add this field to `CardDef` (after `ignoresConcealment`):
```ts
  /** Engine-cast helper spell: created by other cards through `ctx.createSpell`, never played from a deck. */
  helper?: boolean;
```
`src/ctx.ts`: extend imports with `addSpellRecord` and `recheck`:
```ts
import { addSpellRecord } from './spellstore';
import { dispel, recheck, recheckSquare } from './spells';
```
(replace the existing `./spells` import). Add to `EventContext`, after `draw(...)`:
```ts
  /**
   * Cast an engine-owned helper spell onto a host, ignoring targeting rules and exclusivity. Owner defaults to this
   * spell's owner; `turns` overrides the helper card's duration. Returns the new spell's id.
   */
  createSpell(cardId: string, host: Ref, opts?: { owner?: PlayerId; turns?: number | null }): number;
```
and to the object returned by `makeCtx`, after `draw`:
```ts
    createSpell: (cardId, host, opts) => {
      const card = e.cards[cardId];
      if (!card) throw new Error(`createSpell: unknown card "${cardId}"`);
      const made = addSpellRecord(e.state, {
        cardId, owner: opts?.owner ?? spell.owner, host, visible: card.visible !== false,
        turnsLeft: opts?.turns !== undefined ? opts.turns : (card.duration?.turns ?? null), tokens: {},
      });
      recheck(e, host);
      return made.id;
    },
```
`src/api.ts`: in `validateDeck`, right after the `unknown card` check inside the loop, add:
```ts
    if (cards[id].helper) return `"${id}" is a helper spell, not a playable card`;
```
`src/testing.ts`: append
```ts
export { expireSpells, dispel } from './spells';
```

- [ ] **Step 4: Run engine tests and typecheck**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass (119 tests).

- [ ] **Step 5: Commit the engine change**

```bash
git add packages/engine
git commit -m "feat(engine): helper spells via ctx.createSpell; validateDeck rejects helper cards"
```

- [ ] **Step 6: Make the cards package helper-aware**

`packages/cards/src/index.ts`: after `export const cardIndex = indexCards(allCards);` add
```ts
/** Cards a player can put in a deck (everything except engine-cast helper spells). */
export const playableCards = allCards.filter((c) => !c.helper);
```
`test/meta.test.ts`: change the per-card block to iterate `playableCards` (import it), i.e. `describe.skipIf(playableCards.length === 0)('implemented cards match their scraped record', () => { for (const card of playableCards) {...} })`, and change the registry test to
```ts
  it('implemented and pending partition the data', () => {
    expect(playableCards.length + pendingCards.length).toBe(cardData.length);
    for (const c of allCards) expect(cardIndex[c.id]).toBe(c);
  });
```
`test/game.test.ts`: in `deck()` filter `allCards.filter((c) => c.house === house && !c.helper)`, and delete any `toHaveLength(51)` / `toHaveLength(39)` assertions (keep the `validateDeck(...)` null checks).
`test/backlog.test.ts`: delete the `expect(listed).toHaveLength(72);` line.

- [ ] **Step 7: Write the failing card tests**

`packages/cards/test/helper-spells.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dispatch, fight } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, sref, stats, world } from './helpers';

const countOf = (e: ReturnType<typeof world>, cardId: string) => e.state.spells.filter((s) => s.cardId === cardId).length;

describe('Thermites', () => {
  it('gives the victim cumulative -1 armor on each hit', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [rid, bid] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'thermites', mref(rid))).toBe('cast');
    dispatch(e, 'attacker:hits', mref(rid), { victimId: bid });
    expect(stats(e, bid).armor).toBe(0);
    dispatch(e, 'attacker:hits', mref(rid), { victimId: bid });
    expect(countOf(e, 'thermite-damage')).toBe(2);
  });

  it('shortens a real fight: the armored victim dies in round 5', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const rid = red.minionIds[0];
    cast(e, 'red', 'thermites', mref(rid));
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
    expect(e.state.minions[rid].hp).toBe(4);
  });
});

describe('Fountain of Youth', () => {
  it('fully heals a group entering the square and lowers its levels', () => {
    const e = world();
    expect(cast(e, 'red', 'fountain-of-youth', sref(5, 5))).toBe('cast');
    const g = put(e, 'red', { x: 5, y: 5 }, ['swordsman', 'swordsman']);
    const [a, b] = [...g.minionIds];
    e.state.minions[a].hp = 3;
    dispatch(e, 'group:enter', gref(g.id), {});
    expect(e.state.minions[a].hp).toBe(7);
    expect(stats(e, a).level).toBe(0);
    expect(stats(e, b).level).toBe(0);
    expect(countOf(e, 'youth')).toBe(2);
  });
});

describe('Faerie Glade', () => {
  it('lowers enemy recruit levels on every contiguous forest square', () => {
    const e = world();
    for (const k of ['4,4', '5,4', '8,2']) e.state.terrain[k] = 'forest';
    expect(cast(e, 'red', 'faerie-glade', sref(4, 4))).toBe('cast');
    expect(countOf(e, 'faerie-glade-square')).toBe(2);
    const enemy = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    const friend = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const far = put(e, 'blue', { x: 8, y: 2 }, ['swordsman']).minionIds[0];
    expect(stats(e, enemy).level).toBe(0);
    expect(stats(e, friend).level).toBe(1);
    expect(stats(e, far).level).toBe(1);
  });
});
```

- [ ] **Step 8: Run to verify failure, then write the card files**

`src/war/thermiteDamage.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: created on a victim by Thermites. Cumulative (createSpell ignores exclusivity).
export default defineCard({
  id: 'thermite-damage', name: 'Thermite Damage', house: 'war', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ armor: -1 }),
});
```
`src/war/thermites.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isHostMinion } from '../helpers';

// RULING: the "ignores armor against Gargoyles" clause is omitted (no Gargoyles exist yet).
export default defineCard({
  id: 'thermites', name: 'Thermites', house: 'war', cost: { strife: 2 },
  type: 'alteration', target: 'recruit',
  on: {
    'attacker:hits': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const victim = c.minion(ev.data.victimId);
      if (victim) c.createSpell('thermite-damage', { kind: 'minion', id: victim.id });
    },
  },
});
```
`src/life/youth.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: created on each member of a group that enters a Fountain of Youth.
export default defineCard({
  id: 'youth', name: 'Youth', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ level: -1 }),
});
```
`src/life/fountainOfYouth.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'fountain-of-youth', name: 'Fountain of Youth', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'square',
  on: {
    'group:enter': (c, ev) => {
      const g = ev.ref?.kind === 'group' ? c.group(ev.ref.id) : undefined;
      if (!g) return;
      for (const m of c.minionsOf(g.id)) {
        c.heal(m.id, m.maxHp);
        c.createSpell('youth', { kind: 'minion', id: m.id });
      }
    },
  },
});
```
`src/life/faerieGladeSquare.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: one per forest square of a Faerie Glade. Enemy recruits standing here get -1 level.
export default defineCard({
  id: 'faerie-glade-square', name: 'Faerie Glade', house: 'life', cost: {},
  type: 'alteration', target: 'square', helper: true,
  stats: (q, id, spell) => {
    const m = q.minion(id);
    return m && m.kind === 'recruit' && m.owner !== spell.owner ? { level: -1 } : {};
  },
});
```
`src/life/faerieGlade.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { contiguous } from '../helpers';

// RULING: the engine only lets square spells target empty squares, so the target forest square must be unoccupied.
export default defineCard({
  id: 'faerie-glade', name: 'Faerie Glade', house: 'life', cost: { clarity: 3, world: 3 },
  type: 'manifestation', target: 'square',
  canCast: (q, t) => t.kind === 'square' && q.terrainAt(t.pos) === 'forest',
  onCast: (c, t) => {
    if (t.kind !== 'square') return;
    for (const p of contiguous(c, t.pos, 'forest')) c.createSpell('faerie-glade-square', { kind: 'square', pos: p });
  },
});
```
Register in the house indexes: add to `src/war/index.ts` the imports `thermites` and `thermiteDamage` and append `thermites, thermiteDamage` to `warCards`; add to `src/life/index.ts` the imports `fountainOfYouth`, `youth`, `faerieGlade`, `faerieGladeSquare` and append all four to `lifeCards`.

- [ ] **Step 9: Update the backlog**

Delete these lines from `docs/superpowers/plans/cards-backlog.md`: `- Thermites (War)`, `- Faerie Glade (Life)`, `- Fountain of Youth (Life)`.

- [ ] **Step 10: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all workspaces pass. (Thermites fight arithmetic: blue armor 1 -> round 2 hit does 1, later hits 2; blue dies in round 5; red takes 1 per round in rounds 2-4 and ends at 4 hp.)

```bash
git add -A
git commit -m "feat(cards): Thermites, Fountain of Youth, Faerie Glade with helper spells"
```

---

### Task 1: Maximum hit points as a stat, and five cards

**Goal:** `maxHp` becomes a computed stat so "+N maximum and current hit points" effects work and clamp correctly when removed. Implement Veteran, Marksman, Faerie Knight, Elixir Vitae and Field Surgery.

**Files:**
- Modify: `packages/engine/src/{stats.ts,spells.ts,ctx.ts}`, `packages/cards/src/helpers.ts`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/maxhp.test.ts`, `packages/cards/src/war/{veteran,marksman,fieldSurgery,fieldSurgeryScar}.ts`, `packages/cards/src/life/{faerieKnight,elixirVitae,dropOfElixirVitae}.ts`, `packages/cards/test/maxhp-cards.test.ts`

**Acceptance Criteria:**
- [ ] `computeStats().maxHp` = base hp + spell deltas, never below 1; `Minion.maxHp` is kept in sync
- [ ] After a cast and after a dispel, current hp is clamped to the computed max; `ctx.heal` heals up to the computed max
- [ ] Veteran: +1 hand, +1 armor, +4 max and current hp; Marksman (archer): +1 missile, +1 attack, +2 max and current hp
- [ ] Faerie Knight: +4 max and current hp; combat damage from recruits without enchantments is cancelled after armor
- [ ] Elixir Vitae: every recruit on the board gets a +6 max hp helper spell (monsters and off-board units do not)
- [ ] Field Surgery: each damaged member gets a permanent, undispellable -1 max hp helper and is fully healed

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/maxhp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { dispel, executeCast } from '../src/spells';
import { spellsOn } from '../src/query';
import { computeStats } from '../src/stats';
import { blankEngine, put } from './helpers';

const buff = defineCard({
  id: 'buff', name: 'Buff', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: 4 }),
  onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, 4); },
});
const mend = defineCard({
  id: 'mend', name: 'Mend', house: 'war', cost: {}, type: 'manifestation', target: 'recruit',
  onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, 100); },
});
const crush = defineCard({
  id: 'crush', name: 'Crush', house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: -99 }),
});

describe('maxHp stat', () => {
  it('adds to max and current hp on cast', () => {
    const e = blankEngine([buff]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    expect(computeStats(e, id).maxHp).toBe(11);
    expect(e.state.minions[id].maxHp).toBe(11);
    expect(e.state.minions[id].hp).toBe(11);
  });

  it('clamps current hp when the spell is dispelled', () => {
    const e = blankEngine([buff]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    dispel(e, spellsOn(e.state, { kind: 'minion', id })[0].id);
    expect(e.state.minions[id].maxHp).toBe(7);
    expect(e.state.minions[id].hp).toBe(7);
  });

  it('heal stops at the computed max', () => {
    const e = blankEngine([buff, mend]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'buff', { kind: 'minion', id });
    e.state.minions[id].hp = 3;
    executeCast(e, 'red', 'mend', { kind: 'minion', id });
    expect(e.state.minions[id].hp).toBe(11);
  });

  it('never drops below 1', () => {
    const e = blankEngine([crush]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'crush', { kind: 'minion', id });
    expect(computeStats(e, id).maxHp).toBe(1);
    expect(e.state.minions[id].hp).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/stats.ts`:
- Add `maxHp?: number;` to `StatDelta` and `maxHp: number;` to `Stats`.
- In `computeStats`, add `maxHp: b.hp,` to the initial `out` object, add `out.maxHp += d.maxHp ?? 0;` inside the delta loop, and after the existing clamps add `out.maxHp = Math.max(1, out.maxHp);`.
- Append this function (and import `Engine` is already present):
```ts
/** Recompute every live minion's maximum hit points and clamp current hit points to it. */
export function syncHp(e: Engine): void {
  for (const m of Object.values(e.state.minions)) {
    if (m.status === 'dead') continue;
    const max = computeStats(e, m.id).maxHp;
    m.maxHp = max;
    if (m.hp > max) m.hp = max;
  }
}
```
`src/spells.ts`: import `syncHp` (`import { syncHp } from './stats';`). In `dispel`, call `syncHp(e);` as the last statement (after `recheck(e, sp.host);`). In `executeCast`, call `syncHp(e);` immediately before `return 'cast';`.
`src/ctx.ts`: import `syncHp` alongside `computeStats` (`import { computeStats, syncHp, type Stats } from './stats';`). Replace the `heal` implementation with:
```ts
    heal: (id, amount) => {
      const m = e.state.minions[id];
      if (!m || m.status === 'dead') return;
      m.maxHp = computeStats(e, id).maxHp;
      m.hp = Math.min(m.maxHp, m.hp + Math.max(0, amount));
    },
```
and in `createSpell` (added in Task 0) call `syncHp(e);` after `recheck(e, host);`.

- [ ] **Step 4: Run engine tests and typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass.
```bash
git add packages/engine
git commit -m "feat(engine): maxHp stat with hit point sync on cast, dispel and heal"
```

- [ ] **Step 5: Add `isFriendlyGroup` to `packages/cards/src/helpers.ts`**

```ts
/** canCast: the target group is owned by the caster. */
export const isFriendlyGroup = (q: QueryContext, t: Ref): boolean => t.kind === 'group' && q.group(t.id)?.owner === q.caster;
```

- [ ] **Step 6: Write the failing card tests**

`packages/cards/test/maxhp-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { takeDamage } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, putMonster, stats, world } from './helpers';

const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

describe('Veteran', () => {
  it('adds hand, armor and hit points, and loses them when dispelled', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'veteran', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect([st.hand, st.armor, st.maxHp]).toEqual([3, 2, 11]);
    expect(e.state.minions[id].hp).toBe(11);
    cast(e, 'blue', 'cleansing-light', gref(g.id));
    expect(e.state.minions[id].hp).toBe(7);
    expect(e.state.minions[id].maxHp).toBe(7);
  });
});

describe('Marksman', () => {
  it('buffs an archer and refuses a swordsman', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    const s = put(e, 'red', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'marksman', mref(s))).toBe('squandered');
    expect(cast(e, 'red', 'marksman', mref(a))).toBe('cast');
    const st = stats(e, a);
    expect([st.missile, st.missileAttacks, st.maxHp]).toEqual([3, 2, 9]);
    expect(e.state.minions[a].hp).toBe(9);
  });
});

describe('Faerie Knight', () => {
  it('adds 4 hit points and cancels combat damage from unenchanted recruits', () => {
    const e = world();
    const knight = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'faerie-knight', mref(knight))).toBe('cast');
    expect(e.state.minions[knight].hp).toBe(11);
    e.state.minions[knight].combat.armor = 1;
    expect(takeDamage(e, knight, 3, hand, foe)).toBe('bounced');
    expect(e.state.minions[knight].hp).toBe(11);
  });
  it('still takes damage from an enchanted attacker', () => {
    const e = world();
    const knight = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    cast(e, 'red', 'faerie-knight', mref(knight));
    cast(e, 'blue', 'flaming-sword', mref(foe));
    e.state.minions[knight].combat.armor = 1;
    expect(takeDamage(e, knight, 3, hand, foe)).toBe('damaged');
    expect(e.state.minions[knight].hp).toBe(9);
  });
});

describe('Elixir Vitae', () => {
  it('gives every recruit on the board +6 max hit points, not monsters', () => {
    const e = world();
    const r = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const b = put(e, 'blue', { x: 6, y: 6 }, ['archer']).minionIds[0];
    const mon = putMonster(e, 'blue', { x: 8, y: 2 }).minionIds[0];
    expect(cast(e, 'red', 'elixir-vitae', { kind: 'globe' })).toBe('cast');
    expect(stats(e, r).maxHp).toBe(13);
    expect(stats(e, b).maxHp).toBe(13);
    expect(stats(e, mon).maxHp).toBe(12);
    expect(e.state.minions[r].hp).toBe(7);
  });
});

describe('Field Surgery', () => {
  it('fully heals damaged members at the price of 1 max hp, permanently', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const [hurt, fine] = [...g.minionIds];
    e.state.minions[hurt].hp = 3;
    expect(cast(e, 'blue', 'field-surgery', gref(g.id))).toBe('squandered');
    expect(cast(e, 'red', 'field-surgery', gref(g.id))).toBe('cast');
    expect(e.state.minions[hurt].maxHp).toBe(6);
    expect(e.state.minions[hurt].hp).toBe(6);
    expect(e.state.minions[fine].maxHp).toBe(7);
    cast(e, 'blue', 'cleansing-light', gref(g.id));
    expect(e.state.minions[hurt].maxHp).toBe(6);
  });
});
```

- [ ] **Step 7: Run to verify failure, then write the card files**

`src/war/veteran.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'veteran', name: 'Veteran', house: 'war', cost: { strife: 3 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ hand: 1, armor: 1, maxHp: 4 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 4);
  },
});
```
`src/war/marksman.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'marksman', name: 'Marksman', house: 'war', cost: { strife: 3, clarity: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('archer'),
  stats: () => ({ missile: 1, missileAttacks: 1, maxHp: 2 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 2);
  },
});
```
`src/war/fieldSurgeryScar.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: permanent (non-visible, so undispellable) -1 maximum hit point left by Field Surgery.
export default defineCard({
  id: 'field-surgery-scar', name: 'Field Surgery', house: 'war', cost: {},
  type: 'alteration', target: 'recruit', helper: true, visible: false,
  stats: () => ({ maxHp: -1 }),
});
```
`src/war/fieldSurgery.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isFriendlyGroup } from '../helpers';

export default defineCard({
  id: 'field-surgery', name: 'Field Surgery', house: 'war', cost: { strife: 1, clarity: 1 },
  type: 'manifestation', target: 'recruitGroup',
  canCast: isFriendlyGroup,
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    for (const m of c.minionsOf(t.id)) {
      if (m.hp >= m.maxHp) continue;
      c.createSpell('field-surgery-scar', { kind: 'minion', id: m.id });
      c.heal(m.id, 99);
    }
  },
});
```
`src/life/faerieKnight.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { hasEnchantments, isHostMinion } from '../helpers';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default defineCard({
  id: 'faerie-knight', name: 'Faerie Knight', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ maxHp: 4 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 4);
  },
  on: {
    'armor:after': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const attacker = ev.data.attackerId == null ? undefined : c.minion(ev.data.attackerId);
      if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) c.cancel();
    },
  },
});
```
`src/life/dropOfElixirVitae.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: +6 maximum hit points from Elixir Vitae (an enchantment, so it can be dispelled).
export default defineCard({
  id: 'drop-of-elixir-vitae', name: 'Drop of Elixir Vitae', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ maxHp: 6 }),
});
```
`src/life/elixirVitae.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'elixir-vitae', name: 'Elixir Vitae', house: 'life', cost: { clarity: 2, world: 2 },
  type: 'manifestation', target: 'globe',
  onCast: (c) => {
    for (const m of Object.values(c.state.minions)) {
      if (m.kind === 'recruit' && m.status === 'alive' && c.group(m.groupId)?.pos) {
        c.createSpell('drop-of-elixir-vitae', { kind: 'minion', id: m.id });
      }
    }
  },
});
```
Register in the house indexes: war gets `veteran, marksman, fieldSurgery, fieldSurgeryScar`; life gets `faerieKnight, elixirVitae, dropOfElixirVitae`.

- [ ] **Step 8: Update the backlog**

Delete these lines from `cards-backlog.md`: `- Field Surgery (War)`, `- Marksman (War)`, `- Veteran (War)`, `- Elixir Vitae (Life)`, `- Faerie Knight (Life)`. (Lone Wolf stays; it lands in Task 5.)

- [ ] **Step 9: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(cards): Veteran, Marksman, Faerie Knight, Elixir Vitae, Field Surgery"
```

---

### Task 2: Mana generation, and four cards

**Goal:** A `mana:generate` event fires after structures produce mana each turn, and `ctx.addMana` lets spells add to a player's pool. Implement Point of Clarity, Aura of World, Call to Arms and Ring of Light.

**Files:**
- Modify: `packages/engine/src/{events.ts,turn.ts,ctx.ts}`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/manaevent.test.ts`, `packages/cards/src/war/{pointOfClarity,callToArms}.ts`, `packages/cards/src/life/{auraOfWorld,ringOfLight}.ts`, `packages/cards/test/mana-cards.test.ts`

**Acceptance Criteria:**
- [ ] `mana:generate` fires in `finishTurnStart` after town production; pools are already reset at that point
- [ ] `ctx.addMana(side, type, n)` adds to that side's pool
- [ ] Point of Clarity / Aura of World: +1 Clarity / +1 World each turn for the caster; stacks when cast more than once
- [ ] Call to Arms / Ring of Light: +2 Strife / +2 Clarity each turn for whoever currently owns the town (nothing if neutral)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/manaevent.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { beginTurn } from '../src/turn';
import { gameEngine } from './helpers';

const gen = defineCard({
  id: 'gen', name: 'Gen', house: 'war', cost: {}, type: 'alteration', target: 'globe', exclusive: false,
  on: { 'mana:generate': (c) => { if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'will', 2); } },
});
const globe = { kind: 'globe' as const };

describe('mana:generate', () => {
  it('lets a spell add mana after the pools are reset', () => {
    const e = gameEngine([gen]);
    e.state.players.blue.mana.will = 9; // stale mana from last turn must not survive
    addSpellRecord(e.state, { cardId: 'gen', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    addSpellRecord(e.state, { cardId: 'gen', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.blue.mana.will).toBe(4);
    expect(e.state.players.red.mana.will).toBe(0);
  });

  it('runs after town production', () => {
    const e = gameEngine([gen], [], { towns: 1 });
    const town = Object.values(e.state.structures).find((s) => s.kind === 'town')!;
    town.owner = 'red';
    town.manaType = 'strife';
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.red.mana.strife).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/events.ts`: add `'mana:generate'` to the untargeted group of `EventType` (after `'combat:before'`: `| 'mana:generate'`).
`src/turn.ts`: at the end of `finishTurnStart`, before `s.phase = 'orders';`, add `dispatch(e, 'mana:generate');`.
`src/ctx.ts`: import `Mana` in the types import; add to `EventContext`:
```ts
  /** Adds mana to a player's pool for this turn. Use from a `mana:generate` handler. */
  addMana(side: Side, mana: Mana, amount: number): void;
```
and to `makeCtx`:
```ts
    addMana: (side, mana, amount) => {
      e.state.players[side].mana[mana] += amount;
    },
```

- [ ] **Step 4: Run engine tests, typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
```bash
git add packages/engine
git commit -m "feat(engine): mana:generate event and ctx.addMana"
```

- [ ] **Step 5: Write the failing card tests**

`packages/cards/test/mana-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { advance, cast, world } from './helpers';

const globe = { kind: 'globe' as const };
const town = (owner: 'red' | 'blue' | 'neutral') => ({
  id: 900, kind: 'town' as const, pos: { x: 4, y: 4 }, owner, manaType: null, novices: 0, turnCount: 2, captured: false,
});

describe('Point of Clarity and Aura of World', () => {
  it('give +1 Clarity / +1 World each turn and stack', () => {
    const e = world();
    expect(cast(e, 'red', 'point-of-clarity', globe)).toBe('cast');
    expect(cast(e, 'red', 'point-of-clarity', globe)).toBe('cast');
    expect(cast(e, 'red', 'aura-of-world', globe)).toBe('cast');
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
    expect(e.state.players.red.mana.world).toBe(1);
    expect(e.state.players.blue.mana.clarity).toBe(0);
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
  });
});

describe('Call to Arms and Ring of Light', () => {
  it('pay +2 mana to whoever owns the town', () => {
    const e = world();
    e.state.structures[900] = town('red');
    expect(cast(e, 'red', 'call-to-arms', { kind: 'structure', id: 900 })).toBe('cast');
    expect(cast(e, 'red', 'ring-of-light', { kind: 'structure', id: 900 })).toBe('cast');
    advance(e);
    expect(e.state.players.red.mana.strife).toBe(2);
    expect(e.state.players.red.mana.clarity).toBe(2);
    e.state.structures[900].owner = 'blue';
    advance(e);
    expect(e.state.players.blue.mana.strife).toBe(2);
    expect(e.state.players.red.mana.strife).toBe(0);
  });

  it('pay nothing while the town is neutral', () => {
    const e = world();
    e.state.structures[900] = town('neutral');
    cast(e, 'red', 'call-to-arms', { kind: 'structure', id: 900 });
    advance(e);
    expect(e.state.players.red.mana.strife).toBe(0);
    expect(e.state.players.blue.mana.strife).toBe(0);
  });
});
```

- [ ] **Step 6: Run to verify failure, then write the card files**

`src/war/pointOfClarity.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'point-of-clarity', name: 'Point of Clarity', house: 'war', cost: { strife: 4 },
  type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'clarity', 1);
    },
  },
});
```
`src/war/callToArms.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'call-to-arms', name: 'Call to Arms', house: 'war', cost: { clarity: 5 },
  type: 'alteration', target: 'structure',
  on: {
    'mana:generate': (c) => {
      const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
      if (st && st.owner !== 'neutral') c.addMana(st.owner, 'strife', 2);
    },
  },
});
```
`src/life/auraOfWorld.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'aura-of-world', name: 'Aura of World', house: 'life', cost: { clarity: 4 },
  type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'world', 1);
    },
  },
});
```
`src/life/ringOfLight.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'ring-of-light', name: 'Ring of Light', house: 'life', cost: { world: 5 },
  type: 'alteration', target: 'structure',
  on: {
    'mana:generate': (c) => {
      const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
      if (st && st.owner !== 'neutral') c.addMana(st.owner, 'clarity', 2);
    },
  },
});
```
Register: war gets `pointOfClarity, callToArms`; life gets `auraOfWorld, ringOfLight`.

- [ ] **Step 7: Update the backlog**

Delete `- Call to Arms (War)`, `- Point of Clarity (War)`, `- Aura of World (Life)`, `- Ring of Light (Life)`.

- [ ] **Step 8: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
```bash
git add -A
git commit -m "feat(cards): Point of Clarity, Aura of World, Call to Arms, Ring of Light"
```

---

### Task 3: Movement control, and four cards

**Goal:** Spells can set/clear move orders, make a group move twice, list its legal directions, and relocate it. Implement Forced March, Amok, Standoff and Lienna's Steed.

**Files:**
- Modify: `packages/engine/src/{types.ts,units.ts,movement.ts,ctx.ts}`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/movecontrol.test.ts`, `packages/cards/src/war/{forcedMarch,amok}.ts`, `packages/cards/src/life/{standoff,liennasSteed}.ts`, `packages/cards/test/move-cards.test.ts`

**Acceptance Criteria:**
- [ ] `Group.movesTwice` (default false) makes a group repeat its order in a second movement pass after `movement:after`; the flag and orders are cleared afterwards
- [ ] `ctx.setMoveOrder`, `ctx.setMovesTwice`, `ctx.legalDirections`, `ctx.canEnter`, `ctx.moveGroup` behave as specified below
- [ ] Forced March: a group ordered east ends two squares east; Amok: moves exactly two squares in one random legal direction (player-controlled)
- [ ] Standoff: while active, recruit groups' move orders are cleared at `movement:before`; lasts the casting turn plus the next
- [ ] Lienna's Steed: a friendly group moves one square diagonally (+1,+1 red / -1,-1 blue) if legal and empty, and its move order is cleared

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/movecontrol.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { runMovement } from '../src/movement';
import { executeCast } from '../src/spells';
import { blankEngine, put } from './helpers';

const twice = defineCard({
  id: 'twice', name: 'Twice', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.setMovesTwice(t.id); },
});
const halt = defineCard({
  id: 'halt', name: 'Halt', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.setMoveOrder(t.id, null); },
});
const probe = defineCard({
  id: 'probe', name: 'Probe', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const bit = { n: 1, e: 2, s: 4, w: 8 } as const;
    c.setToken('mask', c.legalDirections(t.id).reduce((m, d) => m + bit[d], 0));
  },
});
const jump = defineCard({
  id: 'jump', name: 'Jump', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => { if (t.kind === 'group') c.moveGroup(t.id, { x: 8, y: 2 }); },
});
const all = [twice, halt, probe, jump];

describe('movement control', () => {
  it('moves a "moves twice" group twice along its order, then clears the flag', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'twice', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 3 });
    expect(g.movesTwice).toBe(false);
    expect(g.moveOrder).toBeNull();
  });

  it('a spell can cancel an order', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'halt', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 3, y: 3 });
  });

  it('the second step is blocked like any move (water stops it)', () => {
    const e = blankEngine(all);
    e.state.terrain['5,3'] = 'water';
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    executeCast(e, 'red', 'twice', { kind: 'group', id: g.id });
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 3 });
  });

  it('lists legal directions, skipping the board edge and blocked terrain', () => {
    const e = blankEngine(all);
    e.state.terrain['1,5'] = 'mountain';
    const g = put(e, 'red', { x: 0, y: 5 }, ['swordsman']);
    executeCast(e, 'red', 'probe', { kind: 'group', id: g.id });
    expect(e.state.spells[0].tokens.mask).toBe(1 + 4); // n and s only: east is a mountain, west is off the board
  });

  it('moveGroup relocates into an empty square and refuses an occupied one', () => {
    const e = blankEngine(all);
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: g.id });
    expect(g.pos).toEqual({ x: 8, y: 2 });
    const h = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    executeCast(e, 'red', 'jump', { kind: 'group', id: h.id });
    expect(h.pos).toEqual({ x: 4, y: 4 });
  });
});
```
(The `probe` card stores the legal directions as a bit mask in its spell token so the test can read them back.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/types.ts`: add `movesTwice: boolean;` to `Group` (after `moveSeq`).
`src/units.ts`: in `createGroup`, add `movesTwice: false` to the group literal.
`src/movement.ts`:
- Change `function canEnterSquare(` to `export function canEnterSquare(`.
- Replace everything from the `/** The movement phase ...` doc comment to the end of the file with:
```ts
/** One movement pass: pass I (every group, or only those in `only`), pass II stacking, then notifications. */
function movePass(e: Engine, only?: Set<number>): void {
  const s = e.state;
  const list: Group[] = [];
  for (const p of sequence(s)) {
    const mine = s.groupSeq[p].map((id) => s.groups[id]).filter((g): g is Group => !!g && g.pos !== null);
    const players = mine.filter((g) => g.control === 'player');
    const issued = players.filter((g) => g.moveSeq !== null).sort((a, b) => a.moveSeq! - b.moveSeq!);
    const rest = players.filter((g) => g.moveSeq === null);
    list.push(...issued, ...rest, ...mine.filter((g) => g.control === 'computer'));
  }
  const tracks: Tracks = new Map();
  list.forEach((g, i) => tracks.set(g.id, { start: { ...g.pos! }, moved: false, bounced: false, seq: i, notified: false }));

  for (const g of list) {
    if (!g.moveOrder || !g.pos) continue;
    if (only && !only.has(g.id)) continue;
    if (g.owner === 'neutral' && g.control === 'player') continue;
    const dest = step(g.pos, g.moveOrder);
    if (!canEnterSquare(e, g, dest)) continue;
    if (groupsAt(s, dest).some((o) => o.id !== g.id && hostile(g, o))) continue;
    g.pos = dest;
    trackOf(tracks, g).moved = true;
  }
  resolveStacks(e, tracks);
  for (const g of list) {
    const cur = s.groups[g.id];
    if (cur) notify(e, cur, trackOf(tracks, cur));
  }
}

/**
 * The movement phase (rules: Pipelines/movement). Reads `moveOrder` from every group, then clears it.
 * Groups with `movesTwice` repeat their order in a second pass after "after movement" effects.
 */
export function runMovement(e: Engine): void {
  const s = e.state;
  dispatch(e, 'movement:before');
  for (const g of Object.values(s.groups)) if (g.control === 'computer') g.moveOrder = botMove(e, g);
  movePass(e);
  dispatch(e, 'movement:after');
  const again = new Set(
    Object.values(s.groups).filter((g) => g.movesTwice && g.moveOrder !== null).map((g) => g.id),
  );
  if (again.size > 0) movePass(e, again);
  for (const g of Object.values(s.groups)) {
    g.moveOrder = null;
    g.moveSeq = null;
    g.movesTwice = false;
  }
}
```
`src/turn.ts`: in `resolveTurn`, in the loop that resets orders (`g.moveOrder = null; g.moveSeq = null;`) add `g.movesTwice = false;`.
`src/ctx.ts`: extend the `./board` import with `DIR_LIST, step`; add `import { canEnterSquare } from './movement';`; extend the terrainfx import with `groupCanEnter`; import type `Dir`. Add to `EventContext`:
```ts
  /** Overwrite a group's movement order for this turn (null cancels it). */
  setMoveOrder(groupId: number, dir: Dir | null): void;
  /** "Moves twice": repeat the order in a second movement pass. */
  setMovesTwice(groupId: number, value?: boolean): void;
  /** Directions the group could step into right now (square exists, terrain and structure rules allow it). */
  legalDirections(groupId: number): Dir[];
  /** Whether the group's minions can all enter `pos` (square exists and terrain allows it). */
  canEnter(groupId: number, pos: Pos): boolean;
  /** Relocate a group to an empty square without moving through the squares between. Does nothing if occupied. */
  moveGroup(groupId: number, pos: Pos): void;
```
and to `makeCtx`:
```ts
    setMoveOrder: (id, dir) => {
      const g = e.state.groups[id];
      if (g) g.moveOrder = dir;
    },
    setMovesTwice: (id, value = true) => {
      const g = e.state.groups[id];
      if (g) g.movesTwice = value;
    },
    legalDirections: (id) => {
      const g = e.state.groups[id];
      if (!g || !g.pos) return [];
      const from = g.pos;
      return DIR_LIST.filter((d) => canEnterSquare(e, g, step(from, d)));
    },
    canEnter: (id, pos) => {
      const g = e.state.groups[id];
      return !!g && e.state.cells.includes(key(pos)) && groupCanEnter(e, g, e.state.terrain[key(pos)]);
    },
    moveGroup: (id, pos) => {
      const s = e.state;
      const g = s.groups[id];
      if (!g || !g.pos || !s.cells.includes(key(pos))) return;
      const other = groupAt(s, pos);
      if (other && other.id !== id) return;
      const from = g.pos;
      g.pos = { ...pos };
      checkFatal(e, g);
      recheckSquare(e, from);
      recheckSquare(e, pos);
    },
```

- [ ] **Step 4: Run engine tests, typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass (existing movement tests keep passing: `runMovement` behaviour is unchanged for groups without `movesTwice`).
```bash
git add packages/engine
git commit -m "feat(engine): movement control - set orders, move twice, legal directions, relocate"
```

- [ ] **Step 5: Write the failing card tests**

`packages/cards/test/move-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runMovement } from '@sanctum/engine/src/testing';
import { cast, gref, put, world } from './helpers';

describe('Forced March', () => {
  it('moves the group two squares along its order', () => {
    const e = world();
    const g = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    g.moveOrder = 'e';
    expect(cast(e, 'red', 'forced-march', gref(g.id))).toBe('cast');
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 3 });
  });
});

describe('Amok', () => {
  it('moves a player-controlled group two squares in one random legal direction', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    g.moveOrder = 'e';
    expect(cast(e, 'red', 'amok', gref(g.id))).toBe('cast');
    runMovement(e);
    const d = Math.abs(g.pos!.x - 4) + Math.abs(g.pos!.y - 4);
    expect(d).toBe(2);
    expect(g.pos!.x === 4 || g.pos!.y === 4).toBe(true);
  });
});

describe('Standoff', () => {
  it('cancels every recruit group move order while active', () => {
    const e = world();
    const a = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    const b = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    a.moveOrder = 'e';
    b.moveOrder = 'w';
    expect(cast(e, 'red', 'standoff', { kind: 'globe' })).toBe('cast');
    runMovement(e);
    expect(a.pos).toEqual({ x: 3, y: 3 });
    expect(b.pos).toEqual({ x: 6, y: 6 });
  });
});

describe("Lienna's Steed", () => {
  it('moves a friendly group one square diagonally toward the enemy and cancels its order', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    red.moveOrder = 'n';
    expect(cast(e, 'red', 'liennas-steed', gref(red.id))).toBe('cast');
    expect(red.pos).toEqual({ x: 5, y: 5 });
    expect(red.moveOrder).toBeNull();
    expect(cast(e, 'blue', 'liennas-steed', gref(blue.id))).toBe('cast');
    expect(blue.pos).toEqual({ x: 6, y: 6 }); // its (-1,-1) square (5,5) is now occupied by red
  });
  it('cannot target an enemy group', () => {
    const e = world();
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'liennas-steed', gref(blue.id))).toBe('squandered');
  });
  it('stays put when the diagonal square is occupied', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    cast(e, 'red', 'liennas-steed', gref(red.id));
    expect(red.pos).toEqual({ x: 4, y: 4 });
  });
});
```
- [ ] **Step 6: Run to verify failure, then write the card files**

`src/war/forcedMarch.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'forced-march', name: 'Forced March', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind === 'group') c.setMovesTwice(t.id);
  },
});
```
`src/war/amok.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// RULING: the random direction is picked once and used for both moves.
export default defineCard({
  id: 'amok', name: 'Amok', house: 'war', cost: { strife: 4, clarity: 3 },
  type: 'manifestation', target: 'recruitGroup',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    c.setMovesTwice(t.id);
    if (c.group(t.id)?.control === 'player') {
      const dirs = c.legalDirections(t.id);
      if (dirs.length > 0) c.setMoveOrder(t.id, dirs[Math.floor(c.random() * dirs.length)]);
    }
  },
});
```
`src/life/standoff.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// "Turn of casting +1" = the casting turn and the next. RULING: computer-controlled recruit groups choose their own
// orders after "before movement" effects (rules: Pipelines/movement), so Standoff cannot stop them.
export default defineCard({
  id: 'standoff', name: 'Standoff', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 2 },
  on: {
    'movement:before': (c) => {
      for (const g of Object.values(c.state.groups)) {
        if (g.kind !== 'recruit') continue;
        c.setMoveOrder(g.id, null);
        c.setMovesTwice(g.id, false);
      }
    },
  },
});
```
`src/life/liennasSteed.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isFriendlyGroup } from '../helpers';

// RULING: "diagonally toward the opponent's edge" is +1,+1 for red and -1,-1 for blue on our grid.
export default defineCard({
  id: 'liennas-steed', name: "Lienna's Steed", house: 'life', cost: { clarity: 2, world: 2 },
  type: 'manifestation', target: 'recruitGroup',
  canCast: isFriendlyGroup,
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const g = c.group(t.id);
    if (!g?.pos) return;
    const d = c.spell.owner === 'red' ? 1 : -1;
    const dest = { x: g.pos.x + d, y: g.pos.y + d };
    if (c.canEnter(t.id, dest) && !c.groupAt(dest)) c.moveGroup(t.id, dest);
    c.setMoveOrder(t.id, null);
  },
});
```
Register: war gets `forcedMarch, amok`; life gets `standoff, liennasSteed`.

- [ ] **Step 7: Update the backlog**

Delete `- Amok (War)`, `- Forced March (War)`, `- Lienna's Steed (Life)`, `- Standoff (Life)`.

- [ ] **Step 8: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
```bash
git add -A
git commit -m "feat(cards): Forced March, Amok, Standoff, Lienna's Steed"
```

---

### Task 4: Combat withdrawal, and four cards

**Goal:** Spells can end a combat early (`ctx.endCombat`) or cancel the whole combat phase (cancel on `combat:before`). Implement Armistice, Skirmish, Lienna's Sigil and Strategic Withdrawals.

**Files:**
- Modify: `packages/engine/src/{combat.ts,ctx.ts}`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/endcombat.test.ts`, `packages/cards/src/war/{armistice,skirmish}.ts`, `packages/cards/src/life/{liennasSigil,strategicWithdrawals}.ts`, `packages/cards/test/withdraw-cards.test.ts`

**Acceptance Criteria:**
- [ ] A handler calling `ctx.endCombat()` during `combat:start` or `round:start` stops the fight; `combat:end` and `combat:after` still fire for surviving groups
- [ ] A handler calling `ctx.cancel()` on `combat:before` skips every combat that turn; `turn:afterCombat` still fires
- [ ] Skirmish ends combat at the start of round 3 and is dispelled after the group's next combat
- [ ] Strategic Withdrawals ends every combat at the start of round 7
- [ ] Lienna's Sigil ends combat at its start when the opponent is a monster group
- [ ] Armistice: no combats while active (casting turn +2)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/endcombat.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight, runCombats } from '../src/combat';
import { addSpellRecord } from '../src/spellstore';
import { blankEngine, put } from './helpers';

const round3 = defineCard({
  id: 'round3', name: 'Round3', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'round:start': (c, ev) => { if (ev.data.round === 3) c.endCombat(); } },
});
const startEnd = defineCard({
  id: 'startend', name: 'StartEnd', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'combat:start': (c) => c.endCombat() },
});
const peace = defineCard({
  id: 'peace', name: 'Peace', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  on: { 'combat:before': (c) => c.cancel() },
});
const watch = defineCard({
  id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'globe', exclusive: false,
  on: {
    'combat:end': (c) => c.setToken('end', 1),
    'combat:after': (c) => c.setToken('after', 1),
    'turn:afterCombat': (c) => c.setToken('afterAll', 1),
  },
});
const all = [round3, startEnd, peace, watch];
const on = (e: ReturnType<typeof blankEngine>, cardId: string) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });

describe('ending a combat early', () => {
  it('stops at the start of round 3: two archer rounds were fought', () => {
    const e = blankEngine(all);
    on(e, 'round3');
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    fight(e, a.id, b.id);
    expect(e.state.minions[ida].hp).toBe(4);
    expect(e.state.minions[idb].hp).toBe(4);
  });

  it('can end the combat before round 1 and still fires combat:end and combat:after', () => {
    const e = blankEngine(all);
    on(e, 'startend');
    const w = on(e, 'watch');
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    fight(e, a.id, b.id);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(w.tokens).toMatchObject({ end: 1, after: 1 });
  });
});

describe('cancelling the combat phase', () => {
  it('skips every combat but still fires turn:afterCombat', () => {
    const e = blankEngine(all);
    on(e, 'peace');
    const w = on(e, 'watch');
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    runCombats(e);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(w.tokens.afterAll).toBe(1);
    expect(w.tokens.end).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/ctx.ts`: add to `EventContext`
```ts
  /** Ends the current combat (the group "withdraws"). Valid in `combat:start` and `round:start` handlers. */
  endCombat(): void;
```
and to `makeCtx`:
```ts
    endCombat: () => {
      if (event) event.data.endCombat = true;
    },
```
`src/combat.ts`:
- Replace `startRound` with a version that returns whether a handler ended the combat:
```ts
function startRound(e: Engine, hiId: number, loId: number, round: number): boolean {
  const s = e.state;
  for (const gid of [hiId, loId]) {
    for (const m of minionsOf(s, gid)) {
      const st = computeStats(e, m.id);
      m.combat.armor = st.armor;
      m.combat.handLeft = round === 1 ? 0 : st.handAttacks;
      m.combat.missileLeft = st.missileAttacks;
      if (st.missileAttacks > 0) m.combat.victim = null; // shooters go idle each round (R1)
      if (round === 1) m.combat.misses = FIRST_HIT;
    }
  }
  let ended = false;
  for (const gid of [hiId, loId]) {
    if (!s.groups[gid]) continue;
    const ev = dispatch(e, 'round:start', { kind: 'group', id: gid }, { round });
    if (ev.data.endCombat) ended = true;
  }
  return ended;
}
```
- In `fight`, replace the `combat:start` dispatch line and the round loop head:
```ts
  let ended = false;
  for (const id of [hiId, loId]) {
    const ev = dispatch(e, 'combat:start', { kind: 'group', id }, { opponent: id === hiId ? loId : hiId });
    if (ev.data.endCombat) ended = true;
  }
```
and in the loop:
```ts
  for (let round = 1; round <= RULES.combatRounds; round++) {
    if (ended || !stillHostile()) break;
    if (startRound(e, hiId, loId, round)) break;
    if (!stillHostile()) break;
    chooseVictims(e, hiId, loId, round);
    attackPhase(e, hiId, loId, round);
    attackPhase(e, loId, hiId, round);
  }
```
(the `for (const gid of [hiId, loId]) { ... m.combat = {...} }` reset between the two stays where it is, after the `combat:start` dispatch).
- In `runCombats`, replace `dispatch(e, 'combat:before');` with:
```ts
  const before = dispatch(e, 'combat:before');
  if (before.data.cancel) {
    dispatch(e, 'turn:afterCombat');
    return;
  }
```

- [ ] **Step 4: Run engine tests, typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
```bash
git add packages/engine
git commit -m "feat(engine): ctx.endCombat and cancellable combat phase"
```

- [ ] **Step 5: Write the failing card tests**

`packages/cards/test/withdraw-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { expireSpells, fight, runCombats } from '@sanctum/engine/src/testing';
import { cast, gref, put, putMonster, world } from './helpers';

const globe = { kind: 'globe' as const };
const hp = (e: ReturnType<typeof world>, id: number) => e.state.minions[id].hp;

describe('Skirmish', () => {
  it('ends the combat at round 3 and is dispelled afterwards', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'skirmish', gref(red.id))).toBe('cast');
    fight(e, red.id, blue.id);
    expect([hp(e, a), hp(e, b)]).toEqual([4, 4]);
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('Strategic Withdrawals', () => {
  it('ends every combat at the start of round 7', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'strategic-withdrawals', globe)).toBe('cast');
    fight(e, red.id, blue.id);
    expect([hp(e, a), hp(e, b)]).toEqual([2, 2]);
  });
});

describe("Lienna's Sigil", () => {
  it('ends combat against a monster group at once', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const mon = putMonster(e, 'blue', { x: 5, y: 4 });
    const [a, m] = [red.minionIds[0], mon.minionIds[0]];
    expect(cast(e, 'red', 'liennas-sigil', gref(red.id))).toBe('cast');
    fight(e, red.id, mon.id);
    expect([hp(e, a), hp(e, m)]).toEqual([7, 12]);
  });
  it('does nothing against recruits', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    cast(e, 'red', 'liennas-sigil', gref(red.id));
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
  });
});

describe('Armistice', () => {
  it('stops all combat for the casting turn plus two, then lapses', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const [a, b] = [red.minionIds[0], blue.minionIds[0]];
    expect(cast(e, 'red', 'armistice', globe)).toBe('cast');
    runCombats(e);
    expect([hp(e, a), hp(e, b)]).toEqual([7, 7]);
    expireSpells(e);
    expireSpells(e);
    expect(e.state.spells).toHaveLength(1);
    expireSpells(e);
    expect(e.state.spells).toHaveLength(0);
    runCombats(e);
    expect(e.state.groups[blue.id]).toBeUndefined();
  });
});
```

- [ ] **Step 6: Run to verify failure, then write the card files**

`src/war/armistice.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'armistice', name: 'Armistice', house: 'war', cost: { strife: 4, clarity: 4 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  on: {
    'combat:before': (c) => c.cancel(),
  },
});
```
`src/war/skirmish.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isHostGroup } from '../helpers';

export default defineCard({
  id: 'skirmish', name: 'Skirmish', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'group',
  on: {
    'round:start': (c, ev) => {
      if (ev.data.round === 3 && isHostGroup(c, ev)) c.endCombat();
    },
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
```
`src/life/liennasSigil.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isHostGroup } from '../helpers';

export default defineCard({
  id: 'liennas-sigil', name: "Lienna's Sigil", house: 'life', cost: { clarity: 3 },
  type: 'alteration', target: 'group',
  on: {
    'combat:start': (c, ev) => {
      if (isHostGroup(c, ev) && c.group(ev.data.opponent)?.kind === 'monster') c.endCombat();
    },
  },
});
```
`src/life/strategicWithdrawals.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'strategic-withdrawals', name: 'Strategic Withdrawals', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'globe',
  on: {
    'round:start': (c, ev) => {
      if (ev.data.round === 7) c.endCombat();
    },
  },
});
```
Register: war gets `armistice, skirmish`; life gets `liennasSigil, strategicWithdrawals`.

- [ ] **Step 7: Update the backlog**

Delete `- Armistice (War)`, `- Skirmish (War)`, `- Lienna's Sigil (Life)`, `- Strategic Withdrawals (Life)`.

- [ ] **Step 8: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
```bash
git add -A
git commit -m "feat(cards): Armistice, Skirmish, Lienna's Sigil, Strategic Withdrawals"
```

---

### Task 5: Casting restrictions, and eight cards

**Goal:** Active spells can forbid other casts (`blocksCast`), and spells can react to their own expiry (`onExpire`). Implement Adriel's Glamour, Adriel's Promise, Adriel's Mantle, Individualism, Seelie Favor, Fog of War, Court Politics (with Court Politics II) and Lone Wolf.

**Files:**
- Modify: `packages/engine/src/{cards.ts,spells.ts,index.ts}`, `packages/cards/src/helpers.ts`, `packages/cards/test/meta.test.ts`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/blockscast.test.ts`, `packages/cards/src/war/{fogOfWar,loneWolf}.ts`, `packages/cards/src/life/{adrielsGlamour,adrielsPromise,adrielsMantle,individualism,seelieFavor,courtPolitics,courtPoliticsII}.ts`, `packages/cards/test/restrict-cards.test.ts`

**Acceptance Criteria:**
- [ ] While a spell with `blocksCast` is active, `castCheck` (used when ordering and at execution) rejects any cast it returns true for, so the cast squanders
- [ ] `onExpire` runs when a spell expires by duration, before it is removed, and not when it is dispelled
- [ ] Glamour blocks globe spells, Promise blocks structure spells, Individualism blocks group spells, Fog of War blocks individual spells
- [ ] Mantle shields its group and members from group and individual spells; Seelie Favor shields an enemy group from group spells
- [ ] Court Politics stops its caster targeting friendly groups/minions; when it expires, Court Politics II gives +2 Clarity each turn
- [ ] Lone Wolf: +3 hand, +1 armor, +6 max and current hp, only on a swordsman alone in its group; friendly individual spells on it and friendly group spells on its group are blocked

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/blockscast.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { submitOrders } from '../src/api';
import { defineCard } from '../src/cards';
import { spellsOn } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { castCheck, dispel, executeCast, expireSpells } from '../src/spells';
import { emptyOrders } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const bolt = defineCard({ id: 'bolt', name: 'Bolt', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'recruit' });
const calm = defineCard({ id: 'calm', name: 'Calm', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });
const lock = defineCard({
  id: 'lock', name: 'Lock', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  blocksCast: (_q, _sp, a) => a.card.id === 'bolt',
});
const blueLock = defineCard({
  id: 'bluelock', name: 'BlueLock', house: 'war', cost: {}, type: 'alteration', target: 'globe',
  blocksCast: (_q, _sp, a) => a.caster === 'blue',
});
const later = defineCard({
  id: 'later', name: 'Later', house: 'war', cost: {}, type: 'alteration', target: 'globe', helper: true,
});
const fuse = defineCard({
  id: 'fuse', name: 'Fuse', house: 'war', cost: {}, type: 'conjuration', target: 'globe', duration: { turns: 1 },
  onExpire: (c) => { c.createSpell('later', { kind: 'globe' }); },
});
const all = [bolt, calm, lock, blueLock, later, fuse];
const globe = { kind: 'globe' as const };

describe('blocksCast', () => {
  it('squanders blocked casts and allows others', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(executeCast(e, 'red', 'lock', globe)).toBe('cast');
    expect(castCheck(e, 'red', bolt, { kind: 'minion', id })).toBe(false);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('squandered');
    expect(executeCast(e, 'red', 'calm', { kind: 'minion', id })).toBe('cast');
  });

  it('stops blocking once the spell is dispelled', () => {
    const e = blankEngine(all);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'lock', globe);
    dispel(e, spellsOn(e.state, globe)[0].id);
    expect(executeCast(e, 'red', 'bolt', { kind: 'minion', id })).toBe('cast');
  });

  it('receives the caster, so a block can be one-sided', () => {
    const e = blankEngine(all);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'bluelock', globe);
    expect(executeCast(e, 'blue', 'calm', { kind: 'minion', id })).toBe('squandered');
    expect(executeCast(e, 'red', 'calm', { kind: 'minion', id })).toBe('cast');
  });

  it('rejects a blocked cast while ordering', () => {
    const e = gameEngine([bolt, lock], Array(10).fill('bolt'));
    addSpellRecord(e.state, { cardId: 'lock', owner: 'blue', host: globe, visible: true, turnsLeft: null, tokens: {} });
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    const blue = Object.values(e.state.groups).find((g) => g.owner === 'blue')!;
    const r = submitOrders(e.state, e.cards, 'red', {
      ...emptyOrders(),
      train: [{ structureId: sanctum.id, as: 'strife' }],
      cast: [{ handIndex: 0, target: { kind: 'minion', id: blue.minionIds[0] } }],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot target/);
  });
});

describe('onExpire', () => {
  it('runs when a spell expires by duration but not when it is dispelled', () => {
    const e = blankEngine(all);
    executeCast(e, 'red', 'fuse', globe);
    expireSpells(e);
    expect(spellsOn(e.state, globe).map((s) => s.cardId)).toEqual(['later']);

    const f = blankEngine(all);
    executeCast(f, 'red', 'fuse', globe);
    dispel(f, spellsOn(f.state, globe)[0].id);
    expect(spellsOn(f.state, globe)).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/cards.ts`: add, above `CardDef`:
```ts
/** A cast being attempted, as seen by `blocksCast`. */
export interface CastAttempt {
  caster: PlayerId;
  card: CardDef;
  target: Ref;
}
```
(import `PlayerId` in the types import) and add these fields to `CardDef`:
```ts
  /** While this spell is active, return true to forbid the attempted cast (it squanders, or is rejected while ordering). */
  blocksCast?: (q: QueryContext, spell: ActiveSpell, attempt: CastAttempt) => boolean;
  /** Runs when a spell of this card expires by duration, just before it is removed (not when dispelled). */
  onExpire?: (c: EventContext) => void;
```
`src/spells.ts`: replace `castCheck` with
```ts
export function castCheck(e: Engine, caster: PlayerId, card: CardDef, ref: Ref): boolean {
  if (!targetLegal(e, card, caster, ref)) return false;
  const q = makeQuery(e, caster);
  if (card.canCast && !card.canCast(q, ref)) return false;
  for (const sp of e.state.spells) {
    const blocks = e.cards[sp.cardId]?.blocksCast;
    if (blocks && blocks(q, sp, { caster, card, target: ref })) return false;
  }
  return true;
}
```
and replace `expireSpells` with
```ts
export function expireSpells(e: Engine): void {
  for (const sp of [...e.state.spells]) {
    if (sp.turnsLeft === null || !e.state.spells.some((x) => x.id === sp.id)) continue;
    sp.turnsLeft -= 1;
    if (sp.turnsLeft <= 0) {
      e.cards[sp.cardId]?.onExpire?.(makeCtx(e, sp));
      dispel(e, sp.id);
    }
  }
}
```
`src/index.ts`: add `CastAttempt` to the `./cards` type export line.

- [ ] **Step 4: Run engine tests, typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
```bash
git add packages/engine
git commit -m "feat(engine): blocksCast restrictions and onExpire hook"
```

- [ ] **Step 5: Card-package helpers and meta test**

`packages/cards/src/helpers.ts`: add (and import `TargetType` from `@sanctum/engine`)
```ts
export const GROUP_TARGETS: TargetType[] = ['recruitGroup', 'monsterGroup', 'group'];
export const INDIVIDUAL_TARGETS: TargetType[] = ['recruit', 'monster', 'minion'];
```
`packages/cards/test/meta.test.ts`: in `expectedTarget`, change the group rule to `if (/^(non-friendly )?group\b/.test(s)) return 'group';`.

- [ ] **Step 6: Write the failing card tests**

`packages/cards/test/restrict-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { expireSpells } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, stats, world } from './helpers';

const globe = { kind: 'globe' as const };
const town = {
  id: 900, kind: 'town' as const, pos: { x: 8, y: 2 }, owner: 'red' as const, manaType: null, novices: 0, turnCount: 2, captured: false,
};
const expire = (e: ReturnType<typeof world>, n: number) => { for (let i = 0; i < n; i++) expireSpells(e); };

describe("Adriel's Glamour", () => {
  it('blocks globe spells for both players until it expires', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'adriels-glamour', globe)).toBe('cast');
    expect(cast(e, 'blue', 'aura-of-world', globe)).toBe('squandered');
    expect(cast(e, 'red', 'war-drums', gref(g.id))).toBe('cast');
    expire(e, 5);
    expect(cast(e, 'blue', 'aura-of-world', globe)).toBe('cast');
  });
});

describe("Adriel's Promise", () => {
  it('blocks structure spells', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'adriels-promise', globe)).toBe('cast');
    expect(cast(e, 'red', 'oasis', { kind: 'structure', id: 900 })).toBe('squandered');
  });
});

describe('Individualism', () => {
  it('blocks group spells but not individual spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'individualism', globe)).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]))).toBe('cast');
  });
});

describe("Adriel's Mantle", () => {
  it('shields the group and its members, only the group, for two turns', () => {
    const e = world();
    const shielded = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const other = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    const id = shielded.minionIds[0];
    expect(cast(e, 'red', 'adriels-mantle', gref(shielded.id))).toBe('cast');
    expect(cast(e, 'blue', 'ngozis-way', gref(shielded.id))).toBe('squandered');
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(other.id))).toBe('cast');
    expire(e, 2);
    expect(cast(e, 'blue', 'ngozis-way', gref(shielded.id))).toBe('cast');
  });
});

describe('Seelie Favor', () => {
  it('shields an enemy group from group spells only', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'seelie-favor', gref(mine.id))).toBe('squandered');
    expect(cast(e, 'red', 'seelie-favor', gref(theirs.id))).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(theirs.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(theirs.minionIds[0]))).toBe('cast');
  });
});

describe('Fog of War', () => {
  it('blocks individual spells on all minions, not group spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'fog-of-war', globe)).toBe('cast');
    expect(cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('cast');
  });
});

describe('Court Politics', () => {
  it('stops the caster using spells on friends, then pays +2 Clarity after expiry', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    expect(cast(e, 'red', 'court-politics', globe)).toBe('cast');
    expect(cast(e, 'red', 'ngozis-way', gref(mine.id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(mine.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(theirs.id))).toBe('cast');
    expect(cast(e, 'blue', 'war-drums', gref(theirs.id))).toBe('cast');
    expire(e, 3);
    expect(e.state.spells.map((s) => s.cardId)).toContain('court-politics-ii');
    expect(e.state.spells.map((s) => s.cardId)).not.toContain('court-politics');
    advance(e);
    expect(e.state.players.red.mana.clarity).toBe(2);
    expect(e.state.players.blue.mana.clarity).toBe(0);
    expect(cast(e, 'red', 'ngozis-way', gref(mine.id))).toBe('cast');
  });
});

describe('Lone Wolf', () => {
  it('buffs a swordsman alone in its group and shields it from friendly spells', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'lone-wolf', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect([st.hand, st.armor, st.maxHp]).toEqual([5, 2, 13]);
    expect(e.state.minions[id].hp).toBe(13);
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('squandered');
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('cast');
  });
  it('needs a swordsman alone in its group', () => {
    const e = world();
    const pair = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const archer = put(e, 'red', { x: 6, y: 6 }, ['archer']);
    expect(cast(e, 'red', 'lone-wolf', mref(pair.minionIds[0]))).toBe('squandered');
    expect(cast(e, 'red', 'lone-wolf', mref(archer.minionIds[0]))).toBe('squandered');
  });
});
```

- [ ] **Step 7: Run to verify failure, then write the card files**

`src/life/adrielsGlamour.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'adriels-glamour', name: "Adriel's Glamour", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'conjuration', target: 'globe', duration: { turns: 5 },
  blocksCast: (_q, _sp, a) => a.card.target === 'globe',
});
```
`src/life/adrielsPromise.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'adriels-promise', name: "Adriel's Promise", house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 8 },
  blocksCast: (_q, _sp, a) => a.card.target === 'structure',
});
```
`src/life/individualism.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS } from '../helpers';

export default defineCard({
  id: 'individualism', name: 'Individualism', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  blocksCast: (_q, _sp, a) => GROUP_TARGETS.includes(a.card.target),
});
```
`src/life/adrielsMantle.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'adriels-mantle', name: "Adriel's Mantle", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'conjuration', target: 'group', duration: { turns: 2 },
  blocksCast: (q, sp, a) => {
    if (sp.host.kind !== 'group') return false;
    const hostId = sp.host.id;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && a.target.id === hostId;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) {
      return a.target.kind === 'minion' && q.minion(a.target.id)?.groupId === hostId;
    }
    return false;
  },
});
```
`src/life/seelieFavor.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS } from '../helpers';

export default defineCard({
  id: 'seelie-favor', name: 'Seelie Favor', house: 'life', cost: { clarity: 2, world: 2 },
  type: 'alteration', target: 'group',
  canCast: (q, t) => t.kind === 'group' && q.group(t.id)?.owner !== q.caster,
  blocksCast: (_q, sp, a) =>
    sp.host.kind === 'group' && GROUP_TARGETS.includes(a.card.target) && a.target.kind === 'group' && a.target.id === sp.host.id,
});
```
`src/war/fogOfWar.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'fog-of-war', name: 'Fog of War', house: 'war', cost: { strife: 3, clarity: 2 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 },
  blocksCast: (_q, _sp, a) => INDIVIDUAL_TARGETS.includes(a.card.target) && !a.card.ignoresConcealment,
});
```
`src/life/courtPoliticsII.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell cast on the globe when Court Politics expires.
export default defineCard({
  id: 'court-politics-ii', name: 'Court Politics II', house: 'life', cost: {},
  type: 'alteration', target: 'globe', helper: true, exclusive: false,
  on: {
    'mana:generate': (c) => {
      if (c.spell.owner !== 'neutral') c.addMana(c.spell.owner, 'clarity', 2);
    },
  },
});
```
`src/life/courtPolitics.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS } from '../helpers';

export default defineCard({
  id: 'court-politics', name: 'Court Politics', house: 'life', cost: { clarity: 3, world: 3 },
  type: 'conjuration', target: 'globe', duration: { turns: 3 }, exclusive: false,
  blocksCast: (q, sp, a) => {
    if (a.caster !== sp.owner) return false;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && q.group(a.target.id)?.owner === sp.owner;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) return a.target.kind === 'minion' && q.minion(a.target.id)?.owner === sp.owner;
    return false;
  },
  onExpire: (c) => {
    c.createSpell('court-politics-ii', { kind: 'globe' });
  },
});
```
`src/war/loneWolf.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS, minionAt } from '../helpers';

// RULING: "cannot join groups or add new recruits" is not enforced (the engine has no join-prevention hook yet).
export default defineCard({
  id: 'lone-wolf', name: 'Lone Wolf', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: (q, t) => {
    const m = minionAt(q, t);
    return m?.cls === 'swordsman' && q.minionsOf(m.groupId).length === 1;
  },
  stats: () => ({ hand: 3, armor: 1, maxHp: 6 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 6);
  },
  blocksCast: (q, sp, a) => {
    if (a.caster !== sp.owner || sp.host.kind !== 'minion') return false;
    const wolf = q.minion(sp.host.id);
    if (!wolf) return false;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) return a.target.kind === 'minion' && a.target.id === wolf.id;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && a.target.id === wolf.groupId;
    return false;
  },
});
```
Register: war gets `fogOfWar, loneWolf`; life gets `adrielsGlamour, adrielsPromise, adrielsMantle, individualism, seelieFavor, courtPolitics, courtPoliticsII`.

- [ ] **Step 8: Update the backlog**

Delete `- Lone Wolf (War)`, `- Fog of War (War)`, `- Adriel's Glamour (Life)`, `- Adriel's Mantle (Life)`, `- Adriel's Promise (Life)`, `- Court Politics (Life)`, `- Individualism (Life)`, `- Seelie Favor (Life)`.

- [ ] **Step 9: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. If the Court Politics test's `expire(e, 3)` leaves `court-politics` in place, check that `duration: { turns: 3 }` is counted per `expireSpells` call (one decrement each) and that the spell was cast once.
```bash
git add -A
git commit -m "feat(cards): casting restrictions - Glamour, Promise, Mantle, Individualism, Seelie Favor, Fog of War, Court Politics, Lone Wolf"
```

---

### Task 6: Recruit-creation event, concealment stat, and two cards

**Goal:** Training a recruit fires `minion:created` on its structure; helper spells can make a minion concealed. Implement Clandestine and Auberol's Grace.

**Files:**
- Modify: `packages/engine/src/{events.ts,turn.ts,stats.ts,spells.ts}`, `packages/cards/src/life/index.ts`, `docs/superpowers/plans/cards-backlog.md`
- Create: `packages/engine/test/created.test.ts`, `packages/cards/src/life/{clandestine,greymantle,auberolsGrace,graceOfAuberol}.ts`, `packages/cards/test/created-cards.test.ts`

**Acceptance Criteria:**
- [ ] `minion:created` (data `{ minionId }`) is dispatched on the structure when a training order creates a recruit, so structure and square spells see it
- [ ] `Stats.concealed` is true when a spell reaching the minion sets `concealed`; enemy individual spells cannot target such a minion (own side can; `ignoresConcealment` cards can)
- [ ] Clandestine: for the casting turn +4, every recruit created in the town gets a concealing helper spell
- [ ] Auberol's Grace: every recruit created in the town gets +4 max and current hp (the "colony becomes town" clause is omitted: no colonies exist yet)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing engine test**

`packages/engine/test/created.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { confirmOrders, submitOrders, type Result } from '../src/api';
import { defineCard } from '../src/cards';
import { addSpellRecord } from '../src/spellstore';
import { targetLegal } from '../src/spells';
import { emptyOrders, type GameState } from '../src/types';
import { blankEngine, gameEngine, put } from './helpers';

const watch = defineCard({
  id: 'watch', name: 'Watch', house: 'war', cost: {}, type: 'alteration', target: 'structure',
  on: { 'minion:created': (c, ev) => c.setToken('last', ev.data.minionId) },
});
const cloak = defineCard({
  id: 'cloak', name: 'Cloak', house: 'war', cost: {}, type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ concealed: true }),
});
const bolt = defineCard({ id: 'bolt', name: 'Bolt', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });
const sight = defineCard({
  id: 'sight', name: 'Sight', house: 'war', cost: {}, type: 'manifestation', target: 'recruit', ignoresConcealment: true,
});

function must(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

describe('minion:created', () => {
  it('fires on the structure when training creates a recruit', () => {
    const e = gameEngine([watch]);
    const sanctum = Object.values(e.state.structures).find((s) => s.owner === 'red')!;
    addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'structure', id: sanctum.id }, visible: true, turnsLeft: null, tokens: {} });
    let s = must(submitOrders(e.state, e.cards, 'red', { ...emptyOrders(), train: [{ structureId: sanctum.id, as: 'swordsman' }] }));
    s = must(confirmOrders(s, e.cards, 'red'));
    s = must(confirmOrders(s, e.cards, 'blue'));
    const last = s.spells.find((sp) => sp.cardId === 'watch')!.tokens.last;
    expect(s.minions[last].cls).toBe('swordsman');
    expect(s.minions[last].owner).toBe('red');
    const group = Object.values(s.groups).find((g) => g.minionIds.includes(last))!;
    expect(group.pos).toEqual(sanctum.pos);
  });
});

describe('concealed stat', () => {
  it('hides a minion from enemy individual spells only', () => {
    const e = blankEngine([bolt, sight, cloak]);
    const id = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    addSpellRecord(e.state, { cardId: 'cloak', owner: 'blue', host: { kind: 'minion', id }, visible: true, turnsLeft: null, tokens: {} });
    const ref = { kind: 'minion' as const, id };
    expect(targetLegal(e, bolt, 'red', ref)).toBe(false);
    expect(targetLegal(e, bolt, 'blue', ref)).toBe(true);
    expect(targetLegal(e, sight, 'red', ref)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Engine changes**

`src/events.ts`: add `'minion:created'` to the minion group of `EventType` (after `'minion:dies'`: `| 'minion:created'`).
`src/turn.ts`: in `applyTraining`, replace `if (t.as === 'swordsman' || t.as === 'archer') addRecruit(e, side, st.pos, t.as);` with
```ts
    if (t.as === 'swordsman' || t.as === 'archer') {
      const m = addRecruit(e, side, st.pos, t.as);
      dispatch(e, 'minion:created', { kind: 'structure', id: st.id }, { minionId: m.id });
    }
```
`src/stats.ts`: add `concealed?: boolean;` to `StatDelta` and `concealed: boolean;` to `Stats`; initialise `concealed: false` in `computeStats`; inside the delta loop add `if (d.concealed) out.concealed = true;`.
`src/spells.ts`: import `computeStats` (`import { computeStats, syncHp } from './stats';`) and replace the concealment line in `targetLegal` with
```ts
      if (!card.ignoresConcealment && m.owner !== caster && (isConcealed(s, m) || computeStats(e, m.id).concealed)) return false;
```

- [ ] **Step 4: Run engine tests, typecheck, commit**

Run: `cd packages/engine && npx vitest run && npx tsc -p . --noEmit`
```bash
git add packages/engine
git commit -m "feat(engine): minion:created event and concealed stat"
```

- [ ] **Step 5: Write the failing card tests**

`packages/cards/test/created-cards.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dispatch, expireSpells } from '@sanctum/engine/src/testing';
import { cast, mref, put, world } from './helpers';

const structure = { kind: 'structure' as const, id: 900 };
const town = {
  id: 900, kind: 'town' as const, pos: { x: 4, y: 4 }, owner: 'red' as const, manaType: null, novices: 0, turnCount: 2, captured: false,
};

describe('Clandestine', () => {
  it('conceals recruits created in the town, for the casting turn plus four', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'clandestine', structure)).toBe('cast');
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    dispatch(e, 'minion:created', structure, { minionId: id });
    expect(e.state.spells.filter((s) => s.cardId === 'greymantle')).toHaveLength(1);
    expect(cast(e, 'blue', 'flaming-sword', mref(id))).toBe('squandered');
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('cast');
    for (let i = 0; i < 5; i++) expireSpells(e);
    expect(e.state.spells.some((s) => s.cardId === 'clandestine')).toBe(false);
  });
});

describe("Auberol's Grace", () => {
  it('gives recruits created in the town +4 maximum and current hit points', () => {
    const e = world();
    e.state.structures[900] = town;
    expect(cast(e, 'red', 'auberols-grace', structure)).toBe('cast');
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    dispatch(e, 'minion:created', structure, { minionId: id });
    expect(e.state.minions[id].maxHp).toBe(11);
    expect(e.state.minions[id].hp).toBe(11);
  });
});
```

- [ ] **Step 6: Run to verify failure, then write the card files**

`src/life/greymantle.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: conceals a recruit created under Clandestine.
export default defineCard({
  id: 'greymantle', name: 'Greymantle', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ concealed: true }),
});
```
`src/life/clandestine.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'clandestine', name: 'Clandestine', house: 'life', cost: { clarity: 3, world: 2 },
  type: 'conjuration', target: 'structure', duration: { turns: 5 },
  on: {
    'minion:created': (c, ev) => {
      c.createSpell('greymantle', { kind: 'minion', id: ev.data.minionId });
    },
  },
});
```
`src/life/graceOfAuberol.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// Helper spell: +4 maximum hit points for a recruit created under Auberol's Grace.
export default defineCard({
  id: 'grace-of-auberol', name: 'Grace of Auberol', house: 'life', cost: {},
  type: 'alteration', target: 'recruit', helper: true,
  stats: () => ({ maxHp: 4 }),
});
```
`src/life/auberolsGrace.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// RULING: "colony becomes town" is omitted: no colonies exist yet, so only the recruit bonus is implemented.
export default defineCard({
  id: 'auberols-grace', name: "Auberol's Grace", house: 'life', cost: { clarity: 6, world: 1 },
  type: 'alteration', target: 'structure',
  on: {
    'minion:created': (c, ev) => {
      c.createSpell('grace-of-auberol', { kind: 'minion', id: ev.data.minionId });
      c.heal(ev.data.minionId, 4);
    },
  },
});
```
Register: life gets `clandestine, greymantle, auberolsGrace, graceOfAuberol`.

- [ ] **Step 7: Update the backlog**

Delete `- Auberol's Grace (Life)` and `- Clandestine (Life)`.

- [ ] **Step 8: Run everything, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
```bash
git add -A
git commit -m "feat(cards): Clandestine and Auberol's Grace"
```

---

### Task 7: Backlog cleanup, registry count, whole-repo check

**Goal:** Leave the repository describing itself accurately: 60 implemented cards, a backlog of the remaining 42, and a test that pins the implemented count.

**Files:**
- Modify: `docs/superpowers/plans/cards-backlog.md`, `packages/cards/test/meta.test.ts`

**Acceptance Criteria:**
- [ ] `playableCards` has exactly 60 entries (29 War, 31 Life) and `pendingCards` 42
- [ ] The backlog lists exactly the 42 pending cards, grouped by remaining extension, with accurate counts
- [ ] Whole-repo `npm test` and `npm run typecheck` pass

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Pin the counts in `test/meta.test.ts`**

Inside the `registry` describe add:
```ts
  it('has 60 playable cards (29 War, 31 Life) and 42 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(29);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(31);
    expect(pendingCards).toHaveLength(42);
  });
```

- [ ] **Step 2: Replace `docs/superpowers/plans/cards-backlog.md`** with the following (the markdown inside the fence, without the fence):

````markdown
# War and Life cards not yet implemented

Implemented: 60 (29 War, 31 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Monsters, heroes, nations and minion creation (19)
Needs: summon with stat lines (`H:4 A:1 HP:16 L:2`), monster behaviours (Territorial, Nomadic, Immobile, Flight, Neutral,
off-board appearance), nations as a minion property, `ctx.addMinion(group, spec)`, novice creation in a town, a
once-per-game rule for heroes. This is the next plan (2c).
- Brimstone Dragon (War)
- Decoy (War)
- Dragon's Teeth (War)
- Firewyrm (War)
- Hellion (War)
- Ngozi (War)
- Salamander (War)
- Vlad Hrothgar (War)
- Warlord (War)
- Wyrmling (War)
- Allies (Life)
- Arboriads (Life)
- Bard (Life)
- Incarnate (Life)
- Lienna (Life)
- Prismatic Serpent (Life)
- Questing Beast (Life)
- Sylph (Life)
- Undine (Life)

## E6. Spells that remove a group for a while (1)
Needs: groups that disappear from the board and reappear (boardhop-style), with a "cannot re-enter" rule.
- Faerie Circle (Life)

## E8. Initiative and structures (6)
Needs: `ctx.setInitiative`, create/destroy/move structures, colonies, hidden structures.
- Challenge (War)
- Defensive Pact (War)
- Encampment (War)
- Golden Grove (Life)
- Seelie Court (Life)
- Spy at Court (Life)

## E9. Damage kinds and conditional damage (5)
Needs: per-attack modifiers keyed on the target (vs swordsmen, vs structure/forest), magical missile damage, healing
attacks, nation conditions.
- Cannon (War)
- Flaming Arrows (War)
- Cadre (Life)
- Fae Gift (Life)
- Yeoman (Life)

## E10. Tokens, copies and experience (5)
Needs: recursive hand copies with token counts, "subsequent alteration" counting, grant experience level, deck removal.
- Book of War (War)
- Growing Strife (War)
- Day of Mourning (Life)
- Greater Clarity (Life)
- Seelie Champion (Life)

## E11. One-off mechanics (6)
Needs: effects that reach other squares (General, Fae Quadrille), random eruption (Lava Flow), ownership change
(Renegades), class change (Weapon Master), terrain lock (Terrain Bind).
- General (War)
- Lava Flow (War)
- Renegades (War)
- Weapon Master (War)
- Fae Quadrille (Life)
- Terrain Bind (Life)
````

- [ ] **Step 3: Run the whole repository**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: scrape, engine and cards suites pass; typecheck exits 0 for every workspace. If the backlog test fails, its diff names the cards in the wrong place: fix the markdown, never the test.

- [ ] **Step 4: Commit and tag**

```bash
git add -A
git commit -m "docs: backlog after wave 1; pin implemented card counts"
git tag cards-wave1
```

---

## After this plan

Plan 2c: E1, monsters/heroes/nations (19 cards) as its own design pass. Plan 3: `packages/web`, the hotseat client (use `playableCards` for the deck builder, `cardData` for text). Remaining one-offs (E6 Faerie Circle, E8, E9, E10, E11: 23 cards) follow as small extension plans when wanted.
