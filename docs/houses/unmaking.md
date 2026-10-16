# House of Unmaking: card analysis (research, no code)

Source: `packages/cards/data/houses/unmaking.json` (scraped 2026-10-16, site house id 7), rules pages in `research/rules/`,
the lang layer in `packages/cards/src/lang/**` and the engine in `packages/engine/src/*`.
Classes: **A** = expressible today with existing keywords; **B** = needs a small lang addition (keyword, effect, trigger,
scope or target builder); **C** = needs a new engine feature (event, ctx action, state or rule); **D** = special / hard.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 52 (scrape reported 52, wrote 52) |
| Mana | Strife primary (148 total pips), World secondary (76 pips); 14 cards are Strife-only |
| Nation | Misfit: 9 HP, no terrainwalk, no combat bonus (`NATIONS.misfit` already correct) |
| Rarity | Common 17, Uncommon 17, Rare 13, Very Rare 5 |
| Expansion | Classic 18, Revolutions 11, Allies & Traitors 9, Oppositions 7, Bloodlines 5, Whispers 2 |
| Spell kinds | 7 monsters (implicit square target), 2 heroes, 7 globe, 10 recruit, 7 minion, 6 structure, 5 square/terrain, 8 group |
| Classification | **A 7, B 23, C 19, D 3** |

Cost curve (total mana): 1: 8, 2: 6, 3: 9, 4: 9, 5: 4, 6: 3, 7: 4, 8: 7, 9: 1, 10: 1. Cheap (1-2 mana) debuffs and
transformations dominate; the 8-mana block is the heroes, Gatemouth, Bolt of Somersaults, Runts, Zurzavar. Gyre's cost
is a Revolver (scraped as `{strife:1}`, its starting value).

### Scrape check

All 52 cards have name, slug, cost, rarity, text. `castOn` is null on the 7 monster cards (Boggart, Cockatrice, Fingle's
Folly, Gatemouth, Gnax, Manticore, Werewolf): by design, monster texts have no "Cast on" (same as War/Life monsters in
`cards.json`); they target an empty square. Parser artefacts (not fixed, shared scraper):

| Card | Problem |
|---|---|
| Fingle, Horsing Around | `player- controlled` (line-break hyphen kept with a space) |
| Chaos Fog | flavor has `Fingle\\'s` (escaped apostrophe left in) |
| Devolution | text starts `L:0, Neutral.` (stat fragment of the created Misfits, no H/A/HP) |
| Destroy Creation | `castOn` = `minion, even if it is concealed` (qualifier in the target field; also Mitosis `... of two or less`, Runts `non-neutral ...`, Mudslinging `plains square`) |
| Gnax | stat line `HP:4(x2-8)` (variable count, not attacks) |
| Gyre | cost is the Revolver start value, not a fixed cost |

## 2. Theme and mechanics

Unmaking is chaos and decay: debuff enemy minions (armor and damage loss), random effects everywhere, transformation
(nation change into Misfit, Chaos Features), dispel/anti-magic, terrain destruction (Void, Changing Lands, Jumping Land,
Maelstrom), removal without death, teleport/random movement, and neutral monsters. House mechanics in order of weight:

| Mechanic | Cards | Engine state today |
|---|---|---|
| Random outcomes (seeded rng) | 17 | `ctx.random()` exists |
| Dispel (individual / group / structure / globe / all) | 9 | `DispelAll` only on a group target |
| Chaos Feature (random minion enchantment; 3 = Misfit) | 6 | none |
| Nation change ("changes into a Misfit / random nation") | 4 direct (+4 via Chaos Feature) | none |
| Removed from the game / replaced by | 6 | engine has death category `'removed'`, no ctx action |
| Teleport / forced random movement | 6 | `RandomMove` (target group only), `moveGroup` fires movement events |
| Structure destruction / colonies | 4 | `colony` kind exists, never created or destroyed |
| Armor and damage debuffs | 7 | `Grant` handles static ones |

Nation ability and flavour affecting stats: Misfits have 9 HP and nothing else, so every created Misfit (Fingle HP:9,
ThudThud HP:9, Hollow Jester HP:9, Devolution and Mitosis Misfits, Chaos Feature conversions) uses `recruitSpec(cls,
'misfit')`. Printed hero lines already include the nation (Fingle H:2 A:1 = swordsman base; ThudThud M:4 = archer 2 +
Kumatru Archer +2). Hollow Jester prints H:0 (a swordsman with no hand damage: set `hand: 0`). Devolution Misfits are L:0.
Changing into a Misfit raises max HP 7 -> 9 (see ruling R2).

## 3. Classification table

Keyword names in the A/B column are existing constructors unless marked *new*.

