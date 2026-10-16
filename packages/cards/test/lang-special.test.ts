import { describe, it, expect } from 'vitest';
import { computeStats, dispatch } from '@sanctum/engine/src/testing';
import { card, faceOf, Ramp, Script, Target } from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

describe('Ramp', () => {
  it('hit: +1 H each time the host is hit, reset at end of combat', () => {
    const e = mini([card({ id: 'rage', name: 'Rage', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman, keywords: [Ramp('hit')] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman']);
    const id = g.minionIds[0];
    castMini(e, 'red', 'rage', { kind: 'minion', id });
    dispatch(e, 'attack:hit', { kind: 'minion', id }, {});
    dispatch(e, 'attack:hit', { kind: 'minion', id }, {});
    expect(computeStats(e, id).hand).toBe(4);
    dispatch(e, 'combat:end', { kind: 'group', id: g.id }, {});
    expect(computeStats(e, id).hand).toBe(2);
  });

  it('casualty: +1 H per combat death for the group, capped, reset at end of combat', () => {
    const e = mini([card({ id: 'berserk', name: 'Berserk', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Ramp('casualty', 3)] })]);
    const g = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'swordsman', 'swordsman']);
    const [dying, other] = g.minionIds;
    castMini(e, 'red', 'berserk', { kind: 'group', id: g.id });
    dispatch(e, 'minion:dies', { kind: 'minion', id: dying }, { blame: null });
    expect(computeStats(e, other).hand).toBe(2); // not in combat yet
    dispatch(e, 'combat:start', { kind: 'group', id: g.id }, { opponent: 0 });
    for (let i = 0; i < 5; i++) dispatch(e, 'minion:dies', { kind: 'minion', id: dying }, { blame: null });
    expect(computeStats(e, other).hand).toBe(5);
    dispatch(e, 'combat:end', { kind: 'group', id: g.id }, {});
    expect(computeStats(e, other).hand).toBe(2);
  });

  it('prints', () => {
    card({ id: 'r1', name: 'r1', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman, keywords: [Ramp('hit')] });
    card({ id: 'r2', name: 'r2', house: 'war', cost: {}, type: 'alteration', target: Target.recruitGroup, keywords: [Ramp('casualty', 3)] });
    expect(faceOf('r1')!.lines).toEqual(['Swordsman.', 'Rage: +1 H each time hit, until end of combat.']);
    expect(faceOf('r2')!.lines).toEqual(['Recruit group.', 'Rage: +1 H per casualty (max +3), until end of combat.']);
  });
});

describe('Script', () => {
  it('contributes its hooks and prints its text', () => {
    const e = mini([
      card({
        id: 'scr', name: 'Scr', house: 'war', cost: {}, type: 'manifestation', target: Target.recruit,
        keywords: [Script('Double the target hp.', { onCast: (c, t) => { if (t.kind === 'minion') c.heal(t.id, 0); } })],
      }),
    ]);
    const id = put(e, 'red', { x: 4, y: 4 }, ['swordsman']).minionIds[0];
    expect(castMini(e, 'red', 'scr', { kind: 'minion', id })).toBe('cast');
    expect(faceOf('scr')!.lines).toEqual(['Recruit.', 'Double the target hp.']);
  });
});
