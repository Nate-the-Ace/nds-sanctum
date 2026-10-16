# The Remaining 24 War and Life Cards Implementation Plan (plan 2d)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 24 War and Life cards still listed in `docs/superpowers/plans/cards-backlog.md` (backlog groups E1, E6, E8, E9, E10, E11) in the keyword language, with the engine support and the minimum web UI they need, so that the backlog ends empty and all 102 scraped cards are playable.

**Architecture:** Seven small engine extensions, each followed by the card task it unlocks, ordered from the cheapest and most general to the most special: attack modifiers (magical and healing strikes, nation change), card flow (a `spell:cast` event, level grants, deck removal, private intel, hand copies), entry restrictions (`blocksEntry`), board-wide stats plus owner/control changes, boardhops (`onDispel`, removal, "time stops off the board"), and structures (create/destroy/hide colonies and towns, capture event, mana choices for new colonies and for mana-making spells). Cards are keyword declarations; one-off rules use `Script` with printed text, as `docs/card-text-guide.md` section 9 prescribes. A web task renders the new state (off-board groups, hidden structures, new mana choices, intel, recursive copies). Questing Beast comes last because it reuses most of the new engine pieces.

**Tech Stack:** TypeScript (strict, ESM), Vitest, Preact (web), npm workspaces. Branch `engine-core` (current HEAD `ff5f850`, after tags `creatures` and `web-m1`).

**User decisions (already made):**
- "I trust your judgement on rules of play."
- Cards are written "in the keyword language" (`card({... keywords})`); one-off rules get a `// RULING:` comment where the text is ambiguous ("that is the repo convention").
- "group the cards so that each engine extension is one task and unlocks its cards; order tasks from cheapest/most general to most special."
- "Questing Beast may be split off as its own last task or deferred with a clear reason if it needs too much."
- "the starter decks (packages/cards/src/decks.ts) pick up new cards automatically; the web client (packages/web) shows state generically, but any new engine state a card creates (colonies, hidden structures, off-board groups, tokens) must render sensibly: include the minimum UI task(s) if needed ... with tests."
- "Update counts in meta.test.ts / faces.test.ts / backlog (cards-backlog.md must end empty or hold only the deferred card) in the final task."

**Plan decisions (mine, from "I trust your judgement"):**
1. **Task order.** Engine task, then the card task it unlocks, seven times: strikes (E9), card flow (E10 plus Spy at Court and Challenge, which need nothing else), entry restrictions (Fae Quadrille, Terrain Bind), board reach and control (General, Weapon Master, Renegades; Lava Flow needs no engine change and rides along), boardhop (Faerie Circle), structures (Defensive Pact, Encampment, Seelie Court, Golden Grove), then the web task, then Questing Beast, then docs. Every card task also updates `cards-backlog.md`, `meta.test.ts` and the faces count, because `backlog.test.ts` and `meta.test.ts` fail as soon as a card ships without that.
2. **Questing Beast is implemented, not deferred** (Task 13). The hunted group needs only computer control (which already stops joining, training into it and entering structures), a hunting bot, `addLevel`, and `onDispel` to give control back; all of these exist by then.
3. **Recursive cards** (Growing Strife, Greater Clarity): hand entries stay plain card ids. The `recursive()` helper declares the card and its copies `<id>-2` ... `<id>-8` as separate card definitions with `copyOf: <id>`; copy N has N tokens baked in (its `Grant`), costs N-1 more of the card's first mana type, is named "<Name> (N tokens)", and is never allowed in a deck. A card and its copies share exclusivity on a target. RULING: the 8-token copy returns another 8-token copy (the original has no stated cap; 9+ mana for one spell never happens in practice).
4. **`spell:cast` event** (Seelie Champion): dispatched on the cast target after every successful cast with `{ cardId, type, caster, spellId }`. RULING: Seelie Champion counts alterations cast on the archer itself after it (by either player, including copies of other alteration cards), not group spells, and not helper spells that effects create (those are not "cast").
5. **Magical strikes and healing strikes.** A strike handler may set `magical` (Yeoman: ignores armor and skips before-armor effects, the engine's existing meaning of magical) or `heals` (Fae Gift: after armor soak, the damage that gets through heals instead; a healing hit is a "hit" but not "damage", so it never kills).
6. **Nation change** (`ctx.setNation`) is permanent and replaces nation hit points and nation walks for recruits. RULING: Fae Gift's "changes into an Elf" stays when Fae Gift is dispelled.
7. **Cannon** deals spell damage, which is magical in this engine (ignores armor).
8. **Book of War**: one level per recruit per turn, recruits only, applied with `ctx.addLevel` (base level, capped at 5) at the next start of turn.
9. **Day of Mourning**: "dies" means the `minion:dies` event (killed or instant death), not removal from the game. The removed card is gone, not discarded.
10. **Spy at Court**: what a player learns is private state, `PlayerState.intel` (optional, cleared at every start of turn before "start of turn" effects), shown only on that player's orders screen.
11. **Challenge**: neutral recruits count when finding the highest level, but neutral cannot hold Initiative, so a neutral top or a tie with neutral changes nothing. The change is immediate (movement and combat precedence this turn); this turn's spell order was already fixed.
12. **Entry restrictions**: one engine hook, `CardDef.blocksEntry`, checked by the movement pipeline, bots (`legalDirections`), `ctx.canEnter` and order validation. Returning from off the board and relocation (`ctx.moveGroup`) are not "entering" (rules: Concepts_boardhop "Returning to the board is not a normal movement").
13. **Fae Quadrille** heals the four adjacent squares once, when it is cast (RULING: "on turn of casting only" read as a one-time heal in the casting turn).
14. **Terrain Bind**: a structure square counts as plains both where the group stands and where it wants to go.
15. **General**: printed literally, "+1 missile damage" to friendly swordsmen in the four adjacent squares. RULING: it matters only for swordsmen that have a missile attack (Weapon Master). Implemented with a new `CardDef.reach: 'board'` flag (a spell whose `stats` is asked about every minion).
16. **Weapon Master**: the recruit keeps its class and gains the other attack, so it attacks with both from round 2; a new `dualClass` stat lets archer and swordsman spells target it (individual targeting only; group spells "with archers/swordsmen" and class grants still use the real class). RULING: the clause about Bear, Eagle, Lion and Lizard Spirit and Shapeshifter is not implemented: those Body/Nature cards are not in the game.
17. **Renegades**: owner becomes neutral (spells on it keep their owners), control becomes computer with the Nomadic bot (the original neutral-group AI is unknown). Neutral groups already move last, fight everyone and have half-initiative in this engine.
18. **Lava Flow** needs no engine change: a square spell `Bound` to volcano; each start of turn a 1-in-3 roll picks 1-2 adjacent squares that are on the board, not Sanctum squares, not structures and not mountain or volcano; each becomes lava and gets a helper (`Lasts 3`) that turns lava back to barren when it expires.
19. **Boardhop**: spells on an off-board group or its minions no longer count down (rules: "Time stops when you're off the board"); a new `onDispel` hook runs whenever a spell is dispelled (dispel effects, failed persistent checks, expiry); a boardhopped group whose container spell is dispelled is removed from the game (rules: "Removed if dispelled").
20. **Faerie Circle** takes any group on its square (monsters too) at start of turn; members are healed and blessed when they leave; a group with a blessed member is never taken again and cannot enter a Faerie Circle square (coming back onto the circle is not entering). The group returns at the start of the first turn, from turn of departure + (1-5) + 1, when the square is empty.
21. **Structures**: no Colony helper spell (no implemented card dispels structure spells); destroying a structure does not change initiative deltas (RULING: the only destroyers here are Defensive Pact, which "moves" a structure, and Encampment, which folds its own camp); owned created colonies ask their owner for a mana type at the next start of turn (`Structure.needsMana`); colonies cannot be created on Sanctum squares (rules: "Uncolonizable").
22. **Hidden structures** (`Structure.hidden`) keep their square (`pos`), are invisible to `structureAt`, cannot be captured, trained at or targeted, still make mana and novices, and keep their own spells running (Seelie Court).
23. **Defensive Pact** can pick any friendly town or colony on the board, including an Encampment's colony (whose group is then removed, see 19). Not castable on a group in a structure or on a Sanctum entrance.
24. **Encampment** is an instant spell that leaves an undispellable helper on its colony. "On turn of casting +3" = start of that turn; if the colony is occupied then, it waits for a later start of turn. A captured camp removes the group and becomes an ordinary colony (it still makes no novices).
25. **Seelie Court** dispels visible spells only (non-visible ones cannot be dispelled), then toggles the town every 1-3 turns at start of turn (comes back only onto an empty square).
26. **Golden Grove** is a square spell, not a structure. A mature grove's owner picks its mana through the existing mana-choice step: `state.pendingMana` may now hold a spell id, and `chooseMana` stores the choice as `tokens.mana` (1 + index in `MANA_TYPES`). Capturing a grove does not change initiative. "Monsters cannot be targeted on square" blocks group and individual spells aimed at a monster group standing there.
27. **Questing Beast**: summoned neutral in a random empty, non-structure, non-Sanctum square it can stand on; while hunted it flees from its hunter; at start of any combat it dies (ending the combat) unless free; it is free when its hunter group is gone or the quest spell was dispelled. The hunter is computer-controlled (no joining, training or entering structures) and spells that would add minions to it (summoning and hero spells on the group) are blocked.
28. **Minimum UI**: off-board groups are listed in the sidebar; hidden structures are drawn as faded ghosts and labelled; the mana-choice screen also handles new colonies and Golden Groves; intel is shown on the owner's orders screen; recursive copies need nothing new (their names and costs come from their card definitions) but get a test.

**Starting state:** `engine-core` at `ff5f850`: engine 170 tests, cards 307, web 83, scrape 6; 93 card definitions (78 playable: 39 War, 39 Life; 15 helpers), 24 pending.

**Where an implementer should adjust:** the earlier plans were written without compiling. This one was checked against the code at `ff5f850`, but if a line number, an import list or a printed face differs, follow the code: keep the behaviour and the tests' intent, fix the expectation, and note it in the commit message. Face expectations in `faces.test.ts` are the place most likely to need a wording touch-up (fix the keyword or Script text, not the snapshot).

---

## File structure

Engine (`packages/engine/src`):
- Modify: `types.ts` (`Intel`, `PlayerState.intel`, `Structure.hidden/noNovices/needsMana`), `cards.ts` (`copyOf`, `blocksEntry`, `reach`, `onDispel`, `wantsMana`), `events.ts` (`spell:cast`, `structure:captured`), `ctx.ts` (new actions), `damage.ts`, `combat.ts`, `units.ts`, `spells.ts`, `stats.ts`, `movement.ts`, `orders.ts`, `turn.ts`, `query.ts`, `api.ts`, `view.ts`, `index.ts`, `testing.ts`
- Create tests: `test/strikes.test.ts`, `test/cardflow.test.ts`, `test/entry.test.ts`, `test/control.test.ts`, `test/boardhop.test.ts`, `test/structures.test.ts`

Cards (`packages/cards`):
- Modify: `src/lang/{types,card,target,merge,index}.ts`, `src/lang/keywords/{versus,statics,behavior}.ts`, `src/index.ts`, `src/war/index.ts`, `src/life/index.ts`, `test/{meta,faces}.test.ts`, `test/__snapshots__/faces.test.ts.snap`
- Create: `src/lang/keywords/recursive.ts`; card files (listed per task); tests `test/damage-cards.test.ts`, `test/cardflow-cards.test.ts`, `test/entry-cards.test.ts`, `test/control-cards.test.ts`, `test/faerie-circle.test.ts`, `test/structure-cards.test.ts`, `test/questing-beast.test.ts`

Web (`packages/web`):
- Modify: `src/model/session.ts`, `src/ui/{Screens,Board,Sidebar,OrdersScreen}.tsx`, `src/styles.css`
- Create: `test/remaining-cards-ui.test.tsx`

Docs: `docs/superpowers/plans/cards-backlog.md` (every card task), `docs/keyword-design.md`, `docs/card-text-guide.md` (final task).

Commands used throughout (run from the repo root unless a step says otherwise):
- Whole repo: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
- One engine test file: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/<file>`
- One cards test file: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/<file>`
- Faces snapshot: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u`

Every commit ends with the trailer line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (passed as a second `-m`).

Running counts (playable War/Life, pending, all card definitions incl. helpers and copies):

| After task | Playable | War | Life | Pending | `allCards` |
|---|---|---|---|---|---|
| start | 78 | 39 | 39 | 24 | 93 |
| 1 | 83 | 41 | 42 | 19 | 98 |
| 3 | 90 | 44 | 46 | 12 | 119 |
| 5 | 92 | 44 | 48 | 10 | 121 |
| 7 | 96 | 48 | 48 | 6 | 126 |
| 9 | 97 | 48 | 49 | 5 | 129 |
| 11 | 101 | 50 | 51 | 1 | 134 |
| 13 | 102 | 50 | 52 | 0 | 136 |

---
### Task 0: Attack modifiers in the engine (magical and healing strikes, nation change)

**Goal:** An `attacker:strikes` handler can make an attack magical or healing, and a spell can change a minion's nation.

**Files:**
- Create: `packages/engine/test/strikes.test.ts`
- Modify: `packages/engine/src/{damage,combat,units,ctx}.ts`

**Acceptance Criteria:**
- [ ] A strike handler that sets `ev.data.magical = true` makes that attack ignore armor (a 2-damage swordsman takes 2 from an A1 victim, not 1)
- [ ] A strike handler that sets `ev.data.heals = true` heals the victim by what gets through armor, never above its maximum, and never kills
- [ ] `ctx.setNation(id, 'elf')` sets `nation`/`house`; a recruit takes the new nation's hit points and loses its old nation's walks (a Cyclops becomes 7/7, a Dwarf loses Mountainwalk)
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/strikes.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { fight } from '../src/combat';
import { executeCast } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import { createGroup, recruitSpec, spawnMinion } from '../src/units';
import type { MinionSpec } from '../src/types';
import { blankEngine, put } from './helpers';

const dummy = (armor = 0): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
});
const strikeFlag = (id: string, flag: 'magical' | 'heals') => defineCard({
  id, name: id, house: 'war', cost: {}, type: 'alteration', target: 'recruit',
  on: {
    'attacker:strikes': (c, ev) => {
      if (ev.ref?.kind === 'minion' && c.host.kind === 'minion' && ev.ref.id === c.host.id) ev.data[flag] = true;
    },
  },
});

/** A red swordsman (with `cardId` on it, if given) fights a 100-hp dummy; returns the dummy's hit points. */
function duel(cardId: string | null, armor: number, startHp = 100): number {
  const e = blankEngine([strikeFlag('magic', 'magical'), strikeFlag('mend', 'heals')]);
  const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
  if (cardId) addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'minion', id: a.minionIds[0] }, visible: false, turnsLeft: null, tokens: {} });
  const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
  const v = spawnMinion(e, b.id, dummy(armor));
  e.state.minions[v.id].hp = startHp;
  fight(e, a.id, b.id);
  return e.state.minions[v.id].hp;
}

describe('magical strikes', () => {
  it('ignore armor', () => {
    // 9 hand attacks (rounds 2-10) of 2 damage; armor 1 soaks 1 of each unless the attack is magical
    expect(duel(null, 1)).toBe(100 - 9);
    expect(duel('magic', 1)).toBe(100 - 18);
  });
});

describe('healing strikes', () => {
  it('heal what gets through armor, up to the maximum', () => {
    expect(duel('mend', 0, 50)).toBe(68);
    expect(duel('mend', 1, 50)).toBe(59);
    expect(duel('mend', 0, 95)).toBe(100);
  });
});

describe('ctx.setNation', () => {
  it('changes nation, house, nation hit points and nation walks', () => {
    const toElf = defineCard({
      id: 'to-elf', name: 'to-elf', house: 'life', cost: {}, type: 'manifestation', target: 'recruit',
      onCast: (c, t) => { if (t.kind === 'minion') c.setNation(t.id, 'elf'); },
    });
    const e = blankEngine([toElf]);
    const g = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    const cy = spawnMinion(e, g.id, recruitSpec('swordsman', 'cyclops'));
    const dw = spawnMinion(e, g.id, recruitSpec('swordsman', 'dwarf'));
    expect(executeCast(e, 'red', 'to-elf', { kind: 'minion', id: cy.id })).toBe('cast');
    expect(e.state.minions[cy.id]).toMatchObject({ nation: 'elf', house: 'life', hp: 7, maxHp: 7 });
    executeCast(e, 'red', 'to-elf', { kind: 'minion', id: dw.id });
    expect(e.state.minions[dw.id].base.walks).toEqual([]);
    expect(e.state.minions[dw.id].nation).toBe('elf');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/strikes.test.ts`
Expected: FAIL (the magical and healing duels give the plain numbers; `c.setNation is not a function`).

- [ ] **Step 3: Healing in the damage pipeline**

`packages/engine/src/damage.ts`: add the field to `DamageSpec`
```ts
export interface DamageSpec {
  kind: 'hand' | 'missile' | 'spell';
  ignoresArmor: boolean;
  magical: boolean;
  /** A healing attack (Fae Gift): what gets through armor restores hit points instead. Never kills. */
  heals?: boolean;
}
```
and in `takeDamage`, directly after the armor-soak block (`if (!dmg.ignoresArmor && !dmg.magical) { ... }`) and before `data.damage = Math.min(q, v.hp);`, insert:
```ts
  if (dmg.heals) {
    v.hp = Math.min(v.maxHp, v.hp + q);
    return 'bounced'; // a hit, but no damage: no "damages" event, no death
  }
```

- [ ] **Step 4: Strike flags in combat**

`packages/engine/src/combat.ts`, in `attack`, replace
```ts
  const strike = { victimId: v.id, kind: useMissile ? 'missile' : 'hand', round, damage: dmg };
  dispatch(e, 'attacker:strikes', { kind: 'minion', id: m.id }, strike);
  dmg = st.noDamage ? 0 : Math.max(0, strike.damage);
  // A3: victim takes damage
  const res = takeDamage(e, v.id, dmg, { kind: useMissile ? 'missile' : 'hand', ignoresArmor: false, magical: false }, m.id);
```
with
```ts
  // Strike handlers may change `damage`, and set `magical` (ignores armor) or `heals` (heals instead of damaging).
  const strike = { victimId: v.id, kind: useMissile ? 'missile' : 'hand', round, damage: dmg, magical: false, heals: false };
  dispatch(e, 'attacker:strikes', { kind: 'minion', id: m.id }, strike);
  dmg = st.noDamage ? 0 : Math.max(0, strike.damage);
  // A3: victim takes damage
  const res = takeDamage(
    e, v.id, dmg, { kind: useMissile ? 'missile' : 'hand', ignoresArmor: false, magical: strike.magical, heals: strike.heals }, m.id,
  );
```

- [ ] **Step 5: Nation change**

`packages/engine/src/units.ts`, add after `recruitSpec`:
```ts
/** A minion changes nation: it serves the new nation's house; a recruit swaps its nation hit points and walks. */
export function changeNation(e: Engine, minionId: number, nation: Nation): void {
  const m = e.state.minions[minionId];
  if (!m || m.status === 'dead') return;
  if (m.kind === 'recruit') {
    const walks = [...m.base.walks];
    for (const w of m.nation ? NATIONS[m.nation].walks : []) {
      const i = walks.indexOf(w);
      if (i >= 0) walks.splice(i, 1);
    }
    m.base = { ...m.base, hp: NATIONS[nation].hp, walks: [...walks, ...NATIONS[nation].walks] };
  }
  m.nation = nation;
  m.house = NATIONS[nation].house;
}
```
`packages/engine/src/ctx.ts`: add `changeNation` to the `./units` import, add to `EventContext` (after `changeSides`)
```ts
  /** The minion changes nation (permanent): new house; a recruit takes the new nation's hit points and walks. */
  setNation(minionId: number, nation: Nation): void;
```
and to the object in `makeCtx` (after `changeSides`)
```ts
    setNation: (id, nation) => {
      changeNation(e, id, nation);
      syncHp(e);
    },
```

- [ ] **Step 6: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/strikes.test.ts`
Expected: PASS (4 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): magical and healing strikes, nation change" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 1: Damage-kind cards (Cadre, Cannon, Flaming Arrows, Fae Gift, Yeoman)

**Goal:** The five E9 cards, with a `Versus` keyword for "+N damage against <kind of victim>".

**Files:**
- Create: `packages/cards/src/war/{cannon,flamingArrows}.ts`, `packages/cards/src/life/{cadre,faeGift,yeoman}.ts`, `packages/cards/test/damage-cards.test.ts`
- Modify: `packages/cards/src/lang/keywords/versus.ts`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] Cadre: archers in the group get +1 missile damage against swordsmen only; it cannot be cast on a group without archers
- [ ] Flaming Arrows: +3 missile damage against a victim whose group is in forest or a structure; a forest square the archer hit becomes barren after all combat
- [ ] Yeoman: +1 M; its missile attacks are magical (an A3 dummy loses 2 + 9x3 = 29 hp in a fight); hitting a Keeper kills it and dispels Yeoman
- [ ] Fae Gift: the swordsman becomes an Elf and its hits heal (a 50/100 dummy ends at 68)
- [ ] Cannon: at start of combat, only if its owner's group has a Human archer, each member of the opposing group takes 1 damage
- [ ] Backlog loses group E9; meta says 83 playable (41 War, 42 Life) and 19 pending; faces pins 98 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/damage-cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeStats, createGroup, dispatch, fight, recruitSpec, spawnMinion } from '@sanctum/engine/src/testing';
import type { MinionSpec, Ref } from '@sanctum/engine';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const gref = (id: number): Ref => ({ kind: 'group', id });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const dummy = (armor = 0): MinionSpec => ({
  kind: 'monster', cls: 'monster', name: 'dummy',
  base: { hp: 100, level: 1, armor, hand: 0, handAttacks: 0, missile: 0, missileAttacks: 0, walks: [] },
});
/** The payload of one strike after every handler ran. */
const strike = (e: ReturnType<typeof mini>, attacker: number, victim: number, kind: 'hand' | 'missile' = 'missile') =>
  dispatch(e, 'attacker:strikes', mref(attacker), { victimId: victim, kind, round: 2, damage: 2, magical: false, heals: false }).data;

describe('Cadre', () => {
  it('gives the archers +1 M against swordsmen only', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const swords = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const bows = put(e, 'blue', { x: 4, y: 5 }, ['archer']);
    expect(castMini(e, 'red', 'cadre', gref(g.id))).toBe('cast');
    expect(strike(e, g.minionIds[0], swords.minionIds[0]).damage).toBe(3);
    expect(strike(e, g.minionIds[0], bows.minionIds[0]).damage).toBe(2);
    expect(strike(e, g.minionIds[1], swords.minionIds[0], 'hand').damage).toBe(2);
  });
  it('needs archers in the group', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'cadre', gref(g.id))).toBe('squandered');
  });
});

describe('Flaming Arrows', () => {
  it('+3 M against groups in forest or a structure', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'flaming-arrows', mref(a.minionIds[0]))).toBe('cast');
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(2);
    e.state.terrain['5,4'] = 'forest';
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(5);
    e.state.terrain['5,4'] = 'plains';
    e.state.structures[900] = town(900, 'blue', 5, 4);
    expect(strike(e, a.minionIds[0], foe.minionIds[0]).damage).toBe(5);
  });
  it('burns a forest it hit into barren land after all combat', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    e.state.terrain['5,4'] = 'forest';
    castMini(e, 'red', 'flaming-arrows', mref(a.minionIds[0]));
    dispatch(e, 'attacker:hits', mref(a.minionIds[0]), { victimId: foe.minionIds[0] });
    expect(e.state.terrain['5,4']).toBe('forest');
    dispatch(e, 'turn:afterCombat');
    expect(e.state.terrain['5,4']).toBe('barren');
  });
});

describe('Yeoman', () => {
  it('+1 M, and its missiles ignore armor', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'red', 'yeoman', mref(a.minionIds[0]))).toBe('cast');
    expect(computeStats(e, a.minionIds[0]).missile).toBe(3);
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy(3));
    fight(e, a.id, b.id);
    // round 1 shot: 3 - 1; rounds 2-10: 3 each; armor 3 never soaks
    expect(e.state.minions[v.id].hp).toBe(100 - (2 + 9 * 3));
  });
  it('kills a Keeper it hits, then is dispelled', () => {
    const e = mini(allCards);
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    castMini(e, 'red', 'yeoman', mref(a.minionIds[0]));
    const k = createGroup(e, 'blue', { x: 5, y: 4 }, 'recruit', 'player');
    const keeper = spawnMinion(e, k.id, recruitSpec('swordsman', 'keeper'));
    dispatch(e, 'attacker:hits', mref(a.minionIds[0]), { victimId: keeper.id });
    expect(e.state.minions[keeper.id].status).toBe('dead');
    expect(e.state.spells.some((s) => s.cardId === 'yeoman')).toBe(false);
  });
});

describe('Fae Gift', () => {
  it('turns the swordsman into an Elf whose hits heal', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'fae-gift', mref(g.minionIds[0]))).toBe('cast');
    expect(e.state.minions[g.minionIds[0]]).toMatchObject({ nation: 'elf', house: 'life' });
    const b = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    const v = spawnMinion(e, b.id, dummy());
    e.state.minions[v.id].hp = 50;
    fight(e, g.id, b.id);
    expect(e.state.minions[v.id].hp).toBe(68);
  });
});

describe('Cannon', () => {
  it('hits the opposing group at start of combat when its owner\'s group has a Human archer', () => {
    const e = mini(allCards);
    const gunners = createGroup(e, 'red', { x: 4, y: 4 }, 'recruit', 'player');
    spawnMinion(e, gunners.id, recruitSpec('archer', 'human'));
    const plain = put(e, 'red', { x: 2, y: 6 }, ['archer']);
    const foe = put(e, 'blue', { x: 5, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'cannon', { kind: 'globe' })).toBe('cast');
    dispatch(e, 'combat:start', gref(plain.id), { opponent: foe.id });
    expect(foe.minionIds.map((id) => e.state.minions[id].hp)).toEqual([7, 7]);
    dispatch(e, 'combat:start', gref(foe.id), { opponent: gunners.id });
    expect(e.state.minions[gunners.minionIds[0]].hp).toBe(7);
    dispatch(e, 'combat:start', gref(gunners.id), { opponent: foe.id });
    expect(foe.minionIds.map((id) => e.state.minions[id].hp)).toEqual([6, 6]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/damage-cards.test.ts`
Expected: FAIL (`unknown card "cadre"` squanders, etc.).

- [ ] **Step 3: The `Versus` keyword**

Append to `packages/cards/src/lang/keywords/versus.ts` (add `GROUP_TARGETS` to the `../../helpers` import and `TerrainId`, `EventContext`, `Minion` to the `@sanctum/engine` type import):
```ts
/* ---------- Versus ---------- */

export interface VersusVictim {
  /** The victim is of this class. */
  cls?: 'swordsman' | 'archer';
  /** The victim's group stands on one of these terrains, or in a structure. */
  in?: Array<TerrainId | 'structure'>;
}
export interface VersusKeyword extends Keyword {
  kind: 'versus';
  hand: number;
  missile: number;
  vs: VersusVictim;
  to: GrantTo;
}
/** "+N M against swordsmen": extra damage when an attacker of the host (minion, or `to` members of the host group) strikes such a victim. */
export const Versus = (bonus: { hand?: number; missile?: number }, vs: VersusVictim, opts: { to?: GrantTo } = {}): VersusKeyword => ({
  kind: 'versus', hand: bonus.hand ?? 0, missile: bonus.missile ?? 0, vs, to: opts.to ?? 'all',
});

const VERSUS_SUBJECT: Record<GrantTo, string> = { all: '', swordsmen: 'Swordsmen ', archers: 'Archers ', enemies: 'Enemy recruits ' };
const victimText = (vs: VersusVictim): string =>
  vs.cls ? (vs.cls === 'swordsman' ? 'swordsmen' : 'archers')
  : `groups in ${(vs.in ?? []).map((t) => (t === 'structure' ? 'a structure' : t)).join(' or ')}`;

function victimMatches(c: EventContext, v: Minion, vs: VersusVictim): boolean {
  if (vs.cls && v.cls !== vs.cls) return false;
  if (vs.in) {
    const pos = c.group(v.groupId)?.pos;
    if (!pos) return false;
    const inStructure = !!c.structureAt(pos) && vs.in.includes('structure');
    if (!inStructure && !vs.in.includes(c.terrainAt(pos) as TerrainId)) return false;
  }
  return true;
}

defineKeyword<VersusKeyword>({
  kind: 'versus', term: 'Versus', tier: 'house',
  gloss: '"+N M against <victims>": extra hand (H) or missile (M) damage when this minion, or the named members of this group, strike such a victim.',
  print: (k) => {
    const stat = [k.hand ? `+${k.hand} H` : '', k.missile ? `+${k.missile} M` : ''].filter(Boolean).join(', ');
    return { layout: 'line', text: `${VERSUS_SUBJECT[k.to]}${stat} against ${victimText(k.vs)}.` };
  },
  compile: (k, ctx) => {
    const t = ctx.host ?? ctx.target.type;
    const ok = t === 'minion' || t === 'group' || GROUP_TARGETS.includes(t as never) || INDIVIDUAL_TARGETS.includes(t as never);
    if (!ok) throw new Error(`card "${ctx.cardId}": Versus needs a minion or group target, not "${t}"`);
    return {
      on: {
        'attacker:strikes': (c, ev) => {
          if (ev.ref?.kind !== 'minion') return;
          const attacker = c.minion(ev.ref.id);
          if (!attacker) return;
          const mine = c.host.kind === 'minion' ? c.host.id === attacker.id : c.host.kind === 'group' && c.host.id === attacker.groupId;
          if (!mine || !appliesTo(k.to, attacker, c.spell)) return;
          const v = c.minion(ev.data.victimId);
          if (!v || !victimMatches(c, v, k.vs)) return;
          ev.data.damage += ev.data.kind === 'hand' ? k.hand : k.missile;
        },
      },
    };
  },
});
```
(`appliesTo` and `GrantTo` are already imported from `./statics` in this file.)

- [ ] **Step 4: The five cards**

`packages/cards/src/life/cadre.ts`:
```ts
import { card, Target, Versus } from '../lang';

export default card({ id: 'cadre', name: 'Cadre', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.recruitGroup.with('archers'), keywords: [Versus({ missile: 1 }, { cls: 'swordsman' }, { to: 'archers' })] });
```
`packages/cards/src/war/flamingArrows.ts`:
```ts
import type { EventContext } from '@sanctum/engine';
import { isHostMinion } from '../helpers';
import { card, Script, Target, Versus } from '../lang';

const BURN = 'burn:';

/** After all combat, every forest square this archer hit a victim in becomes barren. */
function burn(c: EventContext): void {
  for (const [name, v] of Object.entries(c.spell.tokens)) {
    if (!name.startsWith(BURN) || v !== 1) continue;
    const [x, y] = name.slice(BURN.length).split(',').map(Number);
    c.setTerrain({ x, y }, 'barren');
    c.setToken(name, 0);
  }
}

// RULING: "opponent in forest" is judged where the victim stands when it is hit; the square burns even if the victim
// later leaves it or dies.
export default card({ id: 'flaming-arrows', name: 'Flaming Arrows', house: 'war', cost: { strife: 2, clarity: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Versus({ missile: 3 }, { in: ['structure', 'forest'] }),
    Script('When it hits an opponent in forest, that square becomes barren after all combat.', {
      on: {
        'attacker:hits': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          const p = v ? c.group(v.groupId)?.pos : null;
          if (p && c.terrainAt(p) === 'forest') c.setToken(`${BURN}${p.x},${p.y}`, 1);
        },
        'turn:afterCombat': burn,
      },
    }),
  ] });
```
`packages/cards/src/life/yeoman.ts`:
```ts
import { isHostMinion } from '../helpers';
import { card, Grant, Script, Target } from '../lang';

// RULING: "magical damage ignores armor, immunities, and spells": the engine's magical damage ignores armor and skips
// before-armor effects; after-armor effects (Warded) still apply. Round 1's -1 missile penalty still applies.
export default card({ id: 'yeoman', name: 'Yeoman', house: 'life', cost: { clarity: 2, world: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Grant({ missile: 1 }),
    Script('Its missile damage is magical (ignores armor). When it hits a Keeper, the Keeper dies and Yeoman is dispelled.', {
      on: {
        'attacker:strikes': (c, ev) => {
          if (isHostMinion(c, ev) && ev.data.kind === 'missile') ev.data.magical = true;
        },
        'attacker:hits': (c, ev) => {
          if (!isHostMinion(c, ev)) return;
          const v = c.minion(ev.data.victimId);
          if (v?.nation !== 'keeper') return;
          c.kill(v.id);
          c.dispel();
        },
      },
    }),
  ] });
```
`packages/cards/src/life/faeGift.ts`:
```ts
import { isHostMinion } from '../helpers';
import { card, Script, Target } from '../lang';

// RULING: the change into an Elf is permanent (it stays if Fae Gift is dispelled); the healing stops with the spell.
export default card({ id: 'fae-gift', name: 'Fae Gift', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.swordsman,
  keywords: [
    Script('Becomes an Elf. Its attacks heal the victim instead of damaging it (armor soaks first).', {
      onCast: (c, t) => {
        if (t.kind === 'minion') c.setNation(t.id, 'elf');
      },
      on: {
        'attacker:strikes': (c, ev) => {
          if (isHostMinion(c, ev)) ev.data.heals = true;
        },
      },
    }),
  ] });
```
`packages/cards/src/war/cannon.ts`:
```ts
import type { EventContext, GameEvent } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

function fire(c: EventContext, ev: GameEvent): void {
  if (ev.ref?.kind !== 'group') return;
  const g = c.group(ev.ref.id);
  if (!g || g.owner !== c.spell.owner) return;
  if (!c.minionsOf(g.id).some((m) => m.cls === 'archer' && m.nation === 'human')) return;
  for (const m of c.minionsOf(ev.data.opponent)) c.damage(m.id, 1);
}

// RULING: Cannon's damage is spell damage, which is magical here (it ignores armor). "Friendly" means the caster's.
export default card({ id: 'cannon', name: 'Cannon', house: 'war', cost: { strife: 4, clarity: 1 }, type: 'alteration',
  target: Target.globe,
  keywords: [
    Script('Start of combat: if the friendly group has a Human archer, deal 1 damage to each member of the opposing group.', {
      on: { 'combat:start': fire },
    }),
  ] });
```
Register them: in `packages/cards/src/war/index.ts` add `import cannon from './cannon';` and `import flamingArrows from './flamingArrows';` and append `cannon, flamingArrows,` to `warCards`; in `packages/cards/src/life/index.ts` add imports for `cadre`, `faeGift`, `yeoman` and append `cadre, faeGift, yeoman,` to `lifeCards`.

- [ ] **Step 5: Faces, counts, backlog**

`packages/cards/test/faces.test.ts`: insert before `it('pins the printed text of every card'`:
```ts
  it('plan 2d: damage kinds', () => {
    expect(lines('cadre')).toEqual(['Recruit group with archers.', 'Archers +1 M against swordsmen.']);
    expect(lines('flaming-arrows')).toEqual([
      'Archer.', '+3 M against groups in a structure or forest.', 'When it hits an opponent in forest, that square becomes barren after all combat.',
    ]);
    expect(lines('yeoman')).toEqual([
      'Archer.', '+1 M.', 'Its missile damage is magical (ignores armor). When it hits a Keeper, the Keeper dies and Yeoman is dispelled.',
    ]);
    expect(lines('fae-gift')).toEqual(['Swordsman.', 'Becomes an Elf. Its attacks heal the victim instead of damaging it (armor soaks first).']);
    expect(lines('cannon')).toEqual([
      'Globe.', 'Start of combat: if the friendly group has a Human archer, deal 1 damage to each member of the opposing group.',
    ]);
  });

```
and change `expect(Object.keys(faces)).toHaveLength(93);` to `toHaveLength(98)`.

`packages/cards/test/meta.test.ts`: replace the `it('has 78 playable cards ...')` block with
```ts
  it('has 83 playable cards (41 War, 42 Life) and 19 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(41);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(42);
    expect(pendingCards).toHaveLength(19);
  });
```
`docs/superpowers/plans/cards-backlog.md`: change the header line to `Implemented: 83 (41 War, 42 Life). Source data: ...` (rest of the sentence unchanged) and delete the whole `## E9. Damage kinds and conditional damage (5)` section (heading, "Needs" paragraph and its five bullets).

- [ ] **Step 6: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/damage-cards.test.ts`
Expected: PASS (8 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u`, then open `test/__snapshots__/faces.test.ts.snap` and read the five new entries (no `undefined`, no empty line, no doubled parentheses).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cards): Cadre, Cannon, Flaming Arrows, Fae Gift, Yeoman; Versus keyword" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Card flow in the engine (cast event, levels, deck removal, intel, hand copies)

