# Sanctum remake

A browser remake of *Sanctum*, the 1998 online collectible card game (Digital Addiction), kept alive by the community at
[playsanctum.net](http://playsanctum.net/). This is an unofficial fan project and is not affiliated with the original
creators or the community site.

- `packages/engine`: deterministic rules engine (TypeScript, no I/O). Orders are plain data, so any client can drive it.
- `packages/cards`: card scripts written in a small keyword language; the card text is generated from the keywords.
- `packages/web`: hotseat web client (Vite + Preact). See its README.
- `tools/scrape`: the scraper that built `packages/cards/data/cards.json` from the community card list.
- `docs/`: design spec, implementation plans, keyword design.
- `research/rules`: the community's rules pages, saved for reference.

```
npm install
npm test
npm run dev -w @sanctum/web
```

Card names, text, rules and art belong to their original creators and the community. Card art is not included in this
repository. Planned: play from a static web page, and peer-to-peer matches.
