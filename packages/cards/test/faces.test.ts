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
    expect(lines('veteran')).toEqual(['Recruit.', '+1 H, +1 A, +4 HP (heals 4).']);
    expect(lines('marksman')).toEqual(['Archer.', '+1 M, +2 HP (heals 2), +1 Attack.']);
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
    expect(lines('call-to-arms')).toEqual(['Town or colony.', 'Mana: +2 Strife to its owner.']);
    expect(lines('ring-of-light')).toEqual(['Town or colony.', 'Mana: +2 Clarity to its owner.']);
    expect(lines('court-politics-ii')).toEqual(['Globe.', 'Stackable.', 'Mana: +2 Clarity.']);
    expect(lines('fireball')).toEqual(['Group.', 'Deal 5 damage to each member.']);
    expect(lines('pyx')).toEqual(['Group.', 'Heal each member fully.']);
    expect(lines('good-of-the-many')).toEqual(['Friendly recruit.', 'Kill the target.']);
    expect(lines('plains')).toEqual(['Square.', 'Square becomes plains.']);
    expect(lines('volcano')).toEqual(['Square.', 'Square becomes volcano.']);
    expect(lines('scorched-earth')).toEqual(['Forest square.', 'Contiguous forest becomes barren.']);
    expect(lines('cleansing-light')).toEqual(['Group.', 'Dispel every enchantment on the group.']);
    expect(lines('elixir-vitae')).toEqual(['Globe.', 'Every recruit gets Drop of Elixir Vitae (+6 HP).']);
    expect(lines('field-surgery')).toEqual([
      'Friendly recruit group.', 'Each damaged member gets Field Surgery Scar (Undispellable; -1 HP), then heal each member fully.',
    ]);
    expect(lines('faerie-glade')).toEqual([
      'Forest square.', 'Each contiguous forest square gets Faerie Glade (Bound to forest; Enemy recruits -1 L).',
    ]);
    expect(lines('forced-march')).toEqual(['Recruit group.', 'Moves twice.']);
    expect(lines('amok')).toEqual(['Recruit group.', 'Moves twice in a random direction.']);
    expect(lines('healing-hands')).toEqual(['Recruit.', 'Start of turn: Heal its group by 1.']);
    expect(lines('oasis')).toEqual([
      'Town or colony.', 'Start of turn: Heal each recruit here by 1.', 'Adjacent squares become desert.',
    ]);
    expect(lines('wellspring')).toEqual(['Square.', 'On enter (recruit group): Heal every minion fully, then expend.']);
    expect(lines('fountain-of-youth')).toEqual([
      'Square.', 'On enter: Heal the entering group fully, then entering group gets Youth (-1 L) once each.',
    ]);
    expect(lines('thermites')).toEqual(['Recruit.', 'On hit: Victim gets Thermite Damage (-1 A).']);
    expect(lines('dragon-slayer')).toEqual(['Archer.', 'On damage (monster): Kill the victim.']);
    expect(lines('clandestine')).toEqual([
      'Town or colony.', 'Lasts 5 turns.', 'Recruit created: Each new recruit gets Greymantle (Concealed).',
    ]);
    expect(lines('auberols-grace')).toEqual([
      'Town or colony.', 'Recruit created: Each new recruit gets Grace of Auberol (+4 HP), then heal each new recruit by 4.',
    ]);
    expect(lines('skirmish')).toEqual(['Group.', 'Fleeting.', 'Round 3: Withdraw.']);
    expect(lines('strategic-withdrawals')).toEqual(['Globe.', 'Round 7: Withdraw.']);
    expect(lines('liennas-sigil')).toEqual(['Group.', 'Start of combat (vs monsters): Withdraw.']);
    expect(lines('standoff')).toEqual(['Globe.', 'Lasts 2 turns.', 'Before movement: Cancel all recruit move orders.']);
    expect(lines('vivant')).toEqual([
      'Recruit.', 'Pacified.', 'Each round: Heal the most hurt ally by 3.', 'Start of turn: Heal its group fully.',
    ]);
  });

  it('batch C: restrictions', () => {
    expect(lines('adriels-glamour')).toEqual(['Globe.', 'Lasts 5 turns.', 'No globe spells.']);
    expect(lines('adriels-promise')).toEqual(['Globe.', 'Lasts 8 turns.', 'No structure spells.']);
    expect(lines('individualism')).toEqual(['Globe.', 'Lasts 3 turns.', 'No group spells.']);
    expect(lines('fog-of-war')).toEqual(['Globe.', 'Lasts 3 turns.', 'All minions are Concealed.']);
    expect(lines('adriels-mantle')).toEqual(['Group.', 'Lasts 2 turns, Shroud.']);
    expect(lines('seelie-favor')).toEqual(['Non-friendly group.', 'Shroud (group spells).']);
    expect(lines('court-politics')).toEqual([
      'Globe.', 'Lasts 3 turns, Stackable.', 'Caster: no group or individual spells on friends.', 'Afterwards: Court Politics II (Stackable; Mana: +2 Clarity).',
    ]);
    expect(lines('lone-wolf')).toEqual([
      'Swordsman alone in its group.', 'Shroud (friendly spells).', '+3 H, +1 A, +6 HP (heals 6).',
    ]);
    expect(lines('faerie-knight')).toEqual(['Recruit.', 'Warded.', '+4 HP (heals 4).']);
    expect(lines('filigreed-armor')).toEqual(['Recruit.', 'Warded 1.', '+1 A.']);
  });

  it('batch D: Rage and scripts', () => {
    expect(lines('berserker-blade')).toEqual(['Swordsman.', 'Rage: +1 H each time hit, until end of combat.']);
    expect(lines('berserkers')).toEqual(['Recruit group.', 'Rage: +1 H per casualty (max +3), until end of combat.']);
    expect(lines('swashbuckler')).toEqual(['Swordsman.', 'Undispellable.', 'Gain L equal to A, then A becomes 0.']);
    expect(lines('shattering-blow')).toEqual(['Swordsman.', 'On hit: Kill the victim, then -1 H.']);
    expect(lines('liennas-steed')).toEqual([
      'Friendly recruit group.', 'Move 1 square diagonally toward the enemy and cancel its move order.',
    ]);
  });

  it('plan 2d: damage kinds', () => {
    expect(lines('cadre')).toEqual(['Recruit group with archers.', 'Archers +1 M against swordsmen.']);
    expect(lines('flaming-arrows')).toEqual([
      'Archer.', '+3 M against groups in a structure or forest.', 'When it hits an opponent in forest, that square becomes barren after all combat.',
    ]);
    expect(lines('yeoman')).toEqual([
      'Archer.', '+1 M.', 'Its missile damage is magical (ignores armor). When it hits a Keeper, the Keeper dies and Yeoman is dispelled.',
    ]);
    expect(lines('fae-gift')).toEqual(['Swordsman.', 'Becomes an Elf. Its attacks heal the victim instead of damaging it (armor soaks first).']);
    expect(lines('cannon')).toEqual([
      'Globe.', 'Start of combat: if the friendly group has a Human archer, deal 1 damage to each member of the opposing group.',
    ]);
  });

  it('plan 2d: card flow', () => {
    expect(lines('growing-strife')).toEqual(['Swordsman.', 'Recursive 1.', '+1 H.']);
    expect(lines('growing-strife-3')).toEqual(['Swordsman.', 'Recursive 3.', '+3 H.']);
    expect(lines('greater-clarity')).toEqual(['Archer.', 'Recursive 1.', '+1 M.']);
    expect(lines('book-of-war')).toEqual([
      'Globe.', 'When a recruit kills by combat damage, it gets +1 L at the start of the next turn (once per turn, at most L5).',
    ]);
    expect(lines('day-of-mourning')).toEqual([
      'Globe.', 'Lasts 5 turns.', "Each time a recruit dies, the top card of its owner's deck is removed from the game.",
    ]);
    expect(lines('seelie-champion')).toEqual(['Archer.', '+1 M for each alteration cast on it after this one.']);
    expect(lines('spy-at-court')).toEqual(['Town or colony.', "Start of turn: its caster sees the top card of the town's owner's deck."]);
    expect(lines('challenge')).toEqual(['Globe.', 'The owner of the highest-level recruit on the board gains Initiative (no change on a tie).']);
  });

  it('plan 2d: entry', () => {
    expect(lines('fae-quadrille')).toEqual([
      'Square.', 'Lasts 2 turns.', 'Heal every minion in the four adjacent squares fully when cast. The square cannot be entered.',
    ]);
    expect(lines('terrain-bind')).toEqual([
      'Group.', 'Lasts 3 turns.', 'It cannot enter a terrain different from the one it stands on (structures count as plains).',
    ]);
  });

  it('pins the printed text of every card', async () => {
    const { allCards } = await import('../src/index');
    const faces = Object.fromEntries(allCards.map((c) => [c.id, faceOf(c.id)?.lines]));
    expect(Object.keys(faces)).toHaveLength(121);
    expect(faces).toMatchSnapshot();
  });
});
