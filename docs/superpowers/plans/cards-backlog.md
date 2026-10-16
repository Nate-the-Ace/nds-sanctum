# War and Life cards not yet implemented

Implemented: 97 (48 War, 49 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Hunted-group monsters (1)
Needs: summoning in a random square, a recruit group that leaves player control and hunts a monster until it leaves
play, "cannot join groups / create recruits / enter structures" restrictions, and a start-of-combat "dies unless free"
check. (The other 18 creature cards shipped in plan 2c.)
- Questing Beast (Life)

## E8. Structures (4)
Needs: create/destroy/move structures, colonies, hidden structures.
- Defensive Pact (War)
- Encampment (War)
- Golden Grove (Life)
- Seelie Court (Life)

