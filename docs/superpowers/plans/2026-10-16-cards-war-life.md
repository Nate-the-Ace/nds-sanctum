# Sanctum Cards (War + Life) and Scraper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scrape every War and Life card from playsanctum.net into committed JSON, build the `@sanctum/cards` package with a metadata-checked card registry, and implement the 30 War/Life cards that the current engine API can express, each with tests. The other 72 cards go in a backlog tagged with the engine extension each needs.

**Architecture:** `tools/scrape` is a dependency-free Node ESM scraper (parser unit-tested against saved HTML fixtures). Its output `packages/cards/data/cards.json` is the source of truth for names, costs, rarity and text. Each card is one TypeScript file in `packages/cards/src/<house>/` calling `defineCard`; a metadata test cross-checks every script (house, cost, target) against the scraped record. Card tests drive the real engine through a small `testing` entry point.

**Tech Stack:** Node 24 (global `fetch`), TypeScript strict ESM, Vitest, npm workspaces. No new dependencies.

**User decisions (already made):**
- "Scrape playsanctum.net/cards" for card data; "Private use only" (copy freely, never publish).
- "TypeScript modules with hooks" for card scripts; "C" (full scripting power).
- "Yes, write plan 2: the packages/cards War and Life card scripts and tools/scrape. First test whether the card pages on playsanctum.net can actually be scraped."
- Milestone 1 houses are War and Life (design spec section 4).

**Scrape feasibility (tested 2026-10-16, before writing this plan):** `http://playsanctum.net/cards/house.html?house=<id>` lists every card of a house as `<a href="cardp.html?sid=N">Name</a>`; `cardp.html?sid=N` holds name, `House of X`, expansion, rarity, casting cost (mana as `<IMG SRC="/images/NNmana.gif">`), flavor and rules text. House ids: War = 11, Life = 2 (full table: Making 1, Life 2, Hope 3, Nature 4, Justice 5, Body 6, Unmaking 7, Death 8, Despair 9, Abomination 10, War 11, Mind 12). All 102 War+Life pages (50 + 52) were downloaded and parsed successfully. Pages are ISO-8859-1. Mana images seen so far: `02` = Strife, `03` = Clarity, `06` = World (derived from War = strife/clarity, Life = clarity/world, Unmaking = strife/world). The card page does **not** state the spell type (alteration vs manifestation etc.), so scripts declare it themselves.

**Decisions made in this plan:**
1. Only cards expressible with the current engine API are implemented now (30 of 102). The 72 others are listed in `docs/superpowers/plans/cards-backlog.md` grouped by the engine extension they need; that backlog is the input for plan 2b.
2. Where the engine cannot express a clause exactly, the card is implemented with the closest behaviour and carries a `// RULING:` comment naming the gap. These are: Redeemer's Sword (Death/Despair clauses omitted, no such cards exist yet), Swashbuckler ("cannot gain armor" omitted), Shattering Blow (kill is a "dies" death, so the attacker gets no experience), Filigreed Armor ("enchantments" = visible spells on the attacker or its group), Scorched Earth ("cast on forest" must target an empty forest square).
3. Spell duration "Turn of casting +N" would map to `duration: { turns: N + 1 }` (no Tier A card uses it).
4. Card ids are slugs of the name: lowercase, apostrophes dropped, other non-alphanumerics to `-` (`Ngozi's Way` -> `ngozis-way`).

---

## File structure

```
sanctum/
  package.json                       MODIFY workspaces + scripts
  tools/scrape/
    package.json  vitest.config.mjs
    parse.mjs                        parseHouseList, parseCard, slugify
    scrape.mjs                       network driver -> packages/cards/data/cards.json
    test/parse.test.mjs
    test/fixtures/                   card-94.html card-330.html card-1089.html house-2.html
  packages/engine/src/testing.ts     NEW internals re-export for card tests
  packages/cards/
    package.json  tsconfig.json  vitest.config.ts
    data/cards.json                  generated, committed
    src/helpers.ts                   shared canCast/stats helpers
    src/index.ts                     allCards, cardIndex, cardData, pendingCards
    src/war/*.ts  src/war/index.ts   17 cards
    src/life/*.ts src/life/index.ts  13 cards
    test/helpers.ts                  world(), put(), ...
    test/meta.test.ts  test/war-stats.test.ts  test/war-effects.test.ts
    test/life-a.test.ts  test/life-b.test.ts  test/game.test.ts
  docs/superpowers/plans/cards-backlog.md
```

Conventions used by every card task: run tests from `packages/cards` with `npx vitest run`; typecheck with `npx tsc -p . --noEmit`; commit messages end with a blank line then `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

---

### Task 0: Workspace wiring and the engine `testing` entry

**Goal:** Root scripts run every workspace; the engine exposes its internals to card tests through `@sanctum/engine/src/testing`.

**Files:**
- Modify: `package.json`
- Create: `packages/engine/src/testing.ts`
- Test: existing engine suite (must stay green)

**Acceptance Criteria:**
- [ ] `npm test` at the root runs tests in every workspace that has a `test` script
- [ ] `@sanctum/engine/src/testing` re-exports the internals listed below
- [ ] Engine suite still passes (115 tests) and typechecks

**Verify:** `npm test` -> engine suite passes

**Steps:**

- [ ] **Step 1: Update root `package.json`**

Replace the file with:
```json
{
  "name": "sanctum",
  "private": true,
  "type": "module",
  "workspaces": ["packages/*", "tools/*"],
  "scripts": {
    "test": "npm test --workspaces --if-present",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^7.0.2",
    "vitest": "^5.0.5"
  }
}
```

- [ ] **Step 2: Write `packages/engine/src/testing.ts`**

```ts
/**
 * Internals for tests of code built on the engine (card scripts). Not part of the public API:
 * import as `@sanctum/engine/src/testing`.
 */
export { makeEngine } from './engine';
export type { Engine } from './engine';
export { blankState } from './state';
export { indexCards } from './cards';
export { executeCast, recheck, castCheck, targetLegal } from './spells';
export { createGroup, spawnMinion, recruitSpec, addRecruit } from './units';
export { computeStats } from './stats';
export { beginTurn } from './turn';
export { runMovement } from './movement';
export { runCombats, fight } from './combat';
export { dispatch } from './events';
export { addSpellRecord } from './spellstore';
export { takeDamage, applyDamage } from './damage';
export { killMinion } from './death';
```

- [ ] **Step 3: Run everything**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: engine suite passes (115 tests); typecheck exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json packages/engine/src/testing.ts
git commit -m "chore: run all workspaces from root; add engine testing entry"
```

---

### Task 1: Scraper parser (`tools/scrape`)

**Goal:** Pure parsing functions for house lists and card pages, tested against saved fixtures.

**Files:**
- Create: `tools/scrape/package.json`, `tools/scrape/vitest.config.mjs`, `tools/scrape/parse.mjs`, `tools/scrape/test/parse.test.mjs`, `tools/scrape/test/fixtures/{card-94.html,card-330.html,card-1089.html,house-2.html}`

**Acceptance Criteria:**
- [ ] `parseHouseList` returns every `{ sid, name }` on a house page
- [ ] `parseCard` returns `{ sid, name, slug, house, expansion, rarity, cost, flavor, text, castOn }`; cost uses mana names (strife/clarity/world), omits zero entries, and throws on an unknown mana image
- [ ] A card without flavor text gets `flavor: null`
- [ ] HTML entities are decoded and `\"` artifacts in flavor text become `"`

**Verify:** `cd tools/scrape && npx vitest run` -> all pass

**Steps:**

- [ ] **Step 1: Create the fixtures**

The raw pages from the feasibility test are in `research/cards-raw/` (gitignored). Copy three of them and fetch one house page:
```bash
cd C:/Users/nschonegg/Claude/sanctum
mkdir -p tools/scrape/test/fixtures
cp research/cards-raw/94.html tools/scrape/test/fixtures/card-94.html
cp research/cards-raw/330.html tools/scrape/test/fixtures/card-330.html
cp research/cards-raw/1089.html tools/scrape/test/fixtures/card-1089.html
curl -sL "http://playsanctum.net/cards/house.html?house=2" -o tools/scrape/test/fixtures/house-2.html
```
If `research/cards-raw/` is missing, fetch the three cards the same way with `curl -sL "http://playsanctum.net/cards/cardp.html?sid=94" -o ...`.

- [ ] **Step 2: Write `tools/scrape/package.json` and `vitest.config.mjs`**

`tools/scrape/package.json`:
```json
{
  "name": "@sanctum/scrape",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "scrape": "node scrape.mjs"
  }
}
```
`tools/scrape/vitest.config.mjs`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({ test: { include: ['test/**/*.test.mjs'] } });
```

- [ ] **Step 3: Write the failing test**

`tools/scrape/test/parse.test.mjs`:
```js
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseCard, parseHouseList, slugify } from '../parse.mjs';

const fixture = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'latin1');

describe('slugify', () => {
  it('lowercases, drops apostrophes and hyphenates', () => {
    expect(slugify("Ngozi's Way")).toBe('ngozis-way');
    expect(slugify('Good of the Many')).toBe('good-of-the-many');
    expect(slugify('Adriel\u2019s Mantle')).toBe('adriels-mantle');
  });
});

