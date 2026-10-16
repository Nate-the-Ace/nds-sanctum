import type { EventContext, GameEvent, Mana as ManaType, Nation, Ref, TerrainId } from '@sanctum/engine';
import { ADJACENT, contiguous } from '../helpers';
import { helperSummary } from './render';
import { hostGroupId, resolveScope, scopeObject, scopeSubject, type Scope } from './scopes';

export type Effect =
  | { kind: 'heal'; amount: number | 'full'; scope: Scope }
  | { kind: 'damage'; amount: number; scope: Scope }
  | { kind: 'kill'; scope: Scope }
  | { kind: 'terraform'; terrain: TerrainId; area: TerraformArea; from?: TerrainId }
  | { kind: 'expend' }
  | { kind: 'dispelAll' }
  | { kind: 'mana'; mana: ManaType; amount: number; to: 'caster' | 'structureOwner' }
  | { kind: 'give'; card: string; scope: Scope; once: boolean }
  | { kind: 'giveSquares'; card: string; terrain: TerrainId }
  | { kind: 'withdraw' }
  | { kind: 'moveTwice' }
  | { kind: 'randomMove' }
  | { kind: 'cancelMoves' }
  | { kind: 'novices'; count: number; nation?: Nation };

/** target: the target square; adjacent: around the target structure; contiguous: same-terrain area; aroundGroup: around the host's group. */
export type TerraformArea = 'target' | 'adjacent' | 'contiguous' | 'aroundGroup';

export const Heal = (amount: number | 'full', scope: Scope = 'host'): Effect => ({ kind: 'heal', amount, scope });
export const Damage = (amount: number, scope: Scope = 'host'): Effect => ({ kind: 'damage', amount, scope });
export const Kill = (scope: Scope = 'host'): Effect => ({ kind: 'kill', scope });
export const Terraform = (terrain: TerrainId, area: TerraformArea = 'target', from?: TerrainId): Effect => ({ kind: 'terraform', terrain, area, from });
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
/** Adds novices to the target structure; `nation` makes them train as that nation. */
export const Novices = (count: number, nation?: Nation): Effect => ({ kind: 'novices', count, nation });

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
      } else if (e.area === 'aroundGroup') {
        const gid = hostGroupId(c);
        const g = gid === undefined ? undefined : c.group(gid);
        if (g?.pos) for (const d of ADJACENT) c.setTerrain({ x: g.pos.x + d.x, y: g.pos.y + d.y }, e.terrain);
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
    case 'novices':
      if (target?.kind === 'structure') c.addNovices(target.id, e.count, e.nation);
      return;
    default:
      assertNever(e);
  }
}

function assertNever(x: never): never {
  throw new Error(`unhandled effect ${JSON.stringify(x)}`);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** One effect as it starts a sentence: verb first, or "<Scope> gets <Helper (text)>". */
export function printEffect(e: Effect): string {
  switch (e.kind) {
    case 'heal':
      if (e.amount === 'full') return `Heal${scopeObject(e.scope)} fully`;
      return e.scope === 'host' ? `Heal ${e.amount}` : `Heal${scopeObject(e.scope)} by ${e.amount}`;
    case 'damage': return `Deal ${e.amount} damage${e.scope === 'host' ? '' : ` to${scopeObject(e.scope)}`}`;
    case 'kill': return `Kill${scopeObject(e.scope)}`;
    case 'terraform':
      return e.area === 'adjacent' ? `Adjacent squares become ${e.terrain}`
        : e.area === 'contiguous' ? `Contiguous ${e.from} becomes ${e.terrain}`
        : e.area === 'aroundGroup' ? `Squares next to its group become ${e.terrain}`
        : `Square becomes ${e.terrain}`;
    case 'expend': return 'Expend';
    case 'dispelAll': return 'Dispel every enchantment on the group';
    case 'mana': return `+${e.amount} ${cap(e.mana)}${e.to === 'structureOwner' ? ' to its owner' : ''}`;
    case 'give': return `${scopeSubject(e.scope)} gets ${helperSummary(e.card)}${e.once ? ' once each' : ''}`;
    case 'giveSquares': return `Each contiguous ${e.terrain} square gets ${helperSummary(e.card)}`;
    case 'withdraw': return 'Withdraw';
    case 'moveTwice': return 'Moves twice';
    case 'randomMove': return 'Moves in a random direction';
    case 'cancelMoves': return 'Cancel all recruit move orders';
    case 'novices': return `Create ${e.count} ${e.nation ? cap(e.nation) + ' ' : ''}novices in the town`;
    default: return assertNever(e);
  }
}

/** A list of effects as one sentence body: "A, then b, then c". Move twice + random direction read as one effect. */
export function printEffects(effects: Effect[]): string {
  const parts: string[] = [];
  for (let i = 0; i < effects.length; i++) {
    if (effects[i].kind === 'moveTwice' && effects[i + 1]?.kind === 'randomMove') {
      parts.push('Moves twice in a random direction');
      i++;
    } else {
      parts.push(printEffect(effects[i]));
    }
  }
  return parts.map((p, i) => (i === 0 ? p : lowerFirst(p))).join(', then ');
}

/** Glossary reminder text for each effect verb (one per `Effect` kind, so a new verb needs one). */
export const VERBS: Record<Effect['kind'], { term: string; gloss: string }> = {
  heal: { term: 'Heal', gloss: 'Restores hit points, never above maximum. "Heal fully" restores all of them.' },
  damage: { term: 'Deal damage', gloss: 'Magical damage: it ignores armor. Each minion named takes the full amount.' },
  kill: { term: 'Kill', gloss: 'The minion dies at once, whatever its hit points.' },
  terraform: { term: 'Terraform', gloss: 'Squares change terrain. Structures and Sanctum squares never change; a group on deadly terrain suffers at once.' },
  expend: { term: 'Expend', gloss: 'This spell is dispelled: it has done its work.' },
  dispelAll: { term: 'Dispel all', gloss: 'Dispels every enchantment on the target group and on its members. Undispellable spells stay.' },
  mana: { term: 'Mana', gloss: '"+N <Mana>": that player gains N mana of that type this turn (the caster unless "to its owner").' },
  give: { term: 'Gets', gloss: '"<Who> gets <Spell (text)>": that spell is cast on each minion named, ignoring casting rules. "Once each" skips minions that already have it.' },
  giveSquares: { term: 'Square gets', gloss: 'Like "gets", for squares: each square named that lacks the spell receives it.' },
  withdraw: { term: 'Withdraw', gloss: 'The current combat ends at once; no more rounds are fought.' },
  moveTwice: { term: 'Moves twice', gloss: 'The group repeats its move order in a second movement pass.' },
  randomMove: { term: 'Random direction', gloss: 'A player group\'s move order is replaced with a random legal direction.' },
  cancelMoves: { term: 'Cancel move orders', gloss: 'Every recruit group\'s move order (and any second move) is cancelled this turn.' },
  novices: { term: 'Create novices', gloss: 'Novices are added to the structure (at most 8 there). Trained as recruits, queued novices are of the named nation.' },
};
