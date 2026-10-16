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
