import type { Fragment, Keyword } from '../types';
import { defineKeyword } from '../registry';
import { printEffects, runEffect, type Effect } from '../effects';
import { requireHost } from '../hosts';
import { allTriggers, needsMinionHost, triggerApplies, triggerEvent, triggerLabel, type Trigger } from '../triggers';

export interface OnKeyword extends Keyword {
  kind: 'on';
  trigger: Trigger;
  effects: Effect[];
}
/** "<Trigger>: effect, effect." Runs the effects whenever the trigger's event happens for this spell's host. */
export const On = (trigger: Trigger, ...effects: Effect[]): OnKeyword => ({ kind: 'on', trigger, effects });

defineKeyword<OnKeyword>({
  kind: 'on', term: 'Triggers', tier: 'core',
  gloss: `"<Trigger>: effects." runs the effects every time that event happens for the spell's host. Triggers: ${allTriggers().map(triggerLabel).join(', ')}.`,
  print: (k) => ({ layout: 'line', section: 'trigger', text: `${triggerLabel(k.trigger)}: ${printEffects(k.effects)}.` }),
  compile: (k, ctx) => {
    if (needsMinionHost(k.trigger)) requireHost(ctx, 'minion', `"${triggerLabel(k.trigger)}"`);
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
  print: (k) => ({ layout: 'line', section: 'effect', text: `${printEffects(k.effects)}.` }),
  compile: (k) => ({ onCast: (c, t) => { for (const e of k.effects) runEffect(c, undefined, e, t); } }),
});
