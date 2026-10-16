# House of Body: card analysis

Source: `packages/cards/data/houses/body.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs body --per-house`),
rules in `research/rules/*.txt`, vocabulary in `packages/cards/src/lang/**`, engine in `packages/engine/src/**`.
Research only: nothing here is implemented yet.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 52 (site house id 6) |
| Mana | World primary (148 World across the house), Mystery secondary (58). 21 cards cost World only. |
| Nation | Cyclops: 9 HP, no walk, no combat bonus (`nations.ts` already has this) |
| Rarity | Common 19, Uncommon 16, Rare 14, Very Rare 3 |
| Expansion | Classic 20, Revolutions 10, Oppositions 8, Allies & Traitors 8, Bloodlines 5, Whispers 1 |
| Classes | **A 12** (keywords exist), **B 25** (lang layer only), **C 14** (engine feature), **D 1** (hard) |

Cost curve (total mana):

| Total | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Cards | 6 | 9 | 13 | 6 | 5 | 4 | 4 | 3 | 2 |

## 2. Theme and mechanics

Cyclops shamans: "world walking" (Xa Macao) and "mystery walking" (Xa Cessao). Mechanic families:

| Family | Cards | Notes |
|---|---|---|
| Body buffs (stats / heal) | Strength of Body, Korgian Loincloth, Rite of Growth, Fortitude, Rampage, Big Rock, Healing Balm, Regenerate, Nereid's Curse | mostly A/B; needs `Target.minion` / `Target.monster` |
| Terrainwalk / movement | Mountain Climb, Water Walking, Shaman's Walk, Mountaindancer, Worldwalking, Fleetness, Outcast, Complacency, Seedbearers | group-mother auras with walks, leave-group, rooted |
| Spirit forms (wereforms) | Bear, Eagle, Lion, Lizard Spirit, Shapeshifter | random form flip each start of turn; one new keyword covers four cards |
| Beasts (monsters) | Blue Auk, Giant, Great Bear, Priodont, Minotaur, Carnivorous Plant, Brown Striders | "cast within a 3x3 diamond centred on <terrain>" placement rule |
| Beast companions | Brother Wolf, Lycanthropy, Spirit Binding | damage redirect, group replacement, stat copy |
| Dispel / cleanse | Circle of Wisdom, Ritual Cleansing, Vision Quest, Ancestral Home | DispelAll must also work on a minion and a structure |
| The Cessao (off the board) | Cessao Rift, Cessao Spiral, Vision Quest, Xia's Walk | remove-from-game, boardhop with timer, neutral recruit groups |
| Land / structures | Savannah, Jungle, Seedbearers, Ancestral Home, Fertility, Scrying Pool | 3x3 terraform, structure move/destroy, concealment piercing |
| Mana | Balance of Mystery, Burst of World | A |
| Heroes / Cyclops | Olotus, Oro, Nomadic Tribe, Big Rock, Mask of Woad | nation-filtered targets and scopes |

## 3. Classification (all 52)

Legend: A = existing keywords; B = new lang-layer keyword/effect/trigger/scope/target (or a `Script` using only
existing ctx); C = engine change; D = hard. Type = spell type inferred (the scrape has no type field). Cost W = World,
M = Mystery. Feature ids refer to section 4.

