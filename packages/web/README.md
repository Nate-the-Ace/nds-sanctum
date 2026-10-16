# @sanctum/web

A private, same-screen (hotseat) client for the Sanctum remake: two players share one device, take turns
writing hidden orders, and read a turn report after each resolution. It also has a card browser that renders
every card from its keyword text.

## Run it

From the repo root:

```bash
npm install
npm run dev -w @sanctum/web     # Vite dev server on http://localhost:5173
npm run build -w @sanctum/web   # production build into packages/web/dist
npm test                        # every package's tests (engine, cards, scrape, web)
```

## The hotseat flow

1. **Setup**: pick a house for Red and for Blue and a seed (the engine is deterministic, so a seed replays a game).
2. **Pass the device**: a hand-off screen hides the board until the named player says they are ready.
3. **Orders**: select a group and click a highlighted neighbouring square to move it; select your Sanctum or town
   (or a group standing on it) to train swordsmen, archers or a mana novice; press **Play** on a card, then click a
   highlighted target (several targets on one square give a list). The mana chips show the pool for this turn after
   your training and spells; unspent mana is lost. Any order the engine refuses shows the engine's own message.
4. **Lock**: Red locks, the device goes to Blue, Blue locks, and the turn resolves.
5. **Report**: movement arrows on the board plus sections for training, spells, movement, combat (who lost what,
   and which groups were wiped out), health, casualties, new units, terrain and captures.
6. **Mana choice**: whoever captured a town picks the mana it makes. The game ends when a Sanctum falls.

## Where the logic lives

The UI reads `GameState` and submits `Orders`. Rules live in `packages/engine` (including the read-only helpers
`viewStats`, `legalTargets` and `checkOrders` the UI uses for highlights and messages); cards live in
`packages/cards`. In this package:

- `src/model/` is DOM-free and tested headless: `session.ts` (the hotseat flow: screens, locking, report, mana
  choice), `drafts.ts` (order-draft helpers and the mana preview), `report.ts` (the turn report, from the engine
  log plus a diff of the states before and after), `geometry.ts` (the diamond board projection).
- `src/ui/` holds the Preact components (board, sidebar, hand tray, orders screen, hand-off/report/mana/end screens,
  card browser). No rule is decided here.

## Not built yet

- Input is click-first; drag and drop on the board and hand is a later layer over the same session.
- The resolution is shown as a report, not a frame-by-frame animation.

## Card art

Card art is private-use material kept out of git (`research/cards-raw/art/`) and is not shipped by this client;
minions show their nation and class as text.
