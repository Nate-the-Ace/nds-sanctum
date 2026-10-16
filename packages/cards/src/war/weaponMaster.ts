import { card, Script, Target } from '../lang';

// RULING: the recruit keeps its class and gains the other attack, so from round 2 it attacks with both (missile
// first). "Targeted by both archer and swordsman spells" covers individual spells only; group spells "with archers" and
// class grants ("Archers +1 M") still go by the real class.
// RULING: the clause "Cannot be targeted by Bear, Eagle, Lion, or Lizard Spirit, or Shapeshifter" is not implemented:
// those are Body/Nature cards, not in this game.
export default card({ id: 'weapon-master', name: 'Weapon Master', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'alteration',
  target: Target.recruit,
  keywords: [
    Script('A swordsman gains a missile attack (M:2); an archer gains a sword attack (H:2). Archer and swordsman spells can target it.', {
      stats: (q, id, sp) => {
        if (sp.host.kind !== 'minion' || sp.host.id !== id) return {};
        const m = q.minion(id);
        if (m?.cls === 'swordsman') return { missile: 2, missileAttacks: 1, dualClass: true };
        if (m?.cls === 'archer') return { hand: 2, handAttacks: 1, dualClass: true };
        return {};
      },
    }),
  ] });
