import { DIR_LIST, isSanctumArea, key, NATION_LIST, RULES, recruitSpec, step } from '@sanctum/engine';
import type { HouseId, MinionSpec, Nation, Pos, TerrainId, Walk } from '@sanctum/engine';
import { requireHost } from '../hosts';
import { defineKeyword } from '../registry';
import { helperSummary } from '../render';
import type { Keyword } from '../types';

/** A creature as a card describes it. Monsters and recruits share the shape. */
export interface CreatureDef {
  name: string;
  cls: 'swordsman' | 'archer' | 'monster';
  hand?: number;
  handAttacks?: number;
  missile?: number;
  missileAttacks?: number;
  armor?: number;
  hp?: number;
  level?: number;
  nation?: Nation;
  walks?: Walk[];
}

/** The minion this definition creates. Recruits start from the class base (and nation); monsters from zero. */
export function creatureSpec(def: CreatureDef, house: HouseId, nation: Nation | undefined = def.nation): MinionSpec {
  if (def.cls === 'monster') {
    const hand = def.hand ?? 0;
    const missile = def.missile ?? 0;
    return {
      kind: 'monster', cls: 'monster', name: def.name, house,
      base: {
        hp: def.hp ?? 7, level: def.level ?? 1, armor: def.armor ?? 0, hand, handAttacks: def.handAttacks ?? (hand > 0 ? 1 : 0),
        missile, missileAttacks: def.missileAttacks ?? (missile > 0 ? 1 : 0), walks: [...(def.walks ?? [])],
      },
    };
  }
  const spec = recruitSpec(def.cls, nation);
  const b = spec.base;
  const hand = def.hand ?? b.hand;
  const missile = def.missile ?? b.missile;
  spec.name = def.name;
  spec.base = {
    ...b, hp: def.hp ?? b.hp, level: def.level ?? b.level, armor: def.armor ?? b.armor, hand, missile,
    handAttacks: def.handAttacks ?? (def.hand === undefined ? b.handAttacks : hand > 0 ? 1 : 0),
    missileAttacks: def.missileAttacks ?? (def.missile === undefined ? b.missileAttacks : missile > 0 ? 1 : 0),
    walks: [...b.walks, ...(def.walks ?? [])],
  };
  return spec;
}

const WALK_NAME: Record<Walk, string> = { flight: 'Flight', fire: 'Firewalk', water: 'Waterwalk', mountain: 'Mountainwalk', desert: 'Desertwalk' };

/** "H:4 A:1 HP:16 L:2, Flight": the printed stat line (xN = N attacks per round). */
export function statLine(spec: MinionSpec): string {
  const b = spec.base;
  const atk = (label: string, dmg: number, n: number) => `${label}:${dmg}${n > 1 ? `(x${n})` : ''}`;
  const parts: string[] = [];
  if (b.missile > 0 || b.missileAttacks > 0) parts.push(atk('M', b.missile, b.missileAttacks));
  if (b.hand > 0 || b.handAttacks > 0 || parts.length === 0) parts.push(atk('H', b.hand, b.handAttacks));
  parts.push(`A:${b.armor}`, `HP:${b.hp}`, `L:${b.level}`);
  return [parts.join(' '), ...b.walks.map((w) => WALK_NAME[w])].join(', ');
}

const lineOf = (def: CreatureDef) => statLine(creatureSpec(def, 'war'));

/* ---------- Monster ---------- */

export interface MonsterKeyword extends Keyword {
  kind: 'monster';
  def: CreatureDef;
  neutral: boolean;
}
/** Summons a monster group on the target square, computer-controlled; `neutral` makes it belong to nobody. */
export const Monster = (def: CreatureDef, opts: { neutral?: boolean } = {}): MonsterKeyword => ({ kind: 'monster', def, neutral: opts.neutral ?? false });

