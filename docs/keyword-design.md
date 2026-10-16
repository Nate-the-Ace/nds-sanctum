# Sanctum keyword design (draft v0)

Goal: replace wordy instruction-style card text with a small keyword language that **is** the card definition (the engine
runs it and the UI prints text from it). This document borrows the structure MTG settled on and proposes the first
Sanctum vocabulary. Implemented in `packages/cards/src/lang` (plan `2026-10-16-keyword-language`); the 68 War and Life
cards are all declared with it.

Sources for the MTG structure: the [Comprehensive Rules as summarised on mtg.wiki (keyword actions)](https://mtg.wiki/page/Keyword_action),
[keyword abilities](https://mtg.wiki/page/Keywords), [deciduous](https://mtg.wiki/page/Deciduous), and the
[Wikipedia keyword list](https://en.wikipedia.org/wiki/List_of_Magic:_The_Gathering_keywords). Items marked *(from memory)*
are general MTG design knowledge I did not retrieve a source for; check them before relying on the exact wording.

## 1. What MTG actually has (three different things called "keywords")

| MTG term | What it is | Example | Sanctum analogue |
|---|---|---|---|
| **Keyword ability** (CR 702) | One word standing for a longer ability: static, triggered or activated. May take a parameter. | Flying; Ward N; Equip {cost} | `Flight`, `Mountainwalk`, `Territorial`, `Fleeting`, `Lasts N` |
| **Keyword action** (CR 701) | A specialised *verb* for a common game action, used inside effect sentences. Not an ability. | Destroy, Exile, Scry, Fight, Counter | `Damage N`, `Heal N`, `Dispel`, `Terraform`, `Summon`, `Withdraw` |
| **Ability word** | An italic label with **no rules meaning**; it only groups cards with similar abilities. | Landfall, Raid, Threshold | e.g. `Rage`, `Rite`, `Song` (optional flavour labels) |

Supporting conventions that make the system work:

1. **Reminder text** in parentheses explains a keyword; it is not rules text, the rules definition governs.
2. **Tiers** *(deciduous page is sourced; the exact criteria are from memory)*: evergreen keywords appear in every set,
   deciduous ones are available but not expected in most sets, and some mechanics belong to one set. A keyword's tier
   says how much a player is expected to remember.
3. **Templating**: one fixed sentence shape per kind of ability *(from memory)*. Triggered: "When/Whenever/At [event], [effect]."
   Activated: "[cost]: [effect]." Static: a plain statement. Targets are always written the same way.
4. **Parameters** follow the keyword name ("Ward 2", "Annihilator 1").
5. **Complexity budget** *(from memory, a recurring Wizards R&D theme)*: every new keyword costs player memory, so it must
   earn its place by compressing recurring text and appearing often enough to be learned.
6. **Keyword soup**: stacking many keywords on one card hurts readability; cap how many a card shows.

## 2. Rules we adopt for Sanctum

1. **Three layers, same as MTG**: keyword abilities (static, triggered, parameterised), keyword actions (verbs inside
   effects), optional ability words (flavour labels, no behaviour).
2. **Earn-your-place threshold**: a pattern becomes a keyword when at least 3 cards use it, or when it is clearly
   reusable in the other ten houses. Rarer patterns are spelled out with the shared verbs.
3. **Keep Sanctum's own canon words** where they already exist (Flight, Mountainwalk, Waterwalk, Territorial, Nomadic,
   Immobile, Initiative, Dispel, Enchantment, Concealed, Hero). Invent a new word only for a gap.
4. **One word, English, no punctuation.** Adjectives or nouns for statuses (`Fleeting`, `Concealed`), verbs for actions
   (`Heal`, `Terraform`), `Name N` for parameters.
5. **Fixed templates** (printed in this order): target line, static keywords, triggered abilities, effects, reminder text.
   - Target line: `<Target>.` (replaces "Cast on ...")
   - Triggers: `<Trigger>: <effect>.` e.g. `Start of turn: Heal 1.`
   - Stat grants use the existing stat letters: `+2 H`, `+1 M`, `+1 A`, `+1 L`, `+4 HP`, `+1 Attack`.
6. **Reminder text** lives in a glossary and tooltips, generated from the keyword definition. Never typed per card.
7. **Max 3 keyword abilities per card line** (readability cap).

## 3. Draft vocabulary, from the real phrase counts (102 War and Life cards)

Counts are "cards containing it". See `docs/card-text-guide.md` for the raw phrase tables.

### Static keyword abilities
| Keyword | Replaces (original wording) | Count | MTG relative |
|---|---|---|---|
| `Flight`, `Mountainwalk`, `Waterwalk`, `Desertwalk`, `Firewalk` | "Group gains Flight / Desertwalk ... (may cross ...)" | 3+ | Flying, landwalk |
| `Territorial`, `Nomadic`, `Immobile` | creature movement behaviours | 9 | (none) |
| `Neutral` | "Neutral." | 4 | (none) |
| `Concealed` | "is concealed (cannot be targeted by enemy individual spells)" | 3 | Hexproof |
| `Shroud` | "cannot be targeted by any group or individual spells" | 2 | Shroud |
| `Warded` | "receives no combat damage from recruits without enchantments" | 2 | Protection |
| `Pacified` | "no longer attacks, and no longer deals hand or missile damage" | 2 | Pacifism effect |
| `Flurry N` | "Two attacks" / "+N attack each round" | 4 | Double strike (loose) |
| `Fleeting` | "Dispelled after next combat" | 3 | (spell lifetime) |
| `Lasts N` | "Duration: Turn of casting +N-1" | 12 | "until end of turn" |
| `Stackable` | "May be cast more than once" | 5 | (none) |
| `Unique` | "Each Hero may be cast only once per game" | 3 | Legendary |
| `Truce` | "No group enters combat" | 1 | Fog |
| `Ambush` | combat-hopper: appears before combat, vanishes after, dispelled when killed | 2 | Flash (loose) |

### Triggers (printed as `<Trigger>:`)
`Start of turn` (11), `Start of combat` (5), `Each round` (3), `Combat end`, `After combat` (4, "after all combat"), `Before
movement`/`After movement` (2), `When hit`, `On hit` / `On damage` / `On kill`, `On death`, `On enter` (square), `Created`
(recruit created in structure), `Mana` (generation step).

### Keyword actions (verbs)
`Damage N`, `Heal N` / `Heal full`, `Kill`, `Dispel`, `Terraform <terrain>`, `Summon <creature>`, `Create <recruit>`,
`Draw N`, `Mana <type> N`, `Withdraw`, `Teleport`, `Hop`/`Return` (boardhop), `Conceal`, `Cancel move`, `Move twice`,
`Initiative`.

### Stat grants
`+N H`, `+N M`, `+N A`, `+N L`, `+N HP`, `+N Attack`; `Grant` is the umbrella keyword that carries them; `Grant ... to
<subset>` for "archers in the group".

### Ability words (flavour only, optional)
Candidates once houses are added: `Rage` (grows when hit or when comrades fall: Berserker Blade, Berserkers), `Rite`,
`Song`. They label a family of triggers and carry no rules.

## 4. Open naming decisions (taste calls)

| Slot | Candidates |
|---|---|
| "Dispelled after next combat" | `Fleeting` (proposed), `Brief`, `One-shot` |
| "No targeting by anything" | `Shroud` (MTG name), `Veiled` |
| "No combat damage from unenchanted recruits" | `Warded` (proposed), `Hallowed`, `Enchant-proof` |
| "Two attacks" | `Flurry N` (proposed), `Multistrike N` |
| Combat-hopper | `Ambush` (proposed), `Skirmisher`, `Wanderer` |
| "May be cast more than once" | `Stackable` (proposed), `Cumulative` |
| Once per game | `Unique` (proposed), `Legendary` |
| Stat letters in text | `+2 H` (proposed, matches stat lines), `+2 Hand` |

## 5. How this feeds the build

1. The keyword registry holds, per keyword: engine behaviour, short printed form, reminder text, tier.
2. The compiler merges a card's keyword list into the `CardDef` the engine already runs.
3. The renderer prints text with the templates in section 2.
4. A glossary page and card tooltips are generated from the same registry.
5. The scaffolder (later) proposes a keyword list from scraped text using the phrase tables.

## 6. As built

The vocabulary above is implemented in `packages/cards/src/lang`. Constructors by family:

- **Targets:** `Target.*` (the target line of every card, and its `canCast` rule).
- **Grants:** `Grant`, `Walk`, `Concealed`, `Pacified`.
- **Modifiers:** `Lasts`, `Stackable`, `Fleeting`, `Undispellable`, `Truce`, `Bound`, `Afterward`, `Fanfare`.
- **Triggers:** `On` with `When.*`.
- **Effects:** `OnCast`, `Heal`, `Damage`, `Kill`, `Terraform`, `Expend`, `DispelAll`, `AddMana`, `Give`, `GiveSquares`,
  `Withdraw`, `MoveTwice`, `RandomMove`, `CancelMoves`.
- **Restrictions:** `Forbid`, `Shroud`, `Warded`, `Concealment`.
- **Special:** `Ramp` (the `Rage` ability word), `Script` (escape hatch with hand-written text).

Not built yet: `Unique`, `Ambush` and `Flurry N` from section 3. No War or Life card needs them; plan 2c (monsters and
heroes) adds them.

The printed text of every card comes from `cardFace(id)` and the reminder text from `keywordGlossary()`, both exported
from `@sanctum/cards`; `packages/cards/test/faces.test.ts` pins every face.
