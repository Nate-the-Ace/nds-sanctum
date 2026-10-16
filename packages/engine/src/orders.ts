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
