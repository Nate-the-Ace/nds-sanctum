# War and Life cards not yet implemented (72)

Implemented: 30 (17 War, 13 Life). Source data: `packages/cards/data/cards.json`. Each group is one engine extension;
implementing it unlocks the listed cards. `packages/cards/test/backlog.test.ts` keeps this list equal to `pendingCards`.
Card lines must stay in the form `- Name (War|Life)`.

## E1. Monsters, heroes, nations and minion creation (19)
Needs: summon with stat lines (`H:4 A:1 HP:16 L:2`), monster behaviours (Territorial, Nomadic, Immobile, Flight, Neutral,
off-board appearance), nations as a minion property, `ctx.addMinion(group, spec)`, novice creation in a town, a
once-per-game rule for heroes.
- Brimstone Dragon (War)
- Decoy (War)
- Dragon's Teeth (War)
- Firewyrm (War)
- Hellion (War)
- Ngozi (War)
- Salamander (War)
- Vlad Hrothgar (War)
- Warlord (War)
- Wyrmling (War)
- Allies (Life)
- Arboriads (Life)
- Bard (Life)
- Incarnate (Life)
- Lienna (Life)
- Prismatic Serpent (Life)
- Questing Beast (Life)
- Sylph (Life)
- Undine (Life)

## E2. Maximum hit points as a stat (6)
Needs: `StatDelta.maxHp` and "+N maximum and current hit points" on cast.
- Field Surgery (War)
- Lone Wolf (War)
- Marksman (War)
- Veteran (War)
- Elixir Vitae (Life)
- Faerie Knight (Life)

## E3. Mana generation (4)
Needs: `ctx.addMana(side, type, n)` during the mana step of start of turn.
- Call to Arms (War)
- Point of Clarity (War)
- Aura of World (Life)
- Ring of Light (Life)

## E4. Movement-order control (4)
Needs: persistent move-order cancellation, "moves twice" movement, random legal direction, diagonal teleport.
- Amok (War)
- Forced March (War)
- Lienna's Steed (Life)
- Standoff (Life)

## E5. Withdraw and combat cancellation (4)
Needs: a way to end a combat at a given round or before it starts.
- Armistice (War)
- Skirmish (War)
- Lienna's Sigil (Life)
- Strategic Withdrawals (Life)

## E6. Helper spells created on other hosts (6)
Needs: `ctx.createSpell(card, owner, host)` for engine-cast spells (Thermite Damage, Youth, Faerie Blessing, Grace of Auberol).
- Auberol's Grace (Life)
- Clandestine (Life)
- Faerie Circle (Life)

## E7. Casting and targeting restrictions (7)
Needs: spells that squander other spells (globe/group/structure bans), untargetable groups, global concealment.
- Fog of War (War)
- Adriel's Glamour (Life)
- Adriel's Mantle (Life)
- Adriel's Promise (Life)
- Court Politics (Life)
- Individualism (Life)
- Seelie Favor (Life)

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
