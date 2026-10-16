import type { EventContext, GameEvent, Minion, Ref } from '@sanctum/engine';

/** Which minions an effect applies to, relative to the spell's host, the event, or the cast target. */
export type Scope =
  | 'host' | 'hostGroup' | 'hostGroupHurtOther' | 'hostOccupants'
  | 'victim' | 'enterer' | 'created' | 'opponent'
  | 'allBoard' | 'allRecruits'
  | 'target' | 'targetEach' | 'targetDamaged';

export const SCOPE_PHRASE: Record<Scope, string> = {
  host: '', hostGroup: ' (group)', hostGroupHurtOther: ' (most hurt ally)', hostOccupants: ' (recruits here)',
  victim: ' (victim)', enterer: ' (entering group)', created: ' (new recruit)', opponent: ' (opposing group)',
  allBoard: ' (all minions)', allRecruits: ' (all recruits)',
  target: '', targetEach: ' (each)', targetDamaged: ' (each damaged)',
};

export function hostGroupId(c: EventContext): number | undefined {
  const h = c.host;
  if (h.kind === 'group') return h.id;
  if (h.kind === 'minion') return c.minion(h.id)?.groupId;
  return undefined;
}

export function resolveScope(c: EventContext, ev: GameEvent | undefined, scope: Scope, target?: Ref): number[] {
  const members = (gid: number | undefined): number[] => (gid === undefined ? [] : c.minionsOf(gid).map((m) => m.id));
  const onBoard = (m: Minion) => m.status === 'alive' && !!c.group(m.groupId)?.pos;
  switch (scope) {
    case 'host':
      return c.host.kind === 'minion' ? [c.host.id] : [];
    case 'hostGroup':
      return members(hostGroupId(c));
    case 'hostGroupHurtOther': {
      const me = c.host.kind === 'minion' ? c.minion(c.host.id) : undefined;
      if (!me) return [];
      const hurt = c.minionsOf(me.groupId)
        .filter((m) => m.id !== me.id && m.kind === 'recruit' && m.hp < m.maxHp)
        .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
      return hurt ? [hurt.id] : [];
    }
    case 'hostOccupants': {
      const st = c.host.kind === 'structure' ? c.structure(c.host.id) : undefined;
      const g = st ? c.groupAt(st.pos) : undefined;
      return g && g.kind === 'recruit' ? members(g.id) : [];
    }
    case 'victim': {
      const id = ev?.data.victimId;
      return typeof id === 'number' && c.minion(id) ? [id] : [];
    }
    case 'enterer':
      return members(ev?.ref?.kind === 'group' ? ev.ref.id : undefined);
    case 'created': {
      const id = ev?.data.minionId;
      return typeof id === 'number' ? [id] : [];
    }
    case 'opponent': {
      const id = ev?.data.opponent;
      return typeof id === 'number' ? members(id) : [];
    }
    case 'allBoard':
      return Object.values(c.state.minions).filter(onBoard).map((m) => m.id);
    case 'allRecruits':
      return Object.values(c.state.minions).filter((m) => onBoard(m) && m.kind === 'recruit').map((m) => m.id);
    case 'target':
      return target?.kind === 'minion' ? [target.id] : [];
    case 'targetEach':
      return target?.kind === 'minion' ? [target.id] : target?.kind === 'group' ? members(target.id) : [];
    case 'targetDamaged':
      return resolveScope(c, ev, 'targetEach', target).filter((id) => {
        const m = c.minion(id);
        return !!m && m.hp < m.maxHp;
      });
  }
}
