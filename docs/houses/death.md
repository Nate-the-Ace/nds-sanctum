# House of Death: card analysis

Site house id 8. Mana: **Mystery** primary, **Will** secondary. Nation: **Keeper** (7 HP, +1 hand damage in combat
round 2; `NATIONS.keeper` already encodes it). Source: `packages/cards/data/houses/death.json` (scraped 2026-10-16).
Vocabulary checked against `packages/cards/src/lang/**` and `packages/engine/src/*` on branch `engine-core`.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 52 |
| Rarity | 17 Common, 18 Uncommon, 13 Rare, 4 Very Rare |
| Expansions | Classic 19, Revolutions 10, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 3 |
| Mana | 142 Mystery + 75 Will over the house; 14 cards cost Mystery only, 1 (Necropolis) Will only; average total 4.2 |
| Classification | **A 11**, **B 24**, **C 13**, **D 4** (section 3) |

Cost curve (total mana):

| Total | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Cards | 4 | 10 | 7 | 12 | 6 | 5 | 3 | 2 | 3 |

Targets (scraped `castOn`): globe 12, minion 5, monster-summon on square (no "Cast on") 5, recruit 4, swordsman 4
(+1 friendly), group 3, friendly recruit group 3, recruit group 2, town or colony 2, square 2, desert 2, monster
group 2, forest 1, town (not colony) 1, friendly group 1, recruit group in desert 1, recruit in desert (ignores
concealment) 1.

### Scrape notes (shared scraper not changed)

| Issue | Cards | Impact |
|---|---|---|
| `castOn: null` | Legion of the Dead, Master Vampire, Sand Sphinx, Skeletal Horror, Skeleton | Not a parse failure: monster cards print no "Cast on"; same convention as Hellion/Sylph/Salamander in `cards.json`. Rule: summon on an empty square. |
| Apostrophe scraped as underscore in name | `Neb_s Mirage` (slug `neb-s-mirage`) | Real name is "Neb's Mirage" (Elements_deckhand lists it). Fix the name by hand when declaring the card. |
| Literal backslash-escaped quotes in flavor (`\'`) | Assassin, Gifts of the Fallen, Neb's Mirage | Display only. |
| Stat line on a non-creature card | Day of the Dead (`H:3 A:0 HP:10 L:1` = the Skeletons it creates), Dark Minion/Keeper Code/Khobai (created recruit), Furies (`HP:12(x3)` = 3 copies) | A scaffolder must not read these as the spell's own creature. |

All 52 cards have name, slug, cost, rarity and text. No extra rules pages were saved: the online rules index
(`/nioga/rules.php`) now serves only the usage agreement, and probing plausible page names (Concepts/tokens, revolvers,
recursive, ...) returned 404. The saved pages cover every Death mechanic except Recursive/Revolver, Drought's stage
chain and "attracts" timing, which are ruled from card text (section 6).

## 2. Theme and mechanics

| Theme | Cards | Mechanics |
|---|---|---|
| Instant death | Venom'd Arrow, Slay Monster, Dehydration, Apocalypse (I, II), Assassin, Dire Portent, Touch of Death, Furies | `Kill`; on-damage kill; start-of-combat kill; hero detection |
| Cheating death | Reanimate, Necromancer, Soul Jar, Gifts of the Fallen | "is dying" cancel (rules E1), group-mother events, leave group + boardhop |
| Profit from death | Khobai, Keeper Code, Master Vampire, Day of the Dead, Curse of Khobai | listening to deaths anywhere / in combat / group deaths |
| Wasting | Body Rot, Plague, Harm Monster, Curse of Khobai, Terrifying Mystery, Haunted Forest, The Withering, Wild Plague | negative grants, max-HP loss, set HP, global damage ticks |
| Desert | Wasteland, Drought, Famine, Sand Sphinx, Dehydration, Harmattan, Sandstorm, Shifting Sands, Neb's Mirage, Bone Chariot | terraform areas (3x3, random, under monster), desert-conditional effects, attract, removal |
| Undead creatures | Skeleton, Skeletal Horror, Legion of the Dead, Day of the Dead, Master Vampire, Sand Sphinx, Furies | monsters, "receives no missile damage", multi-copy groups |
| Mana engine | Cenotaph of Will, Necropolis, Burst of Mystery, Slave Labor, Sacrifice | `mana:generate`, next-turn mana, Afterward |
| Swordsman weapons | Venom'd Blade, Reaper, Garrote of Bes-Kandra, Pyre, Touch of Death | grants, round-scoped grants, round-1 hand attacks |
| Deck tricks | Waste Not, Terrifying Mystery, The Withering | squander event, Recursive, Revolver |

**Nation and flavour that affect stats**

- Keeper recruits (trained by a Death player, and created by Dark Minion, Keeper Code, Khobai) get 7 HP and +1 hand
  damage in round 2 through `NATIONS.keeper`; nothing new needed. Reaper's round-2 group bonus stacks with it.
- `minion.house === 'death'` marks Keepers and every Death monster. Already used by Arboriads (+4 H against Death) and
  Prismatic Serpent (+4 H against Death monsters, Immune to Death individual spells). Haunted Forest exempts Death and
  Abomination minions; Master Vampire gets +1 H against Life; Dire Portent spares the attacker against Elves (nation).
- Khobai prints `HP:1`: `creatureSpec` lets the card's `hp` override the Keeper 7 HP base. Correct.
- Undead (Skeleton, Skeletal Horror, Day of the Dead skeletons) ignore non-magical missile damage before armor; wise
  targeting should rank them last for shooters (Pipelines_combat "Combat Damage (Quasi-)Immunities").