| # | Card | Cost S/W | Rarity | Text (quoted) | Class | Keyword composition / what is missing |
|---|---|---|---|---|---|---|
| 1 | Armor to Meat | 2/0 | C | "Cast on recruit. Recruit gets -2 armor." | A | `Target.recruit`, `Grant({armor:-2})`. Near-dup of War `thermite-damage` helper. |
| 2 | Bedlam | 3/2 | R | "Cast on square. At start of turn, each minion in square gets Chaos Feature. (...)" | C | `Target.square`, `On(When.startOfTurn, Give('chaos-feature','squareOccupants'*new*))`. Needs Chaos Feature (T7) and a square-occupant scope. Square spell persists after a group enters. |
| 3 | Boggart | 2/1 | U | "H:3 A:0 HP:12 L:1 Nomadic." | A | `Nomadic()`, `Monster({hand:3,hp:12,level:1})`, `Target.square`. |
| 4 | Bolt of Somersaults | 5/3 | U | "Cast on group. Group is teleported to a random unoccupied non-structure square." | C | `OnCast(Teleport('randomSquare')*new*)`. Needs `ctx.teleport` (no movement events, fatal terrain checked later per rules case study) + random-square picker. |
| 5 | Burst of Strife | 2/0 | C | "Cast on globe. Caster gets +2 Strife next turn." | A | conjuration on globe: `Lasts(2)`, `On(When.manaPhase, AddMana('strife',2), Expend())`. Same as Body's Burst of World; a `NextTurn` sugar keyword is optional. |
| 6 | Carapace | 1/0 | C | "Cast on minion. Minion gets +1 armor." | B | `Target.minion`*new builder*, `Grant({armor:1})`. |
| 7 | Changing Lands | 4/2 | C | "Cast on square. When cast, and at start of turn, square becomes any of plains, forest, barren land, ice, desert, lava, mountain, swamp, volcano, or water, at random. On and after turn of casting +2, square may also become Void." | B | `OnCast(TerraformRandom(list)*new*)`, `On(When.startOfTurn, TerraformRandom(list, {voidFromTurn:3}))` (age token). Ice/swamp outcomes inert until T11. |
| 8 | Chaos Feature | 1/0 | U | "Cast on minion. Minion gets a random minion alteration or conjuration. (A recruit who gets 3 or more Chaos Features changes into a Misfit.)" | D | Needs: a pool of all real individual alterations/conjurations across houses, cast as helper; a per-minion counter; nation change at 3. See T7 and ruling R1. |
| 9 | Chaos Fog | 1/1 | U | "Cast on recruit. Every other member of its group is concealed. Recruit remains visible. (...)" | B | `Aura({concealed}*new GrantStats flag*, {self: {}})`. Group mother (rules list it). |
| 10 | Cockatrice | 4/2 | U | "H:3 A:0 HP:12 L:1 Nomadic. Cockatrice's hits give Cockatrice's Gaze (-1 damage and +1 armor, cumulative. A minion who gets three or more Cockatrice's Gaze is killed)." | B | `Nomadic`, `Monster`, `On(When.onHit, Give('cockatrices-gaze','victim'))`; helper `Grant({hand:-1,missile:-1,armor:1})` + `Threshold(3, Kill())`*new* (count copies of this helper on host). |
| 11 | Cruel Greaves | 1/0 | C | "Cast on recruit. Recruit takes N hit points of damage, where N is recruit's armor." | B | `OnCast(Damage({stat:'armor'}*new amount form*, 'target'))`. |
| 12 | Destroy Creation | 2/2 | C | "Cast on minion, even if it is concealed. Minion is removed from the game. (...) World Drain (caster gets -1 World each turn, may be cast more than once) is cast on the globe." | C | `Target.minion.ignoresConcealment`*new*, `OnCast(Remove('target')*new*, CastOn('world-drain','globe')*new*)`; helper `Stackable`, `On(manaPhase, AddMana('world',-1))` with pool clamp at 0. Needs `ctx.remove(minionId)` (engine has `killMinion(...,'removed')`). |
| 13 | Devolution | 3/0 | U | "L:0, Neutral. Cast on monster group. Monster group is replaced by an equal number of neutral Misfits of random class. (...)" | C | `Target.monsterGroup`*new builder*; needs `ctx.replaceGroup` (remove group without death + summon neutral recruit group at same square), random class, L:0 Misfits. |
| 14 | Disintegrate | 2/2 | C | "Cast on minion. Minion dies." | B | `Target.minion`*new*, `OnCast(Kill('target'))`. |
| 15 | Entropia | 5/2 | R | "Cast on town or colony. Colony is destroyed. Dispels all spells on town. Town cannot be targeted by structure spells." | C | `Dispel('structure')`*new*, `Shroud({from:['structure']})`*extend*; needs `ctx.destroyStructure` + colony lifecycle. Near-dup of Body's Ancestral Home. |
| 16 | Ergotism | 2/1 | U | "Cast on recruit. At start of turn, recruit takes 1 hit point of damage. When recruit is dying, recruit is fully healed, has all individual spells dispelled (including Ergotism), and changes into a Misfit." | C | `On(When.startOfTurn, Damage(1))`, `On(When.dying*new*, CancelDeath*new*, Heal('full'), Dispel('individual'), ChangeNation('misfit')*new*)`. Needs `ctx.changeNation`. Same shape as Abomination's Larval Imp. |
| 17 | Erisian Blade | 1/1 | C | "Cast on recruit. Recruit gets +1 hand damage for every nation in its group." | B | `GrantPer('nationsInGroup', {hand:1})`*new* (live count of distinct nations). |
| 18 | Fingle | 4/4 | R | "H:2 A:1 HP:9 L:2 Cast on recruit group. Creates Fingle, a Misfit Hero swordsman. Every player-controlled group in the eight squares surrounding Fingle moves in a random legal direction. (...)" | B | `Hero`, `Create({name:'Fingle',cls:'swordsman',nation:'misfit',level:2},{with:['fingles-chaos']})`; helper `Undispellable`, `On(When.beforeMovement, RandomMove('ring8')*new scope*)`. |
| 19 | Fingle's Folly | 6/2 | U | "H:2(x4) A:2 HP:16 L:0 Nomadic. Neutral. Four attacks. When Fingle's Folly dies in combat, it explodes as a Fireball (5 hit points of damage) on opposing group." | B | `Nomadic`, `Monster({hand:2,handAttacks:4,armor:2,hp:16,level:0},{neutral:true})`, `On(When.diesInCombat*new*, Damage(5,'opponent'))` (opponent from combat context). |
| 20 | Fizzle | 2/2 | U | "Cast on globe. Dispels a random spell on the globe." | B | `OnCast(Dispel('globe', {random:1})*new*)`. |
| 21 | Forbidden Ichor | 1/0 | U | "Cast on recruit. Recruit changes into a member of a random nation." | C | `OnCast(ChangeNation('random')*new*)`; needs `ctx.changeNation`. |
| 22 | Gatemouth | 4/4 | VR | "H:1 A:0 HP:3 L:0 Nomadic. Neutral. At start of turn, gets -1 maximum hit point. Before combat, all adjacent groups are teleported to random unoccupied non-structure squares not adjacent to this Gatemouth." | C | `Monster(...,{neutral:true})`, `On(startOfTurn, Decay maxHp)`*new token grant*, `On(When.beforeCombat*new*, Teleport('adjacentGroups','randomNotAdjacent'))`. Needs `ctx.teleport` and a "max HP 0 = dies" rule (`computeStats` clamps maxHp >= 1). |
| 23 | Gnax | 4/2 | R | "H:2 A:0 HP:4(x2-8) L:0 Territorial. Creates two to eight Gnax. When a Gnax damages a Dwarf, the Dwarf gets Chaos Feature. (...)" | C | `Monster` with `count:{min:2,max:8}`*new*, `On(When.onDamage({nation:'dwarf'})*new filter*, Give('chaos-feature','victim'))`. Depends on Chaos Feature. |
| 24 | Gyre | M/0 | R | "Cast on group. Group gets M total Chaos Features, assigned randomly. (...) Revolver (Casting cost M revolves from 1 to 10, ...)" | D | Revolver (per-card-in-hand cost state, T13) + Chaos Feature. |
| 25 | Hollow Jester | 3/2 | R | "H:0 A:1 HP:9 L:1 Cast on recruit group. Hollow Jester is a Misfit swordsman. Group cannot add any new recruits. At start of turn, a random other recruit in group gets Chaos Feature. Duration: N turns, where N is the number of recruits in group. On expiration, Hollow Jester is removed from the game." | C | `Create` with helper carrying: group no-join flag*new engine hook*, `On(startOfTurn, Give('chaos-feature','randomOtherRecruit'*new*))`, duration set at cast (`createSpell turns`), `onExpire: Remove host`. Depends on Chaos Feature. |
| 26 | Horsing Around | 2/1 | C | "Cast on friendly recruit group. Group moves twice this turn in its direction of travel. A player-controlled group moves in a random legal direction toward an unoccupied square." | B | `Target.recruitGroup.friendly`, `OnCast(MoveTwice(), RandomMove({unoccupied:true}*new option*))`. Near-dup of War **Amok**. |
| 27 | Instability | 2/2 | U | "Cast on globe. Each monster group on the board is replaced by a new random monster group that can be targeted on squares. A monster group that cannot be replaced is removed from the game instead. (...)" | D | Needs every house's monster summonings in a pool, `replaceGroup`, and per-square legality. Only meaningful once all houses exist. |
| 28 | Iron Shillelagh | 2/1 | C | "Cast on recruit. When recruit damages an opponent, opponent has all individual spells dispelled. If opponent is a Dwarf, opponent's group has all group and individual spells dispelled. Duration: Turn of casting +3." | B | `Lasts(4)`, `On(When.onDamage, Dispel('victim',{individual}))`, `On(When.onDamage({nation:'dwarf'}), Dispel('victimGroup',{group,individual}))`. |
| 29 | Jester at Court | 1/1 | VR | "Cast on town or colony. At start of turn, Jester at Court tells both players a random card that isn't on top of structure owner's deck. (...)" | C | `On(startOfTurn, Reveal*new*)`; needs a public reveal log entry surfaced by `view.ts` and the client. No rules effect. |
| 30 | Jinx | 1/0 | R | "Cast on minion. Minion gets -2 hand and missile damage. If minion is killed, Jinx transfers to the killer." | C | `Target.minion`, `Grant({hand:-2,missile:-2})`, `On(When.killed*new*, Transfer('killer')*new*)`; needs `ctx.moveSpell(spellId, host)`. |
| 31 | Jumping Land | 2/1 | C | "Cast on mountain. Before combat, mountain has a 60% chance to move to a random adjacent non-structure, non-mountain square, leaving plains. Any group on the mountain moves with it. Any group in the new square is removed from the game. If mountain enters Void, it falls in." | C | `Target.square.on('mountain')`; needs `ctx.teleport`, `ctx.removeGroup`, `ctx.moveSpell` (square spell follows its mountain). |
| 32 | Leechwood | 2/2 | U | "Cast on forest. Affects all contiguous forest squares. When cast, at start of turn, and when group enters square, groups in squares have all spells dispelled." | B | `OnCast(GiveSquares('leechwood-square','forest'))` (Faerie Glade pattern); child: `Bound('forest')`, `OnCast` not allowed on helper so `On(startOfTurn/enter, Dispel('squareGroup',{group,individual}))` + immediate pass in parent onCast. |
| 33 | Maelstrom | 2/2 | VR | "Cast on friendly town or colony. On expiration, town or colony is destroyed, and square becomes Void. Duration: Turn of casting +2." | C | `Target.structure.friendly`, `Lasts(3)`, `onExpire` -> `ctx.destroyStructure` + `setTerrain(void)` (group in it is removed). |
| 34 | Magnetic Accrual | 3/2 | U | "Cast on recruit. Recruit absorbs all armor from its group. (Every other recruit gets -A armor ... Target recruit gets +N armor ... These stat changes cannot be dispelled.)" | B | `OnCast(Script)` that snapshots armor and casts an undispellable token helper `armor-shift` (`stats` reads `tokens.a`). New generic `TokenGrant` helper useful elsewhere. |
| 35 | Manticore | 5/2 | R | "H:8 A:0 HP:10 L:2 Territorial. Withdraws at the start of combat round 3." | A | `Territorial`, `Monster({hand:8,hp:10,level:2})`, `On(When.eachRound(3), Withdraw())`. |
| 36 | Mitosis | 3/1 | U | "Cast on friendly recruit group of two or less. For every Misfit in group, Mitosis creates another Misfit of the same class, and all Misfits in group are lowered to 5 current hit points." | B | `Target.recruitGroup.friendly.maxSize(2)`*new*; `Script` with `addMinion(recruitSpec(cls,'misfit'))` per Misfit, then `hp = min(hp,5)` (needs `ctx.setHp` or damage by difference). |
| 37 | Mudslinging | 1/1 | U | "Cast on plains square. One random square within all contiguous plains squares becomes swamp. (Group in swamp can exit only in the most recent direction from which any group entered that swamp.)" | C | `Target.square.on('plains')`, `OnCast(TerraformRandom('swamp','contiguous'))`; swamp exit rule is not in the engine (T11). |
| 38 | Ort | 2/2 | C | "Cast on recruit group. Creates one or two recruits of random nation and class, or one or two recruits in group dies." | B | `OneOf*new*([Create({randomNation, randomClass*new*, count:1-2}), Kill('randomMembers', 1-2)])`. |
| 39 | Pages to Dust | 7/0 | VR | "Cast on globe. At start of turn, both players discard all spells in hand that were not cast last turn." | C | `On(startOfTurn, DiscardHands*new*)`; needs `ctx.discardHand(side)` (start of turn runs before draws). |
| 40 | Runts | 5/3 | R | "Cast on non-neutral town or colony. Town no longer creates novices. At start of turn, two swordsmen of random nations are created, and get Runt (-1 hand damage, -2 maximum hit points). Group in town cannot be targeted by group spells. Duration: Turn of casting +3." | C | `Target.structure.nonNeutral`*new*, `Lasts(4)`, `On(startOfTurn, CreateHere*new effect form of Create*)`, helper `runt` `Grant({hand:-1,maxHp:-2})`, `Shroud` on structure occupant; needs a novice-production hook (`structure:novice` cancellable event or flag). |
| 41 | Rust | 1/0 | C | "Cast on town or colony. While in town, recruits in town get -1 armor. Dispelled after next combat or if town is captured." | B | `Grant({armor:-1},{to:'recruits'})` on structure host (stats already bubble from structures); `Fleeting` extended to structure hosts (combat of the group in the town); capture: `persistent` owner check via a cast-time owner token, or new `structure:captured` event. |
| 42 | Source of World | 4/0 | C | "Cast on globe. Caster gets +1 World each turn. May be cast more than once." | A | `Stackable()`, `On(When.manaPhase, AddMana('world',1))`. Exact twin of Life **Aura of World**. |
| 43 | The Unmagicking | 5/2 | R | "Cast on globe. Dispels all spells. (Summonings, nation changes, recruit class changes, and terrain changes are not dispelled.) Only one in play at a time." | B | `OnCast(Dispel('everything'))*new*` (visible spells only; summonings/nation/terrain are non-visible or not spells here). |
| 44 | ThudThud | 4/4 | R | "M:4 A:0 HP:9 L:2 Cast on friendly recruit group. Creates ThudThud, a Misfit Hero archer. ThudThud has Iron Shillelagh and Kumatru Archer. (...)" | B | `Hero`, `Create({name:'ThudThud',cls:'archer',nation:'misfit',level:2},{with:['iron-shillelagh','kumatru-archer']})`; needs `with` per-helper duration override (Iron Shillelagh has `Lasts(4)`; on the hero it must be permanent) and Mind's Kumatru Archer ("Cast on archer. Archer gets +2 missile damage.") or a local copy. |
| 45 | ThudThud's Journey | 3/0 | C | "Cast on recruit. Recruit gets three Chaos Features and changes into a Misfit." | C | `OnCast(Give('chaos-feature','target') x3, ChangeNation('misfit'))`. Depends on Chaos Feature + nation change. |
| 46 | Treacherous Armor | 2/1 | U | "Cast on recruit. When recruit is hit (before checking armor), recruit's total armor x 2 is added to the enemy's damage. Recruit's remaining armor this round will reduce this damage normally." | B | `On(When.beforeArmor*new trigger*, AddDamage({stat:'armor', times:2})*new effect*)` on `attack:beforeArmor`. |
| 47 | Unstable Magick | 5/5 | R | "Cast on globe. Each turn, one random spell cast by either player is squandered." | C | needs a `spells:before` untargeted event in `resolveTurn` carrying the ordered casts, and `ctx.squanderCast(index)`. |
| 48 | Void | 6/3 | R | "Cast on square. Square becomes Void. (...)" | A | `OnCast(Terraform('void'))`. Void rules already in `terrainfx.checkFatal`. Twin of War **Volcano**. |
| 49 | Weakness | 1/0 | C | "Cast on minion. Minion gets -1 hand damage. May be cast more than once on the same minion." | B | `Target.minion`*new*, `Stackable()`, `Grant({hand:-1})`. |
| 50 | Werewolf | 4/1 | U | "H:4 A:0 HP:18 L:1 Territorial." | A | `Territorial`, `Monster({hand:4,hp:18,level:1})`. |
| 51 | Wrack | 2/1 | C | "Cast on minion. Dispels all individual spells on minion. Minion cannot be targeted by individual spells." | B | `Target.minion`, `OnCast(Dispel('target',{individual}))`*new*, `Shroud({from:['individual']})` (exists; minion host). |
| 52 | Zurzavar | 5/3 | VR | "Cast on town or colony. Any player-controlled group in town moves in a random legal direction. Duration: Turn of casting +3." | B | `Lasts(4)`, `On(When.beforeMovement, RandomMove('structureGroup')*new scope*)`. |