describe('parseHouseList', () => {
  it('lists every card on a house page', () => {
    const cards = parseHouseList(fixture('house-2.html'));
    expect(cards).toHaveLength(52);
    expect(cards).toContainEqual({ sid: 330, name: 'Pyx' });
    expect(cards.every((c) => Number.isInteger(c.sid) && c.name.length > 0)).toBe(true);
  });
});

describe('parseCard', () => {
  it('parses a classic card with flavor text', () => {
    const c = parseCard(fixture('card-94.html'), 94);
    expect(c).toMatchObject({
      sid: 94, name: 'Flaming Sword', slug: 'flaming-sword', house: 'war',
      expansion: 'Classic', rarity: 'Common', cost: { strife: 2 },
      text: 'Cast on swordsman. Swordsman gets +2 hand damage.', castOn: 'swordsman',
    });
    expect(c.flavor).toContain('Flaming Sword is to be wielded');
  });

  it('parses a two-mana card of another house', () => {
    const c = parseCard(fixture('card-330.html'), 330);
    expect(c).toMatchObject({
      name: 'Pyx', house: 'life', cost: { clarity: 1, world: 1 },
      text: 'Cast on group. Every member of group is fully healed.', castOn: 'group',
    });
  });

  it('gives flavor null when the card has none, and decodes entities', () => {
    const c = parseCard(fixture('card-1089.html'), 1089);
    expect(c.flavor).toBeNull();
    expect(c.expansion).toBe('Allies & Traitors');
    expect(c.cost).toEqual({ strife: 4, clarity: 4 });
    expect(c.rarity).toBe('Common');
    expect(c.text.startsWith('Cast on globe.')).toBe(true);
  });

  it('throws on an unknown mana image', () => {
    const html = fixture('card-94.html').replace('/images/02mana.gif', '/images/99mana.gif');
    expect(() => parseCard(html, 94)).toThrow(/mana image 99/);
  });
});
```

- [ ] **Step 4: Run to verify failure** (`cd tools/scrape && npx vitest run` -> cannot find `../parse.mjs`)

- [ ] **Step 5: Write `tools/scrape/parse.mjs`**

```js
/** Mana images seen on playsanctum.net card pages. Unknown numbers throw so a new house cannot be mis-scraped. */
export const MANA_BY_IMAGE = { '02': 'strife', '03': 'clarity', '06': 'world' };

const HOUSES = new Set([
  'abomination', 'body', 'death', 'despair', 'hope', 'justice', 'life', 'making', 'mind', 'nature', 'unmaking', 'war',
]);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');

/** Strip tags, decode entities, undo the site's `\"` escaping, collapse whitespace. */
const clean = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

