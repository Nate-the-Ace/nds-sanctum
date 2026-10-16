import type { EventContext, GameEvent, Mana as ManaType, Ref, TerrainId } from '@sanctum/engine';
import { ADJACENT, contiguous } from '../helpers';
import { helperSummary } from './render';
import { resolveScope, SCOPE_PHRASE, type Scope } from './scopes';

export type Effect =
  | { kind: 'heal'; amount: number | 'full'; scope: Scope }
  | { kind: 'damage'; amount: number; scope: Scope }
  | { kind: 'kill'; scope: Scope }
  | { kind: 'terraform'; terrain: TerrainId; area: 'target' | 'adjacent' | 'contiguous'; from?: TerrainId }
  | { kind: 'expend' }
  | { kind: 'dispelAll' }
  | { kind: 'mana'; mana: ManaType; amount: number; to: 'caster' | 'structureOwner' }
  | { kind: 'give'; card: string; scope: Scope; once: boolean }
  | { kind: 'giveSquares'; card: string; terrain: TerrainId }
  | { kind: 'withdraw' }
  | { kind: 'moveTwice' }
  | { kind: 'randomMove' }
  | { kind: 'cancelMoves' };

export const Heal = (amount: number | 'full', scope: Scope = 'host'): Effect => ({ kind: 'heal', amount, scope });
export const Damage = (amount: number, scope: Scope = 'host'): Effect => ({ kind: 'damage', amount, scope });
export const Kill = (scope: Scope = 'host'): Effect => ({ kind: 'kill', scope });
export const Terraform = (terrain: TerrainId, area: 'target' | 'adjacent' | 'contiguous' = 'target', from?: TerrainId): Effect => ({ kind: 'terraform', terrain, area, from });
/** "Expend": dispel this spell. */
export const Expend = (): Effect => ({ kind: 'expend' });
export const DispelAll = (): Effect => ({ kind: 'dispelAll' });
export const AddMana = (mana: ManaType, amount: number, to: 'caster' | 'structureOwner' = 'caster'): Effect => ({ kind: 'mana', mana, amount, to });
/** Cast a helper spell on each minion in scope. `once` skips minions that already have it. */
export const Give = (card: string, scope: Scope, once = false): Effect => ({ kind: 'give', card, scope, once });
export const GiveSquares = (card: string, terrain: TerrainId): Effect => ({ kind: 'giveSquares', card, terrain });
export const Withdraw = (): Effect => ({ kind: 'withdraw' });
export const MoveTwice = (): Effect => ({ kind: 'moveTwice' });
export const RandomMove = (): Effect => ({ kind: 'randomMove' });
export const CancelMoves = (): Effect => ({ kind: 'cancelMoves' });

const hasSpellOnMinion = (c: EventContext, card: string, id: number) =>
  c.state.spells.some((sp) => sp.cardId === card && sp.host.kind === 'minion' && sp.host.id === id);

export function runEffect(c: EventContext, ev: GameEvent | undefined, e: Effect, target?: Ref): void {
  switch (e.kind) {
    case 'heal':
      for (const id of resolveScope(c, ev, e.scope, target)) c.heal(id, e.amount === 'full' ? 999 : e.amount);
      return;
    case 'damage':
      for (const id of resolveScope(c, ev, e.scope, target)) c.damage(id, e.amount);
      return;
    case 'kill':
      for (const id of resolveScope(c, ev, e.scope, target)) c.kill(id);
      return;
    case 'terraform': {
      if (e.area === 'target') {
        if (target?.kind === 'square') c.setTerrain(target.pos, e.terrain);
      } else if (e.area === 'adjacent') {
        const st = target?.kind === 'structure' ? c.structure(target.id) : undefined;
        if (st) for (const d of ADJACENT) c.setTerrain({ x: st.pos.x + d.x, y: st.pos.y + d.y }, e.terrain);
      } else if (target?.kind === 'square' && e.from) {
        for (const p of contiguous(c, target.pos, e.from)) c.setTerrain(p, e.terrain);
      }
      return;
    }
    case 'expend':
      c.dispel();
      return;
    case 'dispelAll': {
      if (target?.kind !== 'group') return;
      const gid = target.id;
      const members = new Set(c.minionsOf(gid).map((m) => m.id));
      for (const sp of [...c.state.spells]) {
        if (!sp.visible) continue; // non-visible spells cannot be dispelled
        const h = sp.host;
        if ((h.kind === 'group' && h.id === gid) || (h.kind === 'minion' && members.has(h.id))) c.dispel(sp.id);
      }
      return;
    }
    case 'mana': {
      if (e.to === 'caster') {
        const owner = c.spell.owner;
        if (owner !== 'neutral') c.addMana(owner, e.mana, e.amount);
      } else {
        const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
        if (st && st.owner !== 'neutral') c.addMana(st.owner, e.mana, e.amount);
      }
      return;
    }
    case 'give':
      for (const id of resolveScope(c, ev, e.scope, target)) {
        if (e.once && hasSpellOnMinion(c, e.card, id)) continue;
        c.createSpell(e.card, { kind: 'minion', id });
      }
      return;
    case 'giveSquares': {
      if (target?.kind !== 'square') return;
      for (const p of contiguous(c, target.pos, e.terrain)) {
        const has = c.state.spells.some(
          (sp) => sp.cardId === e.card && sp.host.kind === 'square' && sp.host.pos.x === p.x && sp.host.pos.y === p.y,
        );
        if (!has) c.createSpell(e.card, { kind: 'square', pos: p });
      }
      return;
    }
    case 'withdraw':
      c.endCombat();
      return;
    case 'moveTwice':
      if (target?.kind === 'group') c.setMovesTwice(target.id);
      return;
    case 'randomMove': {
      if (target?.kind !== 'group' || c.group(target.id)?.control !== 'player') return;
      const dirs = c.legalDirections(target.id);
      if (dirs.length > 0) c.setMoveOrder(target.id, dirs[Math.floor(c.random() * dirs.length)]);
      return;
    }
    case 'cancelMoves':
      for (const g of Object.values(c.state.groups)) {
        if (g.kind !== 'recruit') continue;
        c.setMoveOrder(g.id, null);
        c.setMovesTwice(g.id, false);
      }
      return;
  }
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function printEffect(e: Effect): string {
  switch (e.kind) {
    case 'heal': return `Heal ${e.amount === 'full' ? 'full' : e.amount}${SCOPE_PHRASE[e.scope]}`;
    case 'damage': return `${e.amount} damage${SCOPE_PHRASE[e.scope]}`;
    case 'kill': return `Kill${SCOPE_PHRASE[e.scope]}`;
    case 'terraform':
      return e.area === 'adjacent' ? `Adjacent squares become ${e.terrain}`
        : e.area === 'contiguous' ? `Contiguous ${e.from} becomes ${e.terrain}`
        : `Square becomes ${e.terrain}`;
    case 'expend': return 'Expend';
    case 'dispelAll': return 'Dispel all (target group)';
    case 'mana': return `+${e.amount} ${cap(e.mana)}${e.to === 'structureOwner' ? ' (owner)' : ''}`;
    case 'give': return `Give ${helperSummary(e.card)}${SCOPE_PHRASE[e.scope]}`;
    case 'giveSquares': return `Give ${helperSummary(e.card)} to contiguous ${e.terrain}`;
    case 'withdraw': return 'Withdraw';
    case 'moveTwice': return 'Move twice';
    case 'randomMove': return 'Random direction';
    case 'cancelMoves': return 'Cancel all moves';
  }
}