## 3. Classification (all 52 cards)

Class: **A** expressible with today's keywords; **B** small lang addition (keyword, effect, trigger, scope, target);
**C** new engine feature; **D** special/hard. "Type" is my spell-type ruling (not on the scraped page).

| # | Card | Cost | Rar | Type | Text (verbatim) | Cl | Composition / what is missing |
|---|---|---|---|---|---|---|---|
| 1 | Apocalypse | M6 W3 | VR | manifestation | Cast on globe. Every recruit on the board dies. (Recruits that are off the board are not affected.) Only one in play at a time. | A | `Target.globe`, `OnCast(Kill('allRecruits'))` (`allRecruits` already skips off-board). "Only one in play" moot for an instant (ruling 3). |
| 2 | Apocalypse II | M6 W3 | VR | manifestation | (identical to Apocalypse) | A | Same keywords; counts as the same card for the 4-copy deck rule. |
| 3 | Assassin | M2 W2 | U | alteration | Cast on recruit. Recruit gets +1 attack each round. At start of combat, all Heroes in opposing group die. | C | `Grant({attacks:1})`, `On(When.startOfCombat(), Kill('opponentHeroes'))`. Needs **C6** hero flag on `Minion` + new scope `opponentHeroes`. |
| 4 | Body Rot | M1 | C | alteration | Cast on recruit. Recruit gets -1 hand and missile damage. | A | `Target.recruit`, `Grant({hand:-1, missile:-1})`. |
| 5 | Bolstering Spirit | M1 | U | conjuration | Cast on town or colony. While in town, recruits in town get +1 armor. Dispelled after next combat or if town is captured. | C | `Target.structure`, `Grant({armor:1})` (structure spells reach occupants via `computeStats`). Needs `Fleeting` for structure hosts (B) and **C8** capture event/recheck. |
| 6 | Bone Chariot | M1 W1 | C | alteration | Cast on group. Group gains Desertwalk and Firewalk. (...) | A | `Target.group`, `Walk('desert')`, `Walk('fire')`. Near-dup of Caravan (Life). |
| 7 | Burst of Mystery | M2 | C | conjuration | Cast on globe. Caster gets +2 Mystery next turn. | A | `Lasts(2)`, `Stackable()`, `On(When.manaPhase, AddMana('mystery',2))`: the only `mana:generate` inside its life is next turn's. Optional print sugar `NextTurn` (B, shared by 6 Burst cards). |
| 8 | Cenotaph of Will | M4 | C | alteration | Cast on globe. Caster gets +1 Will each turn. May be cast more than once. | A | `Stackable()`, `On(When.manaPhase, AddMana('will',1))`. Same shape as Court Politics II. |
| 9 | Curse of Khobai | M3 W1 | C | alteration | Cast on minion. Minion is lowered to 1 maximum and current hit point. When minion kills an opponent by combat damage, minion gets +1 maximum and current hit point. | C | `Target.minion` (B), trigger `When.onKill` (B, `attacker:kills`), token counter. Needs **C7** "set max HP" stat layer (max = 1 + kills). |
| 10 | Dark Minion | M2 W2 | C | summoning | H:2 A:1 HP:7 L:1 Cast on recruit group. Creates a Keeper swordsman. | A | `Target.recruitGroup`, `Create({name:'Keeper swordsman', cls:'swordsman', nation:'keeper'})`. Like Bard/Dragon's Teeth. |
| 11 | Day of the Dead | M3 W2 | VR | conjuration | H:3 A:0 HP:10 L:1 Nomadic. Cast on globe. After all combat, for every recruit group that died in combat this turn not in a structure, a neutral group of an equal number of Skeletons is created in the recruit group's square. Skeletons receives no missile damage (before checking armor). | C | `Lasts(1)`, `Nomadic()`, Script on `turn:afterCombat` summoning neutral skeleton groups + `NoMissileDamage` helper (B). Needs **C5** `group:dies` event (size, square, in combat). |
| 12 | Dehydration | M2 W1 | C | manifestation | Cast on recruit in desert, even if it is concealed. Recruit dies. | B | `Target.recruit.in('desert')`, new keyword `PiercesConcealment` (sets existing `CardDef.ignoresConcealment`), `OnCast(Kill('target'))`. |
| 13 | Dire Portent | M2 | U | alteration | Cast on minion. When minion damages an opponent, opponent is killed. If opponent is not an Elf, minion dies as well. Dispelled after one use. | B | `Target.minion`; Script on `attacker:damages`: kill victim, kill host unless victim nation `elf`, then `c.dispel()`. Same pattern as Shattering Blow. |
| 14 | Drought | M3 | C | manifestation | Cast on square. Squares in the 3x3 diamond centered on target square get Drought Effect (square changes sequentially from water to swamp to plains to barren land to desert). | B | New area `block3x3` for `GiveSquares`-style placement, helper `drought-effect` (visible) with `On(When.startOfTurn, ...)` stepping terrain (Script or new `Dry` effect). |
| 15 | Famine | M1 W1 | C | conjuration | Cast on globe. At start of turn, one random non-desert square becomes desert. Duration: Turn of casting +4. | B | `Lasts(5)`, `On(When.startOfTurn, Terraform('desert','randomSquare'))`: new terraform area `randomSquare` (excludes desert, structures, Sanctum area). |
| 16 | Furies | M4 W2 | R | summoning | H:2 A:0 HP:12(x3) L:1 Nomadic, Flight. Cast on globe. Creates three Furies in a random square. At start of combat, each Fury kills one random opposing minion, and all Furies in this group are removed from the game, ending combat. | C | `Monster` with `count:3` and random-square placement (B), `Nomadic()`, `Walk('flight')`; Script on `combat:start`: kills, then remove, `endCombat()`. Needs **C1** `ctx.remove`. |
| 17 | Garrote of Bes-Kandra | M2 W1 | C | alteration | Cast on swordsman. Swordsman attacks normally in combat round 1, and gets +3 hand damage in combat round 1 only. | C | `Target.swordsman`; `Grant({hand:3},{round:1})`. Needs **C2**: round visible to stats + "hand attacks in round 1" (engine sets `handLeft = 0` in round 1 and bashers forfeit with no victim). |
| 18 | Ghost Town | M4 W3 | R | alteration | Cast on town (not colony). Town becomes a colony, and cannot be targeted by structure spells. | D | Needs the colony system (backlog E8): `ctx.setStructureKind`, Colony helper (destroyed when dispelled), structure Shroud, target `.town`. |
| 19 | Gifts of the Fallen | M2 W1 | R | alteration | Cast on group. When any member of group dies in combat, all surviving members of its group are fully healed at end of combat. | B | Script on group host: `combat:start` sets token, `minion:dies` (bubbles to group) marks, `combat:end` `Heal('full','hostGroup')`. Simpler once C5 adds `inCombat`. |
| 20 | Harm Monster | M2 W1 | U | manifestation | Cast on monster group. Each member of group is lowered to 1 current hit point. | B | `Target.monsterGroup` (B), new effect `SetHp(1,'targetEach')` (no damage events). |
| 21 | Harmattan | M1 W1 | U | alteration | Cast on friendly group. While group is in desert, each member of group is concealed. (...) | B | `Target.group.friendly`; `Concealed` gated on terrain: new `While(terrain, ...)` or `Concealed({in:['desert']})`. |
| 22 | Haunted Forest | M4 | U | manifestation | Cast on forest. Affects all contiguous forest squares. All minions in squares except Death or Abomination minions get -1 level. | B | Faerie Glade pattern: `OnCast(GiveSquares('haunted-forest-square','forest'))`; helper `Bound('forest')`, `Grant({level:-1},{to:...})` needs new `GrantTo` "except houses". |
| 23 | Keeper Code | M5 W4 | R | alteration | H:2 A:1 HP:7 L:1 Cast on globe. Each time an enemy recruit dies outside of combat, one Keeper swordsman is created in caster's Sanctum. (If the recruit cannot be created this turn, it is lost.) | C | Globe Script on `minion:dies` (globe sees all) + `createRecruit(sanctum, keeper swordsman)` (Incarnate pattern). Needs **C5** `inCombat` on death events. |
| 24 | Khobai | M4 W4 | R | hero | H:2 A:1 HP:1 L:2 Cast on recruit group. Creates Khobai, a Keeper Hero swordsman. Each time a minion dies, Khobai heals 1 hit point. If undamaged, Khobai also gets +1 maximum hit point. (Each Hero may be cast only once per game.) | C | `Hero()`, `Create({name:'Khobai', cls:'swordsman', nation:'keeper', hp:1, level:2},{with:['khobai-soul']})`; helper with token-driven `maxHp`. Needs **C4**: a minion-hosted spell must hear every `minion:dies` (today only globe spells do). |
| 25 | Legion of the Dead | M5 W3 | R | summoning | H:2 A:0 HP:4(x8) L:0 Nomadic. Creates eight Undead Warriors. | B | `Target.square`, `Nomadic()`, `Monster(def,{count:8})`: `Monster` lacks `count` (Ambush has it). |
| 26 | Master Vampire | M5 W2 | R | summoning | H:3(x2) A:1 HP:12 L:2 Territorial. Two attacks. Gets +1 hand damage against Life minions. At end of combat, if Master Vampire survives and an opposing recruit died, one Vampire (H:3 A:0 HP:5 L:1 Territorial) is created in group. | B | `Territorial()`, `Monster({hand:3, handAttacks:2, armor:1, hp:12, level:2})`, `Against(['life'],{hand:1})`, Script: count opposing recruits at `combat:start`, at `combat:end` `addMinion` a Vampire if fewer. |
| 27 | Neb's Mirage | M2 W2 | U | alteration | Cast on desert. Square attracts non-neutral player-controlled groups. (Groups adjacent to attracting squares before movement must move toward one of them.) Dispelled when entered. | B | `Target.square.on('desert')`, `Bound('desert')`, new keyword `Attract` (extract Undine's `attract`), `On(When.enter(), Expend())`. |
| 28 | Necromancer | M3 W2 | R | alteration | Cast on recruit. Recruit will resurrect every other member of its group once each. When any other member of recruit's group is dying, the dying recruit returns to life, is fully healed, has all individual spells dispelled, and gets -2 maximum hit points (cumulative). | C | Script on `minion:dying`: `cancel()`, dispel individual spells (B effect), Give non-visible `-2 HP` helper, heal full, token per minion id. Needs **C3**: group-mother events (another member's `minion:dying` does not reach a spell on the Necromancer today). |
| 29 | Necropolis | W5 | R | alteration | Cast on town or colony. Necropolis generates +2 Mystery for town owner each turn. | A | `Target.structure`, `On(When.manaPhase, AddMana('mystery',2,'structureOwner'))`. |
| 30 | Plague | M3 W2 | U | manifestation | Cast on group. Every member of group gets -2 maximum hit points, and then takes two hit points of damage. | A | `OnCast(Give('plague-wasting','targetEach'), Damage(2,'targetEach'))`; helper `Undispellable()`, `Grant({maxHp:-2})`. `createSpell` syncs HP before the damage, so the order is right (Field Surgery pattern). |
| 31 | Pyre | M3 W1 | VR | alteration | Cast on swordsman. Dispels all individual spells on swordsman. Swordsman gets +1 hand damage for each spell dispelled. | B | Script: on cast dispel visible individual spells except itself (it is already recorded), store count in token; `stats` hand = token. Shares the "dispel individual" effect with Winnowing Sigil. |
| 32 | Raven Shroud | M3 W3 | R | alteration | Cast on friendly recruit group. Group cannot be targeted by enemy group spells. | B | `Target.recruitGroup.friendly`, `Shroud({from:['group'], against:'enemy'})`: `Shroud` only has `against:'friendly'`; add `'enemy'`. |
| 33 | Reanimate | M2 W2 | U | alteration | Cast on minion. When minion is dying, minion returns to life, and is fully healed. Dispelled after one use. | B | `Target.minion`, new trigger `When.dying` (`minion:dying`, host only), new effect `Revive` (heal full + `cancel()`), `Expend()`. Engine already supports dying-cancel. |
| 34 | Reaper | M1 W1 | C | alteration | Cast on swordsman. Swordsman gets +1 hand damage. Swordsmen in its group (including itself) get +1 hand damage in combat round 2 only. | C | `Grant({hand:1})` + helper with `Aura({hand:1},{to:'swordsmen', self:{hand:1}})` gated to round 2. Needs **C2** round in stats (Aura cannot share a card with Grant, so a helper). |
| 35 | Sacrifice | M3 | R | manifestation | Cast on friendly recruit group. Group is removed from the game. For each recruit in group, caster gets +2 Mystery next turn. | C | `Target.recruitGroup.friendly`; Script: count recruits, create next-turn mana helper on globe with token amount, remove each. Needs **C1** `ctx.remove`. |
| 36 | Sand Sphinx | M3 W2 | C | summoning | H:2 A:1 HP:12 L:1 Nomadic, Desertwalk. Target square becomes desert. Sand Sphinx seeks opponent's Sanctum. After Sand Sphinx moves, its new square becomes desert. (...) | B | `Monster({..., walks:['desert']})`, `OnCast(Terraform('desert'))`, new bot keyword `SeeksSanctum` (replaces Nomadic movement), `On(When.moves, Terraform('desert','hostSquare'))`: new area `hostSquare`. Like Salamander + Ngozi's Blight. |
| 37 | Sandstorm | M3 W2 | U | conjuration | Cast on recruit group in desert. On turn of casting only, group's movement orders are cancelled, and all members of group take 1 hit point of damage. All members of group are concealed from both players. Duration: Turn of casting +1. (...) | B | `Target.recruitGroup.in('desert')`, `Lasts(2)`, `OnCast(CancelMove('target'), Damage(1,'targetEach'))` (`CancelMoves` cancels every group: add a target-only variant), `Shroud({from:['individual']})` = concealed from both. |
| 38 | Shifting Sands | M2 W1 | C | alteration | Cast on desert. Before combat, each minion in square has 50% chance to be removed from the game, unless it has Desertwalk or Flight. (This does not set off any death-triggered effects.) | C | `Target.square.on('desert')`, `Bound('desert')`, Script on `combat:before` (untargeted, reaches square spells). Needs **C1** `ctx.remove`. |
| 39 | Skeletal Horror | M5 W2 | U | summoning | H:4 A:0 HP:15 L:2 Territorial, Mountainwalk. Receives no missile damage (before checking armor). | B | `Territorial()`, `Monster({..., walks:['mountain']})`, new keyword `NoMissileDamage` (`attack:beforeArmor`, kind missile, non-magical: damage 0). |
| 40 | Skeleton | M3 W1 | U | summoning | H:3 A:0 HP:10 L:1 Nomadic. Receives no missile damage (before checking armor). | B | `Nomadic()`, `Monster(...)`, `NoMissileDamage()`. |
| 41 | Slave Labor | M3 W3 | U | conjuration | Cast on globe. Caster cannot cast any group or individual spells. Duration: Turn of casting +1. On expiration, Slave Labor II (caster gets +1 Mystery and +1 Will each turn) is cast on the globe. May be cast more than once. | A | `Lasts(2)`, `Stackable()`, `Forbid(['group','individual'],{by:'caster'})`, `Afterward('slave-labor-ii')`; helper `Stackable()`, `On(When.manaPhase, AddMana('mystery',1), AddMana('will',1))`. Court Politics clone. |
| 42 | Slay Monster | M4 | U | manifestation | Cast on monster group. Monster group dies. | B | `Target.monsterGroup` (builder missing), `OnCast(Kill('targetEach'))`. |
| 43 | Soul Jar | M3 W1 | U | alteration | Cast on friendly recruit group. During combat, when any recruit in group is dying, recruit disappears, is fully healed, and has all group and individual spells dispelled, and Soul Jar is dispelled. (New group reappears at start of turn if its square is unoccupied, or on the earliest turn thereafter.) | D | Needs leave-group (`ctx.split`, Concepts_leavesgroup), boardhop with exit square and auto-return (backlog E6), dying-cancel. |
| 44 | Terrifying Mystery | M2 | R | alteration | Cast on recruit. Recruit gets -T hand and missile damage, where T is the number of tokens. Recursive (...) | D | Needs Recursive (backlog E10): per-card-instance tokens in hand, copy into hand with cost +1. Grant part is trivial once T is known. |
| 45 | The Withering | M1 | R | conjuration | Cast on globe. At start of turn, all minions on the board take 1 hit point of damage. (...) Duration: M turns. Revolver (...) | D | `On(When.startOfTurn, Damage(1,'allBoard'))` exists; needs Revolver (cost changes per turn in hand) and a duration taken from the cost paid. |
| 46 | Touch of Death | M4 W2 | U | conjuration | Cast on friendly swordsman. When swordsman damages an opponent, opponent is killed. When Touch of Death expires, swordsman dies. Duration: Turn of casting +2. | B | `Target.swordsman.friendly`, `Lasts(3)`, `On(When.onDamage(), Kill('victim'))`, new `OnExpire(Kill('host'))` (today only `Afterward` uses `onExpire`). |
| 47 | Venom'd Arrow | M3 W1 | C | manifestation | Cast on minion. Minion dies. | B | `Target.minion` (builder missing), `OnCast(Kill('target'))`. |
| 48 | Venom'd Blade | M2 | C | alteration | Cast on swordsman. Swordsman gets +2 hand damage. | A | `Target.swordsman`, `Grant({hand:2})`. Exact dup of Flaming Sword (War). |
| 49 | Waste Not | M1 W1 | U | alteration | Cast on globe. When any spell is squandered, a copy of that spell is randomly inserted into its caster's deck. | C | Needs **C9** `spell:squandered` event + `ctx.insertIntoDeck(side, cardId, 'random')`. |
| 50 | Wasteland | M3 W3 | C | manifestation | Cast on square. The 3x3 diamond centered on square becomes desert. (...) | B | `OnCast(Terraform('desert','block3x3'))`: new area. |
| 51 | Wild Plague | M1 | U | alteration | Cast on globe. At start of turn, every monster on the board takes 1 hit point of damage. (...) May be cast more than once. | B | `Stackable()`, `On(When.startOfTurn, Damage(1,'allMonsters'))`: new scope. |
| 52 | Winnowing Sigil | M2 | C | manifestation | Cast on minion. Dispels all individual spells on minion. | B | `Target.minion`, new effect `DispelIndividual` (today `DispelAll` handles group targets only). |

