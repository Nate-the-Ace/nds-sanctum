import { isHostMinion } from '../../helpers';
import { requireHost } from '../hosts';
import { defineKeyword } from '../registry';
import type { Fragment, Keyword } from '../types';

/* ---------- Ramp (the Rage mechanic) ---------- */

export interface RampKeyword extends Keyword {
  kind: 'ramp';
  per: 'hit' | 'casualty';
  cap?: number;
}
/**
 * Rage: grows +1 H until the end of the combat. `Ramp('hit')`: each time the host minion is hit.
 * `Ramp('casualty', cap)`: each death in the host group during combat, up to `cap`.
 */
export const Ramp = (per: 'hit' | 'casualty', cap?: number): RampKeyword => ({ kind: 'ramp', per, cap });

const capped = (n: number, cap?: number) => (cap === undefined ? n : Math.min(cap, n));

defineKeyword<RampKeyword>({
  kind: 'ramp', term: 'Rage', tier: 'house',
  gloss: 'Ability word for a damage bonus that grows during a combat and resets when it ends.',
  print: (k) => ({
    layout: 'line',
    text: `Rage: +1 H ${k.per === 'hit' ? 'each time hit' : 'per casualty'}${k.cap === undefined ? '' : ` (max +${k.cap})`}, until end of combat.`,
  }),
  compile: (k, ctx) => {
    // Token names carry the keyword's index so two Ramps on one card keep separate counters.
    const t = (name: string) => `r${ctx.index}:${name}`;
    const rage = t('rage');
    const casualties = t('casualties');
    const fighting = t('fighting');
    if (k.per === 'hit') {
      requireHost(ctx, 'minion', 'Rage (each time hit)');
      return {
        stats: (_q, _id, spell) => ({ hand: spell.tokens[rage] ?? 0 }),
        on: {
          'attack:hit': (c, ev) => {
            if (isHostMinion(c, ev)) c.setToken(rage, capped(c.token(rage) + 1, k.cap));
          },
          'combat:end': (c) => {
            c.setToken(rage, 0);
          },
        },
      };
    }
    return {
      stats: (_q, _id, spell) => ({ hand: spell.tokens[casualties] ?? 0 }),
      on: {
        'combat:start': (c) => {
          c.setToken(fighting, 1);
        },
        // Any death during combat counts, including instant kills (ctx.kill, blame null).
        'minion:dies': (c) => {
          if (c.token(fighting) === 1) c.setToken(casualties, capped(c.token(casualties) + 1, k.cap));
        },
        'combat:end': (c) => {
          c.setToken(casualties, 0);
          c.setToken(fighting, 0);
        },
      },
    };
  },
});

/* ---------- Script (escape hatch) ---------- */

export interface ScriptKeyword extends Keyword {
  kind: 'script';
  text: string;
  fragment: Fragment;
}
/** Card-specific rules that fit no keyword. Must carry its own printed `text`; prefer a keyword when one exists. */
export const Script = (text: string, fragment: Fragment): ScriptKeyword => ({ kind: 'script', text, fragment });

defineKeyword<ScriptKeyword>({
  kind: 'script', term: 'Special rule', tier: 'oneoff',
  gloss: 'A rule that only this card has; the card prints it in full.',
  print: (k) => ({ layout: 'line', text: k.text }),
  compile: (k) => k.fragment,
});
