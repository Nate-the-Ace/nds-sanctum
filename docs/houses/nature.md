# House of Nature: card analysis

House id 4 on the site. Mana: **World** primary, **Order** secondary. Nation: **Satyr** (7 HP, +1 missile damage in
combat round 1; already in `packages/engine/src/nations.ts` as `combat: 'missile1'`). Source data:
`packages/cards/data/houses/nature.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs nature --per-house`).
Classes: **A** = existing keywords only; **B** = small lang addition (new keyword/effect/trigger/scope, or a `Script`
using only existing `ctx`); **C** = new engine feature; **D** = special/hard.

## 1. Summary

| | |
|---|---|
| Cards | 51 (all fields present except `castOn` on 5 creature cards, see section 9) |
| Rarity | Common 17, Uncommon 17, Rare 14, Very Rare 3 |
| Expansion | Classic 19, Revolutions 11, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 1 |
| Spell types (inferred) | manifestation 16, alteration 18, summoning 10, conjuration 6, hero 1 |
| Classes | **A 12, B 25, C 13, D 1** |

Cost curve (World + Order total; Biting Wind counted at its base 1):

| Total | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Cards | 5 | 6 | 7 | 11 | 6 | 6 | 2 | 3 | 4 | 1 |

Target mix: square 10, forest 5, globe 6, minion 5 (one ignores concealment), archer 4, recruit 3, recruit group 6,
group 2, town/colony 4, creature cards with no "Cast on" 5 (summoned on a square).

## 2. Theme and mechanics

| Theme | Cards | Notes |
|---|---|---|
| Terraforming (forest, water, ice, barren, plains, random) | Forestation, Seed on the Wind, Inundate, Overflow, Deluge, Water's Gift, Tornado, Earthquake, Abatement, Geomancy, Uproot, Jade Dragon, Icecaps | Biggest theme. Water creation drowns at once (engine `setTerrain` -> `checkFatal`). Forest = concealment (engine `isConcealed`). |
| Archer support (Satyr = archer nation) | Straight-Arrow, Fusillade, Druid, Watersniper, Karillian Arrows, Eagle Eyes, Ill Winds (anti-archer) | Several are round-1 effects stacking with the Satyr round-1 bonus and the round-1 -1 missile penalty. |
| Forest monsters | Tree Man, Wolf Pack, Uproot, Huntsman, Primeval Forest | "Cast on forest" = `Target.square.on('forest')`. |
| Spell denial / dispel | Abatement, Back to Nature, Natural Order, Stone Circle, Woodhenge, Bellwether, Druid | Area dispels and square-wide untargetability are new. |
| Weather / area damage | Hailstorm, Earthquake, Lightning Bolt, Biting Wind, Gale Force | |
| Control / tempo | Unseelie Howl, Smell the Roses, Will o' the Wisp, Gale Force, Dryad's Favors | |
| Mana / cost | Sign of Order, World Dance, Druid, Syzygy, Biting Wind (revolver) | Syzygy and Revolver need a cost hook. |
| Fae / neutral creatures | Goldcaps, Icecaps, Pixie Dust, Diomesia, Revelers, Protective Cover | |

## 3. Classification (all 51 cards)

Cost `W/O` = World/Order. Proposed keyword composition uses the names in `packages/cards/src/lang`. New parts in
**bold**.