**Near-duplicates of implemented cards:** Venom'd Blade = Flaming Sword; Bone Chariot = Caravan + Firewalk; Slave
Labor / II = Court Politics / II (Will+Mystery instead of Clarity); Cenotaph of Will = Court Politics II shape; Venom'd
Arrow ~ Good of the Many; Plague ~ Field Surgery (helper then effect); Haunted Forest ~ Faerie Glade (`GiveSquares` +
`Bound('forest')` + level -1); Neb's Mirage ~ Undine's attract; Sand Sphinx ~ Salamander + Ngozi's Blight; Dire
Portent / Touch of Death ~ Shattering Blow; Apocalypse ~ Elixir Vitae (`allRecruits`); Wild Plague ~ Healing Hands
(start-of-turn tick); Harmattan ~ Greymantle (Concealed); Dark Minion ~ Bard/Dragon's Teeth (`Create`).

## 4. Features needed, and what each unlocks

### Lang layer (B), cheapest first

| Id | Feature | Cards unlocked (Death) |
|---|---|---|
| L1 | `Target.minion`, `Target.monster`, `Target.monsterGroup` builders (+`printTarget` already handles the nouns) | Venom'd Arrow, Winnowing Sigil, Slay Monster, Harm Monster, Dire Portent, Reanimate, Curse of Khobai (7) |
| L2 | Terraform areas `block3x3`, `randomSquare`, `hostSquare` (+ a `GiveSquares` that takes an area) | Wasteland, Drought, Famine, Sand Sphinx (4) |
| L3 | Effect `DispelIndividual` (visible individual spells on a minion; option to skip self) | Winnowing Sigil, Pyre, Necromancer (3) |
| L4 | Keyword `NoMissileDamage` (non-magical missile: 0 before armor; wise-targeting tiebreak) | Skeleton, Skeletal Horror, Day of the Dead skeletons (3) |
| L5 | Trigger `When.dying` + effect `Revive` (heal full, cancel dying) | Reanimate; reused by Necromancer, Soul Jar (3) |
| L6 | `Monster` options: `count`, `square: 'random'` | Legion of the Dead, Furies (2) |
| L7 | Scopes `allMonsters`, `opponentHeroes` | Wild Plague, Assassin (2) |
| L8 | Effect `SetHp(n)` ("lowered to n current hit points") | Harm Monster (Curse of Khobai uses the C7 layer) (1) |
| L9 | `PiercesConcealment` keyword (sets `ignoresConcealment`) | Dehydration (1) |
| L10 | `Shroud({against:'enemy'})` | Raven Shroud (1) |
| L11 | Terrain-gated grant (`While('desert', Concealed())` or `Concealed({in})`) | Harmattan (1) |
| L12 | `GrantTo` "except houses" | Haunted Forest (1) |
| L13 | `OnExpire(...effects)` keyword | Touch of Death (1) |
| L14 | Effect `CancelMove('target')` | Sandstorm (1) |
| L15 | Trigger `When.onKill` (`attacker:kills`) | Curse of Khobai (1) |
| L16 | Keyword `Attract` (extracted from Undine) | Neb's Mirage (1; also Mirage, Siren Song) |
| L17 | Bot keyword `SeeksSanctum` | Sand Sphinx (1) |
| L18 | `Fleeting` on structure hosts | Bolstering Spirit (with C8) |
| L19 | Print sugar `NextTurn` for "next turn" mana | Burst of Mystery, Sacrifice (cosmetic) |
| S | Script one-offs (no new vocabulary) | Dire Portent, Gifts of the Fallen, Master Vampire, Pyre, Drought helper |

