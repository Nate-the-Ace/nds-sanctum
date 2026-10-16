# How Sanctum card text works (and how each piece maps to the engine)

Source: all 102 War and Life card texts in `packages/cards/data/cards.json`, counted on 2026-10-16, plus the original
rules (`research/rules/`, especially `Concepts_eventbubbling.txt`, which lists the "card text phrases" and says each one
is an internal event). Counts are "cards containing it" out of 102.

**Short version:** cards are plain English sentences with a small, fairly regular vocabulary. Not MTG-style keywords.
The regular parts (target, stat lines, timing phrases, stat grants, durations) map straight onto engine pieces. The
effect verbs themselves ("heals", "becomes", "creates", "cannot be targeted") are open-ended, so each card still needs a
hand-written script. Median card text is 23 words; 225 of 321 sentences are unique.

## 1. Anatomy of a card page

| Field | Example | Engine |
|---|---|---|
| Name, house, expansion, rarity | `Flaming Sword`, War, Classic, Common | `CardDef.name`, `house`; the rest only in `cards.json` |
| Casting cost | `2 Strife, 0 Clarity` | `CardDef.cost`; a house only pays its own two mana types |
| Flavor text | a quote | display only |
| Rules text | `Cast on swordsman. Swordsman gets +2 hand damage.` | everything below |
| Spell type | **not on the page** (alteration, conjuration, manifestation, summoning, hero) | declared by the script, see `Elements_spells.txt` |

## 2. Sentence by sentence

A rules text is a sequence of sentences in a fairly fixed order:

1. **Target clause**: `Cast on <target>.` (98 cards). Always first. Maps to `CardDef.target` plus an optional `canCast`.
2. **Stat line** (creatures only, 17 cards): `H:4 A:1 HP:16 L:2` = hand (or `M:` missile) damage, armor, hit points, level;
   `(x2)` = number of attacks or copies. Then behaviour words.
3. **Effect sentences**: what the spell does. Free text.
4. **Modifier sentences**: duration, stacking, dispel rules.
5. **Parenthetical reminders**: rules explanations, e.g. `(Lava causes 3 hit points of damage ...)`. No effect of their own.

## 3. Target phrases -> `TargetType` (and `canCast`)

| Phrase (count) | `target` | extra requirement in `canCast` |
|---|---|---|
| `globe` (17) | `globe` | none |
| `recruit group` (11), `friendly recruit group` (4) | `recruitGroup` | `friendly` -> group owner is the caster |
| `recruit group with archers` / `with swordsmen` (4) | `recruitGroup` | group contains that class |
| `group` (7), `non-friendly group` (1) | `group` | `non-friendly` -> owner is not the caster |
| `recruit` (9), `friendly recruit` (2) | `recruit` | `friendly` -> minion owner is the caster |
| `swordsman` (8), `archer` (6) | `recruit` | class check; `in group of one` -> group size 1 |
| `town or colony` (6), `friendly town or colony` (4), `town (not colony)` (1) | `structure` | owner / kind checks |
| `square` (6) | `square` | empty square, not part of a Sanctum (engine rule) |
| `forest` (3), `plains`, `mountain or volcano` (2), `volcano`, `water` | `square` | terrain of the square |
| `... in forest`, `... of two or more`, `... not in a structure`, `... player-controlled` | as above | extra `canCast` condition |

## 4. Timing and trigger phrases -> engine events

The original rules define these phrases as game events; the engine uses the same pipeline (see `events.ts`).

| Phrase | Event | Notes |
|---|---|---|
| `At start of turn` (11) | `turn:start` | all non-terrain effects |
| `After start of turn` | `turn:startAfter` | damaging terrain uses this |
| `Before movement` / `After movement` (2) | `movement:before` / `movement:after` | before-movement can overwrite move orders |
| `Before combat` (2) | `combat:before` | untargeted; `ctx.cancel()` skips all combat |
| `At start of combat` (5) | `combat:start` | per group, `data.opponent` |
| `At start of each combat round` (3) | `round:start` | per group, `data.round`; `ctx.endCombat()` withdraws |
| `At end of combat` / `After combat` | `combat:end` / `combat:after` | per surviving group |
| `After all combat` (4) | `turn:afterCombat` | untargeted |
| `When X hits` / `damages` / `kills` | `attacker:hits` / `attacker:damages` / `attacker:kills` | on the attacker |
| `When X is hit` / `before / after checking armor` | `attack:hit` / `attack:beforeArmor` / `armor:after` | on the victim; `data.damage` is editable |
| `When X dies` / `is killed` / `is dying` | `minion:dies` / `minion:killed` / `minion:dying` | `ctx.cancel()` on dying revives |
| `When group enters square` | `group:enter` (also `:exit`, `:move`) | spell hosted on the square |
| `Every recruit created in town ...` | `minion:created` | spell hosted on the structure |
| `Caster gets +1 Clarity each turn` | `mana:generate` | after mana pools reset; `ctx.addMana` |

