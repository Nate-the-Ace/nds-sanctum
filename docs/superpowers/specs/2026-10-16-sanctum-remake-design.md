# Sanctum remake — design

Date: 2026-10-16. Status: draft for review.

## 1. Goal and scope

Faithful clone of Sanctum (Digital Addiction, 1998; community revival at playsanctum.net), as a web game. Private-use fan project: card names, mechanics and text are copied from the community card pages; it is not published. Reference rules (NIOGA Rules v2.20) are saved in `research/rules/*.txt`.

**Milestone 1 (this spec):** deterministic rules engine, TypeScript card-script API, two houses of cards, and a same-screen hotseat UI with hidden orders. Tests run the engine headless.

**Deferred (design must not block them):** online 1v1 (WebSocket), accounts/collection/deckbuilder/lobby/store, AI opponent, the other ten houses, other realms, heroes, experience levels, ranked play.

## 2. Rules decisions

Taken from the original rules. Where the original leaves something open or I simplified, it is marked **(decision)**.

**Board.** Square grid drawn diagonally. 94 squares: two 5-square Sancta (plus shape: Sanctum + 4 entrances) and 84 playable squares. Board geometry is data (`BoardLayout`), not hard-coded; exact dimensions are fixed in the plan from the original map. One group per square (stacking limit), max 8 minions per group. Terrains: plains, forest, desert, water, swamp, mountain, plus barren land, ice, lava, volcano, void (data table `terrains.ts` filled from `Elements_terrainswalks.txt`). Each minion has terrainwalks that decide where it may enter. **(decision)** M1 ships the Veldt realm only (5 towns, plains default, 57/19.5/4/2.5/0.5/0.5 distribution); other realms are data additions. Terrain is rolled symmetrically (half the squares rolled, half rotated). The board is 10x10 minus a 3-square staircase at two opposite corners = 94 squares.

**Towns.** 5 neutral towns, placed by the original algorithm (half random, rotated to the other half, excluded squares per the Map page). A town makes 1 mana/turn of the type its owner picks at capture (any of 6, fixed until lost) and 1 novice per 2 turns. A Sanctum makes novices every 4 turns and mana only of its house's 2 types: each novice trained as mana (max 1 per turn) is a permanent generator, giving 1 point of its type at the start of every later turn, and also adds 1 point to the pool in the turn it is trained. Mana is non-cumulative: unused mana is lost at the start of each turn. Capture happens at start of turn if a hostile recruit group sits in the structure; capturing a Sanctum wins. Colonies: engine supports the structure type, no M1 cards create one.

**Mana.** 6 types: Clarity, Mystery, Order, Strife, Will, World. Pool is rebuilt each turn and unspent mana is lost. Each house has a primary and secondary type (table in `houses.ts`, from `Axioms_houses`). A card's cost uses only its house's 2 types.

**Turn.** Per the original pipeline, without the network checksum phase:
1. Start of turn: experience (deferred), "at start of turn" and "after start of turn" events, draw to 5, capture structures, novice production, structure deltas and initiative, generate mana, win check.
2. Orders: both players act simultaneously and privately (train novices as swordsman/archer/mana, cast spells, order group moves), then confirm.
3. Spell execution: initiative player's spells, then the other's. Requirements are rechecked; a failure squanders the spell.
4. Movement: two-pass (overstack, then vote/unstack/moonwalk) exactly as in `Pipelines_movement`.
5. Combat: every orthogonally adjacent hostile pair fights once, as in `Pipelines_combat` (10 rounds, round 1 missile-only at -1, bashers pair up, wise targeting, levels and misses).
6. Garbage collection: remove dead minions/groups and expired spells.

**Initiative.** Red starts with it. Each start of turn the player with the better structure delta (+1 per town/colony captured, -1 per lost) takes it; ties keep it.

**Damage.** Takes-Damage and Apply-Damage pipelines as written (before armor, armor soak, after armor, apply), with hand, missile, ignores-armor and magical damage types.