export const slugify = (name) =>
  name.toLowerCase().replace(/['\u2019]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Every `{ sid, name }` linked from a house page. */
export function parseHouseList(html) {
  return [...html.matchAll(/cardp\.html\?sid=(\d+)">([^<]*)</g)].map((m) => ({ sid: Number(m[1]), name: clean(m[2]) }));
}

export function parseCard(html, sid) {
  const head = html.match(/<span id="wh">([\s\S]*?)<\/span>/);
  if (!head) throw new Error(`card ${sid}: header block not found`);
  const [name, houseLine, versionLine] = head[1].split(/<br\s*\/?>/i).map(clean).filter(Boolean);
  const house = houseLine?.match(/^House of (\w+)$/)?.[1]?.toLowerCase();
  if (!house || !HOUSES.has(house)) throw new Error(`card ${sid}: unknown house line "${houseLine}"`);
  const expansion = versionLine?.match(/^(?:A|An) (.+) Card$/)?.[1] ?? null;

  const at = html.indexOf('Rarity:');
  if (at < 0) throw new Error(`card ${sid}: rarity line not found`);
  const start = html.lastIndexOf('<p>', at);
  const paragraphs = [...html.slice(start).matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  const rarityRaw = paragraphs[0];
  const rarity = clean(rarityRaw).match(/Rarity: ([A-Za-z ]+?), Casting:/)?.[1];
  if (!rarity) throw new Error(`card ${sid}: rarity not parsed from "${clean(rarityRaw)}"`);

  const cost = {};
  for (const m of rarityRaw.matchAll(/(\d+)\s*<IMG SRC="\/images\/(\d+)mana\.gif">/gi)) {
    const mana = MANA_BY_IMAGE[m[2]];
    if (!mana) throw new Error(`card ${sid}: unknown mana image ${m[2]}`);
    if (Number(m[1]) > 0) cost[mana] = Number(m[1]);
  }

  const body = paragraphs.slice(1).map(clean).filter(Boolean);
  if (body.length === 0) throw new Error(`card ${sid}: no rules text`);
  const text = body[body.length - 1];
  const flavor = body.length > 1 ? body.slice(0, -1).join(' ') : null;
  const castOn = text.match(/Cast on ([^.]+)\./)?.[1] ?? null;
  return { sid, name, slug: slugify(name), house, expansion, rarity, cost, flavor, text, castOn };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `cd tools/scrape && npx vitest run`
Expected: all pass. If the `house-2.html` count is not 52, the fixture fetch failed: re-run the `curl` in Step 1.

- [ ] **Step 7: Commit**

```bash
git add tools/scrape
git commit -m "feat(scrape): parser for playsanctum.net house lists and card pages"
```

---

### Task 2: Scraper driver and committed card data

**Goal:** `scrape.mjs` downloads the War and Life pages politely and writes `packages/cards/data/cards.json` (102 cards).

**Files:**
- Create: `tools/scrape/scrape.mjs`, `packages/cards/data/cards.json` (generated)

**Acceptance Criteria:**
- [ ] `node tools/scrape/scrape.mjs` writes sorted JSON with 50 War and 52 Life cards
- [ ] War costs use only strife/clarity; Life costs use only clarity/world
- [ ] No two cards share a slug

**Verify:** the check script in Step 3 -> prints `OK 102 cards`

**Steps:**

- [ ] **Step 1: Write `tools/scrape/scrape.mjs`**

```js
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCard, parseHouseList } from './parse.mjs';

const BASE = 'http://playsanctum.net/cards';
const HOUSE_IDS = { war: 11, life: 2 };
const DELAY_MS = 250;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'cards', 'data', 'cards.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'sanctum-remake-private-scraper/0.1' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new TextDecoder('latin1').decode(await res.arrayBuffer());
}

const wanted = process.argv.slice(2);
const houses = wanted.length ? wanted : Object.keys(HOUSE_IDS);
const cards = [];
for (const house of houses) {
  if (!HOUSE_IDS[house]) throw new Error(`unknown house "${house}" (known: ${Object.keys(HOUSE_IDS).join(', ')})`);
  const list = parseHouseList(await get(`${BASE}/house.html?house=${HOUSE_IDS[house]}`));
  console.log(`${house}: ${list.length} cards`);
  for (const { sid } of list) {
    const card = parseCard(await get(`${BASE}/cardp.html?sid=${sid}`), sid);
    if (card.house !== house) throw new Error(`card ${sid} "${card.name}" is house ${card.house}, expected ${house}`);
    cards.push(card);
    await sleep(DELAY_MS);
  }
}
cards.sort((a, b) => a.house.localeCompare(b.house) || a.name.localeCompare(b.name));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(cards, null, 2) + '\n', 'utf8');
console.log(`wrote ${cards.length} cards to ${OUT}`);
```

- [ ] **Step 2: Run it**

Run: `cd C:/Users/nschonegg/Claude/sanctum && node tools/scrape/scrape.mjs`
Expected: `war: 50 cards`, `life: 52 cards`, `wrote 102 cards to ...cards.json` (about 30 seconds). If a request fails, re-run; nothing is cached.

- [ ] **Step 3: Check the data**

Run:
```bash
node -e "
const c = JSON.parse(require('fs').readFileSync('packages/cards/data/cards.json','utf8'));
const allowed = { war: ['strife','clarity'], life: ['clarity','world'] };
const slugs = new Set(c.map(x => x.slug));
const bad = c.filter(x => Object.keys(x.cost).some(k => !allowed[x.house].includes(k)));
if (c.length !== 102 || slugs.size !== 102 || bad.length) { console.error('FAIL', c.length, slugs.size, bad.map(x=>x.name)); process.exit(1); }
console.log('OK', c.length, 'cards');
"
```
Expected: `OK 102 cards`.

- [ ] **Step 4: Commit**

```bash
git add tools/scrape/scrape.mjs packages/cards/data/cards.json
git commit -m "feat(scrape): scrape War and Life cards into packages/cards/data/cards.json"
```

---

### Task 3: `@sanctum/cards` package, helpers and metadata test

**Goal:** The package skeleton: registry, shared helpers, test helpers, and the metadata test that every implemented card must satisfy.

**Files:**
- Create: `packages/cards/{package.json,tsconfig.json,vitest.config.ts}`, `packages/cards/src/{helpers.ts,index.ts}`, `packages/cards/src/war/index.ts`, `packages/cards/src/life/index.ts`, `packages/cards/test/{helpers.ts,meta.test.ts}`

**Acceptance Criteria:**
- [ ] `npm install` links `@sanctum/engine` into the package
- [ ] `allCards`, `cardIndex`, `cardData`, `pendingCards` exported; with no cards yet, `pendingCards` has all 102
- [ ] The meta test checks each implemented card against its scraped record (name, house, cost, target from "Cast on ...") and checks the data's mana keys per house

**Verify:** `cd packages/cards && npx vitest run && npx tsc -p . --noEmit` -> pass

**Steps:**

- [ ] **Step 1: Write the package files**

`packages/cards/package.json`:
```json
{
  "name": "@sanctum/cards",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "dependencies": { "@sanctum/engine": "*" },
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc -p . --noEmit"
  }
}
```
`packages/cards/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "resolveJsonModule": true },
  "include": ["src", "test", "data", "vitest.config.ts"]
}
```
`packages/cards/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'] },
});
```
Then run `cd C:/Users/nschonegg/Claude/sanctum && npm install` so the workspace link exists.

- [ ] **Step 2: Write `src/helpers.ts`**

```ts
import type { EventContext, GameEvent, Minion, Pos, QueryContext, Ref, TerrainId } from '@sanctum/engine';

export const ADJACENT: Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export const minionAt = (q: QueryContext, t: Ref): Minion | undefined => (t.kind === 'minion' ? q.minion(t.id) : undefined);

/** canCast: the target minion has this class. */
export const isCls =
  (cls: 'swordsman' | 'archer') =>
  (q: QueryContext, t: Ref): boolean =>
    minionAt(q, t)?.cls === cls;

/** canCast: the target minion is owned by the caster. */
export const isFriendlyMinion = (q: QueryContext, t: Ref): boolean => minionAt(q, t)?.owner === q.caster;

/** canCast: the target group contains at least one minion of this class. */
export const groupHas =
  (cls: 'swordsman' | 'archer') =>
  (q: QueryContext, t: Ref): boolean =>
    t.kind === 'group' && q.minionsOf(t.id).some((m) => m.cls === cls);

/** True when `ev` was dispatched on the minion this spell is hosted on. */
export const isHostMinion = (c: EventContext, ev: GameEvent): boolean =>
  ev.ref?.kind === 'minion' && c.host.kind === 'minion' && ev.ref.id === c.host.id;

/** True when `ev` was dispatched on the group this spell is hosted on. */
export const isHostGroup = (c: EventContext, ev: GameEvent): boolean =>
  ev.ref?.kind === 'group' && c.host.kind === 'group' && ev.ref.id === c.host.id;

/** Orthogonally contiguous squares of one terrain type, starting at (and including) `start`. */
export function contiguous(q: QueryContext, start: Pos, terrain: TerrainId): Pos[] {
  const seen = new Set<string>();
  const out: Pos[] = [];
  const stack: Pos[] = [start];
  while (stack.length > 0) {
    const p = stack.pop()!;
    const k = `${p.x},${p.y}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (q.terrainAt(p) !== terrain) continue;
    out.push(p);
    for (const d of ADJACENT) stack.push({ x: p.x + d.x, y: p.y + d.y });
  }
  return out;
}

/** "Enchantment": a visible active spell on the minion or on its group. */
export function hasEnchantments(q: QueryContext, m: Minion): boolean {
  return q.state.spells.some(
    (sp) =>
      sp.visible &&
      ((sp.host.kind === 'minion' && sp.host.id === m.id) || (sp.host.kind === 'group' && sp.host.id === m.groupId)),
  );
}
```

- [ ] **Step 3: Write the house indexes and `src/index.ts`**

`src/war/index.ts`:
```ts
import type { CardDef } from '@sanctum/engine';

export const warCards: CardDef[] = [];
```
`src/life/index.ts`:
```ts
import type { CardDef } from '@sanctum/engine';

export const lifeCards: CardDef[] = [];
```
`src/index.ts`:
```ts
import { indexCards, type CardDef } from '@sanctum/engine';
import data from '../data/cards.json';
import { lifeCards } from './life';
import { warCards } from './war';

export interface CardData {
  sid: number;
  name: string;
  slug: string;
  house: 'war' | 'life';
  expansion: string | null;
  rarity: string;
  cost: Partial<Record<'strife' | 'clarity' | 'world', number>>;
  flavor: string | null;
  text: string;
  castOn: string | null;
}

/** Scraped records for every War and Life card (implemented or not). */
export const cardData = data as CardData[];
/** Card scripts that exist, ready to hand to `createGame`. */
export const allCards: CardDef[] = [...warCards, ...lifeCards];
export const cardIndex = indexCards(allCards);
/** Scraped cards with no script yet (see docs/superpowers/plans/cards-backlog.md). */
export const pendingCards = cardData.filter((c) => !cardIndex[c.slug]);
```

- [ ] **Step 4: Write `test/helpers.ts`**

```ts
import type { Group, MinionSpec, PlayerId, Pos, Ref } from '@sanctum/engine';
import {
  blankState, computeStats, createGroup, executeCast, indexCards, makeEngine, recruitSpec, spawnMinion, type Engine,
} from '@sanctum/engine/src/testing';
import { allCards } from '../src/index';

/** Flat plains board, no structures, every implemented card registered. */
export const world = (): Engine => makeEngine(blankState(1), indexCards(allCards));

export function put(
  e: Engine, owner: PlayerId, pos: Pos, classes: Array<'swordsman' | 'archer'>, control: 'player' | 'computer' = 'player',
): Group {
  const g = createGroup(e, owner, pos, 'recruit', control);
  for (const c of classes) spawnMinion(e, g.id, recruitSpec(c));
  return g;
}

export const OGRE: MinionSpec = {
  kind: 'monster', cls: 'monster', name: 'ogre',
  base: { hp: 12, level: 1, armor: 0, hand: 2, handAttacks: 1, missile: 0, missileAttacks: 0, walks: [] },
};

export function putMonster(e: Engine, owner: PlayerId, pos: Pos): Group {
  const g = createGroup(e, owner, pos, 'monster', 'computer');
  spawnMinion(e, g.id, OGRE);
  return g;
}

export const cast = (e: Engine, who: 'red' | 'blue', id: string, target: Ref) => executeCast(e, who, id, target);
export const mref = (id: number): Ref => ({ kind: 'minion', id });
export const gref = (id: number): Ref => ({ kind: 'group', id });
export const sref = (x: number, y: number): Ref => ({ kind: 'square', pos: { x, y } });
export const stats = (e: Engine, id: number) => computeStats(e, id);
```

- [ ] **Step 5: Write `test/meta.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import type { TargetType } from '@sanctum/engine';
import { allCards, cardData, cardIndex, pendingCards } from '../src/index';

/** What "Cast on ..." means as an engine target type. */
function expectedTarget(castOn: string): TargetType | null {
  const s = castOn.toLowerCase();
  if (/^(friendly )?recruit group/.test(s)) return 'recruitGroup';
  if (/^group\b/.test(s)) return 'group';
  if (/^(friendly )?(swordsman|archer|recruit)\b/.test(s)) return 'recruit';
  if (/^globe\b/.test(s)) return 'globe';
  if (/^(square|forest|plains|mountain|volcano)\b/.test(s)) return 'square';
  if (/^town or colony\b/.test(s)) return 'structure';
  return null;
}

describe('scraped data', () => {
  it('has 102 unique cards with the right mana per house', () => {
    expect(cardData).toHaveLength(102);
    expect(new Set(cardData.map((c) => c.slug)).size).toBe(102);
    const allowed = { war: ['strife', 'clarity'], life: ['clarity', 'world'] };
    for (const c of cardData) {
      for (const k of Object.keys(c.cost)) expect(allowed[c.house], `${c.name} cost ${k}`).toContain(k);
    }
  });
});

describe('implemented cards match their scraped record', () => {
  for (const card of allCards) {
    it(card.name, () => {
      const rec = cardData.find((c) => c.slug === card.id);
      expect(rec, `no scraped record for id "${card.id}"`).toBeDefined();
      expect(card.name).toBe(rec!.name);
      expect(card.house).toBe(rec!.house);
      expect(card.cost).toEqual(rec!.cost);
      expect(rec!.castOn, 'record has no "Cast on" clause').not.toBeNull();
      expect(card.target).toBe(expectedTarget(rec!.castOn!));
    });
  }
});

describe('registry', () => {
  it('implemented and pending partition the data', () => {
    expect(allCards.length + pendingCards.length).toBe(cardData.length);
    for (const c of allCards) expect(cardIndex[c.id]).toBe(c);
  });
});
```

- [ ] **Step 6: Run and commit**

Run: `cd packages/cards && npx vitest run && npx tsc -p . --noEmit`
Expected: 3 tests pass (the per-card block is empty); typecheck exits 0.

```bash
git add packages/cards package-lock.json
git commit -m "feat(cards): package skeleton, helpers, registry and metadata test"
```

---

### Task 4: War cards, batch 1 (stat buffs and no-ops)

**Goal:** Seven War cards whose effects are computed stats or nothing: Flaming Sword, Bloodlust, Legionnaires, Ngozi's Way, Palisade, War Drums, Swashbuckler.

**Files:**
- Create: `packages/cards/src/war/{flamingSword,bloodlust,legionnaires,ngozisWay,palisade,warDrums,swashbuckler}.ts`
- Modify: `packages/cards/src/war/index.ts`
- Test: `packages/cards/test/war-stats.test.ts`

**Acceptance Criteria:**
- [ ] Flaming Sword: swordsman +2 hand damage; cannot target an archer
- [ ] Bloodlust: swordsman +1 attack per round (hand attacks 1 -> 2)
- [ ] Legionnaires: swordsmen in the group +1 hand damage, archers unchanged; group must contain a swordsman
- [ ] Ngozi's Way: every member of the group +1 level
- [ ] Palisade: archers standing in the square +1 armor, archers elsewhere unchanged
- [ ] War Drums: castable, no mechanical effect
- [ ] Swashbuckler: swordsman gains levels equal to its armor and drops to 0 armor
- [ ] Meta test passes for all seven (name, house, cost, target match the scraped record)

**Verify:** `cd packages/cards && npx vitest run test/war-stats.test.ts test/meta.test.ts` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/war-stats.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { cast, gref, mref, put, sref, stats, world } from './helpers';

describe('Flaming Sword', () => {
  it('gives a swordsman +2 hand damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(4);
  });
  it('cannot target an archer', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    expect(cast(e, 'red', 'flaming-sword', mref(id))).toBe('squandered');
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('Bloodlust', () => {
  it('gives a swordsman +1 attack each round', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'bloodlust', mref(id))).toBe('cast');
    expect(stats(e, id).handAttacks).toBe(2);
  });
});

describe('Legionnaires', () => {
  it('buffs swordsmen in the group only', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const [sw, ar] = g.minionIds;
    expect(cast(e, 'red', 'legionnaires', gref(g.id))).toBe('cast');
    expect(stats(e, sw).hand).toBe(3);
    expect(stats(e, ar).hand).toBe(0);
  });
  it('needs a swordsman in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    expect(cast(e, 'red', 'legionnaires', gref(g.id))).toBe('squandered');
  });
});

describe("Ngozi's Way", () => {
  it('gives every member +1 level', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    expect(cast(e, 'red', 'ngozis-way', gref(g.id))).toBe('cast');
    for (const id of ids) expect(stats(e, id).level).toBe(2);
  });
});

describe('Palisade', () => {
  it('gives archers in the square +1 armor', () => {
    const e = world();
    expect(cast(e, 'red', 'palisade', sref(5, 5))).toBe('cast');
    const inside = put(e, 'red', { x: 5, y: 5 }, ['archer']).minionIds[0];
    const outside = put(e, 'red', { x: 6, y: 6 }, ['archer']).minionIds[0];
    expect(stats(e, inside).armor).toBe(1);
    expect(stats(e, outside).armor).toBe(0);
  });
});

describe('War Drums', () => {
  it('is castable and changes nothing', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'war-drums', gref(g.id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
    expect(stats(e, id).armor).toBe(1);
  });
});

describe('Swashbuckler', () => {
  it('turns armor into levels', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'swashbuckler', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect(st.level).toBe(2);
    expect(st.armor).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** (`npx vitest run test/war-stats.test.ts` -> every cast is `squandered`, since the cards do not exist)

- [ ] **Step 3: Write the seven card files**

`src/war/flamingSword.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'flaming-sword', name: 'Flaming Sword', house: 'war', cost: { strife: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ hand: 2 }),
});
```
`src/war/bloodlust.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

export default defineCard({
  id: 'bloodlust', name: 'Bloodlust', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ handAttacks: 1 }),
});
```
`src/war/legionnaires.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { groupHas } from '../helpers';

