import { defineCard } from '@sanctum/engine';
import { GROUP_TARGETS, INDIVIDUAL_TARGETS, minionAt } from '../helpers';

// RULING: "cannot join groups or add new recruits" is not enforced (the engine has no join-prevention hook yet).
export default defineCard({
  id: 'lone-wolf', name: 'Lone Wolf', house: 'war', cost: { strife: 2, clarity: 1 },
  type: 'alteration', target: 'recruit',
  canCast: (q, t) => {
    const m = minionAt(q, t);
    return m?.cls === 'swordsman' && q.minionsOf(m.groupId).length === 1;
  },
  stats: () => ({ hand: 3, armor: 1, maxHp: 6 }),
  onCast: (c, t) => {
    if (t.kind === 'minion') c.heal(t.id, 6);
  },
  blocksCast: (q, sp, a) => {
    if (a.caster !== sp.owner || sp.host.kind !== 'minion') return false;
    const wolf = q.minion(sp.host.id);
    if (!wolf) return false;
    if (INDIVIDUAL_TARGETS.includes(a.card.target)) return a.target.kind === 'minion' && a.target.id === wolf.id;
    if (GROUP_TARGETS.includes(a.card.target)) return a.target.kind === 'group' && a.target.id === wolf.groupId;
    return false;
  },
});
