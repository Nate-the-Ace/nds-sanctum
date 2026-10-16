# House of Mind: card analysis

Source: `packages/cards/data/houses/mind.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs mind --per-house`).
Site house id 12. Mana: **Will** primary, **Clarity** secondary. Nation: **Djinn** (7 HP, Waterwalk, no combat bonus).
Vocabulary checked against `packages/cards/src/lang/**`, `packages/engine/src/{ctx,cards,events,stats,types,spells,turn,combat,damage,units}.ts`
and the War/Life cards. Backlog ids (E1, E6, E8, E10, E11) refer to `docs/superpowers/plans/cards-backlog.md`.

## 1. Summary

| | |
|---|---|
| Cards | **51** |
| Rarity | Common 17, Uncommon 18, Rare 14, Very Rare 2 |
| Expansion | Classic 19, Revolutions 11, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 1 |
| Total cost curve (W+C) | 1:4, 2:7, 3:8, 4:12, 5:6, 6:10, 7:1, 8:2, 9:1 (11 cards are Will-only) |
| Target mix | globe 15, group/recruit group 7, recruit/archer/swordsman/minion/monster 9, monster group 3, town/colony 7, square 6 (incl. terrain-restricted 2), creature with no "Cast on" 4 |
| Classification | **A 8, B 19, C 23, D 1** |

## 2. Theme and mechanics

