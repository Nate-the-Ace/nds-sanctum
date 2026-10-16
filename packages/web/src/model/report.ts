import { key, MANA_TYPES, SIDES, step, type CardIndex, type Dir, type GameState, type Minion, type PlayerId, type Pos, type Ref } from '@sanctum/engine';

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

const adjacent = (a: Pos, b: Pos) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

function hostExists(r: Ref, s: GameState): boolean {
  switch (r.kind) {
    case 'minion': return !!s.minions[r.id] && s.minions[r.id].status !== 'dead';
    case 'group': return !!s.groups[r.id]?.pos;
    case 'structure': return !!s.structures[r.id];
    default: return true;
  }
}

/** Identical lines become one line with a count: "Red Human archer died (×2)." */
function tally(lines: string[]): string[] {
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  return [...counts].map(([l, n]) => (n === 1 ? l : `${l.replace(/\.$/, '')} (×${n}).`));
}

/**
 * Minion ids that died after log entry `from`, up to the next combat or the start of the next turn
 * (terrain deaths at the start of turn are not combat losses).
 */
export function deathsAfter(log: GameState['log'], from: number): number[] {
  const ids: number[] = [];
  for (let i = from + 1; i < log.length && log[i].type !== 'combat' && log[i].type !== 'turn'; i++) {
    if (log[i].type === 'death') ids.push(log[i].minion as number);
  }
  return ids;
}

/** "Red group fought Blue group near (5,6): Red lost 2, Blue lost 0. Red group was wiped out." */
function combatLine(before: GameState, after: GameState, hiId: number, loId: number, dead: number[]): string | null {
  const hi = before.groups[hiId] ?? after.groups[hiId];
  const lo = before.groups[loId] ?? after.groups[loId];
  if (!hi || !lo) return null;
  const owners = [hi.owner, lo.owner];
  const lost = (o: PlayerId) => dead.filter((id) => (before.minions[id] ?? after.minions[id])?.owner === o).length;
  const where = after.groups[hiId]?.pos ?? after.groups[loId]?.pos ?? hi.pos;
  const parts = [`${side(hi.owner)} group fought ${side(lo.owner)} group${where ? ` near ${at(where)}` : ''}: ${owners.map((o) => `${side(o)} lost ${lost(o)}`).join(', ')}.`];
  for (const id of [hiId, loId]) {
    const g = before.groups[id] ?? after.groups[id];
    if (!after.groups[id]?.pos) parts.push(`${side(g.owner)} group was wiped out.`);
  }
  return parts.join(' ');
}