Near-duplicates of implemented cards: Source of World = Aura of World (Life); Void = Volcano (War) with another terrain;
Horsing Around ~ Amok (War); Armor to Meat ~ Thermite Damage (War helper); Disintegrate = Kill like War's instant kills;
Burst of Strife = Body's Burst of World; Fizzle/Unmagicking/Wrack extend Life's Cleansing Light (`DispelAll`); Leechwood
copies Faerie Glade's square-mother pattern; Fingle and ThudThud follow Ngozi/Vlad Hrothgar (`Hero` + `Create`).

## 4. Features needed (lang and engine), with cards unlocked

| ID | Feature | Layer | Unlocks (direct) | Count |
|---|---|---|---|---|
| F1 | Target builders: `Target.minion`, `Target.monsterGroup`, `.ignoresConcealment`, `.maxSize(n)`, `Target.structure.nonNeutral`, colony/town kind | lang | Carapace, Weakness, Disintegrate, Wrack, Jinx, Chaos Feature, Destroy Creation, Devolution, Mitosis, Runts | 10 |
| F2 | `Dispel(scope, {individual, group, random})` effect replacing/extending `DispelAll` (scopes: target minion, victim, victim group, square group, structure, globe, everything) | lang | Wrack, Fizzle, The Unmagicking, Iron Shillelagh, ThudThud, Leechwood, Entropia, Ergotism | 8 |
| F3 | Chaos Feature system: pool of real individual alterations/conjurations (all houses, filtered by `canCast` on the minion), cast as helper; per-minion counter token; at 3 -> `changeNation('misfit')` | engine + lang | Chaos Feature, Bedlam, Gnax, Gyre, Hollow Jester, ThudThud's Journey | 6 |
| F4 | Dynamic stat/amount forms: `GrantPer(count, delta)`, `TokenGrant` helper, `Damage({stat})`, `AddDamage` on beforeArmor, `Threshold(n, effect)` (count copies), max-HP decay with death at 0 | lang (+ tiny engine for maxHp 0) | Erisian Blade, Magnetic Accrual, Cruel Greaves, Treacherous Armor, Cockatrice, Gatemouth | 6 |
| F5 | `ctx.remove(minionId)` / `ctx.removeGroup(groupId)` / `ctx.replaceGroup(...)` (death category `'removed'`, no triggers; replacement squanders later spells on the old target) | engine | Destroy Creation, Devolution, Hollow Jester, Jumping Land, Instability, Maelstrom (occupant) | 6 |
| F6 | `ctx.changeNation(minionId, nation)` (base HP, walks, house, keep damage taken, persistent recheck) | engine | Forbidden Ichor, Ergotism, ThudThud's Journey (+ Chaos Feature consumers) | 3 (+4) |
| F7 | Group scopes for movement effects: square occupant group, structure occupant group, ring of 8 around host group; `RandomMove` on a scope, `{unoccupied}` option | lang | Fingle, Zurzavar, Horsing Around, Bedlam (square occupants) | 4 |
| F8 | `ctx.teleport(groupId, pos)` (hop off + on: no movement events, no immediate fatal check per rules; spells follow) + random square picker (unoccupied, non-structure, optional "not adjacent to") | engine | Bolt of Somersaults, Gatemouth, Jumping Land | 3 |
| F9 | Structures: `ctx.destroyStructure`, colony helper lifecycle, novice-production hook, `structure:captured` event, Shroud for structure spells / occupant group | engine | Entropia, Maelstrom, Runts, Rust | 4 |
| F10 | New triggers: `When.dying` (+ `CancelDeath`), `When.killed` (killer known), `When.diesInCombat` (opponent group), `When.beforeArmor`, `When.beforeCombat`, `onDamage({nation})` filter | lang | Ergotism, Jinx, Fingle's Folly, Treacherous Armor, Gatemouth, Gnax, Iron Shillelagh | 7 |
| F11 | Random effects: `TerraformRandom(list | contiguous)`, `OneOf([...])`, `Create({randomClass, count range})`, `Monster` count range | lang | Changing Lands, Mudslinging, Ort, Gnax | 4 |
| F12 | `ctx.moveSpell(spellId, newHost)` (Jinx transfer, square spell following its terrain) | engine | Jinx, Jumping Land | 2 |
| F13 | Swamp exit rule (and ice slide) in movement | engine | Mudslinging, Changing Lands (full) | 2 |
| F14 | Hand/deck and cast phase: `ctx.discardHand`, public reveal log entry, `spells:before` event + squander-a-cast | engine | Pages to Dust, Jester at Court, Unstable Magick | 3 |
| F15 | Group "cannot add recruits" flag honoured by joins, Create, training, `createRecruit` | engine | Hollow Jester | 1 |
| F16 | `Create` `with` per-helper duration override; cross-house helper (Kumatru Archer from Mind) | lang | ThudThud | 1 |
| F17 | Negative mana with clamp at 0 (`AddMana(-1)`) | engine (1 line) | Destroy Creation (World Drain) | 1 |
| F18 | Revolver cost (per-card-in-hand state, cost M rises 1..10 per turn, M readable by the card) | engine + client | Gyre | 1 |
| F19 | Cross-house monster pool for "random monster group" | lang registry | Instability | 1 |

