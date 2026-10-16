# War and Life cards not yet implemented

Implemented: 90 (44 War, 46 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Hunted-group monsters (1)
Needs: summoning in a random square, a recruit group that leaves player control and hunts a monster until it leaves
play, "cannot join groups / create recruits / enter structures" restrictions, and a start-of-combat "dies unless free"
check. (The other 18 creature cards shipped in plan 2c.)
- Questing Beast (Life)

## E6. Spells that remove a group for a while (1)
Needs: groups that disappear from the board and reappear (boardhop-style), with a "cannot re-enter" rule.
- Faerie Circle (Life)

## E8. Structures (4)
Needs: create/destroy/move structures, colonies, hidden structures.
- Defensive Pact (War)
- Encampment (War)
- Golden Grove (Life)
- Seelie Court (Life)

## E11. One-off mechanics (6)
Needs: effects that reach other squares (General, Fae Quadrille), random eruption (Lava Flow), ownership change
(Renegades), class change (Weapon Master), terrain lock (Terrain Bind).
- General (War)
- Lava Flow (War)
- Renegades (War)
- Weapon Master (War)
- Fae Quadrille (Life)
- Terrain Bind (Life)
