import { describe, it, expect } from 'vitest';
import '../src/index';
import { faceOf } from '../src/lang';

const lines = (id: string) => faceOf(id)?.lines;

describe('printed card text', () => {
  it('batch A: stat grants, walks, simple keywords', () => {
    expect(lines('flaming-sword')).toEqual(['Swordsman.', '+2 H.']);
    expect(lines('bloodlust')).toEqual(['Swordsman.', '+1 Attack.']);
    expect(lines('legionnaires')).toEqual(['Recruit group with swordsmen.', 'Swordsmen +1 H.']);
    expect(lines('ngozis-way')).toEqual(['Recruit group.', '+1 L.']);
    expect(lines('palisade')).toEqual(['Square.', 'Archers +1 A.']);
    expect(lines('redeemers-sword')).toEqual(['Swordsman.', '+2 H.']);
    expect(lines('caravan')).toEqual(['Recruit group.', 'Desertwalk.']);
    expect(lines('flight')).toEqual(['Recruit group.', 'Flight.']);
    expect(lines('pacifism')).toEqual(['Recruit.', 'Pacified.']);
    expect(lines('veteran')).toEqual(['Recruit.', '+1 H, +1 A, +4 HP.']);
    expect(lines('marksman')).toEqual(['Archer.', '+1 M, +2 HP, +1 Attack.']);
    expect(lines('rain-of-arrows')).toEqual(['Recruit group with archers.', 'Fleeting.', 'Archers +1 Attack.']);
    expect(lines('faerie-fire')).toEqual(['Recruit group with archers.', 'Fleeting.', 'Archers +2 M.']);
    expect(lines('war-drums')).toEqual(['Recruit group.', 'Plays triumphant music after a win.']);
    expect(lines('elven-piper')).toEqual(['Recruit group.', 'Plays bagpipe music at start of combat.']);
    expect(lines('armistice')).toEqual(['Globe.', 'Truce, Lasts 3 turns.']);
    expect(lines('thermite-damage')).toEqual(['Recruit.', '-1 A.']);
    expect(lines('youth')).toEqual(['Recruit.', '-1 L.']);
    expect(lines('greymantle')).toEqual(['Recruit.', 'Concealed.']);
    expect(lines('grace-of-auberol')).toEqual(['Recruit.', '+4 HP.']);
    expect(lines('drop-of-elixir-vitae')).toEqual(['Recruit.', '+6 HP.']);
    expect(lines('field-surgery-scar')).toEqual(['Recruit.', 'Undispellable.', '-1 HP.']);
    expect(lines('faerie-glade-square')).toEqual(['Square.', 'Bound to forest.', 'Enemy recruits -1 L.']);
  });
});