Top 5 by cards unlocked: F1 targets (10), F2 dispel scopes (8), F10 triggers (7), F3 Chaos Feature (6, plus 3 more cards
gated behind nation change), F4 dynamic amounts (6) / F5 removal (6).

## 5. Shared mechanics (other houses will need the same)

| Mechanic | Other cards seen in the scraped houses |
|---|---|
| Nation change | Despair Penumbra, Shadow Friend, Nihil's Minion; Abomination Larval Imp (same "when dying -> heal, dispel, change" shape as Ergotism) |
| Removed from the game | Hope Ascension, Recall, Change of Heart; Death Sacrifice, Shifting Sands; Nature Dryad's Favors; Abomination Implosion |
| Replaced by (group/structure) | Body Lycanthropy; Abomination Volgaris; Mind Civilize; Hope Settlement, Zana's Champion; Justice Jade Gargoyle |
| Revolver | Abomination Fiend; Hope Hand of Zana; Death The Withering; Nature Biting Wind; Making Toy Factory |
| Colonies / destroy structure | Body Ancestral Home (near-twin of Entropia); Abomination Gogar's Wrath; Hope Settlement; Mind Civilize; Nature Earthquake |
| Swamp / ice terrain rules | Abomination Swamp Land; Despair Freeze; Death Drought |
| Teleport / random square | Abomination Winged Monkeys; Mind Teleportation; Justice Tindelhunden; Abomination Fiend, Death Furies ("random square") |
| Neutral monsters / neutral groups | Abomination Rogue Monster; Nature Goldcaps, Icecaps; Making Juggernaut |
| "Burst of X" next-turn mana | Body Burst of World (and likely one Burst per mana type across houses) |
| Ignores concealment | Nature Biting Wind |
| Dispel scopes | Despair Shadow Friend (individual + group), Making Juggernaut (square), every house's dispel cards |
| Hero carrying another house's card | Mind Narh'u'ha (Kumatru Archer), Making Ogi |

