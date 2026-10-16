# Hotseat Web Client Implementation Plan (plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A playable same-screen hotseat client for Sanctum: two players, hidden orders with a pass-the-device screen, an SVG board, a hand tray, orders for training/moving/casting, a turn report after each resolution, and a card browser built from the keyword text.

**Architecture:** A new `packages/web` (Vite + Preact + TypeScript). All game logic stays in `engine`; the web package only reads `GameState` and submits `Orders`. A pure, DOM-free `session` module drives the hotseat flow (screens, order drafts, locking, turn report) and is tested headless; Preact components render it. Three small read-only helpers are added to the engine (`viewStats`, `legalTargets`, `checkOrders`) so the UI never re-implements a rule.

**Tech Stack:** TypeScript (strict, ESM), Vite, Preact, Vitest with happy-dom. npm workspaces. Branch `engine-core` (tags `keyword-language` and `creatures` are the starting point).

**User decisions (already made):**
- "Faithful clone", browser, private use only; milestone 1 = engine + hotseat UI (spec `docs/superpowers/specs/2026-10-16-sanctum-remake-design.md`, section 3.5: diagonal SVG board, sidebar, hand tray, mana pool, phase bar, pass-the-device screen).
- "I trust your judgement on rules of play."
- The UI renders card text from keywords (`cardFace`, `keywordGlossary`), decided with the keyword language.

**Plan decisions (mine):**
1. **Preact** (small, signals-free hooks) with plain CSS; no router, no state library. The card browser is a tab inside the app.
2. **Click-first orders.** The spec describes drag and drop; this plan ships click interactions (select a group, click a neighbouring square; arm a card, click a target; click a training button). Drag and drop is a later enhancement because it only changes the input layer, not the session logic.
3. **No rules in the UI.** Legal moves, legal spell targets, affordability and every error message come from the engine (`checkOrders`, `legalTargets`, `validateOrders` text).
4. **Turn report, not frame animation.** The engine log is sparse (it does not log moves or damage), so the report is computed by diffing the state before and after resolution (`turnReport`), plus the engine log for casts, squanders, combats, deaths and captures. A step-through animation can be built on the same report later.
5. **Starter decks** are generated from the implemented cards of a house (copies by rarity), so any new card appears in games automatically.
6. **Hotseat privacy is screen-hiding only**: orders are drafted in component state and written to the game state only when locked.
7. Card art is private-use material kept out of git (`research/cards-raw/art/`); the UI does not ship it. Minions show their nation and class as text and a colour token.

**Starting state:** engine 165 tests, cards 304, scrape 6; 102 cards scraped, 78 implemented.

---

## File structure

- Engine: create `packages/engine/src/view.ts`, `packages/engine/test/view.test.ts`; modify `packages/engine/src/index.ts`.
- Cards: create `packages/cards/src/decks.ts`, `packages/cards/test/decks.test.ts`; modify `packages/cards/src/index.ts`.
- Web (all new): `packages/web/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,index.html}`, `src/{main.tsx,app.tsx,styles.css}`, `src/model/{drafts,session,report,geometry}.ts`, `src/ui/{Board,Sidebar,HandTray,OrdersScreen,Screens,CardBrowser,format}.tsx`, tests under `test/`. Also `.claude/launch.json` (dev server entry for the preview tool).

---

### Task 0: Read-only engine helpers for the UI

**Goal:** `viewStats`, `legalTargets` and `checkOrders` exported from the engine.

**Files:**
- Create: `packages/engine/src/view.ts`, `packages/engine/test/view.test.ts`
- Modify: `packages/engine/src/index.ts`

**Acceptance Criteria:**
- [ ] `viewStats(state, cards, minionId)` returns the minion's computed stats (spells and auras included) without mutating `state`
- [ ] `legalTargets(state, cards, side, cardId)` returns every `Ref` the card can legally target right now (same rule as ordering), for every target type
- [ ] `checkOrders(state, cards, side, orders)` returns the engine's error text or `null`, without mutating `state`
- [ ] None of the three changes the passed state (structural equality before and after)

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/engine/test/view.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defineCard, indexCards } from '../src/cards';
import { createGame } from '../src/api';
import { emptyOrders } from '../src/types';
import { checkOrders, legalTargets, viewStats } from '../src/view';

const globeCard = defineCard({ id: 'g', name: 'g', house: 'war', cost: { strife: 1 }, type: 'manifestation', target: 'globe' });
const squareCard = defineCard({ id: 's', name: 's', house: 'war', cost: {}, type: 'manifestation', target: 'square' });
const recruitCard = defineCard({ id: 'r', name: 'r', house: 'war', cost: {}, type: 'alteration', target: 'recruit' });
const groupCard = defineCard({ id: 'gr', name: 'gr', house: 'war', cost: {}, type: 'alteration', target: 'recruitGroup' });
const cards = indexCards([globeCard, squareCard, recruitCard, groupCard]);
const game = () =>
  createGame(
    { seed: 3, decks: { red: { house: 'war', cards: [] }, blue: { house: 'war', cards: [] } },
      options: { towns: 0, flatTerrain: true, skipDeckRules: true } },
    cards,
  );

