import { step } from './board';
import { takeDamage } from './damage';
import { killMinion } from './death';
import type { Engine } from './engine';
import { dispatch } from './events';
import { groupAt, hostile, minionsOf, ownerRank, sequence } from './query';
import { NATIONS } from './nations';
import { nextRandom, shuffle } from './rng';
import { RULES } from './rules';
import { computeStats } from './stats';
import type { Dir, GameState, Group, Minion } from './types';

/** Fight order for the precedence group: NE, SW, SE, NW as seen from blue at the bottom = n, s, e, w on our grid. */
const FIGHT_ORDER: Dir[] = ['n', 's', 'e', 'w'];
/** Stands in for the original's "infinite" misses: every minion's first attack of a combat hits. */
const FIRST_HIT = 99;

const attacksLeft = (m: Minion): number => m.combat.handLeft + m.combat.missileLeft;

function precedes(s: GameState, a: Group, b: Group): boolean {
  const ra = ownerRank(s, a.owner);
  const rb = ownerRank(s, b.owner);
  return ra !== rb ? ra < rb : a.id < b.id;
}

function victimOf(s: GameState, m: Minion, enemyGid: number): Minion | null {
  const v = m.combat.victim === null ? undefined : s.minions[m.combat.victim];
  return v && v.status !== 'dead' && v.groupId === enemyGid ? v : null;
}

function isBasher(e: Engine, m: Minion): boolean {
  const st = computeStats(e, m.id);
  return st.handAttacks > 0 && st.missileAttacks === 0;
}

function groupPotential(e: Engine, gid: number): number {
  let total = 0;
  for (const m of minionsOf(e.state, gid)) {
    const st = computeStats(e, m.id);
    total += Math.max(st.hand, st.missile) * attacksLeft(m);
  }
  return total;
}

/** Wise targeting tiebreakers: combatants first, then can-kill, highest armor, lowest hp, highest damage, random. */
function chooseWisely(e: Engine, m: Minion, enemyGid: number): Minion | null {
  const s = e.state;
  const foes = shuffle(s, minionsOf(s, enemyGid));
  if (foes.length === 0) return null;
  const potential = groupPotential(e, m.groupId);
  const keyed = foes.map((x) => {
    const st = computeStats(e, x.id);
    const combatant = st.handAttacks + st.missileAttacks > 0;
    return { x, k: [combatant ? 0 : 1, x.hp + x.combat.armor <= potential ? 0 : 1, -st.armor, x.hp, -Math.max(st.hand, st.missile)] };
  });
  keyed.sort((a, b) => {
    for (let i = 0; i < a.k.length; i++) if (a.k[i] !== b.k[i]) return a.k[i] - b.k[i];
    return 0;
  });
  return keyed[0].x;
}

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

function chooseVictims(e: Engine, hiId: number, loId: number, round: number): void {
  if (round === 1) return; // shooters choose just in time; bashers do not attack in round 1
  const s = e.state;
  const idleBashers = (gid: number, enemy: number) =>
    minionsOf(s, gid).filter((m) => isBasher(e, m) && attacksLeft(m) > 0 && !victimOf(s, m, enemy));
  const a = shuffle(s, idleBashers(hiId, loId));
  const b = shuffle(s, idleBashers(loId, hiId));
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    a[i].combat.victim = b[i].id;
    b[i].combat.victim = a[i].id;
  }
  for (const [gid, enemy] of [[hiId, loId], [loId, hiId]] as const) {
    for (const m of minionsOf(s, gid)) {
      if (attacksLeft(m) > 0 && !victimOf(s, m, enemy)) {
        const v = chooseWisely(e, m, enemy);
        if (v) m.combat.victim = v.id;
      }
    }
  }
}

const nationBonus = (m: Minion, useMissile: boolean, round: number): number => {
  const c = m.nation ? NATIONS[m.nation].combat : null;
  return (c === 'hand2' && !useMissile && round === 2) || (c === 'missile1' && useMissile && round === 1) ? 1 : 0;
};

