# House of Justice: card analysis

Source: `packages/cards/data/houses/justice.json` (scraped 2026-10-16, `node tools/scrape/scrape.mjs justice --per-house`,
site house id 5). Rules: `research/rules/*.txt`. Vocabulary checked against `packages/cards/src/lang/**` and
`packages/engine/src/*` on branch `engine-core`.

## 1. Summary

| Item | Value |
|---|---|
| Cards | 51 |
| Mana | Order (primary), Mystery (secondary). Totals: 149 Order, 76 Mystery; mean cost 4.41 |
| Nation | Gargoyle: 9 HP, no combat bonus, no terrainwalk (already in `nations.ts`) |
| Rarity | Common 17, Uncommon 17, Rare 15, Very Rare 2 |
| Expansions | Classic 19, Revolutions 11, Allies & Traitors 8, Oppositions 7, Bloodlines 5, Whispers 1 |
| Classes (section 3) | **A 7, B 19, C 22, D 3** |

Cost curve (total mana):

| Cost | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|---|
| Cards | 4 | 9 | 4 | 7 | 8 | 12 | 5 | 2 |

Spell types are **not on the scraped page** (see Risks). Inferred types used below: alteration 24, conjuration 12,
manifestation 8, summoning 4, hero 2, plus 1 creature-maker (Jade Gargoyle).

## 2. Theme and mechanics overview

Justice is the **control / rules-lawyer** house: few creatures, many globe "laws" that restrict both players.

| Theme | Cards | Mechanic family |
|---|---|---|
| Casting bans (laws) | Intercession, Orrery, Nemesis, Prohibition, Rule by Example, Preservation, Law of the Land, Road Building, Justicars' Reserve | `Forbid` with new filters (square class, spell type, cost, turn window, area) |
| Squander traps (counterspells) | Gilt, Summoning Licensure, Hapax Legomenon, Trump | execution-time cast interception, `spell:cast` event |
| Hand / deck locks | Injunction, Destiny Manifest, The Well | draw / discard hooks |
| Dispel and cleanse | Restoration, Breaking the Chains, Second Chance, Trump, Justicars | dispel scopes |
| Mana engines | Citadel, The Star Chamber, Rite of Mystery, Preservation (II), Pact of Mystery, Dracha's Trade, Codex of Order | `AddMana`, cost modifier, structure flame-out |
| Movement locks | City-State, Sentinel, Ostracize, Parted Sea | movement / join hooks |
| Stone guardians and gargoyles | Ebon/Granite/Alabaster Guardian, Golem, Obsidian Dragon, Jade Gargoyle, Dracha, Spawn of Toganni, Tindelhunden | Monster, Ambush, relations, hero |
| Punishment | Retribution, Pyrrhic Victory, Chamberlain, Exile | victim-side "is damaged" event, group death |

Flavour that affects stats: Gargoyle 9 HP is already applied by `applyNation`; Dracha (H:2 A:1 HP:9 L:2) and Jade
Gargoyle (H:2 A:1 HP:9 L:1) are exactly a Gargoyle swordsman at L2/L1, so `Create({cls:'swordsman', nation:'gargoyle',
level})` prints the right line with no overrides. Ozande (H:2 A:1 HP:7 L:2) is a **Human** serving Justice: nation
`human` (gets round-2 +1 H), house `justice` (creatureSpec sets house from the card), so War's **Hellion counts him as a
Justice minion**, and Tindelhunden's "Humans get -1 damage" applies to him.

## 3. Classification table (all 51)

Classes: **A** existing keywords only; **B** new lang keyword/effect/trigger or a `Script` over existing engine
events; **C** engine change (named); **D** large or special. Type = inferred spell type.