describe('engine view helpers', () => {
  it('viewStats reads computed stats and leaves the state alone', () => {
    const s = game();
    const before = JSON.stringify(s);
    const m = Object.values(s.minions).find((x) => x.owner === 'red' && x.cls === 'swordsman')!;
    expect(viewStats(s, cards, m.id)).toMatchObject({ hand: 2, armor: 1, maxHp: 7 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('legalTargets lists targets per target type', () => {
    const s = game();
    expect(legalTargets(s, cards, 'red', 'g')).toEqual([{ kind: 'globe' }]);
    const squares = legalTargets(s, cards, 'red', 's');
    expect(squares.length).toBeGreaterThan(60);
    expect(squares.every((r) => r.kind === 'square')).toBe(true);
    expect(legalTargets(s, cards, 'red', 'r').length).toBe(8); // both starting groups' recruits
    const groups = legalTargets(s, cards, 'red', 'gr');
    expect(groups.map((r) => r.kind)).toEqual(['group', 'group']);
    expect(legalTargets(s, cards, 'red', 'nope')).toEqual([]);
  });

  it('checkOrders returns the engine error text or null', () => {
    const s = game();
    expect(checkOrders(s, cards, 'red', emptyOrders())).toBeNull();
    const bad = { ...emptyOrders(), cast: [{ handIndex: 0, target: { kind: 'globe' as const } }] };
    expect(checkOrders(s, cards, 'red', bad)).toMatch(/invalid hand index/);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`view` module missing)

- [ ] **Step 3: Write `packages/engine/src/view.ts`**

```ts
import { parseKey } from './board';
import type { CardIndex } from './cards';
import { makeEngine } from './engine';
import { validateOrders } from './orders';
import { castCheck } from './spells';
import { computeStats, type Stats } from './stats';
import type { GameState, Orders, Ref, Side } from './types';

/*
 * Read-only views for clients. Each call works on a private copy of the state (`makeEngine` clones it), so the
 * state a client holds is never touched.
 */

/** A minion's stats right now: base values plus every spell and aura that reaches it. */
export function viewStats(state: GameState, cards: CardIndex, minionId: number): Stats {
  return computeStats(makeEngine(state, cards), minionId);
}

/** Every target `cardId` could legally be cast on by `side` right now (type, concealment, occupancy, its own rules). */
export function legalTargets(state: GameState, cards: CardIndex, side: Side, cardId: string): Ref[] {
  const card = cards[cardId];
  if (!card) return [];
  const e = makeEngine(state, cards);
  const out: Ref[] = [];
  const consider = (r: Ref) => {
    if (castCheck(e, side, card, r)) out.push(r);
  };
  const ids = (m: Record<number, unknown>) => Object.keys(m).map(Number);
  switch (card.target) {
    case 'globe':
      consider({ kind: 'globe' });
      break;
    case 'square':
      for (const k of state.cells) consider({ kind: 'square', pos: parseKey(k) });
      break;
    case 'structure':
      for (const id of ids(state.structures)) consider({ kind: 'structure', id });
      break;
    case 'recruit':
    case 'monster':
    case 'minion':
      for (const id of ids(state.minions)) consider({ kind: 'minion', id });
      break;
    default:
      for (const id of ids(state.groups)) consider({ kind: 'group', id });
  }
  return out;
}

/** The engine's verdict on a draft of orders: its error message, or null when the orders are legal. */
export function checkOrders(state: GameState, cards: CardIndex, side: Side, orders: Orders): string | null {
  return validateOrders(makeEngine(state, cards), side, orders);
}
```
`packages/engine/src/index.ts`: add `export { viewStats, legalTargets, checkOrders } from './view';`.

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. (If a count in the test is off for an explainable reason, e.g. the starting groups, fix the test and report it.)
```bash
git add -A
git commit -m "feat(engine): read-only view helpers for clients (viewStats, legalTargets, checkOrders)"
```

---

### Task 1: Starter decks

**Goal:** `starterDeck(house)` builds a legal deck from the implemented cards of War or Life.

**Files:**
- Create: `packages/cards/src/decks.ts`, `packages/cards/test/decks.test.ts`
- Modify: `packages/cards/src/index.ts`

**Acceptance Criteria:**
- [ ] `starterDeck('war')` and `starterDeck('life')` pass `validateDeck` against `cardIndex`
- [ ] Copies by rarity: Common 3, Uncommon 2, Rare 1, Very Rare 1; helper cards never appear; only that house's cards appear
- [ ] Deterministic: the same call returns the same list

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/cards/test/decks.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validateDeck } from '@sanctum/engine';
import { cardIndex, starterDeck } from '../src/index';

describe('starterDeck', () => {
  for (const house of ['war', 'life'] as const) {
    it(`${house} is a legal, deterministic deck of its own cards`, () => {
      const deck = starterDeck(house);
      expect(deck.house).toBe(house);
      expect(validateDeck(deck, cardIndex)).toBeNull();
      expect(deck.cards.length).toBeGreaterThanOrEqual(30);
      for (const id of deck.cards) {
        expect(cardIndex[id].house).toBe(house);
        expect(cardIndex[id].helper).toBeFalsy();
      }
      expect(starterDeck(house)).toEqual(deck);
    });
  }
  it('copies follow rarity', () => {
    const war = starterDeck('war').cards;
    const count = (id: string) => war.filter((x) => x === id).length;
    expect(count('ngozi')).toBe(1); // Rare
  });
});
```

- [ ] **Step 2: Write `packages/cards/src/decks.ts`**

```ts
import type { DeckConfig } from '@sanctum/engine';
import { cardData, cardIndex } from './index';

const COPIES: Record<string, number> = { Common: 3, Uncommon: 2, Rare: 1, 'Very Rare': 1 };

/** A ready-made deck of every implemented, playable card of a house, with copies by rarity. */
export function starterDeck(house: 'war' | 'life'): DeckConfig {
  const cards: string[] = [];
  for (const d of cardData) {
    const def = cardIndex[d.slug];
    if (d.house !== house || !def || def.helper) continue;
    for (let i = 0; i < (COPIES[d.rarity] ?? 1); i++) cards.push(d.slug);
  }
  return { house, cards };
}
```
`src/index.ts`: add `export { starterDeck } from './decks';` (decks.ts imports from './index', so put the export line at the end of `index.ts`; a circular import resolves because `starterDeck` only reads `cardData`/`cardIndex` when called).

- [ ] **Step 3: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. If the circular import misbehaves (undefined `cardIndex` at call time), move `cardData`/`cardIndex` into a `registry.ts` that both `index.ts` and `decks.ts` import, and report it.
```bash
git add -A
git commit -m "feat(cards): starter decks by house"
```

---

### Task 2: Scaffold `packages/web`

**Goal:** A Vite + Preact app that renders a placeholder, builds, typechecks, tests under happy-dom, and starts in the preview tool.

**Files:**
- Create: `packages/web/{package.json,tsconfig.json,vite.config.ts,vitest.config.ts,index.html}`, `packages/web/src/{main.tsx,app.tsx,styles.css}`, `packages/web/test/smoke.test.tsx`, `.claude/launch.json`
- Modify: root `package.json` (nothing if `packages/*` already covers it)

**Acceptance Criteria:**
- [ ] `npm install` at the root links the new workspace; `npm run build -w @sanctum/web` produces `dist/`
- [ ] The app imports `@sanctum/engine` and `@sanctum/cards` and shows the card count from `cardIndex` on its placeholder screen
- [ ] `npm test` runs the web smoke test under happy-dom; `npm run typecheck` covers the web package
- [ ] `preview_start` with name `web` serves the app on port 5173

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm install && npm test && npm run typecheck && npm run build -w @sanctum/web` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing smoke test**

`packages/web/test/smoke.test.tsx`:
```tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';

describe('app', () => {
  it('renders the title and the number of implemented cards', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /sanctum/i })).toBeTruthy();
    expect(screen.getByText(/78 cards/)).toBeTruthy();
  });
});
```
(78 is the playable count; if `playableCards.length` differs when this plan runs, use the real number.)

- [ ] **Step 2: Create the package files**

`packages/web/package.json`:
```json
{
  "name": "@sanctum/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vite build",
    "test": "vitest run",
    "typecheck": "tsc -p . --noEmit"
  },
  "dependencies": {
    "@sanctum/cards": "*",
    "@sanctum/engine": "*",
    "preact": "^10.0.0"
  },
  "devDependencies": {
    "@preact/preset-vite": "^2.0.0",
    "@testing-library/preact": "^3.0.0",
    "happy-dom": "^20.0.0",
    "vite": "^7.0.0"
  }
}
```
(Use the newest versions that npm resolves for these ranges; if `npm install` reports a peer conflict between `preact`, `@preact/preset-vite` and `@testing-library/preact`, pick the newest set that agrees and say which.)

`packages/web/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "jsx": "react-jsx", "jsxImportSource": "preact", "resolveJsonModule": true, "types": ["vite/client"] },
  "include": ["src", "test", "vite.config.ts", "vitest.config.ts"]
}
```
`packages/web/vite.config.ts`:
```ts
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({ plugins: [preact()], server: { port: 5173, strictPort: true } });
```
`packages/web/vitest.config.ts`:
```ts
import preact from '@preact/preset-vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({ plugins: [preact()], test: { environment: 'happy-dom', include: ['test/**/*.test.{ts,tsx}'] } });
```
`packages/web/index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sanctum</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Source+Sans+3:wght@400;600&display=swap" />
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```
`packages/web/src/main.tsx`:
```tsx
import { render } from 'preact';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);
```
`packages/web/src/app.tsx`:
```tsx
import { playableCards } from '@sanctum/cards';

export function App() {
  return (
    <main class="shell">
      <h1>Sanctum</h1>
      <p>{playableCards.length} cards ready to play.</p>
    </main>
  );
}
```
`packages/web/src/styles.css` (the palette and fonts every later task uses; single dark look by choice):
```css
:root {
  --bg: #11171d;
  --panel: #19222b;
  --panel-2: #212d38;
  --line: #2e3c49;
  --fg: #e4eaf0;
  --muted: #8d9cab;
  --accent: #5fb6c6;
  --red: #d2573f;
  --blue: #4a86d6;
  --good: #6cc48a;
  --bad: #e0705a;
  --font-display: "Barlow Condensed", "Arial Narrow", sans-serif;
  --font-body: "Source Sans 3", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body, #app { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 15px/1.45 var(--font-body); }
button { font: inherit; color: inherit; cursor: pointer; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
h1, h2, h3 { font-family: var(--font-display); letter-spacing: .02em; margin: 0; }
.shell { max-width: 960px; margin: 0 auto; padding: 24px 16px; }
```
`.claude/launch.json`:
```json
{
  "version": "0.0.1",
  "configurations": [
    { "name": "web", "runtimeExecutable": "npm", "runtimeArgs": ["run", "dev", "-w", "@sanctum/web"], "port": 5173 }
  ]
}
```

- [ ] **Step 3: Install, run and verify**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm install && npm test && npm run typecheck && npm run build -w @sanctum/web`
Expected: all pass and `packages/web/dist` exists (it is gitignored by `dist/`). Then `preview_start` `{name: "web"}`, read the page and confirm the heading and "78 cards ready to play." (use the real count).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(web): scaffold the Vite + Preact client"
```

---

### Task 3: Session model (drafts, hotseat flow, turn report)

**Goal:** Everything the UI does to the game, as pure functions: edit a draft, lock orders, hand the device over, resolve, report, choose mana.

**Files:**
- Create: `packages/web/src/model/{drafts,report,session}.ts`, `packages/web/test/{drafts,session,report}.test.ts`

**Acceptance Criteria:**
- [ ] Draft helpers edit an `Orders` value immutably: one move order per group, training slots, casts replacing the same hand index, one discard
- [ ] `poolPreview` returns the mana pool after planned mana training and spell costs, and whether any type went negative
- [ ] `newSession` creates a game from two houses and a seed and starts on the hand-off screen for red
- [ ] The flow is: handoff(red) -> orders(red) -> handoff(blue) -> orders(blue) -> report -> (mana choice if a captured structure needs one) -> handoff(red) ... ; locking invalid orders returns the engine's error and changes nothing; a Sanctum capture ends on the `over` screen
- [ ] `turnReport(before, after, cards)` lists spells, movement, combats, casualties, new units, captures and terrain changes in readable lines

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`packages/web/test/drafts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emptyOrders } from '@sanctum/engine';
import { addCast, addTrain, removeCast, removeTrain, setDiscard, setMove, poolPreview } from '../src/model/drafts';

describe('draft helpers', () => {
  it('keeps one move order per group and clears it with null', () => {
    let o = setMove(emptyOrders(), 4, 'e');
    o = setMove(o, 4, 'n');
    o = setMove(o, 5, 's');
    expect(o.move).toEqual([{ groupId: 4, dir: 'n' }, { groupId: 5, dir: 's' }]);
    expect(setMove(o, 4, null).move).toEqual([{ groupId: 5, dir: 's' }]);
  });

  it('adds and removes training and casts, one cast per hand slot', () => {
    let o = addTrain(emptyOrders(), 9, 'swordsman');
    o = addTrain(o, 9, 'clarity');
    expect(o.train).toHaveLength(2);
    expect(removeTrain(o, 0).train).toEqual([{ structureId: 9, as: 'clarity' }]);
    o = addCast(o, 2, { kind: 'globe' });
    o = addCast(o, 2, { kind: 'square', pos: { x: 3, y: 3 } });
    expect(o.cast).toEqual([{ handIndex: 2, target: { kind: 'square', pos: { x: 3, y: 3 } } }]);
    expect(removeCast(o, 2).cast).toEqual([]);
    expect(setDiscard(o, 1).discard).toBe(1);
    expect(setDiscard(setDiscard(o, 1), null).discard).toBeNull();
  });

  it('previews the mana pool after mana training and spell costs', () => {
    const base = { clarity: 1, mystery: 0, order: 0, strife: 2, will: 0, world: 0 };
    const hand = ['a', 'b'];
    const cards = { a: { cost: { strife: 2 } }, b: { cost: { clarity: 2 } } } as never;
    let o = addCast(emptyOrders(), 0, { kind: 'globe' });
    expect(poolPreview(base, hand, cards, o)).toEqual({ pool: { ...base, strife: 0 }, over: false });
    o = addCast(o, 1, { kind: 'globe' });
    expect(poolPreview(base, hand, cards, o).over).toBe(true);
    o = addTrain(o, 1, 'clarity');
    expect(poolPreview(base, hand, cards, o)).toEqual({ pool: { ...base, strife: 0, clarity: 0 }, over: false });
  });
});
```
`packages/web/test/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { emptyOrders, type GameState, type Orders } from '@sanctum/engine';
import { afterReport, begin, lock, newSession, pickMana } from '../src/model/session';
import { addTrain, setMove } from '../src/model/drafts';

const redGroup = (s: GameState) => Object.values(s.groups).find((g) => g.owner === 'red')!;

describe('hotseat session', () => {
  it('starts on the hand-off screen for red', () => {
    const s = newSession(7, { red: 'war', blue: 'life' });
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
    expect(Object.values(s.state.players.red.hand)).toHaveLength(5);
  });

  it('walks a full turn: red locks, blue locks, the turn resolves and a report appears', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    s = begin(s, 'red');
    expect(s.screen).toEqual({ kind: 'orders', side: 'red' });
    const move: Orders = setMove(emptyOrders(), redGroup(s.state).id, 'e');
    const r1 = lock(s, 'red', move);
    expect(r1.ok).toBe(true);
    if (!r1.ok) return;
    s = r1.session;
    expect(s.screen).toEqual({ kind: 'handoff', to: 'blue' });
    s = begin(s, 'blue');
    const r2 = lock(s, 'blue', emptyOrders());
    expect(r2.ok).toBe(true);
    if (!r2.ok) return;
    s = r2.session;
    expect(s.screen.kind).toBe('report');
    expect(s.state.turn).toBe(2);
    expect(s.report?.sections.some((x) => x.title === 'Movement')).toBe(true);
    s = afterReport(s);
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
  });

  it('refuses illegal orders and leaves the session unchanged', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    s = begin(s, 'red');
    const bad = addTrain(emptyOrders(), 999, 'swordsman');
    const r = lock(s, 'red', bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/cannot train/);
    expect(s.screen).toEqual({ kind: 'orders', side: 'red' });
  });

  it('asks the owner of a captured structure for a mana type', () => {
    let s = newSession(7, { red: 'war', blue: 'war' });
    const town = Object.values(s.state.structures).find((x) => x.kind === 'town')!;
    // park a red group on a neutral town so it is captured at the next start of turn
    const g = redGroup(s.state);
    g.pos = { ...town.pos };
    s = begin(s, 'red');
    let r = lock(s, 'red', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = begin(r.session, 'blue');
    r = lock(s, 'blue', emptyOrders());
    if (!r.ok) throw new Error(r.error);
    s = afterReport(r.session);
    expect(s.screen).toEqual({ kind: 'mana', side: 'red' });
    s = pickMana(s, 'red', town.id, 'strife');
    expect(s.screen).toEqual({ kind: 'handoff', to: 'red' });
    expect(s.state.structures[town.id].manaType).toBe('strife');
  });
});
```
`packages/web/test/report.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cardIndex } from '@sanctum/cards';
import { confirmOrders, createGame, emptyOrders, submitOrders } from '@sanctum/engine';
import { starterDeck } from '@sanctum/cards';
import { turnReport } from '../src/model/report';

describe('turnReport', () => {
  it('reports movement and new units after a resolved turn', () => {
    const before = createGame({ seed: 5, decks: { red: starterDeck('war'), blue: starterDeck('war') } }, cardIndex);
    const g = Object.values(before.groups).find((x) => x.owner === 'red')!;
    const sanctum = Object.values(before.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    const orders = { ...emptyOrders(), move: [{ groupId: g.id, dir: 'e' as const }], train: [{ structureId: sanctum.id, as: 'archer' as const }] };
    const a = submitOrders(before, cardIndex, 'red', orders);
    if (!a.ok) throw new Error(a.error);
    const b = confirmOrders(a.state, cardIndex, 'red');
    if (!b.ok) throw new Error(b.error);
    const c = confirmOrders(b.state, cardIndex, 'blue');
    if (!c.ok) throw new Error(c.error);
    const report = turnReport(b.state, c.state, cardIndex);
    const text = report.sections.flatMap((x) => x.lines).join('\n');
    expect(report.turn).toBe(1);
    expect(text).toMatch(/Red group .* moved/);
    expect(text).toMatch(/archer/i);
    expect(report.moves.length).toBeGreaterThan(0);
  });
});
```
(`submitOrders(before,...)` requires the orders phase; `createGame` starts in the orders phase when no capture needs a mana choice, which is the case at game start. The group moving east from the Sanctum may be blocked by terrain; if the move is rejected, try another direction or use a flat-terrain game and say so.)

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: `packages/web/src/model/drafts.ts`**

```ts
import { MANA_TYPES, type CardIndex, type Dir, type Mana, type ManaPool, type Orders, type Ref, type TrainOrder } from '@sanctum/engine';

/** Orders are plain data; every helper returns a new value. */
export const setMove = (o: Orders, groupId: number, dir: Dir | null): Orders => ({
  ...o,
  move: [...o.move.filter((m) => m.groupId !== groupId), ...(dir ? [{ groupId, dir }] : [])],
});

export const addTrain = (o: Orders, structureId: number, as: TrainOrder['as']): Orders => ({
  ...o,
  train: [...o.train, { structureId, as }],
});

export const removeTrain = (o: Orders, index: number): Orders => ({ ...o, train: o.train.filter((_, i) => i !== index) });

/** One cast per hand slot: casting the same slot again replaces its target. */
export const addCast = (o: Orders, handIndex: number, target: Ref): Orders => ({
  ...o,
  cast: [...o.cast.filter((c) => c.handIndex !== handIndex), { handIndex, target }],
});

export const removeCast = (o: Orders, handIndex: number): Orders => ({ ...o, cast: o.cast.filter((c) => c.handIndex !== handIndex) });

export const setDiscard = (o: Orders, handIndex: number | null): Orders => ({ ...o, discard: handIndex });

/** The mana pool after the planned mana training and spell costs; `over` is true when any type is negative. */
export function poolPreview(
  base: ManaPool, hand: string[], cards: CardIndex, o: Orders,
): { pool: ManaPool; over: boolean } {
  const pool = { ...base };
  for (const t of o.train) if ((MANA_TYPES as string[]).includes(t.as)) pool[t.as as Mana] += 1;
  for (const c of o.cast) {
    const card = cards[hand[c.handIndex]];
    if (!card) continue;
    for (const [m, n] of Object.entries(card.cost) as Array<[Mana, number]>) pool[m] -= n;
  }
  return { pool, over: MANA_TYPES.some((m) => pool[m] < 0) };
}
```

- [ ] **Step 4: `packages/web/src/model/report.ts`**

```ts
import { key, type CardIndex, type GameState, type Minion, type PlayerId, type Pos, type Ref } from '@sanctum/engine';

export interface Report {
  turn: number;
  sections: Array<{ title: string; lines: string[] }>;
  /** Group movements, for drawing arrows on the board. */
  moves: Array<{ groupId: number; owner: PlayerId; from: Pos; to: Pos }>;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const side = (o: PlayerId) => cap(o);
const at = (p: Pos) => `(${p.x + 1},${p.y + 1})`;

function minionLabel(m: Minion): string {
  const bits = [m.nation ? cap(m.nation) : '', m.name];
  return bits.filter(Boolean).join(' ');
}

export function refLabel(r: Ref, s: GameState): string {
  switch (r.kind) {
    case 'globe': return 'the globe';
    case 'square': return `square ${at(r.pos)}`;
    case 'structure': return `the ${s.structures[r.id]?.kind ?? 'structure'} at ${s.structures[r.id] ? at(s.structures[r.id].pos) : '?'}`;
    case 'group': {
      const g = s.groups[r.id];
      return g ? `${side(g.owner)} group${g.pos ? ` at ${at(g.pos)}` : ''}` : 'a group';
    }
    case 'minion': {
      const m = s.minions[r.id];
      return m ? `${side(m.owner)} ${minionLabel(m)}` : 'a minion';
    }
  }
}

/** What happened between two states: the engine log for spells and fights, a state diff for everything else. */
export function turnReport(before: GameState, after: GameState, cards: CardIndex): Report {
  const spells: string[] = [];
  const combats: string[] = [];
  const captures: string[] = [];
  for (const e of after.log as Array<Record<string, any>>) {
    if (e.type === 'cast') spells.push(`${side(e.caster)} cast ${cards[e.card]?.name ?? e.card} on ${refLabel(e.target, before)}.`);
    else if (e.type === 'squander') spells.push(`${side(e.caster)}'s ${cards[e.card]?.name ?? e.card} fizzled (${e.why}).`);
    else if (e.type === 'dispel') spells.push(`${cards[e.card]?.name ?? e.card} was dispelled.`);
    else if (e.type === 'combat') {
      const hi = before.groups[e.hi] ?? after.groups[e.hi];
      const lo = before.groups[e.lo] ?? after.groups[e.lo];
      if (hi && lo) combats.push(`${side(hi.owner)} group fought ${side(lo.owner)} group at ${hi.pos ? at(hi.pos) : '?'}.`);
    } else if (e.type === 'capture') {
      const st = after.structures[e.structure];
      captures.push(`${side(e.by)} captured the ${st?.kind ?? 'structure'}${st ? ` at ${at(st.pos)}` : ''}.`);
    } else if (e.type === 'win') captures.push(`${side(e.winner)} captured the enemy Sanctum and wins!`);
  }

  const moves: Report['moves'] = [];
  const movement: string[] = [];
  for (const g of Object.values(before.groups)) {
    const now = after.groups[g.id];
    if (!now?.pos || !g.pos) continue;
    if (key(g.pos) !== key(now.pos)) {
      moves.push({ groupId: g.id, owner: g.owner, from: g.pos, to: now.pos });
      movement.push(`${side(g.owner)} group (${now.minionIds.length}) moved ${at(g.pos)} to ${at(now.pos)}.`);
    }
  }

  const casualties: string[] = [];
  const hurt: string[] = [];
  for (const m of Object.values(before.minions)) {
    if (m.status === 'dead') continue;
    const now = after.minions[m.id];
    if (!now || now.status === 'dead') casualties.push(`${side(m.owner)} ${minionLabel(m)} died.`);
    else if (now.hp < m.hp) hurt.push(`${side(m.owner)} ${minionLabel(m)} lost ${m.hp - now.hp} hp (${now.hp}/${now.maxHp}).`);
    else if (now.hp > m.hp) hurt.push(`${side(m.owner)} ${minionLabel(m)} healed ${now.hp - m.hp} hp.`);
  }

  const created: string[] = [];
  for (const m of Object.values(after.minions)) {
    if (before.minions[m.id] || m.status === 'dead') continue;
    const g = after.groups[m.groupId];
    created.push(`${side(m.owner)} ${minionLabel(m)} appeared${g?.pos ? ` at ${at(g.pos)}` : ''}.`);
  }

  const terrain: string[] = [];
  for (const k of Object.keys(after.terrain)) {
    if (before.terrain[k] !== after.terrain[k]) {
      const [x, y] = k.split(',').map(Number);
      terrain.push(`Square ${at({ x, y })} became ${after.terrain[k]}.`);
    }
  }

  const sections = [
    { title: 'Spells', lines: spells },
    { title: 'Movement', lines: movement },
    { title: 'Combat', lines: combats },
    { title: 'Health', lines: hurt },
    { title: 'Casualties', lines: casualties },
    { title: 'New units', lines: created },
    { title: 'Terrain', lines: terrain },
    { title: 'Structures', lines: captures },
  ].filter((s) => s.lines.length > 0);
  return { turn: before.turn, sections, moves };
}
```

- [ ] **Step 5: `packages/web/src/model/session.ts`**

```ts
import { cardIndex, starterDeck } from '@sanctum/cards';
import {
  chooseMana, checkOrders, confirmOrders, createGame, emptyOrders, submitOrders,
  type CardIndex, type GameState, type HouseId, type Mana, type Orders, type Side,
} from '@sanctum/engine';
import { turnReport, type Report } from './report';

export type Screen =
  | { kind: 'handoff'; to: Side }
  | { kind: 'orders'; side: Side }
  | { kind: 'mana'; side: Side }
  | { kind: 'report' }
  | { kind: 'over' };

export interface Session {
  cards: CardIndex;
  state: GameState;
  screen: Screen;
  report: Report | null;
}

export type LockResult = { ok: true; session: Session } | { ok: false; error: string };

/** Where the game goes next: over, a mana choice for a captured structure, or the next hand-off to red. */
function route(cards: CardIndex, state: GameState, report: Report | null): Session {
  if (state.phase === 'over') return { cards, state, screen: { kind: 'over' }, report };
  if (state.phase === 'choose-mana') {
    const st = state.structures[state.pendingMana[0]];
    return { cards, state, screen: { kind: 'mana', side: st.owner as Side }, report };
  }
  return { cards, state, screen: { kind: 'handoff', to: 'red' }, report };
}

export function newSession(seed: number, houses: Record<Side, HouseId>, cards: CardIndex = cardIndex): Session {
  const decks = { red: starterDeck(houses.red as 'war' | 'life'), blue: starterDeck(houses.blue as 'war' | 'life') };
  return route(cards, createGame({ seed, decks }, cards), null);
}

/** The next player is ready (the device has been handed over): show their orders screen. */
export function begin(s: Session, side: Side): Session {
  return { ...s, screen: { kind: 'orders', side } };
}

/**
 * Lock a player's orders. Red's go to a hand-off to blue; blue's lock resolves the turn and produces a report.
 * Invalid orders return the engine's message and change nothing.
 */
export function lock(s: Session, side: Side, orders: Orders): LockResult {
  const err = checkOrders(s.state, s.cards, side, orders);
  if (err) return { ok: false, error: err };
  const sub = submitOrders(s.state, s.cards, side, orders);
  if (!sub.ok) return { ok: false, error: sub.error };
  const conf = confirmOrders(sub.state, s.cards, side);
  if (!conf.ok) return { ok: false, error: conf.error };
  if (side === 'red') return { ok: true, session: { ...s, state: conf.state, screen: { kind: 'handoff', to: 'blue' } } };
  const report = turnReport(sub.state, conf.state, s.cards);
  return { ok: true, session: { ...s, state: conf.state, report, screen: { kind: 'report' } } };
}

/** The report has been read: go on to a mana choice, the end screen, or the next turn. */
export function afterReport(s: Session): Session {
  return route(s.cards, s.state, s.report);
}

/** A captured structure's owner picks its mana type. */
export function pickMana(s: Session, side: Side, structureId: number, mana: Mana): Session {
  const r = chooseMana(s.state, s.cards, side, structureId, mana);
  if (!r.ok) throw new Error(r.error);
  return route(s.cards, r.state, s.report);
}

export { emptyOrders };
```

- [ ] **Step 6: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. Plan numbers (hand size 5, ordering of `setMove` results, captures at the next start of turn) were derived by reading the engine; if one is off for an explainable reason, fix the test and report it. Fix real defects in the model code.
```bash
git add -A
git commit -m "feat(web): session model (drafts, hotseat flow, turn report)"
```

---

### Task 4: Board geometry and the SVG board

**Goal:** A diagonal SVG board that shows terrain, structures and groups, highlights squares, draws arrows, and reports clicks.

**Files:**
- Create: `packages/web/src/model/geometry.ts`, `packages/web/src/ui/Board.tsx`, `packages/web/test/{geometry,board}.test.tsx`
- Modify: `packages/web/src/styles.css`

**Acceptance Criteria:**
- [ ] `project` maps a board square to the diamond layout (red Sanctum near the top, blue near the bottom); `dirBetween` returns the direction between orthogonal neighbours
- [ ] `Board` draws one polygon per board square (94), a marker per structure, a token per on-board group (owner colour, minion count, monster shape), and an arrow per `arrows` entry
- [ ] Clicking a square calls `onCell(pos)`; selected and highlighted squares get their own CSS classes
- [ ] Terrain has a distinct fill per terrain id

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`packages/web/test/geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SANCTUM_POS } from '@sanctum/engine';
import { dirBetween, project } from '../src/model/geometry';

describe('geometry', () => {
  it('projects the board onto a diamond with the Sancta at top and bottom', () => {
    const red = project(SANCTUM_POS.red);
    const blue = project(SANCTUM_POS.blue);
    expect(red.x).toBe(0);
    expect(blue.x).toBe(0);
    expect(red.y).toBeLessThan(blue.y);
    expect(project({ x: 5, y: 4 }).x).toBeGreaterThan(project({ x: 4, y: 5 }).x);
  });
  it('finds the direction between orthogonal neighbours', () => {
    expect(dirBetween({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe('e');
    expect(dirBetween({ x: 3, y: 3 }, { x: 3, y: 2 })).toBe('n');
    expect(dirBetween({ x: 3, y: 3 }, { x: 4, y: 4 })).toBeNull();
  });
});
```
`packages/web/test/board.test.tsx`:
```tsx
import { fireEvent, render } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import { Board } from '../src/ui/Board';
import { newSession } from '../src/model/session';

describe('Board', () => {
  const s = newSession(7, { red: 'war', blue: 'life' });

  it('draws every square, structure and group', () => {
    const { container } = render(<Board state={s.state} selected={null} highlights={new Set()} arrows={[]} onCell={() => {}} />);
    expect(container.querySelectorAll('polygon.tile')).toHaveLength(94);
    expect(container.querySelectorAll('.structure').length).toBe(Object.keys(s.state.structures).length);
    expect(container.querySelectorAll('.group-token').length).toBe(Object.values(s.state.groups).filter((g) => g.pos).length);
  });

  it('reports clicks, selection and highlights', () => {
    const onCell = vi.fn();
    const { container } = render(
      <Board state={s.state} selected={{ kind: 'square', pos: { x: 4, y: 4 } }} highlights={new Set(['5,4'])} arrows={[]} onCell={onCell} />,
    );
    const tile = container.querySelector('polygon[data-cell="5,4"]')!;
    expect(tile.getAttribute('class')).toContain('hl');
    expect(container.querySelector('polygon[data-cell="4,4"]')!.getAttribute('class')).toContain('selected');
    fireEvent.click(tile);
    expect(onCell).toHaveBeenCalledWith({ x: 5, y: 4 });
  });

  it('draws arrows', () => {
    const { container } = render(
      <Board state={s.state} selected={null} highlights={new Set()} arrows={[{ from: { x: 2, y: 2 }, to: { x: 3, y: 2 }, owner: 'red' }]} onCell={() => {}} />,
    );
    expect(container.querySelectorAll('line.arrow')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: `packages/web/src/model/geometry.ts`**

```ts
import { DIR_LIST, step, type Dir, type Pos, type TerrainId } from '@sanctum/engine';

export const TILE_W = 80;
export const TILE_H = 40;
/** The SVG viewBox that frames the whole diamond. */
export const VIEW = { x: -400, y: -30, w: 800, h: 400 };

/** Centre of a square on the diamond: x grows to the right-down, y to the left-down. */
export const project = (p: Pos): { x: number; y: number } => ({ x: ((p.x - p.y) * TILE_W) / 2, y: ((p.x + p.y) * TILE_H) / 2 });

export function diamondPoints(p: Pos, shrink = 0): string {
  const c = project(p);
  const w = TILE_W / 2 - shrink;
  const h = TILE_H / 2 - shrink / 2;
  return `${c.x},${c.y - h} ${c.x + w},${c.y} ${c.x},${c.y + h} ${c.x - w},${c.y}`;
}

export function dirBetween(from: Pos, to: Pos): Dir | null {
  for (const d of DIR_LIST) {
    const n = step(from, d);
    if (n.x === to.x && n.y === to.y) return d;
  }
  return null;
}

export const TERRAIN_FILL: Record<TerrainId, string> = {
  plains: '#46613f', barren: '#625a4b', forest: '#1f4d38', ice: '#7ba3b2', mountain: '#6b6b76',
  swamp: '#44513f', desert: '#92804a', lava: '#a0401f', volcano: '#7b2a18', water: '#2b5d8f', void: '#08090d',
};
```

- [ ] **Step 4: `packages/web/src/ui/Board.tsx`**

```tsx
import type { GameState, PlayerId, Pos, Ref } from '@sanctum/engine';
import { diamondPoints, project, TERRAIN_FILL, VIEW } from '../model/geometry';

export interface Arrow {
  from: Pos;
  to: Pos;
  owner: PlayerId;
}

export interface BoardProps {
  state: GameState;
  selected: Ref | null;
  /** Cell keys ("x,y") drawn as legal targets or moves. */
  highlights: Set<string>;
  arrows: Arrow[];
  onCell: (pos: Pos) => void;
}

const OWNER_COLOR: Record<PlayerId, string> = { red: 'var(--red)', blue: 'var(--blue)', neutral: '#9aa3ad' };

function selectedKey(state: GameState, sel: Ref | null): string | null {
  if (!sel) return null;
  if (sel.kind === 'square') return `${sel.pos.x},${sel.pos.y}`;
  const pos = sel.kind === 'group' ? state.groups[sel.id]?.pos : sel.kind === 'structure' ? state.structures[sel.id]?.pos : null;
  return pos ? `${pos.x},${pos.y}` : null;
}

export function Board({ state, selected, highlights, arrows, onCell }: BoardProps) {
  const selKey = selectedKey(state, selected);
  const cells = state.cells.map((k) => {
    const [x, y] = k.split(',').map(Number);
    return { k, pos: { x, y } };
  });
  return (
    <svg class="board" viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`} role="group" aria-label="Game board">
      {cells.map(({ k, pos }) => (
        <polygon
          key={k}
          class={`tile${highlights.has(k) ? ' hl' : ''}${selKey === k ? ' selected' : ''}`}
          data-cell={k}
          points={diamondPoints(pos)}
          fill={TERRAIN_FILL[state.terrain[k]]}
          onClick={() => onCell(pos)}
        />
      ))}
      {Object.values(state.structures).map((st) => {
        const c = project(st.pos);
        const glyph = st.kind === 'sanctum' ? 'S' : st.kind === 'town' ? 'T' : 'C';
        return (
          <g key={`st${st.id}`} class="structure" pointer-events="none" transform={`translate(${c.x - 20} ${c.y + 2})`}>
            <rect width="14" height="14" rx="2" fill="#10151b" stroke={OWNER_COLOR[st.owner]} stroke-width="2" />
            <text x="7" y="11" text-anchor="middle" class="glyph">{glyph}</text>
          </g>
        );
      })}
      {Object.values(state.groups).filter((g) => g.pos).map((g) => {
        const c = project(g.pos!);
        const monster = g.kind === 'monster';
        return (
          <g key={`g${g.id}`} class={`group-token${monster ? ' monster' : ''}`} pointer-events="none" transform={`translate(${c.x} ${c.y})`}>
            {monster
              ? <polygon points="0,-13 12,0 0,13 -12,0" fill={OWNER_COLOR[g.owner]} stroke="#0b0f14" stroke-width="2" />
              : <circle r="12" fill={OWNER_COLOR[g.owner]} stroke="#0b0f14" stroke-width="2" />}
            <text y="5" text-anchor="middle" class="count">{g.minionIds.length}</text>
          </g>
        );
      })}
      {arrows.map((a, i) => {
        const f = project(a.from);
        const t = project(a.to);
        return (
          <line key={`a${i}`} class="arrow" pointer-events="none" x1={f.x} y1={f.y} x2={t.x} y2={t.y}
            stroke={OWNER_COLOR[a.owner]} stroke-width="5" stroke-linecap="round" marker-end="url(#head)" />
        );
      })}
      <defs>
        <marker id="head" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 z" fill="#e4eaf0" />
        </marker>
      </defs>
    </svg>
  );
}
```
CSS appended to `styles.css`:
```css
.board { width: 100%; height: auto; max-height: 100%; display: block; }
.board .tile { stroke: #0b0f14; stroke-width: 1; cursor: pointer; }
.board .tile:hover { stroke: var(--accent); stroke-width: 2; }
.board .tile.hl { stroke: #f2d675; stroke-width: 3; }
.board .tile.selected { stroke: #fff; stroke-width: 3; }
.board .glyph { font: 700 10px var(--font-mono); fill: var(--fg); }
.board .count { font: 700 14px var(--font-display); fill: #0b0f14; }
.board .arrow { opacity: .85; }
```

- [ ] **Step 5: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. In the preview tool, temporarily render `<Board>` of a new session in `app.tsx` and confirm visually (screenshot) that the diamond looks right (red Sanctum near the top, blue near the bottom, corners cut); revert the temporary change before committing.
```bash
git add -A
git commit -m "feat(web): diagonal SVG board"
```

---

### Task 5: Sidebar (selection details and card text)

**Goal:** A sidebar showing what is selected: a group with its minion tiles (nation, class, hp bar, stats, active spells with keyword text), a structure, or a square.

**Files:**
- Create: `packages/web/src/ui/{format.tsx,Sidebar.tsx}`, `packages/web/test/sidebar.test.tsx`
- Modify: `packages/web/src/styles.css`

**Acceptance Criteria:**
- [ ] A group shows its owner, position and control (player / computer), and one tile per minion with name, nation, class, hp bar (current/max) and the stats H, M, A, L from `viewStats`
- [ ] Each minion tile lists its active spells by card name with their keyword text (`cardFace` lines after the target line); non-visible helper effects are listed too, marked as effects
- [ ] A structure shows kind, owner, novices (with queued nations), mana type
- [ ] A square shows its terrain and any spells on it
- [ ] `ManaChips` renders a cost as typed chips; `Face` renders a card's keyword lines

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/web/test/sidebar.test.tsx`:
```tsx
import { render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { Sidebar } from '../src/ui/Sidebar';
import { newSession } from '../src/model/session';

describe('Sidebar', () => {
  const s = newSession(7, { red: 'war', blue: 'life' });
  const group = Object.values(s.state.groups).find((g) => g.owner === 'red')!;

  it('shows a group and its minion tiles with stats', () => {
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'group', id: group.id }} />);
    expect(screen.getByText(/Red group/)).toBeTruthy();
    expect(screen.getAllByText(/Human/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/7\/7/).length).toBe(4);
    expect(screen.getAllByText(/H 2/).length).toBeGreaterThan(0);
  });

  it('shows a structure with its novices', () => {
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'structure', id: st.id }} />);
    expect(screen.getByText(/Sanctum/)).toBeTruthy();
    expect(screen.getByText(new RegExp(`${st.novices} novice`))).toBeTruthy();
  });

  it('shows a square and a spell with its keyword text', () => {
    const e = JSON.parse(JSON.stringify(s.state));
    e.spells.push({ id: 9999, cardId: 'flaming-sword', owner: 'red', host: { kind: 'minion', id: group.minionIds[0] }, visible: true, turnsLeft: null, tokens: {} });
    render(<Sidebar state={e} cards={s.cards} selected={{ kind: 'group', id: group.id }} />);
    expect(screen.getByText('Flaming Sword')).toBeTruthy();
    expect(screen.getByText(/\+2 H/)).toBeTruthy();
  });

  it('shows a square', () => {
    render(<Sidebar state={s.state} cards={s.cards} selected={{ kind: 'square', pos: { x: 4, y: 4 } }} />);
    expect(screen.getByText(/Square \(5,5\)/)).toBeTruthy();
  });
});
```
(`flaming-sword` gives `+2 H` per its face; the first minion of the starting group is a swordsman.)

- [ ] **Step 2: `packages/web/src/ui/format.tsx`**

```tsx
import { cardFace, cardIndex } from '@sanctum/cards';
import type { ManaPool } from '@sanctum/engine';

const MANA_LABEL: Record<string, string> = { clarity: 'Clarity', mystery: 'Mystery', order: 'Order', strife: 'Strife', will: 'Will', world: 'World' };
export const manaLabel = (m: string) => MANA_LABEL[m] ?? m;
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A cost or pool as chips ("2 Strife"). Zero entries are hidden. */
export function ManaChips({ cost }: { cost: Partial<ManaPool> }) {
  const entries = Object.entries(cost).filter(([, n]) => (n as number) !== 0);
  if (entries.length === 0) return <span class="chip free">free</span>;
  return (
    <span class="chips">
      {entries.map(([m, n]) => (
        <span key={m} class={`chip mana-${m}${(n as number) < 0 ? ' neg' : ''}`}>{n as number} {manaLabel(m)}</span>
      ))}
    </span>
  );
}

/** A card's keyword text: the target line dimmed, then one paragraph per line. */
export function Face({ id, skipTarget = false }: { id: string; skipTarget?: boolean }) {
  const face = cardFace(id);
  if (!face) return null;
  const lines = skipTarget ? face.lines.slice(1) : face.lines;
  return (
    <div class="face">
      {lines.map((l, i) => <p key={i} class={!skipTarget && i === 0 ? 'target' : ''}>{l}</p>)}
    </div>
  );
}

export const cardName = (id: string) => cardIndex[id]?.name ?? id;
```

- [ ] **Step 3: `packages/web/src/ui/Sidebar.tsx`**

```tsx
import { viewStats, type CardIndex, type GameState, type Minion, type Ref, type Structure } from '@sanctum/engine';
import { Face, cap, cardName } from './format';

const at = (p: { x: number; y: number }) => `(${p.x + 1},${p.y + 1})`;

function SpellList({ state, host }: { state: GameState; host: Ref }) {
  const spells = state.spells.filter((sp) => JSON.stringify(sp.host) === JSON.stringify(host));
  if (spells.length === 0) return null;
  return (
    <ul class="spells">
      {spells.map((sp) => (
        <li key={sp.id}>
          <strong>{cardName(sp.cardId)}</strong>
          {sp.visible ? null : <span class="tag">effect</span>}
          {sp.turnsLeft !== null ? <span class="tag">{sp.turnsLeft} turn{sp.turnsLeft === 1 ? '' : 's'} left</span> : null}
          <Face id={sp.cardId} skipTarget />
        </li>
      ))}
    </ul>
  );
}

function MinionTile({ state, cards, m }: { state: GameState; cards: CardIndex; m: Minion }) {
  const st = viewStats(state, cards, m.id);
  const pct = Math.max(0, Math.min(100, (100 * m.hp) / st.maxHp));
  return (
    <div class={`minion owner-${m.owner}`}>
      <div class="minion-head">
        <strong>{m.name}</strong>
        <span class="muted">{[m.nation ? cap(m.nation) : '', m.kind === 'recruit' ? m.cls : 'monster'].filter(Boolean).join(' ')}</span>
      </div>
      <div class="hpbar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></div>
      <div class="statline">
        <span>{m.hp}/{st.maxHp}</span>
        <span>H {st.hand}{st.handAttacks > 1 ? `×${st.handAttacks}` : ''}</span>
        <span>M {st.missile}{st.missileAttacks > 1 ? `×${st.missileAttacks}` : ''}</span>
        <span>A {st.armor}</span>
        <span>L {st.level}</span>
        {st.walks.length ? <span>{st.walks.join(', ')}</span> : null}
      </div>
      <SpellList state={state} host={{ kind: 'minion', id: m.id }} />
    </div>
  );
}

function StructureView({ st }: { st: Structure }) {
  return (
    <section>
      <h3>{cap(st.kind)} {at(st.pos)}</h3>
      <p class="muted">Owner: {cap(st.owner)}{st.manaType ? ` · makes ${cap(st.manaType)}` : ''}</p>
      <p>{st.novices} novice{st.novices === 1 ? '' : 's'} waiting{st.noviceNations?.length ? ` (${st.noviceNations.map(cap).join(', ')})` : ''}</p>
    </section>
  );
}

export function Sidebar({ state, cards, selected, children }: { state: GameState; cards: CardIndex; selected: Ref | null; children?: preact.ComponentChildren }) {
  let body: preact.ComponentChildren = <p class="muted">Select a square, group or structure.</p>;
  if (selected?.kind === 'group') {
    const g = state.groups[selected.id];
    if (g) {
      body = (
        <section>
          <h3>{cap(g.owner)} group {g.pos ? at(g.pos) : '(off the board)'}</h3>
          <p class="muted">{g.kind === 'monster' ? 'Monster group' : 'Recruit group'} · {g.control === 'player' ? 'player controlled' : 'computer controlled'}</p>
          {g.minionIds.map((id) => state.minions[id]).filter(Boolean).map((m) => <MinionTile key={m.id} state={state} cards={cards} m={m} />)}
          <SpellList state={state} host={{ kind: 'group', id: g.id }} />
        </section>
      );
    }
  } else if (selected?.kind === 'structure') {
    const st = state.structures[selected.id];
    if (st) body = <StructureView st={st} />;
  } else if (selected?.kind === 'square') {
    const k = `${selected.pos.x},${selected.pos.y}`;
    body = (
      <section>
        <h3>Square {at(selected.pos)}</h3>
        <p class="muted">{cap(state.terrain[k] ?? 'unknown')}</p>
        <SpellList state={state} host={selected} />
      </section>
    );
  }
  return <aside class="sidebar">{body}{children}</aside>;
}
```
Sidebar CSS (append to `styles.css`):
```css
.sidebar { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; overflow: auto; display: grid; gap: 12px; align-content: start; }
.muted { color: var(--muted); margin: 0; }
.minion { background: var(--panel-2); border-radius: 6px; padding: 10px; border-left: 4px solid var(--muted); display: grid; gap: 6px; }
.minion.owner-red { border-left-color: var(--red); } .minion.owner-blue { border-left-color: var(--blue); }
.minion-head { display: flex; justify-content: space-between; gap: 8px; }
.hpbar { height: 6px; background: #0e1318; border-radius: 3px; overflow: hidden; } .hpbar span { display: block; height: 100%; background: var(--good); }
.statline { display: flex; flex-wrap: wrap; gap: 4px 12px; font: 500 13px var(--font-mono); }
.spells { list-style: none; margin: 0; padding: 0; display: grid; gap: 6px; }
.tag { margin-left: 6px; font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--accent); }
.face p { margin: 2px 0; font: 400 13px var(--font-mono); } .face p.target { color: var(--muted); }
.chips { display: inline-flex; gap: 4px; flex-wrap: wrap; } .chip { font: 500 12px var(--font-mono); padding: 1px 6px; border-radius: 4px; background: var(--panel-2); border: 1px solid var(--line); }
.chip.neg { color: var(--bad); border-color: var(--bad); }
```

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass.
```bash
git add -A
git commit -m "feat(web): sidebar with minion tiles and keyword text"
```

---

### Task 6: Orders screen (selection, moves, training, casting)

**Goal:** One player's orders screen: board + sidebar + hand tray + orders list + mana pool, with all three kinds of order and the engine's own validation.

**Files:**
- Create: `packages/web/src/ui/{HandTray,OrdersScreen}.tsx`, `packages/web/test/orders-screen.test.tsx`
- Modify: `packages/web/src/styles.css`

**Acceptance Criteria:**
- [ ] Selecting one of your groups and clicking a neighbouring legal square sets a move order (arrow on the board); clicking it again clears it; illegal moves show the engine's message
- [ ] Selecting one of your structures shows training buttons (swordsman, archer, and the house's two mana types in a Sanctum) limited by the novices left; training entries appear in the orders list and can be removed
- [ ] Clicking a hand card arms it: legal targets are highlighted on the board (a globe card shows a "Cast on the globe" button); clicking a target adds the cast; several targets on one square (e.g. minions of a group) are offered as a list
- [ ] The mana pool preview updates with mana training and spell costs; over-spending shows in red and blocks locking with the engine's message
- [ ] A hand card can be marked for discard (one per turn)
- [ ] "Lock orders" calls `onLock(draft)`; an error string from it is shown

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`packages/web/test/orders-screen.test.tsx`:
```tsx
import { fireEvent, render, screen, within } from '@testing-library/preact';
import { describe, expect, it, vi } from 'vitest';
import type { Orders } from '@sanctum/engine';
import { OrdersScreen } from '../src/ui/OrdersScreen';
import { begin, newSession } from '../src/model/session';

const setup = () => {
  const s = begin(newSession(7, { red: 'war', blue: 'war' }), 'red');
  const onLock = vi.fn<(o: Orders) => string | null>(() => null);
  const view = render(<OrdersScreen session={s} side="red" onLock={onLock} />);
  const group = Object.values(s.state.groups).find((g) => g.owner === 'red')!;
  const cell = (x: number, y: number) => view.container.querySelector(`polygon[data-cell="${x},${y}"]`)!;
  return { s, onLock, view, group, cell };
};

describe('OrdersScreen', () => {
  it('sets and clears a move order by clicking a neighbouring square', () => {
    const { group, cell, view } = setup();
    fireEvent.click(cell(group.pos!.x, group.pos!.y));
    expect(screen.getByText(/Red group/)).toBeTruthy();
    const target = view.container.querySelector('polygon.tile.hl')!;
    expect(target).toBeTruthy();
    fireEvent.click(target);
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(1);
    expect(screen.getByText(/Move group/)).toBeTruthy();
    fireEvent.click(view.container.querySelector('polygon.tile.hl')!);
    expect(view.container.querySelectorAll('line.arrow')).toHaveLength(0);
  });

  it('trains a recruit at the Sanctum and lists it', () => {
    const { s, view } = setup();
    const st = Object.values(s.state.structures).find((x) => x.kind === 'sanctum' && x.owner === 'red')!;
    fireEvent.click(view.container.querySelector(`polygon[data-cell="${st.pos.x},${st.pos.y}"]`)!);
    fireEvent.click(screen.getByRole('button', { name: /Train swordsman/ }));
    expect(screen.getByText(/Train swordsman/, { selector: '.orders-list *' })).toBeTruthy();
  });

  it('arms a card, offers its targets and queues the cast', () => {
    const { s, view } = setup();
    const hand = s.state.players.red.hand;
    const globeIndex = hand.findIndex((id) => s.cards[id].target === 'globe');
    const idx = globeIndex >= 0 ? globeIndex : 0;
    fireEvent.click(screen.getAllByRole('button', { name: /^Play / })[idx]);
    if (s.cards[hand[idx]].target === 'globe') {
      fireEvent.click(screen.getByRole('button', { name: /Cast on the globe/ }));
      expect(within(view.container.ownerDocument.body.querySelector('.orders-list')!).getByText(/Cast/)).toBeTruthy();
    } else {
      expect(view.container.querySelectorAll('polygon.tile.hl').length).toBeGreaterThanOrEqual(0);
    }
  });

  it('locks the orders and shows an error that comes back', () => {
    const { onLock } = setup();
    onLock.mockReturnValueOnce('not enough strife mana for Fireball');
    fireEvent.click(screen.getByRole('button', { name: /Lock orders/ }));
    expect(screen.getByText(/not enough strife mana/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Lock orders/ }));
    expect(onLock).toHaveBeenCalledTimes(2);
  });
});
```
(The arm-a-card test depends on the shuffled hand; the plan's branch keeps it deterministic enough. If the hand has no globe card, make the test pick a hand card with a square or group target and assert highlights > 0; adjust to a seed whose hand has a known mix and say which.)

- [ ] **Step 2: `packages/web/src/ui/HandTray.tsx`**

```tsx
import type { CardIndex, Orders } from '@sanctum/engine';
import { Face, ManaChips } from './format';

export interface HandTrayProps {
  hand: string[];
  cards: CardIndex;
  draft: Orders;
  armed: number | null;
  onArm: (index: number | null) => void;
  onDiscard: (index: number | null) => void;
}

export function HandTray({ hand, cards, draft, armed, onArm, onDiscard }: HandTrayProps) {
  return (
    <div class="hand" role="group" aria-label="Your hand">
      {hand.map((id, i) => {
        const card = cards[id];
        const queued = draft.cast.some((c) => c.handIndex === i);
        const discarded = draft.discard === i;
        return (
          <article key={`${id}-${i}`} class={`hand-card${armed === i ? ' armed' : ''}${queued ? ' queued' : ''}${discarded ? ' discarded' : ''}`}>
            <header>
              <h3>{card.name}</h3>
              <ManaChips cost={card.cost} />
            </header>
            <Face id={id} />
            <footer>
              <button type="button" aria-label={`Play ${card.name}`} onClick={() => onArm(armed === i ? null : i)} disabled={discarded}>
                {armed === i ? 'Cancel' : queued ? 'Retarget' : 'Play'}
              </button>
              <button type="button" aria-label={`Discard ${card.name}`} onClick={() => onDiscard(discarded ? null : i)} disabled={queued}>
                {discarded ? 'Keep' : 'Discard'}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: `packages/web/src/ui/OrdersScreen.tsx`**

```tsx
import { useMemo, useState } from 'preact/hooks';
import {
  checkOrders, emptyOrders, houseMana, key, legalTargets, step, DIR_LIST,
  type GameState, type Orders, type Pos, type Ref, type Side, type TrainOrder,
} from '@sanctum/engine';
import { addCast, addTrain, poolPreview, removeCast, removeTrain, setDiscard, setMove } from '../model/drafts';
import { dirBetween } from '../model/geometry';
import { refLabel } from '../model/report';
import type { Session } from '../model/session';
import { Board, type Arrow } from './Board';
import { HandTray } from './HandTray';
import { ManaChips, cap, manaLabel } from './format';
import { Sidebar } from './Sidebar';

/** Which board square a target sits on (null for the globe). */
export function cellOf(s: GameState, r: Ref): Pos | null {
  switch (r.kind) {
    case 'square': return r.pos;
    case 'group': return s.groups[r.id]?.pos ?? null;
    case 'structure': return s.structures[r.id]?.pos ?? null;
    case 'minion': return s.groups[s.minions[r.id]?.groupId]?.pos ?? null;
    default: return null;
  }
}

export interface OrdersScreenProps {
  session: Session;
  side: Side;
  /** Lock the orders. Returns the engine's error text, or null when the orders were accepted. */
  onLock: (o: Orders) => string | null;
}

export function OrdersScreen({ session, side, onLock }: OrdersScreenProps) {
  const { state, cards } = session;
  const me = state.players[side];
  const [draft, setDraft] = useState<Orders>(emptyOrders());
  const [sel, setSel] = useState<Ref | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [choices, setChoices] = useState<Ref[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const targets = useMemo(() => (armed === null ? [] : legalTargets(state, cards, side, me.hand[armed])), [armed, state]);
  const preview = poolPreview(me.mana, me.hand, cards, draft);

  const ownGroup = sel?.kind === 'group' && state.groups[sel.id]?.owner === side && state.groups[sel.id].control === 'player' ? state.groups[sel.id] : null;
  const ownStructure = sel?.kind === 'structure' && state.structures[sel.id]?.owner === side ? state.structures[sel.id] : null;

  const highlights = new Set<string>();
  if (armed !== null) {
    for (const t of targets) {
      const c = cellOf(state, t);
      if (c) highlights.add(key(c));
    }
  } else if (ownGroup?.pos) {
    for (const d of DIR_LIST) {
      const p = step(ownGroup.pos, d);
      if (state.cells.includes(key(p)) && checkOrders(state, cards, side, setMove(draft, ownGroup.id, d)) === null) highlights.add(key(p));
    }
  }

  const arrows: Arrow[] = draft.move.flatMap((m) => {
    const g = state.groups[m.groupId];
    return g?.pos ? [{ from: g.pos, to: step(g.pos, m.dir), owner: side }] : [];
  });

  const commitCast = (r: Ref) => {
    if (armed === null) return;
    setDraft(addCast(draft, armed, r));
    setArmed(null);
    setChoices([]);
    setMessage(null);
  };

  const onCell = (pos: Pos) => {
    setMessage(null);
    if (armed !== null) {
      const here = targets.filter((t) => {
        const c = cellOf(state, t);
        return c && c.x === pos.x && c.y === pos.y;
      });
      if (here.length === 1) commitCast(here[0]);
      else if (here.length > 1) setChoices(here);
      return;
    }
    if (ownGroup?.pos) {
      const dir = dirBetween(ownGroup.pos, pos);
      if (dir) {
        const current = draft.move.find((m) => m.groupId === ownGroup.id);
        const next = setMove(draft, ownGroup.id, current?.dir === dir ? null : dir);
        const err = checkOrders(state, cards, side, next);
        if (err) setMessage(err);
        else setDraft(next);
        return;
      }
    }
    const g = Object.values(state.groups).find((x) => x.pos && x.pos.x === pos.x && x.pos.y === pos.y);
    const st = Object.values(state.structures).find((x) => x.pos.x === pos.x && x.pos.y === pos.y);
    setSel(g ? { kind: 'group', id: g.id } : st ? { kind: 'structure', id: st.id } : { kind: 'square', pos });
  };

  const trainedAt = (id: number) => draft.train.filter((t) => t.structureId === id).length;
  const train = (as: TrainOrder['as']) => {
    if (ownStructure) setDraft(addTrain(draft, ownStructure.id, as));
  };
  const trainOptions: Array<TrainOrder['as']> = ownStructure
    ? ['swordsman', 'archer', ...(ownStructure.kind === 'sanctum' ? houseMana(me.house) : [])]
    : [];

  const lock = () => setMessage(onLock(draft));
  const initiative = state.initiative === side ? 'You have initiative' : `${cap(state.initiative)} has initiative`;

  return (
    <div class={`orders side-${side}`}>
      <header class="topbar">
        <h2>{cap(side)}'s orders · Turn {state.turn}</h2>
        <span class="muted">{initiative}</span>
        <span class="pool" aria-label="Mana pool after your orders"><ManaChips cost={preview.pool} /></span>
        <button type="button" class="primary" onClick={lock} disabled={preview.over}>Lock orders</button>
      </header>
      {message ? <p class="banner bad" role="alert">{message}</p> : null}
      {preview.over ? <p class="banner bad" role="alert">Not enough mana for these spells.</p> : null}
      <div class="stage">
        <Board state={state} selected={sel} highlights={highlights} arrows={arrows} onCell={onCell} />
        <Sidebar state={state} cards={cards} selected={sel}>
          {ownStructure ? (
            <section>
              <h3>Train</h3>
              <p class="muted">{ownStructure.novices - trainedAt(ownStructure.id)} novice(s) left here</p>
              <div class="btnrow">
                {trainOptions.map((as) => (
                  <button key={as} type="button" disabled={trainedAt(ownStructure.id) >= ownStructure.novices} onClick={() => train(as)}>
                    Train {as === 'swordsman' || as === 'archer' ? as : `as ${manaLabel(as)} mana`}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {armed !== null ? (
            <section>
              <h3>Cast {cards[me.hand[armed]].name}</h3>
              {cards[me.hand[armed]].target === 'globe' ? (
                <button type="button" class="primary" onClick={() => commitCast({ kind: 'globe' })}>Cast on the globe</button>
              ) : <p class="muted">{targets.length ? 'Click a highlighted square.' : 'No legal target right now.'}</p>}
              {choices.length > 0 ? (
                <ul class="choices">
                  {choices.map((c, i) => <li key={i}><button type="button" onClick={() => commitCast(c)}>{refLabel(c, state)}</button></li>)}
                </ul>
              ) : null}
            </section>
          ) : null}
          <section>
            <h3>Orders</h3>
            <ul class="orders-list">
              {draft.train.map((t, i) => (
                <li key={`t${i}`}>Train {t.as} <button type="button" aria-label="Remove training" onClick={() => setDraft(removeTrain(draft, i))}>×</button></li>
              ))}
              {draft.move.map((m) => (
                <li key={`m${m.groupId}`}>Move group {m.dir.toUpperCase()} <button type="button" aria-label="Remove move" onClick={() => setDraft(setMove(draft, m.groupId, null))}>×</button></li>
              ))}
              {draft.cast.map((c) => (
                <li key={`c${c.handIndex}`}>Cast {cards[me.hand[c.handIndex]].name} on {refLabel(c.target, state)} <button type="button" aria-label="Remove cast" onClick={() => setDraft(removeCast(draft, c.handIndex))}>×</button></li>
              ))}
              {draft.discard !== null ? <li>Discard {cards[me.hand[draft.discard]].name}</li> : null}
              {draft.train.length + draft.move.length + draft.cast.length === 0 && draft.discard === null ? <li class="muted">No orders yet.</li> : null}
            </ul>
          </section>
        </Sidebar>
      </div>
      <HandTray hand={me.hand} cards={cards} draft={draft} armed={armed}
        onArm={(i) => { setArmed(i); setChoices([]); setMessage(null); }}
        onDiscard={(i) => setDraft(setDiscard(draft, i))} />
    </div>
  );
}
```
Layout CSS (append):
```css
.orders { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 10px; height: 100%; padding: 10px 14px; }
.topbar { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; } .topbar .pool { margin-left: auto; }
.orders.side-red .topbar h2 { color: var(--red); } .orders.side-blue .topbar h2 { color: var(--blue); }
.stage { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 12px; min-height: 0; }
@media (max-width: 900px) { .stage { grid-template-columns: minmax(0, 1fr); } }
.primary { background: var(--accent); color: #07151a; border: 0; border-radius: 6px; padding: 8px 14px; font-weight: 600; }
.primary:disabled { opacity: .45; cursor: not-allowed; }
.btnrow { display: flex; flex-wrap: wrap; gap: 6px; } .btnrow button, .choices button, .hand-card button { background: var(--panel-2); border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; }
.btnrow button:disabled, .hand-card button:disabled { opacity: .4; }
.banner { margin: 0; padding: 8px 12px; border-radius: 6px; } .banner.bad { background: #3a1d19; color: var(--bad); }
.orders-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; } .orders-list li { display: flex; gap: 8px; align-items: center; }
.orders-list button { background: transparent; border: 0; color: var(--muted); }
.choices { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 4px; }
.hand { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 6px; }
.hand-card { flex: 0 0 210px; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 10px; display: grid; gap: 6px; align-content: start; }
.hand-card header { display: grid; gap: 4px; } .hand-card h3 { font-size: 18px; }
.hand-card.armed { border-color: #f2d675; } .hand-card.queued { border-color: var(--good); } .hand-card.discarded { opacity: .5; }
.hand-card footer { display: flex; gap: 6px; }
```

- [ ] **Step 4: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. Fix hand-shuffle-dependent assertions as the note in Step 1 says.
```bash
git add -A
git commit -m "feat(web): orders screen with move, train and cast orders"
```

---

### Task 7: Hotseat screens and the app flow

**Goal:** Setup, pass-the-device, mana choice, turn report and game-over screens wired into a playable app, plus the card browser tab.

**Files:**
- Create: `packages/web/src/ui/{Screens,CardBrowser}.tsx`, `packages/web/test/{app-flow,card-browser}.test.tsx`
- Modify: `packages/web/src/app.tsx`, `packages/web/src/styles.css`

**Acceptance Criteria:**
- [ ] Setup: pick each side's house (War or Life) and a seed, "Start game"
- [ ] Hand-off screen: "Pass the device to Red/Blue", orders hidden until "I'm ready"
- [ ] Locking red goes to the blue hand-off; locking blue shows the turn report (sections, a board with movement arrows); "Next turn" goes on; a captured town asks its owner for a mana type; a Sanctum capture shows the winner with "New game"
- [ ] A Play / Cards tab bar switches to the card browser: every card with its keyword text and original text, house and text filters, and the keyword glossary
- [ ] A scripted run through three turns with empty orders reaches turn 4 without errors

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing tests**

`packages/web/test/app-flow.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { App } from '../src/app';

const click = (name: RegExp) => fireEvent.click(screen.getByRole('button', { name }));

describe('app flow', () => {
  it('plays three empty turns through the hand-offs', () => {
    render(<App />);
    click(/Start game/);
    for (let turn = 1; turn <= 3; turn++) {
      expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
      click(/I'm ready/);
      expect(screen.getByRole('heading', { name: new RegExp(`Red's orders · Turn ${turn}`) })).toBeTruthy();
      click(/Lock orders/);
      expect(screen.getByText(/Pass the device to Blue/)).toBeTruthy();
      click(/I'm ready/);
      click(/Lock orders/);
      expect(screen.getByRole('heading', { name: new RegExp(`Turn ${turn} report`) })).toBeTruthy();
      click(/Next turn/);
    }
    expect(screen.getByText(/Pass the device to Red/)).toBeTruthy();
  });

  it('switches to the card browser and back', () => {
    render(<App />);
    click(/^Cards$/);
    expect(screen.getByRole('heading', { name: /Card browser/ })).toBeTruthy();
    click(/^Play$/);
    expect(screen.getByRole('button', { name: /Start game/ })).toBeTruthy();
  });
});
```
`packages/web/test/card-browser.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/preact';
import { describe, expect, it } from 'vitest';
import { CardBrowser } from '../src/ui/CardBrowser';

describe('CardBrowser', () => {
  it('lists cards with keyword text and filters by search', () => {
    render(<CardBrowser />);
    expect(screen.getByText('Flaming Sword')).toBeTruthy();
    fireEvent.input(screen.getByRole('searchbox'), { target: { value: 'fireball' } });
    expect(screen.getByText('Fireball')).toBeTruthy();
    expect(screen.queryByText('Flaming Sword')).toBeNull();
  });
  it('shows the glossary', () => {
    render(<CardBrowser />);
    expect(screen.getByRole('heading', { name: /Keywords/ })).toBeTruthy();
  });
});
```

- [ ] **Step 2: `packages/web/src/ui/Screens.tsx`**

```tsx
import { useState } from 'preact/hooks';
import type { HouseId, Mana, Side } from '@sanctum/engine';
import type { Report } from '../model/report';
import type { Session } from '../model/session';
import { Board } from './Board';
import { cap, manaLabel } from './format';

const HOUSES: Array<'war' | 'life'> = ['war', 'life'];
const MANA: Mana[] = ['clarity', 'mystery', 'order', 'strife', 'will', 'world'];

export function Setup({ onStart }: { onStart: (seed: number, houses: Record<Side, HouseId>) => void }) {
  const [red, setRed] = useState<'war' | 'life'>('war');
  const [blue, setBlue] = useState<'war' | 'life'>('life');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000));
  return (
    <main class="shell setup">
      <h1>Sanctum</h1>
      <p class="muted">Two players, one screen. Pick a house for each side.</p>
      <div class="setup-grid">
        <label>Red house
          <select value={red} onChange={(e) => setRed((e.target as HTMLSelectElement).value as 'war' | 'life')}>
            {HOUSES.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
          </select>
        </label>
        <label>Blue house
          <select value={blue} onChange={(e) => setBlue((e.target as HTMLSelectElement).value as 'war' | 'life')}>
            {HOUSES.map((h) => <option key={h} value={h}>{cap(h)}</option>)}
          </select>
        </label>
        <label>Seed
          <input type="number" value={seed} onInput={(e) => setSeed(Number((e.target as HTMLInputElement).value))} />
        </label>
      </div>
      <button type="button" class="primary" onClick={() => onStart(seed, { red, blue })}>Start game</button>
    </main>
  );
}

export function Handoff({ to, turn, onReady }: { to: Side; turn: number; onReady: () => void }) {
  return (
    <main class={`shell handoff side-${to}`}>
      <p class="muted">Turn {turn}</p>
      <h1>Pass the device to {cap(to)}</h1>
      <p class="muted">The other player should look away. Orders stay hidden until you continue.</p>
      <button type="button" class="primary" onClick={onReady}>I'm ready</button>
    </main>
  );
}

export function ManaChoice({ session, side, onPick }: { session: Session; side: Side; onPick: (structureId: number, mana: Mana) => void }) {
  const id = session.state.pendingMana.find((sid) => session.state.structures[sid].owner === side)!;
  const st = session.state.structures[id];
  return (
    <main class={`shell side-${side}`}>
      <h1>{cap(side)} captured a {st.kind}</h1>
      <p class="muted">Choose the mana it produces for as long as you hold it.</p>
      <div class="btnrow">
        {MANA.map((m) => <button key={m} type="button" class="primary" onClick={() => onPick(id, m)}>{manaLabel(m)}</button>)}
      </div>
    </main>
  );
}

export function ReportScreen({ session, report, onNext }: { session: Session; report: Report; onNext: () => void }) {
  return (
    <main class="report">
      <header class="topbar">
        <h2>Turn {report.turn} report</h2>
        <button type="button" class="primary" onClick={onNext}>Next turn</button>
      </header>
      <div class="stage">
        <Board state={session.state} selected={null} highlights={new Set()} onCell={() => {}}
          arrows={report.moves.map((m) => ({ from: m.from, to: m.to, owner: m.owner }))} />
        <aside class="sidebar">
          {report.sections.length === 0 ? <p class="muted">Nothing happened.</p> : null}
          {report.sections.map((sec) => (
            <section key={sec.title}>
              <h3>{sec.title}</h3>
              <ul class="plain">{sec.lines.map((l, i) => <li key={i}>{l}</li>)}</ul>
            </section>
          ))}
        </aside>
      </div>
    </main>
  );
}

export function Over({ winner, onNew }: { winner: Side | null; onNew: () => void }) {
  return (
    <main class={`shell ${winner ? `side-${winner}` : ''}`}>
      <h1>{winner ? `${cap(winner)} wins` : 'Game over'}</h1>
      <p class="muted">The enemy Sanctum has fallen.</p>
      <button type="button" class="primary" onClick={onNew}>New game</button>
    </main>
  );
}
```
CSS (append):
```css
.setup-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; margin: 18px 0; }
.setup-grid label { display: grid; gap: 6px; color: var(--muted); }
select, input[type="number"], input[type="search"] { background: var(--panel); color: var(--fg); border: 1px solid var(--line); border-radius: 6px; padding: 7px 10px; font: inherit; }
.handoff { text-align: center; display: grid; gap: 14px; justify-items: center; padding-top: 12vh; }
.handoff.side-red h1 { color: var(--red); } .handoff.side-blue h1 { color: var(--blue); }
.report { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; height: 100%; padding: 10px 14px; }
ul.plain { margin: 0; padding-left: 18px; display: grid; gap: 3px; }
.tabs { display: flex; gap: 4px; padding: 8px 14px 0; border-bottom: 1px solid var(--line); }
.tabs button { background: transparent; border: 0; border-bottom: 3px solid transparent; padding: 8px 14px; color: var(--muted); font-weight: 600; }
.tabs button[aria-current="page"] { color: var(--fg); border-bottom-color: var(--accent); }
.frame { display: grid; grid-template-rows: auto minmax(0, 1fr); height: 100%; }
.browser { padding: 14px; overflow: auto; display: grid; gap: 14px; max-width: 1200px; margin: 0 auto; width: 100%; }
.browser-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr)); gap: 12px; }
.browser-card { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 12px; display: grid; gap: 8px; align-content: start; }
.browser-card header { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
.browser-card details summary { cursor: pointer; color: var(--accent); font-size: 13px; }
```

- [ ] **Step 3: `packages/web/src/ui/CardBrowser.tsx`**

```tsx
import { useState } from 'preact/hooks';
import { cardData, cardFace, cardIndex, keywordGlossary } from '@sanctum/cards';
import { Face, ManaChips, cap } from './format';

export function CardBrowser() {
  const [house, setHouse] = useState<'all' | 'war' | 'life'>('all');
  const [q, setQ] = useState('');
  const shown = cardData.filter((d) => {
    if (house !== 'all' && d.house !== house) return false;
    if (!q) return true;
    const hay = `${d.name} ${d.text} ${(cardFace(d.slug)?.lines ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  return (
    <div class="browser">
      <h1>Card browser</h1>
      <div class="btnrow">
        {(['all', 'war', 'life'] as const).map((h) => (
          <button key={h} type="button" aria-pressed={house === h} onClick={() => setHouse(h)}>{h === 'all' ? 'All houses' : cap(h)}</button>
        ))}
        <input type="search" placeholder="Search name or text" aria-label="Search cards" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value.trim().toLowerCase())} />
        <span class="muted">{shown.length} of {cardData.length} cards</span>
      </div>
      <div class="browser-grid">
        {shown.map((d) => (
          <article key={d.slug} class="browser-card">
            <header><h3>{d.name}</h3><ManaChips cost={d.cost} /></header>
            <p class="muted">{cap(d.house)} · {d.rarity}</p>
            {cardIndex[d.slug] ? <Face id={d.slug} /> : <p class="muted">Not converted to keywords yet.</p>}
            <details><summary>Original text</summary><p class="muted">{d.text}</p></details>
          </article>
        ))}
      </div>
      <h2>Keywords</h2>
      <div class="browser-grid">
        {keywordGlossary().map((e) => (
          <article key={e.kind} class="browser-card">
            <header><h3>{e.term}</h3><span class="tag">{e.tier}</span></header>
            <p class="muted">{e.gloss}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: `packages/web/src/app.tsx`**

```tsx
import { useState } from 'preact/hooks';
import type { Mana, Orders } from '@sanctum/engine';
import { afterReport, begin, lock, newSession, pickMana, type Session } from './model/session';
import { CardBrowser } from './ui/CardBrowser';
import { OrdersScreen } from './ui/OrdersScreen';
import { Handoff, ManaChoice, Over, ReportScreen, Setup } from './ui/Screens';

export function App() {
  const [tab, setTab] = useState<'play' | 'cards'>('play');
  const [session, setSession] = useState<Session | null>(null);

  const play = () => {
    if (!session) return <Setup onStart={(seed, houses) => setSession(newSession(seed, houses))} />;
    const sc = session.screen;
    switch (sc.kind) {
      case 'handoff':
        return <Handoff to={sc.to} turn={session.state.turn} onReady={() => setSession(begin(session, sc.to))} />;
      case 'orders':
        return (
          <OrdersScreen key={`${session.state.turn}-${sc.side}`} session={session} side={sc.side}
            onLock={(o: Orders) => {
              const r = lock(session, sc.side, o);
              if (!r.ok) return r.error;
              setSession(r.session);
              return null;
            }} />
        );
      case 'mana':
        return <ManaChoice session={session} side={sc.side} onPick={(id: number, m: Mana) => setSession(pickMana(session, sc.side, id, m))} />;
      case 'report':
        return <ReportScreen session={session} report={session.report!} onNext={() => setSession(afterReport(session))} />;
      case 'over':
        return <Over winner={session.state.winner} onNew={() => setSession(null)} />;
    }
  };

  return (
    <div class="frame">
      <nav class="tabs" aria-label="Sections">
        <button type="button" aria-current={tab === 'play' ? 'page' : undefined} onClick={() => setTab('play')}>Play</button>
        <button type="button" aria-current={tab === 'cards' ? 'page' : undefined} onClick={() => setTab('cards')}>Cards</button>
      </nav>
      <div class="view">{tab === 'play' ? play() : <CardBrowser />}</div>
    </div>
  );
}
```
(The Task 2 smoke test asserted "78 cards"; update it to assert the Setup screen's heading and "Start game" button instead, and delete the placeholder text check.)

- [ ] **Step 5: Run the whole repo and commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: all pass. In the app-flow test, empty orders on every turn must be accepted by the engine; if the engine requires something else, fix the test and report.
```bash
git add -A
git commit -m "feat(web): hotseat screens, app flow and card browser"
```

---

### Task 8: Play it for real, fix what breaks, document, tag

**Goal:** The client survives an actual game in a browser; bugs found are fixed with regression tests; the README says how to run it; tag `web-m1`.

**Files:**
- Create: `packages/web/README.md`
- Modify: whatever the playthrough shows is broken (with a test for each fix); `docs/superpowers/plans/cards-backlog.md` is untouched

**Acceptance Criteria:**
- [ ] With `preview_start` `{name: "web"}`, a full game is played to the end in the browser pane: both houses, training, moves, at least one spell cast from each side, a combat, a town capture with the mana choice, and a Sanctum capture ending on the winner screen (use a seed and a short script of orders; the engine is deterministic)
- [ ] No console errors or failed network requests during that run (`read_console_messages`, `read_network_requests`)
- [ ] Every bug found has a regression test (a model-level test when the bug is in `session`/`report`/`drafts`, a component test otherwise)
- [ ] Layout works at 1280x800 and at a phone width (375x812) without horizontal page scroll; screenshots of the orders screen, the report screen and the card browser at both widths are taken
- [ ] `packages/web/README.md` explains: what the client is, `npm run dev -w @sanctum/web`, the hotseat flow, where logic lives (engine vs `model/` vs `ui/`), and that card art is not shipped

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck && npm run build -w @sanctum/web` -> all pass

**Steps:**

- [ ] **Step 1: Start the app and play**

`preview_start` `{name: "web"}`. Use `read_page`, `find`, `computer` (click, type) and `read_console_messages`. A suggested script (adjust to what the board shows; red starts top, blue bottom):
1. Start a War (red) vs Life (blue) game with seed 7.
2. Turn 1: red trains one swordsman at the Sanctum and moves its group one square toward the centre; blue does the same. Check the report lists movement and the new unit.
3. Keep going. Cast at least one spell per side (arm a card, click a highlighted target), watching that illegal casts are refused with the engine's text.
4. Walk a group onto a neutral town: confirm the capture report, then the mana choice screen for the owner.
5. Drive a group into the enemy Sanctum: confirm the winner screen and "New game".
Write down every glitch: layout overflow, wrong highlight, a missing refresh after locking, a stale selection, text that does not read well, buttons that do nothing.

- [ ] **Step 2: Fix each bug with a failing test first**

For each glitch, reproduce it in a test (render the component or call the model function), see it fail, fix it, see it pass. Keep fixes in `model/` and `ui/`; if a glitch shows an engine defect, write the failing engine test, fix it in `packages/engine`, and say so in the commit message. Do not add rule logic to the UI.

- [ ] **Step 3: Responsive check**

`resize_window` to 1280x800, then `mobile` (375x812), then `desktop` again. At each width take a screenshot of the orders screen, the report screen and the card browser. Fix overflow (the stage grid collapses to one column under 900px; the hand tray scrolls sideways inside its own container; the topbar wraps). Reset the viewport with preset `desktop` when done.

- [ ] **Step 4: README**

`packages/web/README.md`: what it is (private hotseat client for the Sanctum remake), run commands (`npm install`, `npm run dev -w @sanctum/web`, `npm run build -w @sanctum/web`, `npm test`), the flow (setup, pass the device, orders, lock, report), the architecture rule ("the UI reads `GameState` and submits `Orders`; rules live in `packages/engine`; cards in `packages/cards`; the hotseat flow in `src/model/session.ts`"), the click-first interaction and that drag and drop and a frame animation of the resolution are not built yet, and that card art is private-use material not shipped.

- [ ] **Step 5: Run the whole repo, commit and tag**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck && npm run build -w @sanctum/web`
Expected: all pass.
```bash
git add -A
git commit -m "feat(web): playtest fixes, README"
git tag web-m1
```

---

## After this plan

- A review pass (Opus) over `packages/web` and the three engine helpers, then a fix round, as for the earlier plans.
- Drag and drop on the board and hand, and a step-through animation of the resolution (both are input/output layers over the existing session and report).
- The remaining 24 cards (Questing Beast, E6 to E11), each group as its own small plan in the keyword language.
- Online play (WebSocket, per-player state) and an AI opponent: the `Orders` data and `checkOrders` already make both possible without engine changes.
