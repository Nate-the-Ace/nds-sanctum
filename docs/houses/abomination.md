# House of Abomination: card analysis

Source: `packages/cards/data/houses/abomination.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs abomination --per-house`).
House id 10; mana Will (primary) + Strife (secondary); nation Imp (7 HP, +1 hand damage in round 2, no walks; already in
`packages/engine/src/nations.ts`). Classes: **A** expressible today, **B** needs a small lang-layer addition, **C** needs an
engine feature, **D** special/hard.

## 1. Summary

| Metric | Value |
|---|---|
| Cards | 50: 7 monster summonings (Bog Horror, Doppelganger, Entrail Eater, Fiend, Maloch Horror, Volgaris, Winged Monkeys), 2 recruit creators (Ostralek hero, Sawbones), 1 monster spawner square (Husks), 40 other spells |
| Rarity | Common 17, Uncommon 16, Rare 14, Very Rare 3 |
| Expansions | Classic 18, Revolutions 10, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 2 |
| Cost curve (W+S total) | 1:3, 2:11, 3:3, 4:9, 5:7, 6:8, 7:5, 8:2, 9:2 (mean 4.4; Will 141, Strife 81 summed) |
| Pure-Will cards | 9 (Beast's Embrace, Burst of Will, Cauldron, Devouring, Fiend, Maloch Horror, Mark of Ulanoth, Organ Grinder, Willing Supplicants) |
| Pure-Strife | Will to Power (the house's "0+5" town generator) |
| Classification | **A 8, B 23, C 17, D 2** |

### Scrape check

All 50 cards have name, slug, cost, rarity, text. Problems (shared scraper not changed):

| Issue | Cards | Note |
|---|---|---|
| `castOn: null` | Bog Horror, Doppelganger, Entrail Eater, Maloch Horror, Winged Monkeys | Expected: monster texts have no "Cast on" sentence. Implied target is an empty square (ruling R37 for Winged Monkeys). Fiend parses fine (`globe`). |
| Soft-hyphen line breaks left in text | Slavers ("disap- pears", "no- vices") | Scraper should join `-\s` at old line breaks. |
| Backslash-escaped quotes in flavor (`\'`) | Cannibalism, Unholy Aura | Source page escaping leaks through; cosmetic. |
| Source typo | Winged Monkeys ("carried to to") | Present on the site; keep or fix in the card face. |
| No spell type | all | Not on the page (known); proposed types are in the table. |
| Revolver cost | Fiend `{will:1}` | Only the starting value of a revolving cost (1..10). |

## 2. Theme and mechanics

Sacrifice and self-harm for power: eat your own minions (Cannibalism, Devouring, Eat and Run, Ostralek, Sawbones), kill
your own groups for mana (Maloch's Pact, Altar of Blood, Song of the Doomed), suicide bombers (Carbuncle, Implosion,
Accursed Minion), mass death (Rain of Blood, Putrefaction, Pestilence), economy denial (Civil Unrest, False Prophet, Wild
Abandon, Gogar's Wrath), mind control (Possession, Slavers, Rogue Monster), Imp identity (Larval Imp, Djibari's Legacy,
Crucible, Bilious Rage vs Satyrs) and lava/swamp terrain (Ring of Fire, Swamp Land, Husks).

| Mechanic | Cards | Exists? |
|---|---|---|
| Kill own group-mates ("eats") | Cannibalism, Devouring, Eat and Run, Ostralek, Sawbones, Accursed Minion | `Kill` yes; scopes missing |
| Permanent growth ("gets +1 ... when ...") | Demon's Tongue, Beast's Embrace, Soul Eater, Ostralek, Devouring, Salted Wounds | no (Rage is per-combat only) |
| Next-turn / tally mana | Burst of Will, Altar of Blood, Song of the Doomed | partly (Lasts 2 + Mana) |
| Negative mana | Maloch's Pact (The Pact Is Sealed) | no clamp |
| Structure mana suppression | Civil Unrest, False Prophet | no hook |
| Novice production hooks | Altar of Blood, Djibari's Legacy, Pestilence | no hook |
| Remove from game / replace group | Implosion, Volgaris, Winged Monkeys | engine has category, no ctx |
| Ownership change + revert | Possession, Rogue Monster (neutral), Slavers (Enslaved) | `changeSides` only (no neutral, no revert) |
| Spell transfer between hosts | Scars of Kolekh | no |
| Nation / stat-line rewrite | Larval Imp, Doppelganger | no |
| Spell-cast-on-target event | Beast's Embrace | no |
| Structure destruction | Gogar's Wrath | no |
| Swamp movement rule | Swamp Land (also map-generated swamps) | **no: swamp has no effect today** |
| Hand manipulation | Wild Abandon | no |
| Revolver cost | Fiend | no |

## 3. Classification (all 50)

Cost is Will+Strife. Type is proposed (not on the page). New lang names in `code` are proposals (section 4).

| # | Card | Cost | Rarity | Cast on | Card text (quoted) | Type | Cl | Composition / what is missing |
|---|---|---|---|---|---|---|---|---|
| 1 | Accursed Minion | 5+1 | U | minion in group of two or more | "At start of combat, minion kills all other minions on both sides (friendly minions first), ending combat. Dispelled after next combat." | alteration | B | `Target.minion.minSize(2)`, `Fleeting()`, `On(When.startOfCombat(), Kill('hostGroupOthers'), Kill('opponent'), Withdraw())`. Needs Target.minion, `.minSize`, scope `hostGroupOthers`. |
| 2 | Altar of Blood | 3+2 | R | friendly town or colony | "If town contains novices, and when any novices would be created in town, they are sacrificed (eliminated), and town's owner gets +2 Will and +2 Strife next turn. Duration: Turn of casting +4." | conjuration | C | `Lasts(5)`; needs E2 novice events (cancel creation) + `ctx.removeNovices`, plus L5 next-turn mana tally. |
| 3 | Arcane Stigma | 2+1 | C | minion | "Dispels all individual spells on minion. Minion cannot be targeted by individual spells." | alteration | B | `Target.minion`, `OnCast(DispelAll())` extended to minion targets and excluding itself, `Shroud({from:['individual']})`. |
| 4 | Beast's Embrace | 2 | C | minion | "Minion gets +1 armor for each subsequent alteration cast on minion or its group." | alteration | C | Needs E5 `spell:cast` event on the target ref; then `Grow({armor:1}, per: castAlteration)` (L4). |
| 5 | Bilious Rage | 1+1 | C | recruit | "Recruit gets +1 hand and missile damage, or +2 damage against Satyrs." | alteration | B | `Grant({hand:1, missile:1})` + `Against` keyed by **nation** (`{nations:['satyr'], hand:1, missile:1}`); Against today keys on house only. |
| 6 | Bog Horror | 4+3 | U | (square) | "H:2 A:1 HP:18 L:1 Territorial. At start of combat, casts Plague (-2 maximum hit points, then 2 hit points of damage) on opposing group." | summoning | A | `Territorial(), Monster({hand:2, armor:1, hp:18, level:1}), On(When.startOfCombat(), Give('plague','opponent'), Damage(2,'opponent'))`; helper `plague` = `Grant({maxHp:-2})`. Near-dup of Brimstone Dragon. |
| 7 | Burst of Will | 2 | C | globe | "Caster gets +2 Will next turn." | conjuration | A | `Lasts(2), On(When.manaPhase, AddMana('will',2))`. (Cleaner with L5.) |
| 8 | Cannibalism | 4+1 | U | minion | "When cast, and at end of combat, minion kills the most damaged other minion in its group." | alteration | B | `Target.minion`, `OnCast(Kill('hostGroupMostHurt'))`, `On(When.endOfCombat, Kill('hostGroupMostHurt'))`. Needs trigger `endOfCombat` (combat:end) and scope "most damaged other, any minion, damaged or not" (R2). |
| 9 | Carbuncle | 2+2 | U | friendly recruit | "At start of next combat, recruit explodes (dies), and all other minions in both groups take 3 hit points of damage." | alteration | B | `Target.recruit.friendly`, `On(When.startOfCombat(), Expend(), Damage(3,'hostGroupOthers'), Damage(3,'opponent'), Kill())`. Needs scope `hostGroupOthers`. |
| 10 | Cauldron of Strife | 4 | C | globe | "Caster gets +1 Strife each turn. May be cast more than once." | alteration | A | `Stackable(), On(When.manaPhase, AddMana('strife',1))`. Near-dup of Point of Clarity. |
| 11 | Civil Unrest | 3+2 | U | globe | "Every town and colony no longer generates mana unless a friendly recruit is present at start of turn. (Mana-generating spells still produce mana normally.)" | alteration | C | Needs E1 structure base-mana hook (`structure:mana` event, cancellable). |
| 12 | Crucible | 2+2 | C | globe | "At start of next turn, all Imps in lava or volcano squares are fully healed, and take no damage from lava or volcanoes, and Crucible is dispelled." | conjuration | B | `Lasts(2)`, globe Grant of Firewalk to Imps (`Grant` `to:'nation:imp'`, walks) + `On(When.startOfTurn, Heal('full','impsOnFire'))`. Needs nation filter for Grant/scope (R9). |
| 13 | Demon's Tongue | 1+1 | C | swordsman | "When swordsman kills an opponent by combat damage, swordsman gets +1 hand damage." | alteration | B | `Target.swordsman`, `Grow({hand:1}, When.onKill)`. Needs trigger `onKill` (attacker:kills) and L4 Grow. |
| 14 | Devouring | 1 | R | friendly recruit | "It eats (kills) all other recruits in its group, and absorbs their maximum and current hit points. (... These stat changes cannot be dispelled.)" | manifestation | B | `OnCast(Absorb('targetGroupOtherRecruits'))`: sum M,C, kill them, give a non-visible stat-token helper `+M HP`, heal C. Needs L4 stat-token helper + scope. |
| 15 | Dissention | 2+2 | C | minion | "Every other minion in its group takes N hit points of damage, where N is the greater of target minion's hand or missile damage." | manifestation | B | `Target.minion`, `OnCast(Damage({fromStat:'maxAttack'}, 'targetGroupOthers'))`. Needs computed damage amount + scope. |
| 16 | Djibari's Legacy | 1+1 | U | globe | "All new novices created are Imps." | alteration | C | Needs E2 (`novice:created` with editable nation; per-novice nation list). |
| 17 | Doppelganger | 4+2 | VR | (square) | "H:2(x2) A:0 HP:15 L:2 Nomadic. Two attacks. At start of combat against monsters, Doppelganger kills the first opposing monster, copies its hand and missile damage, attacks, armor, hit points, level, and house, and is fully healed. (This does not give Doppelganger missile attacks.)" | summoning | C | `Nomadic(), Monster({hand:2, handAttacks:2, hp:15, level:2})`, `On(When.startOfCombat('monster'), ...)`. Needs E6 `ctx.transform(minion, base, house)` and kill with blame (R13). |
| 18 | Eat and Run | 1+1 | C | friendly recruit in group of two or more | "Target recruit eats (kills) a random other member of its group. Group moves twice this turn in its direction of travel." | manifestation | B | `Target.recruit.friendly.minSize(2)`, `OnCast(Kill('targetGroupRandomOther'), MoveTwice())`; MoveTwice must accept a minion target (use its group). |
| 19 | Entrail Eater | 4+2 | U | (square) | "H:3 A:1 HP:10 L:2 Nomadic. At start of turn, Entrail Eater is fully healed." | summoning | A | `Nomadic(), Monster({hand:3, armor:1, hp:10, level:2}), On(When.startOfTurn, Heal('full'))`. |
| 20 | False Prophet | 3+2 | R | town or colony | "Town no longer generates its 1 mana. (Mana-generating spells on the town are not affected.)" | alteration | C | Needs E1 (`structure:mana` cancel when hosted on that structure). |
| 21 | Fiend | 1 (revolver 1..10) | R | globe | "H:M A:1 HP:2*M L:2 Nomadic, Flight, Moves 2. Creates Fiend in a random square. Revolver (Casting cost M revolves from 1 to 10, starting at 1 and increasing by 1 mana per turn, restarting at 1 when it reaches 10, until cast)." | summoning | D | Needs per-hand-instance state (cost changes each turn in hand), cost-dependent stats, random empty square summon, "Moves 2" monster movement. E11. |
| 22 | Gogar's Wrath | 4+2 | R | friendly town or any colony | "Town or colony is destroyed. Square becomes barren land." | manifestation | C | Needs E8 `ctx.destroyStructure`, target "friendly town OR any colony" (L1), then `Terraform('barren')` on the freed square. |
| 23 | Husks | 3+2 | U | square | "H:3 A:0 HP:7 L:0 Nomadic. Square becomes barren land, and cannot be targeted by Nature spells. Every other turn, before movement, one Husk is created in square. Dispelled if terrain changes or when entered by a recruit group." | alteration | B | `Nomadic()`, `OnCast(Terraform('barren'))`, `Bound('barren')` (add barren), square `Immune(['nature'])`, `Spawn({Husk def}, {every:2, when: beforeMovement})`, `On(When.enter('recruit'), Expend())`. |
| 24 | Implosion | 1+1 | R | friendly minion group | "After movement, target group implodes (is removed from the game), and all minions in the 3x3 diamond centered on group's square take 2 hit points of damage for each minion in target group." | conjuration | C | `Target.group.friendly`, `Lasts(1)`, `On(When.afterMovement, ...)`. Needs E3 `ctx.remove` (removed category), scope `area3x3`, computed damage (2 x size). |
| 25 | Larval Imp | 2+1 | C | recruit | "When recruit is dying, recruit returns to life, is fully healed, has all individual spells dispelled, and changes into an Imp. Dispelled after one use." | alteration | C | `On(When.dying, Cancel(), Heal('full'), DispelAll(individual), SetNation('imp'))`. Needs trigger `dying` (L3) and E6 `ctx.setNation`. |
| 26 | Maloch Horror | 6 | U | (square) | "H:4 A:1 HP:15 L:2 Nomadic, Flight." | summoning | A | `Nomadic(), Monster({hand:4, armor:1, hp:15, level:2, walks:['flight']})`. |
| 27 | Maloch's Pact | 4+4 | R | group | "Group dies. The Pact Is Sealed (caster gets -4 Will and -4 Strife each turn, may be cast more than once) is cast on the globe." | manifestation | B | `OnCast(Kill('targetEach'), CastOn('the-pact-is-sealed','globe'))`; helper `Stackable(), On(When.manaPhase, AddMana('will',-4), AddMana('strife',-4))`. Needs globe-cast effect + mana clamp (E13, tiny). |
| 28 | Mark of Ulanoth | 2 | C | recruit | "Recruit receives no missile damage (before checking armor)." | alteration | B | New `Deflect('missile')` (attack:beforeArmor, kind missile -> 0). Optional E14 wise-targeting quasi-immunity tiebreak. |
| 29 | Organ Grinder | 1 | VR | recruit | "When recruit kills an opponent by combat damage, joyful music is played." | alteration | A | `Fanfare('joyful music when it kills')`. Near-dup of War Drums / Elven Piper. |
| 30 | Ostralek | 4+4 | R | recruit group | "H:2 A:1 HP:7 L:2 ... Creates Ostralek, an Imp Hero swordsman. At start of turn, he kills the most damaged other recruit in his group and gets +1 hand damage, +2 maximum and current hit points. Cannot be targeted by Cannibalism. (Each Hero may be cast only once per game.)" | hero | B | `Hero(), Create({name:'Ostralek', cls:'swordsman', nation:'imp', level:2}, {with:['ostraleks-tribute']})`; helper: `On(When.startOfTurn, If(Kill('hostGroupMostHurtRecruit')) -> Grow({hand:1, maxHp:2}, heal))` + `Immune` by card id (cannibalism). Needs L4 + L6 + scope. |
| 31 | Perverse Speed | 3+3 | C | friendly recruit group | "All members of group get -3 max HP and +1 attack." | alteration | A | `Target.recruitGroup.friendly, Grant({maxHp:-3, attacks:1})`. |
| 32 | Pestilence | 5+2 | R | globe | "All novices are eliminated. All owned structures no longer create novices. Duration: Turn of casting +3." | conjuration | C | `Lasts(4)`; needs E2 (`ctx.removeNovices`, cancel production). |
| 33 | Possession | 5+4 | R | recruit group not in a structure | "Group joins caster's side, and its movement orders are cancelled. Group cannot join groups, add recruits, or enter structures. Group and its members cannot be targeted by friendly spells. Duration: Turn of casting +4. Dispelled after next combat." | conjuration | C | `Target.recruitGroup.nonFriendly.notInStructure`, `Lasts(5), Fleeting(), Shroud({against:'friendly'})`, `OnCast(ChangeSides, CancelMove)`. Needs E4: revert owner when the spell ends (expire **or** dispel: an `onEnd` hook), movement restrictions (no join / no add / no structure entry). |
| 34 | Putrefaction | 4+2 | R | globe | "Every monster on the board dies. (Monsters that are off the board are not affected.)" | manifestation | B | `OnCast(Kill('allMonsters'))`; scope `allMonsters` (on-board filter exists). |
| 35 | Rain of Blood | 5+2 | U | group | "Every member of group without enchantments dies." | manifestation | B | `OnCast(Kill('targetUnenchanted'))`; scope from `hasEnchantments` helper. |
| 36 | Ring of Fire | 4+2 | U | globe | "Affects all squares in a two-deep ring around the edge of the board. Affected squares become lava. (Lava causes 3 hit points of damage at start of turn unless group has Firewalk.)" | manifestation | B | `OnCast(Terraform('lava','edge2'))`; new TerraformArea (R26). |
| 37 | Rogue Monster | 1+1 | C | monster group | "Group becomes neutral. (Neutral groups move last, attack all other groups, and have "half-initiative" in combat.)" | manifestation | C | `Target.monsterGroup`; needs E4 `ctx.setOwner(group,'neutral')` (flipGroup refuses neutral). Half-initiative already = `ownerRank`. |
| 38 | Salted Wounds | 1+1 | U | group | "Each member of group has its maximum hit points lowered to its current hit points." | manifestation | B | `OnCast(GiveTokens('salted', 'targetDamaged', {maxHp: -(max-hp)}))`: non-visible stat-token helper (L4). |
| 39 | Sawbones | 2+2 | C | recruit group | "H:2 A:1 HP:7 L:1 Creates an Imp swordsman. At end of combat, if any other members of its group are damaged, Sawbones kills the most damaged other recruit in its group, and all surviving members of its group are fully healed." | summoning | B | `Create({name:'Sawbones', cls:'swordsman', nation:'imp'}, {with:['sawbones-surgery']})`; helper `On(When.endOfCombat, If(any damaged other) Kill('hostGroupHurtOther'), Heal('full','hostGroup'))`. Needs `endOfCombat` + L6 If. |
| 40 | Scars of Kolekh | 2+2 | C | friendly group | "Minions in group get -1 hand and missile damage. If group is killed in battle, Scars of Kolekh transfers to the killing group." | alteration | C | `Grant({hand:-1, missile:-1})` + E7 `ctx.transferSpell` and "group wiped by combat, blamed group" detection. |
| 41 | Slavers | 4+3 | R | friendly recruit group | "During combat, when any enemy recruit is dying, recruit is healed to 1 hit point, has all spells dispelled, and disappears. Enemy recruits reappear in Slaver's square when empty, with Enslaved (group joins caster's side; in friendly structure, group is replaced by an equal number of novices; dispelled at start of combat)." | alteration | D | Needs: watching enemy minions' dying (events do not bubble to the opposing group), minion leaves group into an off-board container, conditional reappearance, Enslaved owner swap with revert, group-to-novices conversion (E2+E4+E12). |
| 42 | Song of the Doomed | 2 | C | globe | "For each minion on either side that dies this turn, minion's owner gets +1 Will next turn." | conjuration | B | `Lasts(2)`, `On(When.dies, Tally(owner,'will',1))`, `On(When.manaPhase, PayTally())` (L5). Needs trigger `dies` (any minion, seen from globe). |
| 43 | Soul Eater | 2+1 | U | swordsman | "Swordsman gets +1 hand damage. At start of turn, swordsman gets -1 maximum and current hit point. When swordsman damages an opponent, swordsman gets +1 maximum and current hit point." | alteration | B | `Grant({hand:1})`, `Grow({maxHp:-1}, When.startOfTurn, {current:true})`, `Grow({maxHp:1}, When.onDamage(), {current:true})` (L4; R31). |
| 44 | Swamp Land | 5+2 | U | square | "Square becomes swamp. (Groups can exit swamp only in the direction from which they entered.)" | manifestation | C | `OnCast(Terraform('swamp'))` works today, but the swamp rule does not exist: E9. |
| 45 | Unholy Aura | 2+2 | C | minion | "Minion receives no combat damage from recruits without enchantments (after checking armor)." | alteration | B | `Target.minion, Warded()`: exact existing keyword; only `Target.minion` is missing. Near-dup of Sylph's Warded. |
| 46 | Volgaris | 5+4 | VR | undamaged friendly monster group | "H:4(x2) A:1 HP:20 L:2 Nomadic. Two attacks. Group is replaced by Volgaris. At start of combat, casts Lightning Bolt (5 hit points of damage) on one random opposing minion." | summoning | C | `Target.monsterGroup.friendly.undamaged`, `Nomadic()`, `Replace({Volgaris def})`, `On(When.startOfCombat(), Damage(5,'opponentRandom'))`. Needs E3 remove + replace. |
| 47 | Wild Abandon | 3+1 | U | globe | "Both players discard all spells in hand that were not cast this turn." | manifestation | C | Needs E10 `ctx.discardHand(side)`. |
| 48 | Will to Power | 0+5 | R | town or colony | "Will to Power generates +2 Will for town owner each turn." | alteration | A | `Target.structure, On(When.manaPhase, AddMana('will',2,'structureOwner'))`. Near-dup of the War/Life 0+5 generators. |
| 49 | Willing Supplicants | 4 | U | town or colony | "If structure is occupied by two or more recruits, Willing Supplicants generates +1 Will and +1 Strife for structure owner each turn." | alteration | B | `On(When.manaPhase, If(occupants >= 2), AddMana('will',1,'structureOwner'), AddMana('strife',1,'structureOwner'))` (L6). |
| 50 | Winged Monkeys | 3+2 | R | (square) | "H:3 A:1 HP:2(x3) L:1 Nomadic, Flight. Creates three Winged Monkeys. Withdraws at the start of combat round 3. At end of combat, enemy group is carried to to a random adjacent unoccupied non-structure square, and Winged Monkeys are removed from the game." | summoning | C | `Nomadic()`, `Monster(def, {count:3})` (count is new), `On(When.eachRound(3), Withdraw())`, `On(When.endOfCombat, Carry('opponent'), RemoveSelfGroup())`. Needs E3 remove. |

## 4. Features needed, and what each unlocks

### Lang layer (B work; no engine change)

| Id | Feature | Unlocks (cards) | n |
|---|---|---|---|
| L1 | Target additions: `Target.minion`, `Target.monsterGroup`, `.minSize(n)` (casting-time), `.notInStructure` (persistent), `.undamaged`, structure kind/owner OR ("friendly town or any colony") | Accursed Minion, Arcane Stigma, Beast's Embrace, Cannibalism, Dissention, Unholy Aura, Eat and Run, Rogue Monster, Possession, Volgaris, Gogar's Wrath | 11 |
| L2 | Scopes: `hostGroupOthers`, `targetGroupOthers`, `hostGroupMostHurt` (any minion, damaged or not, ties random) and a recruit variant, `targetGroupRandomOther`, `targetGroupOtherRecruits`, `opponentRandom`, `allMonsters`, `targetUnenchanted`, `area3x3`, nation filter (`imp on lava/volcano`) | Accursed Minion, Carbuncle, Dissention, Cannibalism, Ostralek, Eat and Run, Devouring, Volgaris, Putrefaction, Rain of Blood, Implosion, Crucible | 12 |
| L3 | Triggers: `When.endOfCombat` (combat:end), `When.onKill` (attacker:kills), `When.dying` (minion:dying, host), `When.dies` (minion:dies, any, from globe), `When.afterMovement` (movement:after) | Cannibalism, Sawbones, Winged Monkeys, Demon's Tongue, Larval Imp, Song of the Doomed, Implosion | 7 |
| L4 | `Grow(stats, trigger, {current})`: permanent token-counted stat growth; plus non-visible stat-token helper (`GiveTokens`) for undispellable one-off changes | Demon's Tongue, Soul Eater, Ostralek, Beast's Embrace (with E5), Devouring, Salted Wounds | 6 |
| L5 | Next-turn mana: `ManaNextTurn` / `Tally` + `PayTally` on a globe helper with per-side tokens | Burst of Will (cleaner), Altar of Blood, Song of the Doomed | 3 |
| L6 | Conditions: `If(predicate, ...effects)` (count/occupancy/"a kill happened") | Willing Supplicants, Sawbones, Ostralek | 3 |
| L7 | Small effects/keywords: `DispelAll` on a minion and never itself; computed damage amount; `CastOn(helper,'globe')`; Terraform area `edge2`; `Spawn(def,{every})` on host square; `Bound('barren')`; square-hosted house immunity; `Against` by nation; `Deflect('missile')`; `MoveTwice` for a minion target; `Monster` `count` | Arcane Stigma, Larval Imp, Dissention, Implosion, Maloch's Pact, Ring of Fire, Husks, Bilious Rage, Mark of Ulanoth, Eat and Run, Winged Monkeys | 11 |

### Engine (C work)

| Id | Feature (exact) | Unlocks | n |
|---|---|---|---|
| E1 | `structure:mana` event per structure in `finishTurnStart` before adding `manaType`, `data.amount` editable / `cancel`; spells on structure and globe see it | Civil Unrest, False Prophet | 2 |
| E2 | Novices as a per-novice nation list on `Structure` (replace count + `noviceNations` queue); `novice:created` event (structure ref, editable `nation`, `cancel`) fired by production and `addNovices`; `ctx.removeNovices(structureId, n?)` | Altar of Blood, Djibari's Legacy, Pestilence (+ Slavers) | 3 |
| E3 | `ctx.remove(minionId)` (death category `removed`, no events) and `ctx.replaceGroup(gid, specs)` (remove all, summon at same pos, same owner) | Implosion, Volgaris, Winged Monkeys | 3 |
| E4 | `ctx.setOwner(gid, PlayerId)` incl. neutral (groupSeq move, minion and spell owners); card hook `onEnd` (expire **and** dispel, today only `onExpire`); group flags `noJoin`, `noAddRecruits`, `noEnterStructure` honoured by movement/joining/Create | Possession, Rogue Monster (+ Slavers) | 2 |
| E5 | `spell:cast` event dispatched on the target ref after a successful `executeCast` (`data.cardId`, `data.type`, `data.caster`) | Beast's Embrace | 1 |
| E6 | `ctx.setNation(minionId, nation)` (base HP 7/9 swap keeping damage taken, walks, house, combat bonus) and `ctx.transform(minionId, partial BaseStats, house)` | Larval Imp, Doppelganger | 2 |
| E7 | `ctx.transferSpell(spellId, newHost, newOwner?)` + detection "group wiped in combat, blamed attacker's group" (data on last `minion:killed`) | Scars of Kolekh | 1 |
| E8 | `ctx.destroyStructure(id)` (dispel structure spells, drop novices/mana, recheck square, occupying group stays) | Gogar's Wrath | 1 |
| E9 | Swamp rule: per-square `swampEntry: Dir` recorded on `group:enter`; exit from swamp only toward the square entered from (Flight exempt); enforce in `canEnterSquare`/legalDirs | Swamp Land (and every map-generated swamp, which is currently a no-op) | 1 |
| E10 | `ctx.discardHand(side)` | Wild Abandon | 1 |
| E11 | Hand instances with state (`hand: {cardId, tokens}`), start-of-turn hook for cards in hand, cost function per instance, `Moves N` for monsters | Fiend (D) | 1 |
| E12 | Minion leaves group into off-board container + reappear-when-empty + group-to-novices conversion | Slavers (D) | 1 |
| E13 | Clamp each mana pool at 0 after all `mana:generate` handlers | Maloch's Pact | 1 |
| E14 | Wise targeting tiebreak 1 "quasi-immune" (stat flag `missileImmune`) | Mark of Ulanoth (quality) | 1 |
| E15 | `ctx.kill(id, {blame})` so monster abilities are "kills" deaths | Doppelganger (fidelity) | 1 |

Top features by cards unlocked: L2 scopes (12), L1 targets (11), L7 small effects (11), L3 triggers (7), L4 Grow/stat-tokens (6); best engine
items E2 novices (3) and E3 remove/replace (3).

## 5. Shared-mechanic flags (other houses will need these)

| Feature | Likely other users (from rules pages) |
|---|---|
| E2 novice events/list | Hope (Chalice of Hope, Fertility, Army of Light), Justice (Spawn of Toganni), Making (Kumatru Academy, Usam University), Unmaking (Runts), Census, Insurrection, Allies (Life, already uses addNovices) |
| E1 structure mana hook | any "town no longer generates" / mana-doubling card; Ghost Town |
| E3 remove/replace | Lycanthropy, Devolution, Instability, Civilize/Settlement, Ascension, Void, Cessao Spiral, Shifting Sands |
| E4 owner/neutral/onEnd | Renegades, Alabaster Guardian, Tindelhunden, Hellion-style side changes, "joins caster's side" cards |
| E7 spell transfer | Jinx and every "transfers to" card |
| E8 structure destroy | Earthquake, Entropia, Maelstrom, Ancestral Home; colonies (Colony helper dispels -> destroyed) |
| E9 swamp | Mudslinging, mapgen swamps (bug today for all houses) |
| E11 revolver/hand state | all Revolutions "Revolver" cards; War/Life "Recursive" backlog E10 |
| E5 spell:cast event | "when a spell is cast on ..." cards |
| E6 nation change | Changelings, nation-changing curses, Jade Gargoyle/Odar replacement |
| L3 triggers, L4 Grow, L2 scopes, L1 targets | generic; nearly every house |
| `Monster` count, `Spawn` | multi-creature summons and "mother"/spawner squares |

## 6. Ambiguities and rulings

| # | Card | Question | Ruling |
|---|---|---|---|
| R1 | Altar of Blood | +2/+2 per novice or per sacrifice? | Per sacrifice occasion (the cast-time batch is one, each later creation is one); paid at the next mana phase to the structure's owner at the time. |
| R2 | Cannibalism, Ostralek | "most damaged other" when nobody is damaged | Still kills one: highest (max-hp) first, ties random. Cannibalism any minion; Ostralek recruits only. Sawbones kills only if one is damaged (its text says so). |
| R3 | Ostralek | "Cannot be targeted by Cannibalism" | Only blocks casting Cannibalism on him; a groupmate's Cannibalism may still eat him. |
| R4 | Accursed Minion | kill category, order | Instant death ("dies", no experience); own group first, then opponents; combat ends; end/after-combat events still fire for the host's group. |
| R5 | Carbuncle | revived by Larval Imp | Carbuncle expends before the kill, so it explodes once. Damage is magical. |
| R6 | Beast's Embrace | what counts as "alteration cast" | Real spells of type alteration that execute successfully on the minion or its current group, any caster, after the Embrace. Helpers and squanders do not count. |
| R7 | Burst of Will | two copies in a turn | Enchantments are exclusive: the second squanders (unlike Cauldron, which says "may be cast more than once"). |
| R8 | Civil Unrest | when/what "friendly recruit present" | At mana generation (after captures): a recruit group of the structure's owner on its square. Sanctum unaffected. Both players. Permanent. |
| R9 | Crucible | implementing "take no damage" | Imps (both sides) count as Firewalk while it lasts (Lasts 2) and are healed fully at the next start of turn before terrain damage. |
| R10 | Devouring | revived victims | Only minions actually dead are absorbed; recruits only; stat gain is a non-visible helper (undispellable). |
| R11 | Dissention | which stats | Current computed hand/missile (spells included, no round or nation modifiers); magical damage. |
| R12 | Djibari's Legacy | scope | All novices produced or spell-created after casting, both players; existing novices unchanged. |
| R13 | Doppelganger | pure shooter victim; kill type | Literal: copies hand, missile, hand attacks; never gains missile attacks (a pure shooter copy has 0 attacks). Kill is a "kills" death blamed on Doppelganger (needs E15; else "dies"). Repeats every combat vs monsters; copied house affects Against/Immune. |
| R14 | Eat and Run | no move order | Moves twice repeats the existing order; no order means no move. Victim random among living others. |
| R15 | Fiend | random square, M | Random empty non-structure square it can stand on (Sanctum entrances allowed per rules); M = cost paid; revolver counter starts when drawn. |
| R16 | Gogar's Wrath | occupant | Occupying group stays; novices and structure spells lost; square becomes barren. |
| R17 | Husks | first spawn, blocked square | First Husk on the turn after casting, then every 2nd turn, before movement; skipped if the square is occupied; Husks are the caster's, computer-controlled, Nomadic. Any recruit group entering dispels it. |
| R18 | Implosion | "3x3 diamond" | The 9 squares around and including the group's square (the board is drawn isometric, so a 3x3 block looks like a diamond). Size counted at implosion; removal fires no death effects; damage magical, friendly groups included. |
| R19 | Larval Imp | what changes | Nation becomes Imp (base HP 7, house Abomination, round-2 hand bonus); class, level and experience kept; visible individual spells (itself included) dispelled; group spells kept. |
| R20 | Maloch's Pact | negative mana; revived members | Pools clamp at 0 after mana generation (E13). The Pact is sealed even if some members survive. |
| R21 | Mark of Ulanoth | spell damage | Only combat missile damage is stopped. |
| R22 | Pestilence | spell-created novices | Blocks production only; spells that create novices still work. |
| R23 | Possession | own group; end | Requires a non-friendly target (casting on your own group does nothing useful). When it ends for any reason (expiry, after next combat, dispel), the group returns to its previous owner. |
| R24 | Putrefaction | own monsters | All on-board monsters, both sides and neutral; "dies". |
| R25 | Rain of Blood | group enchantments | A visible spell on the group counts as an enchantment of every member. |
| R26 | Ring of Fire | "edge" on irregular realms | Cells within 2 steps (Chebyshev) of the board boundary; structures and Sanctum areas immune (existing setTerrain rule). |
| R27 | Rogue Monster | permanence | Permanent; keeps computer control and bot; hostile to everyone incl. other neutrals. |
| R28 | Salted Wounds | permanence | Permanent non-visible helper; later max-HP grants still stack on top. |
| R29 | Scars of Kolekh | "killed in battle"; owner after transfer | Last member killed by combat damage (blamed); moves to the blamed attacker's group and the spell's owner becomes that group's owner (so its persistent "friendly" check stays true). Wiped by spells: it simply leaves play. |
| R30 | Song of the Doomed | which deaths | `minion:dies` (kills and dies, not removed) from execution to end of turn; neutral owner gets nothing; paid next mana phase; exclusive. |
| R31 | Soul Eater | -1 max and current | Max -1 and current -1 (not clamp then subtract); can kill ("dies"). |
| R32 | Swamp Land | "direction from which they entered" | A group may only leave a swamp toward the square it entered from; groups that arrived without moving (created, appeared) may leave any way; Flight ignores swamp. |
| R33 | Volgaris | target, bolt | All members at full HP, friendly; old group removed (no death effects); Volgaris same square; Lightning Bolt every start of combat, random opposing minion, magical 5. |
| R34 | Wild Abandon | timing | At execution, hands no longer contain cast or discarded cards; everything left goes to discard; refill at next start of turn. |
| R35 | Willing Supplicants | whose recruits | Recruits on the structure square at mana phase, any owner (post-capture it is the owner's group). |
| R36 | Winged Monkeys | target; where carried | Empty square (summoning). After each of their combats (also after withdrawing), the enemy group goes to a random unoccupied non-structure square adjacent to the enemy that it can enter; if none, it stays. Monkeys are then removed (no death effects). |
| R37 | Bilious Rage | "+2 against Satyrs" | +1 H and +1 M normally; against Satyr-nation victims the bonus is +2 instead (extra +1 via Against-by-nation). |
| R38 | Bog Horror | Plague | Visible helper (an enchantment), stacks per combat; -2 max HP then 2 magical damage. |
| R39 | Slavers | scope for a first version | Simplify: enslaved recruits form one off-board group per combat that reappears on the Slavers' square when empty, owned by the caster until its next start of combat; entering a friendly structure converts them to novices. |

## 7. Proposed task order (cheapest first)

| Step | Work | Cards done (cumulative) |
|---|---|---|
| 1 | Declare the 8 A cards (+ helper `plague`) | 8 |
| 2 | L1 targets + L2 scopes + L3 triggers + small L7 (DispelAll minion, Against nation, Deflect, MoveTwice minion, computed damage, Monster count) | +13: Unholy Aura, Putrefaction, Rain of Blood, Accursed Minion, Carbuncle, Cannibalism, Dissention, Eat and Run, Bilious Rage, Mark of Ulanoth, Arcane Stigma, Demon's Tongue (with Grow), Crucible -> ~21 |
| 3 | L4 Grow + stat-token helper, L6 If | +6: Soul Eater, Devouring, Salted Wounds, Sawbones, Ostralek, Willing Supplicants -> ~27 |
| 4 | L5 next-turn mana, CastOn globe, E13 clamp | +2: Song of the Doomed, Maloch's Pact -> ~29 |
| 5 | Spawn + Bound barren + square immunity; Terraform edge2 | +2: Husks, Ring of Fire -> ~31 |
| 6 | Small engine ctx: E3 remove/replace, E10 discardHand, E4a setOwner neutral, E1 structure:mana, E5 spell:cast, E8 destroyStructure, E6a setNation | +10: Implosion, Volgaris, Winged Monkeys, Wild Abandon, Rogue Monster, Civil Unrest, False Prophet, Beast's Embrace, Gogar's Wrath, Larval Imp -> ~41 |
| 7 | Medium engine: E2 novices, E9 swamp, E7 transfer, E6b transform, E4b Possession (onEnd + movement flags) | +7: Altar of Blood, Djibari's Legacy, Pestilence, Swamp Land, Scars of Kolekh, Doppelganger, Possession -> ~48 |
| 8 | Hard: E11 revolver/hand state + Moves N; E12 Slavers | +2 -> 50 |

## 8. Nation and flavour notes affecting stats

- Imp recruits: 7 HP, armor/damage per class, +1 hand damage in round 2 (engine `combat: 'hand2'`, applied in `nationBonus`, not in
  printed stat lines). Ostralek and Sawbones print `H:2 A:1 HP:7`, i.e. the plain Imp swordsman base (Ostralek L:2 as a Hero); no
  helper bonus is folded into those lines.
- Imp identity is rules-relevant: Crucible (Imps only), Djibari's Legacy (novices become Imps), Larval Imp (turns a recruit into an
  Imp: a 9 HP Cyclops/Gargoyle/Misfit drops to base 7). Bilious Rage's Satyr bonus is nation-based, not house-based (a Nature monster
  is not a Satyr).
- Doppelganger copies `house`, so Against/Immune checks on it change after it copies.
- Monster levels: Husks are L0 (after their first hit they miss any L1+ victim until misses catch up); Winged Monkeys are 2 HP each, so
  their round-3 withdrawal matters more than their damage.

## 9. Risks

| Risk | Note |
|---|---|
| Map swamps already exist | `HARSH` includes swamp, so mapgen may place swamps that currently do nothing; E9 changes existing games. |
| Novice refactor (E2) | Touches training, capture (novices eliminated), `addNovices`, UI counts and saves; do it once for all houses. |
| Ownership flips | `flipGroup` rewrites the owner of every spell on the group; Possession revert flips them back, including spells the opponent cast meanwhile. Decide whether spell owners should follow (rules do not say). |
| Self-dispel order | `executeCast` adds the spell record before `onCast`, so a DispelAll on the target would dispel the casting spell itself (Arcane Stigma); exclude `c.spell.id`. |
| Death inside handlers | Kill-then-continue effect lists (Carbuncle, Accursed Minion) run after the host is buried; order effects so the host's own death comes last. |
| Negative mana | Without E13 a pool can go negative and break cost validation or the UI. |
| Off-board events | Slavers needs enemy minion events; bubbling only reaches the victim's chain and the globe, so watchers must live on the globe. |
| Script creep | Several B cards are tempting `Script` one-offs; prefer the shared L2-L6 pieces since other houses reuse them. |

Rules sources read: Elements_spells, Concepts_spelltargets, Concepts_eventbubbling, Pipelines_combat/damage/death/turnphases,
Concepts_boardhop, Concepts_mothers, Concepts_monsters, Concepts_leavesgroup, Concepts_relations, Elements_novices,
Elements_structures, Elements_terrainswalks, Elements_groups, Axioms_players (half-initiative), Elements_deckhand, Orders_casting.
No new pages saved: the rules index lists no further section pages, and guessed pages for revolvers/neutrality returned 404;
the Revolver, Plague, Lightning Bolt and Enslaved mechanics are fully defined in the card texts themselves.