| # | Card | Cost | Type | Text (scraped, abridged only where marked ...) | Cl | Composition / what is missing |
|---|---|---|---|---|---|---|
| 1 | Alabaster Guardian | O3 M1 | alteration (relation) | H:4 A:2 HP:16 L:1 Moves 2. Cast on friendly recruit group not in a structure. Creates Alabaster Guardian in a random adjacent square. Patrols the diamond centered on target group. When group dies, or is dispelled, Alabaster Guardian no longer moves unless forced. Only one on a group. | D | Relations framework (F13): host-group link, spawn in random adjacent square, player-controlled monster that patrols the host's diamond, "Moves 2" for a monster, bereavement switches to immobile. Target `.friendly.notInStructure` (F1). |
| 2 | Breaking the Chains | O1 M1 | manifestation | Cast on friendly minion. Dispels all individual spells on minion. | B | `Target.minion.friendly`, `OnCast(DispelAll('individual'))` (F1, F16). |
| 3 | Census | O3 M2 | conjuration | Cast on globe. On expiration, all novices are destroyed. Duration: Turn of casting +1. | C | `Lasts(2)`, `OnExpire(ClearNovices('all'))`. Needs ctx action to remove novices (and their nation queue) and an `OnExpire(effects)` keyword (F10). |
| 4 | Chamberlain | O1 M1 | alteration | Cast on recruit. When recruit is damaged by an attacker, recruit's group withdraws at the start of the next round, ending combat. If this withdrawal occurs in combat against Humans, casts Cleansing Light (group dispel) on opposing group. Dispelled after one use. | C | `On(When.damaged, Give('withdraw-next-round','hostGroup'), Expend())`: victim-side damaged event (F3), deferred-withdraw helper (F4), cast real spell as helper on opposing group (F20). |
| 5 | Citadel | M5 | alteration | Cast on town or colony. Citadel generates +2 Order for town owner each turn. | A | `Target.structure`, `On(When.manaPhase, AddMana('order', 2, 'structureOwner'))`. Twin of Call to Arms / Ring of Light. |
| 6 | City-State | O3 M3 | conjuration | Cast on town or colony. Groups cannot enter or exit town. Duration: Turn of casting +1. | C | `Lasts(2)` + movement block on the structure square, both directions (F9 `blocksMove`). |
| 7 | Codex of Order | O5 M1 | alteration | Cast on recruit. Each turn, caster has all spell casting costs adjusted by -1 Order per spell. | C | Cost modifier hook used by `validateOrders` (F7). |
| 8 | Destiny Manifest | O1 M1 | conjuration | Cast on globe. Neither player may discard. Whirlpool becomes still water. Duration: Turn of casting +3. | C | `Lasts(4)` + discard block hook (F6). "Still water" is flavour for the same effect. |
| 9 | Dracha | O4 M4 | hero | H:2 A:1 HP:9 L:2 Cast on friendly town or colony. Creates Dracha, a Gargoyle Hero swordsman. Cannot be targeted by individual spells. When he dies, he creates a friendly colony if his square is empty, and his group withdraws at the start of the next round, ending combat. | C | `Hero()`, `Create({Dracha, gargoyle, L2}, {with:['drachas-presence']})`; helper: `Undispellable, Shroud({from:['individual']})`, on death: create colony (F8) + deferred withdraw (F4). |
| 10 | Dracha's Decree | O4 M2 | alteration | Cast on friendly town or colony. Group in town, and its members, cannot be targeted by group spells or individual spells. | B | `Target.structure.friendly`, `Shroud()` extended to a structure host = the group standing in it (F15). |
| 11 | Dracha's Sphere | O4 M2 | alteration | Cast on recruit group. Group gains Flight. ... All members of group receive no missile damage (before checking armor). | B | `Walk('flight')`, `Resist('missile')` (F11). |
| 12 | Dracha's Trade | O5 | manifestation | Cast on town or colony. Town suffers a mana flame-out. Town generates six primary and three secondary mana for its owner next turn. Thereafter, town no longer generates its 1 mana. (Mana-generating spells on the town are not affected.) | C | Structure state `flamedOut` (skips base mana and the capture mana choice) + one-shot helper adding owner's house primary 6 / secondary 3 next mana phase (F8). |
| 13 | Ebon Guardian | O5 M2 | summoning | H:2(x2) A:3 HP:18 L:1 Immobile. Two attacks. (Immobile monsters cannot be moved.) | A | `Target.square`, `Immobile()`, `Monster({hand:2, handAttacks:2, armor:3, hp:18, level:1})`. Scrape gave no castOn (assume square). |
| 14 | Exile | O2 | manifestation | Cast on globe. Every monster group on the board gets Exiled. (Monster group leaves player control. If mobile, group moves toward the edge of board. At start of turn, if group is in an edge square, group is removed from the game.) | C | Helper `Exiled` on each monster group: ctx `setControl`, edge-seeking bot, ctx `remove` (removed-from-game death) (F14). |
| 15 | Gilt | O1 M1 | alteration | Cast on group. The next spell cast on target group, or on any member of group, is squandered, and Gilt is dispelled. | C | Execution-time interception (`interceptCast`) that squanders, then `Expend` (F5). Must NOT block at ordering. |
| 16 | Golem | O3 M2 | summoning | H:5 A:1 HP:18 L:1 Nomadic. Cast on square adjacent to friendly town or colony. Receives -1 damage from swordsmen. | B | `Target.square.adjacentTo('friendlyStructure')` (F1), `Nomadic()`, `Monster(...)`, `Resist('hand', 1, {from:'swordsman'})` (F11). |
| 17 | Granite Guardian | O4 M3 | summoning | H:4 A:3 HP:15 L:2 Cast on globe. Creates Granite Guardian off board. Before combat, it appears adjacent to a non-friendly recruit group that is adjacent to a friendly town. After all combat, it disappears again. Dispelled when killed. May be cast more than once. | B | `Stackable()`, `Ambush(def, {terrain: any-standable, next:'recruit', foeNear:'friendlyStructure'})`: two new Ambush options (F18). |
| 18 | Hapax Legomenon | O2 M1 | alteration | Cast on globe. The next spell cast from any player's hand cannot be cast again for the rest of the game. Only one in play at a time. | C | `spell:cast` event (F5) + `GameState.bannedCards` checked in `castCheck` + `Expend`. |
| 19 | Injunction | O4 M1 | conjuration | Cast on globe. Neither player draws cards. Duration: Turn of casting +2. | C | `Lasts(3)` + draw block hook in `drawCards` (F6). |
| 20 | Intercession | O3 M3 | conjuration | Cast on globe. Neither player may cast any spells. (This squanders all subsequent spells cast this turn.) Duration: Turn of casting +1. | B | `Lasts(2)`, `Forbid(['globe','structure','group','individual','square'])`: Forbid lacks the `square` class (F2). |
| 21 | Jade Gargoyle | O3 M2 | manifestation (creates recruit) | H:2 A:1 HP:9 L:1 Cast on friendly recruit in group that can add new recruits. Recruit is replaced by Jade Gargoyle, a Gargoyle swordsman. Jade Gargoyle cannot be targeted by individual spells. When any individual spell is cast on a member of group, and member remains in group, a copy of that spell is cast on Jade Gargoyle. (Jade Gargoyle does not copy Jade Gargoyle.) | D | Replace-minion action keeping group spells (F21), `spell:cast` event (F5), cast copy as helper (F20), target "group can add recruits" (F9 join block query). |
| 22 | Justicars | O3 M1 | alteration | Cast on recruit group. When group enters square, colony is destroyed, square and town have all spells dispelled, and square becomes plains, before group enters. | C | Pre-enter event (`group:entering`, before fatal-terrain check and enter effects) (F9), destroy colony (F8), dispel all on square + structure, `Terraform('plains')`. |
| 23 | Justicars' Reserve | O4 M2 | conjuration | Cast on square. Affects a 3x3 diamond centered on square. Summoning spells must be targeted within this area. (This prevents globe-targeted monsters as well.) Duration: Turn of casting +5. | B | `Lasts(6)`, `Forbid({types:['summoning'], unlessTargetIn:'diamond'})` (F2). |
| 24 | Law of the Land | O3 M3 | conjuration | Cast on square. Squares in the 3x3 diamond centered on target square cannot be targeted by any spells. Duration: Turn of casting +5. | B | `Lasts(6)`, `Forbid({targets:'square', area:'diamond'})` (F2). |
| 25 | Minion of Order | O2 | alteration | Cast on minion. Minion gets +1 level. | B | `Target.minion` (missing builder, F1), `Grant({level:1})`. Twin of Ngozi's Way. |
| 26 | Nemesis | O1 | alteration | Cast on recruit. Neither player may cast any Hero spells. | B | `Forbid({types:['hero']})` on a recruit host (F2). |
| 27 | Obeisance | O3 M2 | alteration | Cast on recruit. Recruit gets +1 level for every other recruit in its group. All other members of recruit's group are set to level 0 and cannot gain levels. Only one in a group. | C | Group-mother stats: self `+n` level, others level cap 0 (new `StatDelta.levelCap`), "only one in a group" check at cast and on join (`group:join` event) (F12). |
| 28 | Obsidian Dragon | O6 M1 | summoning | H:4 A:2 HP:20 L:2 Nomadic, Mountainwalk, Firewalk. If killed by a recruit group, that group gets Obsidian Armor (all members of group get +1 armor). | B | `Nomadic()`, `Monster({..., walks:['mountain','fire']})`, `Trophy('obsidian-armor')` (F19; Wyrmling's Script lifted to a keyword). Helper `obsidian-armor`: `Grant({armor:1})`. Scrape gave no castOn (assume square). |
| 29 | Orrery | O2 M2 | alteration | Cast on recruit. Neither player may cast any globe spells. (This squanders all subsequent globe spells cast this turn.) Only one in play at a time. | B | `Forbid(['globe'])` (works from any host today), `UniqueInPlay()` (F17). |
| 30 | Ostracize | O3 | alteration | Cast on recruit group. Group cannot join other groups or add any new recruits. | C | `blocksJoin` hook read by movement `canJoin`, training validation, `placeRecruit`/`joinGroup` (F9). |
| 31 | Ozande | O4 M4 | hero | H:2 A:1 HP:7 L:2 Cast on friendly recruit group. Creates Ozande, a Human Hero swordsman. Ozande has Retribution and Justicars. | C | `Hero()`, `Create({Ozande, human, L2}, {with:['retribution', 'ozandes-justicars']})`. Depends on Retribution (F3) and Justicars (F8, F9). |
| 32 | Pact of Mystery | O1 | conjuration | Cast on globe. For each minion on either side that dies this turn, minion's owner gets +1 Mystery next turn. | B | `Lasts(1)` + `Script`: count `minion:dies` per side in tokens; `onExpire` creates a helper that adds the Mystery at `mana:generate` and expends. |
| 33 | Parted Sea | O1 | alteration | Cast on water. Caster's groups can cross this square without drowning. ... Non-friendly groups can enter or appear in this square, but doing so dispels Parted Sea, and the group suffers the effects. | C | `Target.square.on('water')`, `Bound('water')` + owner-specific terrain override in `groupCanEnter` and `checkFatal` (F9 `terrainOverride`); `group:enter`/appear by non-friendly -> dispel then fatal check. |
| 34 | Preservation | O3 M3 | conjuration | Cast on globe. Caster cannot cast any structure or square spells. Duration: Turn of casting +2. On expiration, Preservation II (caster gets +1 Order and +1 Mystery each turn) is cast on the globe. May be cast more than once. | B | `Lasts(3)`, `Stackable()`, `Forbid(['structure','square'], {by:'caster'})` (needs square class, F2), `Afterward('preservation-ii')`. Twin of Court Politics. |
| 35 | Prohibition | O2 | conjuration | Cast on globe. Next turn, neither player may cast any spell that contains the player's secondary mana in its cost. | B | `Lasts(2)`, `Forbid({costHas:'casterSecondary', from:'nextTurn'})` (F2; token `castTurn`). |
| 36 | Pyrrhic Victory | O4 M3 | alteration | Cast on group. When group is killed, the opposing group dies also. | B | `Script`: remember opponent at `combat:start`; on `minion:killed` of the last living member, `kill` every opponent member. A `ctx.combatOpponent(gid)` query would make it cleaner. |
| 37 | Restoration | O3 | manifestation | Cast on friendly group. Dispels all group and individual spells on group. | A | `Target.group.friendly`, `OnCast(DispelAll())`. Twin of Cleansing Light. |
| 38 | Retribution | O3 M1 | alteration | Cast on minion. When minion is damaged in combat (after checking armor), its attacker is killed. Dispelled after one use. | C | `Target.minion`, `On(When.damaged, Kill('attacker'), Expend())`: victim-side damaged event + `attacker` scope (F3). |
| 39 | Rite of Mystery | O4 | alteration | Cast on globe. Caster gets +1 Mystery each turn. May be cast more than once. | A | `Stackable()`, `On(When.manaPhase, AddMana('mystery', 1))`. Twin of Point of Clarity. |
| 40 | Road Building | O4 M1 | alteration | Cast on square. Affects all contiguous non-structure squares in the same row, and all contiguous non-structure squares in the same column. Affected squares cannot be targeted by any spells. | B | `Forbid({targets:'square', area:'rowCol'})` (F2). |
| 41 | Rule by Example | O4 M2 | conjuration | Cast on globe. On turn of casting +1, caster cannot cast any spells. On turn of casting +2 and +3, opponent cannot cast any spells. Duration: Turn of casting +3. | B | `Lasts(4)`, `Forbid(all, {by:'caster', turns:[1]})`, `Forbid(all, {by:'opponent', turns:[2,3]})` (F2). |
| 42 | Second Chance | O3 | manifestation | Cast on recruit. Dispels all individual spells on recruit. Recruit is fully healed. | B | `OnCast(DispelAll('individual'), Heal('full','target'))` (F16). |
| 43 | Sentinel | O4 M2 | conjuration | Cast on minion not in a structure. Minion's movement orders are cancelled and its group cannot be moved. Minion receives no hand damage (before checking armor). Duration: Turn of casting +2. | C | `Target.minion.notInStructure` (persistent), `Lasts(3)`, `Resist('hand')` (F11), `rooted` stat flag honoured by movement, forced moves and `moveGroup` (F9). |
| 44 | Spawn of Toganni | O4 M3 | manifestation | Cast on town or colony. Creates two Gargoyle novices in town. | A | `Target.structure`, `OnCast(Novices(2, 'gargoyle'))`. Twin of Allies. |
| 45 | Summoning Licensure | O2 M2 | alteration | Cast on globe. The next summoning spell cast is squandered, and Summoning Licensure is dispelled. | C | Same interception hook as Gilt, filtered by type `summoning` (F5). |
| 46 | Talisman of Souls | O2 | alteration | Cast on recruit. Recruit gets +2 maximum and current hit points for each subsequent alteration cast on recruit. | C | `spell:cast` event (F5) + Script token counter: stats `maxHp: 2n`, heal 2 per count. (Backlog E10 "subsequent alteration counting".) |
| 47 | The Star Chamber | O5 M1 | alteration | Cast on town or colony. The Star Chamber generates +1 Mystery and +1 Order for town owner each turn. | A | `On(When.manaPhase, AddMana('mystery',1,'structureOwner'), AddMana('order',1,'structureOwner'))`. |
| 48 | The Well | O1 M1 | conjuration | Cast on globe. Before movement, any card that caster discarded into the whirlpool this turn is returned to the bottom of caster's deck. ... Duration: Turn of casting +5. Only one per player at a time. | C | `Lasts(6)`, `UniqueInPlay({perPlayer:true})` (F17), per-turn `discardedThisTurn` + ctx `returnToDeck(side, card, 'bottom')` (F6). |
| 49 | Tindelhunden | O4 M2 | alteration (relation) | H:4 A:1 HP:10(x2) L:2 Flight, Moves 2. Cast on recruit group. Creates two Tindelhunden in a random edge square. They hunt target group, switching sides if necessary. When target group dies, or is dispelled, Tindelhunden are removed from the game. Humans get -1 damage per Tindelhund. Only one on a group. | D | Relations (F13): random edge spawn, hunter bot moving twice, auto change sides, bereavement = remove from game (F14), `Resist('all', 1, {from:'human'})` (F11). |
| 50 | True Aim | O1 | alteration | Cast on archer. Archer gets +1 missile damage. May be cast more than once on the same archer. | A | `Target.archer`, `Stackable()`, `Grant({missile:1})`. |
| 51 | Trump | O2 M2 | manifestation | Cast on globe. Dispels the most recent alteration or conjuration that was cast from either player's hand. | C | `ActiveSpell.fromHand` flag (set by `executeCast`, not by `createSpell`); pick max id among visible fromHand alterations/conjurations (F5). |

Near-duplicates of implemented cards: Citadel (Call to Arms, Ring of Light), Rite of Mystery (Point of Clarity, Aura of
World), Restoration (Cleansing Light), Spawn of Toganni (Allies), Minion of Order (Ngozi's Way), Preservation (Court
Politics + Court Politics II), Obsidian Dragon (Wyrmling + Wyrmling Hide), Intercession/Orrery (Adriel's Glamour,
Individualism `Forbid`), Granite Guardian (Arboriads/Firewyrm `Ambush`), Dracha/Ozande (Ngozi, Lienna `Hero`+`Create`).

## 4. Feature list (what each unlocks)

| ID | Feature | Layer | Unlocks (Justice) | Count |
|---|---|---|---|---|
| F2 | `Forbid` extensions: `square` class; filters by spell type (hero, summoning), by cost (`costHas: casterSecondary`), by who (`caster`/`opponent`/`all`) and turn window relative to `castTurn` token; area filters (`unlessTargetIn` / square targets in `diamond` or `rowCol` of host) | lang (uses existing `blocksCast`) | Intercession, Preservation, Nemesis, Prohibition, Rule by Example, Justicars' Reserve, Law of the Land, Road Building (+ Orrery already fits) | 8 (+1) |
| F1 | Target builder: `Target.minion`; modifiers `.notInStructure`, `.adjacentTo('friendlyStructure')`, `.canAddRecruits` | lang | Breaking the Chains, Minion of Order, Retribution, Sentinel, Golem, Alabaster Guardian, Jade Gargoyle | 7 |
| F5 | Spell lifecycle: `spell:cast` event after a successful execution (`data: cardId, type, caster, target, fromHand`), `interceptCast` hook run only in `executeCast` (may squander and dispel itself), `ActiveSpell.fromHand`, `GameState.bannedCards` | engine | Gilt, Summoning Licensure, Hapax Legomenon, Talisman of Souls, Trump, Jade Gargoyle | 6 |
| F9 | Movement/joining hooks: `blocksMove(q, spell, group, from, to)` (City-State), `rooted` stat flag (Sentinel), `blocksJoin` (Ostracize, Jade target), owner-specific `terrainOverride` (Parted Sea), pre-enter event `group:entering` (Justicars) | engine | City-State, Sentinel, Ostracize, Parted Sea, Justicars, Jade Gargoyle | 6 |
| F8 | Structures: create colony (with `Colony` helper), destroy colony, `flamedOut` flag + one-shot structure mana | engine (shared with backlog E8) | Dracha, Justicars, Dracha's Trade, Ozande | 4 |
| F11 | `Resist(kind, amount='all', {from: class or nation})` on `attack:beforeArmor` | lang | Dracha's Sphere, Sentinel, Golem, Tindelhunden | 4 |
| F3 | Victim-side `attack:damaged` event after D4 (damage > 0 or 0-point "damaged" result), trigger `When.damaged`, scope `attacker` | engine + lang | Retribution, Chamberlain, Ozande | 3 |
| F6 | Hand/deck hooks: `blocksDraw`, `blocksDiscard`, `PlayerState.discardedThisTurn`, ctx `returnToDeck` | engine | Injunction, Destiny Manifest, The Well | 3 |
| F17 | `UniqueInPlay({perPlayer?})` canCast (no copy anywhere / of this caster) | lang | Orrery, The Well, Hapax Legomenon | 3 |
| F20 | ctx `castAsHelper(cardId, target, owner)`: runs a real card's full cast (onCast + persistence) ignoring blocking | engine | Chamberlain, Jade Gargoyle (Ozande via `with`) | 2 |
| F4 | Deferred withdraw helper (`On(When.eachRound, Withdraw(), Expend())` + expire at `combat:end`) | lang (helper card) | Chamberlain, Dracha | 2 |
| F16 | `DispelAll('individual')` on a minion target | lang | Breaking the Chains, Second Chance | 2 |
| F13 | Relations: host-group link token, bereavement on host death/dispel, hunter and patrol bots, spawn in random edge / adjacent square, side switching, player-controlled monsters, "Moves 2" for monsters | engine + lang | Alabaster Guardian, Tindelhunden | 2 |
| F14 | ctx `setControl(gid, 'computer')`, ctx `remove(gid)` (removed-from-game), edge-seeking bot | engine | Exile, Tindelhunden | 2 |
| F10 | ctx `clearNovices(structureId or all)`, `OnExpire(effects)` keyword | engine + lang | Census | 1 |
| F7 | Cost modifier hook (`costMod(q, spell, caster, card) -> Partial<ManaPool>`) used in `validateOrders` | engine | Codex of Order | 1 |
| F12 | `StatDelta.levelCap` (clamp, also blocks experience) + `group:join` event | engine | Obeisance | 1 |
| F15 | `Shroud` on a structure host (protects the group standing there) | lang | Dracha's Decree | 1 |
| F18 | `Ambush` options: any standable terrain, foe must be adjacent to a friendly structure | lang | Granite Guardian | 1 |
| F19 | `Trophy(helper)`: when killed by a recruit, killer's group gets helper (not stacking) | lang | Obsidian Dragon (+ refactor Wyrmling) | 1 |
| F21 | Replace minion (remove old from game, keep group spells, new minion in same slot) | engine | Jade Gargoyle | 1 |

Top features by cards unlocked: F2 Forbid extensions (8-9), F1 target builders (7), F5 spell lifecycle (6), F9
movement/joining hooks (6), F8 structures (4) and F11 Resist (4).

## 5. Shared mechanics (other houses will need these)

| Feature | Likely users outside Justice (from rules pages) |
|---|---|
| F5 `spell:cast`, interception, fromHand | Jinx-style transfers, counterspells in Mind/Despair; backlog E10 "subsequent alteration" |
| F3 victim "is damaged" | many "when damaged" defensives; Pipelines_damage names Retribution next to Touch of Death combos |
| F8 colonies | War Encampment/Challenge, Life Golden Grove/Seelie Court (backlog E8); Civilize, Settlement, Zana's Champion |
| F9 movement locks | Binding Cube, Complacency, Fear, Possession, Sandstorm (move cancel); Questing Beast join ban (backlog E1); Belvario's Horn (not in structure) |
| F13 relations | Questing Beast (Life, backlog E1) |
| F14 remove / control | Ascension, Cessao Spiral, Void, Shifting Sands (removal); Lycanthropy/Devolution (replace) |
| F7 cost modifiers | Syzygy, Dissolution, Ogi's Armor |
| F10 novice removal | Insurrection, Pestilence |
| F19 Trophy | Gorgon's Head, Minotaur's Axe, Wyrmling Hide |
| F20 cast real spell as helper | Yfreet's Cleansing Light |
| Mother/child spells (optional fidelity for Reserve/Law) | Ill Winds, Drought, Mirage, Siren Song, Vale of Peace |
| F2 Forbid filters | any "Neither player may cast ..." law in other houses |

## 6. Ambiguities and rulings

| # | Card(s) | Question | Ruling |
|---|---|---|---|
| 1 | Ebon Guardian, Obsidian Dragon | No "Cast on" in text | Square summonings (normal monster rules; Obsidian Dragon may target mountain/volcano thanks to its walks). |
| 2 | all | Spell type not scraped | Use the inferred types in the table; Jade Gargoyle a manifestation that creates a recruit; Alabaster/Tindelhunden alterations on the host group ("Only one on a group", "when group ... is dispelled"). |
| 3 | Intercession, Preservation, Rule by Example | Do square spells / summonings / heroes count as "any spells" or "square spells"? | Yes: Forbid gains a `square` class covering square-targeted spells incl. summonings; Intercession blocks every class incl. heroes. Helper/engine casts are never blocked (rules: "spells block your mouse, not the game engine"). |
| 4 | Gilt, Summoning Licensure | Blocked at ordering or squandered at execution? | Execution only: the player may order the spell; it squanders when it resolves (needs F5 interception, not `blocksCast`). Counts spells by any player, incl. the Gilt caster. Only spells cast from hand trigger it. |
| 5 | Hapax Legomenon | Which spell is "next"; what is banned | First real spell that executes successfully after Hapax resolves (same turn if later in order, else next turn). That card id is banned for both players for the game; copies in hand may only be discarded. Hapax then expends. |
| 6 | Trump | Most recent spell already gone | Dispel the most recent **still-active, visible** alteration/conjuration cast from hand (either player, incl. caster). Does nothing if none. |
| 7 | Prohibition | Whose secondary; when | Each casting player's own house secondary (Justice: Mystery, War: Clarity). Active only on turn of casting +1. Hurts Justice's own deck: intended. |
| 8 | Rule by Example | Spells ordered on casting turn | Unaffected (window starts turn +1). Opponent = the other side. |
| 9 | Justicars' Reserve | Two Reserves | Each Reserve is its own constraint: a summoning must be inside every active Reserve (intersection), natural with per-spell `blocksCast`. Globe-targeted summonings (Ambush) are always blocked. Hero spells are not summonings. |
| 10 | Law of the Land, Road Building | What "squares cannot be targeted" covers | Only spells whose target is a square (square spells, summonings, terrain). Groups, minions, structures standing there stay targetable. Road Building's line is recomputed live (stops at structures and board gaps). Implement as single spell on the host square, not mother/children (simplification; children can be added later). |
| 11 | Retribution | Death category and blame | "Kills" death blamed on the Retribution host; fires on `damaged` result only (bounced or cancelled hits do not trigger); then expends. Magical spell damage is not "in combat": no trigger. |
| 12 | Chamberlain | "against Humans"; withdraw timing | Opposing group contains at least one Human-nation minion. Withdraw at the next `round:start` of the same combat; if the combat already ended, nothing. Cleansing Light is cast as a helper (ignores Shroud/Gilt). |
| 13 | Dracha | "his square is empty" | Checked after burial: colony only if no group remains (he was alone) and no structure. Colony owner = Dracha's owner. Withdraw applies to his surviving group, as Chamberlain. |
| 14 | Dracha's Decree | Which group | Any group standing in the town (owner's or a capturer's), until the structure changes hands; "friendly" is casting-time only (rules: casting-time vs persistent). |
| 15 | Dracha's Trade | Flame-out persistence; whose mana | Base 1 mana lost permanently, survives capture (new owner skips the mana choice). 6 primary + 3 secondary of the **owner's house**, paid at the next mana phase to whoever owns it then. |
| 16 | Codex of Order | Floor; which spells | Order part of each cost minus 1, floored at 0; spells with no Order cost unchanged; applies while the host recruit lives, to its caster only. Multiple Codexes stack. |
| 17 | Destiny Manifest, Injunction | Casting-turn effect | Discards and draws of the casting turn already happened (discard bookkeeping precedes spells; draws are at start of turn), so they start next turn. Injunction also blocks spell draws (`ctx.draw`). |
| 18 | The Well | Which discards | Only the voluntary whirlpool discard of that turn (not cast cards, not forced discards). Works on the casting turn (spells resolve before movement). |
| 19 | Obeisance | Joins; monsters | Counts other **recruits** only. If two groups with Obeisance join, the younger Obeisance is dispelled. Level cap 0 also blocks experience gain and level grants. |
| 20 | Pyrrhic Victory | "killed" vs "dies" | Only when the last member suffers a "kills" death in combat; opposing group = current combat opponent; its members "die" (no blame), so no Pyrrhic chain. |
| 21 | Pact of Mystery | Whose minions | Minion's owner at death; neutral owners get nothing; "removed from game" does not count. |
| 22 | Talisman of Souls | What counts | Individual alterations cast on that recruit after Talisman (any player, from hand or Jade copy); group spells and conjurations do not count. Each gives +2 max HP and heals 2. |
| 23 | Jade Gargoyle | Copy scope | Copies any individual spell type (incl. manifestations) cast on another member, by any player, as a helper owned by the original caster, after the original resolves and only if that member is still in the group. Two Jades: each copies. Jade's house = Justice regardless of the replaced recruit. |
| 24 | Exile | "Mobile"; edge | Immobile monsters stay but are removed if already on an edge square. Edge = a cell with a missing orthogonal neighbour. Removal is "removed from the game" (no death effects). |
| 25 | Sentinel | "cannot be moved" | Group skips all movement, incl. forced moves, teleports via `moveGroup` and "moves twice"; dispels in its next recheck if the group is in a structure. |
| 26 | Parted Sea | Who may cross | Groups owned by the caster (at movement time). A non-friendly group entering or appearing dispels it first, then drowns per normal water rules. |
| 27 | Spawn of Toganni | Enemy towns | Legal (target not "friendly"); novices go to the town's owner and train as Gargoyles (house Justice). |
| 28 | Alabaster Guardian, Tindelhunden | Relations details | Follow Concepts_relations: Tindelhunden always hostile to host, removed when bereaved (goes free if bereaved off board); Alabaster player-controlled while within the host's diamond, seeks host otherwise, immobile when bereaved. Spawn square random among legal empty squares; squander if none. |

## 7. Proposed task order (cheapest first)

| Step | Work | Cards done (cumulative) |
|---|---|---|
| 1 | A cards as-is | Citadel, Ebon Guardian, Restoration, Rite of Mystery, Spawn of Toganni, The Star Chamber, True Aim (7) |
| 2 | Lang-only: F1 targets, F16 DispelAll individual, F11 Resist, F15 Shroud on structure, F18 Ambush options, F19 Trophy | + Breaking the Chains, Minion of Order, Second Chance, Dracha's Sphere, Golem, Dracha's Decree, Granite Guardian, Obsidian Dragon (15) |
| 3 | Lang-only: F2 Forbid filters, F17 UniqueInPlay | + Intercession, Preservation, Nemesis, Prohibition, Rule by Example, Justicars' Reserve, Law of the Land, Road Building, Orrery (24) |
| 4 | Scripts over existing events | + Pact of Mystery, Pyrrhic Victory (26) |
| 5 | F10 novices + OnExpire; F6 draw/discard hooks | + Census, Injunction, Destiny Manifest, The Well (30) |
| 6 | F3 damaged event + F4 deferred withdraw | + Retribution (31) |
| 7 | F7 cost modifier | + Codex of Order (32) |
| 8 | F5 spell lifecycle + F20 castAsHelper | + Gilt, Summoning Licensure, Hapax Legomenon, Talisman of Souls, Trump, Chamberlain (38) |
| 9 | F9 movement/joining hooks | + City-State, Sentinel, Ostracize, Parted Sea (42) |
| 10 | F12 level cap + join event | + Obeisance (43) |
| 11 | F8 structures (with backlog E8) + pre-enter event | + Dracha, Justicars, Dracha's Trade, Ozande (47) |
| 12 | F14 control/remove/edge bot | + Exile (48) |
| 13 | F13 relations (with Questing Beast) | + Tindelhunden, Alabaster Guardian (50) |
| 14 | F21 replace minion + spell copy | + Jade Gargoyle (51) |

## 8. Risks

1. **Scrape gaps**: spell type is not scraped for any card (types above are inferred); Ebon Guardian and Obsidian
   Dragon have `castOn: null`; Alabaster Guardian's text and castOn contain a hyphenation artifact
   (`"struc- ture"`). 13 cards have no flavour (not required). No other parse failures; all 51 have name, slug,
   cost, rarity, text.
2. **Rules site unreachable**: every `http://www.playsanctum.net/nioga/rules/<Section>/<name>.php` URL (including the
   already-saved ones) returns 404 and `rules.php` serves the usage agreement; a Wayback CDX query timed out. No
   `justice_*` rules pages could be added, so "mana flame-out", Exile edge rules and patrol behaviour are ruled from
   card text alone.
3. `blocksCast` runs at ordering and at execution; squander traps (Gilt, Licensure, Hapax) need a separate
   execution-only hook or players simply cannot target, which changes the cards' purpose.
4. Many laws are symmetric and hit Justice too (Prohibition blocks almost every Justice card next turn); AI/deck tests
   should not assume they favour the caster.
5. Global state additions (`bannedCards`, `discardedThisTurn`, `fromHand`, `flamedOut`) must be serialisable and
   covered by the view/redaction layer (hand contents are hidden information).
6. Relation monsters and Jade Gargoyle interact with off-board groups and replacement semantics; keep them last and
   test with boardhop/ambush cards.
7. Forbid area rules simplified (no mother/children): dispelling a single child square is impossible until a
   mother/child mechanism exists.
