# House of Making: card analysis

Source: `packages/cards/data/houses/making.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs making --per-house`).
Site house id 1. Mana: Order (primary) + Will (secondary). Nation: Dwarf (7 HP, Mountainwalk, no combat bonus;
already in `packages/engine/src/nations.ts`). Rules read: `research/rules/*` (spells, spelltargets, eventbubbling,
all Pipelines, structures, terrainswalks, concealment, monsters, boardhop, mothers, leavesgroup, relations,
initiative, manatypes, deckhand, minions). No new rules pages could be saved: every
`playsanctum.net/nioga/rules/<Section>/<name>.php` URL now returns 404 and the Wayback Machine was offline, so
Revolver, Recursive, Legacy and the Colony helper are ruled from card text only (see Rulings).

## 1. Summary

| Metric | Value |
|---|---|
| Cards | 50 |
| Rarity | Common 17, Uncommon 16, Rare 15, Very Rare 2 |
| Expansions | Classic 18, Revolutions 11, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 1 |
| Order-only costs | 15 of 50 |
| Cost curve (total mana) | 1:2, 2:12, 3:10, 4:5, 5:8, 6:6, 7:2, 8:3, 9:2 (median 3) |
| Classification | **A 12, B 24, C 13, D 1** |

Scrape: all 50 have name, slug, cost, rarity, text. `castOn` is null for 4 cards whose source text has no "Cast on"
sentence (checked against the live page, not a parse bug): Boret'hu's Influence (globe), and the monsters
Combustioneers, Homunculi, Mechanical Man (square, per Concepts_monsters "monsters targeted on squares"). Source-text
artifacts kept verbatim by the scraper: broken hyphenation `Player- controlled` (Karkara), `non- structure` (Lost Mine,
Natural Defenses, also inside Natural Defenses' `castOn`), a literal backslash `Town\'s` / `Mirrorers\'` (Panopticon text
and flavor), a soft hyphen U+00AD in Stronghold's flavor. Stat-line `(xN)` is ambiguous in the source: `H:4(x2)` = 2
attacks (Karkara, Mechanical Man) but `HP:2(x3)` / `HP:7(x4)` = 3 or 4 copies (Combustioneers, Homunculi, Appeal to
Hope). Any stat-line scaffolder must key on which field carries the `(xN)`.

## 2. Theme and mechanics

Engineers and artifacts. Five clusters:

| Cluster | Cards | Engine pieces |
|---|---|---|
| Arms and armor (recruit/group stat grants) | Ogi's Armor, Ogi's Arrows, Ogi's Gauntlet, Shieldbearers, Bow of Quickening, Rangefinder, Warhammer, Pinnacle of Order, Deflection, Fuligin, Man-Catcher, Loose Bearings, Field Armorer | `Grant`, combat events, round-aware stats (new) |
| Town works (structure spells) | Astronomic Clock, Fortify, Master Smith, Master Fletcher, Domed City, Panopticon, Lode Star, Natural Defenses, Trebuchet, Siege Engine, Found City | structure-hosted stats/`minion:created`/`mana:generate`; terraform; structure creation (new) |
| Mountains (Dwarf Mountainwalk synergy) | Mountain, Natural Defenses, Stronghold, Gnome, Juggernaut, Lost Mine | `setTerrain`, `.on('mountain')`, Mountainwalk |
| Constructs (monsters) | Homunculi, Combustioneers, Mechanical Man, Gnome, Juggernaut, Karkara, Toy Factory | `Monster` (needs count / player control / pre-terraform) |
| Clockwork tricks (globe, deck, mana, cost) | Adriel's Timepiece, Burst of Order, Oculus of Will, Blinding Orb, Belvario's Horn, Boret'hu's Influence, Quantum Mechanic, Theralda Glaivesforge, Ogi | initiative, mana, deck ops (new), cost modifiers (new), bot override (new) |
| Dwarf recruits / heroes | Ancient King, Ogi, Theralda Glaivesforge, Appeal to Hope (Vision garrison) | `Create`, `Hero` |

Nation notes: Dwarf swordsman base = H2 A1 HP7 L1 Mountainwalk; archer = M2 A0 HP7 L1 Mountainwalk. Printed lines
check out as final stats: Ancient King H3 A2 HP9 L2 = Dwarf swordsman + helper (+1 H, +1 A, +2 HP) at level 2; Ogi
M3 A3 HP7 L2 = Dwarf archer + Ogi's Arrows (+1 M) + Ogi's Armor (+3 A); Theralda H2 A1 HP7 L2 = plain Dwarf swordsman
at L2. Appeal to Hope's Visions are Hope-nation (Waterwalk) at L2, and its archers print **A:1** (archer base is A0),
so the archer definition needs `armor: 1`. Mountainwalk makes Mountain / Natural Defenses / Stronghold one-sided:
Dwarves cross and fight from mountains, most enemies are blocked or stuck there.

## 3. Classification (all 50 cards)

Cost is Order+Will. Type is the proposed `SpellType` (not on the card page). A = existing keywords today; B = small
lang-layer addition; C = new engine feature; D = special/hard. Keyword names in *italics* are proposed (section 4).

