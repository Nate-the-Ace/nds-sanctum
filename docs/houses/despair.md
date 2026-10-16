# House of Despair: card research

House id 9 on playsanctum.net. Mana: **Mystery** (primary), **Strife** (secondary). Nation: **Shadow** (7 HP, Mountainwalk,
no combat bonus; `NATIONS.shadow` in `packages/engine/src/nations.ts` already matches `Axioms_houses.txt`).
Source data: `packages/cards/data/houses/despair.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs despair --per-house`).
Vocabulary checked against `packages/cards/src/lang/**` and `packages/engine/src/{ctx,cards,events,stats,types,combat,movement,turn,spells}.ts`
on branch `engine-core`.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 51 (50 distinct; Bleak Isle II is a reprint of Bleak Isle with new flavour) |
| Rarity | Common 18, Uncommon 17, Rare 11, Very Rare 5 |
| Expansions | Classic 18, Revolutions 10, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 3 |
| Total cost (M+S) | 1:3, 2:7, 3:4, 4:10, 5:9, 6:5, 7:6, 8:3, 9:4; mean 4.8 |
| Mystery-only cards | Augur of Strife, Backlash, Blindness, Freeze, Pantogar's Curse, Revenants, Spectre's Curse, Vicious Strength, Whipping Boy |
| Target mix | globe 13, creatures (no "Cast on", = square) 8, minion 6, recruit 6, group 5, structure 4, recruit group 2, square 2, monster 2, water 1, misc 3 |
| Classification | **A 5, B 28, C 15, D 3** |

Scrape check: all 51 have name, slug, cost, rarity, text. `castOn` is null for the 8 creature cards whose text has no
"Cast on" (Banshee, Frost Dragon, Gorgon, Makva, Nightmare, Phantom, Revenants, Trolls) — expected, they summon onto a
square like War's Hellion. Text artifact: Disorient reads `A player- controlled` (line-break hyphen
in the source page, same as War's Amok). Flavour is null on most Allies & Traitors / Revolutions cards (source has none).
The card page states no spell type; types below are inferred (section 7, ruling R1).

Rules pages: the saved `research/rules/*.txt` covered everything except Nihil's Curse (see D). Fetching more failed:
`/nioga/rules.php` now serves a usage-agreement gate (not accepted), every `/nioga/rules/<Section>/<name>.php` returns
404 (even pages we already have), and archive.org has no snapshots. No `despair_*.txt` rule files were added.

## 2. Theme and mechanics

| Theme | Cards | Notes |
|---|---|---|
| Debuffs on enemy minions | Pantogar's Curse, Stupefy, Spectre's Curse, Albatross, Harrowing Cry, Lethargy, Blindness, Changelings, Frostbite, Atrophy, Backlash | stat minus via `Grant`, damage-over-time via `On(startOfTurn, Damage)` |
| Shadow tribal | Despond, Comrades in Suffering, Nightmare, Penumbra, Shadow Friend, Nihil's Minion, Nihil, Odar | "Shadows" = minions whose (current) nation is `shadow`; needs nation tracking, and for 3 cards nation *change* |
| Movement denial / forcing | Fear, Disorient, Panic, Forsaken, Paranoia, Siren Song, Freeze, Ice Age, Immateriality | cancel / randomise orders, forbid entering structures or joining, ice sliding, attracting squares |
| Economy denial | Corrosion, Dissolution, Insurrection, Passing in the Night, Pantogar's Failure | structure mana off, cost +1/+1, novices killed, no casts/discards |
| Removal | Nihil's Touch, Banshee, Gorgon, Odar, Backlash | random kills, petrification counters |
| Monsters | Banshee, Frost Dragon, Gorgon, Makva, Nightmare, Phantom, Revenants, Trolls | 3 have start-of-combat casts; 2 are 3-copy groups |
| Terrain | Blight, Limbo, Bleak Isle (II), Freeze, Ice Age | degrade chain, barren land, water ring, ice |

Nation/flavour effects on stats: Despair recruits are Shadows (7 HP, Mountainwalk). Heroes Nihil and Odar are Shadow
swordsmen `H:2 A:1 HP:7 L:2` = `recruitSpec('swordsman','shadow')` at level 2. Bleak Isle recruits get Waterwalk on top
(Mountain + Water walkers). Despair *monsters* carry `house: 'despair'` but no nation, so they are hit by Prismatic
Serpent / Redeemer's Sword (`Against(['death','despair'])`, already shipped) but are **not** Shadows for Despond/Comrades.
Phantom targets Visions (Hope nation), Despond punishes Visions double: the Despair-vs-Hope rivalry is by nation.

## 3. Classification of every card

Legend: **A** expressible now; **B** needs a small lang keyword/effect/scope/target; **C** needs an engine feature;
**D** special/hard. Feature ids (L*, E*) refer to section 4. Type = proposed spell type.