**Recruits.** Swordsman: 1 hand attack, 2 damage, 1 armor. Archer: 1 missile attack, 2 damage, 0 armor. **(decision)** Recruits start with 7 hit points (the original's worked examples assume 7) and level 1 (per `Concepts_armorlevels`). Players start with a group of 4 recruits in the Sanctum.

**Deck and hand.** Hand of 5, discard up to one per turn, refill at turn start. **(decision)** Deck size and duplicate limit are config values, minimum 30 cards, no maximum, max 4 copies of a card (confirmed in `Elements_deckhand.txt`).

**Neutral player.** Owns monsters and neutral groups; computer-controlled groups move by a movement-AI hook on the monster card.

## 3. Architecture

TypeScript monorepo (pnpm workspaces), Vitest for tests, Vite for the web client.

```
sanctum/
  packages/
    engine/     pure game logic, no DOM, no I/O, no Date/Math.random
    cards/      card scripts (one .ts per card) + generated card index
    web/        Vite browser client (hotseat)
  tools/
    scrape/     one-off scraper: playsanctum.net card pages -> card data stubs
  research/     downloaded original rules
  docs/superpowers/specs, plans
```

Dependency direction: `web -> engine <- cards`; `cards` depends on engine types only. The engine never imports card files; the card index is injected at game creation. That is what lets cards be added without touching the engine.

### 3.1 Engine

`createGame(config, cardIndex, seed) -> GameState`. State is plain, serializable data (no class instances, no functions): board, structures, groups, minions, players (mana, deck, hand, discard, initiative), active spells, turn/phase, RNG state, event log.

`submitOrders(state, playerId, orders)` validates and stores one player's orders for the Orders phase (draft state; changeable until confirmed). `confirm(state, playerId)`. When both are confirmed, `resolveTurn(state)` runs phases 3 to 6 and the next start-of-turn, returning the new state and an ordered event log the UI can animate. Orders are plain data so hotseat, a network client and an AI all submit the same thing.

Determinism: all randomness comes from a seeded PRNG stored in state; resolving the same state + orders always gives the same result. Replays and network sync fall out of this.

### 3.2 Event system

Every named rule step is an event (`turn:start`, `move:before`, `move:exit`, `move:enter`, `combat:start`, `round:start`, `attack:beforeArmor`, `attack:hit`, `armor:after`, `minion:dies`, `minion:killed`, `combat:end`, `turn:garbage`, ...; the full list follows the Card Text Phrases table).

Dispatch follows the original bubbling: an event on a minion goes to the minion's active spells, then its square's spells (square spells, structure spells, terrain), then the globe's spells, then halts. Untargeted events go to each player's active spells in order: initiative, non-initiative, neutral. Within a list, oldest first. Handlers receive a mutable-by-request `EventContext` and may cancel, modify or add to the event payload where the pipeline allows (for example, raise incoming damage at `attack:beforeArmor`).

### 3.3 Card script API

A card is one file exporting `defineCard({...})`:

```ts
export default defineCard({
  id: 'example', name: 'Example', house: 'war',
  cost: { strife: 2 },
  type: 'conjuration',        // alteration | conjuration | manifestation | summoning | hero
  target: 'group',            // recruit | monster | minion | recruitGroup | monsterGroup |
                              // group | square | structure | terrain | globe
  canCast:    (ctx, target) => boolean,   // casting-time requirement
  persistent: (ctx, host)   => boolean,   // rechecked; failure dispels
  onCast:     (ctx, target) => void,      // manifestation/summoning effect, or setup
  on: { 'round:start': (ctx, ev) => { ... }, 'minion:dies': (ctx, ev) => { ... } },
  duration: { turns: 3 },     // conjuration expiry
  visible: true,              // enchantment (dispellable) vs hidden helper
  exclusive: true,
})
```

`ctx` is the only way a script touches the game, and it is typed. It provides queries (`ctx.host`, `ctx.owner`, `ctx.minionsOf(group)`, `ctx.square(...)`, `ctx.random()`), and actions (`damage`, `heal`, `modifyStat`, `grantTrait`, `summon`, `dispel`, `draw`, `setTerrain`, `move`, `createSpell` for helper spells, `cancelEvent`). Actions are recorded in the event log and applied by the engine, so scripts never mutate state directly. New events, new `ctx` actions and new card types are additive API changes, which is the extension path for later sets (the community's Allies & Traitors expansion adds seven heroes).

Stats are computed, not stored: a minion's current attack, armor, level and terrainwalks come from base stats plus modifiers contributed by its active spells, so dispelling a spell cleanly removes its effect.

### 3.4 Spell lifecycle

In deck, in hand, targeted (orders phase), executing (check requirements, squander on failure), active (alteration/conjuration only), then expired, dispelled, squandered or host died. Persistent requirements recheck on spell flux, structure flux and minion exchange. Helper spells (engine-cast, hidden, undispellable) implement terrain, monster abilities and nation abilities; they ignore concealment, occupants and blocking.

### 3.5 Web client (hotseat)

Diagonal board rendered with SVG; sidebar for the selected group/structure, hand tray, mana pool, phase/turn bar. Orders UI follows the original: drag novices onto sword/arrow/mana icons, drag groups to adjacent squares (arrow shows the order), drag spells onto targets (illegal targets refuse the drop). After each player confirms, a "pass the device" screen hides their orders. Resolution plays the engine's event log as a simple step-through animation.

The UI only reads engine state and submits orders. No rule logic lives in `web`.

## 4. Card data pipeline

`tools/scrape` fetches the card list pages on playsanctum.net (house, name, cost, type, target, text) into `cards/data/<house>.json`. Each card then gets a hand-written script file in `packages/cards/src/<house>/<name>.ts` whose metadata is validated against the scraped record by a test (so cost/type/target typos fail CI). Card text is stored for display. Art is downloaded for private use, kept out of git, and referenced by id.

M1 houses: **War** (Strife/Clarity) and **Life** (Clarity/World). They share Clarity so mixed decks work, and between them exercise combat modifiers, damage, healing, summoning and persistent enchantments. Remaining houses are added as data plus scripts.

## 5. Testing

- Engine unit tests per pipeline: damage, combat rounds, movement incl. overstack/moonwalk, capture, initiative deltas, mana, squandering.
- Golden scenario tests: scripted board + orders -> expected final state, lifted from the worked examples in the original rules (the Diomesia/Despond example, the Fred armor combo, the moonwalk diagram).
- Per-card tests using a small `scenario()` helper.
- Determinism test: same seed + orders twice gives identical state hash.
- Scraper-vs-script metadata test (section 4).
- Web: a few Playwright smoke tests (start game, issue orders, resolve a turn).

## 6. Risks and open items

- **Scraper reliability.** Card pages are per-card popups; URL pattern and parsing are confirmed in the first plan task. Fallback: manual entry for M1's two houses.
- **Board geometry.** Exact 94-square layout and sprite orientation to confirm from the original map. Isolated behind `BoardLayout`.
- **Rules gaps.** Experience levels, heroes, concealment and boardhopping are specified in the research pages but not in M1; the API keeps room for them.
- **Card text semantics.** Original card texts are natural language and some are ambiguous. Where a card is unclear, it is implemented per the rules pages and flagged with a `// RULING:` comment.
- **Hotseat privacy** is screen-hiding only; the engine already separates public and per-player state so online play can enforce it later.