| # | Card | Rar | Cost | Type | Text (quoted) | Cl | Composition / what is missing |
|---|---|---|---|---|---|---|---|
| 1 | Ancestral Home | R | W4 M3 | alteration | "Cast on town or colony. Colony is destroyed. Dispels all spells on town. Town cannot be targeted by structure spells. When any recruits are created in town, town moves to an adjacent empty square, leaving plains. (A town dispels its square and changes it to plains.)" | C | F12 destroy colony + relocate structure; F4 DispelAll on structure; Shroud for structure host (B); `On(When.created, MoveTown)` |
| 2 | Balance of Mystery | C | W4 | alteration | "Cast on globe. Caster gets +1 Mystery each turn. May be cast more than once." | A | `Target.globe, [Stackable(), On(When.manaPhase, AddMana('mystery', 1))]` = Point of Clarity (War) |
| 3 | Bear Spirit | C | W1 M1 | alteration | "H:3(x2) A:0 L:0 Two attacks. Cast on swordsman. At start of turn, swordsman changes randomly between Bear and recruit form. Cannot be targeted by Weapon Master. (Hit points, levels, and spells remain unchanged after each transformation.)" | B | F2 `Wereform('Bear', {hand:3, handAttacks:2, armor:0, level:0})` + `ImmuneTo(['weapon-master'])` |
| 4 | Big Rock | U | W1 M1 | alteration | "Cast on Cyclops archer. Archer gets +3 missile damage and -1 level." | B | F1 `Target.archer.nation('cyclops')` + `Grant({missile:3, level:-1})` |
| 5 | Blue Auk | C | W2 M1 | summoning | "H:3 A:0 HP:16 L:1 Nomadic, Waterwalk. Cast within a 3x3 diamond centered on a water square." | B | F1 `Target.square.near('water')`, `Nomadic(), Monster({hand:3, hp:16, level:1, walks:['water']})` |
| 6 | Brother Wolf | U | W3 M1 | summoning | "H:3 A:0 HP:10 L:1 Cast on friendly recruit group. Creates Wolf. Other members of his group no longer attack. When any other member of his group is hit (before checking armor), Wolf receives the damage instead, ignoring armor. When Wolf dies, his group withdraws at the start of the next round, ending combat. Only one of Whipping Boy or Brother Wolf in a group." | C | F11 damage redirect; F3 Aura `others: Pacified`; group-hosted helper for "withdraw after Wolf dies" (token + `round:start` endCombat); `Create(..., {onePerGroup, exclusiveWith:['whipping-boy']})` |
| 7 | Brown Striders | C | W4 | summoning | "H:2 A:0 HP:3(x3) L:2 Cast on globe. Creates three Brown Striders off the board. Before combat, Striders appear in forest adjacent to a non-friendly recruit group. After all combat, they disappear again. Withdraws at the start of combat round 3. Striders' hits give Strider's Venom (-1 hand damage, cumulative). Dispelled when killed. May be cast more than once." | B | `Stackable(), Ambush({hand:2, hp:3, level:2}, {terrain:['forest'], count:3}), On(When.eachRound(3), Withdraw()), On(When.onHit, Give('striders-venom','victim'))` + helper `Grant({hand:-1})`. B because of F4 trigger-host guard (the globe controller copy would withdraw every combat) |
| 8 | Burst of World | C | W2 | conjuration | "Cast on globe. Caster gets +2 World next turn." | A | `Undispellable(), Lasts(2), On(When.manaPhase, AddMana('world', 2))` (see ruling R4) |
| 9 | Carnivorous Plant | C | W5 M2 | summoning | "H:* A:1 HP:10 L:1 Immobile. Carnivorous Plant's hand damage is equal to its current hit points. Withdraws at the start of combat round 4. Gets -5 hand damage if its owner has Initiative. (Immobile monsters cannot be moved.)" | B | `Immobile(), Monster({handAttacks:1, armor:1, hp:10}), On(When.eachRound(4), Withdraw())` + `Script` stats `hand = hp - (initiative===owner ? 5 : 0)`; printer needs `H:*` |
| 10 | Cessao Rift | R | W3 M2 | conjuration | "Cast on square. At start of turn, if square is unoccupied, there is a 20% chance that a neutral group of random nation, injury, and enchantments is created in square. (Neutral recruit groups cannot enter structures.) Duration: Turn of casting +6." | D | F18 neutral recruit groups (AI, no structure entry) + random-enchantment generator over the real card pool; `Lasts(7)` |
| 11 | Cessao Spiral | VR | W4 | alteration | "Cast on square. At start of turn, before movement, before combat, and when monster group enters square, monster group is removed from the game, regardless of Flight. (This does not set off any death-triggered effects.)" | C | F5 `ctx.removeFromGame`; triggers `startOfTurn, beforeMovement, beforeCombat, enter(monster)` with scope "monster group on host square" (B) |
| 12 | Circle of Wisdom | U | W3 | manifestation | "Cast on friendly group. Dispels all group and individual spells on group." | A | `Target.group.friendly, [OnCast(DispelAll())]` = Cleansing Light (Life) limited to friendly |
| 13 | Complacency | R | W5 M2 | conjuration | "Cast on group not in a structure. Group's movement orders are cancelled and it cannot be moved. Duration: Turn of casting +2." | C | F7 rooted flag honoured by movement, bots and `moveGroup`; F1 `.notInStructure`; `Lasts(3)` |
| 14 | Eagle Spirit | U | W2 M1 | alteration | "M:3 A:0 L:1 Cast on archer. At start of turn, archer changes randomly between Eagle and recruit form. When Eagle damages a monster, monster is killed. Cannot be targeted by Weapon Master. (Hit points, levels, and spells remain unchanged after each transformation.)" | B | F2 `Wereform('Eagle', {missile:3, armor:0, level:1}, [On(When.onDamage('monster'), Kill('victim'))])` (Dragon Slayer in form) |
| 15 | Fertility | U | W6 M3 | conjuration | "Cast on town or colony. Town creates one novice each turn. Duration: Turn of casting +6." | B | `Target.structure, [Lasts(7), On(When.startOfTurn, Novices(1))]`; F4: `Novices` must use the host structure inside a trigger (today only the cast target) |
| 16 | Fleetness | C | W2 M1 | manifestation | "Cast on recruit group. Group moves twice this turn in its direction of travel." | A | `Target.recruitGroup, [OnCast(MoveTwice())]` = Forced March (War) |
| 17 | Fortitude | U | W3 | alteration | "Cast on group. All members of group get +2 maximum and current hit points." | A | `Target.group, [Grant({maxHp:2}), OnCast(Heal(2,'targetEach'))]` (Grant's `heal` option only heals minion targets) |
| 18 | Giant | R | W4 M2 | summoning | "H:4 A:1 HP:16 L:2 Nomadic, Mountainwalk. Cast within a 3x3 diamond centered on a mountain. At start of combat, throws rock (5 hit points of damage) at one random opposing minion." | B | F1 `.near('mountain')`; `Nomadic(), Monster({...walks:['mountain']}), On(When.startOfCombat(), Damage(5,'randomOpponent'))`; F4 scope `randomOpponent` |
| 19 | Great Bear | R | W3 M3 | summoning | "H:3 A:1 HP:18 L:1 Nomadic. Cannot be targeted by Mind spells. In combat against Djinni, Great Bear does a "combined attack" (always targets the first opposing Djinn, and each attack hits all opposing Djinni simultaneously)." | C | `Immune(['mind'])` widened to group spells (B); F16 combined attack in `combat.ts` (no Djinni exist until Mind) |
| 20 | Healing Balm | C | W1 | alteration | "Cast on recruit. At start of turn, recruit heals 1 hit point." | A | `Target.recruit, [On(When.startOfTurn, Heal(1))]` |
| 21 | Immersion | U | W3 | alteration | "Cast on recruit. Recruit receives no combat damage from monsters (before checking armor)." | B | F4 `Warded({from:'monsters', beforeArmor:true})` |
| 22 | Jungle | U | W2 M1 | alteration | "Cast on square. Square becomes forest. (Minions in forest are concealed. Concealed minions cannot be targeted by enemy individual spells.) Every monster created in Jungle gets Jungle Strength (+3 maximum and current hit points)." | C | `OnCast(Terraform('forest')), Bound('forest'), On(When.monsterCreated, Give('jungle-strength','created'), Heal(3,'created'))`; F6 summon must fire a created event |
| 23 | Korgian Loincloth | C | W2 M1 | alteration | "Cast on recruit. Recruit gets +1 armor and +1 level." | A | `Target.recruit, [Grant({armor:1, level:1})]` |
| 24 | Lion Spirit | C | W2 M1 | alteration | "H:4 A:0 L:1 Cast on swordsman. At start of turn, swordsman changes randomly between Lion and recruit form. Changing to Lion form dispels all other individual spells. Lion receives no combat damage from monsters (before checking armor). Cannot be targeted by Weapon Master. (Hit points and levels remain unchanged after each transformation.)" | B | F2 `Wereform('Lion', {hand:4, armor:0, level:1}, [Warded monsters], {onEnter: DispelOthers})` |
| 25 | Lizard Spirit | C | W1 M1 | alteration | "H:2 A:1 L:2 Cast on swordsman. At start of turn, swordsman changes randomly between Lizard and recruit form. Lizard cannot be targeted by enemy individual spells. Cannot be targeted by Weapon Master. (...)" | B | F2 `Wereform('Lizard', {hand:2, armor:1, level:2}, [Concealed()])` |
| 26 | Lycanthropy | R | W5 M4 | alteration | "H:3 A:0 HP:12 L:1 Territorial. Cast on recruit group not in a structure. Recruit group is replaced by an equal number of Wolves. If dispelled, each Wolf is replaced by a new recruit of the original nation and class, with the same amount of damage." | C | F10 replace group + `onDispel` hook + per-wolf memory (tokens); F5 removeFromGame; F1 `.notInStructure` |
| 27 | Mask of Woad | C | W1 | alteration | "Cast on swordsman. Swordsman gets +1 hand damage. Cyclopes in swordsman's group get +1 hand damage against Djinni." | B | `Grant({hand:1})` + helper with F3 `Aura` carrying `Against` by **nation** (`djinn`) for Cyclopes |
| 28 | Minotaur | U | W5 M2 | summoning | "H:4 A:2 HP:12 L:2 Territorial. If killed by a recruit group, the first swordsman in group gets Minotaur's Axe (+1 hand damage)." | B | `Territorial(), Monster(...)` + `On(When.killed, Give('minotaurs-axe','killerFirstSwordsman', once))` (Wyrmling pattern); helper visible `Grant({hand:1})`, non-cumulative |
| 29 | Mountain Climb | U | W1 | alteration | "Cast on group. Group gains Mountainwalk. (...)" | A | `Target.group, [Walk('mountain')]` |
| 30 | Mountaindancer | C | W1 M1 | alteration | "Cast on swordsman. Swordsman gets +1 hand damage, and its group gains Mountainwalk. (...)" | B | `Grant({hand:1})` + helper F3 `Aura({walks:['mountain']})` (group mother) |
| 31 | Nereid's Curse | R | W5 | alteration | "Cast on group. Group gains Waterwalk. At start of turn, all members of group heal 1 hit point of damage if group is in water, or take 1 hit point of damage if group is not in water." | B | `Walk('water'), On(When.startOfTurn, IfIn('water', Heal(1,'hostGroup'), Damage(1,'hostGroup')))`; F4 conditional effect |
| 32 | Nomadic Tribe | U | W5 M3 | alteration | "Cast on recruit group. At start of every other turn, one level 1 Cyclops swordsman (if group size is three or less) or archer (if group size is four or more) is created in group. (If group is in a structure, all town spells affect the new recruits.)" | C | F4 trigger `every: 2` + effect `AddRecruit(by size)`; F6 `addMinion` in a structure must dispatch `minion:created` on it |
| 33 | Olotus | R | W4 M4 | hero | "H:3 A:1 HP:13 L:2 Cast on recruit group. Creates Olotus, a Cyclops Hero swordsman. When Olotus is cast, all Cyclopes on the board (including Olotus) get Rite of Growth (+1 hand damage and +4 maximum and current hit points). (...)" | B | `Hero(), Create({name:'Olotus', cls:'swordsman', nation:'cyclops', level:2}), OnCast(Give('rite-of-growth','allNation:cyclops'), Heal(4, same))`; F4 nation scope |
| 34 | Oro | R | W4 M4 | hero | "H:3 A:1 HP:13 L:2 (Oro), H:3 A:2 HP:11 L:2 (Vlad) Cast on friendly town or colony. Creates Oro, a Cyclops Hero swordsman with Rite of Growth, and Vlad Hrothgar, a Human Hero swordsman with Veteran. (...)" | A | copy of `war/vladHrothgar.ts` with house body, cost W4 M4, Oro first. Engine follow-up F19 (ruling R1) |
| 35 | Outcast | U | W2 M1 | manifestation | "Cast on friendly recruit in group of two or more. Recruit leaves its group, has all group spells dispelled, and moves twice this turn in its direction of travel. The remaining group's movement orders are cancelled." | C | F8 `ctx.leaveGroup`; F1 `.groupSize(2)`; per-group CancelMoves (B) |
| 36 | Priodont | U | W3 M3 | summoning | "H:2 A:4 HP:14 L:1 Territorial, Desertwalk." | A | `Target.square, [Territorial(), Monster({hand:2, armor:4, hp:14, level:1, walks:['desert']})]` |
| 37 | Rampage | C | W3 M1 | alteration | "Cast on monster. Monster gets +5 maximum and current hit points and +1 attack each round." | B | F1 `Target.monster`; `Grant({maxHp:5, attacks:1}, {heal:true})` |
| 38 | Regenerate | C | W3 | alteration | "Cast on minion. At start of turn, minion is fully healed." | B | F1 `Target.minion`; `On(When.startOfTurn, Heal('full'))` |
| 39 | Rite of Growth | C | W1 M1 | alteration | "Cast on minion. Minion gets +1 hand damage and +4 maximum and current hit points." | B | F1 `Target.minion`; `Grant({hand:1, maxHp:4}, {heal:true})`. Id `rite-of-growth` is already the War helper: turn that file into the real card (risk K3) |
| 40 | Ritual Cleansing | U | W2 | manifestation | "Cast on recruit. Dispels all individual spells on recruit." | B | F4 `DispelAll()` on a minion target (individual spells only) |
| 41 | Savannah | C | W5 | manifestation | "Cast on square. The 3x3 diamond centered on square becomes plains." | B | F4 `Terraform('plains', 'diamond3')` |
| 42 | Scrying Pool | U | W2 | alteration | "Cast on square. When any group occupies square, group's owner ignores concealment and forest when targeting individual spells." | C | F13 caster-level concealment piercing in `targetLegal` |
| 43 | Seedbearers | U | W6 | alteration | "Cast on group. When group moves, its new square becomes forest. (Moves effects happen before any enters square effects.)" | B | `On(When.moves, Terraform('forest','movedTo'))`; F4 terraform area from `ev.data.to` |
| 44 | Shaman's Walk | R | W2 M1 | alteration | "Cast on recruit. Recruit's group gains Flight. (...)" | B | F3 `Aura({walks:['flight']})` (group mother: the effect follows the recruit) |
| 45 | Shapeshifter | R | W3 M2 | alteration | "Cast on swordsman. At start of turn, swordsman changes randomly between recruit form and Bear, Lion, and Lizard Spirits. These spells have no casting cost for Shapeshifter's caster. Cannot be targeted by Weapon Master. Only one in play at a time." | C | F2 multi-form Wereform; F14 cost modifier; global uniqueness `canCast` (B) |
| 46 | Spirit Binding | VR | W2 M2 | alteration | "Cast on recruit. When a new monster group is created on the board, recruit copies the first monster's hand and missile damage, armor, maximum hit points, and level, and Spirit Binding is dispelled. (This does not change recruit's attack types.)" | C | F6 monster-created event (globe-visible); F17 `ctx.setBase` (permanent copy, then `Expend`) |
| 47 | Strength of Body | C | W1 | alteration | "Cast on recruit. Recruit gets +1 hand damage." | A | `Target.recruit, [Grant({hand:1})]` |
| 48 | Vision Quest | R | W3 M2 | manifestation | "Cast on friendly recruit. Recruit disappears for turn of casting +2. Recruit is fully healed, has all group and individual spells dispelled, and gets +2 levels and Rite of Growth (+1 hand damage and +4 HP). (New group reappears at start of turn if its square is unoccupied, or on the earliest turn thereafter.)" | C | F8 leaveGroup + F9 timed boardhop (globe controller, exit square, waits while occupied); +2 L as undispellable helper |
| 49 | Visionary | R | W3 | alteration | "Cast on friendly recruit. Recruit gets +1 level, and no longer deals hand or missile damage. Archers in recruit's group get +1 missile damage." | B | F3 `Aura({missile:1}, {to:'archers', self:{level:1, noDamage:true}})` |
| 50 | Water Walking | VR | W1 | alteration | "Cast on group. Group gains Waterwalk. (...)" | A | `Target.group, [Walk('water')]` |
| 51 | Worldwalking | R | W2 | conjuration | "Cast on group. Group gains Flight. (...) Recursive (Starts with 1 token. When cast, a copy of this spell is added to your hand that costs +1 mana and has +1 token.) Duration: Turn of casting +T, where T is the number of tokens." | C | `Walk('flight')` + F15 Recursive (backlog E10) with duration from tokens |
| 52 | Xia's Walk | C | W1 | conjuration | "Cast on minion. Minion is concealed. (...) Duration: Turn of casting +4." | B | F1 `Target.minion`; `Concealed(), Lasts(5)` (= Greymantle + duration) |

Near-duplicates of implemented cards: Fleetness = Forced March; Oro = Vlad Hrothgar; Balance of Mystery = Point of
Clarity (other mana); Circle of Wisdom ~ Cleansing Light; Mountain Climb / Water Walking ~ Caravan; Healing Balm ~
Healing Hands (self only); Brown Striders ~ Arboriads / Firewyrm; Xia's Walk ~ Greymantle; Minotaur ~ Wyrmling
(trophy on kill); Immersion ~ Warded; Eagle form ~ Dragon Slayer; Rite of Growth already exists as a helper.

## 4. Features needed (and what each unlocks)

| Id | Layer | Feature | Cards unlocked (Body) |
|---|---|---|---|
| F1 | lang | Target builder: `Target.minion`, `Target.monster`, `.nation(n)`, `.notInStructure`, `.near(terrain)` (3x3 Chebyshev box), `.groupSize(min)` | Rite of Growth, Regenerate, Xia's Walk, Rampage, Big Rock, Blue Auk, Giant, Complacency*, Lycanthropy*, Outcast* (10; * also needs C) |
| F2 | lang | `Wereform(name, formStats, formKeywords, opts)`: form token, 50/50 flip at start of turn, stats as delta vs class base (`recruitBase`), form-only sub-keywords, `onEnter` effects; `ImmuneTo(cardIds)` restriction | Bear, Eagle, Lion, Lizard Spirit; Shapeshifter (multi-form) |
| F3 | lang | Aura extensions: `walks`, `noDamage`/Pacified for others or self, and an aura `Against` by nation | Shaman's Walk, Mountaindancer, Visionary, Mask of Woad, Brother Wolf |
| F4 | lang | Small effects/scopes/triggers: DispelAll on minion and structure; Terraform `diamond3` and `movedTo`; `Novices` on host structure; scopes `randomOpponent`, `allNation:<n>`, `killerFirstSwordsman`, `hostSquareGroup`; `IfIn(terrain, a, b)`; `Warded` from monsters before armor; `When.killed`; `every: N` turns; `AddRecruit` effect; per-group CancelMoves; host guard so a minion-hosted card's triggers ignore its globe controller copy; `H:*` in stat lines | Ritual Cleansing, Savannah, Seedbearers, Fertility, Giant, Olotus, Minotaur, Nereid's Curse, Immersion, Lion (form), Brown Striders, Carnivorous Plant, Cessao Spiral*, Nomadic Tribe*, Outcast* |
| F5 | engine | `ctx.removeFromGame(minionId)` (death category `removed` already exists in `killMinion`, just not exposed) | Cessao Spiral, Lycanthropy |
| F6 | engine | Creation events: `summon` dispatches a created event on the square (bubbles to globe) with the new group/minion; `addMinion` dispatches `minion:created` on a structure when the group stands in one | Jungle, Spirit Binding, Nomadic Tribe |
| F7 | engine | "Cannot be moved" (rooted): a stat/flag that movement checks after bots, and that `moveGroup`, moves-twice and forced moves respect | Complacency (also lets Immobile stop relying on its bot) |
| F8 | engine | `ctx.leaveGroup(minionId)`: new group, drop group spells (even non-visible, rules: leavesgroup), unstack to an adjacent square | Outcast, Vision Quest |
| F9 | engine | Timed boardhop: off-board container (globe controller) with exit square, countdown, return when exit square unoccupied, "removed if dispelled" | Vision Quest |
| F10 | engine | Replace group (remove + summon at same square, squanders later spells on the old id) + `onDispel` hook on CardDef | Lycanthropy |
| F11 | engine | Damage redirection in `takeDamage` (`data.redirectTo`; the new victim takes it ignoring armor, attacker still blamed) | Brother Wolf |
| F12 | engine | Structure destroy, structure relocate (novices, mana type, spells go with it, new square dispelled to plains, old square plains) | Ancestral Home |
| F13 | engine | Caster-level concealment piercing hook consulted by `targetLegal` | Scrying Pool |
| F14 | engine | Cost modifiers while a spell is active (per caster, per card) | Shapeshifter |
| F15 | engine | Recursive: hand copy with +1 token and +1 cost; duration from tokens (backlog E10) | Worldwalking |
| F16 | engine | Combined attack (one attack hits every opposing minion of a nation) | Great Bear |
| F17 | engine | `ctx.setBase(minionId, partial)`: permanent base-stat change | Spirit Binding |
| F18 | engine | Neutral recruit groups (owner neutral, kind recruit, bot, never enter structures) + random enchantment generator | Cessao Rift |
| F19 | engine | Hero once-per-game keyed by hero identity, not card id | Oro (vs Vlad Hrothgar) |

## 5. Shared mechanics (other houses will need these)

| Feature | Other cards named in the rules pages |
|---|---|
| F5 remove from game | Ascension, Dryad's Favors, Shifting Sands, Void (already engine-internal), boardhop dispelled with group inside |
| F6 creation events | Awaiting (monster groups created), Jade Gargoyle, Settlement/Civilize |
| F7 rooted | Binding Cube, Fear, Lienna's Steed, Possession, Sandstorm, Sentinel |
| F8 leave group | Ch'tai Exchange (Mind), Soul Jar |
| F9 boardhop | Encampment, Faerie Circle, Lost Mine, Will o' the Wisp, Seelie Court (structure), Awaiting |
| F10 replace group / onDispel | Devolution, Instability, Volgaris, Civilize, Settlement, Zana's Champion; Encampment destroys its colony on expiry |
| F11 damage redirect | Whipping Boy (Despair) — Brother Wolf's text names it |
| F12 structure destroy/move | Entropia, Gogar's Wrath, Maelstrom, Earthquake, Justicars, The Unmagicking, Encampment, Defensive Pact (move) |
| F13 concealment piercing | Insight, Biting Wind |
| F14 cost modifiers | Dissolution, Syzygy, Ogi's Armor, Recursive (+1) |
| F15 Recursive | Greater Clarity (Life), Growing Strife (War) |
| F2 wereforms | Weapon Master (War, refuses spirits), Werebear (rules mention, likely Nature) |
| F3 group mothers | Necromancer, Reaper, Whipping Boy, Empathy, Leadership, Obeisance, Beobogh's Helm, Rangefinder, Bellwether, Pixie Dust, Chaos Fog |
| F18 neutral recruits | Narh'u'ha (neutral Djinn archer) |
| `Against` by nation (Djinni) | any "against Elves/Djinni/..." card; today `Against` compares house only |

## 6. Ambiguities and proposed rulings

| # | Card | Question | Ruling |
|---|---|---|---|
| R1 | Oro / Vlad Hrothgar | Two different cards create the same two heroes; once-per-game is keyed by card id | Key it by hero name: casting either card marks Oro and Vlad as cast; the other card then squanders (F19) |
| R2 | Spirits | Starting form when cast | Enters spirit form on cast; each start of turn 50/50 (Shapeshifter: uniform over recruit + 3 spirits) |
| R3 | Spirits | "Levels remain unchanged" vs printed L:0/L:2 | Form stats are a delta from the class base (swordsman H2 A1 L1, archer M2 A0 L1); experience and spell deltas still add on top. Bear = +1 H, +1 attack, -1 A, -1 L |
| R4 | Burst of World | Two copies on the globe in one turn (exclusive visible conjuration) | Non-visible (undispellable, cumulative) one-turn delay: `Lasts(2)` mana next turn only |
| R5 | Lion Spirit / Shapeshifter | Does "dispels all other individual spells" remove Shapeshifter itself? | No; only spells other than the form controller; non-visible spells are not dispellable |
| R6 | Lizard form | "Cannot be targeted by enemy individual spells" vs concealment | Implement as Concealed while in Lizard form (so Scrying Pool / Biting Wind pierce it) |
| R7 | Brother Wolf | What is the Wolf? | A recruit (it joins a recruit group), hand attacker, no nation, HP 10, not a swordsman for targeting (cls swordsman internally, flagged so class-targeted spells refuse it) |
| R8 | Brother Wolf | Wolf dies outside combat or in the last round | Withdraw flag applies only to the current combat; cleared at combat end |
| R9 | Lycanthropy | Who owns the Wolves? | The caster, computer-controlled, Territorial with home = the square. On dispel, recruits return to the original owner with the same damage |
| R10 | Olotus | "Cast on recruit group" has no "friendly" | As printed: any recruit group; Olotus belongs to the group's owner; Rite of Growth goes to every Cyclops on the board, both sides |
| R11 | Olotus | Olotus gets Rite twice (stat line 13 HP already includes it) | Created bare, then the board-wide Give gives him his one Rite (print shows final stats) |
| R12 | Nomadic Tribe | When is the first recruit | Start of turn t+2, then every 2 turns; nothing if the group is full (8) |
| R13 | Fertility | Novice on the casting turn | No: start of each turn while active (6 novices max), capped by the 8-novice limit |
| R14 | Complacency | Does "cannot be moved" stop monsters' AI and forced moves (ice, attract, Fleetness)? | Yes, all movement including moves-twice; "not in a structure" is casting-time only (rules: Elements_spells) |
| R15 | Cessao Spiral | Friendly monsters? Recruit groups? | All monster groups (any owner); recruit groups unaffected; no death triggers |
| R16 | Jungle | What counts as "created in Jungle" | Monster groups summoned onto that square while Jungle (Bound to forest) is active; combat-hoppers appearing there do not count |
| R17 | Spirit Binding | Current HP after copying max HP | Keep damage taken (hp = newMax - damage, min 1); ignores combat-hoppers appearing; Lycanthropy wolves count as a new group |
| R18 | Vision Quest | When do heal/dispel/+2 L/Rite happen | Dispel and full heal on cast; +2 L (undispellable helper) and Rite of Growth on cast too (they are frozen off the board anyway); returns at start of turn t+3 or first later turn its exit square is empty |
| R19 | Outcast | Where does the new group go; no move order | Unstack to a random adjacent legal empty square, preferring the travel direction; it repeats the old group's order twice; no order = no move; no legal square = squanders |
| R20 | Ancestral Home | Where does the town move; with what | Random adjacent empty, unoccupied, non-Sanctum square; novices, mana type, owner and structure spells go with it; the new square's square spells are dispelled and both squares become plains; no square = no move |
| R21 | Ancestral Home | Cast on a colony | Colony destroyed, the spell has no host and ends (it is a colony killer, as the structures page lists) |
| R22 | Giant | Rock damage type | Spell damage, ignores armor, no blame (no experience); every combat, any opponent |
| R23 | Great Bear | "Mind spells" | Individual and group spells of house Mind |
| R24 | Mask of Woad | "against Djinni" | Victim nation `djinn` (not house Mind) |
| R25 | Carnivorous Plant | Owner of a monster | The summoning player; neutral never has Initiative |
| R26 | Cessao Rift | "random nation, injury, enchantments" | 1 to 4 recruits of one random nation, random classes, each 0..maxHp-1 damage, 0 to 2 random real recruit alterations each (scope cut: defer the card) |
| R27 | Blue Auk / Giant | "3x3 diamond" | The 3x3 box (9 squares) around the target square, as the mothers page defines a 3x3 diamond; the target square itself must still be empty |
| R28 | Shapeshifter | "Only one in play at a time" | Global, both players; "no casting cost" = the caster's Bear/Lion/Lizard Spirit cards cost 0 while Shapeshifter is active |

## 7. Proposed task order (cheapest first)

| Step | Work | Cards done after it (cumulative) |
|---|---|---|
| 1 | Write the 12 A cards (Oro copies Vlad) | 12 |
| 2 | F1 target builder additions; convert `rite-of-growth` helper into the real card | +5 (Rite, Regenerate, Xia's Walk, Rampage, Big Rock) = 17 |
| 3 | F4 bundle (effects, scopes, triggers, host guard, `H:*`) | +12 (Blue Auk, Giant, Ritual Cleansing, Savannah, Seedbearers, Fertility, Olotus, Minotaur, Nereid's Curse, Immersion, Brown Striders, Carnivorous Plant) = 29 |
| 4 | F3 aura extensions | +4 (Shaman's Walk, Mountaindancer, Visionary, Mask of Woad) = 33 |
| 5 | F2 Wereform keyword | +4 (Bear, Eagle, Lion, Lizard) = 37 |
| 6 | F5 removeFromGame + F6 creation events | +3 (Cessao Spiral, Jungle, Nomadic Tribe) = 40; F17 setBase adds Spirit Binding = 41 |
| 7 | F7 rooted | Complacency = 42 |
| 8 | F8 leaveGroup, then F9 boardhop | Outcast, Vision Quest = 44 |
| 9 | F11 damage redirect | Brother Wolf = 45 |
| 10 | F10 replace group + onDispel | Lycanthropy = 46 |
| 11 | F13 concealment piercing | Scrying Pool = 47 |
| 12 | F15 Recursive (shared E10) then F14 cost modifiers | Worldwalking, Shapeshifter = 49 |
| 13 | F12 structure destroy/move | Ancestral Home = 50 |
| 14 | F16 combined attack (after Mind's Djinni exist) | Great Bear = 51 |
| 15 | F18 neutral recruit groups + random enchantments | Cessao Rift = 52 |

## 8. Nation and stats notes

- Cyclops recruits have 9 HP and nothing else; game-made Body recruits already get it via `nationOfHouse('body')`.
- Printed hero lines include the helper: Olotus and Oro H:3 A:1 HP:13 L:2 = swordsman H2 A1, Cyclops 9 HP, level 2, plus
  Rite of Growth (+1 H, +4 HP). Nomadic Tribe makes level 1 Cyclops (9 HP).
- Cyclops-specific cards: Big Rock (target), Olotus (scope), Mask of Woad (aura subset), Nomadic Tribe (created nation).
  `Target.nation` is casting-time only (rules: "on nation" may change later).
- Brother Wolf's Wolf (HP 10) and Lycanthropy's Wolves (HP 12) are not Cyclopes; give them no nation.
- Monster cards (7) have no "Cast on" clause: default `Target.square` (Blue Auk, Giant add the near-terrain rule).

## 9. Risks

| # | Risk |
|---|---|
| K1 | Rules pages beyond `research/rules/` could not be fetched: `rules.php` now serves the NIOGA usage agreement (not accepted) and every `rules/<Section>/<name>.php` URL tried returns 404, including ones already saved. No `body_*` rules files were added; rulings above rely on card text and the saved pages. |
| K2 | Spell type is not in the scrape; types in section 3 are inferred (Elements_spells: persistent = alteration, duration = conjuration, instant = manifestation, creates monster = summoning). |
| K3 | `rite-of-growth` is a War-folder helper used by Vlad Hrothgar; the real Body card has the same id and needs `Target.minion` + heal. Converting it touches War files and `faces.test.ts`. |
| K4 | Ambush cards carry the card's spell on the globe as well as on minions; an `On(When.eachRound(...))` on such a card would fire for every combat on the board (triggers treat a globe host as "every group"). Arboriads/Firewyrm avoid it today only because they have no such trigger. |
| K5 | Grant's `heal: true` heals only minion targets; group-target cards must add `OnCast(Heal(n,'targetEach'))` (Fortitude). |
| K6 | Wereform display: `Minion.name`/class do not change; UI needs the form from the spell token. |
| K7 | Great Bear, Mask of Woad depend on Djinni (Mind house nation); untestable until a Djinn recruit can be made (`recruitSpec('swordsman','djinn')` works, so tests can still fake one). |
| K8 | Cessao Rift's random enchantment pool depends on all houses being implemented; defer. |

## 10. Scrape check

52/52 cards have name, slug, cost, rarity, text. `castOn` is null on 6 cards: four monsters with no "Cast on" clause
(Carnivorous Plant, Great Bear, Minotaur, Priodont: expected), and **Blue Auk and Giant**, whose clause is "Cast within
a 3x3 diamond centered on a water square / a mountain" (the scraper's `Cast on ([^.]+)\.` regex misses it). Other
format quirks for the card writer: Oro has two stat lines; Brown Striders "HP:3(x3)" means three copies; Carnivorous
Plant "H:*". No spell-type field (all houses).