| Card | Cost W/O | Rarity | Card text (scraped, abridged only where marked ...) | Type | Class | Composition / what is missing |
|---|---|---|---|---|---|---|
| Abatement | 2/2 | U | Cast on square. Dispels all spells on square. Square becomes plains. | manif. | B | `Target.square`, `OnCast(`**`DispelAll('square')`**`, Terraform('plains'))`. `DispelAll` only handles group targets today. |
| Back to Nature | 4/3 | U | Cast on globe. Dispels all spells on globe. | manif. | B | `Target.globe`, `OnCast(`**`DispelAll('globe')`**`)`. |
| Barkskin | 1/0 | C | Cast on minion. Minion gets +1 armor. May be cast more than once on the same minion. | alt. | A | `{type:'minion'}`, `Stackable(), Grant({armor:1})`. (A `Target.minion` builder is a 1-line nicety.) |
| Bellwether | 4/2 | R | H:0(x0) A:0 HP:10 L:0. Cast on recruit group. Creates Pacified Cow, a Satyr swordsman. It does not attack. Its group cannot be targeted by enemy group spells, and cannot join other groups or add any new recruits. | summ. | C | `Target.recruitGroup`, `Create({name:'Pacified Cow',cls:'swordsman',nation:'satyr',hand:0,handAttacks:0,armor:0,hp:10,level:0},{with:['bellwether-cow']})`; helper: `Shroud({from:['group'],`**`against:'enemy'`**`})` + **group lock** (engine: no join, no new recruits). Near-duplicate of Decoy (War). |
| Biting Wind | 1/0 base | R | Cast on minion, even if it is concealed. Minion takes 2*M points of damage. Revolver (cost M revolves 1..10, +1 per turn, restarts at 1 after 10, until cast). | manif. | D | `{type:'minion'}`, **`Piercing()`** (sets existing `ignoresConcealment`), **`Revolver()`** + **damage scaled by current M**. Needs per-card-instance state in hand (hand is `string[]`) and a dynamic cost read by `validateOrders` and the UI. |
| Deluge | 4/4 | R | Cast on globe. Affects all non-water squares adjacent to water squares. Affected squares become water for current turn +1, then change from water to plains. Duration: Turn of casting +1. | conj. | B | `Target.globe`, `OnCast(`**`Terraform('water','besideTerrain','water')`**` + `**`GiveSquares`-style helper per square**`)`; helper `Lasts(2)` + **`onExpire` Terraform('plains') on its own square** (`Afterward` only casts on the globe). Snapshot squares at cast. |
| Diomesia | 4/4 | R | H:0 A:0 HP:7 L:2. Cast on recruit group. Creates Diomesia, a Satyr Hero swordswoman. All swordsmen in her group and any opposing group do not deal hand damage. (Hero.) | hero | B | `Target.recruitGroup`, `Hero(), Create({name:'Diomesia',cls:'swordsman',nation:'satyr',hand:0,armor:0,level:2},{with:['diomesia-aura','diomesia-trance-giver']})`; aura helper `Aura({hand:-99},{to:'swordsmen'})` (hand clamps at 0); second helper `On(When.startOfCombat(), Give('diomesia-trance','opponent'))`; trance helper `Grant({hand:-99},{to:'swordsmen'})` + **`UntilCombatEnd()`** (Fleeting for a minion host). Near-duplicate of Lienna (Life). |
| Druid | 2/2 | U | Cast on archer. Archer gets +1 missile damage, and cannot be targeted by individual Abomination or Mind spells. If archer's group is in forest, Druid generates +1 World for group owner each turn. | alt. | B | `Target.archer`, `Grant({missile:1}), Immune(['abomination','mind']), On(When.manaPhase, `**`AddMana('world',1,'hostOwner')`**` `**`.if(inTerrain('forest'))`**`)`. |
| Dryad's Favors | 3/1 | U | Cast on recruit. Recruit is removed from the game. At start of turn of casting +3, one new recruit of the same nation and class is created in square. (Group is created if square is unoccupied, or on the earliest turn thereafter.) | manif. | C | **`ctx.remove(minionId)`** (death category `removed`; `ctx.kill` is `dies`). Then a non-visible globe helper holding tokens (turn, x, y, owner, class, nation index) that on `turn:start` from T+3 calls `ctx.summon` with a player-controlled recruit when the square has no group. |
| Eagle Eyes | 4/2 | U | Cast on friendly recruit. All friendly archers in squares adjacent to recruit get +1 missile damage. | alt. | C | `Target.recruit.friendly` + **area reach** (stats of a minion-hosted spell reaching groups in the 4 adjacent squares). Shared with General (War) and Fae Quadrille (Life), backlog E11. |
| Earthquake | 6/4 | R | Cast on square. Target square becomes barren land. Colonies in the four adjacent squares are destroyed. Each minion in the four adjacent squares takes 0-4 hit points of damage. | manif. | B (+C) | `OnCast(Terraform('barren'), `**`Damage(random(0,4),'adjacentOccupants')`**`)`. Colony clause needs **destroy structure** (backlog E8); harmless no-op until colonies exist. |
| Forestation | 3/0 | C | Cast on square. Square becomes forest. (Minions in forest cannot be targeted by enemy individual spells.) | manif. | A | `Target.square`, `OnCast(Terraform('forest'))`. Duplicate pattern of Plains (War). |
| Fusillade | 3/2 | C | Cast on group with archers. Archers in group get +1 attack in combat round 1 only. | alt. | C | `Target.group.with('archers'), Grant({attacks:1},{to:'archers',`**`round:1`**`})`. Attack counts are set in `startRound` from `computeStats` before `round:start` fires, so tokens cannot do it: needs the **combat round visible to `stats`**. |
| Gale Force | 5/4 | R | Cast on globe. All groups move twice this turn in their direction of travel. | manif. | B | `Target.globe`, `OnCast(`**`MoveTwice('allGroups')`**`)`. Engine already repeats `moveOrder` for `movesTwice` groups after bots pick theirs. |
| Geomancy | 2/2 | U | Cast on globe. All non-structure terrain is randomly regenerated, according to the realm of the current game. | manif. | C | Needs **realm terrain roll exposed to ctx** (`mapgen.roll` / `VELDT` are private). Then `setTerrain` per square (drowning applies). |
| Goldcaps | 4/0 | C | H:1 A:0 HP:3(x3) L:0. Territorial. Neutral. Creates three Goldcaps. Goldcaps attack all groups, even if friendly. | summ. | B | `Target.square, Territorial(), Monster({...hand:1,hp:3,level:0},{neutral:true,`**`count:3`**`})`. "Attack all groups" is already true of neutral groups (`hostile()`). |
| Hailstorm | 2/1 | C | Cast on square. Affects square and all adjacent squares. At start of turn, all minions in affected squares take 1 hit point of damage. Duration: Turn of casting +2. | conj. | B | `Target.square, Lasts(3), On(When.startOfTurn, Damage(1,`**`'areaOccupants'`**`))` with area = square + 4 adjacent. |
| Healing Spring | 3/0 | R | Cast on square. When group enters square, all members of group are fully healed. | alt. | A | `Target.square, On(When.enter(), Heal('full','enterer'))`. Near-duplicate of Wellspring (Life) without Expend. |
| Huntsman | 4/2 | R | H:3 A:2 HP:10 L:2. Territorial. Gets +2 hand damage against monsters. | summ. | A | `Target.square, Territorial(), Monster({hand:3,armor:2,hp:10,level:2}), Against(ALL_HOUSES,{hand:2,monstersOnly:true})`. Print reads badly with 12 houses: optional `Against('any')`. |
| Icecaps | 3/3 | C | H:1 A:1 HP:1(x3) L:1. Nomadic, Neutral. Creates three Icecaps. When Icecaps' group dies, group's square becomes ice. | summ. | C | `Nomadic(), Monster(...,{neutral:true,`**`count:3`**`}), On(`**`When.groupDies`**`, Terraform('ice',`**`'hostSquare'`**`))`. Ice has **no sliding** in the engine (behaves as plains). |
| Ill Winds | 4/1 | U | Cast on town or colony. Affects town and the four adjacent squares. Minions in squares deal no missile damage (before checking armor). | alt. | C | `Target.structure` + **area reach** (event chain from 5 squares) + `attacker:strikes` set missile damage 0. |
| Inundate | 5/1 | U | Cast on square. Square becomes water. (drowning reminder) | manif. | A | `Target.square, OnCast(Terraform('water'))`. |
| Jade Dragon | 6/3 | R | H:4(x2) A:1 HP:15 L:2. Waterwalk. Two attacks. Target square becomes water. At start of combat against Imps, kills one random opposing Imp. At start of turn, is removed from the game. | summ. | C | `Monster({hand:4,handAttacks:2,armor:1,hp:15,level:2,walks:['water']}), OnCast(Terraform('water')), On(When.startOfCombat(), `**`Kill('opponentRandom',{nation:'imp'})`**`), On(When.startOfTurn, `**`Remove()`**`)` - needs **`ctx.remove`**. No behaviour keyword: stands still. |
| Jaguar's Blood | 1/0 | C | Cast on minion. Minion gets +4 maximum and current hit points. | alt. | A | `{type:'minion'}, Grant({maxHp:4},{heal:true})`. |
| Karillian Arrows | 2/1 | U | Cast on archer. When archer damages an opponent, opponent gets an effect that gives 1 hit point of damage at the start of each round for the rest of that combat. | alt. | B | `Target.archer, On(When.onDamage(), Give('karillian-venom','victim'))`; helper (visible) `On(When.eachRound(), Damage(1))` + **`UntilCombatEnd()`**. Same shape as Thermites (War). |
| Lightning Bolt | 2/0 | C | Cast on minion. Minion takes five hit points of damage. | manif. | A | `{type:'minion'}, OnCast(Damage(5,'target'))`. Single-target Fireball (War). |
| Natural Order | 1/1 | U | Cast on square. Dispels all square spells in the 3x3 diamond centered on square. This does not change terrain or destroy colonies. | manif. | B | `Target.square, OnCast(`**`DispelAll('diamond')`**`)` - square-hosted spells only. |
| Overflow | 1/1 | U | Cast on friendly town or colony adjacent to at least one non-structure, non-water square, and not adjacent to any enemy minions. Up to two random adjacent non-structure squares become water. (drowning reminder) | manif. | B | `Target.structure.friendly` + **canCast predicate** (Script) + `OnCast(`**`Terraform('water','randomAdjacent',{count:2})`**`)`. |
| Pixie Dust | 3/1 | U | Cast on minion. All other members of minion's group get -2 hand damage. | alt. | A | `{type:'minion'}, Aura({hand:-2})` (no `self`, so the host is unaffected). |
| Primeval Forest | 2/0 | C | Cast on forest. Affects all contiguous forest squares. Every monster created in Primeval Forest gets Primeval Strength (+1 hand damage). | alt. | C | `Target.square.on('forest'), OnCast(GiveSquares('primeval-forest-square','forest'))`; helper `Bound('forest'), On(When.created, Give('primeval-strength','created'))`. Engine: **`summonGroup` must dispatch `minion:created`** (today only structure recruits do). Same shape as Faerie Glade (Life). |
| Protective Cover | 3/2 | U | Cast on recruit. Recruit no longer attacks, and receives no combat damage. When recruit is hit by an Imp (before checking armor), the Imp receives the damage instead, ignoring armor. Dispelled after next combat. | alt. | B | `Target.recruit`, `Grant({attacks:-9})` ("no longer attacks"; not `Pacified`, which also zeroes damage), **`Invulnerable('combat')`** (armor:after cancel when `attackerId` set), **`Reflect({nation:'imp'})`** (attack:beforeArmor: damage the attacker, zero the hit), **`UntilCombatEnd()`** for a minion host. |
| Revelers | 2/1 | VR | Cast on recruit group. All members of group lose their natural house abilities. | alt. | C | **Nation suppression**: nation HP and walks are baked into `Minion.base` by `applyNation`; the round bonus reads `m.nation`. Needs nation applied in `computeStats` plus a `StatDelta.noNation` flag. |
| Seed on the Wind | 3/3 | C | Cast on square. The 3x3 diamond centered on square becomes forest. | manif. | B | `OnCast(Terraform('forest',`**`'diamond'`**`))`. |
| Sign of Order | 4/0 | C | Cast on globe. Caster gets +1 Order each turn. May be cast more than once. | alt. | A | `Target.globe, Stackable(), On(When.manaPhase, AddMana('order',1))`. Duplicate of Aura of World (Life). |
| Simian Warriors | 2/2 | C | H:3 A:1 HP:7 L:1, H:1 A:0 HP:3 L:2, H:2 A:0 HP:5 L:1. Territorial. Creates three different Simian Warriors. | summ. | B | `Territorial(), Monster(`**`[def1, def2, def3]`**`)` (multi-def Monster). |
| Smell the Roses | 5/4 | R | Cast on recruit group. Group becomes computer-controlled, cannot join groups or create new recruits, and moves like a territorial monster within the 3x3 diamond centered on group's square at time of casting. Duration: Turn of casting +2. | conj. | C | `Lasts(3)` + **`ctx.setControl(gid,'computer',botId)`** restored on expiry/dispel + **group lock** + diamond-limited territorial bot. Shared with Questing Beast (Life, E1). |
| Stone Circle | 4/1 | C | Cast on square. Square and its occupants cannot be targeted by any spells. While in square, minions in square get +1 level. | alt. | B | `Target.square, Grant({level:1}), `**`Sanctuary()`** (square-host Shroud: blocks spells targeting the square, its structure, its group, its minions; any caster). |
| Straight-Arrow | 1/0 | C | Cast on archer. Archer gets +4 missile damage in combat round 1 only. | alt. | B | `Target.archer, `**`Grant({missile:4},{round:1})`** implemented on `attacker:strikes` (`data.round` exists). |
| Syzygy | 3/1 | VR | Cast on globe. Next turn, caster has all spell casting costs adjusted by -1 primary and -1 secondary mana per spell. | conj. | C | `Lasts(2)` + **cost-modifier hook** (`validateOrders` reads `card.cost` statically). |
| Tornado | 3/2 | VR | Cast on square. Square's terrain is moved to a random adjacent non-structure square. Square becomes barren land. | manif. | B | `Script` with `terrainAt` + `setTerrain` (all existing ctx), or **`Terraform('move','randomAdjacent')`**. |
| Tree Man | 3/0 | U | H:3 A:1 HP:12 L:1. Territorial. Cast on forest. | summ. | A | `Target.square.on('forest'), Territorial(), Monster({name:'Tree Man',cls:'monster',hand:3,armor:1,hp:12,level:1})`. |
| Unseelie Howl | 2/2 | U | Cast on recruit group. Group's movement orders are cancelled. Every friendly recruit group's movement orders are cancelled. | manif. | B | `Target.recruitGroup, OnCast(`**`CancelMoves('target')`**`, `**`CancelMoves('casterGroups')`**`)` (today `CancelMoves` hits every recruit group). |
| Uproot | 5/4 | R | H:3 A:1 HP:12(x3) L:1. Nomadic. Cast on forest. Target square becomes barren land. Creates 3 Uprooted Tree Men. When Uprooted group dies, group's square becomes forest. | summ. | B | `Target.square.on('forest'), Nomadic(), Monster(...,{`**`count:3`**`}), OnCast(Terraform('barren')), On(`**`When.groupDies`**`, Terraform('forest',`**`'hostSquare'`**`))`. |
| Utaban Brothers | 2/1 | C | H:2 A:1 HP:7 L:1 or M:2 A:0 HP:7 L:1. Cast on friendly recruit group in a structure. Creates a Satyr recruit of random class. | summ. | B | `Target.recruitGroup.friendly`**`.inStructure`**, `Create({name:'Utaban Brother',nation:'satyr'},{`**`randomClass:true`**`})`. Near-duplicate of Dragon's Teeth (War). |
| Water Breathing | 1/0 | C | Cast on group. Group gains Waterwalk. | alt. | A | `Target.group, Walk('water')`. Same shape as Flight (Life). |
| Water's Gift | 2/2 | R | Cast on friendly town or colony. The four squares adjacent to structure become ice. | manif. | C | `Target.structure.friendly, OnCast(Terraform('ice','adjacent'))` compiles today; correct play needs **ice sliding**. |
| Watersniper | 1/1 | C | Cast on archer. Archer gets +1 missile damage, and its group gains Waterwalk. | alt. | B | `Target.archer`; split into `Grant({missile:1})` + helper `Aura({`**`walks:['water']`**`},{self:...})` (Aura cannot share a card with Grant; `GrantStats` has no walks). |
| Will o' the Wisp | 5/3 | R | Cast on recruit group not in a structure. Group disappears for turn of casting +2. (Group reappears at start of turn if its square is unoccupied, or on the earliest turn thereafter.) | conj. | B | `Target.recruitGroup`**`.notInStructure`**, **`Boardhop({turns:3})`** = `ctx.hide` + globe controller with tokens (gid, x, y) that calls `ctx.appear` on `turn:start` once due and the square is free. Shared with Faerie Circle (Life, E6). |
| Wolf Pack | 5/2 | U | H:3 A:0 HP:12(x3) L:1. Territorial. Cast on forest. Creates three Wolves. | summ. | B | `Target.square.on('forest'), Territorial(), Monster({name:'Wolf',hand:3,hp:12,level:1},{`**`count:3`**`})`. |
| Woodhenge | 1/1 | U | Cast on forest. Square and its occupants cannot be targeted by any spells. Duration: Turn of casting +1. | conj. | B | `Target.square.on('forest'), Lasts(2), `**`Sanctuary()`**. |
| World Dance | 0/5 | R | Cast on town or colony. World Dance generates +2 World for town owner each turn. | alt. | A | `Target.structure, On(When.manaPhase, AddMana('world',2,'structureOwner'))`. Duplicate of Ring of Light (Life) / Call to Arms (War). |