**Goal:** Spells can see other spells being cast, grant permanent levels, remove a deck's top card, tell a player a deck's top card, and put a card into a hand; recursive hand copies are not deck cards and share exclusivity with their original.

**Files:**
- Create: `packages/engine/test/cardflow.test.ts`
- Modify: `packages/engine/src/{types,cards,events,spells,api,turn,ctx,index}.ts`, `packages/cards/src/lang/types.ts`

**Acceptance Criteria:**
- [ ] After every successful cast, `spell:cast` is dispatched on the target with `{ cardId, type, caster, spellId }` (`spellId` is -1 for instant spells); a squandered cast dispatches nothing
- [ ] `ctx.addLevel(id, n)` raises `base.level`, capped at 5
- [ ] `ctx.removeTopCard(side)` removes and returns the top deck card (undefined on an empty deck)
- [ ] `ctx.reveal(to, side)` appends `{ source, side, cardId }` (top of `side`'s deck) to `players[to].intel`; `beginTurn` clears `intel` before "start of turn" effects
- [ ] `ctx.addToHand(side, cardId)` appends to the hand and throws on an unknown id
- [ ] `CardDef.copyOf`: `validateDeck` rejects such a card; a copy and its original block each other on one target (the second squanders "exclusive")
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/cardflow.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { validateDeck } from '../src/api';
import { defineCard, indexCards } from '../src/cards';
import { executeCast } from '../src/spells';
import { beginTurn } from '../src/turn';
import { blankEngine, put } from './helpers';

const probe = (id: string, onCast: NonNullable<Parameters<typeof defineCard>[0]['onCast']>, target: 'recruit' | 'globe' = 'globe') =>
  defineCard({ id, name: id, house: 'war', cost: {}, type: 'manifestation', target, onCast });

describe('spell:cast', () => {
  const listener = defineCard({
    id: 'listener', name: 'listener', house: 'life', cost: {}, type: 'alteration', target: 'recruit',
    on: {
      'spell:cast': (c, ev) => {
        if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
        if (ev.data.type === 'alteration' && ev.data.spellId !== c.spell.id && ev.data.caster === 'red') c.setToken('n', c.token('n') + 1);
      },
    },
  });
  const buff = defineCard({ id: 'buff', name: 'buff', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
  const zap = defineCard({ id: 'zap', name: 'zap', house: 'war', cost: {}, type: 'manifestation', target: 'recruit' });

  it('is dispatched on the target after each successful cast', () => {
    const e = blankEngine([listener, buff, zap]);
    const m = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    const t = { kind: 'minion' as const, id: m };
    executeCast(e, 'red', 'listener', t);
    const sp = () => e.state.spells.find((s) => s.cardId === 'listener')!;
    expect(sp().tokens.n ?? 0).toBe(0); // its own cast does not count
    executeCast(e, 'red', 'buff', t);
    expect(sp().tokens.n).toBe(1);
    expect(executeCast(e, 'red', 'buff', t)).toBe('squandered');
    executeCast(e, 'red', 'zap', t);
    expect(sp().tokens.n).toBe(1);
  });
});

describe('levels, deck and hand', () => {
  it('addLevel raises the base level up to 5', () => {
    const up = probe('up', (c, t) => { if (t.kind === 'minion') c.addLevel(t.id, 3); }, 'recruit');
    const e = blankEngine([up]);
    const m = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    executeCast(e, 'red', 'up', { kind: 'minion', id: m });
    expect(e.state.minions[m].base.level).toBe(4);
    executeCast(e, 'red', 'up', { kind: 'minion', id: m });
    expect(e.state.minions[m].base.level).toBe(5);
  });

  it('removeTopCard removes the top card of a deck', () => {
    let got: string | undefined = 'unset';
    const mill = probe('mill', (c) => { got = c.removeTopCard('blue'); });
    const e = blankEngine([mill]);
    e.state.players.blue.deck = ['a', 'b'];
    executeCast(e, 'red', 'mill', { kind: 'globe' });
    expect(got).toBe('a');
    expect(e.state.players.blue.deck).toEqual(['b']);
    e.state.players.blue.deck = [];
    executeCast(e, 'red', 'mill', { kind: 'globe' });
    expect(got).toBeUndefined();
  });

  it('reveal stores intel until the next start of turn', () => {
    const spy = probe('spy', (c) => c.reveal('red', 'blue'));
    const e = blankEngine([spy]);
    e.state.players.blue.deck = ['x', 'y'];
    executeCast(e, 'red', 'spy', { kind: 'globe' });
    expect(e.state.players.red.intel).toEqual([{ source: 'spy', side: 'blue', cardId: 'x' }]);
    expect(e.state.players.blue.intel).toBeUndefined();
    e.state.turn += 1;
    beginTurn(e, false);
    expect(e.state.players.red.intel).toBeUndefined();
  });

  it('addToHand puts a card into a hand', () => {
    const gift = probe('gift', (c) => c.addToHand('red', 'gift'));
    const bad = probe('bad', (c) => c.addToHand('red', 'nope'));
    const e = blankEngine([gift, bad]);
    executeCast(e, 'red', 'gift', { kind: 'globe' });
    expect(e.state.players.red.hand).toEqual(['gift']);
    expect(() => executeCast(e, 'red', 'bad', { kind: 'globe' })).toThrow(/unknown card "nope"/);
  });
});

describe('copyOf', () => {
  const base = defineCard({ id: 'base', name: 'Base', house: 'war', cost: { strife: 1 }, type: 'alteration', target: 'recruit' });
  const copy = defineCard({ id: 'base-2', name: 'Base (2 tokens)', house: 'war', cost: { strife: 2 }, type: 'alteration', target: 'recruit', copyOf: 'base' });

  it('a hand copy cannot be put in a deck', () => {
    expect(validateDeck({ house: 'war', cards: Array(30).fill('base-2') }, indexCards([base, copy]))).toMatch(/hand copy/);
    expect(validateDeck({ house: 'war', cards: Array(30).fill('base').slice(0, 4).concat(Array(26).fill('base-2')) }, indexCards([base, copy]))).toMatch(/hand copy/);
  });

  it('a copy and its original are exclusive together', () => {
    const e = blankEngine([base, copy]);
    const t = { kind: 'minion' as const, id: put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0] };
    expect(executeCast(e, 'red', 'base', t)).toBe('cast');
    expect(executeCast(e, 'red', 'base-2', t)).toBe('squandered');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/cardflow.test.ts`
Expected: FAIL (type errors are reported by `tsc` later; at runtime `c.addLevel is not a function`, no `spell:cast`, the copy is accepted).

- [ ] **Step 3: Types, card field, event**

`packages/engine/src/types.ts`: add before `PlayerState`
```ts
/** Something a spell told a player this turn: the top card of `side`'s deck. */
export interface Intel {
  /** Card id of the spell that told it. */
  source: string;
  side: Side;
  cardId: string;
}
```
and add to `PlayerState` (after `heroesCast`)
```ts
  /** What spells told this player this turn (Spy at Court). Cleared at every start of turn; absent when empty. */
  intel?: Intel[];
```
`packages/engine/src/cards.ts`, add to `CardDef` after `helper`:
```ts
  /** A recursive hand copy of that card (more tokens): never in a deck, and exclusive together with the original. */
  copyOf?: string;
```
`packages/engine/src/events.ts`: add a line to `EventType` after the `// minion` block:
```ts
  // the target of a cast (any ref): { cardId, type, caster, spellId } (spellId -1 for instant spells)
  | 'spell:cast'
```
`packages/cards/src/lang/types.ts`: `copyOf` is identity, not a keyword hook; change the `Fragment` line to
```ts
export type Fragment = Partial<Omit<CardDef, 'id' | 'name' | 'house' | 'cost' | 'type' | 'target' | 'text' | 'copyOf'>>;
```

- [ ] **Step 4: Cast event and family exclusivity**

`packages/engine/src/spells.ts`: add `import { dispatch } from './events';` and replace the body of `executeCast` from the `const persists = ...` line to the end with:
```ts
  const persists = card.type === 'alteration' || card.type === 'conjuration';
  const visible = persists && card.visible !== false;
  // A recursive copy and its original count as the same spell for exclusivity.
  const family = (id: string) => e.cards[id]?.copyOf ?? id;
  if (persists && (card.exclusive ?? visible) && spellsOn(s, ref).some((sp) => family(sp.cardId) === family(cardId))) {
    return squander('exclusive');
  }
  if (card.type === 'hero' && caster !== 'neutral') s.players[caster].heroesCast.push(card.id);
  s.log.push({ type: 'cast', card: cardId, caster, target: ref });
  let spellId = -1;
  if (persists) {
    const sp = addSpellRecord(s, {
      cardId, owner: caster, host: ref, visible, turnsLeft: card.duration?.turns ?? null, tokens: {},
    });
    spellId = sp.id;
    card.onCast?.(makeCtx(e, sp), ref);
    recheck(e, ref);
  } else {
    const transient: ActiveSpell = { id: -1, cardId, owner: caster, host: ref, visible: false, turnsLeft: null, tokens: {} };
    card.onCast?.(makeCtx(e, transient), ref);
  }
  dispatch(e, 'spell:cast', ref, { cardId, type: card.type, caster, spellId });
  syncHp(e);
  return 'cast';
}
```
(`events.ts` and `spells.ts` already import each other through `ctx.ts`; the cycle only holds functions, so it is safe.)

`packages/engine/src/api.ts`, in `validateDeck` after the helper check:
```ts
    if (cards[id].copyOf) return `"${id}" is a hand copy of "${cards[id].copyOf}", not a deck card`;
```

- [ ] **Step 5: Context actions and intel reset**

`packages/engine/src/ctx.ts`, add to `EventContext` (after `draw`):
```ts
  /** Raises a minion's base level by `n` (permanent; level stays within 0..5). */
  addLevel(minionId: number, n: number): void;
  /** Removes the top card of a player's deck from the game. Returns it, or undefined when the deck is empty. */
  removeTopCard(side: Side): string | undefined;
  /** Tells player `to` the top card of `side`'s deck (in `players[to].intel` until the next start of turn). */
  reveal(to: Side, side: Side): void;
  /** Adds a card (a recursive copy) to a player's hand. Throws on an unknown card id. */
  addToHand(side: Side, cardId: string): void;
```
and to the object in `makeCtx` (after `draw`):
```ts
    addLevel: (id, n) => {
      const m = e.state.minions[id];
      if (!m || m.status === 'dead') return;
      m.base.level = Math.max(0, Math.min(RULES.maxLevel, m.base.level + n));
    },
    removeTopCard: (side) => e.state.players[side].deck.shift(),
    reveal: (to, side) => {
      const top = e.state.players[side].deck[0];
      if (top === undefined) return;
      const p = e.state.players[to];
      p.intel = [...(p.intel ?? []), { source: spell.cardId, side, cardId: top }];
    },
    addToHand: (side, cardId) => {
      if (!e.cards[cardId]) throw new Error(`addToHand: unknown card "${cardId}"`);
      e.state.players[side].hand.push(cardId);
    },
```
`packages/engine/src/turn.ts`, in `beginTurn` directly after `s.log.push({ type: 'turn', turn: s.turn });`:
```ts
  for (const side of SIDES) delete s.players[side].intel; // intel lasts one turn
```
`packages/engine/src/index.ts`: add `Intel` to the `export type { ... } from './types';` list.

- [ ] **Step 6: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/cardflow.test.ts`
Expected: PASS (7 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): spell:cast event, levels, deck removal, intel, hand copies" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Card-flow cards (Book of War, Day of Mourning, Seelie Champion, Growing Strife, Greater Clarity, Spy at Court, Challenge)

**Goal:** The five E10 cards plus Spy at Court and Challenge (E8 cards that need nothing beyond Task 2), with a `Recursive` keyword and a `recursive()` card generator.

**Files:**
- Create: `packages/cards/src/lang/keywords/recursive.ts`, `packages/cards/src/war/{bookOfWar,growingStrife,challenge}.ts`, `packages/cards/src/life/{dayOfMourning,greaterClarity,seelieChampion,spyAtCourt}.ts`, `packages/cards/test/cardflow-cards.test.ts`
- Modify: `packages/cards/src/lang/{types,card,index}.ts`, `packages/cards/src/index.ts`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] `recursive()` declares a card and its copies `<id>-2` ... `<id>-8` (`copyOf`, +1 cost per token on the first mana type, "(N tokens)" names); casting copy N adds copy N+1 to the caster's hand (copy 8 adds copy 8); copies are not in `playableCards` or starter decks
- [ ] Growing Strife copy N gives +N H; Greater Clarity copy N gives +N M; a copy cannot join its original on one target
- [ ] Book of War: a recruit that kills by combat damage gets +1 level at the next start of turn, once per turn
- [ ] Day of Mourning (Lasts 5): each recruit death removes the top card of its owner's deck
- [ ] Seelie Champion: +1 M per alteration cast on the archer after it
- [ ] Spy at Court: at start of turn its caster's `intel` holds the top card of the structure owner's deck (before draws); nothing for a neutral town
- [ ] Challenge: the owner of the single highest-level on-board recruit gains Initiative; a tie or a neutral top changes nothing
- [ ] Backlog loses E10, Challenge and Spy at Court; meta says 90 playable (44 War, 46 Life) and 12 pending; faces pins 119 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/cardflow-cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateDeck } from '@sanctum/engine';
import type { Ref } from '@sanctum/engine';
import { computeStats, dispatch, killMinion } from '@sanctum/engine/src/testing';
import { allCards, cardIndex, playableCards, starterDeck } from '../src/index';
import { advance, castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const globe: Ref = { kind: 'globe' };
const town = (id: number, owner: 'red' | 'blue' | 'neutral', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('Recursive cards', () => {
  it('Growing Strife: +T H and a copy with one more token in hand', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'growing-strife', mref(g.minionIds[0]))).toBe('cast');
    expect(computeStats(e, g.minionIds[0]).hand).toBe(3);
    expect(e.state.players.red.hand).toEqual(['growing-strife-2']);
    expect(castMini(e, 'red', 'growing-strife-2', mref(g.minionIds[1]))).toBe('cast');
    expect(computeStats(e, g.minionIds[1]).hand).toBe(4);
    expect(e.state.players.red.hand).toEqual(['growing-strife-2', 'growing-strife-3']);
    expect(castMini(e, 'red', 'growing-strife-3', mref(g.minionIds[0]))).toBe('squandered'); // same spell already there
  });

  it('copies cost more, carry the token count in their name, stop at 8 and stay out of decks', () => {
    expect(cardIndex['growing-strife'].cost).toEqual({ strife: 2 });
    expect(cardIndex['growing-strife-2']).toMatchObject({ name: 'Growing Strife (2 tokens)', cost: { strife: 3 }, copyOf: 'growing-strife' });
    expect(cardIndex['greater-clarity-8'].cost).toEqual({ clarity: 9 });
    expect(cardIndex['growing-strife-9']).toBeUndefined();
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    castMini(e, 'red', 'growing-strife-8', mref(g.minionIds[0]));
    expect(e.state.players.red.hand).toEqual(['growing-strife-8']);
    expect(playableCards.some((c) => c.copyOf)).toBe(false);
    expect(starterDeck('war').cards.some((id) => id.startsWith('growing-strife-'))).toBe(false);
    expect(validateDeck({ house: 'war', cards: Array(30).fill('growing-strife-2') }, cardIndex)).toMatch(/hand copy/);
  });

  it('Greater Clarity: +T M', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    castMini(e, 'red', 'greater-clarity', mref(g.minionIds[0]));
    expect(computeStats(e, g.minionIds[0]).missile).toBe(3);
    expect(e.state.players.red.hand).toEqual(['greater-clarity-2']);
  });
});

describe('Book of War', () => {
  it('a recruit that kills gets one level at the next start of turn', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    expect(castMini(e, 'red', 'book-of-war', globe)).toBe('cast');
    dispatch(e, 'attacker:kills', mref(g.minionIds[0]), { victimId: 0 });
    dispatch(e, 'attacker:kills', mref(g.minionIds[0]), { victimId: 0 });
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(1);
    advance(e);
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(2);
    expect(e.state.minions[g.minionIds[1]].base.level).toBe(1);
    advance(e);
    expect(e.state.minions[g.minionIds[0]].base.level).toBe(2);
  });
});

describe('Day of Mourning', () => {
  it('each recruit death removes the top card of its owner\'s deck, for 5 turns', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    e.state.players.red.deck = ['a', 'b', 'c'];
    expect(castMini(e, 'blue', 'day-of-mourning', globe)).toBe('cast');
    expect(e.state.spells.find((s) => s.cardId === 'day-of-mourning')!.turnsLeft).toBe(5);
    killMinion(e, g.minionIds[0], null, 'dies');
    expect(e.state.players.red.deck).toEqual(['b', 'c']);
    killMinion(e, g.minionIds[1], null, 'removed'); // removed from the game: not a death
    expect(e.state.players.red.deck).toEqual(['b', 'c']);
  });
});

describe('Seelie Champion', () => {
  it('+1 M for each alteration cast on the archer after it', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const a = g.minionIds[0];
    expect(castMini(e, 'red', 'seelie-champion', mref(a))).toBe('cast');
    expect(computeStats(e, a).missile).toBe(2);
    castMini(e, 'red', 'marksman', mref(a)); // +1 M itself, +1 from the Champion
    expect(computeStats(e, a).missile).toBe(4);
    castMini(e, 'red', 'cadre', { kind: 'group', id: g.id }); // a group spell does not count
    expect(computeStats(e, a).missile).toBe(4);
    castMini(e, 'blue', 'greater-clarity', mref(a)); // anyone's alteration counts
    expect(computeStats(e, a).missile).toBe(6);
  });
});

describe('Spy at Court', () => {
  it('tells its caster the top card of the owner\'s deck at start of turn, before draws', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'blue', 4, 4);
    e.state.players.blue.deck = ['fireball', 'pyx'];
    expect(castMini(e, 'red', 'spy-at-court', { kind: 'structure', id: 900 })).toBe('cast');
    advance(e);
    expect(e.state.players.red.intel).toEqual([{ source: 'spy-at-court', side: 'blue', cardId: 'fireball' }]);
    expect(e.state.players.blue.hand).toContain('fireball');
  });
  it('learns nothing from a neutral town', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'neutral', 4, 4);
    castMini(e, 'red', 'spy-at-court', { kind: 'structure', id: 900 });
    advance(e);
    expect(e.state.players.red.intel).toBeUndefined();
  });
});

describe('Challenge', () => {
  it('gives Initiative to the owner of the highest-level recruit on the board', () => {
    const e = mini(allCards);
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    e.state.initiative = 'blue';
    e.state.minions[red.minionIds[0]].base.level = 3;
    castMini(e, 'blue', 'challenge', globe);
    expect(e.state.initiative).toBe('red');
    e.state.minions[blue.minionIds[0]].base.level = 3;
    e.state.initiative = 'blue';
    castMini(e, 'red', 'challenge', globe);
    expect(e.state.initiative).toBe('blue'); // tie: no change
  });
  it('ignores recruits off the board', () => {
    const e = mini(allCards);
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    put(e, 'blue', { x: 6, y: 6 }, ['swordsman']);
    e.state.minions[red.minionIds[0]].base.level = 4;
    e.state.groups[red.id].pos = null;
    castMini(e, 'red', 'challenge', globe);
    expect(e.state.initiative).toBe('blue');
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/cardflow-cards.test.ts`
Expected: FAIL (unknown cards squander; `cardIndex['growing-strife']` is undefined).

- [ ] **Step 3: `copyOf` through the language**

`packages/cards/src/lang/types.ts`, add to `CardSpec` after `helper?: boolean;`:
```ts
  /** A recursive hand copy of this card id. */
  copyOf?: string;
```
`packages/cards/src/lang/card.ts`: add `copyOf?: string;` to `CardInput` (after `helper?: boolean;`, with the comment `/** A recursive hand copy of this card id (see recursive()). */`); in `card()`, add `copyOf: input.copyOf,` to the `spec` literal; and after `if (spec.helper) def.helper = true;` add
```ts
  if (spec.copyOf) def.copyOf = spec.copyOf;
```
`packages/cards/src/index.ts`: copies are not deck cards:
```ts
/** Cards a player can put in a deck (everything except engine-cast helper spells and recursive hand copies). */
export const playableCards = allCards.filter((c) => !c.helper && !c.copyOf);
```

- [ ] **Step 4: The `Recursive` keyword and generator**

`packages/cards/src/lang/keywords/recursive.ts`:
```ts
import type { CardDef, Mana } from '@sanctum/engine';
import { card, type CardInput } from '../card';
import { defineKeyword } from '../registry';
import type { Keyword } from '../types';

/** Highest token count of a recursive copy; casting the copy at the cap returns another copy at the cap. */
export const RECURSIVE_MAX = 8;

export interface RecursiveKeyword extends Keyword {
  kind: 'recursive';
  tokens: number;
  next: string;
}
/** "Recursive N": the spell has N tokens; casting it adds card `next` (the copy with one more token) to the caster's hand. */
export const Recursive = (tokens: number, next: string): RecursiveKeyword => ({ kind: 'recursive', tokens, next });

defineKeyword<RecursiveKeyword>({
  kind: 'recursive', term: 'Recursive', tier: 'house',
  gloss: `Recursive N: the spell has N tokens. When it is cast, a copy with one more token, costing 1 more mana, is added to your hand (at most ${RECURSIVE_MAX} tokens). Copies never go in a deck.`,
  print: (k) => ({ layout: 'inline', text: `Recursive ${k.tokens}` }),
  compile: (k) => ({
    onCast: (c) => {
      if (c.spell.owner !== 'neutral') c.addToHand(c.spell.owner, k.next);
    },
  }),
});

/** Card id of the copy with `tokens` tokens (the card itself has 1). */
export const recursiveId = (id: string, tokens: number): string => (tokens === 1 ? id : `${id}-${tokens}`);

/**
 * A recursive card and its hand copies with 2..RECURSIVE_MAX tokens. `keywordsFor(t)` gives the keywords of the copy
 * with t tokens; copy t costs t-1 more of the card's first mana type.
 */
// RULING: the original has no stated cap; copies are separate card ids, so one is needed. 9+ mana for one spell does not
// happen in play, so the cap is never felt.
export function recursive(input: Omit<CardInput, 'keywords' | 'copyOf'>, keywordsFor: (tokens: number) => Keyword[]): CardDef[] {
  const mana = Object.keys(input.cost)[0] as Mana;
  const out: CardDef[] = [];
  for (let t = 1; t <= RECURSIVE_MAX; t++) {
    out.push(card({
      ...input,
      id: recursiveId(input.id, t),
      name: t === 1 ? input.name : `${input.name} (${t} tokens)`,
      cost: { ...input.cost, [mana]: (input.cost[mana] ?? 0) + t - 1 },
      ...(t === 1 ? {} : { copyOf: input.id }),
      keywords: [Recursive(t, recursiveId(input.id, Math.min(t + 1, RECURSIVE_MAX))), ...keywordsFor(t)],
    }));
  }
  return out;
}
```
`packages/cards/src/lang/index.ts`: add `export * from './keywords/recursive';` after the `versus` line.

- [ ] **Step 5: The seven cards**

`packages/cards/src/war/growingStrife.ts`:
```ts
import { Grant, recursive, Target } from '../lang';

/** Growing Strife and its hand copies (2..8 tokens). */
export const growingStrifeCards = recursive(
  { id: 'growing-strife', name: 'Growing Strife', house: 'war', cost: { strife: 2 }, type: 'alteration', target: Target.swordsman },
  (t) => [Grant({ hand: t })],
);
export default growingStrifeCards[0];
```
`packages/cards/src/life/greaterClarity.ts`:
```ts
import { Grant, recursive, Target } from '../lang';

/** Greater Clarity and its hand copies (2..8 tokens). */
export const greaterClarityCards = recursive(
  { id: 'greater-clarity', name: 'Greater Clarity', house: 'life', cost: { clarity: 2 }, type: 'alteration', target: Target.archer },
  (t) => [Grant({ missile: t })],
);
export default greaterClarityCards[0];
```
`packages/cards/src/war/bookOfWar.ts`:
```ts
import { card, Script, Target } from '../lang';

const KILLER = 'k';

// RULING: one level per recruit per turn however many it kills ("regardless of the number of kills"); monsters never
// gain levels. The level is a permanent base level, capped at 5.
export default card({ id: 'book-of-war', name: 'Book of War', house: 'war', cost: { strife: 4, clarity: 4 }, type: 'alteration',
  target: Target.globe,
  keywords: [
    Script('When a recruit kills by combat damage, it gets +1 L at the start of the next turn (once per turn, at most L5).', {
      on: {
        'attacker:kills': (c, ev) => {
          if (ev.ref?.kind === 'minion' && c.minion(ev.ref.id)?.kind === 'recruit') c.setToken(`${KILLER}${ev.ref.id}`, 1);
        },
        'turn:start': (c) => {
          for (const [name, v] of Object.entries(c.spell.tokens)) {
            if (!name.startsWith(KILLER) || v !== 1) continue;
            c.addLevel(Number(name.slice(KILLER.length)), 1);
            c.setToken(name, 0);
          }
        },
      },
    }),
  ] });
```
`packages/cards/src/life/dayOfMourning.ts`:
```ts
import { card, Lasts, Script, Target } from '../lang';

// RULING: "dies" covers kills and instant deaths, not minions removed from the game. The card is removed, not discarded.
export default card({ id: 'day-of-mourning', name: 'Day of Mourning', house: 'life', cost: { clarity: 4, world: 1 }, type: 'conjuration',
  target: Target.globe,
  keywords: [
    Lasts(5),
    Script("Each time a recruit dies, the top card of its owner's deck is removed from the game.", {
      on: {
        'minion:dies': (c, ev) => {
          if (ev.ref?.kind !== 'minion') return;
          const m = c.minion(ev.ref.id);
          if (m?.kind === 'recruit' && m.owner !== 'neutral') c.removeTopCard(m.owner);
        },
      },
    }),
  ] });
```
`packages/cards/src/life/seelieChampion.ts`:
```ts
import { card, Script, Target } from '../lang';

// RULING: counts alterations cast on this archer after Seelie Champion, by either player. Group spells, instant spells
// and helper spells that effects create (not "cast") do not count.
export default card({ id: 'seelie-champion', name: 'Seelie Champion', house: 'life', cost: { clarity: 1, world: 1 }, type: 'alteration',
  target: Target.archer,
  keywords: [
    Script('+1 M for each alteration cast on it after this one.', {
      stats: (_q, _id, sp) => ({ missile: sp.tokens.n ?? 0 }),
      on: {
        'spell:cast': (c, ev) => {
          if (ev.ref?.kind !== 'minion' || c.host.kind !== 'minion' || ev.ref.id !== c.host.id) return;
          if (ev.data.type === 'alteration' && ev.data.spellId !== c.spell.id) c.setToken('n', c.token('n') + 1);
        },
      },
    }),
  ] });
```
`packages/cards/src/life/spyAtCourt.ts`:
```ts
import { card, Script, Target } from '../lang';

// RULING: what the spy learns is private (PlayerState.intel) and lasts until the next start of turn. A neutral
// structure has no deck, so it tells nothing.
export default card({ id: 'spy-at-court', name: 'Spy at Court', house: 'life', cost: { clarity: 1, world: 1 }, type: 'alteration',
  target: Target.structure,
  keywords: [
    Script("Start of turn: its caster sees the top card of the town's owner's deck.", {
      on: {
        'turn:start': (c) => {
          const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
          const to = c.spell.owner;
          const from = st?.owner;
          if (!from || to === 'neutral' || from === 'neutral') return;
          c.reveal(to, from);
        },
      },
    }),
  ] });
```
`packages/cards/src/war/challenge.ts`:
```ts
import type { PlayerId } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

// RULING: neutral recruits count when finding the highest level, but neutral cannot hold Initiative, so a neutral top or
// a tie involving neutral changes nothing. The change is immediate (movement and combat this turn); this turn's spell
// order was fixed before spells ran.
export default card({ id: 'challenge', name: 'Challenge', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'manifestation',
  target: Target.globe,
  keywords: [
    Script('The owner of the highest-level recruit on the board gains Initiative (no change on a tie).', {
      onCast: (c) => {
        let best = -1;
        let owners = new Set<PlayerId>();
        for (const m of Object.values(c.state.minions)) {
          if (m.kind !== 'recruit' || m.status !== 'alive' || !c.group(m.groupId)?.pos) continue;
          const level = c.stats(m.id).level;
          if (level > best) {
            best = level;
            owners = new Set([m.owner]);
          } else if (level === best) {
            owners.add(m.owner);
          }
        }
        const [only] = [...owners];
        if (owners.size === 1 && only !== undefined && only !== 'neutral') c.setInitiative(only);
      },
    }),
  ] });
```
Register: `packages/cards/src/war/index.ts`: add
```ts
import bookOfWar from './bookOfWar';
import challenge from './challenge';
import { growingStrifeCards } from './growingStrife';
```
and append `bookOfWar, challenge, ...growingStrifeCards,` to `warCards`. `packages/cards/src/life/index.ts`: add
```ts
import dayOfMourning from './dayOfMourning';
import { greaterClarityCards } from './greaterClarity';
import seelieChampion from './seelieChampion';
import spyAtCourt from './spyAtCourt';
```
and append `dayOfMourning, ...greaterClarityCards, seelieChampion, spyAtCourt,` to `lifeCards`.

- [ ] **Step 6: Faces, counts, backlog**

`faces.test.ts`, insert before `it('pins the printed text of every card'`:
```ts
  it('plan 2d: card flow', () => {
    expect(lines('growing-strife')).toEqual(['Swordsman.', 'Recursive 1.', '+1 H.']);
    expect(lines('growing-strife-3')).toEqual(['Swordsman.', 'Recursive 3.', '+3 H.']);
    expect(lines('greater-clarity')).toEqual(['Archer.', 'Recursive 1.', '+1 M.']);
    expect(lines('book-of-war')).toEqual([
      'Globe.', 'When a recruit kills by combat damage, it gets +1 L at the start of the next turn (once per turn, at most L5).',
    ]);
    expect(lines('day-of-mourning')).toEqual([
      'Globe.', 'Lasts 5 turns.', "Each time a recruit dies, the top card of its owner's deck is removed from the game.",
    ]);
    expect(lines('seelie-champion')).toEqual(['Archer.', '+1 M for each alteration cast on it after this one.']);
    expect(lines('spy-at-court')).toEqual(['Town or colony.', "Start of turn: its caster sees the top card of the town's owner's deck."]);
    expect(lines('challenge')).toEqual(['Globe.', 'The owner of the highest-level recruit on the board gains Initiative (no change on a tie).']);
  });

```
and set the count to `toHaveLength(119)`.
`meta.test.ts`: the registry count block becomes
```ts
  it('has 90 playable cards (44 War, 46 Life) and 12 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(44);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(46);
    expect(pendingCards).toHaveLength(12);
  });
```
`cards-backlog.md`: header `Implemented: 90 (44 War, 46 Life).`; delete the whole `## E10. Tokens, copies and experience (5)` section; in E8 delete the bullets `- Challenge (War)` and `- Spy at Court (Life)`, and change its heading and "Needs" line to:
```markdown
## E8. Structures (4)
Needs: create/destroy/move structures, colonies, hidden structures.
```

- [ ] **Step 7: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/cardflow-cards.test.ts`
Expected: PASS (11 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the 21 new snapshot entries (7 cards, 14 copies).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. (The web package's `newSession` deals the new cards through `starterDeck`; if a web test pinned a hand or deck size from the old card list, update that expectation and say so in the commit.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(cards): Book of War, Day of Mourning, Seelie Champion, Growing Strife, Greater Clarity, Spy at Court, Challenge" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Entry restrictions in the engine (`blocksEntry`)

**Goal:** An active spell can forbid a group from entering a square, and every way a group chooses or orders a step respects it.

**Files:**
- Create: `packages/engine/test/entry.test.ts`
- Modify: `packages/engine/src/{cards,movement,orders,ctx,testing}.ts`, `packages/cards/src/lang/merge.ts`

**Acceptance Criteria:**
- [ ] `CardDef.blocksEntry(q, spell, groupId, dest)` returning true stops a group's move into `dest` during movement (it stays put)
- [ ] `validateOrders` rejects such a move with `that square cannot be entered`; `canEnterSquare`, `legalDirections` and `ctx.canEnter` exclude it
- [ ] A spell whose host is off the board blocks nothing
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/entry.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { canEnterSquare, runMovement } from '../src/movement';
import { validateOrders } from '../src/orders';
import { addSpellRecord } from '../src/spellstore';
import { emptyOrders } from '../src/types';
import { blankEngine, put } from './helpers';

const wall = defineCard({
  id: 'wall', name: 'wall', house: 'life', cost: {}, type: 'conjuration', target: 'square',
  blocksEntry: (_q, sp, _gid, dest) => sp.host.kind === 'square' && sp.host.pos.x === dest.x && sp.host.pos.y === dest.y,
});
const everywhere = defineCard({ id: 'everywhere', name: 'everywhere', house: 'life', cost: {}, type: 'alteration', target: 'group', blocksEntry: () => true });

describe('blocksEntry', () => {
  it('stops movement into the square and is refused as an order', () => {
    const e = blankEngine([wall]);
    addSpellRecord(e.state, { cardId: 'wall', owner: 'blue', host: { kind: 'square', pos: { x: 5, y: 4 } }, visible: true, turnsLeft: null, tokens: {} });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 4, y: 5 })).toBe(true);
    expect(validateOrders(e, 'red', { ...emptyOrders(), move: [{ groupId: g.id, dir: 'e' }] })).toBe('that square cannot be entered');
    g.moveOrder = 'e';
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('does nothing while its host is off the board', () => {
    const e = blankEngine([everywhere]);
    const away = put(e, 'blue', { x: 8, y: 2 }, ['swordsman']);
    addSpellRecord(e.state, { cardId: 'everywhere', owner: 'blue', host: { kind: 'group', id: away.id }, visible: true, turnsLeft: null, tokens: {} });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    away.pos = null;
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/entry.test.ts`
Expected: FAIL (the group moves; `validateOrders` returns null).

- [ ] **Step 3: The hook**

`packages/engine/src/cards.ts`: add `Pos` to the `./types` type import and, after `blocksCast`, add to `CardDef`:
```ts
  /**
   * While active, return true to stop group `groupId` from entering square `dest` (movement, bot steps, orders,
   * `ctx.canEnter`). Returning from off the board and relocation are not entering.
   */
  blocksEntry?: (q: QueryContext, spell: ActiveSpell, groupId: number, dest: Pos) => boolean;
```
`packages/cards/src/lang/merge.ts`, add to `MERGERS` after `blocksCast`:
```ts
  blocksEntry: (fs) => (q, sp, gid, dest) => fs.some((f) => f(q, sp, gid, dest)),
```

- [ ] **Step 4: Check it everywhere a group steps**

`packages/engine/src/movement.ts`: change the ctx import to `import { makeBotContext, makeQuery } from './ctx';`, add `isOffBoard` to the `./query` import, and add before `canEnterSquare`:
```ts
/** True when an active spell forbids this group from entering `dest`. Spells on off-board hosts are suspended. */
export function entryBlocked(e: Engine, g: Group, dest: Pos): boolean {
  const s = e.state;
  for (const sp of s.spells) {
    const fn = e.cards[sp.cardId]?.blocksEntry;
    if (fn && !isOffBoard(s, sp.host) && fn(makeQuery(e, sp.owner), sp, g.id, dest)) return true;
  }
  return false;
}
```
and in `canEnterSquare`, before the final `return true;`:
```ts
  if (entryBlocked(e, g, dest)) return false;
```
`packages/engine/src/orders.ts`: add `import { entryBlocked } from './movement';` and, in the move loop after the terrain check:
```ts
    if (entryBlocked(e, g, dest)) return 'that square cannot be entered';
```
`packages/engine/src/ctx.ts`: change the movement import to `import { canEnterSquare, entryBlocked } from './movement';` and the `canEnter` implementation to
```ts
    canEnter: (id, pos) => {
      const g = e.state.groups[id];
      return !!g && e.state.cells.includes(key(pos)) && groupCanEnter(e, g, e.state.terrain[key(pos)]) && !entryBlocked(e, g, pos);
    },
```
(update its doc comment: "Whether the group's minions can all enter `pos` (square exists, terrain allows it, no spell forbids it).")
`packages/engine/src/testing.ts`: replace `export { runMovement } from './movement';` with
```ts
export { runMovement, canEnterSquare, entryBlocked } from './movement';
```

- [ ] **Step 5: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/entry.test.ts`
Expected: PASS (2 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): spells can forbid entering a square (blocksEntry)" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Entry cards (Fae Quadrille, Terrain Bind)

**Goal:** The two cards that restrict where groups may go.

**Files:**
- Create: `packages/cards/src/life/{faeQuadrille,terrainBind}.ts`, `packages/cards/test/entry-cards.test.ts`
- Modify: `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] Fae Quadrille (Lasts 2) on an empty square fully heals every minion in the four orthogonally adjacent squares when cast (not diagonal ones); no group can enter the square while it lasts
- [ ] Terrain Bind (Lasts 3) on a group: it cannot step onto a different terrain; a structure square counts as plains on both ends
- [ ] Backlog E11 loses both cards; meta says 92 playable (44 War, 48 Life) and 10 pending; faces pins 121 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/entry-cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { canEnterSquare, runMovement } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const sq = (x: number, y: number) => ({ kind: 'square' as const, pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('Fae Quadrille', () => {
  it('heals the four adjacent squares when cast, and its square cannot be entered', () => {
    const e = mini(allCards);
    const west = put(e, 'red', { x: 4, y: 5 }, ['swordsman']);
    const north = put(e, 'blue', { x: 5, y: 4 }, ['archer']);
    const diag = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    for (const g of [west, north, diag]) e.state.minions[g.minionIds[0]].hp = 3;
    expect(castMini(e, 'red', 'fae-quadrille', sq(5, 5))).toBe('cast');
    expect(e.state.minions[west.minionIds[0]].hp).toBe(7);
    expect(e.state.minions[north.minionIds[0]].hp).toBe(7);
    expect(e.state.minions[diag.minionIds[0]].hp).toBe(3);
    expect(e.state.spells.find((s) => s.cardId === 'fae-quadrille')!.turnsLeft).toBe(2);
    west.moveOrder = 'e';
    runMovement(e);
    expect(west.pos).toEqual({ x: 4, y: 5 });
  });
});

describe('Terrain Bind', () => {
  it('keeps the group on its own terrain; structures count as plains', () => {
    const e = mini(allCards);
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    e.state.terrain['5,4'] = 'forest';
    e.state.structures[900] = town(900, 'blue', 4, 3);
    expect(castMini(e, 'red', 'terrain-bind', { kind: 'group', id: g.id })).toBe('cast');
    expect(e.state.spells.find((s) => s.cardId === 'terrain-bind')!.turnsLeft).toBe(3);
    expect(canEnterSquare(e, g, { x: 5, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 4, y: 5 })).toBe(true);
    expect(canEnterSquare(e, g, { x: 4, y: 3 })).toBe(true);
    g.pos = { x: 5, y: 4 }; // now in forest: plains and the town are out of reach
    expect(canEnterSquare(e, g, { x: 4, y: 4 })).toBe(false);
    expect(canEnterSquare(e, g, { x: 6, y: 4 })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/entry-cards.test.ts`
Expected: FAIL (unknown cards squander).

- [ ] **Step 3: The cards**

`packages/cards/src/life/faeQuadrille.ts`:
```ts
import { ADJACENT } from '../helpers';
import { card, Lasts, Script, Target } from '../lang';

// RULING: "On turn of casting only, all minions in the four adjacent squares are fully healed" is one heal, when the
// spell is cast. "Turn of casting +1" = Lasts 2.
export default card({ id: 'fae-quadrille', name: 'Fae Quadrille', house: 'life', cost: { clarity: 3, world: 2 }, type: 'conjuration',
  target: Target.square,
  keywords: [
    Lasts(2),
    Script('Heal every minion in the four adjacent squares fully when cast. The square cannot be entered.', {
      onCast: (c, t) => {
        if (t.kind !== 'square') return;
        for (const d of ADJACENT) {
          const g = c.groupAt({ x: t.pos.x + d.x, y: t.pos.y + d.y });
          if (g) for (const m of c.minionsOf(g.id)) c.heal(m.id, 999);
        }
      },
      blocksEntry: (_q, sp, _gid, dest) => sp.host.kind === 'square' && sp.host.pos.x === dest.x && sp.host.pos.y === dest.y,
    }),
  ] });
```
`packages/cards/src/life/terrainBind.ts`:
```ts
import type { Pos, QueryContext, TerrainId } from '@sanctum/engine';
import { card, Lasts, Script, Target } from '../lang';

const terrainOf = (q: QueryContext, p: Pos): TerrainId | undefined => (q.structureAt(p) ? 'plains' : q.terrainAt(p));

// RULING: "Structures count as plains" applies to the square the group stands on and to the one it would enter.
export default card({ id: 'terrain-bind', name: 'Terrain Bind', house: 'life', cost: { clarity: 4, world: 2 }, type: 'conjuration',
  target: Target.group,
  keywords: [
    Lasts(3),
    Script('It cannot enter a terrain different from the one it stands on (structures count as plains).', {
      blocksEntry: (q, sp, gid, dest) => {
        if (sp.host.kind !== 'group' || sp.host.id !== gid) return false;
        const g = q.group(gid);
        return !!g?.pos && terrainOf(q, dest) !== terrainOf(q, g.pos);
      },
    }),
  ] });
```
Register in `packages/cards/src/life/index.ts`: imports `faeQuadrille`, `terrainBind`; append `faeQuadrille, terrainBind,` to `lifeCards`.

- [ ] **Step 4: Faces, counts, backlog**

`faces.test.ts`, before the pinning test:
```ts
  it('plan 2d: entry', () => {
    expect(lines('fae-quadrille')).toEqual([
      'Square.', 'Lasts 2 turns.', 'Heal every minion in the four adjacent squares fully when cast. The square cannot be entered.',
    ]);
    expect(lines('terrain-bind')).toEqual([
      'Group.', 'Lasts 3 turns.', 'It cannot enter a terrain different from the one it stands on (structures count as plains).',
    ]);
  });

```
count `toHaveLength(121)`. `meta.test.ts`:
```ts
  it('has 92 playable cards (44 War, 48 Life) and 10 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(44);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(48);
    expect(pendingCards).toHaveLength(10);
  });
```
`cards-backlog.md`: header `Implemented: 92 (44 War, 48 Life).`; in E11 delete `- Fae Quadrille (Life)` and `- Terrain Bind (Life)`, and make the heading and "Needs" line:
```markdown
## E11. One-off mechanics (4)
Needs: effects that reach other squares (General), random eruption (Lava Flow), ownership change (Renegades), class
change (Weapon Master).
```

- [ ] **Step 5: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/entry-cards.test.ts`
Expected: PASS (2 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the two new entries.
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cards): Fae Quadrille, Terrain Bind" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Board-wide stats, dual class, owner and control changes in the engine

**Goal:** A spell's stats can reach minions anywhere on the board, a minion can count as both classes for targeting, and a spell can hand a group to another owner (neutral included) or switch it between player and computer control.

**Files:**
- Create: `packages/engine/test/control.test.ts`
- Modify: `packages/engine/src/{cards,stats,units,ctx}.ts`, `packages/cards/src/lang/merge.ts`

**Acceptance Criteria:**
- [ ] `CardDef.reach: 'board'`: the card's `stats` is asked about every minion (once each), and not at all while its host is off the board
- [ ] `StatDelta.dualClass` / `Stats.dualClass` exist (default false)
- [ ] `ctx.setOwner(groupId, owner)` moves the group (and its minions) to `owner`, including `'neutral'`, fixing `groupSeq`; spells on it keep their owners
- [ ] `ctx.setControl(groupId, control, botId?)` sets control; a computer group uses the bot of `botId` (default: this spell's card) and a player group has no bot; the group's pending move order is cleared
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/control.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { makeCtx } from '../src/ctx';
import { runMovement } from '../src/movement';
import { hostile } from '../src/query';
import { addSpellRecord } from '../src/spellstore';
import { computeStats } from '../src/stats';
import type { Engine } from '../src/engine';
import { blankEngine, put } from './helpers';

const ctxOf = (e: Engine, cardId = 'x') =>
  makeCtx(e, addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} }));

describe('reach: board', () => {
  const banner = defineCard({
    id: 'banner', name: 'banner', house: 'war', cost: {}, type: 'alteration', target: 'recruit', reach: 'board',
    stats: (q, id, sp) => (sp.host.kind === 'minion' && q.minion(id)?.groupId !== q.minion(sp.host.id)?.groupId ? { hand: 1 } : {}),
  });
  it('asks the stats hook about every minion, not while the host is off the board', () => {
    const e = blankEngine([banner]);
    const home = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const other = put(e, 'red', { x: 7, y: 2 }, ['swordsman']);
    addSpellRecord(e.state, { cardId: 'banner', owner: 'red', host: { kind: 'minion', id: home.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    expect(computeStats(e, other.minionIds[0]).hand).toBe(3);
    expect(computeStats(e, home.minionIds[0]).hand).toBe(2);
    home.pos = null;
    expect(computeStats(e, other.minionIds[0]).hand).toBe(2);
  });
});

describe('dualClass', () => {
  it('defaults to false and can be granted', () => {
    const both = defineCard({ id: 'both', name: 'both', house: 'war', cost: {}, type: 'alteration', target: 'recruit', stats: () => ({ dualClass: true }) });
    const e = blankEngine([both]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    addSpellRecord(e.state, { cardId: 'both', owner: 'red', host: { kind: 'minion', id: g.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    expect(computeStats(e, g.minionIds[0]).dualClass).toBe(true);
    expect(computeStats(e, g.minionIds[1]).dualClass).toBe(false);
  });
});

describe('setOwner and setControl', () => {
  it('gives a group to the neutral player', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const friend = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const sp = addSpellRecord(e.state, { cardId: 'y', owner: 'red', host: { kind: 'group', id: g.id }, visible: true, turnsLeft: null, tokens: {} });
    ctxOf(e).setOwner(g.id, 'neutral');
    expect(g.owner).toBe('neutral');
    expect(g.minionIds.map((id) => e.state.minions[id].owner)).toEqual(['neutral', 'neutral']);
    expect(e.state.groupSeq.red).not.toContain(g.id);
    expect(e.state.groupSeq.neutral).toContain(g.id);
    expect(sp.owner).toBe('red');
    expect(hostile(g, friend)).toBe(true);
  });

  it('switches control and bot', () => {
    const mover = defineCard({ id: 'mover', name: 'mover', house: 'war', cost: {}, type: 'manifestation', target: 'recruitGroup', bot: () => 'e' });
    const e = blankEngine([mover]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    g.moveOrder = 's';
    ctxOf(e, 'mover').setControl(g.id, 'computer');
    expect(g).toMatchObject({ control: 'computer', botId: 'mover', moveOrder: null });
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
    ctxOf(e, 'mover').setControl(g.id, 'player');
    expect(g).toMatchObject({ control: 'player', botId: null });
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/control.test.ts`
Expected: FAIL (`dualClass` undefined, banner not applied to other groups, `setOwner is not a function`).

- [ ] **Step 3: Board reach and dual class**

`packages/engine/src/cards.ts`, add to `CardDef` after `groupAura`:
```ts
  /** 'board': `stats` is asked about every minion on the board (the hook decides who gets what), e.g. General. */
  reach?: 'board';
```
`packages/engine/src/stats.ts`: add to `StatDelta` and `Stats`
```ts
  /** Counts as both a swordsman and an archer for spell targeting (Weapon Master). */
  dualClass?: boolean;
```
(`dualClass: boolean;` in `Stats`), add `dualClass: false` to the `out` literal, `if (d.dualClass) out.dualClass = true;` in `add`, add `isOffBoard` to the `./query` import, and replace the two spell loops with
```ts
  for (const ref of refs) {
    for (const sp of spellsOn(s, ref)) {
      const card = e.cards[sp.cardId];
      if (card?.reach !== 'board') add(card?.stats?.(q, minionId, sp));
    }
  }
  if (g) {
    for (const mid of g.minionIds) {
      if (mid === m.id) continue;
      for (const sp of spellsOn(s, { kind: 'minion', id: mid })) {
        const card = e.cards[sp.cardId];
        if (card?.groupAura && card.reach !== 'board') add(card.stats?.(q, minionId, sp));
      }
    }
  }
  // Board-reach spells are asked about every minion exactly once; off the board they are suspended.
  for (const sp of s.spells) {
    const card = e.cards[sp.cardId];
    if (card?.reach === 'board' && !isOffBoard(s, sp.host)) add(card.stats?.(q, minionId, sp));
  }
```
`packages/cards/src/lang/merge.ts`: add `dualClass: either,` to `STAT_MERGERS` and `reach: same('reach', (a, b) => a === b),` to `MERGERS`.

- [ ] **Step 4: Owner and control**

`packages/engine/src/units.ts`, add after `flipGroup`:
```ts
/** Gives a group (and its minions) to `owner`, neutral included. Spells on it keep their owners. */
export function setGroupOwner(e: Engine, groupId: number, owner: PlayerId): void {
  const s = e.state;
  const g = s.groups[groupId];
  if (!g || g.owner === owner) return;
  s.groupSeq[g.owner] = s.groupSeq[g.owner].filter((id) => id !== groupId);
  s.groupSeq[owner].push(groupId);
  g.owner = owner;
  for (const mid of g.minionIds) if (s.minions[mid]) s.minions[mid].owner = owner;
}
```
`packages/engine/src/ctx.ts`: add `setGroupOwner` to the `./units` import; add to `EventContext` after `changeSides`:
```ts
  /** The group (and its minions) now belongs to `owner`, neutral included; spells on it keep their owners. */
  setOwner(groupId: number, owner: PlayerId): void;
  /** Player or computer control. A computer group moves by the bot of card `botId` (default: this spell's card). */
  setControl(groupId: number, control: 'player' | 'computer', botId?: string | null): void;
```
and to `makeCtx` after `changeSides`:
```ts
    setOwner: (groupId, owner) => setGroupOwner(e, groupId, owner),
    setControl: (groupId, control, botId) => {
      const g = e.state.groups[groupId];
      if (!g) return;
      g.control = control;
      g.botId = control === 'computer' ? (botId === undefined ? spell.cardId : botId) : null;
      g.moveOrder = null;
      g.moveSeq = null;
    },
```

- [ ] **Step 5: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/control.test.ts`
Expected: PASS (4 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(engine): board-reach stats, dual class, owner and control changes" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 7: One-off cards (General, Weapon Master, Renegades, Lava Flow)

**Goal:** The four remaining E11 cards, with target modifiers for group size, structures and control, and `Bound` for any terrain.

**Files:**
- Create: `packages/cards/src/war/{general,weaponMaster,renegades,lavaFlow,lavaFlowLava}.ts`, `packages/cards/test/control-cards.test.ts`
- Modify: `packages/cards/src/lang/{types,target}.ts`, `packages/cards/src/lang/keywords/statics.ts`, `packages/cards/src/war/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] `Target` gains `.playerControlled`, `.atLeast(n)`, `.atMost(n)`, `.notInStructure` (group targets; printed "Player-controlled recruit group of three or less not in a structure."); class targets accept a `dualClass` minion
- [ ] General: friendly swordsmen in the four squares next to the General's group get +1 M
- [ ] Weapon Master: a swordsman gets M2 x1 and an archer H2 x1; archer spells can target a Weapon Master swordsman and swordsman spells a Weapon Master archer
- [ ] Renegades: a player-controlled recruit group of 3 or fewer not in a structure becomes neutral and computer-controlled, and its bot hunts the nearest hostile recruit group; groups of 4, groups in a structure and computer groups cannot be targeted
- [ ] Lava Flow: a mountain becomes volcano; at start of turn it may erupt into 1-2 adjacent squares (never structures, mountains or volcanoes), which become lava and turn barren 3 expiries later; dispelled when its square stops being volcano
- [ ] Backlog loses E11; meta says 96 playable (48 War, 48 Life) and 6 pending; faces pins 126 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/control-cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Ref } from '@sanctum/engine';
import { computeStats, dispatch, expireSpells, recheck, runMovement } from '@sanctum/engine/src/testing';
import { printTarget, Target } from '../src/lang';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const mref = (id: number): Ref => ({ kind: 'minion', id });
const gref = (id: number): Ref => ({ kind: 'group', id });
const sq = (x: number, y: number): Ref => ({ kind: 'square', pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue', x: number, y: number) =>
  ({ id, kind: 'town' as const, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });

describe('target modifiers', () => {
  it('print in the order of the scraped texts', () => {
    expect(printTarget(Target.recruitGroup.playerControlled.atMost(3).notInStructure.spec))
      .toBe('Player-controlled recruit group of three or less not in a structure.');
    expect(printTarget(Target.recruitGroup.friendly.atLeast(2).notInStructure.spec))
      .toBe('Friendly recruit group of two or more not in a structure.');
  });
});

describe('General', () => {
  it('gives friendly swordsmen in the four adjacent squares +1 M', () => {
    const e = mini(allCards);
    const hq = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(castMini(e, 'blue', 'general', mref(hq.minionIds[0]))).toBe('squandered');
    expect(castMini(e, 'red', 'general', mref(hq.minionIds[0]))).toBe('cast');
    const near = put(e, 'red', { x: 5, y: 4 }, ['swordsman', 'archer']);
    const far = put(e, 'red', { x: 6, y: 4 }, ['swordsman']);
    const foe = put(e, 'blue', { x: 4, y: 5 }, ['swordsman']);
    expect(computeStats(e, near.minionIds[0]).missile).toBe(1);
    expect(computeStats(e, near.minionIds[1]).missile).toBe(2);
    expect(computeStats(e, far.minionIds[0]).missile).toBe(0);
    expect(computeStats(e, foe.minionIds[0]).missile).toBe(0);
  });
});

describe('Weapon Master', () => {
  it('gives each class the other attack and opens it to both kinds of spell', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [sw, ar] = g.minionIds;
    expect(castMini(e, 'red', 'yeoman', mref(sw))).toBe('squandered');
    expect(castMini(e, 'red', 'weapon-master', mref(sw))).toBe('cast');
    expect(castMini(e, 'red', 'weapon-master', mref(ar))).toBe('cast');
    const s = computeStats(e, sw);
    expect([s.hand, s.handAttacks, s.missile, s.missileAttacks, s.dualClass]).toEqual([2, 1, 2, 1, true]);
    const a = computeStats(e, ar);
    expect([a.hand, a.handAttacks, a.missile, a.missileAttacks]).toEqual([2, 1, 2, 1]);
    expect(castMini(e, 'red', 'yeoman', mref(sw))).toBe('cast');
    expect(castMini(e, 'red', 'flaming-sword', mref(ar))).toBe('cast');
  });
});

describe('Renegades', () => {
  it('turns a small player group neutral and computer-controlled', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer']);
    const prey = put(e, 'blue', { x: 4, y: 7 }, ['swordsman']);
    expect(castMini(e, 'blue', 'renegades', gref(g.id))).toBe('cast');
    expect(g).toMatchObject({ owner: 'neutral', control: 'computer', botId: 'renegades' });
    expect(e.state.groupSeq.neutral).toContain(g.id);
    runMovement(e);
    expect(g.pos).toEqual({ x: 4, y: 5 }); // closes on the nearest hostile recruit group
    expect(prey.pos).toEqual({ x: 4, y: 7 });
  });
  it('needs a player-controlled group of three or less, not in a structure', () => {
    const e = mini(allCards);
    const four = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'archer', 'archer']);
    expect(castMini(e, 'blue', 'renegades', gref(four.id))).toBe('squandered');
    const housed = put(e, 'red', { x: 6, y: 3 }, ['swordsman']);
    e.state.structures[900] = town(900, 'red', 6, 3);
    expect(castMini(e, 'blue', 'renegades', gref(housed.id))).toBe('squandered');
    const bot = put(e, 'red', { x: 2, y: 6 }, ['swordsman']);
    bot.control = 'computer';
    expect(castMini(e, 'blue', 'renegades', gref(bot.id))).toBe('squandered');
  });
});

describe('Lava Flow', () => {
  it('makes a volcano that erupts into eligible neighbours, whose lava cools to barren', () => {
    const e = mini(allCards);
    e.state.terrain['4,4'] = 'mountain';
    e.state.terrain['4,3'] = 'mountain';
    e.state.structures[900] = town(900, 'blue', 5, 4);
    expect(castMini(e, 'red', 'lava-flow', sq(4, 4))).toBe('cast');
    expect(e.state.terrain['4,4']).toBe('volcano');
    let lava: string[] = [];
    for (let i = 0; i < 40 && lava.length === 0; i++) {
      dispatch(e, 'turn:start');
      lava = ['3,4', '4,5'].filter((k) => e.state.terrain[k] === 'lava');
    }
    expect(lava.length).toBeGreaterThanOrEqual(1);
    expect(e.state.terrain['4,3']).toBe('mountain');
    expect(e.state.terrain['5,4']).toBe('plains');
    for (let i = 0; i < 3; i++) expireSpells(e);
    for (const k of lava) expect(e.state.terrain[k]).toBe('barren');
  });
  it('is dispelled when its square stops being volcano', () => {
    const e = mini(allCards);
    e.state.terrain['4,4'] = 'volcano';
    castMini(e, 'red', 'lava-flow', sq(4, 4));
    e.state.terrain['4,4'] = 'plains';
    recheck(e, sq(4, 4));
    expect(e.state.spells.some((s) => s.cardId === 'lava-flow')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/control-cards.test.ts`
Expected: FAIL (`Target.recruitGroup.playerControlled` is undefined; unknown cards).

- [ ] **Step 3: Target modifiers**

`packages/cards/src/lang/types.ts`, add to `TargetSpec`:
```ts
  /** Group targets: at least / at most this many minions. */
  minSize?: number;
  maxSize?: number;
  /** Group targets: the group is not standing in a structure. */
  notInStructure?: boolean;
  /** Group targets: the group is player-controlled. */
  playerControlled?: boolean;
```
`packages/cards/src/lang/target.ts`, add to `TargetBuilder` (after `in`):
```ts
  private groupOnly(what: string): void {
    if (!GROUP_TYPES.includes(this.spec.type)) throw new Error(`Target: .${what} needs a group target, not "${this.spec.type}"`);
  }
  get playerControlled(): TargetBuilder {
    this.groupOnly('playerControlled');
    return new TargetBuilder({ ...this.spec, playerControlled: true });
  }
  get notInStructure(): TargetBuilder {
    this.groupOnly('notInStructure');
    return new TargetBuilder({ ...this.spec, notInStructure: true });
  }
  atLeast(n: number): TargetBuilder {
    this.groupOnly('atLeast');
    return new TargetBuilder({ ...this.spec, minSize: n });
  }
  atMost(n: number): TargetBuilder {
    this.groupOnly('atMost');
    return new TargetBuilder({ ...this.spec, maxSize: n });
  }
```
In `targetFragment`, replace the single-minion class check with one that accepts a dual-class recruit:
```ts
  if (t.cls && (t.type === 'recruit' || t.type === 'minion' || t.type === 'monster')) {
    checks.push((q, r) => {
      const m = r.kind === 'minion' ? q.minion(r.id) : undefined;
      return !!m && (m.cls === t.cls || (m.kind === 'recruit' && q.stats(m.id).dualClass));
    });
  }
```
and add after the `t.in` check:
```ts
  const groupOf = (q: QueryContext, r: Ref) => (r.kind === 'group' ? q.group(r.id) : undefined);
  if (t.minSize !== undefined) checks.push((q, r) => r.kind === 'group' && q.minionsOf(r.id).length >= t.minSize!);
  if (t.maxSize !== undefined) checks.push((q, r) => r.kind === 'group' && q.minionsOf(r.id).length <= t.maxSize!);
  if (t.notInStructure) checks.push((q, r) => { const g = groupOf(q, r); return !!g?.pos && !q.structureAt(g.pos); });
  if (t.playerControlled) checks.push((q, r) => groupOf(q, r)?.control === 'player');
```
In `printTarget`, add `const COUNT = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];` above the function, insert after the `with swordsmen/archers` line:
```ts
  if (t.minSize !== undefined) noun += ` of ${COUNT[t.minSize] ?? t.minSize} or more`;
  if (t.maxSize !== undefined) noun += ` of ${COUNT[t.maxSize] ?? t.maxSize} or less`;
```
insert after the `alone` line:
```ts
  if (t.notInStructure) noun += ' not in a structure';
```
and make the prefix line
```ts
  const prefix = t.playerControlled ? 'Player-controlled ' : t.friendly ? 'Friendly ' : t.nonFriendly ? 'Non-friendly ' : '';
```

`packages/cards/src/lang/keywords/statics.ts`: `Bound` takes any terrain:
```ts
export interface BoundKeyword extends Keyword { kind: 'bound'; terrain: TerrainId }
```
(add `TerrainId` to the `@sanctum/engine` type import).

- [ ] **Step 4: The cards**

`packages/cards/src/war/general.ts`:
```ts
import { card, Script, Target } from '../lang';

// RULING: printed literally: +1 missile damage. A swordsman uses it only if it has a missile attack (Weapon Master).
// "Adjacent" = the four orthogonal neighbours of the General's square; the General's own group is not adjacent.
export default card({ id: 'general', name: 'General', house: 'war', cost: { strife: 3, clarity: 3 }, type: 'alteration',
  target: Target.recruit.friendly,
  keywords: [
    Script('Friendly swordsmen in the four adjacent squares get +1 M.', {
      reach: 'board',
      stats: (q, id, sp) => {
        if (sp.host.kind !== 'minion') return {};
        const general = q.minion(sp.host.id);
        const m = q.minion(id);
        const here = general ? q.group(general.groupId)?.pos : null;
        const there = m ? q.group(m.groupId)?.pos : null;
        if (!m || !here || !there || m.owner !== sp.owner || m.cls !== 'swordsman') return {};
        return Math.abs(here.x - there.x) + Math.abs(here.y - there.y) === 1 ? { missile: 1 } : {};
      },
    }),
  ] });
```
`packages/cards/src/war/weaponMaster.ts`:
```ts
import { card, Script, Target } from '../lang';

// RULING: the recruit keeps its class and gains the other attack, so from round 2 it attacks with both (missile
// first). "Targeted by both archer and swordsman spells" covers individual spells only; group spells "with archers" and
// class grants ("Archers +1 M") still go by the real class.
// RULING: the clause "Cannot be targeted by Bear, Eagle, Lion, or Lizard Spirit, or Shapeshifter" is not implemented:
// those are Body/Nature cards, not in this game.
export default card({ id: 'weapon-master', name: 'Weapon Master', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'alteration',
  target: Target.recruit,
  keywords: [
    Script('A swordsman gains a missile attack (M:2); an archer gains a sword attack (H:2). Archer and swordsman spells can target it.', {
      stats: (q, id, sp) => {
        if (sp.host.kind !== 'minion' || sp.host.id !== id) return {};
        const m = q.minion(id);
        if (m?.cls === 'swordsman') return { missile: 2, missileAttacks: 1, dualClass: true };
        if (m?.cls === 'archer') return { hand: 2, handAttacks: 1, dualClass: true };
        return {};
      },
    }),
  ] });
```
`packages/cards/src/war/renegades.ts`:
```ts
import { card, nomadicBot, Script, Target } from '../lang';

// RULING: the original neutral-group AI is unknown; the renegades hunt the nearest hostile recruit group like a Nomadic
// monster. Spells on the group keep their owners. Neutral groups already move last, fight everyone, have
// half-initiative and (being computer-controlled) never enter structures.
export default card({ id: 'renegades', name: 'Renegades', house: 'war', cost: { strife: 6, clarity: 2 }, type: 'manifestation',
  target: Target.recruitGroup.playerControlled.atMost(3).notInStructure,
  keywords: [
    Script('It leaves player control and becomes neutral: it moves on its own and attacks every other group.', {
      onCast: (c, t) => {
        if (t.kind !== 'group') return;
        c.setControl(t.id, 'computer');
        c.setOwner(t.id, 'neutral');
      },
      bot: nomadicBot,
    }),
  ] });
```
`packages/cards/src/war/lavaFlowLava.ts`:
```ts
import { card, Lasts, Script, Target } from '../lang';

/** Lava Flow helper on each erupted square: "lava for current turn +2, then barren". */
export default card({ id: 'lava-flow-lava', name: 'Lava Flow (lava)', house: 'war', cost: {}, type: 'conjuration', helper: true,
  target: Target.square,
  keywords: [
    Lasts(3),
    Script('When it ends, lava here becomes barren.', {
      onExpire: (c) => {
        if (c.host.kind === 'square' && c.terrainAt(c.host.pos) === 'lava') c.setTerrain(c.host.pos, 'barren');
      },
    }),
  ] });
```
`packages/cards/src/war/lavaFlow.ts`:
```ts
import { isSanctumArea } from '@sanctum/engine';
import type { EventContext, Pos } from '@sanctum/engine';
import { ADJACENT } from '../helpers';
import { Bound, card, OnCast, Script, Target, Terraform } from '../lang';

function erupt(c: EventContext): void {
  if (c.host.kind !== 'square' || c.random() >= 1 / 3) return;
  const here = c.host.pos;
  const spots: Pos[] = ADJACENT.map((d) => ({ x: here.x + d.x, y: here.y + d.y })).filter((p) => {
    const t = c.terrainAt(p);
    return c.state.cells.includes(`${p.x},${p.y}`) && !isSanctumArea(p) && !c.structureAt(p) && t !== 'mountain' && t !== 'volcano';
  });
  const n = Math.min(spots.length, 1 + Math.floor(c.random() * 2));
  for (let i = 0; i < n; i++) {
    const [p] = spots.splice(Math.floor(c.random() * spots.length), 1);
    c.setTerrain(p, 'lava');
    c.createSpell('lava-flow-lava', { kind: 'square', pos: p });
  }
}

// RULING: Lava Flow lives on its square while it is volcano (Bound). Sanctum squares never change terrain, so they are
// never picked. A lava square already holding a lava helper gets a second one; the first to expire cools it.
export default card({ id: 'lava-flow', name: 'Lava Flow', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'alteration',
  target: Target.square.on('mountain', 'volcano'),
  keywords: [
    Bound('volcano'),
    Script('Start of turn: one chance in three to erupt into 1-2 random adjacent squares (not structures, mountains or volcanoes), which become lava for this turn and the next two, then barren.', {
      on: { 'turn:start': erupt },
    }),
    OnCast(Terraform('volcano')),
  ] });
```
Register in `packages/cards/src/war/index.ts`: imports `general`, `weaponMaster`, `renegades`, `lavaFlow`, `lavaFlowLava`; append `general, weaponMaster, renegades, lavaFlow, lavaFlowLava,` to `warCards`.

- [ ] **Step 5: Faces, counts, backlog, meta target phrase**

`faces.test.ts`, before the pinning test:
```ts
  it('plan 2d: one-offs', () => {
    expect(lines('general')).toEqual(['Friendly recruit.', 'Friendly swordsmen in the four adjacent squares get +1 M.']);
    expect(lines('weapon-master')).toEqual([
      'Recruit.', 'A swordsman gains a missile attack (M:2); an archer gains a sword attack (H:2). Archer and swordsman spells can target it.',
    ]);
    expect(lines('renegades')).toEqual([
      'Player-controlled recruit group of three or less not in a structure.',
      'It leaves player control and becomes neutral: it moves on its own and attacks every other group.',
    ]);
    expect(lines('lava-flow')).toEqual([
      'Mountain or volcano square.', 'Bound to volcano.',
      'Start of turn: one chance in three to erupt into 1-2 random adjacent squares (not structures, mountains or volcanoes), which become lava for this turn and the next two, then barren.',
      'Square becomes volcano.',
    ]);
    expect(lines('lava-flow-lava')).toEqual(['Square.', 'Lasts 3 turns.', 'When it ends, lava here becomes barren.']);
  });

```
count `toHaveLength(126)`.
`meta.test.ts`: in `expectedTarget`, make the recruit-group line accept the Renegades phrase:
```ts
  if (/^(friendly |player-controlled )?recruit group/.test(s)) return 'recruitGroup';
```
and the count block:
```ts
  it('has 96 playable cards (48 War, 48 Life) and 6 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(48);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(48);
    expect(pendingCards).toHaveLength(6);
  });
```
`cards-backlog.md`: header `Implemented: 96 (48 War, 48 Life).`; delete the whole E11 section.

- [ ] **Step 6: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/control-cards.test.ts`
Expected: PASS (7 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the five new entries.
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cards): General, Weapon Master, Renegades, Lava Flow; group target modifiers" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 8: Boardhop support in the engine (`onDispel`, removal, time stops off the board)

**Goal:** A spell can react to being dispelled, a spell can remove a group from the game, and spells on off-board groups stop counting down.

**Files:**
- Create: `packages/engine/test/boardhop.test.ts`
- Modify: `packages/engine/src/{cards,spells,ctx}.ts`, `packages/cards/src/lang/merge.ts`

**Acceptance Criteria:**
- [ ] `CardDef.onDispel(c)` runs whenever the spell is dispelled (a dispel effect, a failed persistent check, or expiry after `onExpire`), before it is removed; not when its host dies; a hook that dispels its own spell does not recurse
- [ ] `ctx.removeGroup(id)` removes a group (on or off the board) and its minions without `minion:dies`
- [ ] `expireSpells` skips spells whose host is off the board (their `turnsLeft` stays)
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/boardhop.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { defineCard } from '../src/cards';
import { makeCtx } from '../src/ctx';
import { killMinion } from '../src/death';
import { dispel, expireSpells } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import type { Engine } from '../src/engine';
import type { Ref } from '../src/types';
import { blankEngine, put } from './helpers';

const on = (e: Engine, cardId: string, host: Ref, turnsLeft: number | null = null) =>
  addSpellRecord(e.state, { cardId, owner: 'red', host, visible: true, turnsLeft, tokens: {} });

describe('onDispel', () => {
  const ward = defineCard({
    id: 'ward', name: 'ward', house: 'life', cost: {}, type: 'alteration', target: 'recruit',
    onDispel: (c) => { c.addMana('red', 'world', 1); c.dispel(); },
  });
  it('runs on dispel and on expiry, once, but not when the host dies', () => {
    const e = blankEngine([ward]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const a = on(e, 'ward', { kind: 'minion', id: g.minionIds[0] });
    dispel(e, a.id);
    expect(e.state.players.red.mana.world).toBe(1);
    expect(e.state.spells).toHaveLength(0);
    on(e, 'ward', { kind: 'minion', id: g.minionIds[1] }, 1);
    expireSpells(e);
    expect(e.state.players.red.mana.world).toBe(2);
    on(e, 'ward', { kind: 'minion', id: g.minionIds[2] });
    killMinion(e, g.minionIds[2], null, 'dies');
    expect(e.state.players.red.mana.world).toBe(2);
  });
});

describe('removeGroup', () => {
  const mourner = defineCard({
    id: 'mourner', name: 'mourner', house: 'life', cost: {}, type: 'alteration', target: 'globe',
    on: { 'minion:dies': (c) => c.setToken('deaths', c.token('deaths') + 1) },
  });
  it('removes an off-board group without death events', () => {
    const e = blankEngine([mourner]);
    const sp = on(e, 'mourner', { kind: 'globe' });
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    g.pos = null;
    makeCtx(e, sp).removeGroup(g.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(ids.map((id) => e.state.minions[id].status)).toEqual(['dead', 'dead']);
    expect(sp.tokens.deaths ?? 0).toBe(0);
  });
});

describe('time stops off the board', () => {
  it('durations on an off-board group do not count down', () => {
    const e = blankEngine();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const sp = on(e, 'timer', { kind: 'minion', id: g.minionIds[0] }, 2);
    g.pos = null;
    expireSpells(e);
    expect(sp.turnsLeft).toBe(2);
    g.pos = { x: 4, y: 4 };
    expireSpells(e);
    expect(sp.turnsLeft).toBe(1);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/boardhop.test.ts`
Expected: FAIL (no mana from `onDispel`, `removeGroup is not a function`, `turnsLeft` 1).

- [ ] **Step 3: The hook and its merger**

`packages/engine/src/cards.ts`, add to `CardDef` after `onExpire`:
```ts
  /**
   * Runs whenever the spell is dispelled (dispel effects, failed persistent checks, expiry after `onExpire`), just before
   * it is removed. Not when its host dies or leaves the game.
   */
  onDispel?: (c: EventContext) => void;
```
`packages/cards/src/lang/merge.ts`, add to `MERGERS` after `onExpire`:
```ts
  onDispel: (fs) => (c) => fs.forEach((f) => f(c)),
```

- [ ] **Step 4: Dispel runs the hook; expiry skips off-board hosts**

`packages/engine/src/spells.ts`: add `isOffBoard` to the `./query` import and replace `dispel` with
```ts
/** Spells whose onDispel hook is running: a hook that dispels its own spell must not run it again. */
const ending = new Set<number>();

/** Removes a spell (after its onDispel hook), then lets its host recheck the spells that remain (spell flux). */
export function dispel(e: Engine, spellId: number): void {
  if (ending.has(spellId)) return;
  const found = e.state.spells.find((x) => x.id === spellId);
  if (!found) return;
  const hook = e.cards[found.cardId]?.onDispel;
  if (hook) {
    ending.add(spellId);
    try {
      hook(makeCtx(e, found));
    } finally {
      ending.delete(spellId);
    }
  }
  const sp = removeSpellRecord(e.state, spellId);
  if (!sp) return;
  e.state.log.push({ type: 'dispel', card: sp.cardId });
  recheck(e, sp.host);
  syncHp(e);
}
```
and in `expireSpells` change the first line of the loop body to
```ts
    // Time stops off the board (rules: Concepts_boardhop): spells on an off-board group or minion keep their duration.
    if (sp.turnsLeft === null || !e.state.spells.some((x) => x.id === sp.id) || isOffBoard(e.state, sp.host)) continue;
```

- [ ] **Step 5: `ctx.removeGroup`**

`packages/engine/src/ctx.ts`, add to `EventContext` after `appear`:
```ts
  /** Removes a group from the game, on or off the board: its minions are removed without death events. */
  removeGroup(groupId: number): void;
```
and to `makeCtx` after `appear`:
```ts
    removeGroup: (id) => {
      const g = e.state.groups[id];
      if (!g) return;
      for (const mid of [...g.minionIds]) killMinion(e, mid, null, 'removed');
    },
```

- [ ] **Step 6: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/boardhop.test.ts`
Expected: PASS (3 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. (If a combat-hopper test now differs because a hopper's spell no longer expires while it waits off the board, that is the intended rule; update the expectation and say so in the commit.)

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(engine): onDispel hook, removeGroup, time stops off the board" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 9: Faerie Circle

**Goal:** Faerie Circle with its two helpers: Faerie Blessing (visible) and the hop that brings a group back.

**Files:**
- Create: `packages/cards/src/life/{faerieCircle,faerieBlessing,faerieCircleHop}.ts`, `packages/cards/test/faerie-circle.test.ts`
- Modify: `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] At start of turn, the group on a Faerie Circle square leaves the board; its members are healed fully and get Faerie Blessing (+1 L); a hop spell on the globe records its return turn (current turn + 1..5 + 1)
- [ ] At the start of the return turn (or the first later one when the square is empty) the group reappears on the square, and is not taken again
- [ ] A group with a Faerie Blessing cannot enter a Faerie Circle square
- [ ] If the Faerie Circle is dispelled while a group is away, that group is removed from the game
- [ ] Backlog loses E6; meta says 97 playable (48 War, 49 Life) and 5 pending; faces pins 129 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/faerie-circle.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeStats, dispatch, dispel, runMovement } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const setup = () => {
  const e = mini(allCards);
  e.state.terrain['4,4'] = 'forest';
  expect(castMini(e, 'red', 'faerie-circle', { kind: 'square', pos: { x: 4, y: 4 } })).toBe('cast');
  const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'archer']);
  for (const id of g.minionIds) e.state.minions[id].hp = 2;
  return { e, g };
};
const hop = (e: ReturnType<typeof mini>) => e.state.spells.find((s) => s.cardId === 'faerie-circle-hop');

describe('Faerie Circle', () => {
  it('takes the group away, healed and blessed, and brings it back', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    for (const id of g.minionIds) {
      expect(e.state.minions[id].hp).toBe(7);
      expect(computeStats(e, id).level).toBe(2);
    }
    const back = hop(e)!.tokens.back;
    expect(back).toBeGreaterThanOrEqual(e.state.turn + 2);
    expect(back).toBeLessThanOrEqual(e.state.turn + 6);
    e.state.turn = back - 1;
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    e.state.turn = back;
    dispatch(e, 'turn:start');
    expect(g.pos).toEqual({ x: 4, y: 4 });
    expect(hop(e)).toBeUndefined();
    dispatch(e, 'turn:start'); // blessed: not taken again
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('waits while the square is occupied', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    const blocker = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    // the circle would take the blocker too; bless it first so it stays
    e.state.spells.push({ id: 9001, cardId: 'faerie-blessing', owner: 'red', host: { kind: 'minion', id: blocker.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    e.state.turn = hop(e)!.tokens.back;
    dispatch(e, 'turn:start');
    expect(g.pos).toBeNull();
    blocker.pos = { x: 6, y: 6 };
    e.state.turn += 1;
    dispatch(e, 'turn:start');
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('a blessed group cannot enter a Faerie Circle', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    e.state.turn = hop(e)!.tokens.back;
    dispatch(e, 'turn:start');
    g.pos = { x: 5, y: 4 };
    g.moveOrder = 'w';
    runMovement(e);
    expect(g.pos).toEqual({ x: 5, y: 4 });
  });

  it('removes the group from the game if the circle is dispelled while it is away', () => {
    const { e, g } = setup();
    dispatch(e, 'turn:start');
    dispel(e, e.state.spells.find((s) => s.cardId === 'faerie-circle')!.id);
    expect(e.state.groups[g.id]).toBeUndefined();
    expect(hop(e)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faerie-circle.test.ts`
Expected: FAIL (unknown card squanders).

- [ ] **Step 3: The cards**

`packages/cards/src/life/faerieBlessing.ts`:
```ts
import { card, Grant, Script, Target } from '../lang';

// Visible like the original's Faerie Blessing (rules: Elements_spells "Persistent effects: Faerie Blessing").
export default card({ id: 'faerie-blessing', name: 'Faerie Blessing', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Grant({ level: 1 }),
    Script('Its group cannot enter a Faerie Circle.', {
      blocksEntry: (q, sp, gid, dest) =>
        sp.host.kind === 'minion' && q.minion(sp.host.id)?.groupId === gid &&
        q.state.spells.some((x) => x.cardId === 'faerie-circle' && x.host.kind === 'square' && x.host.pos.x === dest.x && x.host.pos.y === dest.y),
    }),
  ] });
```
`packages/cards/src/life/faerieCircleHop.ts`:
```ts
import type { EventContext } from '@sanctum/engine';
import { card, Script, Target, Undispellable } from '../lang';

/** Brings the group back at the start of its return turn, or the first later turn its square is empty. */
function comeBack(c: EventContext): void {
  const gid = c.token('gid');
  const g = c.group(gid);
  if (!g || g.pos) {
    c.dispel(); // removed from the game, or already back by other means
    return;
  }
  if (c.state.turn < c.token('back')) return;
  if (c.appear(gid, { x: c.token('x'), y: c.token('y') })) c.dispel();
}

export default card({ id: 'faerie-circle-hop', name: 'Faerie Circle (away)', house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.globe,
  keywords: [Undispellable(), Script('Brings a group back from a Faerie Circle.', { on: { 'turn:start': comeBack } })] });
```
`packages/cards/src/life/faerieCircle.ts`:
```ts
import type { EventContext, QueryContext } from '@sanctum/engine';
import { Bound, card, Script, Target } from '../lang';

const blessed = (q: QueryContext, id: number) =>
  q.state.spells.some((sp) => sp.cardId === 'faerie-blessing' && sp.host.kind === 'minion' && sp.host.id === id);

function take(c: EventContext): void {
  if (c.host.kind !== 'square') return;
  const pos = c.host.pos;
  const g = c.groupAt(pos);
  if (!g || c.minionsOf(g.id).some((m) => blessed(c, m.id))) return;
  const away = 1 + Math.floor(c.random() * 5);
  for (const m of c.minionsOf(g.id)) {
    c.heal(m.id, 999);
    c.createSpell('faerie-blessing', { kind: 'minion', id: m.id });
  }
  c.hide(g.id);
  c.createSpell('faerie-circle-hop', { kind: 'globe' }, {
    tokens: { gid: g.id, x: pos.x, y: pos.y, back: c.state.turn + away + 1, circle: c.spell.id },
  });
}

/** Rules (Concepts_boardhop): "If the boardhop spell is dispelled while a group is inside, that group is removed". */
function strand(c: EventContext): void {
  for (const sp of c.state.spells.filter((x) => x.cardId === 'faerie-circle-hop' && x.tokens.circle === c.spell.id)) {
    const g = c.group(sp.tokens.gid);
    if (g && !g.pos) c.removeGroup(g.id);
    c.dispel(sp.id);
  }
}

// RULING: any group on the square is taken (monsters too). Members are healed and blessed as they leave; a group with a
// blessed member is never taken again ("cannot re-enter"), and coming back onto the circle is not entering it.
// "Current turn +1-5": away for the current turn and 1-5 more, back at the start of the turn after.
export default card({ id: 'faerie-circle', name: 'Faerie Circle', house: 'life', cost: { clarity: 4, world: 2 }, type: 'alteration',
  target: Target.square.on('forest'),
  keywords: [
    Bound('forest'),
    Script('Start of turn: the group here disappears for this turn and the next 1-5 unless a member has Faerie Blessing. Its members are healed fully and get Faerie Blessing. It comes back at the start of the first turn its square is empty. If Faerie Circle ends while it is away, the group is removed from the game.', {
      on: { 'turn:start': take },
      onDispel: strand,
    }),
  ] });
```
Register in `packages/cards/src/life/index.ts`: imports `faerieCircle`, `faerieBlessing`, `faerieCircleHop`; append `faerieCircle, faerieBlessing, faerieCircleHop,` to `lifeCards`.

- [ ] **Step 4: Faces, counts, backlog**

`faces.test.ts`, before the pinning test:
```ts
  it('plan 2d: Faerie Circle', () => {
    expect(lines('faerie-circle')).toEqual([
      'Forest square.', 'Bound to forest.',
      'Start of turn: the group here disappears for this turn and the next 1-5 unless a member has Faerie Blessing. Its members are healed fully and get Faerie Blessing. It comes back at the start of the first turn its square is empty. If Faerie Circle ends while it is away, the group is removed from the game.',
    ]);
    expect(lines('faerie-blessing')).toEqual(['Recruit.', '+1 L.', 'Its group cannot enter a Faerie Circle.']);
    expect(lines('faerie-circle-hop')).toEqual(['Globe.', 'Undispellable.', 'Brings a group back from a Faerie Circle.']);
  });

```
count `toHaveLength(129)`. `meta.test.ts`:
```ts
  it('has 97 playable cards (48 War, 49 Life) and 5 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(48);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(49);
    expect(pendingCards).toHaveLength(5);
  });
```
`cards-backlog.md`: header `Implemented: 97 (48 War, 49 Life).`; delete the whole E6 section.

- [ ] **Step 5: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faerie-circle.test.ts`
Expected: PASS (4 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the three new entries.
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cards): Faerie Circle, Faerie Blessing" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Structures in the engine (colonies, hidden structures, capture event, mana choices)

**Goal:** Spells can create and destroy towns and colonies, hide and show a structure, react to a capture, give a spell to another player, and ask for a mana type for a new colony or a mana-making spell.

**Files:**
- Create: `packages/engine/test/structures.test.ts`
- Modify: `packages/engine/src/{types,cards,events,query,ctx,turn,orders,spells,api,view,index}.ts`, `packages/cards/src/lang/merge.ts`

**Acceptance Criteria:**
- [ ] `ctx.createStructure({ kind, pos, owner, noNovices? })` dispels the square's spells, makes it plains, returns the new id; returns null on Sanctum squares, off-board squares and squares with any structure (hidden ones too)
- [ ] An owned created structure has `needsMana`; at the next start of turn its owner is asked (phase `choose-mana`); `chooseMana` sets `manaType` and clears `needsMana`
- [ ] `noNovices` structures never produce novices
- [ ] `ctx.destroyStructure(id)` dispels its spells (running `onDispel`), removes it and any pending mana choice for it
- [ ] `ctx.hideStructure` / `showStructure`: a hidden structure is not found by `structureAt`, is not captured, cannot be trained at (`that structure is off the board`) or targeted, keeps producing novices and mana; `showStructure` fails while a group stands on its square
- [ ] A capture dispatches `structure:captured` on the structure with `{ from, to }`
- [ ] `CardDef.wantsMana(q, spell)`: a spell (owned by a side, on the board) for which it returns true is put in `pendingMana` by id; `chooseMana` with that id stores `tokens.mana` = 1 + index in `MANA_TYPES`; `manaSource(state, cards, id)` describes any pending id
- [ ] `ctx.setSpellOwner(owner, spellId?)` changes a spell's owner; `ctx.setTerrain` does not change a hidden structure's square
- [ ] All existing tests pass unedited

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/structures.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { chooseMana } from '../src/api';
import { defineCard } from '../src/cards';
import { makeCtx } from '../src/ctx';
import { makeEngine, type Engine } from '../src/engine';
import { structureAt } from '../src/query';
import { castCheck } from '../src/spells';
import { addSpellRecord } from '../src/spellstore';
import { beginTurn, finishTurnStart } from '../src/turn';
import { validateOrders } from '../src/orders';
import { emptyOrders } from '../src/types';
import type { Structure } from '../src/types';
import { manaSource } from '../src/view';
import { blankEngine, put } from './helpers';

const ctxOf = (e: Engine, cardId = 'x') =>
  makeCtx(e, addSpellRecord(e.state, { cardId, owner: 'red', host: { kind: 'globe' }, visible: false, turnsLeft: null, tokens: {} }));
const town = (id: number, owner: 'red' | 'blue' | 'neutral', x: number, y: number, extra: Partial<Structure> = {}): Structure =>
  ({ id, kind: 'town', pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false, ...extra });
const nextTurn = (e: Engine) => {
  e.state.turn += 1;
  beginTurn(e, false);
};

describe('createStructure', () => {
  it('builds a colony on plains, dispelling the square, and asks for its mana', () => {
    const e = blankEngine();
    e.state.terrain['4,4'] = 'forest';
    addSpellRecord(e.state, { cardId: 'y', owner: 'blue', host: { kind: 'square', pos: { x: 4, y: 4 } }, visible: true, turnsLeft: null, tokens: {} });
    const id = ctxOf(e).createStructure({ kind: 'colony', pos: { x: 4, y: 4 }, owner: 'red' })!;
    expect(e.state.structures[id]).toMatchObject({ kind: 'colony', owner: 'red', needsMana: true, novices: 0 });
    expect(e.state.terrain['4,4']).toBe('plains');
    expect(e.state.spells.some((s) => s.cardId === 'y')).toBe(false);
    expect(ctxOf(e).createStructure({ kind: 'colony', pos: { x: 4, y: 4 }, owner: 'red' })).toBeNull();
    expect(ctxOf(e).createStructure({ kind: 'colony', pos: { x: 2, y: 3 }, owner: 'red' })).toBeNull(); // Sanctum entrance
    nextTurn(e);
    expect(e.state.phase).toBe('choose-mana');
    expect(e.state.pendingMana).toEqual([id]);
    expect(manaSource(e.state, e.cards, id)).toEqual({ id, owner: 'red', pos: { x: 4, y: 4 }, name: 'colony', kind: 'new' });
    const r = chooseMana(e.state, e.cards, 'red', id, 'world');
    if (!r.ok) throw new Error(r.error);
    expect(r.state.structures[id].manaType).toBe('world');
    expect(r.state.structures[id].needsMana).toBeUndefined();
    expect(r.state.phase).toBe('orders');
    expect(r.state.players.red.mana.world).toBe(1);
  });

  it('noNovices structures never produce novices', () => {
    const e = blankEngine();
    e.state.structures[900] = town(900, 'red', 4, 4, { turnCount: 1, manaType: 'world', noNovices: true });
    e.state.structures[901] = town(901, 'red', 6, 3, { turnCount: 1, manaType: 'world' });
    nextTurn(e);
    expect(e.state.structures[900].novices).toBe(0);
    expect(e.state.structures[901].novices).toBe(1);
  });
});

describe('destroyStructure', () => {
  it('dispels its spells through onDispel and forgets a pending choice', () => {
    const hook = defineCard({ id: 'hook', name: 'hook', house: 'war', cost: {}, type: 'alteration', target: 'structure', onDispel: (c) => c.addMana('red', 'strife', 1) });
    const e = blankEngine([hook]);
    e.state.structures[900] = town(900, 'red', 4, 4);
    e.state.pendingMana = [900];
    addSpellRecord(e.state, { cardId: 'hook', owner: 'red', host: { kind: 'structure', id: 900 }, visible: true, turnsLeft: null, tokens: {} });
    ctxOf(e).destroyStructure(900);
    expect(e.state.structures[900]).toBeUndefined();
    expect(e.state.pendingMana).toEqual([]);
    expect(e.state.spells.filter((s) => s.cardId === 'hook')).toHaveLength(0);
    expect(e.state.players.red.mana.strife).toBe(1);
  });
});

describe('hidden structures', () => {
  it('are off the board but keep producing', () => {
    const spell = defineCard({ id: 'st-spell', name: 's', house: 'war', cost: {}, type: 'alteration', target: 'structure' });
    const e = blankEngine([spell]);
    e.state.structures[900] = town(900, 'red', 4, 4, { manaType: 'strife', turnCount: 1, novices: 1 });
    ctxOf(e).hideStructure(900);
    expect(structureAt(e.state, { x: 4, y: 4 })).toBeUndefined();
    expect(castCheck(e, 'blue', spell, { kind: 'structure', id: 900 })).toBe(false);
    expect(validateOrders(e, 'red', { ...emptyOrders(), train: [{ structureId: 900, as: 'swordsman' }] })).toBe('that structure is off the board');
    const blue = put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    nextTurn(e);
    expect(e.state.structures[900].owner).toBe('red');
    expect(e.state.structures[900].novices).toBe(2);
    expect(e.state.players.red.mana.strife).toBe(1);
    expect(ctxOf(e).showStructure(900)).toBe(false);
    blue.pos = { x: 5, y: 5 };
    expect(ctxOf(e).showStructure(900)).toBe(true);
    expect(structureAt(e.state, { x: 4, y: 4 })?.id).toBe(900);
  });

  it('keep their square\'s terrain', () => {
    const e = blankEngine();
    e.state.structures[900] = town(900, 'red', 4, 4);
    const c = ctxOf(e);
    c.hideStructure(900);
    c.setTerrain({ x: 4, y: 4 }, 'lava');
    expect(e.state.terrain['4,4']).toBe('plains');
  });
});

describe('structure:captured', () => {
  it('is dispatched on the structure with the old and new owner', () => {
    const watch = defineCard({
      id: 'watch', name: 'watch', house: 'war', cost: {}, type: 'alteration', target: 'globe',
      on: { 'structure:captured': (c, ev) => c.setToken(`${ev.data.from}>${ev.data.to}`, 1) },
    });
    const e = blankEngine([watch]);
    const sp = addSpellRecord(e.state, { cardId: 'watch', owner: 'red', host: { kind: 'globe' }, visible: true, turnsLeft: null, tokens: {} });
    e.state.structures[900] = town(900, 'blue', 4, 4);
    put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    nextTurn(e);
    expect(sp.tokens['blue>red']).toBe(1);
  });
});

describe('mana-making spells', () => {
  const grove = defineCard({
    id: 'grove', name: 'Grove', house: 'life', cost: {}, type: 'alteration', target: 'square',
    wantsMana: (_q, sp) => (sp.tokens.mana ?? 0) === 0,
  });
  it('ask their owner for a mana type at start of turn', () => {
    const e = blankEngine([grove]);
    const sp = addSpellRecord(e.state, { cardId: 'grove', owner: 'red', host: { kind: 'square', pos: { x: 4, y: 4 } }, visible: true, turnsLeft: null, tokens: {} });
    nextTurn(e);
    expect(e.state.pendingMana).toEqual([sp.id]);
    expect(manaSource(e.state, e.cards, sp.id)).toEqual({ id: sp.id, owner: 'red', pos: { x: 4, y: 4 }, name: 'Grove', kind: 'spell' });
    expect(chooseMana(e.state, e.cards, 'blue', sp.id, 'world')).toEqual({ ok: false, error: 'not your mana source' });
    const r = chooseMana(e.state, e.cards, 'red', sp.id, 'world');
    if (!r.ok) throw new Error(r.error);
    expect(r.state.spells.find((s) => s.id === sp.id)!.tokens.mana).toBe(6);
    const again = makeEngine(r.state, e.cards);
    nextTurn(again);
    expect(again.state.pendingMana).toEqual([]);
  });

  it('setSpellOwner gives a spell away', () => {
    const e = blankEngine([grove]);
    const sp = addSpellRecord(e.state, { cardId: 'grove', owner: 'red', host: { kind: 'square', pos: { x: 4, y: 4 } }, visible: true, turnsLeft: null, tokens: {} });
    ctxOf(e).setSpellOwner('blue', sp.id);
    expect(sp.owner).toBe('blue');
    finishTurnStart(e);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/structures.test.ts`
Expected: FAIL (`createStructure is not a function`, `manaSource` is not exported).

- [ ] **Step 3: Types, card hook, event, query**

`packages/engine/src/types.ts`, add to `Structure`:
```ts
  /** Off the board (Seelie Court): not captured, trained at or targeted, invisible to `structureAt`; still produces. */
  hidden?: boolean;
  /** Never produces novices (Encampment's colony). */
  noNovices?: boolean;
  /** Created owned and not yet given a mana type: its owner is asked at the next start of turn. */
  needsMana?: boolean;
```
`packages/engine/src/cards.ts`, add to `CardDef` after `onDispel`:
```ts
  /**
   * A spell that makes mana of its owner's choice (Golden Grove): return true while it needs a choice. At start of turn
   * its owner is asked like for a captured town; the answer is stored as `tokens.mana` = 1 + index in `MANA_TYPES`.
   */
  wantsMana?: (q: QueryContext, spell: ActiveSpell) => boolean;
```
`packages/cards/src/lang/merge.ts`, add to `MERGERS`:
```ts
  wantsMana: (fs) => (q, sp) => fs.some((f) => f(q, sp)),
```
`packages/engine/src/events.ts`: add to `EventType` after `'spell:cast'`:
```ts
  // a structure: { from, to } (start of turn, after the owner changed)
  | 'structure:captured'
```
`packages/engine/src/query.ts`: replace `structureAt` with
```ts
/** The structure on a square that is on the board (a hidden structure is off the board). */
export function structureAt(s: GameState, pos: Pos): Structure | undefined {
  return Object.values(s.structures).find((st) => !st.hidden && samePos(st.pos, pos));
}

/** Any structure whose square this is, on the board or hidden. */
export function structureOn(s: GameState, pos: Pos): Structure | undefined {
  return Object.values(s.structures).find((st) => samePos(st.pos, pos));
}
```

- [ ] **Step 4: Targeting and training respect hidden structures**

`packages/engine/src/spells.ts`, in `targetLegal`, case `'structure'`:
```ts
      return !!st && st.kind !== 'sanctum' && !st.hidden;
```
`packages/engine/src/orders.ts`, in the training loop after `if (!st || st.owner !== side) return 'cannot train at that structure';`:
```ts
    if (st.hidden) return 'that structure is off the board';
```

- [ ] **Step 5: Start of turn: no capture while hidden, capture event, no novices, mana prompts**

`packages/engine/src/turn.ts`: add `import { makeQuery } from './ctx';` and `isOffBoard` to the `./query` import. In `beginTurn`, replace the capture loop with
```ts
  for (const st of Object.values(s.structures)) {
    if (st.hidden || !s.structures[st.id]) continue; // off the board, or destroyed by an earlier capture's effects
    const g = groupAt(s, st.pos);
    const captor = g && g.kind === 'recruit' && g.owner !== 'neutral' && g.owner !== st.owner ? g.owner : null;
    if (!captor) continue;
    if (st.kind === 'sanctum') {
      s.winner = captor;
      s.phase = 'over';
      s.log.push({ type: 'win', winner: captor });
      return;
    }
    const from = st.owner;
    if (st.owner !== 'neutral') delta[st.owner]--;
    delta[captor]++;
    st.owner = captor;
    st.novices = 0;
    st.noviceNations = [];
    st.turnCount = RULES.townNoviceRate;
    st.manaType = null;
    st.captured = true;
    delete st.needsMana;
    s.pendingMana.push(st.id);
    s.log.push({ type: 'capture', structure: st.id, by: captor });
    dispatch(e, 'structure:captured', { kind: 'structure', id: st.id }, { from, to: captor });
  }
  // New owned structures and mana-making spells ask their owner for a mana type, like a captured town.
  for (const st of Object.values(s.structures)) {
    if (st.needsMana && st.owner !== 'neutral' && !s.pendingMana.includes(st.id)) s.pendingMana.push(st.id);
  }
  for (const sp of s.spells) {
    const wants = e.cards[sp.cardId]?.wantsMana;
    if (wants && sp.owner !== 'neutral' && !isOffBoard(s, sp.host) && wants(makeQuery(e, sp.owner), sp)) s.pendingMana.push(sp.id);
  }
```
and in the novice production loop:
```ts
      if (st.owner === 'neutral' || st.captured || st.noNovices) continue;
```

- [ ] **Step 6: `chooseMana` for spells, and `manaSource`**

`packages/engine/src/api.ts`: add `MANA_TYPES` to the `./types` import and replace `chooseMana` with
```ts
/**
 * The owner of a pending mana source picks its mana: a captured or new town or colony (any of the 6, fixed until lost),
 * or a spell that makes mana of its owner's choice (stored as `tokens.mana` = 1 + index in MANA_TYPES).
 */
export function chooseMana(state: GameState, cards: CardIndex, side: Side, sourceId: number, mana: Mana): Result {
  const e = makeEngine(state, cards);
  const s = e.state;
  if (s.phase !== 'choose-mana') return fail('not choosing mana');
  if (!s.pendingMana.includes(sourceId)) return fail('that structure is not awaiting a mana choice');
  const st = s.structures[sourceId];
  if (st) {
    if (st.owner !== side) return fail('not your structure');
    st.manaType = mana;
    delete st.needsMana;
  } else {
    const sp = s.spells.find((x) => x.id === sourceId);
    if (!sp) return fail('that structure is not awaiting a mana choice');
    if (sp.owner !== side) return fail('not your mana source');
    sp.tokens.mana = MANA_TYPES.indexOf(mana) + 1;
  }
  s.pendingMana = s.pendingMana.filter((id) => id !== sourceId);
  if (s.pendingMana.length === 0) finishTurnStart(e);
  return { ok: true, state: e.state };
}
```
`packages/engine/src/view.ts`: add `Pos` to the `./types` type import and append
```ts
/** A pending mana choice: a captured or new structure, or a spell that makes mana of its owner's choice. */
export interface ManaSource {
  id: number;
  owner: Side;
  pos: Pos | null;
  /** The structure kind ("town", "colony") or the spell's card name. */
  name: string;
  kind: 'captured' | 'new' | 'spell';
}

/** Describes an id from `state.pendingMana` (null when it is not an owned structure or spell). */
export function manaSource(state: GameState, cards: CardIndex, id: number): ManaSource | null {
  const st = state.structures[id];
  if (st) return st.owner === 'neutral' ? null : { id, owner: st.owner, pos: st.pos, name: st.kind, kind: st.needsMana ? 'new' : 'captured' };
  const sp = state.spells.find((x) => x.id === id);
  if (!sp || sp.owner === 'neutral') return null;
  return { id, owner: sp.owner, pos: sp.host.kind === 'square' ? sp.host.pos : null, name: cards[sp.cardId]?.name ?? sp.cardId, kind: 'spell' };
}
```
`packages/engine/src/index.ts`: export `manaSource` with the other view helpers (`export { viewStats, legalTargets, checkOrders, manaSource } from './view';`) and add `export type { ManaSource } from './view';`.

- [ ] **Step 7: Context actions**

`packages/engine/src/ctx.ts`: add `spellsOn, structureOn` to the `./query` import; add to `EventContext` (after `setTerrain`):
```ts
  /**
   * Creates a town or colony: the square's spells are dispelled and it becomes plains; an owned one asks its owner for a
   * mana type at the next start of turn. Null on a Sanctum square, off the board, or where any structure stands.
   */
  createStructure(def: { kind: 'town' | 'colony'; pos: Pos; owner: PlayerId; noNovices?: boolean }): number | null;
  /** Destroys a town or colony: its spells are dispelled (onDispel hooks run) and it leaves the game. */
  destroyStructure(structureId: number): void;
  /** The structure leaves the board: no capture, training or targeting; it still produces mana and novices. */
  hideStructure(structureId: number): void;
  /** A hidden structure comes back if no group stands on its square. Returns whether it did. */
  showStructure(structureId: number): boolean;
  /** Gives a spell (default: this one) to another player. */
  setSpellOwner(owner: PlayerId, spellId?: number): void;
```
In `makeCtx`, change `setTerrain` so a hidden structure's square is immune too:
```ts
      if (!s.cells.includes(key(pos)) || isSanctumArea(pos) || structureOn(s, pos)) return;
```
and add after it:
```ts
    createStructure: (def) => {
      const s = e.state;
      const pos = def.pos;
      if (!s.cells.includes(key(pos)) || isSanctumArea(pos) || structureOn(s, pos)) return null;
      for (const sp of spellsOn(s, { kind: 'square', pos })) dispel(e, sp.id);
      s.terrain[key(pos)] = 'plains';
      const st: Structure = {
        id: s.nextId++, kind: def.kind, pos: { ...pos }, owner: def.owner, manaType: null, novices: 0,
        turnCount: RULES.townNoviceRate, captured: false,
      };
      if (def.owner !== 'neutral') st.needsMana = true;
      if (def.noNovices) st.noNovices = true;
      s.structures[st.id] = st;
      recheckSquare(e, pos);
      return st.id;
    },
    destroyStructure: (id) => {
      const s = e.state;
      const st = s.structures[id];
      if (!st || st.kind === 'sanctum') return;
      for (const sp of spellsOn(s, { kind: 'structure', id })) dispel(e, sp.id);
      delete s.structures[id];
      s.pendingMana = s.pendingMana.filter((x) => x !== id);
      s.log.push({ type: 'destroyed', structure: id });
      recheckSquare(e, st.pos);
    },
    hideStructure: (id) => {
      const st = e.state.structures[id];
      if (!st || st.kind === 'sanctum' || st.hidden) return;
      st.hidden = true;
      recheckSquare(e, st.pos);
    },
    showStructure: (id) => {
      const st = e.state.structures[id];
      if (!st?.hidden || groupAt(e.state, st.pos)) return false;
      delete st.hidden;
      recheckSquare(e, st.pos);
      return true;
    },
    setSpellOwner: (owner, spellId) => {
      const sp = e.state.spells.find((x) => x.id === (spellId ?? spell.id));
      if (sp) sp.owner = owner;
    },
```

- [ ] **Step 8: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/engine && npx vitest run test/structures.test.ts`
Expected: PASS (8 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. (The web turn report ignores log types it does not know, so the new `destroyed` entry needs no web change.)

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(engine): create, destroy and hide structures; capture event; mana choices for new colonies and spells" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Structure cards (Defensive Pact, Encampment, Seelie Court, Golden Grove)

**Goal:** The four E8 structure cards, with a `.town` target and the Encampment camp helper.

**Files:**
- Create: `packages/cards/src/war/{defensivePact,encampment,encampmentCamp}.ts`, `packages/cards/src/life/{seelieCourt,goldenGrove}.ts`, `packages/cards/test/structure-cards.test.ts`
- Modify: `packages/cards/src/lang/{types,target}.ts`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] `Target.structure.town` accepts towns only and prints "Town."
- [ ] Defensive Pact: a random friendly town or colony on the board is destroyed and a friendly colony appears in the group's square; it needs such a structure, and cannot be cast on a group in a structure or on a Sanctum entrance
- [ ] Encampment (friendly group of 2+ not in a structure): the group leaves the board and a friendly colony with no novices appears; spells cannot target that colony; at the start of turn of casting +3, if no group is there, the colony goes and the group comes back; if the colony is captured first, the group is removed from the game
- [ ] Seelie Court (towns only): other visible spells on the town are dispelled, the town hides; the town and its square cannot be targeted; every 1-3 turns it comes back (only onto an empty square) or hides again
- [ ] Golden Grove (plains): monsters cannot enter or be targeted there; at start of turn of casting +3 the square becomes forest; the mature grove asks its owner for a mana type and then makes 1 of it each turn; a hostile recruit group on it at start of turn captures it; a terrain change dispels it
- [ ] Backlog loses E8; meta says 101 playable (50 War, 51 Life) and 1 pending; faces pins 134 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/structure-cards.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { chooseMana, type Ref } from '@sanctum/engine';
import { canEnterSquare, createGroup, dispatch, recheck, spawnMinion } from '@sanctum/engine/src/testing';
import { printTarget, Target } from '../src/lang';
import { allCards } from '../src/index';
import { advance, castMini, mini, put } from './lang-helpers';

const gref = (id: number): Ref => ({ kind: 'group', id });
const sref = (id: number): Ref => ({ kind: 'structure', id });
const sq = (x: number, y: number): Ref => ({ kind: 'square', pos: { x, y } });
const town = (id: number, owner: 'red' | 'blue' | 'neutral', x: number, y: number, kind: 'town' | 'colony' = 'town') =>
  ({ id, kind, pos: { x, y }, owner, manaType: null, novices: 0, turnCount: 2, captured: false });
const ogre = () => ({
  kind: 'monster' as const, cls: 'monster' as const, name: 'ogre',
  base: { hp: 12, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
});
const structureAtPos = (e: ReturnType<typeof mini>, x: number, y: number) =>
  Object.values(e.state.structures).find((s) => s.pos.x === x && s.pos.y === y);

describe('Target.structure.town', () => {
  it('prints "Town." and refuses colonies', () => {
    expect(printTarget(Target.structure.town.spec)).toBe('Town.');
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4, 'colony');
    expect(castMini(e, 'red', 'seelie-court', sref(900))).toBe('squandered');
  });
});

describe('Defensive Pact', () => {
  it('moves a friendly town to the group as a colony', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 6, 1);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'defensive-pact', gref(g.id))).toBe('cast');
    expect(e.state.structures[900]).toBeUndefined();
    expect(structureAtPos(e, 4, 4)).toMatchObject({ kind: 'colony', owner: 'red', needsMana: true });
  });
  it('needs a friendly town or colony, and a square that can hold a colony', () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'defensive-pact', gref(g.id))).toBe('squandered');
    e.state.structures[900] = town(900, 'red', 6, 1);
    const door = put(e, 'red', { x: 2, y: 3 }, ['swordsman']); // a Sanctum entrance
    expect(castMini(e, 'red', 'defensive-pact', gref(door.id))).toBe('squandered');
    const housed = put(e, 'red', { x: 6, y: 1 }, ['swordsman']);
    expect(castMini(e, 'red', 'defensive-pact', gref(housed.id))).toBe('squandered');
  });
});

describe('Encampment', () => {
  const camp = () => {
    const e = mini(allCards);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    expect(castMini(e, 'red', 'encampment', gref(g.id))).toBe('cast');
    const colony = structureAtPos(e, 4, 4)!;
    return { e, g, colony };
  };

  it('hides the group in an untargetable colony and brings it back on turn of casting +3', () => {
    const { e, g, colony } = camp();
    expect(g.pos).toBeNull();
    expect(colony).toMatchObject({ kind: 'colony', owner: 'red', noNovices: true });
    expect(castMini(e, 'blue', 'spy-at-court', sref(colony.id))).toBe('squandered');
    advance(e);
    advance(e);
    expect(g.pos).toBeNull();
    advance(e); // turn 4 = turn of casting (1) + 3
    expect(e.state.structures[colony.id]).toBeUndefined();
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('waits while the colony is occupied', () => {
    const { e, g, colony } = camp();
    const guest = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    advance(e);
    advance(e);
    advance(e);
    expect(g.pos).toBeNull();
    guest.pos = { x: 6, y: 6 };
    advance(e);
    expect(e.state.structures[colony.id]).toBeUndefined();
    expect(g.pos).toEqual({ x: 4, y: 4 });
  });

  it('a captured camp loses its group', () => {
    const { e, g, colony } = camp();
    put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    advance(e);
    expect(e.state.structures[colony.id].owner).toBe('blue');
    expect(e.state.groups[g.id]).toBeUndefined();
  });

  it('needs a friendly group of two or more, not in a structure', () => {
    const e = mini(allCards);
    const one = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(castMini(e, 'red', 'encampment', gref(one.id))).toBe('squandered');
    const pair = put(e, 'red', { x: 6, y: 1 }, ['swordsman', 'archer']);
    e.state.structures[900] = town(900, 'red', 6, 1);
    expect(castMini(e, 'red', 'encampment', gref(pair.id))).toBe('squandered');
  });
});

describe('Seelie Court', () => {
  it('hides the town, shields it and its square, and toggles every 1-3 turns', () => {
    const e = mini(allCards);
    e.state.structures[900] = town(900, 'red', 4, 4);
    expect(castMini(e, 'blue', 'spy-at-court', sref(900))).toBe('cast');
    expect(castMini(e, 'red', 'seelie-court', sref(900))).toBe('cast');
    expect(e.state.spells.some((s) => s.cardId === 'spy-at-court')).toBe(false);
    expect(e.state.structures[900].hidden).toBe(true);
    expect(castMini(e, 'blue', 'spy-at-court', sref(900))).toBe('squandered');
    expect(castMini(e, 'blue', 'plains', sq(4, 4))).toBe('squandered');
    const court = e.state.spells.find((s) => s.cardId === 'seelie-court')!;
    expect(court.tokens.next).toBeGreaterThanOrEqual(2);
    expect(court.tokens.next).toBeLessThanOrEqual(4);
    e.state.turn = court.tokens.next;
    dispatch(e, 'turn:start');
    expect(e.state.structures[900].hidden).toBeUndefined();
    e.state.turn = court.tokens.next;
    dispatch(e, 'turn:start');
    expect(e.state.structures[900].hidden).toBe(true);
    put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    e.state.turn = court.tokens.next;
    dispatch(e, 'turn:start');
    expect(e.state.structures[900].hidden).toBe(true); // the square is not empty
  });
});

describe('Golden Grove', () => {
  it('keeps monsters out and shields monsters standing there', () => {
    const e = mini(allCards);
    expect(castMini(e, 'red', 'golden-grove', sq(4, 4))).toBe('cast');
    const m = createGroup(e, 'blue', { x: 5, y: 4 }, 'monster', 'computer');
    spawnMinion(e, m.id, ogre());
    const r = put(e, 'blue', { x: 4, y: 5 }, ['swordsman']);
    expect(canEnterSquare(e, m, { x: 4, y: 4 })).toBe(false);
    expect(canEnterSquare(e, r, { x: 4, y: 4 })).toBe(true);
    m.pos = { x: 4, y: 4 };
    expect(castMini(e, 'red', 'fireball', gref(m.id))).toBe('squandered');
  });

  it('matures into forest on turn of casting +3, then makes mana of its owner\'s choice and can be captured', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'golden-grove', sq(4, 4));
    const grove = () => e.state.spells.find((s) => s.cardId === 'golden-grove')!;
    advance(e);
    advance(e);
    expect(e.state.terrain['4,4']).toBe('plains');
    advance(e); // turn 4
    expect(e.state.terrain['4,4']).toBe('forest');
    expect(e.state.phase).toBe('choose-mana');
    expect(e.state.pendingMana).toEqual([grove().id]);
    const r = chooseMana(e.state, e.cards, 'red', grove().id, 'world');
    if (!r.ok) throw new Error(r.error);
    e.state = r.state;
    expect(e.state.players.red.mana.world).toBe(1);
    put(e, 'blue', { x: 4, y: 4 }, ['swordsman']);
    advance(e);
    expect(grove().owner).toBe('blue');
    expect(e.state.pendingMana).toEqual([grove().id]);
  });

  it('is dispelled when the terrain changes', () => {
    const e = mini(allCards);
    castMini(e, 'red', 'golden-grove', sq(4, 4));
    e.state.terrain['4,4'] = 'desert';
    recheck(e, sq(4, 4));
    expect(e.state.spells.some((s) => s.cardId === 'golden-grove')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/structure-cards.test.ts`
Expected: FAIL (`Target.structure.town` is undefined; unknown cards).

- [ ] **Step 3: The `.town` target**

`packages/cards/src/lang/types.ts`, add to `TargetSpec`:
```ts
  /** Structure targets: only this kind ("town (not colony)"). */
  structureKind?: 'town' | 'colony';
```
`packages/cards/src/lang/target.ts`, add to `TargetBuilder`:
```ts
  /** Structure targets only: a town, not a colony. */
  get town(): TargetBuilder {
    if (this.spec.type !== 'structure') throw new Error(`Target: .town needs a structure target, not "${this.spec.type}"`);
    return new TargetBuilder({ ...this.spec, structureKind: 'town' });
  }
```
in `targetFragment` add
```ts
  if (t.structureKind) checks.push((q, r) => r.kind === 'structure' && q.structure(r.id)?.kind === t.structureKind);
```
and in `printTarget` change the structure case to
```ts
    case 'structure': noun = t.structureKind === 'town' ? 'Town' : t.structureKind === 'colony' ? 'Colony' : 'Town or colony'; break;
```

- [ ] **Step 4: The cards**

`packages/cards/src/war/defensivePact.ts`:
```ts
import { isSanctumArea } from '@sanctum/engine';
import type { PlayerId, QueryContext, Structure } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

/** Friendly towns and colonies on the board (hidden ones are off the board). */
const homes = (q: QueryContext, owner: PlayerId): Structure[] =>
  Object.values(q.state.structures).filter((st) => st.owner === owner && st.kind !== 'sanctum' && !st.hidden);

// RULING: the rules describe this as the structure "moving": the old one is destroyed (its novices are lost) and a new
// colony is made, which asks its owner for a mana type at the next start of turn. Destruction does not cost Initiative.
// It cannot be cast on a group standing in a structure or on a Sanctum entrance (colonies cannot be made there). It may
// pick an Encampment's colony, whose group is then removed from the game.
export default card({ id: 'defensive-pact', name: 'Defensive Pact', house: 'war', cost: { strife: 5, clarity: 4 }, type: 'manifestation',
  target: Target.recruitGroup.friendly.notInStructure,
  keywords: [
    Script("A random friendly town or colony on the board is destroyed, and a friendly colony is created in the group's square.", {
      canCast: (q, t) => {
        const g = t.kind === 'group' ? q.group(t.id) : undefined;
        return !!g?.pos && !isSanctumArea(g.pos) && homes(q, q.caster).length > 0;
      },
      onCast: (c, t) => {
        const g = t.kind === 'group' ? c.group(t.id) : undefined;
        const owner = c.spell.owner;
        if (!g?.pos || owner === 'neutral') return;
        const pos = { ...g.pos };
        const list = homes(c, owner);
        if (!list.length) return;
        c.destroyStructure(list[Math.floor(c.random() * list.length)].id);
        c.createStructure({ kind: 'colony', pos, owner });
      },
    }),
  ] });
```
`packages/cards/src/war/encampmentCamp.ts`:
```ts
import type { EventContext } from '@sanctum/engine';
import { card, Script, Target, Undispellable } from '../lang';

/** Start of turn of casting +3 (token `until`): if nobody stands in the camp, fold it and bring the group back. */
function fold(c: EventContext): void {
  if (c.host.kind !== 'structure' || c.state.turn < c.token('until')) return;
  const st = c.structure(c.host.id);
  if (!st || c.groupAt(st.pos)) return;
  const pos = { ...st.pos };
  const gid = c.token('gid');
  c.setToken('folding', 1);
  c.destroyStructure(st.id);
  c.appear(gid, pos);
}

export default card({ id: 'encampment-camp', name: 'Encampment (camp)', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.structure,
  keywords: [
    Undispellable(),
    Script('Holds an encamped group (see Encampment).', {
      on: {
        'turn:start': fold,
        'structure:captured': (c, ev) => {
          if (ev.ref?.kind === 'structure' && c.host.kind === 'structure' && ev.ref.id === c.host.id) c.dispel();
        },
      },
      // "cannot be targeted by spells"
      blocksCast: (_q, sp, a) => a.target.kind === 'structure' && sp.host.kind === 'structure' && a.target.id === sp.host.id,
      // Rules (Concepts_boardhop): a boardhop that ends while its group is inside removes the group from the game.
      onDispel: (c) => {
        if (c.token('folding') !== 1) c.removeGroup(c.token('gid'));
      },
    }),
  ] });
```
`packages/cards/src/war/encampment.ts`:
```ts
import { isSanctumArea } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

// RULING: Encampment is an instant spell; the camp is an undispellable helper on the new colony (the target group is off
// the board, where its own spells are suspended). "On turn of casting +3" = the start of that turn; if the colony is
// occupied then, the group waits for the first later start of turn when it is empty. A captured camp removes the group
// and stays an ordinary colony of its captor that still makes no novices. Not castable on a Sanctum entrance.
export default card({ id: 'encampment', name: 'Encampment', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'manifestation',
  target: Target.recruitGroup.friendly.atLeast(2).notInStructure,
  keywords: [
    Script('The group disappears into a new friendly colony that creates no novices and cannot be targeted by spells. At the start of the third turn after this one, if no group is there, the colony is destroyed and the group comes back. If the colony is captured, the group is removed from the game.', {
      canCast: (q, t) => {
        const g = t.kind === 'group' ? q.group(t.id) : undefined;
        return !!g?.pos && !isSanctumArea(g.pos);
      },
      onCast: (c, t) => {
        const g = t.kind === 'group' ? c.group(t.id) : undefined;
        const owner = c.spell.owner;
        if (!g?.pos || owner === 'neutral') return;
        const pos = { ...g.pos };
        c.hide(g.id);
        const sid = c.createStructure({ kind: 'colony', pos, owner, noNovices: true });
        if (sid === null) {
          c.appear(g.id, pos);
          return;
        }
        c.createSpell('encampment-camp', { kind: 'structure', id: sid }, { tokens: { gid: g.id, until: c.state.turn + 3 } });
      },
    }),
  ] });
```
`packages/cards/src/life/seelieCourt.ts`:
```ts
import type { EventContext } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

const reroll = (c: EventContext) => c.setToken('next', c.state.turn + 1 + Math.floor(c.random() * 3));

// RULING: only visible spells are dispelled (non-visible ones cannot be). "At start of every 1-3 turns" toggles the
// town: gone -> back if its square is empty (else it stays gone), back -> gone again; each toggle rolls the next 1-3.
// While gone it cannot be captured or trained at, and the Court keeps working.
export default card({ id: 'seelie-court', name: 'Seelie Court', house: 'life', cost: { clarity: 5, world: 4 }, type: 'alteration',
  target: Target.structure.town,
  keywords: [
    Script('Other spells on the town are dispelled and it disappears. The town and its square cannot be targeted by spells. At the start of every 1-3 turns it comes back if its square is empty, or disappears again. It still makes mana and novices while gone.', {
      onCast: (c, t) => {
        if (t.kind !== 'structure') return;
        const others = c.state.spells.filter((x) => x.host.kind === 'structure' && x.host.id === t.id && x.id !== c.spell.id && x.visible);
        for (const sp of others) c.dispel(sp.id);
        c.hideStructure(t.id);
        reroll(c);
      },
      on: {
        'turn:start': (c) => {
          if (c.host.kind !== 'structure' || c.state.turn < c.token('next')) return;
          const st = c.structure(c.host.id);
          if (!st) return;
          if (st.hidden) c.showStructure(st.id);
          else c.hideStructure(st.id);
          reroll(c);
        },
      },
      blocksCast: (q, sp, a) => {
        if (sp.host.kind !== 'structure') return false;
        const st = q.structure(sp.host.id);
        if (!st) return false;
        if (a.target.kind === 'structure') return a.target.id === st.id;
        return a.target.kind === 'square' && a.target.pos.x === st.pos.x && a.target.pos.y === st.pos.y;
      },
    }),
  ] });
```
`packages/cards/src/life/goldenGrove.ts`:
```ts
import { MANA_TYPES } from '@sanctum/engine';
import type { ActiveSpell, EventContext, Pos, QueryContext, Ref } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

const ID = 'golden-grove';
const at = (sp: ActiveSpell, p: Pos) => sp.host.kind === 'square' && sp.host.pos.x === p.x && sp.host.pos.y === p.y;
const groveAt = (q: QueryContext, p: Pos) => q.state.spells.find((sp) => sp.cardId === ID && at(sp, p));
const mature = (sp: ActiveSpell | undefined) => (sp?.tokens.mature ?? 0) === 1;

/** The group a cast aims at (itself, or a minion's group). */
const targetGroup = (q: QueryContext, r: Ref) =>
  r.kind === 'group' ? q.group(r.id) : r.kind === 'minion' ? q.group(q.minion(r.id)?.groupId ?? -1) : undefined;

function ripen(c: EventContext): void {
  if (c.host.kind !== 'square' || mature(c.spell) || c.state.turn < c.token('cast') + 3) return;
  c.setToken('mature', 1); // before the terrain change, so the persistent check expects forest
  c.setTerrain(c.host.pos, 'forest');
}

function capture(c: EventContext): void {
  if (c.host.kind !== 'square' || !mature(c.spell)) return;
  const g = c.groupAt(c.host.pos);
  if (!g || g.kind !== 'recruit' || g.owner === 'neutral' || g.owner === c.spell.owner) return;
  c.setSpellOwner(g.owner);
  c.setToken('mana', 0); // the new owner chooses again
}

// RULING: a Golden Grove is a square spell, not a structure: capturing it changes no Initiative and it has no novices.
// Its owner picks the mana in the normal mana-choice step when it matures and after each capture. "Monsters cannot be
// targeted on square" covers group and individual spells aimed at a monster group standing there.
export default card({ id: ID, name: 'Golden Grove', house: 'life', cost: { clarity: 3, world: 1 }, type: 'alteration',
  target: Target.square.on('plains'),
  keywords: [
    Script("Monsters cannot enter this square or be targeted here. At the start of the third turn after casting, the square matures into forest. A mature Golden Grove makes 1 mana of its owner's choice each turn and is captured like a structure. Dispelled if the terrain changes.", {
      onCast: (c) => c.setToken('cast', c.state.turn),
      persistent: (q, host) => host.kind === 'square' && q.terrainAt(host.pos) === (mature(groveAt(q, host.pos)) ? 'forest' : 'plains'),
      blocksEntry: (q, sp, gid, dest) => at(sp, dest) && q.group(gid)?.kind === 'monster',
      blocksCast: (q, sp, a) => {
        const g = targetGroup(q, a.target);
        return !!g?.pos && g.kind === 'monster' && at(sp, g.pos);
      },
      wantsMana: (_q, sp) => mature(sp) && (sp.tokens.mana ?? 0) === 0,
      on: {
        'turn:start': ripen,
        'turn:startAfter': capture,
        'mana:generate': (c) => {
          const i = c.token('mana');
          const owner = c.spell.owner;
          if (mature(c.spell) && i > 0 && owner !== 'neutral') c.addMana(owner, MANA_TYPES[i - 1], 1);
        },
      },
    }),
  ] });
```
Register: `packages/cards/src/war/index.ts` imports `defensivePact`, `encampment`, `encampmentCamp` and appends `defensivePact, encampment, encampmentCamp,`; `packages/cards/src/life/index.ts` imports `seelieCourt`, `goldenGrove` and appends `seelieCourt, goldenGrove,`.

- [ ] **Step 5: Faces, counts, backlog, meta target phrase**

`faces.test.ts`, before the pinning test:
```ts
  it('plan 2d: structures', () => {
    expect(lines('defensive-pact')).toEqual([
      'Friendly recruit group not in a structure.',
      "A random friendly town or colony on the board is destroyed, and a friendly colony is created in the group's square.",
    ]);
    expect(lines('encampment')).toEqual([
      'Friendly recruit group of two or more not in a structure.',
      'The group disappears into a new friendly colony that creates no novices and cannot be targeted by spells. At the start of the third turn after this one, if no group is there, the colony is destroyed and the group comes back. If the colony is captured, the group is removed from the game.',
    ]);
    expect(lines('encampment-camp')).toEqual(['Town or colony.', 'Undispellable.', 'Holds an encamped group (see Encampment).']);
    expect(lines('seelie-court')).toEqual([
      'Town.',
      'Other spells on the town are dispelled and it disappears. The town and its square cannot be targeted by spells. At the start of every 1-3 turns it comes back if its square is empty, or disappears again. It still makes mana and novices while gone.',
    ]);
    expect(lines('golden-grove')).toEqual([
      'Plains square.',
      "Monsters cannot enter this square or be targeted here. At the start of the third turn after casting, the square matures into forest. A mature Golden Grove makes 1 mana of its owner's choice each turn and is captured like a structure. Dispelled if the terrain changes.",
    ]);
  });

```
count `toHaveLength(134)`.
`meta.test.ts`: in `expectedTarget`, make the structure line accept "town (not colony)":
```ts
  if (/^(friendly )?town (or colony|\(not colony\))/.test(s)) return 'structure';
```
and the count block:
```ts
  it('has 101 playable cards (50 War, 51 Life) and 1 pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(50);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(51);
    expect(pendingCards).toHaveLength(1);
  });
```
`cards-backlog.md`: header `Implemented: 101 (50 War, 51 Life).`; delete the whole E8 section.

- [ ] **Step 6: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/structure-cards.test.ts`
Expected: PASS (11 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the five new entries.
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cards): Defensive Pact, Encampment, Seelie Court, Golden Grove" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 12: Web UI for the new state

**Goal:** The web client shows off-board groups, hidden structures, intel, and mana choices for new colonies and Golden Groves; recursive copies read correctly in the hand.

**Files:**
- Create: `packages/web/test/remaining-cards-ui.test.tsx`
- Modify: `packages/web/src/model/session.ts`, `packages/web/src/ui/{Screens,Board,Sidebar,OrdersScreen}.tsx`, `packages/web/src/styles.css`

**Acceptance Criteria:**
- [ ] The mana-choice screen and the session's routing work for any `pendingMana` id through `manaSource` (heading "Red captured the town at (x,y)" stays; a new colony reads "Red's new colony at (x,y)", a grove "Red's Golden Grove at (x,y)"); `pickMana` with a spell id stores the choice
- [ ] A hidden structure is drawn faded (class `hidden`) and its square's label says "(hidden)"; its sidebar says it is off the board
- [ ] With nothing selected, the sidebar lists groups that are off the board ("Off the board", "Red group of 2")
- [ ] The orders screen shows the player's intel ("Spy at Court: Blue's next card is Fireball.")
- [ ] A recursive copy in hand shows its own name and cost ("Growing Strife (2 tokens)", "3 Strife")
- [ ] All existing web tests pass

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/web/test/remaining-cards-ui.test.tsx`:
```tsx
import { cleanup, render, screen } from '@testing-library/preact';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cardIndex } from '@sanctum/cards';
import { emptyOrders, type GameState, type Orders } from '@sanctum/engine';
import { Board } from '../src/ui/Board';
import { HandTray } from '../src/ui/HandTray';
import { OrdersScreen } from '../src/ui/OrdersScreen';
import { ManaChoice } from '../src/ui/Screens';
import { Sidebar } from '../src/ui/Sidebar';
import { begin, newSession, pickMana, type Session } from '../src/model/session';

const fresh = (): Session => newSession(7, { red: 'war', blue: 'life' });
const withState = (s: Session, edit: (st: GameState) => void): Session => {
  const state = structuredClone(s.state);
  edit(state);
  return { ...s, state };
};

describe('remaining cards in the web client', () => {
  afterEach(cleanup);

  it('asks for the mana of a new colony', () => {
    const s = withState(fresh(), (st) => {
      st.structures[9000] = { id: 9000, kind: 'colony', pos: { x: 4, y: 4 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false, needsMana: true };
      st.phase = 'choose-mana';
      st.pendingMana = [9000];
    });
    render(<ManaChoice session={s} side="red" onPick={() => {}} />);
    expect(screen.getByRole('heading', { name: "Red's new colony at (5,5)" })).toBeTruthy();
  });

  it('asks for the mana of a Golden Grove and stores the answer', () => {
    const s = withState(fresh(), (st) => {
      st.spells.push({ id: 9001, cardId: 'golden-grove', owner: 'red', host: { kind: 'square', pos: { x: 4, y: 4 } }, visible: true, turnsLeft: null, tokens: { mature: 1 } });
      st.phase = 'choose-mana';
      st.pendingMana = [9001];
    });
    render(<ManaChoice session={s} side="red" onPick={() => {}} />);
    expect(screen.getByRole('heading', { name: "Red's Golden Grove at (5,5)" })).toBeTruthy();
    const after = pickMana(s, 'red', 9001, 'world');
    expect(after.state.spells.find((x) => x.id === 9001)!.tokens.mana).toBe(6);
    expect(after.screen.kind).not.toBe('mana');
  });

  it('draws a hidden structure as a labelled ghost', () => {
    const base = fresh();
    const t = Object.values(base.state.structures).find((x) => x.kind === 'town')!;
    const s = withState(base, (st) => { st.structures[t.id].hidden = true; });
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    expect(container.querySelectorAll('g.structure.hidden')).toHaveLength(1);
    expect(container.querySelector(`polygon[data-cell="${t.pos.x},${t.pos.y}"]`)!.getAttribute('aria-label')).toMatch(/town \(hidden\)/);
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'structure', id: t.id }} />);
    expect(screen.getByText(/Off the board/)).toBeTruthy();
  });

  it('lists groups that are off the board', () => {
    const base = fresh();
    const g = Object.values(base.state.groups).find((x) => x.owner === 'red')!;
    const s = withState(base, (st) => {
      st.groups[g.id].pos = null;
      st.groups[g.id].minionIds = st.groups[g.id].minionIds.slice(0, 2);
    });
    render(<Sidebar state={s.state} cards={s.cards} selected={null} />);
    expect(screen.getByText('Off the board')).toBeTruthy();
    expect(screen.getByText('Red group of 2')).toBeTruthy();
  });

  it('shows intel on its owner\'s orders screen', () => {
    const s = begin(withState(fresh(), (st) => { st.players.red.intel = [{ source: 'spy-at-court', side: 'blue', cardId: 'fireball' }]; }), 'red');
    render(<OrdersScreen session={s} side="red" onLock={vi.fn<(o: Orders) => string | null>(() => null)} />);
    expect(screen.getByText("Spy at Court: Blue's next card is Fireball.")).toBeTruthy();
  });

  it('shows a recursive copy with its own name and cost', () => {
    render(<HandTray hand={['growing-strife-2']} cards={cardIndex} draft={emptyOrders()} armed={null} onArm={() => {}} onDiscard={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Growing Strife (2 tokens)' })).toBeTruthy();
    expect(screen.getByText('3 Strife')).toBeTruthy();
    expect(screen.getByText('Recursive 2.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/web && npx vitest run test/remaining-cards-ui.test.tsx`
Expected: FAIL (the mana screen reads `state.structures[9001].owner` of undefined; no ghost, no off-board list, no intel). The recursive-copy test already passes.

- [ ] **Step 3: Mana choices through `manaSource`**

`packages/web/src/model/session.ts`: add `manaSource` to the `@sanctum/engine` import and in `route` replace the two structure lookups:
```ts
      const npcId = state.pendingMana.find((id) => manaSource(state, cards, id)?.owner === NPC_SIDE);
```
and
```ts
    const first = manaSource(state, cards, state.pendingMana[0]);
    if (!first) throw new Error(`pending mana choice ${state.pendingMana[0]} has no owner`);
    return at({ kind: 'mana', side: first.owner });
```
Rename `pickMana`'s third parameter to `sourceId` (doc: "The owner of a pending mana source picks its mana.").

`packages/web/src/ui/Screens.tsx`: add `manaSource` to the `@sanctum/engine` import and replace the first four lines of `ManaChoice`'s body and its heading with
```tsx
  const { state, cards } = session;
  const id = state.pendingMana.find((x) => manaSource(state, cards, x)?.owner === side)!;
  const src = manaSource(state, cards, id)!;
  const where = src.pos ? ` at (${src.pos.x + 1},${src.pos.y + 1})` : '';
  const title = src.kind === 'captured' ? `${cap(side)} captured the ${src.name}${where}` : `${cap(side)}'s ${src.kind === 'new' ? 'new ' : ''}${src.name}${where}`;
  const house = state.players[side].house;
  const uses = houseMana(house).map(manaLabel);
```
with `<h1>{title}</h1>` as the heading (the rest of the component is unchanged).

- [ ] **Step 4: Hidden structures on the board and in the sidebar**

`packages/web/src/ui/Board.tsx`: in `cellLabel`, push ``${cap(st.owner)} ${st.kind}${st.hidden ? ' (hidden)' : ''}``; in the structure drawing, make the group element
```tsx
            <g key={`st${st.id}`} class={`structure owner-${st.owner}${st.hidden ? ' hidden' : ''}`} pointer-events="none"
              opacity={st.hidden ? 0.35 : undefined} transform={`translate(${c.x - 27} ${c.y - 6})`}>
```
`packages/web/src/ui/Sidebar.tsx`: in `StructureView`, after the owner line, add
```tsx
      {st.hidden ? <p class="muted">Off the board: it cannot be captured or trained at, but still makes mana and novices.</p> : null}
```
and add above `Sidebar`:
```tsx
/** Groups waiting off the board (Faerie Circle, Encampment, combat-hoppers): they have no square to click. */
function OffBoard({ state }: { state: GameState }) {
  const away = Object.values(state.groups).filter((g) => !g.pos);
  if (away.length === 0) return null;
  return (
    <section class="off-board">
      <h3>Off the board</h3>
      <ul class="plain">
        {away.map((g) => <li key={g.id}>{cap(g.owner)} {g.kind === 'monster' ? 'monster group' : 'group'} of {g.minionIds.length}</li>)}
      </ul>
    </section>
  );
}
```
and change the default body to
```tsx
  let body: preact.ComponentChildren = (
    <div>
      <p class="muted">Select a square, group or structure.</p>
      <OffBoard state={state} />
    </div>
  );
```
`packages/web/src/styles.css`: append
```css
.board .structure.hidden rect { stroke-dasharray: 2 2; }
```

- [ ] **Step 5: Intel on the orders screen**

`packages/web/src/ui/OrdersScreen.tsx`: change the format import to `import { ManaChips, cap, cardName, manaLabel } from './format';` and add as the first child inside `<Sidebar ...>`:
```tsx
          {me.intel?.length ? (
            <section class="intel">
              <h3>Intel</h3>
              {me.intel.map((x, i) => <p key={i}>{cardName(x.source)}: {cap(x.side)}'s next card is {cardName(x.cardId)}.</p>)}
            </section>
          ) : null}
```

- [ ] **Step 6: Run the test, then the whole repo**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/web && npx vitest run test/remaining-cards-ui.test.tsx`
Expected: PASS (6 tests). If `getByText` cannot find the intel line because Preact splits the JSX text into several nodes, render the line as one template string: `<p key={i}>{`${cardName(x.source)}: ${cap(x.side)}'s next card is ${cardName(x.cardId)}.`}</p>` (same for the off-board list item).
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(web): off-board groups, hidden structures, intel and new mana choices" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---
### Task 13: Questing Beast

**Goal:** Questing Beast and its quest helper: a neutral beast in a random square, hunted by the target group, which leaves player control until the hunt ends.

**Files:**
- Create: `packages/cards/src/life/{questingBeast,questingBeastQuest}.ts`, `packages/cards/test/questing-beast.test.ts`
- Modify: `packages/cards/src/lang/keywords/behavior.ts` (export `stepToward`), `packages/cards/src/life/index.ts`, `packages/cards/test/{meta,faces}.test.ts`, `packages/cards/test/__snapshots__/faces.test.ts.snap`, `docs/superpowers/plans/cards-backlog.md`

**Acceptance Criteria:**
- [ ] Cast on a player-controlled recruit group: a neutral, computer-controlled Questing Beast (H3 A1 HP6 L1) appears on a random empty square that is not a structure or Sanctum square; the group gets the quest spell and becomes computer-controlled with the quest's bot
- [ ] Only one quest per group; a computer-controlled group cannot be targeted; summoning and hero spells cannot target the hunting group
- [ ] The hunters' bot steps toward the beast
- [ ] At start of a combat the beast dies (ending the combat) unless free; if its own hunters fought it they get +1 level; either way the hunters return to player control and the quest ends
- [ ] The beast is free (fights normally) once its hunters are gone; if the beast leaves play another way, the hunters return to player control before the next movement
- [ ] Backlog is empty; meta says 102 playable (50 War, 52 Life) and 0 pending; faces pins 136 cards

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/questing-beast.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Ref } from '@sanctum/engine';
import { computeStats, dispatch, killMinion, runMovement } from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';
import { castMini, mini, put } from './lang-helpers';

const gref = (id: number): Ref => ({ kind: 'group', id });
const beastOf = (e: ReturnType<typeof mini>) => Object.values(e.state.groups).find((g) => g.kind === 'monster');
const quest = (e: ReturnType<typeof mini>) => e.state.spells.find((s) => s.cardId === 'questing-beast-quest');

const setup = () => {
  const e = mini(allCards);
  const hunters = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
  expect(castMini(e, 'red', 'questing-beast', gref(hunters.id))).toBe('cast');
  const beast = beastOf(e)!;
  return { e, hunters, beast };
};

describe('Questing Beast', () => {
  it('summons a neutral beast somewhere free and sends the group after it', () => {
    const { e, hunters, beast } = setup();
    expect(beast).toMatchObject({ owner: 'neutral', control: 'computer', botId: 'questing-beast' });
    expect(beast.pos).not.toBeNull();
    expect(beast.pos).not.toEqual({ x: 4, y: 4 });
    const qb = e.state.minions[beast.minionIds[0]];
    expect(qb.name).toBe('Questing Beast');
    const s = computeStats(e, qb.id);
    expect([s.hand, s.armor, s.maxHp, s.level]).toEqual([3, 1, 6, 1]);
    expect(hunters).toMatchObject({ control: 'computer', botId: 'questing-beast-quest' });
    expect(quest(e)!.tokens.qb).toBe(beast.id);
  });

  it('is only one per group and only on player-controlled groups; the hunters cannot gain members', () => {
    const { e, hunters } = setup();
    expect(castMini(e, 'red', 'questing-beast', gref(hunters.id))).toBe('squandered');
    expect(castMini(e, 'red', 'bard', gref(hunters.id))).toBe('squandered');
  });

  it('the hunters close in on the beast', () => {
    const { e, hunters, beast } = setup();
    beast.pos = { x: 4, y: 8 };
    runMovement(e);
    expect(hunters.pos).toEqual({ x: 4, y: 5 });
  });

  it('dies at start of combat while hunted; its own hunters level up and are freed', () => {
    const { e, hunters, beast } = setup();
    beast.pos = { x: 5, y: 4 };
    const ev = dispatch(e, 'combat:start', gref(beast.id), { opponent: hunters.id });
    expect(ev.data.endCombat).toBe(true);
    expect(e.state.groups[beast.id]).toBeUndefined();
    expect(hunters.minionIds.map((id) => e.state.minions[id].base.level)).toEqual([2, 2]);
    expect(hunters).toMatchObject({ control: 'player', botId: null });
    expect(quest(e)).toBeUndefined();
  });

  it('killed by someone else, the hunters get no level but are freed', () => {
    const { e, hunters, beast } = setup();
    const other = put(e, 'blue', { x: 7, y: 1 }, ['swordsman']);
    dispatch(e, 'combat:start', gref(beast.id), { opponent: other.id });
    expect(e.state.groups[beast.id]).toBeUndefined();
    expect(hunters.minionIds.map((id) => e.state.minions[id].base.level)).toEqual([1, 1]);
    expect(hunters.control).toBe('player');
  });

  it('goes free when its hunters are gone, and then fights normally', () => {
    const { e, hunters, beast } = setup();
    for (const id of [...hunters.minionIds]) killMinion(e, id, null, 'dies');
    const other = put(e, 'blue', { x: 7, y: 1 }, ['swordsman']);
    const ev = dispatch(e, 'combat:start', gref(beast.id), { opponent: other.id });
    expect(ev.data.endCombat).toBeUndefined();
    expect(e.state.groups[beast.id]).toBeDefined();
  });

  it('frees the hunters before movement if the beast left play another way', () => {
    const { e, hunters, beast } = setup();
    killMinion(e, beast.minionIds[0], null, 'dies');
    dispatch(e, 'movement:before');
    expect(hunters.control).toBe('player');
    expect(quest(e)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/questing-beast.test.ts`
Expected: FAIL (unknown card squanders).

- [ ] **Step 3: Export `stepToward`**

`packages/cards/src/lang/keywords/behavior.ts`: change `function stepToward(` to `export function stepToward(` (it is already documented).

- [ ] **Step 4: The cards**

`packages/cards/src/life/questingBeastQuest.ts`:
```ts
import type { BotContext, Dir } from '@sanctum/engine';
import { card, Script, stepToward, Target } from '../lang';

export const QUEST = 'questing-beast-quest';

/** The hunters' bot: close in on their beast (combat happens between adjacent groups). */
function hunt(q: BotContext, gid: number): Dir | null {
  const sp = q.state.spells.find((x) => x.cardId === QUEST && x.host.kind === 'group' && x.host.id === gid);
  const beast = sp ? q.group(sp.tokens.qb) : undefined;
  return beast?.pos ? stepToward(q, gid, beast.pos) : null;
}

// RULING: the quest is the visible "relation" spell on the hunting group: dispelling it (or the beast leaving play)
// ends the hunt and gives the group back to its player. Computer control already keeps the group from joining groups,
// training recruits into it and entering structures; summoning and hero spells cannot target it either.
export default card({ id: QUEST, name: "Questing Beast's Quest", house: 'life', cost: {}, type: 'alteration', helper: true,
  target: Target.recruitGroup,
  keywords: [
    Script('The group is computer-controlled and hunts its Questing Beast. It cannot gain members. When this ends, it returns to player control.', {
      bot: hunt,
      blocksCast: (_q, sp, a) =>
        a.target.kind === 'group' && sp.host.kind === 'group' && a.target.id === sp.host.id && (a.card.type === 'summoning' || a.card.type === 'hero'),
      on: {
        'movement:before': (c) => {
          if (!c.group(c.token('qb'))) c.dispel();
        },
      },
      onDispel: (c) => {
        if (c.host.kind === 'group' && c.group(c.host.id)) c.setControl(c.host.id, 'player');
      },
    }),
  ] });
```
`packages/cards/src/life/questingBeast.ts`:
```ts
import { isSanctumArea, step, terrainForbids } from '@sanctum/engine';
import type { BotContext, Dir, EventContext, GameEvent, Pos, QueryContext } from '@sanctum/engine';
import { card, creatureSpec, hostGroupId, nomadicBot, Script, Target, type CreatureDef } from '../lang';
import { QUEST } from './questingBeastQuest';

const BEAST: CreatureDef = { name: 'Questing Beast', cls: 'monster', hand: 3, armor: 1, hp: 6, level: 1 };

const questFor = (q: QueryContext, beastGroupId: number) =>
  q.state.spells.find((sp) => sp.cardId === QUEST && sp.tokens.qb === beastGroupId);

/** Squares the beast may appear on: empty, no structure, not a Sanctum square, terrain it can stand on. */
function freeSquares(q: QueryContext): Pos[] {
  return q.state.cells
    .map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    })
    .filter((p) => !isSanctumArea(p) && !q.groupAt(p) && !q.structureAt(p) && !terrainForbids(q.terrainAt(p) ?? 'plains', []));
}

/** While hunted the beast flees its hunters; once free it is an ordinary Nomadic monster. */
function beastBot(q: BotContext, gid: number): Dir | null {
  const quest = questFor(q, gid);
  const me = q.group(gid);
  const hunters = quest && quest.host.kind === 'group' ? q.group(quest.host.id) : undefined;
  if (!quest || !me?.pos || !hunters?.pos) return nomadicBot(q, gid);
  const dist = (p: Pos) => Math.abs(p.x - hunters.pos!.x) + Math.abs(p.y - hunters.pos!.y);
  const here = dist(me.pos);
  const away = q.legalDirections(gid).filter((d) => dist(step(me.pos!, d)) > here);
  return away.length ? away[Math.floor(q.random() * away.length)] : null;
}

/** Start of combat: a hunted beast dies at once and the combat ends; its own hunters gain a level. */
function cornered(c: EventContext, ev: GameEvent): void {
  const me = hostGroupId(c);
  if (me === undefined || ev.ref?.kind !== 'group' || ev.ref.id !== me || c.host.kind !== 'minion') return;
  const quest = questFor(c, me);
  if (!quest) return; // free: it fights like any monster
  const hunters = quest.host.kind === 'group' ? quest.host.id : -1;
  c.kill(c.host.id);
  c.endCombat();
  if (ev.data.opponent === hunters) for (const m of c.minionsOf(hunters)) c.addLevel(m.id, 1);
  c.dispel(quest.id);
}

// RULING: "free (*)" = no longer hunted: its hunters are gone or the quest was dispelled (rules: Concepts_relations,
// "When bereaved, a Questing Beast goes free"). The original "avoids combat"; here it flees its hunters while hunted.
// The random square is any empty square without a structure, outside the Sanctum squares, that it can stand on.
export default card({ id: 'questing-beast', name: 'Questing Beast', house: 'life', cost: { clarity: 4, world: 3 }, type: 'summoning', host: 'minion',
  target: Target.recruitGroup.playerControlled,
  keywords: [
    Script('Summon a neutral, Nomadic Questing Beast (H:3 A:1 HP:6 L:1) in a random square. The group leaves player control and hunts it until it leaves play. At start of combat the Beast dies, ending the combat, unless free (its hunters are gone); if its hunters caused this, they get +1 L. Only one on a group.', {
      visible: false,
      bot: beastBot,
      canCast: (q, t) => t.kind === 'group' && !q.state.spells.some((sp) => sp.cardId === QUEST && sp.host.kind === 'group' && sp.host.id === t.id) && freeSquares(q).length > 0,
      onCast: (c, t) => {
        if (t.kind !== 'group') return;
        const spots = freeSquares(c);
        if (!spots.length) return;
        const pos = spots[Math.floor(c.random() * spots.length)];
        const gid = c.summon({ owner: 'neutral', pos, control: 'computer', minions: [creatureSpec(BEAST, 'life')] });
        for (const mid of c.group(gid)!.minionIds) c.createSpell('questing-beast', { kind: 'minion', id: mid }, { owner: 'neutral' });
        c.createSpell(QUEST, { kind: 'group', id: t.id }, { tokens: { qb: gid } });
        c.setControl(t.id, 'computer', QUEST);
      },
      on: { 'combat:start': cornered },
    }),
  ] });
```
Register in `packages/cards/src/life/index.ts`: imports `questingBeast`, `questingBeastQuest`; append `questingBeast, questingBeastQuest,` to `lifeCards`.

- [ ] **Step 5: Faces, counts, backlog**

`faces.test.ts`, before the pinning test:
```ts
  it('plan 2d: Questing Beast', () => {
    expect(lines('questing-beast')).toEqual([
      'Player-controlled recruit group.',
      'Summon a neutral, Nomadic Questing Beast (H:3 A:1 HP:6 L:1) in a random square. The group leaves player control and hunts it until it leaves play. At start of combat the Beast dies, ending the combat, unless free (its hunters are gone); if its hunters caused this, they get +1 L. Only one on a group.',
    ]);
    expect(lines('questing-beast-quest')).toEqual([
      'Recruit group.',
      'The group is computer-controlled and hunts its Questing Beast. It cannot gain members. When this ends, it returns to player control.',
    ]);
  });

```
count `toHaveLength(136)`. `meta.test.ts`:
```ts
  it('has 102 playable cards (50 War, 52 Life) and none pending', () => {
    expect(playableCards.filter((c) => c.house === 'war')).toHaveLength(50);
    expect(playableCards.filter((c) => c.house === 'life')).toHaveLength(52);
    expect(pendingCards).toHaveLength(0);
  });
```
`docs/superpowers/plans/cards-backlog.md`: replace the whole file with
```markdown
# War and Life cards not yet implemented

Implemented: 102 (50 War, 52 Life): every War and Life card in `packages/cards/data/cards.json`. The last 24 shipped in
plan 2d (`docs/superpowers/plans/2026-10-17-remaining-cards.md`). `packages/cards/test/backlog.test.ts` keeps this list
equal to `pendingCards`; card lines must stay in the form `- Name (War|Life)`.

Nothing is pending.
```

- [ ] **Step 6: Run, record the snapshot, run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/questing-beast.test.ts`
Expected: PASS (7 tests).
Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/faces.test.ts -u` and read the two new entries.
Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(cards): Questing Beast" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 14: Docs, final counts and tag

**Goal:** The docs describe the new keywords, engine hooks and rulings; counts and the face snapshot are final; tag `remaining-cards`.

**Files:**
- Modify: `docs/keyword-design.md`, `docs/card-text-guide.md`, `packages/cards/test/{meta,faces}.test.ts` (check only), `packages/cards/test/__snapshots__/faces.test.ts.snap` (check only)

**Acceptance Criteria:**
- [ ] `meta.test.ts` asserts 102 playable (50 War, 52 Life) and 0 pending; `faces.test.ts` asserts 136 faces (the real `allCards.length`); `cards-backlog.md` lists no card
- [ ] `docs/keyword-design.md` section 6 lists `Versus`, `Recursive` (with `recursive()` and hand copies), the target modifiers `.playerControlled`, `.atLeast`, `.atMost`, `.notInStructure`, `.town`, and `Bound` on any terrain
- [ ] `docs/card-text-guide.md` lists the new events (`spell:cast`, `structure:captured`), strike flags (`magical`, `heals`), card hooks (`blocksEntry`, `reach`, `onDispel`, `wantsMana`, `copyOf`) and context actions; section 6 no longer calls Recursive "backlog E10"
- [ ] The whole repo passes; tag `remaining-cards` points at the final commit

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck && git tag --points-at HEAD` -> all pass, prints `remaining-cards`

**Steps:**

- [ ] **Step 1: Check the counts**

Run: `cd C:/Users/nschonegg/Claude/sanctum/packages/cards && npx vitest run test/meta.test.ts test/faces.test.ts test/backlog.test.ts test/decks.test.ts`
Expected: PASS. If `allCards.length` is not 136 (a helper was added or merged differently), put the real number in `faces.test.ts`, regenerate the snapshot with `-u`, and read the whole snapshot once: no `undefined`, no empty lines, no doubled parentheses, and every copy's face says `Recursive N.` with `+N H.` or `+N M.`.

- [ ] **Step 2: `docs/keyword-design.md`**

In section 6 ("As built"), add after the creatures bullet:
```markdown
- **Plan 2d** (the last 24 cards): `Versus` ("Archers +1 M against swordsmen", "+3 M against groups in a structure or
  forest": bonus damage by victim class or by where the victim stands, for a minion or for named members of a group);
  `Recursive N` with the `recursive()` generator (a card and its hand copies `<id>-2` ... `<id>-8`, each a separate card
  with `copyOf`, one more token and one more mana; copies never go in a deck and share exclusivity with the original);
  target modifiers `.playerControlled`, `.atLeast(n)`, `.atMost(n)`, `.notInStructure`, `.town`; `Bound` accepts any
  terrain. One-off rules (Cannon, Fae Gift, Yeoman, Book of War, Day of Mourning, Seelie Champion, Spy at Court,
  Challenge, Fae Quadrille, Terrain Bind, General, Weapon Master, Renegades, Lava Flow, Faerie Circle, Defensive Pact,
  Encampment, Seelie Court, Golden Grove, Questing Beast) are `Script`s with their own printed text and `// RULING:`
  notes; none of their patterns reaches the three-card threshold for a keyword yet.
```

- [ ] **Step 3: `docs/card-text-guide.md`**

Section 4 (events) table, add rows:
```markdown
| `When <alteration> is cast on X` | `spell:cast` | on the cast target after a successful cast; `data.cardId`, `data.type`, `data.caster`, `data.spellId` (-1 for instant spells) |
| `If captured` (structures) | `structure:captured` | on the structure at start of turn, `data.from`, `data.to` |
```
and under the `attacker:strikes` row add the sentence "Handlers may also set `data.magical` (ignores armor, skips before-armor effects) or `data.heals` (what gets through armor heals instead of damaging)."
Section 6, change the Recursive row to:
```markdown
| `Recursive (Starts with 1 token ...)` | `recursive(input, (t) => keywords)` declares the card and its hand copies (`copyOf`); `Recursive N` adds the next copy to the caster's hand |
```
Section 8 (actions) table, add rows:
```markdown
| `changes into an Elf` | `ctx.setNation(id, nation)` |
| `gets +1 level` (permanent) | `ctx.addLevel(id, n)` |
| `top card of the deck is removed from the game` | `ctx.removeTopCard(side)` |
| `tells its caster the top card` | `ctx.reveal(to, side)` (private `PlayerState.intel`, one turn) |
| `a copy is added to your hand` | `ctx.addToHand(side, cardId)` |
| `leaves player control`, `becomes neutral` | `ctx.setControl(group, 'computer', botId?)`, `ctx.setOwner(group, owner)` |
| `is removed from the game` (a group) | `ctx.removeGroup(group)` |
| `a colony is created / destroyed` | `ctx.createStructure({ kind, pos, owner, noNovices? })`, `ctx.destroyStructure(id)` |
| `town disappears / reappears` | `ctx.hideStructure(id)`, `ctx.showStructure(id)` (`Structure.hidden`) |
| `is captured like a structure` (a spell) | `ctx.setSpellOwner(owner)` plus `CardDef.wantsMana` for "mana of its owner's choice" |
| `cannot enter`, `cannot re-enter` | `CardDef.blocksEntry(q, spell, groupId, dest)` |
| `all friendly swordsmen in adjacent squares get ...` | `CardDef.reach: 'board'` with a `stats` hook that picks the minions |
| `if dispelled while away, the group is removed` | `CardDef.onDispel(c)` (runs on dispel and expiry, not on host death) |
```
and add a short paragraph after the table:
```markdown
Off the board, time stops: spells on an off-board group or its minions get no events and do not count down. Hidden
structures keep their square and keep producing, but `structureAt` does not see them. `state.pendingMana` may hold a
spell id (Golden Grove); clients describe any pending id with `manaSource(state, cards, id)`.
```

- [ ] **Step 4: Run the whole repo, commit and tag**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "docs: keywords, hooks and rulings of the last 24 cards; final counts" -m "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git tag remaining-cards
```

---

## Self-review against the 24 cards

Every backlog card appears in exactly one task:

| Backlog group | Card | Task |
|---|---|---|
| E1 | Questing Beast | 13 |
| E6 | Faerie Circle | 9 |
| E8 | Challenge | 3 |
| E8 | Defensive Pact | 11 |
| E8 | Encampment | 11 |
| E8 | Golden Grove | 11 |
| E8 | Seelie Court | 11 |
| E8 | Spy at Court | 3 |
| E9 | Cannon | 1 |
| E9 | Flaming Arrows | 1 |
| E9 | Cadre | 1 |
| E9 | Fae Gift | 1 |
| E9 | Yeoman | 1 |
| E10 | Book of War | 3 |
| E10 | Growing Strife | 3 |
| E10 | Day of Mourning | 3 |
| E10 | Greater Clarity | 3 |
| E10 | Seelie Champion | 3 |
| E11 | General | 7 |
| E11 | Lava Flow | 7 |
| E11 | Renegades | 7 |
| E11 | Weapon Master | 7 |
| E11 | Fae Quadrille | 5 |
| E11 | Terrain Bind | 5 |

Per card task: 5 + 7 + 2 + 4 + 1 + 4 + 1 = 24. Helpers added: `lava-flow-lava`, `faerie-blessing`, `faerie-circle-hop`, `encampment-camp`, `questing-beast-quest` (5); hand copies: 7 + 7 = 14; 93 + 24 + 5 + 14 = 136.

Every clause of the 24 texts is either implemented and tested, or recorded as a `// RULING:` (plan decisions 3-27). The clauses deliberately not implemented: Weapon Master's "cannot be targeted by Bear, Eagle, Lion, or Lizard Spirit, or Shapeshifter" (those cards are not in the game), the Colony helper spell (no implemented card dispels structure spells), and initiative deltas for destroyed structures (no implemented card destroys a structure the rules would count as a loss).

Types used across tasks, and where they are created: `ctx.setNation` (0), `strike.magical/heals` (0), `spell:cast`, `addLevel`, `removeTopCard`, `reveal`, `PlayerState.intel`, `Intel`, `addToHand`, `CardDef.copyOf` (2), `CardInput.copyOf`, `recursive`, `Recursive` (3), `CardDef.blocksEntry`, `entryBlocked`, `canEnterSquare` in `testing.ts` (4), `CardDef.reach`, `StatDelta/Stats.dualClass`, `ctx.setOwner`, `ctx.setControl` (6), target modifiers and `Bound` on any terrain (7), `CardDef.onDispel`, `ctx.removeGroup` (8), `Structure.hidden/noNovices/needsMana`, `structureOn`, `structure:captured`, `CardDef.wantsMana`, `ctx.createStructure/destroyStructure/hideStructure/showStructure/setSpellOwner`, `manaSource`, `ManaSource` (10), `Target.structure.town` (11), `stepToward` export (13). Every later use is in a later task.

## After this plan

- All 102 War and Life cards are playable; the next houses (Body, Nature, ...) can reuse `Versus`, `Recursive`, `blocksEntry`, boardhops and structures. Weapon Master's untargetable clause becomes implementable once Bear/Eagle/Lion/Lizard Spirit and Shapeshifter exist.
- The web client could show a card-level "tokens" badge if a future recursive card keeps state on the spell rather than in a copy; today copies carry their count in their name.
