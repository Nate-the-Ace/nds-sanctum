/** Mana images seen on playsanctum.net card pages. Unknown numbers throw so a new house cannot be mis-scraped. */
export const MANA_BY_IMAGE = {
  '01': 'order', '02': 'strife', '03': 'clarity', '04': 'mystery', '05': 'will', '06': 'world',
};

const HOUSES = new Set([
  'abomination', 'body', 'death', 'despair', 'hope', 'justice', 'life', 'making', 'mind', 'nature', 'unmaking', 'war',
]);

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, ' ');

/** Strip tags, decode entities, undo the site's `\"` escaping, collapse whitespace. */
const clean = (s) => decode(s.replace(/<[^>]+>/g, ' ')).replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();

export const slugify = (name) =>
  name.toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** Every `{ sid, name }` linked from a house page. */
export function parseHouseList(html) {
  return [...html.matchAll(/cardp\.html\?sid=(\d+)">([^<]*)</g)].map((m) => ({ sid: Number(m[1]), name: clean(m[2]) }));
}

export function parseCard(html, sid) {
  const head = html.match(/<span id="wh">([\s\S]*?)<\/span>/);
  if (!head) throw new Error(`card ${sid}: header block not found`);
  const [name, houseLine, versionLine] = head[1].split(/<br\s*\/?>/i).map(clean).filter(Boolean);
  const house = houseLine?.match(/^House of (\w+)$/)?.[1]?.toLowerCase();
  if (!house || !HOUSES.has(house)) throw new Error(`card ${sid}: unknown house line "${houseLine}"`);
  const expansion = versionLine?.match(/^(?:A|An) (.+) Card$/)?.[1] ?? null;

  const at = html.indexOf('Rarity:');
  if (at < 0) throw new Error(`card ${sid}: rarity line not found`);
  const start = html.lastIndexOf('<p>', at);
  const paragraphs = [...html.slice(start).matchAll(/<p>([\s\S]*?)<\/p>/gi)].map((m) => m[1]);
  const rarityRaw = paragraphs[0];
  const rarity = clean(rarityRaw).match(/Rarity: ([A-Za-z ]+?), Casting:/)?.[1];
  if (!rarity) throw new Error(`card ${sid}: rarity not parsed from "${clean(rarityRaw)}"`);

  const cost = {};
  for (const m of rarityRaw.matchAll(/(\d+)\s*<IMG SRC="\/images\/(\d+)mana\.gif">/gi)) {
    const mana = MANA_BY_IMAGE[m[2]];
    if (!mana) throw new Error(`card ${sid}: unknown mana image ${m[2]}`);
    if (Number(m[1]) > 0) cost[mana] = Number(m[1]);
  }

  const body = paragraphs.slice(1).map(clean).filter(Boolean);
  if (body.length === 0) throw new Error(`card ${sid}: no rules text`);
  const text = body[body.length - 1];
  const flavor = body.length > 1 ? body.slice(0, -1).join(' ') : null;
  const castOn = text.match(/Cast on ([^.]+)\./)?.[1] ?? null;
  return { sid, name, slug: slugify(name), house, expansion, rarity, cost, flavor, text, castOn };
}