### Engine (C)

| Id | Feature | Exact change | Cards (Death) |
|---|---|---|---|
| C1 | Remove from game | `ctx.remove(minionId)` = `killMinion(e,id,null,'removed')` (skips E1/E2); plus random empty legal square helper for summons | Furies, Sacrifice, Shifting Sands (3) |
| C2 | Combat round in stats; round-1 hand attacks | `state.combatRound` (null outside combat) readable from `QueryContext`, `Grant({..},{round})`; `StatDelta.handInRound1`: `startRound` keeps `handLeft`, victim chosen wisely in round 1 | Garrote of Bes-Kandra, Reaper (2) |
| C3 | Group-mother events | `chain()` for a minion ref also visits spells on other members of the same group whose card sets `groupEvents: true` | Necromancer (1) |
| C4 | Global minion-event subscription | `CardDef.hears?: EventType[]`: a minion-hosted spell also receives that event for any minion (dispatch adds them after the bubble chain) | Khobai (1) |
| C5 | Death context | `inCombat` on `minion:dying/dies/killed` data; new `group:dies` event (pos, size at combat start, inCombat) fired from `removeGroup` | Keeper Code, Day of the Dead (2; simplifies Gifts of the Fallen) |
| C6 | Hero marker | `Minion.hero` / `MinionSpec.hero`, set by `Create` on `type: 'hero'` cards | Assassin (1) |
| C7 | Stat "set" layer | `StatDelta.maxHpSet` (applied after all deltas) or `ctx.setBase` | Curse of Khobai (1) |
| C8 | Capture hook | dispatch `structure:captured` (or `recheck` the structure) in `beginTurn` capture loop | Bolstering Spirit (1) |
| C9 | Squander hook + deck insert | dispatch `spell:squandered` {caster, cardId} in `executeCast`; `ctx.insertIntoDeck(side, cardId, 'random'|'top'|'bottom')` | Waste Not (1) |

