import type { PlayerId } from '@sanctum/engine';
import { card, Script, Target } from '../lang';

// RULING: neutral recruits count when finding the highest level, but neutral cannot hold Initiative, so a neutral top or
// a tie involving neutral changes nothing. The change is immediate (movement and combat this turn); this turn's spell
// order was fixed before spells ran.
export default card({ id: 'challenge', name: 'Challenge', house: 'war', cost: { strife: 2, clarity: 2 }, type: 'manifestation',
  target: Target.globe,
  keywords: [
    Script('The owner of the highest-level recruit on the board gains Initiative (no change on a tie).', {
      onCast: (c) => {
        let best = -1;
        let owners = new Set<PlayerId>();
        for (const m of Object.values(c.state.minions)) {
          if (m.kind !== 'recruit' || m.status !== 'alive' || !c.group(m.groupId)?.pos) continue;
          const level = c.stats(m.id).level;
          if (level > best) {
            best = level;
            owners = new Set([m.owner]);
          } else if (level === best) {
            owners.add(m.owner);
          }
        }
        const [only] = [...owners];
        if (owners.size === 1 && only !== undefined && only !== 'neutral') c.setInitiative(only);
      },
    }),
  ] });