defineKeyword<MonsterKeyword>({
  kind: 'monster', term: 'Monster', tier: 'core',
  gloss: 'Summons a computer-controlled monster on the target square. Stat line: H hand damage, M missile damage (xN = N attacks), A armor, HP hit points, L level. Monsters never join groups or enter structures, and take the same terrain effects as recruits unless they walk it.',
  print: (k) => ({ layout: 'line', section: 'effect', text: `Summon ${k.neutral ? 'neutral ' : ''}${k.def.name} (${lineOf(k.def)}).` }),
  compile: (k, ctx) => {
    if (ctx.target.type !== 'square') throw new Error(`card "${ctx.cardId}": Monster needs a square target`);
    return {
      visible: false,
      onCast: (c, t) => {
        if (t.kind !== 'square') return;
        const owner = k.neutral ? 'neutral' : c.spell.owner;
        const gid = c.summon({ owner, pos: t.pos, control: 'computer', minions: [creatureSpec(k.def, ctx.house)] });
        for (const mid of c.group(gid)!.minionIds) c.createSpell(ctx.cardId, { kind: 'minion', id: mid }, { owner });
      },
    };
  },
  validate: (_k, _m, ctx) => requireHost(ctx, 'minion', 'Monster'),
});

/* ---------- Create ---------- */

export interface CreateKeyword extends Keyword {
  kind: 'create';
  def: CreatureDef;
  count: number;
  randomNation: boolean;
  withSpells: string[];
  onePerGroup: boolean;
}
/**
 * Creates recruits in the target structure (a new recruit there) or target group (joins it). Helper spells in `with`
 * are cast on each new minion, and it ends at full health.
 */
export const Create = (
  def: CreatureDef,
  opts: { count?: number; randomNation?: boolean; with?: string[]; onePerGroup?: boolean } = {},
): CreateKeyword => ({
  kind: 'create', def, count: opts.count ?? 1, randomNation: opts.randomNation ?? false,
  withSpells: opts.with ?? [], onePerGroup: opts.onePerGroup ?? false,
});

defineKeyword<CreateKeyword>({
  kind: 'create', term: 'Create', tier: 'core',
  gloss: 'Creates recruits where the spell is cast: a structure makes a new recruit there, a group gains a member. They start at full health with the named helper spells. If there is no room, the spell squanders.',
  print: (k) => {
    const many = k.count > 1 ? `${k.count} ` : '';
    const stats = lineOf(k.def) + (k.randomNation ? ', random nations' : '');
    const helpers = k.withSpells.length ? ` with ${k.withSpells.map(helperSummary).join(' and ')}` : '';
    const name = k.count === 1 ? k.def.name : k.def.name.endsWith('man') ? `${k.def.name.slice(0, -3)}men` : `${k.def.name}s`;
    return { layout: 'line', section: 'effect', text: `Create ${many}${name} (${stats})${helpers}.` };
  },
  compile: (k, ctx) => ({
    canCast: (q, t) => {
      if (t.kind === 'structure') {
        const st = q.structure(t.id);
        if (!st) return false;
        const g = q.groupAt(st.pos);
        return !g || (g.owner === st.owner && g.kind === 'recruit' && g.control === 'player' && g.minionIds.length + k.count <= RULES.maxGroup);
      }
      if (t.kind === 'group') {
        const g = q.group(t.id);
        if (!g || g.minionIds.length + k.count > RULES.maxGroup) return false;
        return !k.onePerGroup || !q.minionsOf(t.id).some((m) => m.name === k.def.name);
      }
      return false;
    },
    onCast: (c, t) => {
      for (let i = 0; i < k.count; i++) {
        const nation = k.randomNation ? NATION_LIST[Math.floor(c.random() * NATION_LIST.length)] : k.def.nation;
        const spec = creatureSpec(k.def, ctx.house, nation);
        const id = t.kind === 'structure' ? c.createRecruit(t.id, spec) : t.kind === 'group' ? c.addMinion(t.id, spec) : null;
        if (id === null) continue;
        for (const h of k.withSpells) c.createSpell(h, { kind: 'minion', id });
        c.heal(id, 999);
      }
    },
  }),
  validate: (_k, _m, ctx) => {
    if (!['structure', 'recruitGroup', 'group'].includes(ctx.target.type)) {
      throw new Error(`card "${ctx.cardId}": Create needs a structure or group target, not "${ctx.target.type}"`);
    }
  },
});

/* ---------- Hero ---------- */

export interface HeroKeyword extends Keyword {
  kind: 'hero';
}
/** Marks a hero card: each Hero may be cast only once per game (enforced by the engine for spell type `hero`). */
export const Hero = (): HeroKeyword => ({ kind: 'hero' });