| # | Card | Cost | Type | Text (verbatim) | Cls | Composition / what is missing |
|---|---|---|---|---|---|---|
| 1 | Albatross | 3M 2S | alteration | Cast on minion. At start of turn, every other member of minion's group takes 1 hit point of damage. | B | `Target.minion` (L1), `On(When.startOfTurn, Damage(1,'hostGroupOthers'))` new scope (L7) |
| 2 | Atrophy | 3M 2S | alteration | Cast on group. At start of turn, each member of group has its maximum hit points lowered to its current hit points. | B | `Target.group`, Script: per-minion token `d:<id>` += (max−hp) on `turn:start`, `stats` maxHp −token (L13) |
| 3 | Augur of Strife | 4M | alteration | Cast on globe. Caster gets +1 Strife each turn. May be cast more than once. | A | `Target.globe, [Stackable(), On(When.manaPhase, AddMana('strife',1))]` = Point of Clarity |
| 4 | Backlash | 1M | manifestation | Cast on recruit. Recruit takes 1 hit point of damage for each group or individual alteration on recruit. | B | Script: count visible spells of type `alteration` on recruit + its group via `defOf(cardId).type` (L14), `c.damage` |
| 5 | Banshee | 5M 2S | summoning | H:4 A:0 HP:10 L:1 Territorial. At start of combat, kills one random opposing minion. | B | `Territorial(), Monster({...}), On(startOfCombat(), Kill('randomOpponent'))` new scope (L2) |
| 6 | Bleak Isle | 5M 4S | alteration | Cast on non-neutral town or colony. The four squares adjacent to town become water. On turn of casting, if any group occupies town, group gains Waterwalk. Every recruit created in town gets -1 level and Waterwalk (which cannot be dispelled). | B | `Target.structure.nonNeutral` (L1), `OnCast(Terraform('water','adjacent'), GiveGroup('bleak-isle-waterwalk','hostOccupantsGroup'))` (L3), `On(When.created, Give('bleak-isle-mark','created'))`; helper `bleak-isle-mark` = `[Undispellable(), Grant({level:-1}), Walk('water')]` |
| 7 | Bleak Isle II | 5M 4S | alteration | (identical to Bleak Isle) | B | same definition, own id |
| 8 | Blight | 1M 1S | manifestation | Cast on square. Forest becomes plains. Plains become barren land. Barren land becomes desert. Desert becomes lava. Mountain becomes volcano. | B | `Target.square`, `OnCast(Terraform` with a from→to map `)` (L8 `Degrade`) |
| 9 | Blindness | 2M | alteration | Cast on monster. Monster no longer deals hand or missile damage. | B | `Target.monster` (L1) + `NoDamage()` keyword (Pacified minus the attack removal, L6) |
| 10 | Changelings | 5M 2S | alteration | Cast on town or colony. Every recruit created in town gets Changeling (-1 hand and missile damage and -3 maximum hit points). | A | `Target.structure, On(When.created, Give('changeling','created'))`; visible helper `changeling` = `Grant({hand:-1, missile:-1, maxHp:-3})` (Auberol's Grace pattern) |
| 11 | Comrades in Suffering | 3M 3S | conjuration | Cast on globe. Shadows receive no combat damage from Shadows (before checking armor). Duration: Turn of casting +3. | B | `Lasts(4)`, `DamageFrom({from:'shadow', to:'shadow', set:0})` on `attack:beforeArmor` (L4) |
| 12 | Corrosion | 2M 2S | conjuration | Cast on globe. All towns and colonies no longer generate mana. (Mana-generating spells are not affected.) Duration: Turn of casting +3. | C | E5 structure-mana hook; then `Lasts(4)` + new `NoStructureMana()` keyword |
| 13 | Cruel Whim | 1M 1S | alteration | Cast on recruit. A swordsman becomes an archer, while an archer becomes a swordsman. Has no effect on Weapon Master or Rakshasa. | C | E10 computed class (`Stats.cls` override); persistent class requirement per `Elements_spells` ("Dispels on any class-change: Cruel Whim") |
| 14 | Despond | 3M 2S | alteration | Cast on group. All members of group receive +1 damage from Shadows (before checking armor). Visions in group receive +2 damage instead. | B | `DamageFrom({from:'shadow', add:1, addVs:{vision:2}})` (L4); works on 0-damage attackers by rule (Pipelines_damage D1) |
| 15 | Disorient | 2M 2S | manifestation | Cast on group. A player- controlled group moves in a random legal direction different from its movement order, or stands still. Has no effect on a computer-controlled group. | B | `Target.group, OnCast(RandomMove({excludeOrder:true, allowStay:true}))` (L9) |
| 16 | Dissolution | 3M 2S | conjuration | Cast on globe. Next turn, opponent has all spell casting costs adjusted by +1 primary and +1 secondary mana per spell. | C | E6 cost modifier hook; `Lasts(2)` + `CostTax({who:'opponent', fromTurn:+1, primary:1, secondary:1})` |
| 17 | Fear | 3M 2S | conjuration | Cast on group not in a structure. Group's movement orders are cancelled and it cannot be moved. Duration: Turn of casting +1. | B | `Target.group.notInStructure` (L1), `Lasts(2)`, `OnCast(CancelMove('target'))`, `On(beforeMovement, CancelMove('host'))` (L10); full "cannot be moved" waits for E2 `noMove` |
| 18 | Forsaken | 3M 1S | conjuration | Cast on recruit. Recruit (and its group) cannot enter structures. Duration: Turn of casting +2. | C | E2 `noStructures` flag; then `Lasts(3), Restrict('structures')` |
| 19 | Freeze | 2M | manifestation | Cast on water. Square becomes ice. (Groups entering ice slide past it ...) | C | `Target.square.on('water'), OnCast(Terraform('ice'))` works today, but ice does nothing until E3 sliding |
| 20 | Frost Dragon | 4M 4S | summoning | H:3 A:1 HP:13 L:2 Territorial, Flight. At start of combat, casts Frostbite (...) on opposing group. When Frost Dragon damages an opponent, opponent does not attack in the next combat round. | B | `Monster` + `On(startOfCombat(), GiveGroup('frostbite','opponent'))` (L3) + `On(When.onDamage(), Give('frozen-round','victim'))`; helper `frozen-round`: `stats {handAttacks:-9, missileAttacks:-9}`, dispels itself on its group's 2nd `round:start` and on `combat:end` (L13) |
| 21 | Frostbite | 3M 2S | conjuration | Cast on group. Every member of group gets -3 maximum hit points. At start of turn, every member of group gets +1 maximum hit point. Duration: Turn of casting +3. | B | `Lasts(4)`, Script: token `t` += 1 on `turn:start`, `stats maxHp = -3 + t` (L13) |
| 22 | Gorgon | 3M 1S | summoning | H:2 A:0 HP:7 L:2 Territorial. Gorgon's hits give Gorgon's Gaze (-1 damage and +1 armor, cumulative. A minion who gets three or more Gorgon's Gaze is killed). If killed by a recruit, recruit gets Gorgon's Head (owner's hits give Gorgon's Gaze; transfers to a recruit who kills its owner). | B | `On(When.onHit, Give('gorgons-gaze','victim'))` + Script kill at 3 Gazes (count helper spells) + Wyrmling-style `minion:killed` trophy `gorgons-head` that re-creates itself on its killer (L13) |
| 23 | Harrowing Cry | 3M 2S | manifestation | Cast on group. Every member of group gets -1 level. (Any minions who join this group later are not affected.) | A | `Target.group, OnCast(Give('harrowing-cry-mark','targetEach'))`, helper `Grant({level:-1})` (Fountain of Youth pattern) |
| 24 | Ice Age | 3M 3S | alteration | Cast on globe. Before movement, all water squares become ice. | C | needs E3; lang part `On(beforeMovement, Terraform('ice','everywhere','water'))` (L8) |
| 25 | Immateriality | 2M 2S | conjuration | Cast on globe. All groups gain Flight. ... Duration: Turn of casting +1. | A | `Target.globe, [Lasts(2), Walk('flight')]` (globe stats reach every minion) |
| 26 | Insurrection | 6M 3S | alteration | Cast on town or colony. All novices in town are eliminated. Town no longer creates novices. Dispelled when entered. | C | E7 (`ctx.setNovices`, production block); `On(When.enter(), Expend())` already exists |
| 27 | Lethargy | 3M 2S | alteration | Cast on globe. All recruits get -1 level. | B | `Grant({level:-1}, {to:'recruits'})` new `GrantTo` (L6) |
| 28 | Limbo | 2M 1S | alteration | Cast on square. Square becomes barren land. While in square, minions in square get -1 hand damage. At start of turn, if any recruit occupies square, caster gets +1 Strife. | B | `OnCast(Terraform('barren'))`, `Grant({hand:-1})` (square stats), `On(When.manaPhase, If('recruitHere'), AddMana('strife',1))` conditional trigger (L12) |
| 29 | Makva | 4M 2S | summoning | H:3 A:1 HP:10 L:3 Nomadic, Flight. | A | `Nomadic(), Monster({hand:3, armor:1, hp:10, level:3, walks:['flight']})` |
| 30 | Nightmare | 4M 3S | summoning | H:3 A:1 HP:10 L:2 Nomadic. At start of combat against recruits, Nightmare casts Despond (...) on opposing group. | B | `When.startOfCombat('recruit')` (L12) + `GiveGroup('despond','opponent', once)` (L3) + Despond (L4) |
| 31 | Nihil | 4M 4S | hero | H:2 A:1 HP:7 L:2 Cast on globe. Created in a random square. Nihil is a Shadow Hero swordsman. Cannot join groups, add recruits, or enter structures. When hit by a minion, minion gets Nihil's Curse. (Each Hero may be cast only once per game.) | D | random-square player summon (Script over `ctx.summon`, E13), E2 restrictions, and **Nihil's Curse text is unknown** (not on the card page or in saved rules) |
| 32 | Nihil's Minion | 2M 1S | conjuration | Cast on recruit. Recruit changes into a Shadow, no longer deals hand or missile damage, and is set to 0 armor and cannot gain armor. Duration: Turn of casting +1. | C | E1 temporary nation override + E14 armor lock; then `Lasts(2), NoDamage()` |
| 33 | Nihil's Touch | 2M 2S | manifestation | Cast on globe. A random enemy minion dies. | B | `OnCast(Kill('randomEnemy'))` (L2) |
| 34 | Oblivion | 3M 3S | conjuration | Cast on recruit group. Each recruit in group no longer attacks. When each recruit is damaged by an attacker, that recruit resumes attacking normally at the start of the next round. Dispelled after next combat. | B | `Fleeting()` + Script: `stats` attacks −9 unless token `w:<id>`; set token on `armor:after` with attacker and damage>0 (counts already fixed this round, so it resumes next round) (L13) |
| 35 | Odar | 4M 4S | hero | H:2 A:1 HP:7 L:2 Cast on recruit in a non-friendly group of 3 or more. Recruit is replaced by Odar, a Shadow Hero swordsman. When cast, Odar kills a random other member of his group. Every time Odar attacks, he chooses a random minion on either side. When Odar is alone in his group, his group joins caster's side. (Each Hero may be cast only once per game.) | D | E12: replace-in-place, friendly-fire victim choice in `combat.ts`, side flip when alone; target `.nonFriendly.groupSize(3)` (L1) |
| 36 | Panic | 6M 3S | manifestation | Cast on globe. Every player-controlled group in every structure moves in a random legal direction. | B | `OnCast(RandomMove({groups:'inStructures'}))` (L9) |
| 37 | Pantogar's Curse | 1M | alteration | Cast on minion. Minion gets -1 hand damage. May be cast more than once on the same minion. | B | `Target.minion` (L1) + `[Stackable(), Grant({hand:-1})]` |
| 38 | Pantogar's Failure | 5M 2S | manifestation | Cast on globe. Dispels all spells on globe, and on all structures. | B | `DispelAll('globeAndStructures')` (L11) |
| 39 | Paranoia | 3M 3S | conjuration | Cast on globe. Recruit groups cannot join other groups or add any new recruits. Duration: Turn of casting +2. | C | E2 `noJoin`/`noAdd`; then `Lasts(3)` + globe `Restrict('join','add')` |
| 40 | Passing in the Night | 2M 1S | conjuration | Cast on globe. On turn of casting +1, neither player may cast any spell, nor discard, and no group enters combat. (This prevents all start-of-combat effects as well.) Duration: Turn of casting +1. | C | E8 discard block; rest is lang: `Lasts(2)`, `Forbid([...all])` + `Truce()` gated to `turn > castTurn` (L12 `FromNextTurn`) |
| 41 | Penumbra | 2M 2S | manifestation | Cast on recruit group. Every member of group changes into a Shadow. | C | E1 permanent nation change (`ctx.setNation`); drowning of Djinni/Visions over water follows (Axioms_houses) |
| 42 | Phantom | 4M 3S | summoning | M:2 A:2 HP:14 L:2 Nomadic, Mountainwalk. Gets +3 missile damage against Visions. Phantom's attack deals magical damage. (Magical damage ignores armor, immunities, and spells.) | C | E9 magical attacks; `Against` by nation (L4b: `Against({nations:['vision']}, {missile:3})`) |
| 43 | Revenants | 4M | summoning | H:2 A:0 HP:4(x3) L:1 Nomadic. Creates three Revenants. | B | `Monster(def, {count:3})` (L5) |
| 44 | Shadow Friend | 3M 2S | manifestation | Cast on recruit. Recruit has all individual spells dispelled, and changes into a Shadow. Recruit's group has all group spells dispelled. | C | `DispelAll('recruitAndItsGroupSpells')` (L11) + E1 `setNation` |
| 45 | Shadowmasque | 2M 2S | alteration | Cast on recruit. When recruit is hit by a swordsman, swordsman gets Shadow's Chill (conjuration, 1 turn, -N hand damage, where N is the number of turns remaining. Duration increases by +1 turn every round for the initial fight only, to a maximum of swordsman's hand damage). | D | expressible as Script (helper with token `n`, `-n H`, self-decrement on `turn:start`, +1 on `round:start` until its first `combat:end`), but the wording has 4 open questions (R31) |
| 46 | Siren Song | 2M 1S | alteration | Cast on monster. Plains, forest, desert, and barren land in the four squares adjacent to monster attract enemy-controlled groups. (Groups adjacent to attracting squares before movement must move toward one of them.) | C | E4 attracting squares (mother spell that follows the monster, `Concepts_mothers`) |
| 47 | Spectre's Curse | 2M | alteration | Cast on minion. At start of turn, minion takes 1 hit point of damage. | B | `Target.minion` (L1) + `On(When.startOfTurn, Damage(1))` |
| 48 | Stupefy | 1M 1S | alteration | Cast on minion. Minion gets -1 level. | B | `Target.minion` (L1) + `Grant({level:-1})` |
| 49 | Trolls | 5M 2S | summoning | H:3 A:0 HP:10(x3) L:1 Territorial. Creates three Trolls. | B | `Monster(def, {count:3})` (L5) |
| 50 | Vicious Strength | 1M | alteration | Cast on minion. Minion gets +1 hand damage. May be cast more than once on the same minion. | B | `Target.minion` (L1) + `[Stackable(), Grant({hand:1})]` |
| 51 | Whipping Boy | 2M | alteration | Cast on minion. Minion gets +4 maximum and current hit points. When any other member of minion's group is hit (before checking armor), minion receives the damage instead, ignoring armor. Only one of Whipping Boy or Brother Wolf in a group. | C | E11 group-mother event visibility (`Concepts_mothers` lists Whipping Boy as a group mother); `Grant({maxHp:4},{heal:true})` exists |

Near-duplicates of implemented War/Life cards (reuse the same keywords/tests): Augur of Strife = Point of Clarity;
Immateriality = Flight on the globe; Changelings = Auberol's Grace/Clandestine pattern; Harrowing Cry = Fountain of
Youth's Youth helper; Fear = Standoff on one group; Disorient = Amok's RandomMove; Passing in the Night = Armistice +
Court Politics' Forbid; Blindness = half of Pacifism; Banshee/Frost Dragon/Nightmare = Brimstone Dragon's
start-of-combat cast; Gorgon = Thermites (hits give cumulative helper) + Wyrmling (trophy on `minion:killed`);
Spectre's Curse = inverse Healing Hands; Bleak Isle = Oasis (adjacent terrain + structure trigger); Blight ~ Scorched
Earth/Plains; Pantogar's Failure ~ Cleansing Light; Nihil's Minion's armor lock = Swashbuckler (its "cannot gain armor"
is currently ruled away); Whipping Boy = Warlord/Bard group-mother shape; Revenants/Trolls = Monster with Dragon's Teeth
`count`. Unimplemented War/Life twins: Siren Song = Undine (Life), Cruel Whim ~ Weapon Master (War).