### Special (D)

| Card | Blocker | Backlog |
|---|---|---|
| Ghost Town | colonies: Colony helper, structure kind change, structure destruction, structure-target Shroud | E8 |
| Soul Jar | minion leaves group (new group, overstack/unstack), boardhop with exit square and start-of-turn return | E6 |
| Terrifying Mystery | Recursive: tokens on a card instance in hand, copy into hand at cost +1 | E10 |
| The Withering | Revolver: hand-instance cost that changes each turn; duration = cost paid | E10-like |

## 5. Shared mechanics (other houses will need these too)

Counts from all scraped houses + `cards.json` (phrase hits, may include false positives).

| Mechanic | Death cards | Other cards (examples) | Feature |
|---|---|---|---|
| Removed from the game | Furies, Sacrifice, Shifting Sands | ~17 others: Implosion, Cessao Spiral, Ascension, Exile, Tindelhunden, Dryad's Favors, Jumping Land, Encampment... | C1 |
| Random square | Famine, Furies | ~22 others: Fiend, Lode Star, Tornado, Bolt of Somersaults, Lava Flow, Defensive Pact... | L2/C1 helper |
| Desert / terrain areas | 10 cards | Oasis, Caravan, Undine, Priodont, Blight, Mirage, Illender, Changing Lands; "3x3" Savannah, Seed on the Wind | L2 |
| Attracts | Neb's Mirage | Mirage (Mind), Siren Song (Despair), Undine (Life, done ad hoc) | L16 |
| "is dying" / return to life | Reanimate, Necromancer, Soul Jar | Larval Imp, Slavers, Zana's Escape, Ergotism | L5 |
| No missile damage | Skeleton, Skeletal Horror, Day of the Dead | Mark of Ulanoth, Dracha's Sphere, Ill Winds | L4 |
| "lowered to" / max-HP set | Harm Monster, Curse of Khobai | Salted Wounds, Atrophy, Mitosis | L8, C7 |
| Squander hook | Waste Not | Adriel's Promise, Individualism, Intercession, Gilt, Unstable Magick, Orrery | C9 |
| Next-turn mana | Burst of Mystery, Sacrifice | Burst of Will/World/Clarity/Order/Strife, Book of War, Syzygy, Dracha's Trade | L19 |
| Recursive | Terrifying Mystery | Worldwalking, Pinnacle of Order, Purity of Will, Greater Clarity, Growing Strife | E10 |
| Revolver | The Withering | Fiend, Hand of Zana, Toy Factory, Biting Wind, Gyre | E10-like |
| Only one in play | Apocalypse (I, II) | Shapeshifter, Shield of Vela, Orrery, Belvario's Horn, The Unmagicking... | new `OnlyOne` keyword (blocksCast on own card id) |
| Round-scoped bonuses / round-1 hand | Garrote, Reaper | Rangefinder, Fusillade, Straight-Arrow | C2 |
| Group mothers | Necromancer, Reaper | Mask of Woad, Empathy, Leadership, Obeisance, Bellwether, Pixie Dust, Chaos Fog, Warlord | C3 (events), Aura (stats, done) |
| Neutral groups created | Day of the Dead | Rogue Monster, Cessao Rift, Devolution, Renegades | `summon({owner:'neutral'})` exists |
| Colonies / structure change | Ghost Town, Bolstering Spirit, Necropolis | E8 cards; dozens of "town or colony" structure spells | E8, C8 |
| Disappears / boardhop | Soul Jar | Vision Quest, Zana's Escape, Lost Mine, Awaiting, Will o' the Wisp, Faerie Circle, Seelie Court | E6 |
| Hero detection | Assassin | (only Death so far) | C6 |