Class lists: **A (12)** Barkskin, Forestation, Healing Spring, Huntsman, Inundate, Jaguar's Blood, Lightning Bolt, Pixie
Dust, Sign of Order, Tree Man, Water Breathing, World Dance. **B (25)** Abatement, Back to Nature, Deluge, Diomesia,
Druid, Earthquake, Gale Force, Goldcaps, Hailstorm, Karillian Arrows, Natural Order, Overflow, Protective Cover, Seed on
the Wind, Simian Warriors, Stone Circle, Straight-Arrow, Tornado, Unseelie Howl, Uproot, Utaban Brothers, Watersniper,
Will o' the Wisp, Wolf Pack, Woodhenge. **C (13)** Bellwether, Dryad's Favors, Eagle Eyes, Fusillade, Geomancy, Icecaps,
Ill Winds, Jade Dragon, Primeval Forest, Revelers, Smell the Roses, Syzygy, Water's Gift. **D (1)** Biting Wind.

Near-duplicates of shipped War/Life cards: Forestation/Inundate (Plains, Volcano), Sign of Order (Aura of World), World
Dance (Ring of Light, Call to Arms), Healing Spring (Wellspring), Lightning Bolt (Fireball, single target), Water
Breathing (Flight), Jaguar's Blood (Marksman/Faerie Knight HP part), Karillian Arrows (Thermites), Diomesia (Lienna),
Bellwether (Decoy), Utaban Brothers (Dragon's Teeth), Primeval Forest (Faerie Glade), Back to Nature/Abatement
(Cleansing Light), Gale Force (Forced March), Unseelie Howl (Standoff), Stone Circle/Woodhenge (Seelie Favor), Tree
Man/Wolf Pack (Sylph-style monsters). Pending backlog twins: Will o' the Wisp ~ Faerie Circle (E6), Eagle Eyes ~ General
(E11), Earthquake ~ Encampment colonies (E8), Smell the Roses/Bellwether ~ Questing Beast (E1).

## 4. Lang-layer features (class B), with cards unlocked

| # | Feature | Shape | Unlocks |
|---|---|---|---|
| L1 | `Monster` count and multi-def | `Monster(def, {count})`, `Monster([d1,d2,d3])`; print "Summon 3 Wolves (...)" | Goldcaps, Wolf Pack, Simian Warriors, Uproot, Icecaps (5) |
| L2 | Area shapes for effects | areas `diamond` (Manhattan <= 1), `adjacentOf(target)`, `randomAdjacent(n)`, `besideTerrain(t)`; scopes `areaOccupants`, `adjacentOccupants` | Seed on the Wind, Hailstorm, Earthquake, Overflow, Deluge, Tornado, Natural Order (7) |
| L3 | `DispelAll` scopes | `'group'` (today), `'square'`, `'globe'`, `'diamond'`; visible spells only | Abatement, Back to Nature, Natural Order (3) |
| L4 | `UntilCombatEnd()` | `Fleeting` for minion hosts: dispel on the host's group `combat:end` | Karillian Arrows, Diomesia, Protective Cover (3) |
| L5 | Group-death trigger + host-square terraform | `When.groupDies` (on `minion:dies` when `minionsOf(gid)` is empty; group still has `pos`), area `hostSquare` | Uproot, Icecaps (2) |
| L6 | `Sanctuary()` | square-host Shroud: blocks every non-helper spell targeting the square, its structure, group or minions | Stone Circle, Woodhenge (2) |
| L7 | Move-effect scopes | `MoveTwice('allGroups')`, `CancelMoves('target' or 'casterGroups')` | Gale Force, Unseelie Howl (2) |
| L8 | Target/Create options | `.inStructure`, `.notInStructure`, `Create({randomClass})` | Utaban Brothers, Will o' the Wisp (2) |
| L9 | `Boardhop({turns})` | hide + globe controller reappearing on the exit square when free | Will o' the Wisp (1) + Faerie Circle (Life) |
| L10 | Round-conditional Grant (damage) | `Grant({missile:4},{round:1})` via `attacker:strikes` `data.round` | Straight-Arrow (1); Fusillade needs C3 |
| L11 | Conditional mana to host owner | `AddMana(type,n,'hostOwner')` + `.if(inTerrain)` | Druid (1) |
| L12 | Combat immunity and reflection | `Invulnerable('combat')`, `Reflect({nation})` | Protective Cover (1) |
| L13 | Small one-offs | `Shroud({against:'enemy'})` (Bellwether), `Piercing()` (Biting Wind), `Aura` with walks (Watersniper), `Kill('opponentRandom',{nation})` (Jade Dragon), `Damage(random(0,4))` (Earthquake), `Against('any monster')` print (Huntsman), `Target.minion` builder (5 cards) | 1 each |

## 5. Engine features (class C/D), with cards unlocked

| # | Feature | Exactly what | Unlocks | Shared? |
|---|---|---|---|---|
| C1 | `ctx.remove(minionId)` | `killMinion(e,id,null,'removed')` exposed (no dying/dies events); also "removed if boardhop dispelled" | Jade Dragon, Dryad's Favors (2) | Yes: any "removed from the game", boardhops |
| C2 | `minion:created` on summons | `summonGroup`/`ctx.summon` dispatch `minion:created` per minion with ref square (or minion), `data.minionId` | Primeval Forest (1) | Yes: "every monster created" auras |
| C3 | Combat round in stats | `state.combat = {round}` (or a `round` arg to `stats`) set before `startRound` computes attack counts | Fusillade (1); cleaner Straight-Arrow | Yes: Reaper, Rangefinder-style round bonuses |
| C4 | Realm terrain roll in ctx | export the Veldt distribution; `ctx.randomTerrain()` or `ctx.regenerateTerrain()` | Geomancy (1) | Changing Lands, Blight, Drought (other houses) |
| C5 | Group lock + control change | `Group.locked` (or StatDelta-like group flag) checked by `canJoin`, `addRecruit`, `placeRecruit`, `applyTraining`, `Create.canCast`, `validateOrders`; `ctx.setControl(gid, control, botId)` and restore | Bellwether, Smell the Roses (2) | Yes: Questing Beast (E1), possession/charm effects |
| C6 | Area reach | `CardDef.reach?(q, spell, pos)`; `chain()` and `computeStats()` also consult spells whose reach covers the square | Eagle Eyes, Ill Winds (2) (+Hailstorm alternative) | Yes: General, Fae Quadrille (E11) |
| C7 | Nation as a computed ability | stop baking nation HP/walks into `base`; apply in `computeStats` unless `noNation`; `nationBonus` checks it | Revelers (1) | Yes: nation-change spells (Forbidden Ichor, Penumbra) |
| C8 | Ice sliding | movement pipeline: on entering ice slide in direction to first non-ice or blocking square; ignore middle groups/spells; Flight still slides | Icecaps, Water's Gift (2) | Yes: Freeze, Ice Age |
| C9 | Cost modifiers | `CardDef`/spell hook `costDelta(q, player, card)` used by `validateOrders` and the client cost display; floor 0 per type | Syzygy (1) | Yes: Dissolution, Ogi's Armor |
| D1 | Revolver (per-instance hand state) | hand entries need state (`{cardId, m}`), turn-start update, cost from state, damage reads it | Biting Wind (1) | Yes: other Revolvers/Expansives |
| C10 | Destroy structure / colonies | backlog E8 | Earthquake colony clause | Yes |

Top features by cards unlocked: L2 area shapes (7), L1 Monster count (5), L3 DispelAll scopes (3), L4 UntilCombatEnd (3),
then C1/C5/C6/C8 and L5-L8 (2 each).

## 6. Shared-mechanic flags (other houses will want these)

Monster count/multi-def; area shapes (diamond, adjacent, contiguous) for terraform/damage/dispel; group-death trigger;
`UntilCombatEnd` helpers; `ctx.remove`; boardhop controller; square Sanctuary; group lock and control change; area reach;
nation as computed ability (nation change/cancel); ice sliding (and swamp exit rule, also unimplemented); cost modifiers
and Revolvers; `minion:created` on summons; combat round in stats; colony create/destroy.

## 7. Ambiguities and rulings

| # | Card(s) | Question | Ruling |
|---|---|---|---|
| 1 | Natural Order, Seed on the Wind, Smell the Roses | "3x3 diamond" | Target square + 4 orthogonal neighbours (Manhattan <= 1, fits a 3x3 box). |
| 2 | All square spells | Target must be empty (engine rule, rules page Spells) | Kept: Abatement, Hailstorm, Stone Circle, Earthquake etc. target an empty square; effects still reach occupied neighbours. |
| 3 | Unseelie Howl | "Every friendly recruit group" | Friendly = the caster's (card convention). Cast on an enemy group, it also freezes your own groups this turn. Computer-controlled groups pick orders after spells (as Standoff). |
| 4 | Eagle Eyes | Own square included? | No: only the 4 orthogonally adjacent squares; the recruit's own group gets nothing. Friendly = the caster's archers. |
| 5 | Karillian Arrows | Stacking, damage kind | Venom is a visible helper, cumulative per damaging hit (helpers are cumulative), 1 magical damage at each `round:start`, ends at `combat:end`. |
| 6 | Diomesia | "do not deal hand damage" | Swordsmen's hand damage becomes 0 (hand -99, clamped); missile damage unaffected; "any opposing group" = each group fighting hers, for that combat only. Her own H:0 already. |
| 7 | Jade Dragon | Behaviour, removal, order | No behaviour keyword: it stands still. Summon first, then the square becomes water (it has Waterwalk). Removed (no death events) at the next start of turn, so it fights only the turn it is cast. Imp = nation `imp`. |
| 8 | Deluge | Cascade, revert | Squares snapshotted at cast (no cascade); structures and Sanctum squares never change; drowning immediate; at expiry each square reverts to plains only if still water. |
| 9 | Earthquake | Damage roll | Each minion in the 4 adjacent squares independently takes uniform 0-4 magical damage; colony clause no-op until colonies exist. |
| 10 | Gale Force | Who, which direction | Every group on the board incl. monsters; second leg reuses the first-pass order (bots are not re-asked); groups without an order do not move. |
| 11 | Geomancy | Map rules | Re-roll every non-structure, non-Sanctum-area square with the realm distribution; keep the "default near entrances" and "max 1 harsh per town" fairness rules; no mirroring; fatal terrain applies at once. |
| 12 | Healing Spring | Who triggers | Any group (any owner, monsters too) that enters by movement; appearing/teleport does not trigger. |
| 13 | Primeval Forest | Whose monsters | Any monster created (summoned) on an affected square, any owner; Ambush appearances are not "created". |
| 14 | Protective Cover | Scope of immunity | Cancels non-magical combat damage (attacker set) after armor; magical/spell damage still hurts. Imp hit: before armor, the hit becomes 0 and the Imp takes the original quantity as magical damage. Dispelled after the group's next combat. |
| 15 | Revelers | "natural house abilities" | = nation ability (9 HP, terrainwalk, round bonus). Group spell, so later joiners lose it too; current HP clamps to the new max. |
| 16 | Smell the Roses | Territory, end | Territory = diamond around the cast square; returns to player control at expiry (or when dispelled); move orders cleared that turn. |
| 17 | Stone Circle, Woodhenge | Which spells | Blocks all real spells (friendly too) targeting the square, structure, group or minions. Engine/helper casts and untargeted area effects (Natural Order, Hailstorm, Deluge) still apply. |
| 18 | Syzygy | Which mana, stacking | Next turn only; -1 of each spell's own primary and secondary type, floor 0; exclusive (a second copy while one is active squanders). |
| 19 | Biting Wind | Revolver start | M = 1 when drawn, +1 at each start of turn while in hand, 10 -> 1; damage = 2 x M paid; resets when it leaves the hand. |
| 20 | Tornado | No legal neighbour | Neighbour = adjacent non-structure, non-Sanctum square (random). If none, the terrain is lost; target still becomes barren. Fatal terrain applies at once on the destination. |
| 21 | Dryad's Favors | Owner, waiting | New recruit belongs to the removed recruit's owner, base stats of its class+nation; waits while any group stands on the square. |
| 22 | Will o' the Wisp | Return | Returns at start of turn T+3 (cast turn + 2 gone) on its exit square if no group is there, even into water (rules exemplar drowns it). Controller non-visible, so not dispellable. |
| 23 | Icecaps, Water's Gift | Ice before C8 | Until sliding exists ice is plain terrain; ship with a RULING comment or hold. |
| 24 | Bellwether | Lock lifetime | Lock and Shroud live on the Cow (helper on the minion): end when the Cow dies. |
| 25 | Goldcaps, Icecaps | "attack all groups" | Already true of neutral groups (`hostile()` treats neutral as hostile to all, even other neutrals); bots hunt recruit groups only. |
| 26 | Overflow | Candidates | Adjacent squares that are non-structure, non-water, non-Sanctum; "not adjacent to any enemy minions" = no enemy group on the 4 squares around the structure, checked at cast only. |
| 27 | Ill Winds | Whose missiles | Every minion standing in the 5 squares, both sides; damage set to 0 before armor. |
| 28 | Druid | When | Mana phase each turn the archer's group stands in forest; World goes to the archer's current owner. |
| 29 | Fusillade | Duration | Permanent alteration: every combat, archers in the group (incl. later joiners) have +1 attack in round 1. |
| 30 | Abatement, Back to Nature, Natural Order | Non-visible spells | Only visible spells (enchantments) are dispelled; terrain is never a dispellable spell; Natural Order touches square-hosted spells only (not structure spells, so colonies survive). |

## 8. Proposed task order (cheapest first)

| Step | Work | Cards shipped (cumulative) |
|---|---|---|
| 1 | The 12 class-A cards (+ `Target.minion` builder) | 12 |
| 2 | L1 Monster count/multi-def | +3 (Goldcaps, Wolf Pack, Simian Warriors) = 15 |
| 3 | L4 UntilCombatEnd + L12 | +3 (Karillian Arrows, Diomesia, Protective Cover) = 18 |
| 4 | L2 area shapes + L3 DispelAll scopes | +9 (Abatement, Back to Nature, Natural Order, Seed on the Wind, Hailstorm, Overflow, Tornado, Deluge, Earthquake) = 27 |
| 5 | L5 group-death trigger | +1 (Uproot) = 28 |
| 6 | L6-L11, L13 small lang items | +9 (Stone Circle, Woodhenge, Gale Force, Unseelie Howl, Utaban Brothers, Will o' the Wisp, Straight-Arrow, Druid, Watersniper) = 37 |
| 7 | C1 `ctx.remove` | +2 (Jade Dragon, Dryad's Favors) = 39 |
| 8 | C2 `minion:created` on summon | +1 (Primeval Forest) = 40 |
| 9 | C4 realm roll | +1 (Geomancy) = 41 |
| 10 | C3 combat round in stats | +1 (Fusillade) = 42 |
| 11 | C5 group lock + control change | +2 (Bellwether, Smell the Roses) = 44 |
| 12 | C6 area reach | +2 (Eagle Eyes, Ill Winds) = 46 |
| 13 | C7 nation as computed ability | +1 (Revelers) = 47 |
| 14 | C8 ice sliding | +2 (Icecaps, Water's Gift) = 49 |
| 15 | C9 cost modifiers | +1 (Syzygy) = 50 |
| 16 | D1 Revolver hand state | +1 (Biting Wind) = 51 |

## 9. Risks and notes

- **Scrape:** 51 cards, all have name, slug, cost, rarity, text. `castOn` is `null` for Goldcaps, Huntsman, Icecaps, Jade
  Dragon, Simian Warriors: their text has no "Cast on" (summonings default to an empty square), not a parse failure.
  Overflow's `castOn`/text contain "non- water" (a source line-break hyphen). Lightning Bolt flavor keeps a `\'`
  escape. Biting Wind's scraped cost `{world:1}` is the revolver's starting M. Stat lines with several minions
  (Simian Warriors "..., ..., ...", Utaban Brothers "... or ...") and `H:0(x0)` (Bellwether) need care in any
  stat-line parser.
- **Satyr stats:** nation ability already in the engine (`missile1`, 7 HP). Round-1 archer damage = 2 - 1 (missile
  round) + 1 (Satyr) = 2; Straight-Arrow makes it 6, Druid/Watersniper/Eagle Eyes add +1 each. Revelers removes the +1.
  Creature stat lines for Satyr recruits (Diomesia HP:7, Pacified Cow HP:10, Utaban 7) are final stats per the
  card-text guide; Cow overrides nation HP.
- **Terrain power:** Inundate/Deluge/Overflow/Geomancy/Tornado drown groups at once via `setTerrain`; Deluge and Geomancy
  can wipe the board. Test with groups on affected squares.
- **Swamp** exit rule and **ice** slide are both unimplemented engine terrain rules (mapgen already rolls swamp).
- **Area reach (C6)** touches `chain()` and `computeStats()`, the two hottest paths; cache per square or limit to cards
  that declare `reach`.
- **Nation refactor (C7)** changes how every recruit's HP/walks are computed; regression risk across all shipped cards.
- **Control change (C5)** interacts with bots, joining, capture (computer-controlled recruit groups still capture) and
  the client's move UI.
- **Revolver (D1)** changes `PlayerState.hand: string[]`, which `orders.ts`, `turn.ts`, the client and saves rely on.
- **Faces:** Monster count and new keywords change printed faces; `faces.test.ts` snapshots must be extended, not
  rewritten.
- No extra rules pages were fetched: the saved pages plus the card texts covered every mechanic used (Revolver is
  defined in its own card text; ice/forest/water in Elements_terrainswalks; boardhop return in Concepts_boardhop;
  colonies in Elements_structures).