| Theme | Cards |
|---|---|
| Mind control of monsters | Betrayal, Domesticate, Civilize, Hypnotic Trance, Awaiting |
| Hidden information / deck & hand attack | Revelation, Farseeing, Al Hakim, Force of Mind, Tan'u'zhadhi Ploy, Memorize, Bestiary, Itrokos Gate, Narh'u'ha |
| Mana engineering (own and opponent's) | Focus of Clarity, Alchemy, Pantogar's Dream, Xin Shian Alcoves, Xenological Study, Transubstantiation, Kumatru Library, Usam University, Purity of Will, Djinni Debate |
| Kumatru archers | Kumatru Archer, Master Bowyer (Djinni Bow), Kumatru Academy, Foresight, Narh'u'ha |
| Spell denial / protection | Kumatru Trance, Inscrutability, Insight, Mirrored Armor, Sar'uli Overseer, Sar'uli Muzzle, Seal of Djai, Nullify |
| Movement control | Binding Cube, Octagon of Force, Meditation, Mirage, Flying Carpet, Teleportation, Ch'tai Exchange |
| Creatures | Celestial Sphere, Stalking Blyk, Yfreet, Loch Dweller, Rakshasa, Al Hakim (hero), Narh'u'ha |

Nation/flavour notes that affect stats:
- Djinn recruits: 7 HP, Waterwalk, **no** combat bonus (`NATIONS.djinn`). Created Djinn (Al Hakim, Kumatru Academy archers,
  Narh'u'ha) therefore cross/stand on water; Rakshasa is explicitly "without Waterwalk" (needs a nation-walk override).
- Printed stat lines are final (card-text-guide sec. 7): Al Hakim `H:2 A:1 HP:7 L:2` = Djinn swordsman, base level 2.
  Narh'u'ha `M:5 A:0 HP:7 L:2` = archer base M2 + Djinni Bow (+1) + Kumatru Archer (+2), so the def holds M2/L2 and the
  three helpers add the rest. Rakshasa `H:2/M:2 A:0 HP:12 L:2` overrides the nation's 7 HP.
- Flavour (Academies: Kumatru empirical archers, Sar'ul subjugation, Tan'u'zhadhi manipulation, Xin Shia paradox,
  Ch'tai faith, Itrokos topology) suggests ability words `Kumatru` / `Sar'uli` for UI grouping only (no rules).

## 3. Classification table

Types are inferred (the site does not print spell type): Duration -> conjuration; lasting effect -> alteration; instant
-> manifestation; creature -> summoning/hero. "(n)" in the Needs column points at the feature list in section 4.

| # | Card | Cost W+C | Rarity | Card text (trimmed of flavour) | Type | Class | Keyword composition / what is missing |
|---|---|---|---|---|---|---|---|
| 1 | Al Hakim | 4+4 | R | H:2 A:1 HP:7 L:2. Cast on recruit group. Creates Al Hakim, a Djinn Hero swordsman. At start of turn, Al Hakim tells his caster the next three cards at the top of his caster's deck. | hero | C | `Target.recruitGroup, Hero(), Create({Al Hakim, swordsman, djinn, level 2}, {with:['al-hakims-sight']})`; helper `On(startOfTurn, Tell('deckTop',3))` needs private info channel (F6) |
| 2 | Alchemy | 3+1 | C | Cast on globe. Caster gets +2 Will and -1 Clarity on odd-numbered turns, or -1 Will and +2 Clarity on even-numbered turns. May be cast more than once. | alteration | B | `Stackable(), On(When.manaPhase({parity:'odd'}), AddMana('will',2), AddMana('clarity',-1)), On(When.manaPhase({parity:'even'}), ...)`; needs parity trigger option + negative mana ruling (F3) |
| 3 | Awaiting | 2+1 | R | Cast on globe. When any monster group is created, group disappears until Awaiting expires. (Groups reappear at start of turn if their square is unoccupied, or on the earliest turn thereafter.) Duration: Turn of casting +3. | conjuration | C | `Lasts(4)` + boardhop container (F11) + `group:created` event (F11) |
| 4 | Bestiary | 2+1 | U | Cast on town or colony. Before movement, if any recruits were created in town, a random summoning spell is added to the top of town owner's deck, with normal house and mana types. Duration: Turn of casting +5. | conjuration | C | `Target.structure, Lasts(6), On(created, token)`, `On(beforeMovement, AddRandomCard({type:'summoning'}, 'structureOwner','top'))`; needs card-pool query + deck insert (F7) |
| 5 | Betrayal | 3+1 | R | Cast on monster group. Group joins caster's side. | manifestation | C | `Target.monsterGroup (F1), OnCast(JoinSide())`; `ctx.changeSides` cannot take a neutral group and only flips red/blue: needs `ctx.setOwner` (F8) |
| 6 | Binding Cube | 4+3 | U | Cast on group not in a structure. Group's movement orders are cancelled and it cannot be moved. Duration: Turn of casting +2. | conjuration | C | `Target.group.notInStructure (F1), Lasts(3), Rooted()`; "cannot be moved" must beat attraction, moves-twice and teleports: engine `rooted` stat (F12) |
| 7 | Celestial Sphere | 4+2 | R | H:4 A:1 HP:15 L:2 Territorial, Flight. | summoning | A | `Target.square, Territorial(), Monster({hand:4, armor:1, hp:15, level:2, walks:['flight']})` (near-dup of Brimstone Dragon minus Fireball) |
| 8 | Ch'tai Exchange | 2+1 | C | Cast on friendly recruit in group that can add new recruits. Recruit exchanges places with a random recruit from a non-friendly group that can add new recruits. (Each recruit leaves its group, has all group spells dispelled, then joins the other recruit's group.) | manifestation | C | `Target.recruit.friendly.canAddRecruits (F1)` + `ctx.exchangeMinions` with leave-group rules (F13) |
| 9 | Civilize | 5+1 | R | Cast on monster group. Group is replaced by a neutral colony that does not generate novices. (A new colony dispels its square and changes it to plains.) | manifestation | C | `Target.monsterGroup` + `ctx.removeGroup` (replaced, not killed) + `ctx.createStructure('colony', neutral, {noNovices})` + Colony helper (F9, backlog E8) |
| 10 | Djinni Debate | 1+1 | C | Cast on town or colony. Enemy town no longer generates its 1 mana. On friendly town, caster re-selects town's mana type. (Mana-generating spells on the town are not affected.) Duration: Turn of casting +2. Dispelled if town is captured. | conjuration | C | `Lasts(3)` + per-structure mana hook (F10) + mana re-choice (F10) + `structure:captured` event (F9) |
| 11 | Domesticate | 4+2 | U | Cast on monster group. Group joins caster's side, and becomes player-controlled. | manifestation | C | `Target.monsterGroup, OnCast(JoinSide({control:'player'}))`; `ctx.setOwner` + `ctx.setControl` (F8) |
| 12 | Farseeing | 2+0 | C | Cast on globe. Tells caster her opponent's current mana generation. | manifestation | C | `OnCast(Tell('opponentMana'))` (F6) |
| 13 | FireWalking | 1+0 | VR | Cast on group. Group gains Firewalk. | alteration | A | `Target.group, Walk('fire')` (same shape as Life's Flight) |
| 14 | Flail of Sar'ul | 2+1 | C | Cast on swordsman. When swordsman damages an opponent, opponent does not attack in the next combat round. | alteration | B | `Target.swordsman, On(When.onDamage(), Give('dazed','victim'))`; helper `dazed` = `Grant({attacks:-9})` + new lifetime modifier `NextRoundOnly` (F4) |
| 15 | Flying Carpet | 5+1 | U | Cast on group. Group moves twice each turn in its direction of travel. Group gains Flight. Duration: Turn of casting +2. | conjuration | B | `Target.group, Lasts(3), Walk('flight'), On(beforeMovement, MoveTwice('hostGroup'))`; `MoveTwice` only takes the cast target today (F2) |
| 16 | Focus of Clarity | 4+0 | C | Cast on globe. Caster gets +1 Clarity each turn. May be cast more than once. | alteration | A | `Stackable(), On(When.manaPhase, AddMana('clarity',1))` (identical to War's Point of Clarity) |
| 17 | Force of Mind | 1+1 | C | Cast on globe. If the top card of opponent's deck is Force of Mind, one copy of Force of Mind is added to the top of opponent's deck. Otherwise, two copies ... | manifestation | C | `ctx.peekDeck` + `ctx.addToDeck(side, card, 'top')` (F7) |
| 18 | Foresight | 3+2 | U | Cast on group with archers. At start of combat, each archer in group inflicts 2 hit points of magical damage on random opposing minions. | alteration | B | `Target.group.with('archers'), On(startOfCombat(), Damage(2,'randomOpponent', {per:'archer'}))`; new scope + repeat (F2) |
| 19 | Hypnotic Trance | 1+0 | C | Cast on monster. Monster gets -1 level. | alteration | B | `Target.monster (F1), Grant({level:-1})` |
| 20 | Inscrutability | 3+1 | C | Cast on group. All members of group are concealed. | alteration | A | `Target.group, Concealed()` (group-hosted stats reach every member) |
| 21 | Insight | 1+0 | R | Cast on globe. Caster ignores concealment when targeting individual spells. May be cast more than once. | alteration | C | `Stackable(), Pierce()`; `targetLegal` only reads `card.ignoresConcealment`: needs a per-caster pierce query (F15) |
| 22 | Itrokos Gate | 3+2 | R | Cast on plains. Creates a random monster that can be cast on plains. | manifestation | C | `Target.square.on('plains'), OnCast(CastRandom({type:'summoning', target:'square'}))`; card-pool query + engine cast of another card (F7, F19) |
| 23 | Kumatru Academy | 3+2 | U | Cast on friendly town or colony. When any novices would be created in town, 1 Djinn archer is created in town instead. Archers created in this way get +1 armor and +1 level, but cannot gain a level from experience. | alteration | C | replaceable `novice:created` event + `noExp` stat (F14); helper `Grant({armor:1, level:1}), NoExperience()` |
| 24 | Kumatru Archer | 1+1 | C | Cast on archer. Archer gets +2 missile damage. | alteration | A | `Target.archer, Grant({missile:2})` |
| 25 | Kumatru Library | 2+1 | R | Cast on square. At start of turn, if any group occupies square, group's owner gets +1 Clarity and +1 Will. | alteration | B | `Target.square, On(When.manaPhase, AddMana('clarity',1,'occupantOwner'), AddMana('will',1,'occupantOwner'))`; new `to` (F3). Must run at mana phase: pools are reset after `turn:start` |
| 26 | Kumatru Trance | 1+1 | C | Cast on recruit. Recruit cannot be targeted by individual spells. | alteration | A | `Target.recruit, Shroud({from:['individual']})` |
| 27 | Loch Dweller | 2+2 | C | H:3(x3) A:0 HP:15 L:2 Three attacks. Cast on globe. Creates Loch Dweller off the board. Before combat, it appears in water adjacent to a non-friendly group. After all combat, it disappears again. Withdraws at the start of combat round 3. Dispelled when killed. May be cast more than once. | summoning | B | `Target.globe, Stackable(), Ambush({hand:3, handAttacks:3, hp:15, level:2, walks:['water']}, {terrain:['water'], next:'any'}), On(When.eachRound(3), Withdraw())`; `On` on an Ambush card also runs on its globe controller copy, whose `hostGroupId` is undefined, so it would end **every** combat in round 3: needs a minion-host filter (F5). Near-dup of Firewyrm |
| 28 | Master Bowyer | 3+1 | U | Cast on town or colony. Every archer created in town gets Djinni Bow (+1 missile damage). | alteration | B | `Target.structure, On(When.created, Give('djinni-bow','createdArchers'))`; class-filtered scope (F2). Helper `djinni-bow` visible, `Grant({missile:1})`. Same shape as Life's Clandestine |
| 29 | Meditation | 4+2 | U | Cast on group. Group's movement orders are cancelled. Group gets Meditating (all members of group get +1 level). | alteration | B | `Target.group, OnCast(CancelMove('target')), Grant({level:1})`; `CancelMoves` today cancels every recruit group (F2) |
| 30 | Memorize | 2+2 | C | Cast on globe. The next spell opponent casts is added to the top of caster's deck, altered to caster's house and mana types. | alteration | C | `spell:cast` event (F16) + transmuted deck copy (F7) + `Expend()` |
| 31 | Mirage | 2+2 | U | Cast on forest, ice, desert, plains, or barren land. Square attracts non-neutral player-controlled groups. (Groups adjacent to attracting squares before movement must move toward one of them.) Dispelled when entered. | alteration | B | `Target.square.on(forest,ice,desert,plains,barren), Attracts({who:'nonNeutralPlayer'}), On(When.enter(), Expend())`; promote Undine's attract script to an `Attracts` keyword (F4) |
| 32 | Mirrored Armor | 4+0 | U | Cast on recruit. Recruit receives no combat damage (before checking armor). When recruit is hit, Mirrored Armor has 10% chance to shatter (dispel). If Mirrored Armor does not shatter, and attacker is a Gorgon or Cockatrice, attacker dies. | alteration | B | `Target.recruit, Reflect({shatter:0.1, kills:['Gorgon','Cockatrice']})` new keyword on `attack:beforeArmor` (damage 0 when attackerId set) + `attack:hit` (F4). No engine change |
| 33 | Narh'u'ha | 3+2 | VR | M:5 A:0 HP:7 L:2 Neutral. Cast on globe. Created in a random square. Djinn archer with Djinni Bow, Kumatru Archer, and Mirrored Armor. Cannot join groups or add recruits. Any individual spell targeted on Narh'u'ha is squandered, and a random spell of same total cost is added to the top of caster's deck, altered to caster's house and mana types. Only one in play at a time. | summoning | D | see section 6 |
| 34 | Nullify | 4+0 | C | Cast on square. Dispels all spells on square. Square becomes plains. | manifestation | B | `Target.square, OnCast(DispelAll('targetSquare'), Terraform('plains'))`; `DispelAll` handles group targets only (F2) |
| 35 | Octagon of Force | 3+3 | U | Cast on square. When recruit group enters square, group gets Binding Cube (group cannot be moved for current turn +2). | alteration | B | `Target.square, On(When.enter('recruit'), GiveGroup('binding-cube','enterer', {once:true}))`; group-hosted give (F2); depends on Binding Cube (F12) |
| 36 | Pantogar's Dream | 5+4 | R | Cast on globe. Caster gets +2 Order, +2 Strife, and +2 Mystery each turn. May be cast more than once. | alteration | A | `Stackable(), On(When.manaPhase, AddMana('order',2), AddMana('strife',2), AddMana('mystery',2))` |
| 37 | Power | 1+0 | C | Cast on minion. Minion gets +1 hand damage. | alteration | B | `Target.minion (F1), Grant({hand:1})` |
| 38 | Purity of Will | 2+0 | R | Cast on town or colony. Structure generates Will mana instead of its previous mana type. Recursive (Starts with 2 tokens. When cast, a copy of this spell is added to your hand that costs +1 mana and has +1 token.) Duration: Turn of casting +T, where T is the number of tokens. | conjuration | C | structure mana override (F10) + `Recursive(2)` hand copies with per-instance tokens and cost (F7, backlog E10); duration from tokens |
| 39 | Rakshasa | 3+3 | U | H:2/M:2 A:0 HP:12 L:2 Nomadic. Creates a computer-controlled Djinn archer/swordsman without Waterwalk. Can be targeted by both archer and swordsman spells. Cannot join groups, add recruits, or enter structures. Cannot be targeted by group spells or Bear, Eagle, Lion, or Lizard Spirit, or Shapeshifter. | summoning | C | `Target.square, Nomadic(), Shroud({from:['group']}), ImmuneTo(['bear-spirit',...])` + computer-controlled **recruit** group + dual-class minion (F18) + nation walk removal. "Cannot join/enter structures" already holds for computer-controlled groups (`canJoin`, `canEnterSquare`) |
| 40 | Revelation | 1+1 | C | Cast on globe. Tells caster the next five cards in opponent's hand, and on top of opponent's deck if opponent's hand has fewer than five cards. | manifestation | C | `OnCast(Tell('opponentHand',5))` (F6) |
| 41 | Sar'uli Muzzle | 2+1 | C | Cast on minion with hand attacks. Minion gets -5 hand damage. | alteration | B | `Target.minion.withHandAttacks (F1), Grant({hand:-5})` |
| 42 | Sar'uli Overseer | 2+2 | U | Cast on recruit. Recruit receives no hand damage from recruits (before checking armor). Recruit and other members of its group receive no damage from Cyclopes (before checking armor). Dispelled after next combat. | alteration | C | group mother: needs minion-hosted handlers to see group-mates' damage events (F17) + minion-host `Fleeting` (F4) |
| 43 | Seal of Djai | 3+3 | U | Cast on square. At start of turn, and when group enters square, group in square has all spells dispelled. Duration: Turn of casting +2. | conjuration | B | `Target.square, Lasts(3), On(startOfTurn, DispelAll('squareOccupant')), On(When.enter(), DispelAll('enterer'))` (F2) |
| 44 | Stalking Blyk | 5+0 | U | H:2(x2) A:0 HP:15 L:2 Nomadic. Two attacks. | summoning | A | `Target.square, Nomadic(), Monster({hand:2, handAttacks:2, hp:15, level:2})` |
| 45 | Tan'u'zhadhi Ploy | 4+2 | R | Cast on globe. Opponent discards all spells in hand that were not cast this turn. | manifestation | C | `ctx.discardHand(opponent)` (F7). The hand is already stripped of this turn's casts before execution (`resolveTurn`) |
| 46 | Teleportation | 3+2 | U | Cast on friendly town or colony. Before movement, recruit groups created in other friendly towns or colonies are teleported to target town. Dispelled when any recruits are created in town, or if town is captured. Only one per player at a time. | conjuration | C | `Target.structure.friendly, OnePerPlayer(), On(created, Expend())` + created-this-turn tracking + `ctx.teleport` (F13) + `structure:captured` (F9) |
| 47 | Transubstantiation | 2+1 | R | Cast on the globe. Caster's primary and secondary mana totals are reversed next turn. | manifestation | C | creates a one-turn helper that swaps at a new `mana:after` event, after every `mana:generate` addition (F10) |
| 48 | Usam University | 2+1 | R | Cast on town (not colony). For every novice in town, town generates +1 of its selected mana type. Dispelled when any recruits are created in town, or if town is captured. | conjuration | C | `Target.structure.townOnly (F1), On(manaPhase, AddMana('structureType', 'perNovice', 'structureOwner')) (F3), On(created, Expend())` + `structure:captured` (F9) |
| 49 | Xenological Study | 3+3 | U | Cast on globe. Caster cannot cast any summoning spells. Duration: Turn of casting +1. On expiration, Xenological Study II (caster gets +2 Will each turn) is cast on the globe. May be cast more than once. | conjuration | B | `Lasts(2), Stackable(), Forbid({types:['summoning']}, {by:'caster'}), Afterward('xenological-study-ii')`; `Forbid` only knows target classes, add spell types (F4). Same shape as Court Politics |
| 50 | Xin Shian Alcoves | 4+0 | R | Cast on globe. Both players get +1 of all six mana types each turn. Only one in play at a time. | alteration | B | `OnlyOne(), On(manaPhase, AddMana(each of 6, 1, 'both'))` (F3, F4) |
| 51 | Yfreet | 6+2 | U | H:4 A:1 HP:12 L:2 Territorial. At start of combat, casts Cleansing Light (group dispel) on opposing group. | summoning | B | `Target.square, Territorial(), Monster({hand:4, armor:1, hp:12, level:2}), On(startOfCombat(), DispelAll('opponent'))` (F2); reuses Life's Cleansing Light semantics |

Near-duplicates of shipped cards: Focus of Clarity = Point of Clarity (War); Pantogar's Dream = same shape; FireWalking ~
Flight (Life); Kumatru Archer ~ Marksman (War); Master Bowyer ~ Clandestine (Life); Xenological Study ~ Court Politics
(Life); Loch Dweller ~ Firewyrm (War); Celestial Sphere ~ Brimstone Dragon (War); Yfreet uses Cleansing Light (Life);
Inscrutability ~ Greymantle; Mirage ~ Undine's attraction (Life).

## 4. Feature list (what each unlocks)

"Unlocks" = the card is complete once this and the features listed with it exist. L = lang layer only, E = engine.

| Id | Feature | Layer | Size | Cards (count) |
|---|---|---|---|---|
| F1 | Target builders: `Target.monster`, `.monsterGroup`, `.minion` (engine already has these types), modifiers `.notInStructure`, `.townOnly`, `.withHandAttacks` (persistent), `.canAddRecruits` | L | S | Hypnotic Trance, Power, Sar'uli Muzzle, Betrayal, Domesticate, Civilize, Binding Cube, Usam University, Ch'tai Exchange (9) |
| F2 | Effect scopes: `DispelAll(scope)` (target square, square occupant, enterer, opponent), `GiveGroup(card, scope)`, `MoveTwice('hostGroup')`, `CancelMove('target')`, scope `createdArchers` (class filter), scope `randomOpponent` with `per:'archer'` repeat | L | S-M | Yfreet, Seal of Djai, Nullify, Octagon of Force, Flying Carpet, Meditation, Master Bowyer, Foresight (8) |
| F3 | Mana variants: `AddMana` to `'both'` / `'occupantOwner'`, amount `'perNovice'`, type `'structureType'`, turn-parity trigger option, negative amounts | L | S | Alchemy, Kumatru Library, Xin Shian Alcoves, Usam University (4) |
| F4 | Modifier/static keywords: `OnlyOne` (one in play), `OnePerPlayer`, `Forbid` by spell type, `NextRoundOnly` lifetime, minion-host `Fleeting`, `Attracts` (from Undine's script), `Reflect` (Mirrored Armor) | L | M | Xin Shian Alcoves, Teleportation, Narh'u'ha, Xenological Study, Flail of Sar'ul, Sar'uli Overseer, Mirage, Mirrored Armor (8) |
| F5 | `On` host filter so an Ambush card's triggers do not also fire from its globe controller copy | L | XS | Loch Dweller (1); a latent trap for every future combat-hopper with triggers |
| F6 | Private information channel: `state.notices[side]`, `ctx.tell(side, payload)`, view filters other side's notices; payload kinds deckTop/hand/mana | E | S | Al Hakim, Farseeing, Revelation (3) |
| F7 | Deck/hand API: `ctx.peekDeck(side,n)`, `ctx.addToDeck(side, entry, 'top'|'bottom'|'random')`, `ctx.discardHand(side)`, `ctx.addToHand`, card-pool query `randomCard(pred)` (type, total cost, canCast on a ref), **card instances** (deck/hand entries carrying house/cost overrides and tokens) | E | M-L | Force of Mind, Tan'u'zhadhi Ploy, Bestiary, Memorize, Itrokos Gate, Purity of Will, Narh'u'ha (7) |
| F8 | Ownership/control: `ctx.setOwner(group, PlayerId)` (incl. from/to neutral; generalises `flipGroup`), `ctx.setControl(group, 'player'|'computer')` | E | S | Betrayal, Domesticate (2) |
| F9 | Structure lifecycle: `structure:captured` event (fired in `beginTurn` capture loop), `ctx.createStructure(kind, owner, pos, {noNovices})` with the Colony helper and square dispel/plains, `ctx.removeGroup` (leave play, not death) | E | M | Civilize, Djinni Debate, Teleportation, Usam University (4); shared E8 |
| F10 | Mana pipeline: per-structure `structure:mana` event with editable `{type, amount}` before adding to pools, `mana:after` event after all `mana:generate` handlers, `ctx.requestManaChoice(structureId)` reusing the `choose-mana` phase | E | M | Djinni Debate, Purity of Will, Transubstantiation (3) |
| F11 | Boardhop containers: hold a group off-board with an exit square, return at start of turn when the exit square is free, remove from game if the container is dispelled; `group:created` event from `summonGroup` | E | M | Awaiting (1); shared E6 (Faerie Circle) and other houses' Encampment / Will o' the Wisp / Lost Mine / Seelie Court |
| F12 | `rooted` stat flag honoured by `setMoveOrder`, `setMovesTwice`, attraction, `moveGroup`, teleport, orders validation | E | S | Binding Cube, Octagon of Force (2) |
| F13 | Minion leaves group / exchange (`ctx.exchangeMinions`), group teleport without movement events (joins a friendly group there) | E | M | Ch'tai Exchange, Teleportation (2) |
| F14 | Replaceable `novice:created` event (natural production and `addNovices`) + `noExp` stat checked by the experience award | E | S | Kumatru Academy (1) |
| F15 | Per-caster concealment pierce (`targetLegal` asks "does caster hold a pierce spell younger than the concealing spell") | E | S | Insight (1) |
| F16 | `spell:cast` event after a successful cast from hand (`{caster, cardId, target}`) and a pre-execution `spell:targeting` hook that can squander/redirect | E | S | Memorize, Narh'u'ha (2) |
| F17 | Group-mother events: a minion-hosted `groupAura` spell also receives minion events of its group-mates | E | S | Sar'uli Overseer (1) |
| F18 | Dual-class minion (`cls` set or `alsoCls`) for targeting and attacking with both hand and missile; nation-walk removal | E | S | Rakshasa (1) |
| F19 | Engine cast of another card (`ctx.castAs(cardId, target, owner)` running its `canCast`/`onCast` as a helper) and random-square summon | E | S | Itrokos Gate, Narh'u'ha (2) |

Top features by cards: F1 (9), F2 (8), F4 (8), F7 (7), then F3 / F9 (4 each). Engine-only top: F7 (7), F9 (4), F10 (3), F6 (3).

## 5. Shared mechanics (other houses will want these)

| Feature | Why it is shared |
|---|---|
| F7 deck/hand + card instances | Recursive (backlog E10: Growing Strife, Greater Clarity...), "altered to caster's house" transmutes, random-card effects appear across Revolutions/Allies & Traitors in every house |
| F9 structures + captured event | Backlog E8 (Encampment, Defensive Pact, Seelie Court, Golden Grove), "Dispelled if town is captured" is a common clause |
| F10 structure mana hook | Every "5-for-2" town mana generator and every "structure generates X instead" card |
| F11 boardhop | Backlog E6 (Faerie Circle), Seelie Court, Soul Jar, Vision Quest, Encampment, Lost Mine, Will o' the Wisp, Citizens' Militia |
| F13 leave group / teleport | Soul Jar, Vision Quest (leave group), Bolt of Somersaults, Gatemouth (teleport) |
| F6 tell | Any scrying/peek card |
| F8 setOwner/setControl | Renegades (E11), Change of Heart, any monster-stealing or "becomes player-controlled" card |
| F4 OnlyOne / Forbid by type / Attracts | "Only one in play" is common on Very Rares; Siren Song attracts; many "cannot cast X spells" |
| F12 rooted | Complacency, Fear, Sentinel, Possession also "cancel/cannot move" |
| F15 pierce | Scrying Pool, Biting Wind |
| F17 group mothers | Mask of Woad, Leadership, Empathy, Obeisance, Bellwether, Necromancer (Concepts_mothers lists one per house) |
| F14 novice replacement | Djibari's Legacy (Imp novices) |

## 6. Rules ambiguities and proposed rulings

| Card | Question | Ruling |
|---|---|---|
| 4 creatures (Celestial Sphere, Stalking Blyk, Yfreet, Rakshasa) | No "Cast on" text | Target any legal square (as War's Hellion/Salamander). |
| Alchemy | Negative mana; "odd-numbered turns" | Turn number = `state.turn` at the mana phase; pool may dip below 0 for that type during the phase, then each type clamps to 0 after `mana:generate` (so -1 Clarity never cancels a later +1 from another source beyond 0). |
| Awaiting | Combat-hoppers (Ambush) are created off-board; dispel while groups are inside | Ambush/off-board summons are not "created" on the board and are ignored. Groups return at start of turn after expiry when the exit square is free (retry each turn). If Awaiting is **dispelled**, held groups are removed from the game (Concepts_boardhop). |
| Bestiary | "any recruits were created": training only or spells too | Any `minion:created` in the town this turn (training and Create). One card per turn, not per recruit. Random pool = all real summoning cards (not heroes). |
| Betrayal / Domesticate | Cast on own monster group; neutral monsters | Legal on any monster group; on a group the caster already owns Betrayal does nothing, Domesticate still grants player control. Neutral groups become the caster's. Player-controlled monsters still never join groups or enter structures. |
| Binding Cube / Octagon | "Cannot be moved" vs attraction, Forced March, teleport | Rooted beats every movement source incl. teleports and moves-twice; it does not stop boardhops (Awaiting) or minion exchange. Octagon gives Binding Cube once (no stacking if already rooted by one). |
| Ch'tai Exchange | "group that can add new recruits"; no candidate | Player-controlled recruit group without a "cannot add recruits" restriction (Rakshasa, Narh'u'ha excluded); size irrelevant (it is a swap). No candidate -> squanders. Each recruit keeps its individual spells, loses group spells, takes the new group's owner. |
| Civilize | Colony on water/lava; later capture | Square becomes plains (structure rule). "Does not generate novices" is permanent for that colony even after capture. Neutral colony generates no mana until captured. |
| Djinni Debate | How to "re-select" mid-turn | Friendly target: at the next start of turn the owner gets the existing choose-mana prompt for that town; original type restored when the spell ends. Enemy target: base 1 mana suppressed while active; spells on the town still generate. Neutral town: no effect. |
| Farseeing | "current mana generation" | The opponent's pool as generated at this turn's mana phase (before spending), per type. |
| Flail of Sar'ul | "next combat round" when damage happens in the last round / combat ends | The victim skips its attacks in the next round of the same combat only; the effect ends at that round's start or at combat end. Round 1 has no hand attacks anyway, so archers hit in round 1 lose round 2. |
| Flying Carpet | Direction of travel when no order | Repeats the group's order each turn; no order -> no move. Computer-controlled groups move twice with their bot's step. |
| Force of Mind | Copies' house/cost | Real Force of Mind copies (Mind, 1W+1C). Opponent may cast them if they can pay. |
| Foresight | Target selection per archer | Each archer picks independently a random living opposing minion (repeats allowed); magical (ignores armor/immunities). Only archers in the group when combat starts. |
| Insight vs Fog of War | Order dependence | Insight pierces forest, `Concealed` stats and any global concealment cast **before** it; a global concealment cast after it wins (Concepts_concealment). |
| Itrokos Gate | "random monster that can be cast on plains" | Uniform pick among real summoning cards whose `canCast` accepts the target plains square; cast as an engine helper owned by the caster; no candidate -> squanders. |
| Kumatru Academy | Blocked town (full or enemy group) | Each novice that would be produced/created becomes one Djinn archer; if it cannot be placed, the novice is created normally. "Friendly" is casting-time only (rules list Kumatru Academy). |
| Kumatru Library | "At start of turn" mana is wiped by the pool reset | Resolve at the mana phase of the start of turn, using the group present then (after captures). Neutral occupants give nothing. |
| Loch Dweller | Monster on water without a walk | Gets Waterwalk (stat line prints it), as Undine. "Non-friendly group" = any hostile group (Firewyrm precedent). |
| Memorize | Squandered spells; helper casts; multiple Memorize | Only the opponent's next **successful** cast from hand counts; transmute = primary cost -> caster's primary, secondary -> secondary. Default exclusivity (second copy squanders while one waits). |
| Mirage | Who is attracted; several mirages | Every non-neutral player-controlled group adjacent before movement, including the caster's own; picks one adjacent mirage at random among those it can enter; rooted groups are exempt. Dispelled when any group enters. |
| Mirrored Armor | Does the shattering hit deal damage; spell damage | Combat only (attacker present); the shattering hit still deals 0. Gorgon/Cockatrice matched by minion name. |
| Purity of Will | Duration counts; hand copy | The cast instance's tokens T give `Lasts(T+1)`; the copy enters hand immediately with cost +1 Will and T+1. Copy is a game-only card. |
| Rakshasa | Owner, hybrid attacks | Owned by caster, computer-controlled recruit group, Nomadic bot. Per round: its missile attack then its hand attack (round 1: missile only). Spirits/Shapeshifter blocked by card id. |
| Revelation | Hand already emptied by this turn's casts | Shows the opponent's hand as it stands at execution, topped up from the deck to five. |
| Sar'uli Overseer | Who is a "Cyclops" | Minions of nation `cyclops` (Body). Hand damage reduction applies only to recruit attackers, hand kind, before armor. |
| Seal of Djai | Non-visible spells | Dispels enchantments only (non-visible spells ignore dispels). |
| Tan'u'zhadhi Ploy | Order vs opponent's casts | Discards the opponent's remaining hand at execution (cards ordered this turn have left the hand already). |
| Teleportation | Which groups; occupied destination | Each player recruit group standing in another friendly town/colony that received a newly created recruit this turn; teleported in order of creation; joins the friendly group in the target town if room, else stays. Teleport fires no movement events. |
| Transubstantiation | Which mana counts | All of next turn's generation (sanctum, towns, spells) of the caster's house primary/secondary is swapped after every other mana effect. Uses the caster's house, not Mind's. |
| Usam University | Count of novices | Novices present at the mana phase (after production). |
| Xenological Study | Do heroes count as summoning | No: only spell type `summoning`. |
| Xin Shian Alcoves | "Only one in play" across players | One in play for both players; a second cast by anyone squanders. |
| Yfreet | Blocked by Shroud/Intercession? | No: engine-cast helper ignores blocking (Elements_spells "Real Spells as Helper Spells"). |
| Narh'u'ha (D) | Bot, group, redirect | Neutral, computer-controlled single-archer recruit group with a Nomadic-like bot; random empty square (not Sanctum area/structure). Redirect fires at execution of an enemy **or friendly** individual spell targeting it (text says "any"): squander, then add a random real spell with equal total cost, transmuted. Engine-cast helpers are exempt. |

Why Narh'u'ha is D: it combines F19 (random-square summon), a neutral computer-controlled *recruit* group with
movement AI, three helper enchantments (Djinni Bow, Kumatru Archer, Mirrored Armor) on a neutral minion, a pre-execution
squander-and-replace hook (F16), random same-cost card choice and transmuted deck insertion (F7), and `OnlyOne` (F4).
Each piece is ordinary; together they touch five subsystems, so do it last.

## 7. Proposed implementation order (cheapest first)

| Step | Work | Cards completed (cumulative) |
|---|---|---|
| 1 | Write the 8 A cards | Celestial Sphere, FireWalking, Focus of Clarity, Inscrutability, Kumatru Archer, Kumatru Trance, Pantogar's Dream, Stalking Blyk (8) |
| 2 | F1 target builders | + Hypnotic Trance, Power, Sar'uli Muzzle (11) |
| 3 | F2 scopes + F5 host filter | + Yfreet, Seal of Djai, Nullify, Flying Carpet, Meditation, Master Bowyer, Foresight, Loch Dweller (19) |
| 4 | F3 mana variants + F4 modifiers | + Alchemy, Kumatru Library, Xin Shian Alcoves, Xenological Study, Flail of Sar'ul, Mirage, Mirrored Armor (26) |
| 5 | F8 setOwner/setControl, F12 rooted | + Betrayal, Domesticate, Binding Cube, Octagon of Force (30) |
| 6 | F6 tell channel (engine + view) | + Al Hakim, Farseeing, Revelation (33) |
| 7 | F15 pierce, F17 group-mother events, F14 novice replacement, F18 dual class | + Insight, Sar'uli Overseer, Kumatru Academy, Rakshasa (37) |
| 8 | F10 mana pipeline + F9 captured event / structures | + Transubstantiation, Usam University, Djinni Debate, Civilize (41) |
| 9 | F7 deck/hand API + card instances + F16 + F19 | + Force of Mind, Tan'u'zhadhi Ploy, Bestiary, Memorize, Itrokos Gate, Purity of Will (47) |
| 10 | F13 exchange/teleport, F11 boardhop | + Ch'tai Exchange, Teleportation, Awaiting (50) |
| 11 | Narh'u'ha | (51) |

Steps 8-10 should be coordinated with the other houses (shared features, section 5) rather than built for Mind alone.

## 8. Risks

- **Ambush + On trap (F5)**: any trigger keyword on a combat-hopper card also runs from the globe controller spell and
  matches every group. Fix before writing Loch Dweller; check other houses' hoppers (Arboriads, Brown Striders).
- **Card instances (F7)** change `PlayerState.deck/hand` from `string[]` to entries with overrides: touches orders
  validation (costs), `castCheck` (house for Immune/Forbid), deck validation, the client and saved games. Design once for
  all houses.
- **Hidden information (F6)** must not leak through `GameState` sent to both clients: the view layer needs per-side
  filtering of notices (and ideally of hands/decks generally).
- **Mana timing**: any "start of turn: +mana" effect must run at `mana:generate`, since `finishTurnStart` resets pools
  after `turn:start`. Transubstantiation needs a strictly-last hook (F10) or results depend on spell order.
- **Neutral ownership**: `flipGroup` silently ignores neutral groups; Betrayal/Domesticate on neutral monsters
  (Wyrmling, Narh'u'ha) need F8, not `changeSides`.
- **Rooted vs order overwrites**: movement order is "last writer wins" (Pipelines_movement); rooted must be checked in
  the movement pipeline, not only by a `movement:before` handler, or Mirage/Undine can override Binding Cube depending
  on spell age.
- **Monster-control cards** create player-controlled monster groups, a state the bots/UI have not seen yet (orders
  validation allows it; `canJoin`/structure entry already refuse monsters).
- **Rakshasa/Narh'u'ha** are computer-controlled *recruit* groups: `territorialBot`/`nomadicBot` and Ambush placement
  assume monsters vs recruits in places (e.g. `nearestFoe` hunts recruit groups only), check hostility/AI paths.

## 9. Scrape notes (`packages/cards/data/houses/mind.json`)

- 51 cards; every card has name, slug, cost, rarity, text. `castOn` is null for the 4 creatures with no "Cast on"
  sentence (Celestial Sphere, Rakshasa, Stalking Blyk, Yfreet); same as War/Life monsters in `cards.json`.
- Backslash-escaped apostrophes survive in text: Betrayal ("caster\\'s side"), Domesticate, Kumatru Library, and in the
  flavour of Betrayal, Domesticate, Inscrutability. `tools/scrape/parse.mjs` `clean()` unescapes `\"` but not `\'`.
  Other houses' files have the same artefact (abomination 2, death 3, hope 2, justice 1, making 2, nature 1, unmaking 1).
- Domesticate text has a line-break artefact "player- controlled".
- Transubstantiation `castOn` is "the globe" (card says "Cast on the globe"); the regex keeps the article.
- Spell type is not on the site page; types in section 3 are inferred.
- No extra rules pages were saved: `rules.php` now serves the NIOGA usage-agreement page and guessed URLs for Recursive
  /transmute pages return 404; the saved set (`research/rules/links.txt`) covered every Mind mechanic except Recursive and
  card transmuting, which are ruled above.