defineKeyword<HeroKeyword>({
  kind: 'hero', term: 'Hero', tier: 'house',
  gloss: 'Each Hero may be cast only once per game. A Hero is a named level 2 recruit.',
  print: () => ({ layout: 'inline', text: 'Hero' }),
  compile: () => ({}),
  validate: (_k, _m, ctx) => {
    if (ctx.type !== 'hero') throw new Error(`card "${ctx.cardId}": Hero needs spell type 'hero'`);
  },
});

/* ---------- Ambush (combat-hopper) ---------- */

export interface AmbushKeyword extends Keyword {
  kind: 'ambush';
  def: CreatureDef;
  terrain: TerrainId[];
  next: 'recruit' | 'any';
  becomes?: TerrainId;
  count: number;
}
/**
 * A combat-hopper: summoned off the board. Before combat it appears on an empty square of the given terrain next to a
 * non-friendly group; after all combat it disappears; it is dispelled when killed.
 */
export const Ambush = (
  def: CreatureDef,
  opts: { terrain: TerrainId[]; next?: 'recruit' | 'any'; becomes?: TerrainId; count?: number },
): AmbushKeyword => ({ kind: 'ambush', def, terrain: opts.terrain, next: opts.next ?? 'recruit', becomes: opts.becomes, count: opts.count ?? 1 });

defineKeyword<AmbushKeyword>({
  kind: 'ambush', term: 'Ambush', tier: 'house',
  gloss: 'A combat-hopper: it waits off the board, appears before combat in an eligible square next to a non-friendly group, and disappears again after all combat. It is dispelled when killed.',
  print: (k) => {
    const many = k.count > 1;
    const [they, appear, its, disappear, killed] = many
      ? ['they', 'appear', 'their', 'disappear', 'all are killed']
      : ['it', 'appears', 'its', 'disappears', 'killed'];
    return {
      layout: 'line', section: 'effect',
      text: `Summon ${many ? `${k.count} ` : ''}${k.def.name} (${lineOf(k.def)}) off the board. Before combat ${they} ${appear} in ${k.terrain.join(' or ')} next to a non-friendly ${k.next === 'recruit' ? 'recruit group' : 'group'}${k.becomes ? `, and ${its} square becomes ${k.becomes}` : ''}. After all combat ${they} ${disappear}. Dispelled when ${killed}.`,
    };
  },
  compile: (k, ctx) => {
    if (ctx.target.type !== 'globe') throw new Error(`card "${ctx.cardId}": Ambush needs the globe as its target`);
    return {
      visible: false,
      onCast: (c) => {
        const gid = c.summon({ pos: null, control: 'computer', minions: Array.from({ length: k.count }, () => creatureSpec(k.def, ctx.house)) });
        for (const mid of c.group(gid)!.minionIds) c.createSpell(ctx.cardId, { kind: 'minion', id: mid });
        c.createSpell(ctx.cardId, { kind: 'globe' }, { tokens: { gid } });
      },
      on: {
        'combat:before': (c) => {
          if (c.host.kind !== 'globe') return;
          const gid = c.token('gid');
          const g = c.group(gid);
          if (!g || g.pos) return;
          const spots: Pos[] = [];
          for (const o of Object.values(c.state.groups)) {
            if (!o.pos || o.owner === c.spell.owner || (k.next === 'recruit' && o.kind !== 'recruit')) continue;
            for (const d of DIR_LIST) {
              const p = step(o.pos, d);
              if (!c.state.cells.includes(key(p)) || isSanctumArea(p) || c.groupAt(p) || c.structureAt(p)) continue;
              if (!k.terrain.includes(c.terrainAt(p) as TerrainId)) continue;
              if (!spots.some((s) => s.x === p.x && s.y === p.y)) spots.push(p);
            }
          }
          if (!spots.length) return;
          const p = spots[Math.floor(c.random() * spots.length)];
          if (c.appear(gid, p) && k.becomes) c.setTerrain(p, k.becomes);
        },
        'turn:afterCombat': (c) => {
          if (c.host.kind === 'globe') c.hide(c.token('gid'));
        },
        'minion:dies': (c, ev) => {
          if (c.host.kind !== 'globe' || ev.ref?.kind !== 'minion') return;
          const gid = c.token('gid');
          if (c.state.minions[ev.ref.id]?.groupId === gid && c.minionsOf(gid).length === 0) c.dispel();
        },
      },
    };
  },
  validate: (_k, _m, ctx) => requireHost(ctx, 'minion', 'Ambush'),
});
