import type { EventContext, GameEvent } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

function fire(c: EventContext, ev: GameEvent): void {
  if (ev.ref?.kind !== 'group') return;
  const g = c.group(ev.ref.id);
  if (!g || g.owner !== c.spell.owner) return;
  if (!c.minionsOf(g.id).some((m) => m.cls === 'archer' && m.nation === 'human')) return;
  for (const m of c.minionsOf(ev.data.opponent)) c.damage(m.id, 1);
}

// RULING: Cannon's damage is spell damage, which is magical here (it ignores armor). "Friendly" means the caster's.
export default card({ id: 'cannon', name: 'Cannon', house: 'war', cost: { strife: 4, clarity: 1 }, type: 'alteration',
  target: Target.globe,
  keywords: [
    Script('Start of combat: if the friendly group has a Human archer, deal 1 damage to each member of the opposing group.', {
      on: { 'combat:start': fire },
    }),
  ] });