Events bubble minion -> group -> square -> structure -> globe, so a spell hosted on any of those sees events about
things inside it.

## 5. Stat grants -> `StatDelta` (computed, never stored)

`gets +1 hand damage` (5), `+1 missile damage` (4), `+2 hand` (3), `+4 hand` (2), `+1 armor` (2), `+1 level` (2),
`+1 attack each round` (2), `-1 level`, `+N maximum (and current) hit points`.

| Text | `stats()` field |
|---|---|
| hand / missile damage | `hand`, `missile` |
| `+N attack each round` | `handAttacks`, `missileAttacks` |
| armor, level | `armor`, `level` (level clamps 0..5) |
| maximum hit points | `maxHp` (add `ctx.heal` for "and current") |
| `gains Flight / Desertwalk / Waterwalk / Mountainwalk / Firewalk` | `walks` |
| `no longer attacks, and no longer deals damage` | `handAttacks: -9`, `missileAttacks: -9`, `noDamage: true` |
| `is concealed` | `concealed` |

Rule of thumb: if a sentence is "X gets +N <stat>" and nothing else, the card is a one-line `stats: () => ({...})`.

## 6. Modifier sentences

| Text | Script |
|---|---|
| `Duration: Turn of casting +N` (12) | `duration: { turns: N + 1 }` (conjuration) |
| `May be cast more than once` (5) | `exclusive: false` |
| `Dispelled after next combat` (3) | `on: { 'combat:after': (c, ev) => c.dispel() }` for the host group |
| `Dispelled when killed` | handler on `minion:dies` calling `c.dispel()` |
| `Only one on a group` | default exclusivity |
| `Each Hero may be cast only once per game` (3) | `type: 'hero'` (plan 2c adds the once-per-game rule) |
| `Recursive (Starts with 1 token ...)` | tokens and hand copies (backlog E10) |

## 7. Creature keywords

`Territorial` (3), `Nomadic` (4), `Immobile` (2): movement behaviour; `Flight`, `Firewalk` (terrain walks); `Neutral`
(owned by the neutral player); `Two attacks`. Handled in plan 2c.

## 8. Effect sentences -> `ctx` actions

| Text | Action |
|---|---|
| `takes N hit points of damage`, `deals N damage` | `ctx.damage(id, n)` |
| `fully healed`, `heals N` | `ctx.heal(id, n)` |
| `X dies` | `ctx.kill(id)` |
| `Square becomes lava/plains/...` | `ctx.setTerrain(pos, terrain)` |
| `gets <Named Effect> (...)` e.g. Faerie Blessing | `ctx.createSpell('helper-card', host)` |
| `Dispels all spells ...` | `ctx.dispel(id)` over `c.state.spells` |
| `Creates a ...` | `ctx.summon`, `ctx.createRecruit`, `ctx.addMinion` (plan 2c) |
| `moves twice`, `movement orders are cancelled` | `ctx.setMovesTwice`, `ctx.setMoveOrder` |
| `withdraws`, `No group enters combat` | `ctx.endCombat()`, `ctx.cancel()` on `combat:before` |
| `Neither player may cast ...`, `cannot be targeted` | `blocksCast` on the card |
| `Initiative` | `ctx.setInitiative` (plan 2c) |
| `Caster gets +N <mana>` | `ctx.addMana` on `mana:generate` |

## 9. Adding a card (checklist)

1. Read the scraped text (`cards.json`). Mark each sentence: target / stat line / effect / modifier / reminder.
2. Declare the card with `card({ id, name, house, cost, type, target, keywords: [...] })` in `packages/cards/src/<house>/`.
   Target phrases map to `Target.*`; stat grants to `Grant`; timing phrases to `On(When.*, ...)`; one-off effects to
   `OnCast(...)`; durations and stacking to `Lasts`, `Stackable`, `Fleeting`.
3. If a sentence has no keyword, first check the tables above for an existing effect verb. If none fits, either add a
   keyword (when at least 3 cards would use it) or use `Script(text, fragment)` with hand-written text.
4. Name any "gets <Named Effect>" as a helper card (`helper: true`) and use `Give('helper-id', scope)`.
5. Write one test per sentence, plus the "cannot target / squanders" cases; add a `// RULING:` comment for any clause not
   implemented exactly.
6. Add the card's printed text to `faces.test.ts`; the printed text comes from the keywords, so read it and rewrite the
   keyword list until it reads like a card.