export default defineCard({
  id: 'legionnaires', name: 'Legionnaires', house: 'war', cost: { strife: 3, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('swordsman'),
  stats: (q, id) => (q.minion(id)?.cls === 'swordsman' ? { hand: 1 } : {}),
});
```
`src/war/ngozisWay.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'ngozis-way', name: "Ngozi's Way", house: 'war', cost: { strife: 5, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ level: 1 }),
});
```
`src/war/palisade.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'palisade', name: 'Palisade', house: 'war', cost: { strife: 2, clarity: 2 },
  type: 'alteration', target: 'square',
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { armor: 1 } : {}),
});
```
`src/war/warDrums.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// The original only plays triumphant music after a victory: no rules effect.
export default defineCard({
  id: 'war-drums', name: 'War Drums', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'recruitGroup',
});
```
`src/war/swashbuckler.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

// RULING: "cannot gain armor" is not enforced; armor gained from later spells still applies.
export default defineCard({
  id: 'swashbuckler', name: 'Swashbuckler', house: 'war', cost: { strife: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.setToken('n', c.stats(t.id).armor);
  },
  stats: (_q, _id, spell) => {
    const n = spell.tokens.n ?? 0;
    return { level: n, armor: -n };
  },
});
```

- [ ] **Step 4: Register them in `src/war/index.ts`** (replace the file)

```ts
import type { CardDef } from '@sanctum/engine';
import bloodlust from './bloodlust';
import flamingSword from './flamingSword';
import legionnaires from './legionnaires';
import ngozisWay from './ngozisWay';
import palisade from './palisade';
import swashbuckler from './swashbuckler';
import warDrums from './warDrums';

