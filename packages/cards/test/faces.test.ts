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
  it('batch B: triggers and effects', () => {
    expect(lines('point-of-clarity')).toEqual(['Globe.', 'Stackable.', 'Mana: +1 Clarity.']);
    expect(lines('aura-of-world')).toEqual(['Globe.', 'Stackable.', 'Mana: +1 World.']);
    expect(lines('call-to-arms')).toEqual(['Town or colony.', 'Mana: +2 Strife (owner).']);
    expect(lines('ring-of-light')).toEqual(['Town or colony.', 'Mana: +2 Clarity (owner).']);
    expect(lines('court-politics-ii')).toEqual(['Globe.', 'Stackable.', 'Mana: +2 Clarity.']);
    expect(lines('fireball')).toEqual(['Group.', '5 damage (each).']);
    expect(lines('pyx')).toEqual(['Group.', 'Heal full (each).']);
    expect(lines('good-of-the-many')).toEqual(['Friendly recruit.', 'Kill.']);
    expect(lines('plains')).toEqual(['Square.', 'Square becomes plains.']);
    expect(lines('volcano')).toEqual(['Square.', 'Square becomes volcano.']);
    expect(lines('scorched-earth')).toEqual(['Forest square.', 'Contiguous forest becomes barren.']);
    expect(lines('cleansing-light')).toEqual(['Group.', 'Dispel all (target group).']);
    expect(lines('elixir-vitae')).toEqual(['Globe.', 'Give Drop of Elixir Vitae (+6 HP) (all recruits).']);
    expect(lines('field-surgery')).toEqual([
      'Friendly recruit group.', 'Give Field Surgery (Undispellable; -1 HP) (each damaged), Heal full (each).',
    ]);
    expect(lines('faerie-glade')).toEqual([
      'Forest square.', 'Give Faerie Glade (Bound to forest; Enemy recruits -1 L) to contiguous forest.',
    ]);
    expect(lines('forced-march')).toEqual(['Recruit group.', 'Move twice.']);
    expect(lines('amok')).toEqual(['Recruit group.', 'Move twice, Random direction.']);
    expect(lines('healing-hands')).toEqual(['Recruit.', 'Start of turn: Heal 1 (group).']);
    expect(lines('oasis')).toEqual([
      'Town or colony.', 'Adjacent squares become desert.', 'Start of turn: Heal 1 (recruits here).',
    ]);
    expect(lines('wellspring')).toEqual(['Square.', 'On enter (recruit group): Heal full (all minions), Expend.']);
    expect(lines('fountain-of-youth')).toEqual([
      'Square.', 'On enter: Heal full (entering group), Give Youth (-1 L) (entering group).',
    ]);
    expect(lines('thermites')).toEqual(['Recruit.', 'On hit: Give Thermite Damage (-1 A) (victim).']);
    expect(lines('dragon-slayer')).toEqual(['Archer.', 'On damage (monster): Kill (victim).']);
    expect(lines('clandestine')).toEqual([
      'Town or colony.', 'Lasts 5 turns.', 'Recruit created: Give Greymantle (Concealed) (new recruit).',
    ]);
    expect(lines('auberols-grace')).toEqual([
      'Town or colony.', 'Recruit created: Give Grace of Auberol (+4 HP) (new recruit), Heal 4 (new recruit).',
    ]);
    expect(lines('skirmish')).toEqual(['Group.', 'Fleeting.', 'Round 3: Withdraw.']);
    expect(lines('strategic-withdrawals')).toEqual(['Globe.', 'Round 7: Withdraw.']);
    expect(lines('liennas-sigil')).toEqual(['Group.', 'Start of combat (vs monsters): Withdraw.']);
    expect(lines('standoff')).toEqual(['Globe.', 'Lasts 2 turns.', 'Before movement: Cancel all moves.']);
    expect(lines('vivant')).toEqual([
      'Recruit.', 'Pacified.', 'Each round: Heal 3 (most hurt ally).', 'Start of turn: Heal full (group).',
    ]);
  });
});