## 6. Rules ambiguities and rulings

| # | Question | Ruling |
|---|---|---|
| 1 | "3x3 diamond" (Wasteland, Drought) | The 3x3 grid block (9 squares) around the target: the board is drawn rotated 45 degrees, and Concepts_mothers says "the 9 squares in a 3x3 diamond". Structures and Sanctum squares are skipped (`setTerrain` already refuses them). |
| 2 | Monster cards with no "Cast on" | Cast on an empty square (as Hellion, Sylph). |
| 3 | "Only one in play at a time" on an instant (Apocalypse) | A second Apocalypse (either version) in the same turn squanders; harmless either way. Implement later with the shared `OnlyOne` keyword. |
| 4 | Apocalypse vs death triggers | Kills every on-board recruit as a "dies" death in list order; recruits created by death triggers during it (Keeper Code) survive. |
| 5 | "Next turn" mana (Burst, Sacrifice) | Paid at the next `mana:generate` (start of next turn). Bursts are cumulative (`Stackable`). |
| 6 | Day of the Dead scope | A conjuration for the casting turn only (`Lasts(1)`). A group "died in combat" if its last member died during the combat phase (any death category but removed). "Equal number" = members at the start of its last combat. The skeleton group is neutral, computer-controlled, Nomadic; skipped if the square holds a structure or is occupied. |
| 7 | Kills from Dire Portent, Touch of Death, Assassin, Furies | Instant "dies" deaths (no experience), following the Shattering Blow ruling. |
| 8 | Dire Portent "Elf" | Victim's nation is `elf`; monsters never count. Both kills happen, then the spell dispels. |
| 9 | Touch of Death when dispelled early | Swordsman survives: only expiry kills it (`onExpire` is not run by dispel). Friendly is persistent (Elements_spells lists it). |
| 10 | Curse of Khobai layering | Max HP is set to 1 + kills after all other modifiers; current HP is lowered to match on cast and +1 per kill. |
| 11 | Harm Monster | Sets current HP to 1 without damage events; a minion already at 1 is unchanged; nobody dies. |
| 12 | Plague | -2 max HP is permanent on each member at cast time (non-visible helper: not dispellable, does not reach later joiners), then 2 magical damage; minimum max HP 1. |
| 13 | Haunted Forest | Target forest square must be empty (engine square rule, as Faerie Glade). Helpers are `Bound('forest')`. Exemption by `minion.house` (death, abomination); nationless recruits are not exempt. |
| 14 | Harmattan | "Friendly" is casting-time only (Elements_spells). Concealment applies only while the group stands in desert. |
| 15 | Raven Shroud | Blocks enemy group spells only; friendly is persistent (dispels on ownership change). Engine-cast helpers ignore it (Elements_spells "Ignores blocking"). |
| 16 | Sandstorm | "Concealed from both players" = no individual spells from anyone (Shroud on the group); cancel and 1 damage happen on cast only; only the target group's orders are cancelled. |
| 17 | Shifting Sands | Permanent square alteration while the square is desert; at `combat:before` each minion there rolls 50% unless it has Desertwalk or Flight; removal fires no death triggers. |
| 18 | Neb's Mirage | Attracts groups adjacent to the mirage square only; "non-neutral player-controlled" includes the caster's own groups. A group with no legal step into it keeps its order; several attractors: pick one at random. Dispelled when any group enters; `Bound('desert')`. |
| 19 | Necromancer | Each other member is revived at most once (tracked by minion id, including later joiners). The revived recruit loses its visible individual spells, then gets a non-visible cumulative -2 max HP helper, then heals fully. The Necromancer host itself is never revived. |
| 20 | Khobai | "Each time a minion dies" = any minion anywhere (kills or dies, not removed). If at full HP when it happens: +1 max and +1 current; otherwise heal 1. |
| 21 | Keeper Code | "Enemy" = owned by the caster's opponent; "outside of combat" = not during the combat phase; removed-from-game does not count. Swordsman via `createRecruit` on the caster's Sanctum; lost if blocked. |
| 22 | Assassin | `+1 attack each round` = `Grant({attacks:1})`. At the start of every combat the host's group fights, every Hero in the opposing group dies. |
| 23 | Garrote | One hand attack in round 1 at +3 (the -1 missile-round penalty does not apply to hand damage); normal from round 2. |
| 24 | Reaper | Host +1 H always; in round 2 every swordsman in its group, host included, +1 H more (host +2 in round 2). Follows the host between groups (group mother). |
| 25 | Gifts of the Fallen | Any member death during the group's combat (not removed) triggers a full heal of survivors at that combat's end. |
| 26 | Bolstering Spirit | "Recruits in town" = recruits standing on the structure square, any owner. Dispels after the first combat fought by a group in the town, or at capture. |
| 27 | Wild Plague, The Withering | Magical damage, on-board only. The Withering: M = mana paid; damages at M starts of turn after casting (`Lasts(M+1)`). Revolver cost = 1 + (turns held mod 10). |
| 28 | Terrifying Mystery | T starts at 1; the hand copy costs +1 Mystery (primary) and has T+1. |
| 29 | Waste Not | Exclusive (no "more than once"). Copies of any player's squandered spells go into that spell's caster's deck at a random position; copies are game-only. |
| 30 | Sacrifice | Recruits counted at execution; group removed (no death triggers, so no Keeper Code or Khobai). |
| 31 | Furies | Summoned on a random empty legal square (not Sanctum area, no structure). At the first combat each Fury kills one random opposing minion, then all Furies are removed and that combat ends. |
| 32 | Sand Sphinx | Caster-owned, computer-controlled monster stepping toward the nearest entrance of the opponent's Sanctum; fights what it meets; desert on cast and after each move. |
| 33 | Dark Minion | Any recruit group, enemy included (the swordsman joins that group's owner); squanders when full. |
| 34 | Master Vampire | "An opposing recruit died" = fewer living recruits in the opposing group at `combat:end` than at `combat:start`. The Vampire joins only if the group has room (max 8). |
| 35 | Ghost Town | Town becomes colony with a Colony helper; Shroud against structure spells; persistent "not colony"-turned-town check dispels it (Auberol's Grace). |
| 36 | Dehydration | Ignores concealment (desert gives none, but Harmattan/Fog of War do). |
| 37 | Drought chain | Each Drought Effect square steps one stage per start of turn: water, swamp, plains, barren, desert; other terrains unaffected; the effect ends on reaching desert or leaving the chain. |
| 38 | Famine | Picks among cells that are not desert, not structures, not Sanctum area; `Lasts(5)`. |
| 39 | Pyre | Counts only visible individual spells other than Pyre; Pyre remains as a dispellable alteration holding +N H. |
| 40 | Venom'd Arrow, Slay Monster | Respect concealment (Venom'd Arrow); Slay Monster is a "dies" for every member. |

## 7. Proposed implementation order (cheapest first)

| Task | Content | Cards | Running total |
|---|---|---|---|
| T1 | Declare the 11 A cards (+ helpers plague-wasting, slave-labor-ii) | Apocalypse, Apocalypse II, Body Rot, Bone Chariot, Burst of Mystery, Cenotaph of Will, Dark Minion, Necropolis, Plague, Slave Labor, Venom'd Blade | 11 |
| T2 | Lang batch: L1, L3, L5, L7 (`allMonsters`), L8, L9, L10, L11, L12, L13, L14 + Scripts | Venom'd Arrow, Slay Monster, Harm Monster, Winnowing Sigil, Dehydration, Raven Shroud, Haunted Forest, Harmattan, Sandstorm, Touch of Death, Reanimate, Wild Plague, Dire Portent, Pyre, Gifts of the Fallen | 26 |
| T3 | Creature batch: L4, L6 (`count`), L17, `hostSquare` | Legion of the Dead, Skeleton, Skeletal Horror, Sand Sphinx, Master Vampire | 31 |
| T4 | Terrain batch: L2 (`block3x3`, `randomSquare`), Drought helper, L16 `Attract` (refactor Undine) | Wasteland, Famine, Drought, Neb's Mirage | 35 |
| T5 | C1 `ctx.remove` + random square summon | Furies, Sacrifice, Shifting Sands | 38 |
| T6 | C2 combat round in stats + round-1 hand attacks | Reaper, Garrote of Bes-Kandra | 40 |
| T7 | C5 death context (`inCombat`, `group:dies`) | Keeper Code, Day of the Dead | 42 |
| T8 | C3 group-mother events, C4 global subscription | Necromancer, Khobai | 44 |
| T9 | C6 hero flag, C7 stat set layer, C8 capture hook, C9 squander hook | Assassin, Curse of Khobai, Bolstering Spirit, Waste Not | 48 |
| T10 | D with shared backlog: E10 (Recursive, Revolver), E8 (colonies), E6 (leave group + boardhop) | Terrifying Mystery, The Withering, Ghost Town, Soul Jar | 52 |

Top features by Death cards unlocked: L1 target builders (7), L2 terraform areas (4), C1 remove from game (3),
L3 dispel individual (3), L4 NoMissileDamage (3), L5 dying/Revive (3).

## 8. Risks

| Risk | Detail | Mitigation |
|---|---|---|
| Kills inside the attack pipeline | Dire Portent/Touch of Death kill the victim (and maybe the attacker) inside `attacker:damages`; `attack()` re-checks `v.status` and `buried()` afterwards. | Tests with both deaths, experience not granted, Reanimate on the victim. |
| Dying-cancel during combat | Reanimate/Necromancer revive a minion mid-attack; `killMinion` only cancels when HP > 0, so `Revive` must heal before `cancel()`. | Order inside the effect; test with Gifts of the Fallen in the same group. |
| Event-chain changes (C3, C4) | Changing `chain()` alters handler order for every existing card. | Opt-in flags (`groupEvents`, `hears`) so untouched cards see no change; run the War/Life suites. |
| Stat layers (C2, C7) | Round-aware stats and a "set" layer touch `computeStats`, used everywhere (wise targeting, UI). | Keep the round in state, cleared after combat; apply the set layer last and test with Veteran/Elixir. |
| Desert density | Ten desert cards: Famine/Drought/Wasteland can carpet the board, and desert damages Keepers too (no innate Desertwalk). | Balance note only; Bone Chariot is the house's answer. |
| Removal vs off-board and combat | Furies' removal plus `endCombat` while `fight()` loops; Shifting Sands at `combat:before`. | `fight()` already rechecks `stillHostile`; add tests. |
| Mass death ordering | Apocalypse with Keeper Code, Khobai, Necromancer, Reanimate all reacting. | Kill a precomputed list; document ruling 4. |
| Token maps as state | Day of the Dead/Master Vampire need per-group records; tokens are `Record<string, number>`. | C5 removes the need for Day of the Dead; key tokens by id for the rest. |