## 4. Feature list

### Lang-layer features (B)

| Id | Feature | Where | Cards needing it | Count |
|---|---|---|---|---|
| L1 | `Target.minion`, `Target.monster` builders (engine `TargetType` already has them); `.nonNeutral` (structure owner ≠ neutral); `.notInStructure`; `.groupSize(min)` | `lang/target.ts` | Albatross, Blindness, Pantogar's Curse, Spectre's Curse, Stupefy, Vicious Strength, Whipping Boy, Bleak Isle, Bleak Isle II, Fear, Odar | 11 |
| L13 | Tokened helper patterns (per-minion tokens `x:<id>`, self-dispelling round/turn counters, counting copies of a helper) — likely a small `Counter`/`Decay` keyword pair, else Script | `keywords/special.ts` | Atrophy, Frostbite, Frost Dragon, Gorgon, Oblivion, Shadowmasque | 6 |
| L3 | `GiveGroup(card, scope)`: cast a helper on a *group* (opponent group, occupant group); `once` option | `effects.ts` | Nightmare, Frost Dragon, Bleak Isle, Bleak Isle II | 4 |
| L2 | Random scopes: `randomOpponent`, `randomEnemy` (owner = caster's opponent, on board), `randomOtherInGroup` | `scopes.ts` | Banshee, Nihil's Touch, Odar | 3 |
| L4 | `DamageFrom({from nation, to nation?, add, addVs, set})` on `attack:beforeArmor` (non-magical only, reads attacker/victim nation); `Against` by nation (`nations:[...]`) | new keyword in `versus.ts` | Despond, Comrades in Suffering, Nightmare; Phantom (Against-by-nation) | 4 |
| L12 | Trigger variants: `startOfCombat('recruit')`; conditional trigger (`If(cond)` e.g. recruit occupies host square); `FromNextTurn` gate (active only after the casting turn, token `castTurn`) | `triggers.ts` | Nightmare, Limbo, Passing in the Night | 3 |
| L9 | `RandomMove` options: `excludeOrder`, `allowStay`, group selector `inStructures` (globe) | `effects.ts` | Disorient, Panic | 2 |
| L5 | `Monster(def, {count})` (N copies in one group, each with its spell) | `creature.ts` | Revenants, Trolls | 2 |
| L8 | Terraform variants: from→to map (`Degrade`) and board-wide `everywhere` from terrain X | `effects.ts` | Blight, Ice Age | 2 |
| L11 | `DispelAll` scopes: `globeAndStructures`; `recruitAndItsGroupSpells` | `effects.ts` | Pantogar's Failure, Shadow Friend | 2 |
| L6 | `GrantTo: 'recruits'|'monsters'`; `NoDamage()` static (stat `noDamage` only) | `statics.ts` | Lethargy, Blindness, Nihil's Minion | 3 |
| L7 | Scope `hostGroupOthers` | `scopes.ts` | Albatross | 1 |
| L10 | Scoped `CancelMove('target'|'host')` (today `CancelMoves` hits every recruit group) | `effects.ts` | Fear | 1 |
| L14 | Count alterations on a recruit + its group (via `defOf(id).type`) | Script helper | Backlash | 1 |

### Engine features (C)

| Id | Feature (exact change) | Cards unlocked | Shared with other houses (scraped text) |
|---|---|---|---|
| E1 | **Nation as a computed stat**: `StatDelta.nation` override (last spell wins) + `ctx.setNation(minionId, nation)` for permanent change; HP 7/9, nation walks, round bonus and `house` derived from the current nation instead of being baked into `base` by `applyNation`; recheck terrain (drowning) after change | Penumbra, Shadow Friend, Nihil's Minion (and correct "Shadows" checks for L4) | Unmaking: Bedlam, Chaos Feature, Ergotism, Forbidden Ichor, Gnax, Gyre, ThudThud's Journey; Abomination: Larval Imp |
| E2 | **Movement/stacking restrictions** as stat flags read at group level (any member): `noJoin`, `noAdd` (training/Create/createRecruit into the group refused), `noStructures` (in `canEnterSquare`), `noMove` (pass I skip + relocations refused) | Forsaken, Paranoia, Nihil; tightens Fear | War Lone Wolf (ruled away today), Life Questing Beast, Abomination Possession, Justice Ostracize, Mind Narh'u'ha/Rakshasa, Nature Bellwether/Smell the Roses, Body Cessao Rift, Unmaking Devolution; "cannot be moved": 9 cards in 7 houses |
| E3 | **Ice sliding** in `movement.ts` pass I: a group entering ice keeps stepping in its direction to the first non-ice or blocking square; ignores groups and square spells on intermediate ice squares; Flight still slides; monster home resets where it stops (`Concepts_monsters`) | Freeze, Ice Age | Mind Mirage, Nature Icecaps/Water's Gift, Unmaking Changing Lands |
| E4 | **Attracting squares**: before movement, player groups adjacent to an attracting square get their order overwritten to step into one of them (random among several); a square-child spell + mother that moves with its host monster (`Concepts_mothers`) | Siren Song | Life Undine (unimplemented), Mind Mirage, Death Neb's Mirage |
| E5 | **Structure mana suppression**: in `finishTurnStart`, per-structure check (`CardDef.blocksStructureMana` or a cancellable `mana:structure` event) before adding town/colony mana | Corrosion | Abomination Civil Unrest/False Prophet, Justice Dracha's Trade, Mind Djinni Debate |
| E6 | **Cost modifiers**: `CardDef.costDelta(q, spell, card, caster)` summed in `validateOrders` (and shown by the UI) | Dissolution | 13 cards: Syzygy, Ogi, Empathy, Codex of Order, Fiend, Shapeshifter, The Withering, Hand of Zana, Quantum Mechanic, Theralda, Toy Factory, Biting Wind, Gyre |
| E7 | **Novice control**: `ctx.setNovices(structureId, n)` (clears `noviceNations`), production block hook in `beginTurn` (structure-hosted flag/event) | Insurrection | Abomination Pestilence/Altar of Blood, Unmaking Runts (Census) |
| E8 | **Discard block**: `CardDef.blocksDiscard(q, spell, side)` checked in `validateOrders` | Passing in the Night | discard-related text in 8 other cards (Abstention, Wild Abandon, Pages to Dust...) |
| E9 | **Magical attacks**: `Stats.magicalAttacks` (or per kind) → `attack()` calls `takeDamage(..., {magical:true, ignoresArmor:true})`, skipping before/after-armor handlers (Warded, Despond) | Phantom | Hope Griffin ("magical damage against Shadows"), Life Yeoman (unimplemented), Mind Foresight |
| E10 | **Computed class**: `StatDelta.cls` override; base attacks swap (swordsman H vs archer M, class base armor); class-filtered grants and persistent class requirements recheck | Cruel Whim | War Weapon Master (unimplemented) |
| E11 | **Group-mother event visibility**: `chain()` also visits spells on *other* minions of the same group whose card sets `groupEvents: true`; plus "only one of X or Y per group" check | Whipping Boy | Body Brother Wolf; other group mothers (`Concepts_mothers` table, every house has 1-3) |
| E12 | **Replace minion in place** (`ctx.replaceMinion(id, spec)` keeping group/slot, dropping old spells) + combat victim override (any living minion on either side, `combat.ts` `attackPhase`) + flip-when-alone | Odar | Unmaking ThudThud's Journey-type replacements; friendly-fire unique |
| E13 | Random empty, enterable, non-Sanctum square helper for summons (already inlined in Ambush/moonwalk; export it) | Nihil | Abomination Fiend, Death Furies, Mind Narh'u'ha, Unmaking Mudslinging |
| E14 | **Armor lock**: `StatDelta.armorZero` (armor forced to 0 after all deltas) | Nihil's Minion | War Swashbuckler (fixes its RULING) |

## 5. Shared-mechanic flags (coordinate with other house agents)

| Mechanic | Despair cards | Other houses with the same text pattern |
|---|---|---|
| Nation change (E1) | Penumbra, Shadow Friend, Nihil's Minion | Unmaking ×7, Abomination ×1 — do this once, engine-wide |
| Join/add/structure/move restrictions (E2) | Forsaken, Paranoia, Nihil, Fear | 8 "cannot join", 3 "cannot enter structures", 9 "cannot be moved" across 8 houses |
| Random kill scopes (L2) | Banshee, Nihil's Touch, Odar | Abomination Volgaris, Body Giant, Death Furies, Mind Foresight, Unmaking Chaos Feature |
| Damage-from modifiers (L4) | Despond, Comrades, Nightmare | 10 other cards ("damage from ...") in Abomination, Body, Death, Hope, Justice, Mind |
| Ice (E3) | Freeze, Ice Age | Mind, Nature ×2, Unmaking |
| Attract (E4) | Siren Song | Life Undine, Mind Mirage, Death Neb's Mirage |
| Cost modifiers (E6) | Dissolution | 13 cards, 9 houses |
| Mana suppression (E5) | Corrosion | 4 cards |
| Novice elimination (E7) | Insurrection | 3 cards |
| Gaze counters | Gorgon | Unmaking Cockatrice (identical wording), Hope Shield of Vela references both |
| Dispel-all scopes (L11) | Pantogar's Failure, Shadow Friend | 18 other "Dispels all" cards |
| Magical attacks (E9) | Phantom | Hope Griffin, Mind Foresight, Life Yeoman |
| Group mothers (E11) | Whipping Boy | Body Brother Wolf (mutually exclusive with Whipping Boy) |
| Discard (E8) | Passing in the Night | 8 cards |
| "No longer attacks" | Oblivion, Frost Dragon | Mind Flail of Sarul, Nature Bellwether/Protective Cover |

## 6. Proposed implementation order (cheapest first)

| Step | Work | Cards done (cumulative) |
|---|---|---|
| 1 | Class A cards (no new code) + L1 target builders | Augur, Changelings, Harrowing Cry, Immateriality, Makva, Pantogar's Curse, Spectre's Curse, Stupefy, Vicious Strength (9) |
| 2 | L2, L5, L6, L7, L8 (Degrade only), L9, L10, L11 (globeAndStructures), L12 (mana `If`) | + Banshee, Nihil's Touch, Revenants, Trolls, Lethargy, Blindness, Albatross, Blight, Disorient, Panic, Fear, Pantogar's Failure, Limbo (22) |
| 3 | L3 GiveGroup + L4 DamageFrom | + Despond, Comrades, Nightmare, Bleak Isle, Bleak Isle II (27) |
| 4 | L13/L14 Script helpers (tokened counters) | + Atrophy, Frostbite, Frost Dragon, Gorgon, Oblivion, Backlash (33) |
| 5 | Small engine hooks E5, E7, E8, E6 | + Corrosion, Insurrection, Passing in the Night, Dissolution (37) |
| 6 | E9 magical attacks (+ L4 Against-by-nation) | + Phantom (38) |
| 7 | E2 restrictions (also fix War Lone Wolf) | + Forsaken, Paranoia (40) |
| 8 | E1 computed nation + E14 armor lock | + Penumbra, Shadow Friend, Nihil's Minion (43) |
| 9 | E10 computed class | + Cruel Whim (44) |
| 10 | E3 ice sliding | + Freeze, Ice Age (46) |
| 11 | E4 attracting squares | + Siren Song (47) |
| 12 | E11 group-mother events | + Whipping Boy (48) |
| 13 | D cards: Shadowmasque (Script), Nihil (E2+E13, curse text), Odar (E12) | 51 |

## 7. Rules ambiguities and proposed rulings

| # | Card / topic | Question | Ruling |
|---|---|---|---|
| R1 | all | Card pages give no spell type | Types as in the table: persistent effects with no duration = alteration; "Duration"/"Dispelled after next combat" = conjuration; one-shot = manifestation; creatures = summoning; Nihil/Odar = hero. Penumbra and Shadow Friend are manifestations, so their nation change is permanent and undispellable. Cruel Whim is an alteration (the rules list it as dispelling on class change, so it is active). |
| R2 | creatures | `castOn` null | Target `Target.square` (empty square), like Hellion. |
| R3 | Despond, Comrades, Nightmare | Who is "a Shadow"? | A minion whose current nation is `shadow` (recruits and heroes). Monsters have no nation and are never Shadows; "Visions" likewise = nation `vision`. |
| R4 | Despond, Comrades | Which damage? | Combat attacks only, at `attack:beforeArmor` (non-magical); not spell, terrain or magical damage. Despond applies even to "deals no damage" attackers (Pipelines_damage D1). |
| R5 | Comrades vs Despond | Both apply | Globe handler runs last in bubbling, so Comrades' "no damage" wins (damage 0, then it bounces/does nothing). |
| R6 | Nihil's Touch | "enemy" | A living on-board minion owned by the caster's opponent (not neutral, not off-board). No candidate: no effect. Instant "dies" death. |
| R7 | Banshee | timing | At `combat:start` before round 1, a "dies" death (no experience); if that empties the opposing group the combat ends. |
| R8 | Albatross, Spectre's Curse | damage kind | Magical spell damage (`ctx.damage` default), nobody blamed. |
| R9 | Atrophy | snapshot | Each start of turn, each member's max HP drops to its current HP (permanent while the spell lasts; floor 1). Later joiners are affected from the next start of turn (group spell). Dispelling it restores max HP but not current HP. |
| R10 | Backlash | what counts | Visible spells of type `alteration` hosted on the recruit or on its group (visible helper alterations such as Changeling count; conjurations and non-visible intrinsic spells do not). |
| R11 | Bleak Isle | details | "Non-neutral" is casting-time only. Adjacent structure/Sanctum squares are immune (engine rule); groups on the new water without Waterwalk/Flight drown at once (checkFatal). The occupying group's Waterwalk is a permanent non-visible group helper. Created recruits' mark (-1 L, Waterwalk) is undispellable. Bleak Isle and Bleak Isle II are separate cards for deck limits. |
| R12 | Blight | non-listed terrain | Swamp, water, ice, lava, volcano, void unchanged (spell still resolves). Target must be an empty square (engine rule, as Scorched Earth). |
| R13 | Blindness | does it still "hit"? | Yes: it still attacks and hits for 0, so on-hit effects (e.g. its own Gorgon's Gaze) still fire. |
| R14 | Cruel Whim | new stats | While active the minion uses the other class's base (swordsman H:2 A:1 / archer M:2 A:0, nation applied); hand/missile grants keep applying; class-restricted alterations recheck and dispel. "No effect on Weapon Master or Rakshasa" = cannot target them (squanders). |
| R15 | Disorient | choice set | Uniform among legal directions other than the current order, plus "stand still" as one more option. |
| R16 | Dissolution | scope | Applies while ordering on the turn after casting, to the caster's opponent: each spell costs +1 of its house's primary and +1 of its secondary mana (even if the base secondary cost is 0). Not stackable (exclusive globe enchantment). |
| R17 | Fear | "cannot be moved" | Until E2: orders cancelled on cast and before each movement; relocation effects still work (same ruling as Standoff). Bots choose their move after `movement:before`, so a feared monster group still moves until E2's `noMove` flag lands; with E2 the group (player or computer) cannot move or be relocated. |
| R18 | Forsaken | scope | Any group containing the recruit cannot enter a structure; a group already inside stays. |
| R19 | Freeze / ice | slide end | Slide ends on the first non-ice square or before the first blocking square; only the last square's stacking/hostility applies (bounce back to the last ice square if hostile/full). Groups already on ice do not slide unless they move. |
| R20 | Frost Dragon | "damages" / round skip | Only damage that gets past armor (`attacker:damages`) triggers; the victim skips all its attacks in the next round only; repeat triggers do not extend it. Frostbite cast by it is an engine helper (ignores Shroud/Immune). |
| R21 | Frostbite | ramp | Cast turn −3, then +1 at each later start of turn: −2, −1, 0, expires at end of turn of casting +3. Raising max HP does not heal. |
| R22 | Gorgon | kill + Head | Gaze = −1 H, −1 M, +1 A (armor gained mid-combat counts from next round, Concepts_armorlevels). Third Gaze kills ("dies"). Head goes to a recruit that kills the Gorgon (blame); it moves to whichever recruit kills its holder; lost if the holder dies otherwise. Gaze hits monsters too. |
| R23 | Immateriality | expiry | When Flight ends, groups over water/void suffer at the next terrain check (literal). |
| R24 | Insurrection | "entered" | Any group entering the structure dispels it (including the owner's). Queued novice nations are cleared too. |
| R25 | Limbo | "+1 Strife at start of turn" | Paid at mana generation (pools reset after `turn:start`), if a recruit group occupies the square then. |
| R26 | Nightmare | repeat casts | Adds Despond to the opposing group only if it has none (helpers are otherwise cumulative). |
| R27 | Nihil | spawn + curse | Spawns as a player-controlled single-hero group on a random empty, enterable, non-structure, non-Sanctum square. **Nihil's Curse text is not available**; provisional: visible helper on the hitter "−1 H and −1 M, Lasts 2" — confirm before implementing. |
| R28 | Nihil's Minion | stats | Temporary nation Shadow (Mountainwalk, 7 max HP), `noDamage`, armor locked at 0 for the duration; everything reverts at expiry. |
| R29 | Oblivion | "damaged" | Took more than 0 HP after armor from a combat attacker; resumes from the next round; magical/spell damage does not wake. |
| R30 | Odar | details | Target group may be neutral; Odar takes the replaced recruit's owner and slot at full HP; kills a random other member ("dies"); each attack picks a uniformly random living minion from both groups except himself; checked after every death in his group: alone → group changes to the caster's side. |
| R31 | Shadowmasque | Chill | One Chill per swordsman (a new hit while it has one does nothing); N starts at 1, +1 at each later `round:start` of that same combat, capped at the swordsman's current H; after that combat it ticks down 1 per turn and dispels at 0; −N H applies throughout. |
| R32 | Siren Song | "enemy-controlled" | Player-controlled groups hostile to the monster's owner; adjacent to ≥1 attracting square before movement → order set toward a random attracting square; computer groups unaffected (bots move last). |
| R33 | Panic | which structures | Towns, colonies and Sanctums; same random choice as Amok. |
| R34 | Paranoia | "add recruits" | Recruit training/Create into an occupied structure whose group is a recruit group is refused; Create on a group squanders. |
| R35 | Passing in the Night | gate | Turn T+1 only: casting orders are rejected/squander, discard rejected, all combat cancelled. On the casting turn it does nothing. |
| R36 | Whipping Boy | redirect | Combat hits on other members, before armor: the member takes 0 (still "hit"), Whipping Boy takes the original amount ignoring armor, nobody blamed. One Whipping Boy/Brother Wolf per group checked at cast; after merges the oldest one redirects. |
| R37 | Lethargy | who | Every recruit on the board, both sides; monsters unaffected. |
| R38 | Pantogar's Failure | what | Visible spells hosted on the globe and on towns/colonies; square, terrain and non-visible spells stay. |

## 8. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| E1 nation refactor: nation is baked into `base` (`applyNation`) and `house` is fixed at spawn | touches stats, combat bonus, terrain checks, Against/Immune by house | make nation/house computed once for all houses (Unmaking needs it most) |
| Nihil's Curse effect unknown | Nihil can't be faithful | ask user / find another source; ship with flagged provisional ruling |
| Odar friendly fire | breaks `combat.ts` invariant that victims are in the enemy group (victim pairing, retaliation, `stillHostile`) | isolate as a victim-chooser hook on the attacker's stats/spell |
| Ice + attract + bounce interplay | movement pipeline is two-pass; sliding through stacks can moonwalk | implement sliding inside pass I only, with rule tests from `Elements_terrainswalks` |
| Cost modifiers need UI | orders UI shows base cost | expose `effectiveCost(side, card)` from the engine |
| Monster `count` + Monster spell per minion | `Monster` assumes one minion | loop `createSpell` over all members (already done for minionIds) |
| Inferred spell types | wrong type changes dispel/exclusivity | rulings R1; easy to change per card |
| No more rule pages reachable | further ambiguities can't be checked | rulings recorded per card with `// RULING:` |