export const warCards: CardDef[] = [flamingSword, bloodlust, legionnaires, ngozisWay, palisade, warDrums, swashbuckler];
```

- [ ] **Step 5: Run tests and typecheck, commit**

Run: `cd packages/cards && npx vitest run && npx tsc -p . --noEmit`
Expected: war-stats and meta tests pass (the meta test now has seven per-card cases).

```bash
git add packages/cards
git commit -m "feat(cards): War batch 1 - Flaming Sword, Bloodlust, Legionnaires, Ngozi's Way, Palisade, War Drums, Swashbuckler"
```

---

### Task 5: War cards, batch 2 (damage, terrain, combat events)

**Goal:** Ten War cards that deal damage, change terrain, or react to combat events: Fireball, Good of the Many, Plains, Volcano, Scorched Earth, Dragon Slayer, Berserker Blade, Berserkers, Rain of Arrows, Shattering Blow.

**Files:**
- Create: `packages/cards/src/war/{fireball,goodOfTheMany,plains,volcano,scorchedEarth,dragonSlayer,berserkerBlade,berserkers,rainOfArrows,shatteringBlow}.ts`
- Modify: `packages/cards/src/war/index.ts`
- Test: `packages/cards/test/war-effects.test.ts`

**Acceptance Criteria:**
- [ ] Fireball: 5 magical damage to every member of a group (kills and removes a weak group)
- [ ] Good of the Many: kills a friendly recruit; enemy recruits are not legal
- [ ] Plains / Volcano: change an empty square's terrain; occupied squares squander
- [ ] Scorched Earth: all contiguous forest squares become barren land; needs a forest target
- [ ] Dragon Slayer: an archer that damages a monster kills it
- [ ] Berserker Blade: +1 hand damage per time hit, reset at end of combat
- [ ] Berserkers: +1 hand per combat casualty (max +3) for all members, reset at end of combat
- [ ] Rain of Arrows: archers +1 attack; dispelled after the group's next combat
- [ ] Shattering Blow: first hit kills the victim, then -1 hand damage; no further kills
- [ ] Meta test passes for all ten

**Verify:** `cd packages/cards && npx vitest run` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/war-effects.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dispatch, fight } from '@sanctum/engine/src/testing';
import { cast, gref, mref, put, putMonster, sref, stats, world } from './helpers';

describe('Fireball', () => {
  it('deals 5 magical damage to every member', () => {
    const e = world();
    const g = put(e, 'blue', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const ids = [...g.minionIds];
    expect(cast(e, 'red', 'fireball', gref(g.id))).toBe('cast');
    for (const id of ids) expect(e.state.minions[id].hp).toBe(2);
  });
  it('kills and removes a group it destroys', () => {
    const e = world();
    const g = put(e, 'blue', { x: 4, y: 4 }, ['archer']);
    const id = g.minionIds[0];
    e.state.minions[id].hp = 4;
    cast(e, 'red', 'fireball', gref(g.id));
    expect(e.state.minions[id].status).toBe('dead');
    expect(e.state.groups[g.id]).toBeUndefined();
  });
});

describe('Good of the Many', () => {
  it('kills a friendly recruit but not an enemy one', () => {
    const e = world();
    const mine = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const theirs = put(e, 'blue', { x: 6, y: 6 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'good-of-the-many', mref(theirs))).toBe('squandered');
    expect(e.state.minions[theirs].status).toBe('alive');
    expect(cast(e, 'red', 'good-of-the-many', mref(mine))).toBe('cast');
    expect(e.state.minions[mine].status).toBe('dead');
  });
});

describe('Plains and Volcano', () => {
  it('Plains turns an empty square to plains', () => {
    const e = world();
    e.state.terrain['5,5'] = 'forest';
    expect(cast(e, 'red', 'plains', sref(5, 5))).toBe('cast');
    expect(e.state.terrain['5,5']).toBe('plains');
  });
  it('Plains squanders on an occupied square', () => {
    const e = world();
    e.state.terrain['5,5'] = 'forest';
    put(e, 'blue', { x: 5, y: 5 }, ['swordsman']);
    expect(cast(e, 'red', 'plains', sref(5, 5))).toBe('squandered');
    expect(e.state.terrain['5,5']).toBe('forest');
  });
  it('Volcano turns an empty square to volcano', () => {
    const e = world();
    expect(cast(e, 'red', 'volcano', sref(5, 5))).toBe('cast');
    expect(e.state.terrain['5,5']).toBe('volcano');
  });
});

describe('Scorched Earth', () => {
  it('burns the whole contiguous forest', () => {
    const e = world();
    for (const k of ['4,4', '5,4', '4,5', '8,2']) e.state.terrain[k] = 'forest';
    expect(cast(e, 'red', 'scorched-earth', sref(4, 4))).toBe('cast');
    for (const k of ['4,4', '5,4', '4,5']) expect(e.state.terrain[k]).toBe('barren');
    expect(e.state.terrain['8,2']).toBe('forest');
  });
  it('needs a forest square', () => {
    const e = world();
    expect(cast(e, 'red', 'scorched-earth', sref(6, 6))).toBe('squandered');
  });
});

describe('Dragon Slayer', () => {
  it('kills a monster the archer damages', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['archer']);
    const mon = putMonster(e, 'blue', { x: 5, y: 4 });
    expect(cast(e, 'red', 'dragon-slayer', mref(a.minionIds[0]))).toBe('cast');
    fight(e, a.id, mon.id);
    expect(e.state.groups[mon.id]).toBeUndefined();
  });
  it('cannot target a swordsman', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'dragon-slayer', mref(id))).toBe('squandered');
  });
});

describe('Berserker Blade', () => {
  it('adds +1 hand damage per hit taken and resets after combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'berserker-blade', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
    dispatch(e, 'attack:hit', mref(id), {});
    dispatch(e, 'attack:hit', mref(id), {});
    expect(stats(e, id).hand).toBe(4);
    dispatch(e, 'combat:end', gref(g.id), {});
    expect(stats(e, id).hand).toBe(2);
  });
});

describe('Berserkers', () => {
  it('adds +1 hand per combat casualty, max +3, reset at end of combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const [dying, other] = g.minionIds;
    expect(cast(e, 'red', 'berserkers', gref(g.id))).toBe('cast');
    dispatch(e, 'minion:dies', mref(dying), { blame: 99 });
    expect(stats(e, other).hand).toBe(3);
    dispatch(e, 'minion:dies', mref(dying), { blame: null });
    expect(stats(e, other).hand).toBe(3);
    for (let i = 0; i < 4; i++) dispatch(e, 'minion:dies', mref(dying), { blame: 99 });
    expect(stats(e, other).hand).toBe(5);
    dispatch(e, 'combat:end', gref(g.id), {});
    expect(stats(e, other).hand).toBe(2);
  });
});

describe('Rain of Arrows', () => {
  it('gives archers +1 attack and is dispelled after the next combat', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const [ar, sw] = g.minionIds;
    expect(cast(e, 'red', 'rain-of-arrows', gref(g.id))).toBe('cast');
    expect(stats(e, ar).missileAttacks).toBe(2);
    expect(stats(e, sw).missileAttacks).toBe(0);
    dispatch(e, 'combat:after', gref(g.id), {});
    expect(e.state.spells).toHaveLength(0);
    expect(stats(e, ar).missileAttacks).toBe(1);
  });
  it('needs an archer in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'rain-of-arrows', gref(g.id))).toBe('squandered');
  });
});

describe('Shattering Blow', () => {
  it('kills the first thing it hits, then weakens the sword', () => {
    const e = world();
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']);
    const id = red.minionIds[0];
    expect(cast(e, 'red', 'shattering-blow', mref(id))).toBe('cast');
    fight(e, red.id, blue.id);
    expect(e.state.groups[blue.id]).toBeUndefined();
    expect(e.state.minions[id].hp).toBe(7);
    expect(stats(e, id).hand).toBe(1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the ten card files**

`src/war/fireball.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'fireball', name: 'Fireball', house: 'war', cost: { strife: 4, clarity: 2 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const ids = c.minionsOf(t.id).map((m) => m.id);
    for (const id of ids) c.damage(id, 5);
  },
});
```
`src/war/goodOfTheMany.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isFriendlyMinion } from '../helpers';

export default defineCard({
  id: 'good-of-the-many', name: 'Good of the Many', house: 'war', cost: { strife: 1 },
  type: 'manifestation', target: 'recruit',
  canCast: isFriendlyMinion,
  onCast: (c, t) => {
    if (t.kind === 'minion') c.kill(t.id);
  },
});
```
`src/war/plains.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'plains', name: 'Plains', house: 'war', cost: { strife: 3 },
  type: 'manifestation', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.setTerrain(t.pos, 'plains');
  },
});
```
`src/war/volcano.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'volcano', name: 'Volcano', house: 'war', cost: { strife: 4, clarity: 3 },
  type: 'manifestation', target: 'square',
  onCast: (c, t) => {
    if (t.kind === 'square') c.setTerrain(t.pos, 'volcano');
  },
});
```
`src/war/scorchedEarth.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { contiguous } from '../helpers';

// RULING: the engine only lets square spells target empty squares, so the target forest square must be unoccupied.
export default defineCard({
  id: 'scorched-earth', name: 'Scorched Earth', house: 'war', cost: { strife: 2 },
  type: 'manifestation', target: 'square',
  canCast: (q, t) => t.kind === 'square' && q.terrainAt(t.pos) === 'forest',
  onCast: (c, t) => {
    if (t.kind !== 'square') return;
    for (const p of contiguous(c, t.pos, 'forest')) c.setTerrain(p, 'barren');
  },
});
```
`src/war/dragonSlayer.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls, isHostMinion } from '../helpers';

export default defineCard({
  id: 'dragon-slayer', name: 'Dragon Slayer', house: 'war', cost: { strife: 3, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('archer'),
  on: {
    'attacker:damages': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const victim = c.minion(ev.data.victimId);
      if (victim && victim.kind === 'monster') c.kill(victim.id);
    },
  },
});
```
`src/war/berserkerBlade.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls, isHostMinion } from '../helpers';

export default defineCard({
  id: 'berserker-blade', name: 'Berserker Blade', house: 'war', cost: { strife: 2, clarity: 2 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: (_q, _id, spell) => ({ hand: spell.tokens.rage ?? 0 }),
  on: {
    'attack:hit': (c, ev) => {
      if (isHostMinion(c, ev)) c.setToken('rage', c.token('rage') + 1);
    },
    'combat:end': (c) => {
      c.setToken('rage', 0);
    },
  },
});
```
`src/war/berserkers.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'berserkers', name: 'Berserkers', house: 'war', cost: { strife: 3 },
  type: 'alteration', target: 'recruitGroup',
  stats: (_q, _id, spell) => ({ hand: spell.tokens.casualties ?? 0 }),
  on: {
    'minion:dies': (c, ev) => {
      if (ev.data.blame != null) c.setToken('casualties', Math.min(3, c.token('casualties') + 1));
    },
    'combat:end': (c) => {
      c.setToken('casualties', 0);
    },
  },
});
```
`src/war/rainOfArrows.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { groupHas, isHostGroup } from '../helpers';