/** One attack: pipeline steps A1-A8 from the rules. */
function attack(e: Engine, m: Minion, v: Minion, round: number): void {
  const st = computeStats(e, m.id);
  const useMissile = m.combat.missileLeft > 0;
  if (useMissile) m.combat.missileLeft--;
  else m.combat.handLeft--;
  // A1: level check
  if (computeStats(e, v.id).level > st.level + m.combat.misses) {
    m.combat.misses++;
    return;
  }
  m.combat.misses = 0;
  // A2: damage
  let dmg = useMissile ? st.missile - (round === 1 ? 1 : 0) : st.hand;
  dmg += nationBonus(m, useMissile, round);
  dmg = st.noDamage ? 0 : Math.max(0, dmg);
  // A3: victim takes damage
  const res = takeDamage(e, v.id, dmg, { kind: useMissile ? 'missile' : 'hand', ignoresArmor: false, magical: false }, m.id);
  const buried = () => m.status === 'dead' || v.status === 'dead';
  if (!buried()) {
    dispatch(e, 'attacker:hits', { kind: 'minion', id: m.id }, { victimId: v.id });
    if (!buried() && res !== 'bounced') dispatch(e, 'attacker:damages', { kind: 'minion', id: m.id }, { victimId: v.id });
  }
  if (v.status === 'dead') return; // A6
  if (res !== 'killed') return; // A7
  if (killMinion(e, v.id, m.id, 'kills') === 'cancelled') return;
  if (m.status === 'alive') {
    dispatch(e, 'attacker:kills', { kind: 'minion', id: m.id }, { victimId: v.id }); // A8
    if (m.kind === 'recruit' && !m.hasExp) m.expQualified = true;
  }
}

function attackPhase(e: Engine, myId: number, enemyId: number, round: number): void {
  const s = e.state;
  if (!s.groups[myId]) return;
  for (const mid of [...s.groups[myId].minionIds]) {
    const m = s.minions[mid];
    if (!m || m.status !== 'alive' || m.groupId !== myId || attacksLeft(m) <= 0) continue;
    if (!s.groups[myId] || !s.groups[enemyId] || !hostile(s.groups[myId], s.groups[enemyId])) return;
    let v = victimOf(s, m, enemyId);
    if (!v) {
      if (computeStats(e, m.id).missileAttacks > 0) v = chooseWisely(e, m, enemyId); // shooters are wise
      else v = minionsOf(s, enemyId).find((x) => x.combat.victim === m.id) ?? null; // bashers retaliate
      if (!v) {
        m.combat.handLeft = 0; // basher forfeits
        m.combat.missileLeft = 0;
        continue;
      }
      m.combat.victim = v.id;
    }
    attack(e, m, v, round);
    while (attacksLeft(m) > 0 && m.status === 'alive' && s.groups[enemyId]) {
      const foes = minionsOf(s, enemyId);
      if (foes.length === 0) break;
      const t = foes[Math.floor(nextRandom(s) * foes.length)]; // extra attacks pick random victims
      m.combat.victim = t.id;
      attack(e, m, t, round);
    }
  }
}

/** A full combat between two hostile groups; `hiId` is the group with precedence. */
export function fight(e: Engine, hiId: number, loId: number): void {
  const s = e.state;
  const alive = (id: number) => !!s.groups[id] && s.groups[id].pos !== null;
  const stillHostile = () => alive(hiId) && alive(loId) && hostile(s.groups[hiId], s.groups[loId]);
  s.log.push({ type: 'combat', hi: hiId, lo: loId });
  let ended = false;
  for (const id of [hiId, loId]) {
    const ev = dispatch(e, 'combat:start', { kind: 'group', id }, { opponent: id === hiId ? loId : hiId });
    if (ev.data.endCombat) ended = true;
  }
  for (const gid of [hiId, loId]) {
    for (const m of minionsOf(s, gid)) m.combat = { armor: 0, handLeft: 0, missileLeft: 0, misses: FIRST_HIT, victim: null };
  }
  for (let round = 1; round <= RULES.combatRounds; round++) {
    if (ended || !stillHostile()) break;
    if (startRound(e, hiId, loId, round)) break;
    if (!stillHostile()) break;
    chooseVictims(e, hiId, loId, round);
    attackPhase(e, hiId, loId, round);
    attackPhase(e, loId, hiId, round);
  }
  for (const id of [hiId, loId]) if (alive(id)) dispatch(e, 'combat:end', { kind: 'group', id }, {});
  for (const id of [hiId, loId]) if (alive(id)) dispatch(e, 'combat:after', { kind: 'group', id }, {});
}

/** Combat phase: every orthogonally adjacent hostile pair fights once; the group with precedence picks the fight. */
export function runCombats(e: Engine): void {
  const s = e.state;
  const before = dispatch(e, 'combat:before');
  if (before.data.cancel) {
    dispatch(e, 'turn:afterCombat');
    return;
  }
  for (const p of sequence(s)) {
    for (const gid of [...s.groupSeq[p]]) {
      for (const dir of FIGHT_ORDER) {
        const g = s.groups[gid];
        if (!g || !g.pos) break;
        const h = groupAt(s, step(g.pos, dir));
        if (!h || !hostile(g, h) || !precedes(s, g, h)) continue;
        fight(e, g.id, h.id);
      }
    }
  }
  dispatch(e, 'turn:afterCombat');
}
