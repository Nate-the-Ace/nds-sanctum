# Project status and handoff (written 2026-10-17)

Pick-up notes for continuing the Sanctum remake from another machine. Read this first, then `docs/houses/roadmap.md`.

## What exists

| Part | State |
|---|---|
| `packages/engine` | Deterministic rules engine (TypeScript). Orders are plain data. 189 tests. |
| `packages/cards` | Card scripts in a keyword language (`src/lang`); card text is generated from keywords. **97 of 102 War and Life cards implemented** (48 War, 49 Life), 362 tests. |
| `packages/web` | Hotseat web client (Vite + Preact): SVG board, hand tray, orders, turn report, card browser, autosave, **vs-computer mode (you play Blue, Red is a basic NPC)**. 83 tests. |
| `tools/scrape` | Scraper for the community card list. All 12 houses supported (`node tools/scrape/scrape.mjs <house> --per-house`). |
| Data | `packages/cards/data/cards.json` (War + Life, 102 cards) and `packages/cards/data/houses/*.json` (the other ten houses, 510 cards, scraped but not implemented). |
| Docs | `docs/superpowers/specs` (design), `docs/superpowers/plans` (all plans, with `.tasks.json`), `docs/houses/*.md` (per-house research), `docs/houses/roadmap.md` (global plan), `docs/keyword-design.md`, `docs/card-text-guide.md`. |

Branches: work happens on `engine-core` locally; the public repo's default branch is `main` (`git push origin engine-core:main`). Test everything with `npm install && npm test && npm run typecheck && npm run build -w @sanctum/web`. Play locally: `npm run dev -w @sanctum/web` (port 5173).

## Where we stopped

Plan in progress: `docs/superpowers/plans/2026-10-17-remaining-cards.md` (15 tasks). **Tasks 0-9 are done.** Next is **Task 10**: structures in the engine (colonies, hidden structures, `structure:captured` event, mana choices for new colonies and for spells). Then in order:

- Task 11: Defensive Pact, Encampment, Seelie Court, Golden Grove
- Task 12: web UI for the new state (off-board groups, hidden towns, intel, new mana choices; intel must show only on its owner's orders screen)
- Task 13: Questing Beast
- Task 14: docs, final counts, tag `remaining-cards`

After the last task, run an Opus whole-package review and a fix round, as for earlier plans. Expected end state: 102 playable cards, `cards-backlog.md` empty.

Working method used so far: subagent-driven development (one fresh agent per task, tests first, commit per task, Opus review plus a fix round at the end of a plan). Plans were written without compiling, so implementers fix small type or number slips and report them.

## Decisions by the owner

- Faithful clone, private-use fan project, but the repo is **public** (`Nate-the-Ace/nds-sanctum`) because the goal is a hosted page anyone can play, later with peer-to-peer matches.
- "I trust your judgement on rules of play."
- Bursts **stack**. Swamps are **turned on** (the rule is not implemented yet; map generation already places swamps). Ability kills use the rules' "kills" category (Shattering Blow must be retrofitted when that feature lands).
- Mana novices are permanent Sanctum generators (engine fixed in `d99a210`).
- Nihil (Despair hero) is **on hold**: the text of "Nihil's Curse" is unknown. The owner asked the forum; supply the answer, then update `docs/houses/despair.md` (R27) and build the card.
- The NIOGA rules site now shows a usage agreement and its rules pages return 404. The owner will accept the agreement personally; only then try re-fetching rules pages (through the browser pane). Until then, rulings rest on card text and the saved copies in `research/rules/`.
- Login code is to be reused from the "Podcast : Direct" repo and peer-to-peer pairing code from cavecad-rs. **Not started.** Note from the review: `GameState` holds both hands, deck order and the RNG seed, and resolving a turn needs both hands, so fair peer-to-peer play needs a referee or commit-reveal shuffling plus order commit-reveal.

## Remaining work after the 24-card plan

`docs/houses/roadmap.md` is the plan: 510 scraped cards in ten houses, in waves (scraper fixes first, then the lang features that unlock the most cards, shared engine primitives, special systems). The roadmap's section 8 records the owner decisions above. Section 5 lists the scraper fixes needed before bulk card writing (stray backslash before apostrophes, hyphenation leftovers, "Cast within a 3x3 diamond", creatures with no cast clause, mangled names like `Neb_s Mirage`, stat lines with several minions, spell types).

## Housekeeping and gotchas

- **GitHub pushes:** GitHub rejects a push whose newest commit is authored with the banning-eng.com address. Make the tip commit with the noreply address: `git -c user.name="Nathan Schonegg" -c user.email="307531413+ndschonegg@users.noreply.github.com" commit ...` (an empty commit is fine). Old tags cannot be pushed for the same reason.
- **GitHub Pages:** `.github/workflows/pages.yml` builds and deploys the web client. The build job passes; the deploy job fails until a repo **admin** sets Settings, Pages, Source to "GitHub Actions". Then re-run the workflow.
- **Card art** is deliberately not in the repo. It lived in `research/cards-raw/art/` (gitignored, downloaded from `http://www.playsanctum.net/cards/jpgs/<sid>.jpg`, one file per scraped card `sid`). The web client does not use it. A private artifact page (card collection with art) was published from this machine.
- **Line endings:** Windows with `core.autocrlf=true`; commits are LF. Some working-copy files are CRLF, so scripted edits can miss their anchors.
- **Tests that use the real card modules** must not call `resetCards()`; web tests that depend on a seed's opening hand must pin the hand explicitly, because every new card changes the starter decks.
- **Starter decks** (`packages/cards/src/decks.ts`) are generated from the implemented cards of a house, so new cards appear in games automatically.
- **Memory:** the assistant keeps cross-session notes about this project; if you continue with Claude Code on another machine they are not available, so this file and the plans are the source of truth.