/** What happened between two states: the engine log for spells and fights, a state diff for everything else. */
export function turnReport(before: GameState, after: GameState, cards: CardIndex): Report {
  const spells: string[] = [];
  const combats: string[] = [];
  const captures: string[] = [];
  for (const [i, e] of (after.log as Array<Record<string, any>>).entries()) {
    if (e.type === 'cast') spells.push(`${side(e.caster)} cast ${cards[e.card]?.name ?? e.card} on ${refLabel(e.target, before)}.`);
    else if (e.type === 'squander') spells.push(`${side(e.caster)}'s ${cards[e.card]?.name ?? e.card} fizzled (${e.why}).`);
    else if (e.type === 'dispel') spells.push(`${cards[e.card]?.name ?? e.card} was dispelled.`);
    else if (e.type === 'combat') {
      const line = combatLine(before, after, e.hi, e.lo, deathsAfter(after.log, i));
      if (line) combats.push(line);
    } else if (e.type === 'capture') {
      const st = after.structures[e.structure];
      captures.push(`${side(e.by)} captured the ${st?.kind ?? 'structure'}${st ? ` at ${at(st.pos)}` : ''}.`);
    } else if (e.type === 'win') captures.push(`${side(e.winner)} captured the enemy Sanctum and wins!`);
  }

  const training: string[] = [];
  for (const sd of SIDES) {
    for (const t of before.players[sd].orders?.train ?? []) {
      if ((MANA_TYPES as string[]).includes(t.as)) training.push(`${side(sd)} trained a novice as ${cap(t.as)} mana.`);
    }
  }

  const moves: Report['moves'] = [];
  const movement: string[] = [];
  const ordered = new Map<number, { dir: Dir; owner: PlayerId }>();
  for (const sd of SIDES) for (const m of before.players[sd].orders?.move ?? []) ordered.set(m.groupId, { dir: m.dir, owner: sd });
  for (const g of Object.values(before.groups)) {
    if (!g.pos) continue;
    const size = g.minionIds.length; // the size it moved with, before any combat losses
    const now = after.groups[g.id];
    if (!now) {
      // Gone with its minions alive in another group: it joined that group.
      const into = g.minionIds.map((id) => after.minions[id]).find((m) => m && m.status !== 'dead' && after.groups[m.groupId]);
      const host = into ? after.groups[into.groupId] : null;
      if (host?.pos) {
        movement.push(`${side(g.owner)} group (${size}) at ${at(g.pos)} joined the ${side(host.owner)} group at ${at(host.pos)}.`);
        if (adjacent(g.pos, host.pos)) moves.push({ groupId: g.id, owner: g.owner, from: g.pos, to: host.pos });
      }
      continue;
    }
    if (!now.pos) continue;
    const order = ordered.get(g.id);
    if (key(g.pos) === key(now.pos)) {
      if (order) movement.push(`${side(g.owner)} group's move to ${at(step(g.pos, order.dir))} was blocked.`);
      continue;
    }
    if (adjacent(g.pos, now.pos)) {
      moves.push({ groupId: g.id, owner: g.owner, from: g.pos, to: now.pos });
      movement.push(`${side(g.owner)} group (${size}) moved ${at(g.pos)} to ${at(now.pos)}.`);
    } else {
      // Bounced twice and jumped to the nearest free square: no arrow, the endpoints are not neighbours.
      movement.push(`${side(g.owner)} group (${size}) was displaced from ${at(g.pos)} to ${at(now.pos)}.`);
    }
  }

  const sides: string[] = [];
  if (before.initiative !== after.initiative) sides.push(`${side(after.initiative)} took the initiative.`);
  for (const g of Object.values(before.groups)) {
    const now = after.groups[g.id];
    if (now && now.owner !== g.owner) {
      const pos = now.pos ?? g.pos;
      sides.push(`${side(g.owner)} group${pos ? ` at ${at(pos)}` : ''} went over to ${side(now.owner)}.`);
    }
  }

  // Visible spells gone without a dispel while their host is still there: they wore off.
  const dispelled = new Set((after.log as Array<Record<string, any>>).filter((e) => e.type === 'dispel').map((e) => e.card as string));
  const expired: string[] = [];
  const nowIds = new Set(after.spells.map((sp) => sp.id));
  for (const sp of before.spells) {
    if (!sp.visible || nowIds.has(sp.id) || dispelled.has(sp.cardId) || !hostExists(sp.host, after)) continue;
    expired.push(`${cards[sp.cardId]?.name ?? 'A spell'} on ${refLabel(sp.host, before)} wore off.`);
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
    { title: 'Training', lines: training },
    { title: 'Spells', lines: [...spells, ...expired] },
    { title: 'Movement', lines: movement },
    { title: 'Combat', lines: combats },
    { title: 'Health', lines: hurt },
    { title: 'Casualties', lines: casualties },
    { title: 'New units', lines: created },
    { title: 'Terrain', lines: terrain },
    { title: 'Structures', lines: captures },
    { title: 'Sides', lines: sides },
  ].map((sec) => ({ ...sec, lines: tally(sec.lines) })).filter((sec) => sec.lines.length > 0);
  return { turn: before.turn, sections, moves };
}
