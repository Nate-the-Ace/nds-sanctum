# House of Hope: card analysis

Site house id 3. Mana: **Clarity** primary, **Order** secondary. Nation: **Vision** (7 HP, Waterwalk, no combat bonus;
`NATIONS.vision` in `packages/engine/src/nations.ts` already matches `research/rules/Axioms_houses.txt`).
Source data: `packages/cards/data/houses/hope.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs hope --per-house`).
Vocabulary checked against `packages/cards/src/lang/**` and `packages/engine/src/*` on branch `engine-core`.

Classes: **A** = expressible today with existing keywords; **B** = needs a small new keyword/effect/trigger/target in the
lang layer only; **C** = needs a new engine feature (event, ctx action, state or rule); **D** = special/hard.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 50 |
| Rarity | Common 16, Uncommon 16, Rare 14, Very Rare 4 |
| Expansions | Classic 18, Revolutions 10, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 2 |
| Total cost (C+O) | 1:4, 2:7, 3:6, 4:6, 5:6, 6:7, 7:8, 8:4, 9:2 (median 5) |
| Order (secondary) used | 0:19, 1:10, 2:10, 3:8, 4:3. 19 cards are Clarity-only |
| Classification | **A 8, B 17, C 22, D 3** |
| Creatures | Monsters 5 (Centaurs, Griffin, Man of Iron, Pegasus, Unicorn Herd; none neutral); recruit makers 7 (Citizens' Militia, Heartsong, Spiritual Advisers, Volunteers, Zana, Zana's Blessing, Zana's Champion); novice makers 3 (Army of Light, Chalice of Hope, Recall) |
| Heroes | Zana (Vision swordswoman), Heartsong (Imp swordsman) |

### Scrape problems (not fixed; shared scraper)

| Card | Problem | Cause |
|---|---|---|
| Griffin, Pegasus | `castOn: null` | Text says "Cast **within** a 3x3 diamond centered on a mountain."; parser only matches "Cast on". Parser gap. |
| Man of Iron, Unicorn Herd | `castOn: null` | The card pages have no cast clause at all (checked raw page sid 64). Source gap; ruling below: any empty square. |
| Change of Heart | text contains `caster\'s` | literal backslash-apostrophe from the site; scraper should unescape `\'`. |
| Leap of Faith | flavor contains `Ch\'tai` | same. |
| (all) | spell type (alteration/conjuration/...) not on the page | known; types below are proposed per card. |
| Sword of Zana / II | deck "card version equivalence" (one 4-copy limit for both, `Elements_deckhand.txt`) not in data | deck validator needs an equivalence map (also Apocalypse, Bleak Isle, Water Breathing/Walking, Mirage/Neb's Mirage). |

Rules site: `http://www.playsanctum.net/nioga/rules/<Section>/<name>.php` now returns 404 for every page (including the
already-saved `Concepts/monsters.php`); `rules.php` serves a NIOGA usage-agreement page, which I did not accept. No new
rules pages were saved. Mechanics without a rules page (Revolver, dodge, Emancipated, "cast within") are ruled below.

## 2. Theme and mechanics overview

| Theme | Cards | Notes |
|---|---|---|
| Recruit buffs (individual) | Leadership, Spirit Sword, Deva's Quiver, Piercing Rays, Unerring Focus, Charmed Existence, Shield of Vela, Hero's Legacy, Prophet, Atonement | Several need combat flags (ignores armor, always hits, dodge). |
| Recruit generation | Army of Light, Chalice of Hope, Volunteers, Spiritual Advisers, Zana's Blessing, Citizens' Militia, Recall, Master Armorer, Farm-Boys | Hope is the "more bodies" house; town-creation hooks (`minion:created`) do most of it. |
| Protection / anti-combat | Sanctuary, Sword of Zana I/II, Empathy, Zana's Escape, Aurora, Perfection, Vale of Peace, Charmed Existence | Withdraw, cancel death, spell blocking. |
| Conversion / ownership | Change of Heart, Emancipation, Zana, Settlement, Zana's Champion, Recall, Ascension | Need ownership changes (incl. to neutral), structure create/destroy, remove-from-game. |
| Mobility | Hand of Zana (Flight), Mountain Pass, Illender (terraform to friendly terrain), Pegasus/Griffin (Flight) | Vision Waterwalk + these = Hope ignores terrain. |
| Mana / hand | Burst of Clarity, Threshold of Order, Abstention, Sublimity, Leap of Faith, Inspiration | Hand-manipulation is new to the engine. |
| Monsters | Centaurs, Griffin, Man of Iron, Pegasus, Unicorn Herd, Bella's Sigil (immobilise), Vale of Peace, Emancipation, Zana | Anti-monster and monster-stealing flavour. |

Nation and flavour effects on stats:
- Every Hope recruit made by the game is a Vision: 7 HP, Waterwalk, no round bonus (`nationOfHouse('hope')`). Printed
  Vision stat lines check out: Spiritual Advisers `M:2 A:0 HP:7 L:1` is a plain Vision archer; Zana `H:2 A:1 HP:7 L:2`
  is a level-2 Vision swordsman.
- **Zana's Blessing archers print `A:1`** (archer base armor is 0): the creature def must set `armor: 1` explicitly.
- **Citizens' Militia swordsmen are level 0** (`level: 0`).
- **Zana's Champion `H:4 A:4 HP:7 L:2`**: base def hand 4, armor 4 (no helper).
- **Heartsong is an Imp** (nation imp: 7 HP, +1 hand in round 2, house Abomination by nation). Lore: an Imp who converted
  to Hope (`Axioms_houses.txt` trivia). See ruling R14 for which house he "serves".
- Piercing Rays and Griffin key on **Shadows** (the Despair nation), not on the Despair house: a Despair monster is not a
  Shadow. Griffin's "Despair individual spells" is the house.

## 3. Classification table (all 50 cards)

Cost written `C+O`. Proposed spell type in column T: alt(eration), conj(uration), man(ifestation), sum(moning), hero.

| # | Card | Cost | Rar | T | Text (quoted, trimmed of reminders) | Cls | Keyword composition / what is missing |
|---|---|---|---|---|---|---|---|
| 1 | Abstention | 3+3 | U | conj | "Cast on globe. Caster cannot discard or cast any globe spells. Duration: Turn of casting +2. On expiration, Abstention II (caster gets +2 Clarity each turn) is cast on the globe. May be cast more than once." | C | `Target.globe, Lasts(3), Stackable(), Forbid(['globe'],{by:'caster'}), NoDiscard() [new], Afterward('abstention-ii')`; helper `abstention-ii` = `Stackable(), On(When.manaPhase, AddMana('clarity',2))`. Engine: discard is never checked against spells; needs a `blocksDiscard` hook in `validateOrders`. **Near-duplicate of Life's Court Politics** (same skeleton, same Court Politics II helper shape). |
| 2 | Army of Light | 4+3 | C | man | "Cast on town or colony. Creates two Vision novices in town." | A | `Target.structure, OnCast(Novices(2,'vision'))`. **Near-duplicate of Life's Allies** (Allies is friendly-only; this one is any owner, ruling R6). |
| 3 | Ascension | 3+2 | C | man | "Cast on recruit. Recruit is removed from the game. (This does not set off any death-triggered effects.)" | C | `Target.recruit, OnCast(Remove('target'))`. Engine: `killMinion(...,'removed')` exists but no `ctx.remove`. |
| 4 | Atonement | 2 | U | alt | "Cast on recruit. If recruit is killed, the attacker's owner discards all spells in hand. If killed by a recruit, Atonement transfers to the killer." | C | Needs `When.killed` (minion:killed, has `blame`), new effect `DiscardHand('killerOwner')` (ctx `discardHand(side)`), and spell transfer (ctx `transferSpell(spellId, newHost)`) before burial step E3 removes it. |
| 5 | Aurora | 2+1 | C | man | "Cast on globe. All friendly recruits on the board get Aura (+1 armor, dispelled when recruit is hit in combat)." | B | `Target.globe, OnCast(Give('aurora-aura','friendlyRecruits'))` [new scope]; helper `aurora-aura` = `Grant({armor:1}), On(When.hit [new victim-side trigger on attack:hit], Expend())`. Name the helper "Aurora's Aura" in print: `Aura` is already the Group-aura keyword. |
| 6 | Bella's Sigil | 2 | R | alt | "Cast on monster. It becomes immobile. (Immobile monsters cannot be moved.)" | C | Needs `Target.monster` (engine TargetType exists, builder lacks it) and an `immobile` stat flag honoured by movement (bot orders, `moveGroup`, `setMoveOrder`, random moves, sliding). Today `Immobile` only sets a summoning card's `bot`. |
| 7 | Burst of Clarity | 2 | C | conj | "Cast on globe. Caster gets +2 Clarity next turn." | A | `Target.globe, Lasts(2), Undispellable(), On(When.manaPhase, AddMana('clarity',2))` (ruling R3). One of six "Burst of X" cards across houses. |
| 8 | Centaurs | 5+2 | R | sum | "M:2(x2) A:0 HP:10(x2) L:1 Nomadic. Two attacks. Cast on forest. Creates two Centaurs." | B | `Target.square.on('forest'), Nomadic(), Monster({name:'Centaur',cls:'monster',missile:2,missileAttacks:2,hp:10},{count:2 [new]})`. `Monster` has no `count` (Ambush does). |
| 9 | Chalice of Hope | 4+1 | VR | conj | "Cast on globe. All owned structures create one novice each turn. Duration: Turn of casting +3." | B | `Target.globe, Lasts(4), On(When.startOfTurn, Novices(1, undefined, 'casterStructures' [new area]))`. "Owned" = caster's structures incl. Sanctum (R7). |
| 10 | Change of Heart | 4+3 | R | man | "Cast on neutral town or colony. Town joins caster's side. Any group in town is removed from the game." | C | Needs `Target.structure.neutral` [new], `RemoveGroup('occupant')` (remove-from-game), and `ctx.capture(structureId, side)` that runs the capture bookkeeping (owner, novices 0, turn count reset, mana choice). Mana choice outside the turn start: ruling R8. |
| 11 | Charmed Existence | 2+1 | C | alt | "Cast on recruit. Recruit dodges the first attack each round that would normally hit recruit." | C | New cancellable victim event at pipeline step A1 after the level check (`attack:wouldHit`, `data.dodge`), plus per-round token reset on `round:start`. Interacts with Unerring Focus ("cannot be dodged"). |
| 12 | Citizens' Militia | 4+2 | C | alt | "Cast on non-neutral town or colony. Creates four level 0 Vision swordsmen off the board. Before combat, they appear in town when a non-friendly group is adjacent. After all combat, they disappear again. Enemy groups cannot enter town. Dispelled when killed or if town is captured." | C | `Ambush` variant hosted on a structure: appears **into the structure square** (`ctx.appear` refuses structures), recruit (player-owned, not monster) group, `Target.structure.nonNeutral` [new], `UntilCaptured()` [new persistent], and "enemy groups cannot enter" needs a movement entry hook on structure/square spells (shared with Vale of Peace, Mountain Pass). Rules call it a combat-hopper (`Concepts_boardhop.txt`). |
| 13 | Deva's Quiver | 5 | C | alt | "Cast on archer. Archer gets +2 missile damage and +1 level, and ignores opponent's armor." | C | `Target.archer, Grant({missile:2, level:1}), IgnoresArmor()` [new]; engine: `StatDelta.ignoresArmor` passed into `takeDamage(... ignoresArmor)` in `combat.ts attack()` (today hard-coded false). |
| 14 | Emancipation | 2+1 | U | man | "Cast on globe. All monster groups on the board get Emancipated (monster group becomes neutral)." | C | `OnCast(Give('emancipated','allMonsterGroups'))`; helper sets owner neutral. Engine: `changeSides` only flips red/blue; needs `ctx.setOwner(groupId, PlayerId)` incl. neutral (groupSeq, spell owners). |
| 15 | Empathy | 3+2 | C | alt | "Cast on friendly recruit. Enemy group spells cast on recruit's group are squandered, and recruit takes damage equal to the casting cost of the squandered spell." | C | `blocksCast` alone blocks at ordering, so the damage never happens. Needs an execution-time intercept (`spell:executing` event or `interceptCast` hook returning squander + callback) so the opponent may order it and it squanders at execution (R10). |
| 16 | Farm-Boys | 5+1 | U | alt | "Cast on town or colony. Every recruit created in town gets Farm-Boy (-1 level)." | A | `Target.structure, On(When.created, Give('farm-boy','created'))`; helper `farm-boy` = `Grant({level:-1})`, visible (rules list Farm-boy as a visible helper). Same shape as Master Armorer. |
| 17 | Griffin | 4 | R | sum | "H:3 A:1 HP:12 L:2 Nomadic, Flight. Cast within a 3x3 diamond centered on a mountain. Cannot be targeted by Despair individual spells. Receives -1 damage from minions without Flight. Deals magical damage against Shadows." | C | `Target.square.near('mountain') [new]`, `Nomadic(), Monster({...walks:['flight']}), Immune(['despair'])`, `Warded(1,{unless:'flight'}) [new condition, any minion not only recruits]`, `MagicalAgainst({nation:'shadow'}) [new]`: engine must let `attacker:strikes` mark the hit magical (today `magical:false` is fixed in `attack()`). |
| 18 | Hand of Zana | 1 (revolves 1..10) | R | conj | "Cast on globe. All friendly groups gain Flight. Duration: M turns. Revolver (Casting cost M revolves from 1 to 10, starting at 1 and increasing by 1 mana per turn, restarting at 1 when it reaches 10, until cast)." | D | Hand cards are bare ids (`PlayerState.hand: string[]`): a per-instance cost that changes each turn in hand, and a duration equal to the paid cost, need card-instance state. Effect part is easy: globe `stats` giving `walks:['flight']` to owner's minions + duration from a token. |
| 19 | Heartsong | 4+4 | R | hero | "H:2 A:1 HP:7 L:2 Cast on square not adjacent to any structure, and only after turn 25. Creates Heartsong, an Imp Hero swordsman." | B | `Target.square.notNear('structure') [new].afterTurn(25) [new]`, `Hero(), Create({name:'Heartsong',cls:'swordsman',nation:'imp',level:2})`; `Create` must accept a **square** target (new player group there). |
| 20 | Hero's Legacy | 2+1 | C | alt | "Cast on recruit. When recruit dies, all surviving members of its group get Legacy (+1 level)." | B | `Target.recruit, On(When.dies [new, minion:dies on host], Give('legacy','hostGroup'))`; helper `legacy` = `Grant({level:1})`. At `minion:dies` the host is already `dead`, so `minionsOf` excludes it. Incarnate (Life) did this with `Script`; a `When.dies` trigger would retire that Script too. |
| 21 | Illender | 2 | U | man | "Cast on square. Void, lava, and desert become barren land. Barren land becomes plains. Volcano becomes mountain. Swamp becomes forest." | B | `Target.square, OnCast(TerraformMap({void:'barren',lava:'barren',desert:'barren',barren:'plains',volcano:'mountain',swamp:'forest'}))` [new effect]. Square must be empty (square-spell rule), so only empty squares are cleansed. |
| 22 | Inspiration | 3 | R | man | "Cast on globe. A random spell is added to the top of caster's deck, altered to caster's house and mana types." | D | Needs: random pick from all real (non-helper) cards, `ctx.addToDeck(side, cardId, 'top')`, and **transmutation** (per-instance house + cost remapped primary->primary, secondary->secondary). Deck entries are bare ids, so this needs card-instance overrides (same store as Revolver). |
| 23 | Leadership | 4+1 | U | alt | "Cast on recruit. Recruit gets +1 level. Recruit and other swordsmen in its group get +1 hand damage." | A | `Target.recruit, Aura({hand:1},{to:'swordsmen', self:{level:1, hand:1}})`. Same shape as War's Warlord Command. |
| 24 | Leap of Faith | 1 | C | man | "Cast on globe. Caster discards all spells in hand that were not cast this turn." | C | `OnCast(DiscardHand('caster'))` [new]; engine `ctx.discardHand(side)`. At spell execution `resolveTurn` has already removed cast and discarded cards from `hand`, so "not cast this turn" = the current `hand`. |
| 25 | Man of Iron | 6 | U | sum | "H:3 A:2 HP:12 L:2 Nomadic." | A | `Target.square, Nomadic(), Monster({name:'Man of Iron',cls:'monster',hand:3,armor:2,hp:12,level:2})` (no cast clause on the card: R12). |
| 26 | Master Armorer | 3+3 | U | alt | "Cast on friendly town or colony. Every recruit created in structure gets Visionary Armor (+1 armor)." | A | `Target.structure.friendly, On(When.created, Give('visionary-armor','created'))`; helper `Grant({armor:1})`. |
| 27 | Mountain Pass | 1 | C | alt | "Cast on mountain or volcano. Caster's groups can cross this square. (This does not protect groups from volcano damage.)" | C | `Target.square.on('mountain','volcano')` + per-square passability: movement (`canEnterSquare`/`groupCanEnter`, `validateOrders`) must ask spells on the **destination** square (`allowsEnter` hook). Stats-based walks do not work: `computeStats` only sees the square the group stands on. Persistent while terrain is mountain/volcano (Bound needs a two-terrain form). |
| 28 | Pegasus | 6+1 | U | sum | "H:4 A:1 HP:12 L:2 Nomadic, Flight, Moves 2. Cast within a 3x3 diamond centered on a mountain. Receives -1 damage from minions without Flight." | B | `Target.square.near('mountain')`, `Nomadic(), Monster({...walks:['flight']})`, `Warded(1,{unless:'flight'})`, `MovesTwice` for a bot-driven monster (bot sets `movesTwice` each turn). All lang-side; engine already has `setMovesTwice`. |
| 29 | Perfection | 6 | U | alt | "Cast on town or colony. Dispels all structure spells. (This does not destroy colonies.) Town or colony cannot be targeted by structure spells." | B | `Target.structure, OnCast(DispelAll('structure') [extend effect to structure hosts]), Shroud({from:['structure']}) [extend Shroud to structure hosts]`. Does not dispel itself (it becomes active after `onCast`). Colony helper must be exempt (no colony helper exists yet). |
| 30 | Piercing Rays | 1 | U | alt | "Cast on archer. Archer gets +1 missile damage. Vision archer gets additional +2 damage against Shadows." | B | `Target.archer, Grant({missile:1}), Against({nations:['shadow'] [new]},{missile:2, ifHostNation:'vision' [new]})`. `Against` matches victim **house** only today. |
| 31 | Prophet | 3+2 | U | alt | "Cast on recruit. Recruit generates +1 mana of each type associated with its nation for both players each turn." | B | `Target.recruit, On(When.manaPhase, NationMana(1,'both') [new effect: host nation -> house -> 2 mana types, to red and blue])`. A nationless test recruit gives nothing. |
| 32 | Recall | 5+2 | U | man | "Cast on friendly recruit group. Group is removed from the game. For each recruit in group, 1 novice is created in caster's Sanctum." | C | `Target.recruitGroup.friendly, OnCast(Novices('perMember','casterSanctum') [new], RemoveGroup('target'))`. Needs ctx remove-from-game; novices capped at 8 by `addNovices`. |
| 33 | Sanctuary | 4 | R | alt | "Cast on square. At start of combat, any group in square withdraws, ending combat." | A | `Target.square, On(When.startOfCombat(), Withdraw())`. A square-hosted spell only sees `combat:start` of the group on its square (event chain), and `groupMatches` accepts any group when the host is not a group. |
| 34 | Settlement | 8 | R | man | "Cast on recruit group not in a structure. Group is replaced by a colony belonging to the owner of the group. (A new colony dispels its square and changes it to plains.)" | C | `Target.recruitGroup.notInStructure` [new] + "replaced by" (remove group from game, then `ctx.createStructure('colony', owner, pos)` [new]: dispels square spells, terrain plains, colony helper, mana choice R8). Rules: `Pipelines_death.txt` "replaced by", `Elements_structures.txt` colony list. |
| 35 | Shield of Vela | 3+1 | VR | alt | "Cast on recruit. Recruit's hits give Gorgon's Gaze (-1 damage and +1 armor, cumulative. A minion who gets three or more Gorgon's Gaze is killed). Only one in play at a time." | B | `Target.recruit, OnlyOneInPlay() [new canCast], On(When.onHit, Give('gorgons-gaze','victim'))`; helper `gorgons-gaze`: `Grant({hand:-1, missile:-1, armor:1})` + `On(cast) if count>=3 Kill` (a `Threshold(3, Kill())` keyword or `Script`). Gorgon's Gaze is shared with the Gorgon monster (another house). |
| 36 | Spirit Sword | 2 | C | alt | "Cast on swordsman. Swordsman gets +1 hand damage, and now ignores opponents' armor." | C | `Target.swordsman, Grant({hand:1}), IgnoresArmor()`; same engine flag as Deva's Quiver. |
| 37 | Spiritual Advisers | 4+3 | R | man | "M:2 A:0 HP:7 L:1 Cast on globe. One Vision archer is created in every recruit group on the board. (Recruit groups off the board are not affected.)" | B | `Target.globe, Create({name:'archer',cls:'archer',nation:'vision'},{into:'everyRecruitGroup'} [new])`. "Every" includes enemy and neutral groups (R9). Full groups are skipped. |
| 38 | Sublimity | 2+2 | R | alt | "Cast on friendly town or colony. After all combat, each recruit in town gets -2 maximum hit points, or Sublimity is dispelled if town is unoccupied. For each affected recruit, town generates +1 primary mana next turn." | B | `On(When.afterAllCombat, Give('sublimity-mark','hostOccupants'))` + token count + `On(When.manaPhase, AddMana(primary, token))` + dispel-if-unoccupied. Expressible with a `Script` over existing events and tokens; a `per`-token mana effect would make it pure keywords. |
| 39 | Sword of Zana | 6+3 | VR | alt | "Cast on recruit group not in a structure. At start of combat, opposing group dies, ending combat. Dispelled after next combat." | B | `Target.recruitGroup.notInStructure [new], Fleeting(), On(When.startOfCombat(), Kill('opponent'), Withdraw())`. "Not in a structure" is casting-time only (`Elements_spells.txt` names Sword of Zana). |
| 40 | Sword of Zana II | 6+3 | VR | alt | identical text | B | Same composition, own id; deck-equivalent to Sword of Zana (shared 4-copy limit). |
| 41 | Threshold of Order | 4 | C | alt | "Cast on globe. Caster gets +1 Order each turn. May be cast more than once." | A | `Target.globe, Stackable(), On(When.manaPhase, AddMana('order',1))`. **Near-duplicate of War's Point of Clarity and Life's Aura of World.** |
| 42 | Unerring Focus | 1+1 | C | alt | "Cast on recruit. Recruit's attacks always hit and cannot be dodged, regardless of its opponent's level." | C | `Target.recruit, AlwaysHits()` [new]; engine: `StatDelta.alwaysHits` skips the A1 level check and any dodge. |
| 43 | Unicorn Herd | 4+3 | U | sum | "H:2 A:0 HP:7(x3) L:1 Territorial. Creates three Unicorns. If a Unicorn is killed by a recruit, recruit gets Unicorn's Blood (recruit is set to level 0 and cannot gain levels)." | C | `Target.square, Territorial(), Monster({...},{count:3}), On(When.killed('recruit') [new], Give('unicorns-blood','killer' [new scope]))`; helper needs a **level override** (set to 0, not -N) and "cannot gain levels" (block the experience award in `beginTurn` and level grants). New `StatDelta.levelLock` or similar. |
| 44 | Vale of Peace | 2+2 | C | alt | "Cast on town or colony. Monsters cannot enter or be targeted on squares in the 3x3 diamond centered on town." | C | Movement entry hook (deny monster groups entering the 9 squares) + `blocksCast` for monster/monster-group targets standing there. Rules call it a square mother with visible children (`Concepts_mothers.txt`); proposal: one spell computing the area, no children (R11). |
| 45 | Valiant Stand | 2 | U | alt | "Cast on town or colony. While in town, swordsmen in town get +2 hand damage. Dispelled after next combat or if town is captured." | B | `Target.structure, Grant({hand:2},{to:'swordsmen'})` (structure stats already reach the occupants), `Fleeting()` extended to structure hosts (dispel after the occupant's next `combat:after`), `UntilCaptured()` [new persistent: owner unchanged]. |
| 46 | Volunteers | 5+2 | R | conj | "Cast on globe. Before movement, for every new recruit created, a new Vision archer is created in the new recruit's group. Duration: Turn of casting +2." | B | `Lasts(3)` + `Script` recording `minion:created` ids in tokens, then on `movement:before` `addMinion` a Vision archer per recorded recruit. Gap: `addMinion` (spell-created group members) does not dispatch `minion:created` (C-small fix; see F12). |
| 47 | Zana | 4+4 | R | hero | "H:2 A:1 HP:7 L:2 Cast on recruit group. Creates Zana, a Vision Hero swordswoman. While Zana is in play, all monsters join her caster's side." | D | `Target.recruitGroup, Hero(), Create({name:'Zana',cls:'swordsman',nation:'vision',level:2},{with:['zanas-call']})`. Hard part: a continuous ownership override on every monster group (existing and future summons) that reverts when Zana dies or leaves play, interacting with Emancipation and computer control. |
| 48 | Zana's Blessing | 4+2 | U | alt | "M:2 A:1 HP:7(x2) L:1 Cast on recruit group. At start of combat, two level 1 Vision archers are created in group. At end of combat, they are removed from the game. Dispelled after next combat." | C | `Target.recruitGroup, Fleeting(), On(When.startOfCombat(), CreateIn('hostGroup', archer A:1, count 2) [new effect])`, `On(When.combatEnd [new trigger], RemoveCreated)` (track ids in tokens; needs remove-from-game). |
| 49 | Zana's Champion | 4+4 | R | sum | "H:4 A:4 HP:7 L:2 Cast on friendly, unoccupied town or colony. Town or colony is replaced by Zana's Champion, a Vision swordsman. Champion's group and its members cannot be targeted by any group spells or individual spells. Only one in play at a time." | C | `Target.structure.friendly.unoccupied [new]`, `OnlyOneInPlay()`, `ctx.destroyStructure(id)` [new], then a player recruit group on that square with the Champion, plus a Shroud that follows the Champion's group (group-aura style). |
| 50 | Zana's Escape | 3 | C | conj | "Cast on globe. When any friendly recruit is dying, recruit returns to life, is fully healed, has all group spells dispelled, and disappears, and Zana's Escape is dispelled. Recruit's new group reappears in a random friendly structure at start of turn if it is unoccupied, or on the earliest turn thereafter." | C | `minion:dying` + `ctx.cancel()` exists (dying-cancel). Missing: `ctx.leaveGroup(minionId)` (new group, group spells dropped per `Concepts_leavesgroup.txt`), `hide` of that new group, a controller helper (Escape itself is dispelled) that re-appears it **into a structure** at `turn:start` (`ctx.appear` refuses structure squares). |

Class counts: A = 2, 7, 16, 23, 25, 26, 33, 41 (8). B = 5, 8, 9, 19, 20, 21, 28, 29, 30, 31, 35, 37, 38, 39, 40, 45, 46 (17).
C = 1, 3, 4, 6, 10, 11, 12, 13, 14, 15, 17, 24, 27, 32, 34, 36, 42, 43, 44, 48, 49, 50 (22). D = 18, 22, 47 (3).

Near-duplicates of implemented cards: Abstention ~ Court Politics (+ II helper); Army of Light ~ Allies; Threshold of Order ~
Point of Clarity / Aura of World; Leadership ~ Warlord Command; Farm-Boys / Master Armorer ~ the `When.created` pattern;
Sword of Zana ~ Lienna's Sigil (start-of-combat trigger + Withdraw); Hero's Legacy ~ Incarnate (death trigger, now Script).

## 4. Features needed, by cards unlocked

Lang-layer (B) and engine (C) features. "Unlocks" lists every card that needs the feature; a card may need several.

| ID | Feature | Layer | Unlocks | n |
|---|---|---|---|---|
| F1 | **Target modifiers**: `Target.monster`; structure `.neutral` / `.nonNeutral` / `.unoccupied`; group `.notInStructure`; square `.near(terrain)` (3x3 diamond = Chebyshev <= 1, R1) / `.notNear('structure')`; `.afterTurn(n)` | lang | Bella's Sigil, Change of Heart, Citizens' Militia, Zana's Champion, Settlement, Sword of Zana, Sword of Zana II, Griffin, Pegasus, Heartsong | 10 |
| F2 | **Remove from game**: `ctx.remove(minionId)` and `ctx.removeGroup(groupId)` (death category 'removed', no events), effects `Remove`/`RemoveGroup` | engine | Ascension, Change of Heart, Recall, Settlement, Zana's Blessing (and Zana's Champion's "replaced by" path) | 5 |
| F3 | **Combat attack flags**: `StatDelta.ignoresArmor`, `alwaysHits` (skip A1, undodgeable), dodge event at A1 (`attack:wouldHit`, cancellable), strike-time `magical` flag settable from `attacker:strikes` | engine | Spirit Sword, Deva's Quiver, Unerring Focus, Charmed Existence, Griffin | 5 |
| F4 | **Structure operations**: `ctx.capture(st, side)`, `ctx.createStructure('colony', owner, pos)` (dispels square, plains, colony helper), `ctx.destroyStructure(st)`, deferred mana-type choice (R8), `UntilCaptured()` persistent | engine | Change of Heart, Settlement, Zana's Champion, Citizens' Militia, Valiant Stand | 5 |
| F5 | **New triggers + scopes**: `When.hit` (victim, attack:hit with attacker), `When.dies`, `When.killed(by?)` with scope `killer`, `When.combatEnd`; scopes `friendlyRecruits`, `allMonsterGroups`, `killer` | lang | Aurora, Hero's Legacy, Atonement, Unicorn Herd, Zana's Blessing, Emancipation | 6 |
| F6 | **Effect extensions**: `TerraformMap`; `Novices` to all caster structures / caster Sanctum / per member; `NationMana`; `CreateIn` at trigger time and into every recruit group; `DispelAll` on a structure; `Shroud` for structures; `Create` on a square target | lang | Illender, Chalice of Hope, Recall, Prophet, Zana's Blessing, Spiritual Advisers, Perfection, Heartsong | 8 |
| F7 | **Movement entry hooks**: spells on the destination square/structure may allow (`allowsEnter`) or forbid (`blocksEnter`) a group; used by `canEnterSquare`, `validateOrders`, bots, `legalDirections`; plus `StatDelta.immobile` | engine | Mountain Pass, Citizens' Militia, Vale of Peace, Bella's Sigil | 4 |
| F8 | **Monster extensions**: `Monster` `count`, bot `MovesTwice`, `Warded(n,{unless:'flight'})` (any minion attacker), cast-near-terrain target | lang | Centaurs, Unicorn Herd, Pegasus, Griffin | 4 |
| F9 | **Hand/deck actions**: `ctx.discardHand(side)`, `blocksDiscard` hook in `validateOrders` | engine | Leap of Faith, Atonement, Abstention | 3 |
| F10 | **Ownership change to any player**: `ctx.setOwner(groupId, 'red'|'blue'|'neutral')` (groupSeq, minion and spell owners, control) | engine | Emancipation, Zana (+ Zana's ongoing override, D) | 2 |
| F11 | **Off-board extras**: `ctx.appear` into a structure square (recruit groups only), `ctx.leaveGroup(minionId)` (drops group spells), structure-hosted Ambush controller | engine | Citizens' Militia, Zana's Escape | 2 |
| F12 | `minion:created` also fired by `addMinion` (group ref), with a re-entrancy guard | engine | Volunteers (and future "every recruit created" cards) | 1 |
| F13 | `OnlyOneInPlay()` (canCast: no active spell of this card on the board, any owner) | lang | Shield of Vela, Zana's Champion | 2 |
| F14 | Level override / no level gain (`StatDelta.levelSet`, block exp award) | engine | Unicorn Herd | 1 |
| F15 | Spell transfer to a new host (`ctx.transferSpell`) | engine | Atonement | 1 |
| F16 | Execution-time cast intercept (squander + callback with the cast's cost) | engine | Empathy | 1 |
| F17 | `Against` by victim nation + host-nation condition | lang | Piercing Rays (Griffin's magical-vs-Shadows uses the same matcher) | 2 |
| F18 | `Fleeting` for structure hosts | lang | Valiant Stand | 1 |
| F19 | Card instances in hand/deck (per-instance cost, house, mana; revolving cost; insert at top of deck; random real card) | engine (D) | Hand of Zana, Inspiration | 2 |
| F20 | Continuous ownership override with revert (monsters join Zana's side while she lives, incl. future summons; needs a `group:summoned` event) | engine (D) | Zana | 1 |

Top 5 by cards unlocked: F1 target modifiers (10), F6 effect extensions (8), F5 triggers/scopes (6), F2 remove-from-game
(5, tied with F3 combat flags 5 and F4 structure ops 5).

## 5. Shared mechanics (other houses will need these)

| Mechanic | Hope cards | Likely elsewhere (names from the rules pages / card list) |
|---|---|---|
| Remove from game, "replaced by" | Ascension, Recall, Change of Heart, Settlement, Zana's Blessing, Zana's Champion | Cessao Spiral, Dryad's Favors, Shifting Sands, Void, Lycanthropy, Devolution, Instability, Volgaris, Jade Gargoyle, Civilize |
| Create/destroy/capture structures, colony helper | Settlement, Change of Heart, Zana's Champion | Civilize, Found City, Dracha, Encampment, Ghost Town, Auberol's Grace, Gogar's Wrath, Maelstrom, Earthquake, Justicars, Defensive Pact, Ancestral Home |
| Ignores armor / magical combat damage | Spirit Sword, Deva's Quiver, Griffin | Master Fletcher (Dwarven Arrows), Thermites vs Gargoyles (War, currently omitted by ruling), Yeoman |
| Movement entry hooks, square mothers | Mountain Pass, Vale of Peace, Citizens' Militia | Drought, Justicars' Reserve, Law of the Land, Mirage, Siren Song, Ill Winds |
| Immobile as a spell effect | Bella's Sigil | Standoff ruling (Life) noted the missing "cannot be moved" stat |
| Hand discard / no discard | Leap of Faith, Atonement, Abstention | other "discard your hand" / "prevent discarding" cards (`Elements_deckhand.txt`) |
| Card instances (Revolver, Expansive, transmute, deck insert) | Hand of Zana, Inspiration | all Revolvers/Expansives (`Axioms_manatypes.txt`), Recursive (backlog E10), transmuting effects |
| Ownership to neutral / any side | Emancipation, Zana | Betrayal-type, Tindelhunden side changes, Alabaster Guardian |
| Leave group, boardhop into structure | Zana's Escape, Citizens' Militia | Vision Quest, Soul Jar, Ch'tai Exchange, Seelie Court (Life, not implemented) |
| Monster count / moves-2 / Flight ward | Centaurs, Unicorn Herd, Pegasus, Griffin | many monster packs; "receives -1 damage from minions without Flight" is a recurring flyer clause (`Elements_terrainswalks.txt` "Limitations of Flight") |
| Gorgon's Gaze helper | Shield of Vela | Gorgon monster |
| Burst of X / Point of X generators | Burst of Clarity, Threshold of Order | one per mana type across houses |
| "Only one in play at a time" | Shield of Vela, Zana's Champion | recurring rare clause |
| Deck version equivalence | Sword of Zana / II | Apocalypse/II, Bleak Isle/II, Water Breathing/Walking, Mirage/Neb's Mirage |
| `When.dies` / `When.killed` triggers | Hero's Legacy, Atonement, Unicorn Herd | Incarnate (Life, Script today) |

## 6. Rules ambiguities and proposed rulings

| # | Question | Ruling |
|---|---|---|
| R1 | What is a "3x3 diamond" (Griffin, Pegasus, Vale of Peace)? | The 9 squares within Chebyshev distance 1 of the centre. The original board is drawn rotated 45 degrees, so its "3x3 diamond" is our 3x3 block (`Concepts_mothers.txt`: "the 9 squares in a 3x3 diamond"; Territorial already uses Chebyshev 1). |
| R2 | Griffin/Pegasus "cast within": what may the target be? | An empty, non-Sanctum square (square-spell rule) within the diamond of any mountain, including the mountain itself (Flight lets them stand there). |
| R3 | Burst of Clarity "next turn", and two copies? | A conjuration lasting 2 turns, non-visible (`Undispellable`) so copies (either player's) stack and it cannot be dispelled; it adds +2 Clarity at the next mana generation only. |
| R4 | Abstention with "May be cast more than once" while it forbids the caster's globe spells | Copies ordered the same turn: the first executes, the caster's later globe spells that turn (including a second Abstention) squander. Stackable matters for the opponent's own copy and for Abstention II. Validation while ordering checks the current state, so the order is accepted and squanders at execution. |
| R5 | Abstention "cannot discard" | Rejected while ordering (like Forbid), for the caster only, while active. |
| R6 | Army of Light / Farm-Boys / Valiant Stand on neutral or enemy structures | Allowed (texts say "town or colony"). Novices go to the structure; a later capture eliminates them. Farm-Boys on an enemy town is a curse. |
| R7 | Chalice of Hope: "owned structures", "each turn" | The caster's structures including the Sanctum, at start of turn, on each of the 3 turns after casting (casting turn has no start of turn left). Capped at 8 novices. |
| R8 | Mana-type choice for a structure captured or created mid-turn (Change of Heart, Settlement) | The structure has no mana type until the next start of turn, where it joins `pendingMana` and its owner chooses as for a normal capture. It produces no mana before that. |
| R9 | Spiritual Advisers "every recruit group" | Literal: every on-board recruit group of any owner (enemy and neutral groups gain a Vision archer that serves their owner). Full groups are skipped; no squander. |
| R10 | Empathy: block at ordering or squander at execution? | Squander at execution so the damage happens: enemy group spells on the host's group may be ordered; at execution they squander and the host takes magical damage equal to the spell's total printed cost (sum of both mana types). Friendly spells are unaffected. |
| R11 | Vale of Peace mother/children | One structure-hosted spell that computes the 9-square area; no child spells. Monsters already inside may stay and leave; they cannot step onto any of the 9 squares; individual and group spells targeting monsters standing there are rejected. Neutral monsters included. |
| R12 | Man of Iron / Unicorn Herd have no cast clause | Cast on any empty square (default monster rule, `Concepts_monsters.txt`). |
| R13 | Citizens' Militia ownership, "non-friendly", "enemy" | All relative to the caster (spell owner). The militia is the caster's player recruit group (not computer-controlled). It appears only if the town square is empty; it never joins a group already there. "Enemy groups cannot enter" = groups hostile to the caster, including neutral monsters (they never enter structures anyway). Dispelled when all four die or the structure's owner changes. |
| R14 | Heartsong is an Imp: which house does he serve (for Immune/Against checks)? | Nation imp (Imp stats and round-2 bonus) but `house: 'hope'` on the minion, matching the lore of his conversion. Requires `Create` to allow a house override. |
| R15 | Heartsong "only after turn 25" | Castable from turn 26 on. "Not adjacent to any structure": no structure (incl. Sanctum) among the 8 surrounding squares. |
| R16 | Zana's Champion "only one in play" and the Shroud | Unique per board, any owner. Shroud covers the Champion and the group it is in (follows him if groups merge). The structure is destroyed ("replaced by"), so its spells end and it produces nothing. |
| R17 | Charmed Existence dodge vs Unerring Focus and level misses | Dodge applies only to an attack that passed the level check; it counts as a miss (attacker `misses` +1, no hit or damage events). One dodge per round (token reset at `round:start`). `alwaysHits` attackers cannot be dodged. |
| R18 | Aurora's Aura: "hit in combat" | Any attack that reaches `attack:hit` with an attacker (including 0-damage and bounced hits). The +1 armor stays in the current round's armor pool for that round (round armor is reset only at round start). |
| R19 | Hero's Legacy / Legacy stacking | Each Legacy is a separate visible helper; several Legacies stack. |
| R20 | Sublimity: "primary mana", minimum max HP | Primary of the town owner's house. Max HP never drops below 1 (engine clamp), so Sublimity never kills; it keeps draining. |
| R21 | Volunteers "every new recruit" | Only the caster's recruits, created by any means since the previous `movement:before`; archers made by Volunteers do not trigger it. If the group is full, nothing is created. |
| R22 | Atonement transfer | On `minion:killed` with a recruit to blame, the spell moves to the killer before burial; if the killer is a monster or nobody, it is simply lost. The discard hits the attacker's owner even if the attacker is a monster (owner neutral: nothing). |
| R23 | Unicorn's Blood | Level is forced to 0 after all modifiers and experience is never awarded while it lasts; it is a visible helper (dispellable). |
| R24 | Emancipation persistence | Ownership change is permanent (helper is a visible marker only); dispelling it does not return the monsters. |
| R25 | Zana and Emancipation together | Zana's effect is continuous: while she lives, every monster group (including neutral ones and later summons) belongs to her caster; when she leaves play each group returns to the owner it had before (Emancipated ones stay neutral). |
| R26 | Hand of Zana duration | Equal to the mana actually paid (M), counting the casting turn. Until card instances exist (F19), ship a fixed-cost version only behind a `// RULING:`. |
| R27 | Inspiration "random spell" | Uniform over real (non-helper) cards of all houses known to the engine, excluding Heroes already cast by the caster; the copy keeps its text, takes Hope as its house and maps primary->Clarity, secondary->Order. |
| R28 | Mountain Pass "caster's groups" | Every group the caster owns, including computer-controlled monster groups. Volcano damage still applies. Dispelled if the square stops being mountain or volcano. |
| R29 | Leap of Faith in the same turn as a discard | The chosen discard happens first (bookkeeping before execution), then Leap of Faith discards the rest. |
| R30 | Sword of Zana's kill category | "Dies" (no blame), so no experience and no "when killed" triggers; then combat ends for both groups. |

## 7. Proposed implementation order (cheapest first)

| Step | Work | Cards done after the step (cumulative) |
|---|---|---|
| 1 | Write the 8 A cards with existing keywords + helpers (farm-boy, visionary-armor) | 8 |
| 2 | F1 target modifiers + F13 OnlyOneInPlay + F18 Fleeting on structures + `UntilCaptured` (lang only) | + Sword of Zana I/II, Valiant Stand (partially, capture check is a persistent owner test) = 11 |
| 3 | F5 triggers/scopes + F6 effect extensions + F8 monster extensions + F17 Against by nation (lang only) | + Aurora, Hero's Legacy, Illender, Chalice of Hope, Prophet, Spiritual Advisers, Perfection, Centaurs, Pegasus, Piercing Rays, Heartsong, Shield of Vela, Sublimity = 24 |
| 4 | Small engine: F3 stat flags (ignoresArmor, alwaysHits, dodge event, strike magical), F12 created-on-addMinion | + Spirit Sword, Deva's Quiver, Unerring Focus, Charmed Existence, Griffin, Volunteers = 30 |
| 5 | Small engine: F2 remove-from-game, F9 discard actions/hook, F14 level lock, F15 spell transfer | + Ascension, Leap of Faith, Abstention, Unicorn Herd, Atonement, Zana's Blessing, Recall = 37 |
| 6 | Medium engine: F7 movement hooks + immobile stat, F10 setOwner | + Mountain Pass, Vale of Peace, Bella's Sigil, Emancipation = 41 |
| 7 | Medium engine: F4 structure ops + deferred mana choice, F11 appear-into-structure/leaveGroup, F16 cast intercept | + Change of Heart, Settlement, Zana's Champion, Citizens' Militia, Zana's Escape, Empathy = 47 |
| 8 | Hard: F20 ownership override (Zana), F19 card instances (Hand of Zana, Inspiration) | 50 |

## 8. Risks

| Risk | Detail |
|---|---|
| Movement hooks touch four places | `canEnterSquare`, `groupCanEnter` (validateOrders), `legalDirs` (bots), and swamp/slide logic must all consult destination spells, or orders validate but fail at movement (or the reverse). |
| Structure lifecycle is new | Capture outside start of turn, colony creation and destruction change `structures`, initiative deltas, novice counts and `pendingMana`; tests must cover a capture during spell execution followed by the next turn start. |
| Remove-from-game during combat | Zana's Blessing removes minions at end of combat; `fight()` loops over groups by id, so removal must run after `combat:end` dispatch, not inside an attack. |
| Ownership flips mid-turn | Emancipation/Zana change owners after move orders are set; `groupSeq` and `control` must stay consistent, and a flipped group's move order should be cleared. |
| Card instances | Hand and deck are `string[]`; Revolver and Inspiration need an instance layer that orders, UI and save state all see. Largest single change; defer. |
| Empathy timing | Ordering-time `blocksCast` and execution-time squander differ; mixing both models for different cards must be explicit in `castCheck`. |
| Aura naming | "Aura" (Aurora's helper) collides with the `Aura` keyword term (Group aura) in printed text and glossary; use "Aurora's Aura" or similar. |
| Rules source gone | The rules pages now 404; any further mechanic research must rely on the saved `research/rules/*.txt` and the rulings above. |
