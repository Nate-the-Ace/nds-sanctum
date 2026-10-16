# War and Life cards not yet implemented

Implemented: 69 (34 War, 35 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Monsters, heroes, nations and minion creation (10)
Needs: summon with stat lines (`H:4 A:1 HP:16 L:2`), monster behaviours (Territorial, Nomadic, Immobile, Flight, Neutral,
off-board appearance), nations as a minion property, `ctx.addMinion(group, spec)`, novice creation in a town, a
once-per-game rule for heroes. This is the next plan (2c).
- Decoy (War)
- Dragon's Teeth (War)
- Ngozi (War)
- Vlad Hrothgar (War)
- Warlord (War)
- Allies (Life)
- Bard (Life)
- Incarnate (Life)
- Lienna (Life)
- Questing Beast (Life)

## E6. Spells that remove a group for a while (1)
Needs: groups that disappear from the board and reappear (boardhop-style), with a "cannot re-enter" rule.
- Faerie Circle (Life)

## E8. Initiative and structures (6)
Needs: `ctx.setInitiative`, create/destroy/move structures, colonies, hidden structures.
- Challenge (War)
- Defensive Pact (War)
- Encampment (War)
- Golden Grove (Life)
- Seelie Court (Life)
- Spy at Court (Life)

## E9. Damage kinds and conditional damage (5)
Needs: per-attack modifiers keyed on the target (vs swordsmen, vs structure/forest), magical missile damage, healing
attacks, nation conditions.
- Cannon (War)
- Flaming Arrows (War)
- Cadre (Life)
- Fae Gift (Life)
- Yeoman (Life)

## E10. Tokens, copies and experience (5)
Needs: recursive hand copies with token counts, "subsequent alteration" counting, grant experience level, deck removal.
- Book of War (War)
- Growing Strife (War)
- Day of Mourning (Life)
- Greater Clarity (Life)
- Seelie Champion (Life)

## E11. One-off mechanics (6)
Needs: effects that reach other squares (General, Fae Quadrille), random eruption (Lava Flow), ownership change
(Renegades), class change (Weapon Master), terrain lock (Terrain Bind).
- General (War)
- Lava Flow (War)
- Renegades (War)
- Weapon Master (War)
- Fae Quadrille (Life)
- Terrain Bind (Life)
