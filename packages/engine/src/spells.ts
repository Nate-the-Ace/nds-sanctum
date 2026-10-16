import { isSanctumArea, key } from './board';
import type { CardDef } from './cards';
import { makeCtx, makeQuery } from './ctx';
import type { Engine } from './engine';
import { groupAt, isConcealed, spellsOn, structureAt } from './query';
import { addSpellRecord, removeSpellRecord } from './spellstore';
import type { ActiveSpell, PlayerId, Pos, Ref } from './types';

/** Is `ref` a legal target for `card` cast by `caster` right now? Checks type, concealment and occupancy only. */
export function targetLegal(e: Engine, card: CardDef, caster: PlayerId, ref: Ref): boolean {
  const s = e.state;
  switch (card.target) {
    case 'recruit':
    case 'monster':
    case 'minion': {
      if (ref.kind !== 'minion') return false;
      const m = s.minions[ref.id];
      if (!m || m.status !== 'alive') return false;
      const g = s.groups[m.groupId];
      if (!g || !g.pos) return false;
      if (card.target === 'recruit' && m.kind !== 'recruit') return false;
      if (card.target === 'monster' && m.kind !== 'monster') return false;
      if (!card.ignoresConcealment && m.owner !== caster && isConcealed(s, m)) return false;
      return true;
    }
    case 'recruitGroup':
    case 'monsterGroup':
    case 'group': {
      if (ref.kind !== 'group') return false;
      const g = s.groups[ref.id];
      if (!g || !g.pos || g.minionIds.length === 0) return false;
      if (card.target === 'recruitGroup' && g.kind !== 'recruit') return false;
      if (card.target === 'monsterGroup' && g.kind !== 'monster') return false;
      return true;
    }
    case 'square': {
      if (ref.kind !== 'square') return false;
      if (!s.cells.includes(key(ref.pos))) return false;
      if (isSanctumArea(ref.pos)) return false;
      return !groupAt(s, ref.pos) && !structureAt(s, ref.pos);
    }
    case 'structure': {
      if (ref.kind !== 'structure') return false;
      const st = s.structures[ref.id];
      return !!st && st.kind !== 'sanctum';
    }
    case 'globe':
      return ref.kind === 'globe';
  }
}

/** Target legality plus the card's own `canCast`. Used while ordering and again at execution. */
export function castCheck(e: Engine, caster: PlayerId, card: CardDef, ref: Ref): boolean {
  if (!targetLegal(e, card, caster, ref)) return false;
  return card.canCast ? card.canCast(makeQuery(e, caster), ref) : true;
}

/** Removes a spell, then lets its host recheck persistent requirements of the spells that remain (spell flux). */
export function dispel(e: Engine, spellId: number): void {
  const sp = removeSpellRecord(e.state, spellId);
  if (!sp) return;
  e.state.log.push({ type: 'dispel', card: sp.cardId });
  recheck(e, sp.host);
}

/** Dispels every spell on `ref` whose card `persistent` check now fails. */
export function recheck(e: Engine, ref: Ref): void {
  const s = e.state;
  for (const sp of spellsOn(s, ref)) {
    const card = e.cards[sp.cardId];
    if (!card?.persistent) continue;
    if (!s.spells.some((x) => x.id === sp.id)) continue;
    if (!card.persistent(makeQuery(e, sp.owner), sp.host)) dispel(e, sp.id);
  }
}

/** Recheck everything hosted on a square: the square, its structure, its group and the group's minions. */
export function recheckSquare(e: Engine, pos: Pos): void {
  const s = e.state;
  recheck(e, { kind: 'square', pos });
  const st = structureAt(s, pos);
  if (st) recheck(e, { kind: 'structure', id: st.id });
  const g = groupAt(s, pos);
  if (g) {
    recheck(e, { kind: 'group', id: g.id });
    for (const mid of g.minionIds) recheck(e, { kind: 'minion', id: mid });
  }
}

export function executeCast(e: Engine, caster: PlayerId, cardId: string, ref: Ref): 'cast' | 'squandered' {
  const s = e.state;
  const card = e.cards[cardId];
  const squander = (why: string): 'squandered' => {
    s.log.push({ type: 'squander', card: cardId, caster, why });
    return 'squandered';
  };
  if (!card) return squander('unknown card');
  if (!castCheck(e, caster, card, ref)) return squander('requirements failed');
  const persists = card.type === 'alteration' || card.type === 'conjuration';
  const visible = persists && card.visible !== false;
  if (persists && (card.exclusive ?? visible) && spellsOn(s, ref).some((sp) => sp.cardId === cardId)) {
    return squander('exclusive');
  }
  s.log.push({ type: 'cast', card: cardId, caster, target: ref });
  if (persists) {
    const sp = addSpellRecord(s, {
      cardId, owner: caster, host: ref, visible, turnsLeft: card.duration?.turns ?? null, tokens: {},
    });
    card.onCast?.(makeCtx(e, sp), ref);
    recheck(e, ref);
  } else {
    const transient: ActiveSpell = { id: -1, cardId, owner: caster, host: ref, visible: false, turnsLeft: null, tokens: {} };
    card.onCast?.(makeCtx(e, transient), ref);
  }
  return 'cast';
}

/** End-of-turn expiry. Spells with a finite duration lose one turn and are dispelled at zero. */
export function expireSpells(e: Engine): void {
  for (const sp of [...e.state.spells]) {
    if (sp.turnsLeft === null) continue;
    sp.turnsLeft -= 1;
    if (sp.turnsLeft <= 0) dispel(e, sp.id);
  }
}