Recommendation: F1, F2, F5, F6, F8, F9, F13, F18 belong in shared engine/lang tasks, not in an Unmaking-only task.

## 6. Rules ambiguities and rulings

The rules site pages for these topics are gone: `http://www.playsanctum.net/nioga/rules/...` now returns 404 (only the
usage agreement remains at `rules.php`) and the Internet Archive was offline, so no new pages were saved. Rulings below are
mine, based on the saved pages.

| # | Question | Ruling |
|---|---|---|
| R1 | Chaos Feature pool | Uniformly random among real (non-helper, non-hero) alteration/conjuration cards whose target is individual (recruit/minion/monster/swordsman/archer) and whose `canCast` passes on this minion, excluding Chaos Feature itself. Cast as a helper (ignores concealment, blocking and exclusivity, per Elements_spells "helper spells"), owned by the Chaos Feature's caster, with the card's own duration. The pool grows as houses land; tests must seed and stub the pool. |
| R1b | What is "a Chaos Feature" for the count of 3? | A non-visible, undispellable counter helper `chaos-feature-mark` on the minion; the random spell it brings is a normal (dispellable) enchantment. On the third mark a recruit changes into a Misfit (once; monsters only collect marks). Dispelling the granted spells does not reduce the count. |
| R2 | Nation change stats | New base = `recruitSpec(cls, nation)` keeping level and any class-independent base changes; max HP follows the nation (7 or 9); damage taken is kept (`hp = newMax - damageTaken`, min 1); walks replaced by the new nation's; `house` updated; persistent rechecks run (terrain may now drown/strand the group, as the rules' Forbidden Ichor example says). Changing into the same nation does nothing. |
| R3 | Burst of Strife timing | Mana arrives at the next turn's mana generation and the spell then expires; it is a non-visible globe conjuration. |
| R4 | Pages to Dust "not cast last turn" | Start of turn runs before the draw, and cast cards already left the hand, so at each start of turn after casting both players discard their whole hand, then draw to 5. |
| R5 | Unstable Magick | From the next turn on, at the start of spell execution one cast order is picked uniformly from both players' orders that turn and squanders (card discarded, not counted as cast). Several copies each pick a different order. |
| R6 | Jinx transfer | Only on a "kills" death with a living killer; the Jinx moves to the killer (appended to its list). Spell damage deaths ("dies") end the Jinx. |
| R7 | Teleport (Bolt, Gatemouth, Jumping Land) | Teleport is an instant boardhop: no exit/move/enter events, fatal terrain checked at the next normal check (before movement / before combat), not at once (rules case study in Elements_terrainswalks). Destination may be a Sanctum entrance (rules: random squares can pick entrances) but never a structure. If no square is free, nothing happens. |
| R8 | "Adjacent" (Gatemouth) / "eight squares surrounding" (Fingle) | Gatemouth: the 4 orthogonal squares (engine `ADJACENT`); its "not adjacent" excludes the 4 orthogonal neighbours. Fingle: all 8 squares of the 3x3 ring, Fingle's own group excluded, both sides' player-controlled groups, applied before movement every turn (overrides orders). |
| R9 | Gatemouth max-HP decay | Each start of turn -1 max HP (token); when max HP would reach 0 the Gatemouth dies ("dies" category). Needs a max-HP-0 death rule because `computeStats` clamps max HP to 1. |
| R10 | Jumping Land | 60% per turn before combat; destinations are orthogonal, non-structure, non-mountain, non-Sanctum-entrance squares; old square becomes plains, new square mountain; the square spell moves with the mountain; a group already in the new square is removed; the carried group is teleported (R7). Entering Void: the mountain falls in, the spell ends, the square stays Void and the carried group is removed. |
| R11 | Hollow Jester N | N = recruits in the group after the Jester joins (Jester included), fixed at cast. If the Jester dies first, the spell ends. "Cannot add recruits" blocks joins, Create, training into that group and novices joining it in a town. |
| R12 | Erisian Blade | Distinct nations among living recruits in the group, own nation included; monsters/nationless count 0; recomputed live. |
| R13 | Magnetic Accrual | Snapshot each other recruit's current armor stat at cast; changes are undispellable helpers; the card itself is a manifestation. |
| R14 | Treacherous Armor "total armor" | The recruit's armor stat (not the remaining per-round armor), x2, added before armor; the remaining combat armor then soaks normally. |
| R15 | Cruel Greaves | Magical damage equal to the current armor stat (0 armor = no effect). Manifestation. |
| R16 | Ort | 50% create / 50% die; then 1 or 2 at 50% each. Created: random nation (12) and random class, joining the group up to the 8 cap. Deaths are "dies" of random living recruits. |
| R17 | Mitosis | One new Misfit of the same class per Misfit (base recruit, no spells), capped at group size 8; then every Misfit's HP becomes min(hp, 5). "Two or less" is casting-time only. |
| R18 | Devolution | The Misfits are neutral, level 0, of random class, count = monster count (cap 8). Ruling: computer-controlled with a Nomadic bot (original engine's "bot stop" left neutral player groups frozen; moving is closer to the card's intent). They never enter structures (`canEnterSquare` already blocks non-player groups). |
| R19 | Instability | Replacement keeps the old group's owner and square; pick uniformly among implemented square-target summonings whose terrain check passes on that square. |
| R20 | Entropia / Maelstrom / colonies | Destroying a structure dispels its spells, removes its novices and leaves the square plains (Maelstrom then sets Void, removing the group in it). Until colonies exist, "colony" clauses are tested with a test-only colony. |
| R21 | Runts | Novice production of that structure is skipped while active; the swordsmen are created at start of turn for the structure's current owner (join its group there; squander per swordsman if blocked); Runt is a visible helper. |
| R22 | Rust | Affects recruits of any owner in the town; dispelled after the first combat of the group in the town, or when the town changes owner. |
| R23 | Leechwood | Dispels visible spells only (terrain and non-visible spells stay, as rules say non-visible ignore dispel); children are bound to forest. |
| R24 | The Unmagicking "Only one in play at a time" | Moot for a manifestation; ignore. Dispels every visible spell in play, both sides. |
| R25 | Destroy Creation World Drain | A visible, stackable globe enchantment (so Fizzle/Unmagicking can remove it); mana pool never goes below 0. |
| R26 | Gnax count, Fingle's Folly "dies in combat" | Gnax: one group of uniform 2..8. Folly: any death while its group is fighting; 5 magical damage to each member of that combat's opposing group, nobody blamed. |
| R27 | Changing Lands | Uniform over the 10 terrains (11 with Void from the 3rd turn counting the casting turn); persists on the square (not bound to a terrain); never affects structures or Sanctum squares. |
| R28 | Cockatrice's Gaze | "-1 damage" = -1 hand and -1 missile; the third Gaze kills ("kills", blame the Cockatrice). |
| R29 | Jester at Court | Reveals a uniformly random card of the structure owner's deck excluding the top card; nothing if the deck has 1 card or fewer. Logged as a public `reveal` entry; no rules effect. |

