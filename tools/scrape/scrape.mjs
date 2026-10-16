import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseCard, parseHouseList } from './parse.mjs';

const BASE = 'http://playsanctum.net/cards';
const HOUSE_IDS = { war: 11, life: 2 };
const DELAY_MS = 250;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'packages', 'cards', 'data', 'cards.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'sanctum-remake-private-scraper/0.1' } });
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return new TextDecoder('latin1').decode(await res.arrayBuffer());
}

const wanted = process.argv.slice(2);
const houses = wanted.length ? wanted : Object.keys(HOUSE_IDS);
const cards = [];
for (const house of houses) {
  if (!HOUSE_IDS[house]) throw new Error(`unknown house "${house}" (known: ${Object.keys(HOUSE_IDS).join(', ')})`);
  const list = parseHouseList(await get(`${BASE}/house.html?house=${HOUSE_IDS[house]}`));
  console.log(`${house}: ${list.length} cards`);
  for (const { sid } of list) {
    const card = parseCard(await get(`${BASE}/cardp.html?sid=${sid}`), sid);
    if (card.house !== house) throw new Error(`card ${sid} "${card.name}" is house ${card.house}, expected ${house}`);
    cards.push(card);
    await sleep(DELAY_MS);
  }
}
cards.sort((a, b) => a.house.localeCompare(b.house) || a.name.localeCompare(b.name));
await mkdir(dirname(OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(cards, null, 2) + '\n', 'utf8');
console.log(`wrote ${cards.length} cards to ${OUT}`);