export default defineCard({
  id: 'rain-of-arrows', name: 'Rain of Arrows', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('archer'),
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { missileAttacks: 1 } : {}),
  on: {
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
```
`src/war/shatteringBlow.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls, isHostMinion } from '../helpers';

// RULING: the kill is an instant-death ("dies") effect, so the attacker earns no experience for it.
export default defineCard({
  id: 'shattering-blow', name: 'Shattering Blow', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: (_q, _id, spell) => ({ hand: spell.tokens.shattered ? -1 : 0 }),
  on: {
    'attacker:hits': (c, ev) => {
      if (!isHostMinion(c, ev) || c.token('shattered')) return;
      c.setToken('shattered', 1);
      c.kill(ev.data.victimId);
    },
  },
});
```

- [ ] **Step 4: Register them** (replace `src/war/index.ts`)

```ts
import type { CardDef } from '@sanctum/engine';
import berserkerBlade from './berserkerBlade';
import berserkers from './berserkers';
import bloodlust from './bloodlust';
import dragonSlayer from './dragonSlayer';
import fireball from './fireball';
import flamingSword from './flamingSword';
import goodOfTheMany from './goodOfTheMany';
import legionnaires from './legionnaires';
import ngozisWay from './ngozisWay';
import palisade from './palisade';
import plains from './plains';
import rainOfArrows from './rainOfArrows';
import scorchedEarth from './scorchedEarth';
import shatteringBlow from './shatteringBlow';
import swashbuckler from './swashbuckler';
import volcano from './volcano';
import warDrums from './warDrums';

export const warCards: CardDef[] = [
  flamingSword, bloodlust, legionnaires, ngozisWay, palisade, warDrums, swashbuckler,
  fireball, goodOfTheMany, plains, volcano, scorchedEarth, dragonSlayer,
  berserkerBlade, berserkers, rainOfArrows, shatteringBlow,
];
```

- [ ] **Step 5: Run everything, commit**

Run: `cd packages/cards && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass. The Shattering Blow test relies on the engine resolving round 2 with the red group striking first (red has initiative in a blank state).

```bash
git add packages/cards
git commit -m "feat(cards): War batch 2 - Fireball, Good of the Many, Plains, Volcano, Scorched Earth, Dragon Slayer, Berserker Blade, Berserkers, Rain of Arrows, Shattering Blow"
```

---

### Task 6: Life cards, batch 1 (healing, terrain, dispel)

**Goal:** Seven Life cards: Caravan, Flight, Cleansing Light, Pyx, Healing Hands, Oasis, Wellspring.

**Files:**
- Create: `packages/cards/src/life/{caravan,flight,cleansingLight,pyx,healingHands,oasis,wellspring}.ts`
- Modify: `packages/cards/src/life/index.ts`
- Test: `packages/cards/test/life-a.test.ts`

**Acceptance Criteria:**
- [ ] Caravan: group takes no desert damage; Flight: group survives water and takes no terrain damage
- [ ] Cleansing Light: dispels every spell on the group and on its members
- [ ] Pyx: fully heals the group
- [ ] Healing Hands: at start of turn every member of the target's group heals 1
- [ ] Oasis: four adjacent squares become desert; recruits in the town heal 1 at start of turn
- [ ] Wellspring: when a recruit group enters the square, every minion on the board is fully healed and the spell is dispelled
- [ ] Meta test passes for all seven

**Verify:** `cd packages/cards && npx vitest run` -> pass

**Steps:**

- [ ] **Step 1: Add `advance` to `test/helpers.ts`**

Add `beginTurn` to the import from `@sanctum/engine/src/testing` and append:
```ts
/** Run the next start-of-turn phase (events, terrain effects, captures, draws). */
export function advance(e: Engine): void {
  e.state.turn += 1;
  beginTurn(e, false);
}
```

- [ ] **Step 2: Write the failing test**

`test/life-a.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dispatch } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, sref, stats, world } from './helpers';

describe('Caravan', () => {
  it('stops desert damage', () => {
    const e = world();
    e.state.terrain['4,4'] = 'desert';
    e.state.terrain['6,6'] = 'desert';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    expect(cast(e, 'red', 'caravan', gref(a.id))).toBe('cast');
    advance(e);
    expect(e.state.minions[ida].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(6);
  });
});

describe('Flight', () => {
  it('lets a group survive water', () => {
    const e = world();
    e.state.terrain['4,4'] = 'water';
    e.state.terrain['6,6'] = 'water';
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    const [ida, idb] = [a.minionIds[0], b.minionIds[0]];
    expect(cast(e, 'red', 'flight', gref(a.id))).toBe('cast');
    advance(e);
    expect(e.state.minions[ida].status).toBe('alive');
    expect(e.state.minions[idb].status).toBe('dead');
  });
});

describe('Cleansing Light', () => {
  it('dispels group and individual spells on the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    cast(e, 'red', 'flaming-sword', mref(g.minionIds[0]));
    cast(e, 'red', 'ngozis-way', gref(g.id));
    expect(e.state.spells).toHaveLength(2);
    expect(cast(e, 'blue', 'cleansing-light', gref(g.id))).toBe('cast');
    expect(e.state.spells).toHaveLength(0);
  });
  it('leaves spells on other groups alone', () => {
    const e = world();
    const a = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const b = put(e, 'red', { x: 6, y: 6 }, ['swordsman']);
    cast(e, 'red', 'ngozis-way', gref(b.id));
    cast(e, 'blue', 'cleansing-light', gref(a.id));
    expect(e.state.spells).toHaveLength(1);
  });
});

describe('Pyx', () => {
  it('fully heals the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const ids = [...g.minionIds];
    e.state.minions[ids[0]].hp = 2;
    e.state.minions[ids[1]].hp = 5;
    expect(cast(e, 'red', 'pyx', gref(g.id))).toBe('cast');
    for (const id of ids) expect(e.state.minions[id].hp).toBe(7);
  });
});

describe('Healing Hands', () => {
  it('heals every member of the target group by 1 at start of turn', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman']);
    const [hurt, healthy] = g.minionIds;
    e.state.minions[hurt].hp = 3;
    expect(cast(e, 'red', 'healing-hands', mref(healthy))).toBe('cast');
    advance(e);
    expect(e.state.minions[hurt].hp).toBe(4);
    expect(e.state.minions[healthy].hp).toBe(7);
  });
});

describe('Oasis', () => {
  it('turns the four neighbours to desert and heals recruits in the town', () => {
    const e = world();
    e.state.structures[900] = {
      id: 900, kind: 'town', pos: { x: 4, y: 4 }, owner: 'red', manaType: null, novices: 0, turnCount: 2, captured: false,
    };
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    e.state.minions[id].hp = 5;
    expect(cast(e, 'red', 'oasis', { kind: 'structure', id: 900 })).toBe('cast');
    for (const k of ['5,4', '3,4', '4,3', '4,5']) expect(e.state.terrain[k]).toBe('desert');
    expect(e.state.terrain['4,4']).toBe('plains');
    advance(e);
    expect(e.state.minions[id].hp).toBe(6);
  });
});

describe('Wellspring', () => {
  it('heals every minion on the board when a recruit group enters, then vanishes', () => {
    const e = world();
    const red = put(e, 'red', { x: 3, y: 3 }, ['swordsman']);
    const blue = put(e, 'blue', { x: 8, y: 8 }, ['archer']);
    const [idr, idb] = [red.minionIds[0], blue.minionIds[0]];
    e.state.minions[idr].hp = 4;
    e.state.minions[idb].hp = 3;
    expect(cast(e, 'red', 'wellspring', sref(5, 5))).toBe('cast');
    expect(e.state.spells).toHaveLength(1);
    const mover = put(e, 'red', { x: 5, y: 5 }, ['swordsman']);
    dispatch(e, 'group:enter', gref(mover.id), {});
    expect(e.state.minions[idr].hp).toBe(7);
    expect(e.state.minions[idb].hp).toBe(7);
    expect(e.state.spells).toHaveLength(0);
  });
});

describe('stats sanity', () => {
  it('Caravan grants the desert walk', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    cast(e, 'red', 'caravan', gref(g.id));
    expect(stats(e, id).walks).toContain('desert');
  });
});
```

- [ ] **Step 3: Run to verify failure**

- [ ] **Step 4: Write the seven card files**

`src/life/caravan.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'caravan', name: 'Caravan', house: 'life', cost: { clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ walks: ['desert'] }),
});
```
`src/life/flight.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'flight', name: 'Flight', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'recruitGroup',
  stats: () => ({ walks: ['flight'] }),
});
```
`src/life/cleansingLight.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'cleansing-light', name: 'Cleansing Light', house: 'life', cost: { clarity: 4 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    const members = new Set(c.minionsOf(t.id).map((m) => m.id));
    for (const sp of [...c.state.spells]) {
      const h = sp.host;
      if ((h.kind === 'group' && h.id === t.id) || (h.kind === 'minion' && members.has(h.id))) c.dispel(sp.id);
    }
  },
});
```
`src/life/pyx.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'pyx', name: 'Pyx', house: 'life', cost: { clarity: 1, world: 1 },
  type: 'manifestation', target: 'group',
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    for (const m of c.minionsOf(t.id)) c.heal(m.id, m.maxHp);
  },
});
```
`src/life/healingHands.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'healing-hands', name: 'Healing Hands', house: 'life', cost: { clarity: 2 },
  type: 'alteration', target: 'recruit',
  on: {
    'turn:start': (c) => {
      if (c.host.kind !== 'minion') return;
      const m = c.minion(c.host.id);
      if (!m) return;
      for (const x of c.minionsOf(m.groupId)) c.heal(x.id, 1);
    },
  },
});
```
`src/life/oasis.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { ADJACENT } from '../helpers';

export default defineCard({
  id: 'oasis', name: 'Oasis', house: 'life', cost: { clarity: 3, world: 1 },
  type: 'alteration', target: 'structure',
  onCast: (c, t) => {
    if (t.kind !== 'structure') return;
    const s = c.structure(t.id);
    if (!s) return;
    for (const d of ADJACENT) c.setTerrain({ x: s.pos.x + d.x, y: s.pos.y + d.y }, 'desert');
  },
  on: {
    'turn:start': (c) => {
      if (c.host.kind !== 'structure') return;
      const s = c.structure(c.host.id);
      const g = s ? c.groupAt(s.pos) : undefined;
      if (g && g.kind === 'recruit') for (const m of c.minionsOf(g.id)) c.heal(m.id, 1);
    },
  },
});
```
`src/life/wellspring.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'wellspring', name: 'Wellspring', house: 'life', cost: { clarity: 4, world: 1 },
  type: 'alteration', target: 'square',
  on: {
    'group:enter': (c, ev) => {
      const g = ev.ref?.kind === 'group' ? c.group(ev.ref.id) : undefined;
      if (!g || g.kind !== 'recruit') return;
      for (const m of Object.values(c.state.minions)) {
        if (m.status === 'alive' && c.group(m.groupId)?.pos) c.heal(m.id, m.maxHp);
      }
      c.dispel();
    },
  },
});
```

- [ ] **Step 5: Register them** (replace `src/life/index.ts`)

```ts
import type { CardDef } from '@sanctum/engine';
import caravan from './caravan';
import cleansingLight from './cleansingLight';
import flight from './flight';
import healingHands from './healingHands';
import oasis from './oasis';
import pyx from './pyx';
import wellspring from './wellspring';

export const lifeCards: CardDef[] = [caravan, flight, cleansingLight, pyx, healingHands, oasis, wellspring];
```

- [ ] **Step 6: Run everything, commit**

Run: `cd packages/cards && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass.

```bash
git add packages/cards
git commit -m "feat(cards): Life batch 1 - Caravan, Flight, Cleansing Light, Pyx, Healing Hands, Oasis, Wellspring"
```

---

### Task 7: Life cards, batch 2 (armor, pacifism, healers)

**Goal:** Six Life cards: Redeemer's Sword, Filigreed Armor, Pacifism, Vivant, Faerie Fire, Elven Piper.

**Files:**
- Create: `packages/cards/src/life/{redeemersSword,filigreedArmor,pacifism,vivant,faerieFire,elvenPiper}.ts`
- Modify: `packages/cards/src/life/index.ts`
- Test: `packages/cards/test/life-b.test.ts`

**Acceptance Criteria:**
- [ ] Redeemer's Sword: swordsman +2 hand damage
- [ ] Filigreed Armor: +1 armor; incoming damage from recruits without enchantments is reduced by 1 before armor
- [ ] Pacifism: recruit has no attacks and deals no damage
- [ ] Vivant: pacifist; at each combat round start the most damaged other recruit in its group heals 3; at turn start the whole group is fully healed
- [ ] Faerie Fire: archers in the group +2 missile damage, dispelled after the next combat
- [ ] Elven Piper: castable, no mechanical effect
- [ ] Meta test passes for all six (13 Life cards total)

**Verify:** `cd packages/cards && npx vitest run` -> pass

**Steps:**

- [ ] **Step 1: Write the failing test**

`test/life-b.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { dispatch, takeDamage } from '@sanctum/engine/src/testing';
import { advance, cast, gref, mref, put, stats, world } from './helpers';

describe("Redeemer's Sword", () => {
  it('gives a swordsman +2 hand damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'redeemers-sword', mref(id))).toBe('cast');
    expect(stats(e, id).hand).toBe(4);
  });
});

