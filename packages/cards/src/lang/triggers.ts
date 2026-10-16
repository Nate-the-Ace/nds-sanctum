import type { EventContext, EventType, GameEvent } from '@sanctum/engine';
import { isHostMinion } from '../helpers';
import { hostGroupId } from './scopes';

export type Trigger =
  | { when: 'startOfTurn' }
  | { when: 'startOfCombat'; against?: 'monster' }
  | { when: 'eachRound'; round?: number }
  | { when: 'afterAllCombat' }
  | { when: 'beforeMovement' }
  | { when: 'manaPhase' }
  | { when: 'enter'; group?: 'recruit' }
  | { when: 'created' }
  | { when: 'onHit' }
  | { when: 'onDamage'; victim?: 'monster' }
  | { when: 'moves' };

export const When = {
  startOfTurn: { when: 'startOfTurn' } as Trigger,
  startOfCombat: (against?: 'monster'): Trigger => ({ when: 'startOfCombat', against }),
  eachRound: (round?: number): Trigger => ({ when: 'eachRound', round }),
  afterAllCombat: { when: 'afterAllCombat' } as Trigger,
  beforeMovement: { when: 'beforeMovement' } as Trigger,
  manaPhase: { when: 'manaPhase' } as Trigger,
  enter: (group?: 'recruit'): Trigger => ({ when: 'enter', group }),
  created: { when: 'created' } as Trigger,
  onHit: { when: 'onHit' } as Trigger,
  onDamage: (victim?: 'monster'): Trigger => ({ when: 'onDamage', victim }),
  moves: { when: 'moves' } as Trigger,
};

export function triggerEvent(t: Trigger): EventType {
  switch (t.when) {
    case 'startOfTurn': return 'turn:start';
    case 'startOfCombat': return 'combat:start';
    case 'eachRound': return 'round:start';
    case 'afterAllCombat': return 'turn:afterCombat';
    case 'beforeMovement': return 'movement:before';
    case 'manaPhase': return 'mana:generate';
    case 'enter': return 'group:enter';
    case 'created': return 'minion:created';
    case 'onHit': return 'attacker:hits';
    case 'onDamage': return 'attacker:damages';
    case 'moves': return 'group:move';
  }
}

export function triggerLabel(t: Trigger): string {
  switch (t.when) {
    case 'startOfTurn': return 'Start of turn';
    case 'startOfCombat': return `Start of combat${t.against ? ' (vs monsters)' : ''}`;
    case 'eachRound': return t.round === undefined ? 'Each round' : `Round ${t.round}`;
    case 'afterAllCombat': return 'After all combat';
    case 'beforeMovement': return 'Before movement';
    case 'manaPhase': return 'Mana';
    case 'enter': return `On enter${t.group ? ' (recruit group)' : ''}`;
    case 'created': return 'Recruit created';
    case 'onHit': return 'On hit';
    case 'onDamage': return `On damage${t.victim ? ' (monster)' : ''}`;
    case 'moves': return 'After it moves';
  }
}

/** Group events matter only for the host's own group; a spell on the globe or a structure sees every group. */
const groupMatches = (c: EventContext, ev: GameEvent): boolean => {
  if (ev.ref?.kind !== 'group') return false;
  const hg = hostGroupId(c);
  return hg === undefined || hg === ev.ref.id;
};

export function triggerApplies(c: EventContext, ev: GameEvent, t: Trigger): boolean {
  switch (t.when) {
    case 'startOfCombat': return groupMatches(c, ev) && (!t.against || c.group(ev.data.opponent)?.kind === 'monster');
    case 'eachRound': return groupMatches(c, ev) && (t.round === undefined || ev.data.round === t.round);
    case 'enter': {
      const g = ev.ref?.kind === 'group' ? c.group(ev.ref.id) : undefined;
      return !!g && (!t.group || g.kind === 'recruit');
    }
    case 'onHit': return isHostMinion(c, ev);
    case 'onDamage': return isHostMinion(c, ev) && (!t.victim || c.minion(ev.data.victimId)?.kind === 'monster');
    case 'moves': return groupMatches(c, ev);
    case 'startOfTurn':
    case 'afterAllCombat':
    case 'beforeMovement':
    case 'manaPhase':
    case 'created':
      return true;
    default:
      return assertNever(t);
  }
}

function assertNever(x: never): never {
  throw new Error(`unhandled trigger ${JSON.stringify(x)}`);
}

/** Every trigger in its default form, from the `When` table (for the glossary). */
export const allTriggers = (): Trigger[] =>
  Object.values(When).map((w) => (typeof w === 'function' ? w() : w));

/** Triggers that react to events on the host minion, so the spell must sit on a minion. */
export const needsMinionHost = (t: Trigger): boolean => t.when === 'onHit' || t.when === 'onDamage';
