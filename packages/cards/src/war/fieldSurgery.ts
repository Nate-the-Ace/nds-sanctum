import { defineCard } from '@sanctum/engine';
import { isFriendlyGroup } from '../helpers';

export default defineCard({
  id: 'field-surgery', name: 'Field Surgery', house: 'war', cost: { strife: 1, clarity: 1 },
  type: 'manifestation', target: 'recruitGroup',
  canCast: isFriendlyGroup,
  onCast: (c, t) => {
    if (t.kind !== 'group') return;
    for (const m of c.minionsOf(t.id)) {
      if (m.hp >= m.maxHp) continue;
      c.createSpell('field-surgery-scar', { kind: 'minion', id: m.id });
      c.heal(m.id, 99);
    }
  },
});
