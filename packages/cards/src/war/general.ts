import { card, Script, Target } from '../lang';

// RULING: printed literally: +1 missile damage. A swordsman uses it only if it has a missile attack (Weapon Master).
// "Adjacent" = the four orthogonal neighbours of the General's square; the General's own group is not adjacent.
export default card({ id: 'general', name: 'General', house: 'war', cost: { strife: 3, clarity: 3 }, type: 'alteration',
  target: Target.recruit.friendly,
  keywords: [
    Script('Friendly swordsmen in the four adjacent squares get +1 M.', {
      reach: 'board',
      stats: (q, id, sp) => {
        if (sp.host.kind !== 'minion') return {};
        const general = q.minion(sp.host.id);
        const m = q.minion(id);
        const here = general ? q.group(general.groupId)?.pos : null;
        const there = m ? q.group(m.groupId)?.pos : null;
        if (!m || !here || !there || m.owner !== sp.owner || m.cls !== 'swordsman') return {};
        return Math.abs(here.x - there.x) + Math.abs(here.y - there.y) === 1 ? { missile: 1 } : {};
      },
    }),
  ] });