## 7. Proposed task order (cheapest first)

| Task | Contents | Cards done after it (cumulative) |
|---|---|---|
| U1 | The 7 A cards + F1 target builders + F17 negative mana clamp | Armor to Meat, Boggart, Burst of Strife, Manticore, Source of World, Void, Werewolf, Carapace, Weakness, Disintegrate (10) |
| U2 | F2 `Dispel` scopes | + Wrack, Fizzle, The Unmagicking, Leechwood, Iron Shillelagh (15) |
| U3 | F7 group scopes and RandomMove options | + Zurzavar, Fingle, Horsing Around (18) |
| U4 | F4 dynamic amounts, F10 triggers, F11 random effects, F16 Create helper durations | + Erisian Blade, Magnetic Accrual, Cruel Greaves, Treacherous Armor, Cockatrice, Fingle's Folly, Ort, Mitosis, Changing Lands, ThudThud (+Kumatru Archer helper), Rust (structure fleeting + owner token) (29) |
| U5 | F5 removal/replacement, F6 nation change, F12 spell transfer | + Destroy Creation, Devolution, Forbidden Ichor, Ergotism, Jinx (34) |
| U6 | F3 Chaos Feature (stub pool from implemented cards) + F15 no-add flag | + Chaos Feature, ThudThud's Journey, Bedlam, Gnax, Hollow Jester (39) |
| U7 | F8 teleport + max-HP-0 death | + Bolt of Somersaults, Gatemouth, Jumping Land (42) |
| U8 | F9 structures/colonies (shared task) | + Entropia, Maelstrom, Runts (45) |
| U9 | F13 swamp/ice (shared task) | + Mudslinging (46) |
| U10 | F14 hand/deck/cast phase | + Pages to Dust, Jester at Court, Unstable Magick (49) |
| U11 | F18 Revolver (shared task) | + Gyre (50) |
| U12 | F19 Instability once all houses' monsters exist | + Instability (51); Chaos Feature pool reaches full size (52 behaving as designed) |

