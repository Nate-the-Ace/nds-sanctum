import {
  checkOrders, emptyOrders, houseMana, key, legalTargets, step, terrainForbids, viewStats, DIR_LIST, MANA_TYPES,
  SANCTUM_POS, type CardIndex, type Dir, type GameState, type Group, type Mana, type Orders, type PlayerId,
  type Pos, type Ref, type Side,
} from '@sanctum/engine';

/*
 * A basic computer player, for solo testing. Pure and deterministic: the same state always gives the same orders.
 * Every part of the orders is added one at a time and kept only if the engine's checkOrders still accepts the
 * whole draft, so the result is always legal.
 */

/** mulberry32, seeded from the game seed, the turn and the side, so a replayed game makes the same choices. */
function prng(state: GameState, side: Side): () => number {
  let a = (state.seed ^ Math.imul(state.turn, 0x9e3779b1) ^ (side === 'red' ? 0x5bd1e995 : 0x1b873593)) | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MANA_TURNS = 4;
const MAX_CASTS = 2;
const HOME_GUARD = 4;

const samePos = (a: Pos, b: Pos) => a.x === b.x && a.y === b.y;

/** Keeps `next` if the engine accepts it, else the draft as it was. */
function tryAdd(state: GameState, cards: CardIndex, side: Side, draft: Orders, next: Orders): Orders {
  return checkOrders(state, cards, side, next) === null ? next : draft;
}

/** 1. Training: one primary-mana novice at the Sanctum in the first turns, every other novice as a recruit. */
function planTraining(state: GameState, cards: CardIndex, side: Side, draft: Orders): Orders {
  const primary = houseMana(state.players[side].house)[0];
  const mine = Object.values(state.structures).filter((st) => st.owner === side)
    .sort((a, b) => (a.kind === 'sanctum' ? -1 : b.kind === 'sanctum' ? 1 : a.id - b.id));
  let alternate = 0;
  for (const st of mine) {
    for (let i = 0; i < st.novices; i++) {
      const wantMana = st.kind === 'sanctum' && i === 0 && state.turn <= MANA_TURNS;
      const as = wantMana ? primary : alternate % 2 === 0 ? 'swordsman' : 'archer';
      const next = tryAdd(state, cards, side, draft, { ...draft, train: [...draft.train, { structureId: st.id, as }] });
      if (next !== draft && !wantMana) alternate++;
      draft = next;
    }
  }
  return draft;
}

/** Squares the whole group can stand on (no blocking or deadly terrain for any member). */
function passable(state: GameState, cards: CardIndex, g: Group): (p: Pos) => boolean {
  const walks = g.minionIds.filter((id) => state.minions[id]?.status !== 'dead').map((id) => viewStats(state, cards, id).walks);
  return (p) => {
    const t = state.terrain[key(p)];
    return state.cells.includes(key(p)) && !!t && walks.every((w) => !terrainForbids(t, w));
  };
}

/** Steps to every square from `from` over passable squares (Infinity when unreachable). */
function distances(state: GameState, from: Pos, ok: (p: Pos) => boolean): Map<string, number> {
  const dist = new Map<string, number>([[key(from), 0]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift()!;
    for (const d of DIR_LIST) {
      const q = step(p, d);
      if (dist.has(key(q)) || !ok(q)) continue;
      dist.set(key(q), dist.get(key(p))! + 1);
      queue.push(q);
    }
  }
  return dist;
}

/** 2. Movement: each group steps toward the nearest town it does not own, else the enemy Sanctum. */
function planMoves(state: GameState, cards: CardIndex, side: Side, draft: Orders, rnd: () => number): Orders {
  const enemy: Side = side === 'red' ? 'blue' : 'red';
  const home = SANCTUM_POS[side];
  const groups = Object.values(state.groups)
    .filter((g) => g.owner === side && g.control === 'player' && g.pos)
    .sort((a, b) => a.id - b.id);
  for (const g of groups) {
    const pos = g.pos!;
    // A small group on the Sanctum stays home as its guard until it has grown.
    if (samePos(pos, home) && g.minionIds.length < HOME_GUARD) continue;
    const ok = passable(state, cards, g);
    const fromHere = distances(state, pos, ok);
    const towns = Object.values(state.structures)
      .filter((st) => st.kind !== 'sanctum' && st.owner !== side && fromHere.has(key(st.pos)))
      .sort((a, b) => fromHere.get(key(a.pos))! - fromHere.get(key(b.pos))! || a.id - b.id);
    const target = towns[0]?.pos ?? SANCTUM_POS[enemy];
    if (samePos(pos, target)) continue; // standing on a town to capture it at the start of next turn
    const toTarget = distances(state, target, ok);
    const here = toTarget.get(key(pos)) ?? Infinity;
    const options = DIR_LIST
      .map((dir) => ({ dir, d: toTarget.get(key(step(pos, dir))) ?? Infinity, tie: rnd() }))
      .filter((o) => o.d < here || (here === Infinity && ok(step(pos, o.dir))))
      .sort((a, b) => a.d - b.d || a.tie - b.tie);
    for (const o of options) {
      const next = tryAdd(state, cards, side, draft, { ...draft, move: [...draft.move, { groupId: g.id, dir: o.dir as Dir }] });
      if (next !== draft) {
        draft = next;
        break;
      }
    }
  }
  return draft;
}

/** Who a target belongs to: the minion's, group's or structure's owner, or the owner of whatever stands on a square. */
function refOwner(state: GameState, r: Ref): PlayerId | null {
  switch (r.kind) {
    case 'minion': return state.minions[r.id]?.owner ?? null;
    case 'group': return state.groups[r.id]?.owner ?? null;
    case 'structure': return state.structures[r.id]?.owner ?? null;
    case 'square': {
      const g = Object.values(state.groups).find((x) => x.pos && samePos(x.pos, r.pos));
      if (g) return g.owner;
      return Object.values(state.structures).find((x) => samePos(x.pos, r.pos))?.owner ?? null;
    }
    default: return null;
  }
}

/** 3. Spells: the first affordable cards in hand order, at most two, on a target picked by the card's type. */
function planCasts(state: GameState, cards: CardIndex, side: Side, draft: Orders, rnd: () => number): Orders {
  const hand = state.players[side].hand;
  for (let i = 0; i < hand.length && draft.cast.length < MAX_CASTS; i++) {
    const card = cards[hand[i]];
    if (!card) continue;
    const targets = legalTargets(state, cards, side, hand[i]);
    if (targets.length === 0) continue;
    // Alterations, conjurations and heroes help: aim at our own things. Manifestations and summonings: the enemy's.
    const helpful = card.type === 'alteration' || card.type === 'conjuration' || card.type === 'hero';
    const preferred = targets.filter((t) => {
      const owner = refOwner(state, t);
      return helpful ? owner === side : owner !== null && owner !== side && owner !== 'neutral';
    });
    const pool = preferred.length ? preferred : targets;
    const target = pool[Math.floor(rnd() * pool.length)];
    draft = tryAdd(state, cards, side, draft, { ...draft, cast: [...draft.cast, { handIndex: i, target }] });
  }
  return draft;
}

/** The computer's orders for `side` this turn. Always legal (empty orders outside the orders phase). Never discards. */
export function npcOrders(state: GameState, cards: CardIndex, side: Side): Orders {
  const empty = emptyOrders();
  if (checkOrders(state, cards, side, empty) !== null) return empty;
  const rnd = prng(state, side);
  let draft = planTraining(state, cards, side, empty);
  draft = planMoves(state, cards, side, draft, rnd);
  draft = planCasts(state, cards, side, draft, rnd);
  return draft;
}

/** Mana each turn from what `side` holds now: Sanctum mana novices plus every town's chosen type. */
function income(state: GameState, side: Side): Map<Mana, number> {
  const out = new Map<Mana, number>(MANA_TYPES.map((m) => [m, 0]));
  for (const st of Object.values(state.structures)) {
    if (st.owner !== side) continue;
    for (const [m, n] of Object.entries(st.manaTrained ?? {}) as Array<[Mana, number]>) out.set(m, out.get(m)! + n);
    if (st.kind !== 'sanctum' && st.manaType) out.set(st.manaType, out.get(st.manaType)! + 1);
  }
  return out;
}

/**
 * The computer's mana for a structure it captured: the type its remaining cards (deck and hand) cost most of,
 * weighed against what it already makes (demand / (1 + income)), so a deck needing two types does not end up
 * making only the commoner one. Ties go to its house's types; the house's primary when its cards cost nothing.
 */
export function npcPickMana(state: GameState, cards: CardIndex, side: Side, _structureId: number): Mana {
  const p = state.players[side];
  const house = houseMana(p.house);
  const demand = new Map<Mana, number>(MANA_TYPES.map((m) => [m, 0]));
  for (const id of [...p.deck, ...p.hand]) {
    for (const [m, n] of Object.entries(cards[id]?.cost ?? {}) as Array<[Mana, number]>) demand.set(m, demand.get(m)! + n);
  }
  const have = income(state, side);
  const score = (m: Mana) => demand.get(m)! / (1 + have.get(m)!);
  const order = [...house, ...MANA_TYPES.filter((m) => !house.includes(m))];
  let best = house[0];
  for (const m of order) if (score(m) > score(best)) best = m;
  return best;
}