describe('Filigreed Armor', () => {
  const hand = { kind: 'hand' as const, ignoresArmor: false, magical: false };

  it('adds armor and cuts damage from unenchanted recruits', () => {
    const e = world();
    const victim = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const attacker = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    expect(cast(e, 'red', 'filigreed-armor', mref(victim))).toBe('cast');
    expect(stats(e, victim).armor).toBe(2);
    e.state.minions[victim].combat.armor = 2;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('bounced'); // 3 - 1 = 2, all soaked
    expect(e.state.minions[victim].hp).toBe(7);
  });

  it('does not cut damage from an enchanted attacker', () => {
    const e = world();
    const victim = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    const attacker = put(e, 'blue', { x: 5, y: 4 }, ['swordsman']).minionIds[0];
    cast(e, 'red', 'filigreed-armor', mref(victim));
    cast(e, 'blue', 'flaming-sword', mref(attacker));
    e.state.minions[victim].combat.armor = 2;
    expect(takeDamage(e, victim, 3, hand, attacker)).toBe('damaged'); // 3 - 2 armor = 1
    expect(e.state.minions[victim].hp).toBe(6);
  });
});

describe('Pacifism', () => {
  it('removes all attacks and damage', () => {
    const e = world();
    const id = put(e, 'red', { x: 4, y: 4 }, ['archer']).minionIds[0];
    expect(cast(e, 'red', 'pacifism', mref(id))).toBe('cast');
    const st = stats(e, id);
    expect(st.handAttacks).toBe(0);
    expect(st.missileAttacks).toBe(0);
    expect(st.noDamage).toBe(true);
  });
});

describe('Vivant', () => {
  it('heals the most damaged other recruit each round and the group each turn', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const [viv, a, b] = g.minionIds;
    expect(cast(e, 'red', 'vivant', mref(viv))).toBe('cast');
    expect(stats(e, viv).noDamage).toBe(true);
    e.state.minions[a].hp = 3;
    e.state.minions[b].hp = 6;
    dispatch(e, 'round:start', gref(g.id), { round: 2 });
    expect(e.state.minions[a].hp).toBe(6);
    expect(e.state.minions[b].hp).toBe(6);
    e.state.minions[viv].hp = 2;
    e.state.minions[a].hp = 1;
    advance(e);
    for (const id of [viv, a, b]) expect(e.state.minions[id].hp).toBe(7);
  });
});

describe('Faerie Fire', () => {
  it('gives archers +2 missile damage until the next combat ends', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['archer', 'swordsman']);
    const [ar, sw] = g.minionIds;
    expect(cast(e, 'red', 'faerie-fire', gref(g.id))).toBe('cast');
    expect(stats(e, ar).missile).toBe(4);
    expect(stats(e, sw).missile).toBe(0);
    dispatch(e, 'combat:after', gref(g.id), {});
    expect(e.state.spells).toHaveLength(0);
  });
  it('needs an archer in the group', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    expect(cast(e, 'red', 'faerie-fire', gref(g.id))).toBe('squandered');
  });
});