| # | Card | Cost | Rar | Type | Card text (verbatim) | Cl | Composition / what is missing |
|---|---|---|---|---|---|---|---|
| 1 | Adriel's Timepiece | 3+3 | C | manifestation | "Cast on globe. Swaps Initiative." | B | `Target.globe`, `OnCast(`*`SwapInitiative`*`())`; `ctx.setInitiative` + `state.initiative` exist. Ruling R1 (Lienna). |
| 2 | Ancient King | 4+3 | U | summoning | "H:3 A:2 HP:9 L:2 Cast on friendly town or colony. Creates a Dwarven swordsman. Ancient King gets +1 hand damage, +1 armor, and +2 maximum and current hit points. When Ancient King dies, all surviving members of his group get Legacy (+1 level)." | B | `Target.structure.friendly`, `Create({name,cls:'swordsman',nation:'dwarf',level:2},{with:['ancient-king-crown']})`; crown helper = `Grant({hand:1,armor:1,maxHp:2})` + `On(`*`When.dies`*`, Give('legacy','hostGroup'))`; `legacy` helper = `Grant({level:1})`. Near-dup of Warlord (War). |
| 3 | Appeal to Hope | 4+2 | U | summoning | "H:2 A:1 HP:7(x4) L:2, M:2 A:1 HP:7(x4) L:2 Cast on friendly, unoccupied town or colony. Creates a neutral, immobile group of 4 Vision swordsmen and 4 Vision archers. (Immobile groups cannot be moved.)" | B | `Target.structure.friendly`*`.unoccupied`*; new *`Garrison`* keyword: `ctx.summon({owner:'neutral', pos: structure pos, control:'computer', minions: 4 sw + 4 ar Vision L2 (archers A1)})` + `Immobile()` spell on each minion. Ruling R2 (hostile to everyone). |
| 4 | Astronomic Clock | 3+0 | R | alteration | "Cast on town or colony. Astronomic Clock generates +1 Will for town owner each turn." | **A** | `Target.structure`, `On(When.manaPhase, AddMana('will',1,'structureOwner'))`. Same shape as Call to Arms (War). |
| 5 | Belvario's Horn | 1+0 | C | alteration | "Cast on friendly recruit not in a structure. All mobile monsters move towards recruit. Dispelled when recruit's group enters structure. Only one in play at a time." | C | Needs an engine hook after computer orders are chosen (E8) to overwrite every non-Immobile computer monster's order with a step toward the recruit; *`.notInStructure`* (persistent, per Elements_spells), `On(`*`When.enter({into:'structure'})`*`, Expend())`, *`OnlyOneInPlay`*. Ruling R3. |
| 6 | Belvario's Trap | 4+2 | U | manifestation | "Cast on group. All members of group take five hit points of damage." | **A** | `Target.group`, `OnCast(Damage(5,'targetEach'))` (magical spell damage). |
| 7 | Beobogh's Helm | 4+2 | R | alteration | "Cast on friendly recruit. Recruit's group cannot be targeted by enemy group spells. Recruit and other members of its group cannot be targeted by Unmaking individual spells." | B | Group mother (Concepts_mothers lists it). `Target.recruit.friendly`, `Shroud({from:['group'],`*`against:'enemy'`*`})` (Shroud only has `'friendly'` today), `Immune(['unmaking'],`*`{group:true}`*`)` (Immune covers only the host minion today). |
| 8 | Blinding Orb | 4+1 | R | conjuration | "Cast on globe. All minions are concealed from opponent. (Concealed minions cannot be targeted by enemy individual spells.) Duration: Turn of casting +1." | B | `Target.globe`, `Lasts(2)`, `Concealment(`*`{from:'opponent'}`*`)` (today Concealment blocks both sides). Ruling R4. Near-dup of Fog of War (War). |
| 9 | Boret'hu's Influence | 3+2 | C | conjuration | "When any player casts a spell, a copy of that spell is added to the bottom of its caster's deck. Duration: Turn of casting +5." | C | Target globe (no "Cast on" in source). `Lasts(6)` + new untargeted event `spell:cast` (after a successful execution, `{caster, cardId}`) + `ctx.addToDeck(side, cardId, 'bottom')` (E5). Ruling R5. |
| 10 | Bow of Quickening | 3+0 | C | alteration | "Cast on archer. Archer gets +1 attack each round." | **A** | `Target.archer`, `Grant({attacks:1})`. Subset of Marksman (War). |
| 11 | Burst of Order | 2+0 | C | conjuration (orig. manifestation) | "Cast on globe. Caster gets +2 Order next turn." | **A** | `Target.globe`, `Lasts(2)`, `Stackable()`, `On(When.manaPhase, AddMana('order',2))`. Ruling R6. Every house likely has a "Burst of X": candidate shared *`Burst`* keyword. |
| 12 | Combustioneers | 2+2 | C | summoning | "M:2 A:0 HP:2(x3) L:1 Nomadic. Creates three Combustioneers. When a Combustioneer is killed, it explodes, inflicting 2 hit points of damage on its attacker." | B | Target square. `Nomadic()`, `Monster({...missile:2,hp:2},`*`{count:3}`*`)`, `On(`*`When.killed`*`, Damage(2,`*`'killer'`*`))` (`minion:killed` carries `blame`). |
| 13 | Deflection | 2+0 | U | alteration | "Cast on recruit. When recruit is damaged in combat (after checking armor), its attacker receives an equal amount of damage, ignoring armor." | B | `Target.recruit`, `On(`*`When.damagedAfterArmor`*`, Damage(`*`'eventAmount'`*`,`*`'attacker'`*`))` on `armor:after` (data `damage`, `attackerId`). Ruling R7. |
| 14 | Domed City | 5+0 | U | alteration | "Cast on town or colony. Town or colony cannot be targeted by structure spells." | B | `Target.structure`, `Shroud({from:[`*`'structure'`*`]})` (Shroud handles group/individual only). |
| 15 | Dwarven Airship | 2+1 | C | conjuration | "Cast on friendly group. Group gains Flight. (Group may cross any terrain, and is immune to adverse terrain effects.) When group moves into a structure, duration is reset to current turn +9. On expiration, group dies. Duration: Turn of casting +9." | B | `Target.group.friendly`, `Walk('flight')`, `Lasts(10)`, `On(`*`When.enter({into:'structure'})`*`,`*`ResetDuration(10)`*`)`, *`OnExpire(Kill('hostGroup'))`* (Afterward only casts a globe helper). Needs `ctx.setDuration` or the effect writes `spell.turnsLeft`. Near-dup of Flight (Life). |
| 16 | Field Armorer | 5+2 | U | alteration | "Cast on friendly recruit. At start of turn, a random friendly recruit in an adjacent square who doesn't have Field Armor gets Field Armor (+1 armor)." | B | `Target.recruit.friendly`, `On(When.startOfTurn, Give('field-armor',`*`'adjacentFriendlyRandom'`*`, true))`; the `once` filter must run before the random pick. Helper `field-armor` = `Grant({armor:1})` (visible). |
| 17 | Fortify | 2+1 | R | alteration | "Cast on town or colony. While in town, recruits in town get +1 armor." | **A** | `Target.structure`, `Grant({armor:1})` (structure-hosted stats reach the occupants, any owner). Same shape as Palisade (War). |
| 18 | Found City | 5+4 | R | manifestation | "Cast on square. Creates a neutral colony. (A new colony dispels its square and changes it to plains.)" | C | Structure creation (E7): `ctx.createStructure(pos,'colony','neutral')`, square dispel, plains, Colony helper (colony destroyed when its Colony spell is dispelled), structure-delta bookkeeping. Shared with Encampment (War backlog E8). |
| 19 | Fuligin | 2+0 | VR | alteration | "Cast on recruit. When recruit is hit in combat, Fuligin dispels the first individual spell on the attacking minion." | B | `Target.recruit`, `On(`*`When.hitInCombat`*`,`*`DispelFirst('attacker')`*`)` on `attack:hit` (victim side, `attackerId`). Ruling R8. |
| 20 | Gnome | 5+3 | R | summoning | "H:5 A:0 HP:20 L:2 Nomadic. Cast on mountain. After Gnome moves, its old square becomes barren land, and its new square becomes mountain. Against Misfits, Gnome casts Mountain under opposing group at start of combat, and withdraws at the start of combat round 3." | B | `Target.square.on('mountain')`, `Nomadic()`, `Monster({hand:5,hp:20,level:2,walks:['mountain']})` (Ruling R9), `On(When.moves, Terraform('barren',`*`'moveFrom'`*`), Terraform('mountain',`*`'moveTo'`*`))`, `On(When.startOfCombat(`*`{vsNation:'misfit'}`*`), Terraform('mountain',`*`'opponent'`*`))`, `On(When.eachRound(3,`*`{vsNation:'misfit'}`*`), Withdraw())`. |
| 21 | Homunculi | 3+0 | U | summoning | "M:2 A:0 HP:2(x3) L:1 Nomadic. Creates three Homunculi." | B | Target square. `Nomadic()`, `Monster({name:'Homunculus',missile:2,hp:2},`*`{count:3}`*`)`. |
| 22 | Juggernaut | 7+2 | VR | summoning | "H:10 A:1 HP:40 L:1 Nomadic, Neutral. Cast on mountain. Target mountain becomes barren land. After movement, Juggernaut's square has all spells dispelled, and becomes barren land. Cannot be targeted by Unmaking spells." | B | `Target.square.on('mountain')`, `Nomadic()`, `Monster({...},{neutral:true,`*`becomes:'barren'`*`})` (canCast must judge the terrain *after* the change), `On(`*`When.afterMovement`*`,`*`DispelSquare()`*`, Terraform('barren',`*`'hostSquare'`*`))`, `Immune(['unmaking'],`*`{kinds:['individual','group']}`*`)`. |
| 23 | Karkara | 1+1 | C | summoning | "H:4(x2) A:2 HP:25 L:1 Player- controlled, Waterwalk. Two attacks. Cast on friendly recruit group of three or more. Group is replaced by Karkara. Karkara executes the group's movement order on the turn it is created." | C | `Target.recruitGroup.friendly`*`.size(3)`*; onCast: `hide(group)`, `summon({control:'player', minions:[Karkara H4 x2 A2 HP25 walks water]})` at the same square, copy `moveOrder`/`moveSeq`; crew stays off the board inside the boardhop and is removed when Karkara dies (E6 `ctx.removeFromGame`). Ruling R10. |
| 24 | Lode Star | 3+2 | R | manifestation | "Cast on friendly town or colony. Five random non-structure squares in the 5x5 diamond centered on square become lava. (Lava causes 3 hit points of damage at start of turn unless group has Firewalk.)" | B | `Target.structure.friendly`, `OnCast(Terraform('lava',`*`{random:5, diamond:2}`*`))`. Ruling R11. |
| 25 | Loose Bearings | 3+2 | U | alteration | "Cast on group. Members of group do not attack in their first combat round. Dispelled after next combat." | C | `Target.group`, `Fleeting()`, stats `{handAttacks:-9, missileAttacks:-9}` only in combat round 1: stats cannot see the round today (E1). |
| 26 | Lost Mine | 2+1 | R | alteration | "Cast on square. A random non- structure square becomes Lost Mine's exit. After all combat, friendly recruit group in square disappears for current turn +1-3, then reappears in the exit square. (Group reappears at start of turn if its square is unoccupied, or on the earliest turn thereafter.)" | C | Square-hosted boardhop: onCast picks exit (tokens), `turn:afterCombat` hides the caster's recruit group in the square with a random return turn, `turn:start` appears it when the exit is empty. hide/appear exist; missing: an `onDispel` hook and `ctx.removeFromGame` ("removed if dispelled", Concepts_boardhop) (E6). Shared with Faerie Circle (Life backlog E6). Ruling R12. |
| 27 | Man-Catcher | 2+1 | U | alteration | "Cast on friendly recruit. Recruit, and the enemy minion with highest hand or missile damage, do not attack, nor deal hand or missile damage. Dispelled after next combat." | B | `Target.recruit.friendly`, `Pacified()`, `On(When.startOfCombat(), Give('caught',`*`'opponentStrongest'`*`))`, *`Fleeting` on a minion host* (today requires a group host). Helper `caught` = `Pacified()` + its own minion-host Fleeting. Ruling R13. |
| 28 | Master Fletcher | 3+1 | U | alteration | "Cast on town or colony. Every archer created in town gets Dwarven Arrows (archer ignores opponent's armor)." | C | `Target.structure`, `On(When.created, Give('dwarven-arrows',`*`'createdArchers'`*`))`; helper needs attacks that ignore armor: `combat.ts` always passes `ignoresArmor:false` (E2, new `StatDelta.ignoresArmor`). Dwarven Arrows is a visible helper (Elements_spells). |
| 29 | Master Smith | 3+1 | U | alteration | "Cast on town or colony. Every swordsman created in town gets Dwarven Blade (+1 hand damage)." | B | `Target.structure`, `On(When.created, Give('dwarven-blade',`*`'createdSwordsmen'`*`))`; helper `Grant({hand:1})` (visible). Near-dup of Clandestine (Life). |
| 30 | Mechanical Man | 5+1 | R | summoning | "H:4(x2) A:2 HP:12 L:2 Nomadic. Two attacks. Withdraws at the start of combat round 3." | **A** | Target square. `Nomadic()`, `Monster({name:'Mechanical Man',cls:'monster',hand:4,handAttacks:2,armor:2,hp:12,level:2})`, `On(When.eachRound(3), Withdraw())`. Same trigger as Skirmish (War). |
| 31 | Minefield | 3+2 | R | alteration | "Cast on square. On turn of casting +2, Minefield becomes active. Thereafter, when group enters square, or at start of turn if group occupies square, each member of group takes 2-6 hit points of damage, and Minefield is dispelled." | B | `Target.square`, *`Arms(3)`* (active from turn of casting +2), `On(When.enter(), Damage(`*`{min:2,max:6}`*`,'enterer'), Expend())`, `On(When.startOfTurn, Damage({min:2,max:6},`*`'squareOccupants'`*`), Expend())` (expend only if someone was there). Ruling R14. |
| 32 | Mountain | 5+1 | U | manifestation | "Cast on square. Square becomes mountain. (Mountain blocks movement unless group has Mountainwalk.)" | **A** | `Target.square`, `OnCast(Terraform('mountain'))`. Same as Volcano / Plains (War). |
| 33 | Natural Defenses | 1+1 | U | manifestation | "Cast on friendly town or colony adjacent to at least one non-structure, non- mountain square, and not adjacent to any enemy minions. Up to two random adjacent non-structure squares become mountain. (Mountain blocks movement unless group has Mountainwalk.)" | B | `Target.structure.friendly` + two canCast predicates (*`.adjacentTerrainNot('mountain')`*, *`.noAdjacentEnemies`*), `OnCast(Terraform('mountain',`*`{random:2, adjacent:true, exclude:['mountain']}`*`))`. Ruling R15. |
| 34 | Oculus of Will | 4+0 | C | alteration | "Cast on globe. Caster gets +1 Will each turn. May be cast more than once." | **A** | `Target.globe`, `Stackable()`, `On(When.manaPhase, AddMana('will',1))`. Same as Aura of World (Life), Point of Clarity (War). |
| 35 | Ogi | 4+4 | R | hero | "M:3 A:3 HP:7 L:2 Cast on friendly town or colony. Creates Ogi, a Dwarven Hero archer. Ogi has Ogi's Armor, Ogi's Arrows, and Ogi's Gauntlet, and they have no casting cost for Ogi's caster while he is in play. (Each Hero may be cast only once per game.)" | C | `Hero()`, `Target.structure.friendly`, `Create({name:'Ogi',cls:'archer',nation:'dwarf',level:2},{with:['ogis-armor','ogis-gauntlet'],`*`withGroup:['ogis-arrows']`*`})` (Arrows is a group spell); "no casting cost while in play" needs an engine cost-modifier hook (E3). Ruling R16. |
| 36 | Ogi's Armor | 3+0 | C | alteration | "Cast on recruit. Recruit gets +3 armor." | **A** | `Target.recruit`, `Grant({armor:3})`. |
| 37 | Ogi's Arrows | 3+1 | U | alteration | "Cast on recruit group with archers. Archers in group get +1 missile damage." | **A** | `Target.recruitGroup.with('archers')`, `Grant({missile:1},{to:'archers'})`. Same shape as Legionnaires (War). |
| 38 | Ogi's Gauntlet | 1+1 | C | alteration | "Cast on recruit. Recruit is concealed. (Concealed minions cannot be targeted by enemy individual spells.)" | **A** | `Target.recruit`, `Concealed()`. Same as Greymantle (Life helper). |
| 39 | Panopticon | 1+1 | U | conjuration | "Cast on town or colony. Town\'s 1 mana cycles through all six mana types, beginning with Strife. (Mana-generating spells on the town are not affected.) Duration: Turn of casting +6." | B | `Target.structure`, `Lasts(7)`, `On(When.manaPhase,`*`CycleTownMana(['strife','clarity','mystery','will','world','order'])`*`)`: removes the town's own 1 mana (`addMana(owner, st.manaType, -1)`) and adds the cycled type. Ruling R17. |
| 40 | Pinnacle of Order | 2+0 | R | alteration | "Cast on recruit. Recruit gets +T Armor, where T is the number of tokens. Recursive (Starts with 1 token. When cast, a copy of this spell is added to your hand that costs +1 mana and has +1 token.)" | C | Needs hand card *instances* carrying tokens and a cost delta (E4); stats `{armor: tokens.t}` once the instance's tokens reach the active spell. Shared with War/Life backlog E10 (Growing Strife, Greater Clarity). Ruling R18. |
| 41 | Quantum Mechanic | 1+1 | C | manifestation | "Cast on globe. All spells whose casting costs use only one mana type are drawn to the top of both player's decks." | C | Deck reorder ctx action (E5): for each side, stable-partition the deck so single-mana-type cards come first. |
| 42 | Rangefinder | 2+0 | C | alteration | "Cast on archer. Archer gets +1 missile damage. Archers in its group (including itself) get +1 missile damage in combat round 1 only." | C | Group mother. `Target.archer`, `Grant({missile:1})` + a round-1 group aura for archers: needs round-aware stats (E1) and an Aura that may share the card with a Grant (today Aura forbids other stat keywords; put the aura on a helper). |
| 43 | Shell of Gold | 2+0 | C | manifestation | "Cast on minion. Dispels all individual spells on minion." | B | *`Target.minion`* (builder missing; engine target type `minion` exists), `OnCast(DispelAll(`*`'minion'`*`))` (DispelAll handles a group target only). Near-dup of Cleansing Light (Life) at minion scale. |
| 44 | Shieldbearers | 3+2 | C | alteration | "Cast on recruit group. All members of group get +1 armor." | **A** | `Target.recruitGroup`, `Grant({armor:1})`. |
| 45 | Siege Engine | 4+1 | U | alteration | "Cast on recruit group. At start of combat against a group in a structure, Siege Engine inflicts 4 hit points of damage on each member of opposing group. Dispelled after one use." | B | `Target.recruitGroup`, `On(When.startOfCombat(`*`{opponentIn:'structure'}`*`), Damage(4,'opponent'), Expend())`. |
| 46 | Stronghold | 2+1 | R | alteration | "Cast on mountain. While in square, recruits in square get +1 level." | B | `Target.square.on('mountain')`, `Bound('mountain')`, `Grant({level:1},{to:`*`'recruits'`*`})` (GrantTo has no `recruits`). |
| 47 | Theralda Glaivesforge | 4+4 | R | hero | "H:2 A:1 HP:7 L:2 Cast on friendly town or colony. Creates Theralda Glaivesforge, a Dwarven Hero swordswoman. Caster's non-Making spells that have Order or Will in their casting cost are adjusted by -1 primary and -1 secondary mana of those spells' mana types." | C | `Hero()`, `Target.structure.friendly`, `Create({name:'Theralda Glaivesforge',cls:'swordsman',nation:'dwarf',level:2},{with:['theraldas-discount']})`; the discount needs the cost-modifier hook (E3). Ruling R19. |
| 48 | Toy Factory | 1+0 | R | conjuration | "Cast on square adjacent to friendly town or colony. At start of turn, one Combustioneer (M:2 A:0 HP:2 L:1 When killed, killer takes 2 damage) is created in square. Duration: M turns. Revolver (Casting cost M revolves from 1 to 10, starting at 1 and increasing by 1 mana per turn, restarting at 1 when it reaches 10, until cast)." | D | Three new mechanics at once: Revolver hand-instance cost (E4), a duration taken from the paid cost (instance data must reach the spell), and a recurring monster summon (Combustioneer def shared with #12). *`.adjacentToFriendlyStructure`* target. Ruling R20. |
| 49 | Trebuchet | 2+1 | C | manifestation | "Cast on group adjacent to friendly town or colony. A random member of group dies." | B | `Target.group`*`.adjacentToFriendlyStructure`*, `OnCast(Kill(`*`'targetRandom'`*`))`. |
| 50 | Warhammer | 2+0 | C | alteration | "Cast on swordsman. Swordsman gets +N hand damage, where N is swordsman's hand damage on turn of casting. Swordsman attacks every other combat round." | C | `Target.swordsman`, snapshot token on cast (as Swashbuckler, War) + round-aware stats (E1) to zero hand attacks on odd rounds. Ruling R21. |

Counts: **A 12** (Astronomic Clock, Belvario's Trap, Bow of Quickening, Burst of Order, Fortify, Mechanical Man,
Mountain, Oculus of Will, Ogi's Armor, Ogi's Arrows, Ogi's Gauntlet, Shieldbearers). **B 24**. **C 13** (Belvario's
Horn, Boret'hu's Influence, Found City, Karkara, Loose Bearings, Lost Mine, Master Fletcher, Ogi, Pinnacle of Order,
Quantum Mechanic, Rangefinder, Theralda Glaivesforge, Warhammer). **D 1** (Toy Factory).

Near-duplicates of shipped War/Life cards: Mountain (Volcano, Plains), Oculus of Will (Aura of World, Point of
Clarity), Astronomic Clock (Call to Arms), Fortify (Palisade), Ogi's Arrows (Legionnaires), Ogi's Gauntlet
(Greymantle), Bow of Quickening (Marksman minus HP), Mechanical Man (Skirmish trigger), Blinding Orb (Fog of War),
Dwarven Airship (Flight), Master Smith (Clandestine), Shell of Gold (Cleansing Light), Ancient King (Warlord),
Warhammer (Swashbuckler snapshot pattern), Ogi/Theralda (Lienna, Vlad Hrothgar).

## 4. Features to build (grouped into tasks)

Lang layer (B) tasks, in `packages/cards/src/lang`:

| Task | Contents | Unlocks (Making) |
|---|---|---|
| L1 Small effects and grants | `SwapInitiative`; `DispelAll('minion')`; `Kill('targetRandom')`; `GrantTo 'recruits'`; created-by-class scopes (`createdSwordsmen`, `createdArchers`); `adjacentFriendlyRandom` scope with pre-pick `once` filter; `Damage({min,max})`; `Arms(n)` delay modifier; `OnExpire(effects)`; `ResetDuration(n)` (+ `ctx.setDuration`); `CycleTownMana` | Adriel's Timepiece, Shell of Gold, Trebuchet, Stronghold, Master Smith, Field Armorer, Minefield, Dwarven Airship, Panopticon (**9**) |
| L2 Target builders | `Target.minion`; `.unoccupied`; `.notInStructure` (persistent); `.size(n)`; `.adjacentToFriendlyStructure`; `.adjacentTerrainNot(t)`; `.noAdjacentEnemies` | Shell of Gold, Appeal to Hope, Belvario's Horn, Karkara, Trebuchet, Toy Factory, Natural Defenses (**7**) |
| L3 Restriction variants | `Shroud({against:'enemy'})`; `Shroud({from:['structure']})`; `Immune(houses,{group, kinds})`; `Concealment({from:'opponent'})`; `OnlyOneInPlay` (global exclusivity via `blocksCast`) | Beobogh's Helm, Domed City, Juggernaut, Blinding Orb, Belvario's Horn (**5**) |
| L4 Monster options | `Monster(def,{count, becomes, control:'player'})` with canCast judged after `becomes`; Gnome walks mountain | Homunculi, Combustioneers, Gnome, Juggernaut (+ Karkara, Toy Factory) (**4+2**) |
| L5 Combat-reaction triggers | `When.dies` / `When.killed` (host minion; `killer` scope from `blame`); `When.hitInCombat` (`attack:hit`, victim side); `When.damagedAfterArmor` (`armor:after`); `attacker` scope; `Damage('eventAmount')`; `DispelFirst('attacker')` | Ancient King, Combustioneers, Deflection, Fuligin (+ Toy Factory) (**4**) |
| L6 Terrain areas and movement triggers | Terraform areas `{random:n, diamond:r}`, `{random:n, adjacent, exclude}`, `moveFrom`, `moveTo`, `opponent`, `hostSquare`; `When.afterMovement`; `When.enter({into:'structure'})`; `DispelSquare()` | Lode Star, Natural Defenses, Gnome, Juggernaut, Dwarven Airship, Belvario's Horn (**4 new + 2 shared**) |
| L7 Combat-start conditions | `When.startOfCombat({vsNation, opponentIn:'structure'})`, `eachRound(n,{vsNation})`; `opponentStrongest` scope; `Fleeting` on a minion host | Siege Engine, Gnome, Man-Catcher (**3**) |
| L8 Garrison | summon a neutral (or owned) recruit group of mixed classes on a structure square, each minion carrying the card's spell (for `Immobile`) | Appeal to Hope (**1**) |
| L9 Create `withGroup` | cast helper cards on the new recruit's group | Ogi (with E3) |

Engine (C) tasks, in `packages/engine/src`:

| Task | What exactly | Unlocks (Making) |
|---|---|---|
| E1 Round-aware stats | Store the running combat (`state.combat = {round, groups}` or `QueryContext.combatRound(minionId)`) so `stats` can depend on the round; `startRound` already recomputes stats each round, matching rule R1 ("do not attack" effects zero attacks at round start) | Loose Bearings, Rangefinder, Warhammer (**3**) |
| E2 Armor-ignoring attacks | `StatDelta.ignoresArmor` (or an editable `ignoresArmor` on `attacker:strikes` data) passed to `takeDamage` in `combat.ts` | Master Fletcher (**1**; also lets War's Thermites drop its Gargoyle RULING) |
| E3 Cost modifiers | `CardDef.costDelta?(q, spell, side, card) => Partial<ManaPool>` on active spells; `effectiveCost(e, side, cardId)` used by `validateOrders`, the UI and executeCast; floor at 0 per type; suspended off the board | Ogi, Theralda Glaivesforge (**2**; base for E4) |
| E4 Hand card instances | `hand: Array<{cardId, tokens, costDelta, turnsInHand}>` (or a parallel array); `turn:start` ticks Revolvers; Recursive adds a copy with `+1 token, +1 primary`; instance tokens are copied into the new `ActiveSpell.tokens` at cast; duration may read the paid cost | Pinnacle of Order, Toy Factory (**2**; War/Life backlog E10 too) |
| E5 Deck ops + cast event | `ctx.addToDeck(side, cardId, 'top'|'bottom'|'random')`, `ctx.reorderDeck(side, pred)`; untargeted `spell:cast` event after each successful real cast (not helpers) | Boret'hu's Influence, Quantum Mechanic (**2**) |
| E6 Boardhop lifecycle | `onDispel` hook (runs on any dispel, not only expiry); `ctx.removeFromGame(groupId)` ('removed' death category, no events); helper for "returns at start of turn when exit unoccupied" | Lost Mine, Karkara (**2**; Faerie Circle, Encampment, Seelie Court elsewhere) |
| E7 Structure creation | `ctx.createStructure(pos, kind, owner)` (dispels square spells, plains), Colony helper whose dispel/expiry destroys the colony, destroyed structures count -1 in the initiative delta | Found City (**1**; Encampment, Golden Grove, Seelie Court in backlog E8) |
| E8 Bot-order override | dispatch an untargeted event (e.g. `movement:ordered`) after computer groups choose orders in `runMovement`, so spells can rewrite them; expose "is Immobile" (bot identity or a flag) | Belvario's Horn (**1**) |

Top 5 by cards unlocked: L1 small effects (9), L2 target builders (7), L3 restriction variants (5), L4 monster options
(4, +2 partial), L5 combat-reaction triggers (4) (tied with L6 terrain areas, 4).

## 5. Shared mechanics (other houses will need these)

| Mechanic | Why shared |
|---|---|
| Round-aware stats (E1) | "in combat round 1 only", "does not attack", "every other round", Reaper-style round bonuses (Axioms_houses cites Reaper and Rangefinder as the same pattern) |
| Armor-ignoring attacks (E2) | Deva's Quiver, Spirit Sword, Thermites vs Gargoyles (Pipelines_damage) |
| Cost modifiers + hand instances (E3/E4) | Recursive and Revolver keywords appear in Allies & Traitors / Revolutions for every house; Syzygy, Dissolution, hero item discounts |
| Deck ops + `spell:cast` (E5) | any "copy added to deck/hand" card; backlog E10 |
| Boardhop lifecycle (E6) | Faerie Circle (Life E6), Encampment, Will o' the Wisp, Seelie Court, Soul Jar, Vision Quest |
| Structure creation (E7) | Civilize, Settlement, Dracha, Encampment, Golden Grove |
| Bot override (E8) | monster attraction / repulsion spells (Mirage, Siren Song style) |
| `When.dies` / `When.killed` + `killer` | death triggers are common in every house (Concepts_eventbubbling lists them) |
| `Monster` count / player control | multi-monster summons and player-controlled monsters exist in several houses |
| Mana generators and Bursts | each house has "+1 <mana> each turn" globe/structure spells and a "Burst of <mana>"; consider a `Burst` keyword |
| `Immune` / `Shroud` against a house | "cannot be targeted by <House> spells" recurs on monsters of all houses |
| `Target.minion`, `.unoccupied`, `.size(n)` | generic target phrases |

## 6. Ambiguities and proposed rulings

| # | Card | Question | Ruling |
|---|---|---|---|
| R1 | Adriel's Timepiece | Interaction with Lienna; does the swap reorder spells later in the same execution phase? | While any Lienna's Presence is active the swap does nothing (Axioms_initiative: Lienna supersedes the Timepiece). The swap affects this turn's movement and combat, not the remaining spell order (the engine fixes execution order before casting). |
| R2 | Appeal to Hope | A neutral group is hostile to everyone, including the caster's own groups next to the town. | Faithful: hostile to both players (Axioms_players "fights all"); it blocks enemy capture and the caster's own training there. It never captures (neutral). |
| R3 | Belvario's Horn | Which monsters; "only one in play"; Territorial monsters | Every computer-controlled monster group that is not Immobile, any owner, steps toward the recruit's group each movement (Territorial ones re-home as they leave). A second Horn squanders while one is active. Persistent: friendly + not in a structure (Elements_spells lists it under both). |
| R4 | Blinding Orb | "concealed from opponent": which minions, which casters? | The caster's opponent cannot target any minion he does not own with individual spells; the caster is unaffected. Spells that ignore concealment still work. |
| R5 | Boret'hu's Influence | Which casts count? | Every successful cast of a real card by either player (squandered casts and engine helpers do not), excluding the Influence's own cast. The copy goes to the bottom of that caster's deck. |
| R6 | Burst of Order | Manifestation with a next-turn effect | Implemented as a non-exclusive conjuration `Lasts(2)` adding +2 Order in the next mana phase. It is visible on the globe for one turn (dispellable by a globe dispel); acceptable. |
| R7 | Deflection | Amount, blame, damage kind | Equal to the post-armor damage after the engine's hp cap (Pipelines_damage D3), dealt as magical damage to the attacker. Death category "dies" (ctx.damage has no blame) although Pipelines_death would say "kills"; revisit if `ctx.damage` gains a blame option. |
| R8 | Fuligin | "first individual spell" | The oldest visible spell hosted on the attacking minion (not its group spells; non-visible spells cannot be dispelled). One per hit. |
| R9 | Gnome | Stat line lists no Mountainwalk but it is cast on and walks into mountains | Gnome has Mountainwalk (otherwise it could never leave its first square). "Misfits" = an opposing group containing at least one Misfit-nation minion. |
| R10 | Karkara | What happens to the crew | Per Elements_minions Karkara is a boardhop: the crew waits off the board; Karkara is a player-controlled monster group (cannot enter structures or capture). When Karkara dies its boardhop ends and the crew is removed from the game (Concepts_boardhop "removed if dispelled"). It inherits this turn's move order. |
| R11 | Lode Star | Which squares | Manhattan distance <= 2 from the town (12 squares), excluding structure and Sanctum squares; pick 5 distinct at random (fewer if fewer qualify). Occupied squares are allowed. |
| R12 | Lost Mine | Multiple groups; exit terrain; dispel | Several groups may be inside at once (one token pair each). The exit is fixed at cast and may be any non-structure square, including Sanctum entrances and water (return ignores terrain, Concepts_boardhop). If Lost Mine is dispelled, every group inside is removed from the game. |
| R13 | Man-Catcher | When is the enemy chosen; ties; several combats | At the start of the host's next combat, among the opposing group's minions, highest of hand or missile damage (current stats), random tie. Lasts only that one combat. Casting-time "friendly" only. |
| R14 | Minefield | Who triggers; damage roll | Any group (friendly too). Active from turn of casting +2 onward. Each member rolls 2-6 separately; magical damage. Dispelled after the first trigger. |
| R15 | Natural Defenses | "enemy minions"; choice pool | Enemy = the opponent's minions (neutral monsters do not count). Picks up to 2 adjacent squares that are non-structure, non-Sanctum, non-mountain; groups standing there get stuck unless they have Mountainwalk. |
| R16 | Ogi | Item spells and free cost | The three items are cast as their real (visible, dispellable) cards; Ogi's Arrows goes on Ogi's group. While Ogi is alive and on the board, the caster's Ogi's Armor / Arrows / Gauntlet cost 0. |
| R17 | Panopticon | Cycle order and start | Order Strife, Clarity, Mystery, Will, World, Order, one step per mana phase, starting with the first mana phase after casting; Lasts(7) gives exactly six generations. No effect on an unowned town or one without a chosen mana type. |
| R18 | Pinnacle of Order | Hand overflow; "+1 mana" type | The copy enters hand even above 5 cards. "+1 mana" is +1 primary (Order). Copies are the same card, so one per recruit (exclusive). |
| R19 | Theralda | Which spells, floor | Non-Making spells whose printed cost contains Order or Will: -1 of their house's primary and -1 of its secondary, each floored at 0. Only the caster's, only while Theralda is alive and on the board. |
| R20 | Toy Factory | Duration counting; occupied square; Combustioneer behaviour | "Duration: M turns" = `Lasts(M)` counting the casting turn, M = the cost paid. A Combustioneer is created only if the square is empty; it is a Nomadic monster owned by the caster with the Combustioneers explosion. The Revolver counter starts at 1 when the card enters the hand. |
| R21 | Warhammer | Which rounds | Hand attacks only in even rounds (2, 4, 6, 8, 10); round 1 has no hand attacks anyway. N is snapshotted at cast (token), so later bonuses do not double. |
| R22 | Combustioneers / Homunculi monsters | No "Cast on" in text | Target an empty square, like every monster. Explosion only on "kills" deaths (`minion:killed`), 2 magical damage to the blamed attacker. |
| R23 | Siege Engine | Damage kind | 4 magical damage to each member of the opposing group, death category "dies"; expended even if the opposing group dies. |
| R24 | Dwarven Airship | "group dies" | Every member dies ("dies" category) when the spell expires by duration; dispelling it early just removes Flight (no death). |

## 7. Proposed implementation order (cheapest first)

1. **The 12 A cards** as-is (pure keyword declarations; add faces to `faces.test.ts`).
2. **L1 + L2** (small effects, scopes, target builders): +8 cards (Adriel's Timepiece, Shell of Gold, Trebuchet,
   Stronghold, Master Smith, Field Armorer, Minefield, Panopticon); Dwarven Airship also needs L6's
   `When.enter({into:'structure'})`, Natural Defenses needs L6's terraform area.
3. **L3 restriction variants**: Beobogh's Helm, Domed City, Blinding Orb.
4. **L5 combat-reaction triggers**: Ancient King, Deflection, Fuligin.
5. **L4 monster options**: Homunculi, Combustioneers, then Juggernaut and Gnome with **L6** terrain areas; Lode Star,
   Natural Defenses.
6. **L7** combat-start conditions: Siege Engine, Man-Catcher (Gnome's Misfit clause).
7. **L8 Garrison**: Appeal to Hope.
8. **E1 round-aware stats**: Loose Bearings, Rangefinder, Warhammer.
9. **E2 armor-ignoring attacks**: Master Fletcher.
10. **E8 bot override**: Belvario's Horn.
11. **E6 boardhop lifecycle**: Lost Mine, Karkara (coordinate with Life's Faerie Circle).
12. **E5 deck ops + `spell:cast`**: Boret'hu's Influence, Quantum Mechanic.
13. **E3 cost modifiers**: Theralda Glaivesforge, Ogi (+ L9).
14. **E4 hand instances**: Pinnacle of Order (coordinate with backlog E10).
15. **E7 structure creation**: Found City (coordinate with backlog E8 Encampment).
16. **Toy Factory** last (needs E4 + Combustioneer def + instance-to-duration plumbing).

## 8. Risks

| Risk | Note |
|---|---|
| `Aura` exclusivity | Aura forbids any other stat-giving keyword on the same card; Rangefinder and Ancient King-style cards need their aura or death trigger on a helper card. |
| Dynamic costs touch UI and validation | E3/E4 change what `card.cost` means; `validateOrders`, the client hand view and any AI must all read the effective cost, or orders desync. |
| Hand as `string[]` | E4 changes `PlayerState.hand` shape; every consumer (orders by `handIndex`, discard, draw, view) moves at once. Coordinate across houses (Recursive/Revolver are in every house). |
| Neutral garrison semantics | Appeal to Hope's neutral group fighting its caster's adjacent groups may surprise players (R2); flag in card face text. |
| Off-board crews | Karkara and Lost Mine keep groups off the board indefinitely; without E6 they leak (never removed) and their spells stay suspended. |
| Rules pages unavailable | Revolver/Recursive/Colony/Legacy rulings rest on card text only; recheck if the rules site or an archive copy comes back. |
| Stat-line `(xN)` ambiguity | attacks vs copies depends on the field; a naive parser mis-builds Combustioneers/Homunculi/Appeal to Hope. |
| Mountain lock-in | Terraforming mountain under groups (Gnome vs Misfits, Natural Defenses) permanently traps non-Mountainwalk groups; acceptable per Elements_terrainswalks but worth an AI/UI hint. |