## 8. Risks

| Risk | Note |
|---|---|
| Chaos Feature pool is cross-house | Its behaviour changes every time a house lands; face tests must not snapshot the outcome, and determinism needs the pool order fixed (sort by card id). |
| `moveGroup` vs teleport | `ctx.moveGroup` fires exit/move/enter and checks fatal terrain at once; teleport cards need the rules' different semantics (R7). Do not reuse moveGroup. |
| Max HP clamp | `computeStats` clamps `maxHp >= 1`, so "-N max HP until death" (Gatemouth, Runt -2 on 7-HP minions is fine) needs an explicit rule. |
| Helper durations | `createSpell` gives a helper its card duration; Iron Shillelagh on ThudThud would expire after 4 turns unless `with` can pass `turns: null`. |
| Nation change ripple | Changing nation changes walks: groups on water/mountain can drown or get stuck (intended per rules), and Hero/house-based keywords (`Against`, `Immune`) read `minion.house` live. |
| Replacement squander | Rules: spells later in the same turn on a replaced/removed target squander; `targetLegal` already fails on a missing minion/group, but a group id reused for a replacement must be new. |
| Neutral recruit groups | Movement skips neutral player-controlled groups and capture ignores neutral; Devolution's ruling (R18) needs a bot. |
| Randomness volume | 17 cards roll dice; all must use `ctx.random()` (seeded) so replays and tests stay deterministic. |
| Rules source offline | No further rules pages could be fetched (404 / archive offline); rulings in section 6 fill the gaps. |