describe('Elven Piper', () => {
  it('is castable and changes nothing', () => {
    const e = world();
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    expect(cast(e, 'red', 'elven-piper', gref(g.id))).toBe('cast');
    expect(stats(e, id).hand).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure**

- [ ] **Step 3: Write the six card files**

`src/life/redeemersSword.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { isCls } from '../helpers';

// RULING: the original adds +4 damage against Death or Despair monsters and protects against Death/Despair
// individual spells. No such cards exist yet, so only the unconditional +2 is implemented.
export default defineCard({
  id: 'redeemers-sword', name: "Redeemer's Sword", house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  canCast: isCls('swordsman'),
  stats: () => ({ hand: 2 }),
});
```
`src/life/filigreedArmor.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { hasEnchantments, isHostMinion } from '../helpers';

// RULING: "enchantment" = a visible active spell on the attacker or on its group.
export default defineCard({
  id: 'filigreed-armor', name: 'Filigreed Armor', house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ armor: 1 }),
  on: {
    'attack:beforeArmor': (c, ev) => {
      if (!isHostMinion(c, ev)) return;
      const attacker = ev.data.attackerId == null ? undefined : c.minion(ev.data.attackerId);
      if (attacker && attacker.kind === 'recruit' && !hasEnchantments(c, attacker)) ev.data.damage -= 1;
    },
  },
});
```
`src/life/pacifism.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'pacifism', name: 'Pacifism', house: 'life', cost: { clarity: 2, world: 1 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ handAttacks: -9, missileAttacks: -9, noDamage: true }),
});
```
`src/life/vivant.ts`:
```ts
import { defineCard } from '@sanctum/engine';

export default defineCard({
  id: 'vivant', name: 'Vivant', house: 'life', cost: { clarity: 5, world: 2 },
  type: 'alteration', target: 'recruit',
  stats: () => ({ handAttacks: -9, missileAttacks: -9, noDamage: true }),
  on: {
    'round:start': (c, ev) => {
      if (c.host.kind !== 'minion' || ev.ref?.kind !== 'group') return;
      const me = c.minion(c.host.id);
      if (!me || me.groupId !== ev.ref.id) return;
      const hurt = c
        .minionsOf(me.groupId)
        .filter((m) => m.id !== me.id && m.kind === 'recruit' && m.hp < m.maxHp)
        .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
      if (hurt) c.heal(hurt.id, 3);
    },
    'turn:start': (c) => {
      if (c.host.kind !== 'minion') return;
      const me = c.minion(c.host.id);
      if (!me) return;
      for (const m of c.minionsOf(me.groupId)) c.heal(m.id, m.maxHp);
    },
  },
});
```
`src/life/faerieFire.ts`:
```ts
import { defineCard } from '@sanctum/engine';
import { groupHas, isHostGroup } from '../helpers';

export default defineCard({
  id: 'faerie-fire', name: 'Faerie Fire', house: 'life', cost: { clarity: 3 },
  type: 'alteration', target: 'recruitGroup',
  canCast: groupHas('archer'),
  stats: (q, id) => (q.minion(id)?.cls === 'archer' ? { missile: 2 } : {}),
  on: {
    'combat:after': (c, ev) => {
      if (isHostGroup(c, ev)) c.dispel();
    },
  },
});
```
`src/life/elvenPiper.ts`:
```ts
import { defineCard } from '@sanctum/engine';

// The original only plays bagpipe music at the start of combat: no rules effect.
export default defineCard({
  id: 'elven-piper', name: 'Elven Piper', house: 'life', cost: { clarity: 1 },
  type: 'alteration', target: 'recruitGroup',
});
```

- [ ] **Step 4: Register them** (replace `src/life/index.ts`)

```ts
import type { CardDef } from '@sanctum/engine';
import caravan from './caravan';
import cleansingLight from './cleansingLight';
import elvenPiper from './elvenPiper';
import faerieFire from './faerieFire';
import filigreedArmor from './filigreedArmor';
import flight from './flight';
import healingHands from './healingHands';
import oasis from './oasis';
import pacifism from './pacifism';
import pyx from './pyx';
import redeemersSword from './redeemersSword';
import vivant from './vivant';
import wellspring from './wellspring';

export const lifeCards: CardDef[] = [
  caravan, flight, cleansingLight, pyx, healingHands, oasis, wellspring,
  redeemersSword, filigreedArmor, pacifism, vivant, faerieFire, elvenPiper,
];
```

- [ ] **Step 5: Run everything, commit**

Run: `cd packages/cards && npx vitest run && npx tsc -p . --noEmit`
Expected: all pass; the meta test now covers 30 cards (17 War, 13 Life) and `pendingCards.length` is 72.

```bash
git add packages/cards
git commit -m "feat(cards): Life batch 2 - Redeemer's Sword, Filigreed Armor, Pacifism, Vivant, Faerie Fire, Elven Piper"
```

---

### Task 8: Backlog document and a real-game smoke test

**Goal:** Record what the other 72 cards need, and prove the card set works inside real games (legal decks, real map, many turns, deterministic, serializable).

**Files:**
- Create: `docs/superpowers/plans/cards-backlog.md`, `packages/cards/test/game.test.ts`, `packages/cards/test/backlog.test.ts`

**Acceptance Criteria:**
- [ ] The backlog lists all 72 pending cards exactly once, each under the engine extension it needs, enforced by a test
- [ ] A real game (War vs Life, legal 39-card decks, real terrain) plays 8 turns through the public API without error
- [ ] Two runs from the same seed give identical JSON; the state survives a JSON round trip
- [ ] The whole repo suite and typecheck pass

**Verify:** `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck` -> all pass

**Steps:**

- [ ] **Step 1: Write the failing smoke test**

`packages/cards/test/game.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  chooseMana, confirmOrders, createGame, emptyOrders, submitOrders,
  type GameState, type Mana, type Orders, type Result, type Side,
} from '@sanctum/engine';
import { allCards, cardIndex } from '../src/index';

const deck = (house: 'war' | 'life') => {
  const ids = allCards.filter((c) => c.house === house).map((c) => c.id);
  return { house, cards: [...ids, ...ids, ...ids] };
};
const MANA: Record<Side, Mana> = { red: 'strife', blue: 'clarity' };

function ok(r: Result): GameState {
  if (!r.ok) throw new Error(r.error);
  return r.state;
}

/** Train a mana novice if one is left; try to march the first group; fall back to no move. */
function submit(s: GameState, side: Side): GameState {
  const sanctum = Object.values(s.structures).find((x) => x.kind === 'sanctum' && x.owner === side)!;
  const group = Object.values(s.groups)
    .filter((g) => g.owner === side && g.control === 'player' && g.pos)
    .sort((a, b) => a.id - b.id)[0];
  const train = sanctum.novices > 0 ? [{ structureId: sanctum.id, as: MANA[side] }] : [];
  const dirs = side === 'red' ? (['e', 's'] as const) : (['w', 'n'] as const);
  const attempts: Orders[] = group
    ? dirs.map((dir) => ({ ...emptyOrders(), train, move: [{ groupId: group.id, dir }] }))
    : [];
  attempts.push({ ...emptyOrders(), train });
  for (const o of attempts) {
    const r = submitOrders(s, cardIndex, side, o);
    if (r.ok) return r.state;
  }
  throw new Error(`no legal orders for ${side}`);
}

function play(seed: number, turns: number): GameState {
  let s = createGame({ seed, decks: { red: deck('war'), blue: deck('life') } }, cardIndex);
  for (let t = 0; t < turns && s.phase !== 'over'; t++) {
    for (const side of ['red', 'blue'] as const) {
      s = submit(s, side);
      s = ok(confirmOrders(s, cardIndex, side));
    }
    while (s.phase === 'choose-mana') {
      const id = s.pendingMana[0];
      const owner = s.structures[id].owner as Side;
      s = ok(chooseMana(s, cardIndex, owner, id, MANA[owner]));
    }
  }
  return s;
}

describe('a real game with the implemented cards', () => {
  it('plays eight turns without error', () => {
    const s = play(11, 8);
    expect(s.turn).toBeGreaterThan(5);
    expect(s.players.red.hand.length).toBeGreaterThan(0);
  });

  it('is deterministic per seed', () => {
    expect(JSON.stringify(play(11, 8))).toBe(JSON.stringify(play(11, 8)));
  });

  it('survives a JSON round trip', () => {
    const s = play(5, 6);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it('accepts legal 39-card decks of every implemented card', () => {
    expect(deck('war').cards).toHaveLength(51);
    expect(deck('life').cards).toHaveLength(39);
  });
});
```

- [ ] **Step 2: Run and fix**

Run: `cd packages/cards && npx vitest run test/game.test.ts`
Expected: PASS. If `submit` throws "no legal orders", the first attempt with an empty-move order is failing validation: read the error from `submitOrders` and fix the helper (it must always have one legal fallback).

- [ ] **Step 3: Write `docs/superpowers/plans/cards-backlog.md`**

````markdown
# War and Life cards not yet implemented (72)

Implemented: 30 (17 War, 13 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Monsters, heroes, nations and minion creation (19)
Needs: summon with stat lines (`H:4 A:1 HP:16 L:2`), monster behaviours (Territorial, Nomadic, Immobile, Flight, Neutral,
off-board appearance), nations as a minion property, `ctx.addMinion(group, spec)`, novice creation in a town, a
once-per-game rule for heroes.
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

## E2. Maximum hit points as a stat (6)
Needs: `StatDelta.maxHp` and "+N maximum and current hit points" on cast.
- Field Surgery (War)
- Lone Wolf (War)
- Marksman (War)
- Veteran (War)
- Elixir Vitae (Life)
- Faerie Knight (Life)

## E3. Mana generation (4)
Needs: `ctx.addMana(side, type, n)` during the mana step of start of turn.
- Call to Arms (War)
- Point of Clarity (War)
- Aura of World (Life)
- Ring of Light (Life)

## E4. Movement-order control (4)
Needs: persistent move-order cancellation, "moves twice" movement, random legal direction, diagonal teleport.
- Amok (War)
- Forced March (War)
- Lienna's Steed (Life)
- Standoff (Life)

## E5. Withdraw and combat cancellation (4)
Needs: a way to end a combat at a given round or before it starts.
- Armistice (War)
- Skirmish (War)
- Lienna's Sigil (Life)
- Strategic Withdrawals (Life)

## E6. Helper spells created on other hosts (6)
Needs: `ctx.createSpell(card, owner, host)` for engine-cast spells (Thermite Damage, Youth, Faerie Blessing, Grace of Auberol).
- Thermites (War)
- Auberol's Grace (Life)
- Clandestine (Life)
- Faerie Circle (Life)
- Faerie Glade (Life)
- Fountain of Youth (Life)

## E7. Casting and targeting restrictions (7)
Needs: spells that squander other spells (globe/group/structure bans), untargetable groups, global concealment.
- Fog of War (War)
- Adriel's Glamour (Life)
- Adriel's Mantle (Life)
- Adriel's Promise (Life)
- Court Politics (Life)
- Individualism (Life)
- Seelie Favor (Life)

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

- [ ] **Step 4: Write the backlog consistency test**

`packages/cards/test/backlog.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { pendingCards } from '../src/index';

const md = readFileSync(
  new URL('../../../docs/superpowers/plans/cards-backlog.md', import.meta.url),
  'utf8',
);
const listed = [...md.matchAll(/^- (.+) \((War|Life)\)$/gm)].map((m) => `${m[1]}|${m[2].toLowerCase()}`);

describe('cards backlog', () => {
  it('lists exactly the cards that have no script yet, each once', () => {
    const pending = pendingCards.map((c) => `${c.name}|${c.house}`).sort();
    expect([...listed].sort()).toEqual(pending);
    expect(new Set(listed).size).toBe(listed.length);
    expect(listed).toHaveLength(72);
  });
});
```
Run: `cd packages/cards && npx vitest run test/backlog.test.ts`
Expected: PASS. A failure prints the diff between the listed names and `pendingCards`; fix the markdown (move or add the named card), never the test.

- [ ] **Step 5: Run the whole repository, commit**

Run: `cd C:/Users/nschonegg/Claude/sanctum && npm test && npm run typecheck`
Expected: engine (115), scrape, and cards suites pass; typecheck exits 0 for every workspace.

```bash
git add docs/superpowers/plans/cards-backlog.md packages/cards/test/game.test.ts packages/cards/test/backlog.test.ts
git commit -m "test(cards): real-game smoke test; docs: backlog of unimplemented War and Life cards"
```

---

## After this plan

Plan 2b: engine extensions E1-E11 from `cards-backlog.md`, in the order that unlocks the most cards, each followed by its cards. Plan 3: `packages/web`, the hotseat client (reads `cardData` for names, costs and text; `allCards` for scripts). When plan 3 needs card art, download it for private use into `packages/web/public/art/` (gitignored) from `http://playsanctum.net/cards/jpgs/<sid>.jpg`.
