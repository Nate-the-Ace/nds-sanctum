import type { Fragment, Keyword } from '../types';
import { defineKeyword } from '../registry';
import { printEffect, runEffect, type Effect } from '../effects';
import { triggerApplies, triggerEvent, triggerLabel, type Trigger } from '../triggers';

export interface OnKeyword extends Keyword {
  kind: 'on';
  trigger: Trigger;
  effects: Effect[];
}
/** "<Trigger>: effect, effect." Runs the effects whenever the trigger's event happens for this spell's host. */
export const On = (trigger: Trigger, ...effects: Effect[]): OnKeyword => ({ kind: 'on', trigger, effects });

defineKeyword<OnKeyword>({
  kind: 'on', term: 'Triggers', tier: 'core',
  gloss: 'A trigger runs its effects every time its event happens for the spell\'s host: start of turn, start of combat, each round, after all combat, before movement, the mana phase, a group entering, a recruit being created, a hit or damage dealt.',
  print: (k) => ({ layout: 'line', text: `${triggerLabel(k.trigger)}: ${k.effects.map(printEffect).join(', ')}.` }),
  compile: (k) => {
    const on: NonNullable<Fragment['on']> = {};
    on[triggerEvent(k.trigger)] = (c, ev) => {
      if (!triggerApplies(c, ev, k.trigger)) return;
      for (const e of k.effects) runEffect(c, ev, e);
    };
    return { on };
  },
});

export interface OnCastKeyword extends Keyword {
  kind: 'onCast';
  effects: Effect[];
}
/** Effects that happen once, when the spell is cast, relative to its target. */
export const OnCast = (...effects: Effect[]): OnCastKeyword => ({ kind: 'onCast', effects });

defineKeyword<OnCastKeyword>({
  kind: 'onCast', term: 'On cast', tier: 'core',
  gloss: 'Effects that happen once when the spell is cast.',
  print: (k) => ({ layout: 'line', text: `${k.effects.map(printEffect).join(', ')}.` }),
  compile: (k) => ({ onCast: (c, t) => { for (const e of k.effects) runEffect(c, undefined, e, t); } }),
});
