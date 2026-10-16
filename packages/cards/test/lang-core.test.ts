import { describe, it, expect } from 'vitest';
import type { EventContext, GameEvent, QueryContext } from '@sanctum/engine';
import {
  card, defineKeyword, keywordDef, mergeFragments, printTarget, renderSpec, specOf, Target, toTargetSpec,
  type Keyword,
} from '../src/lang';
import { castMini, mini, put } from './lang-helpers';

const q = {} as QueryContext;
const c = {} as EventContext;
const ev = {} as GameEvent;

describe('mergeFragments', () => {
  it('sums stat deltas', () => {
    const m = mergeFragments([
      { stats: () => ({ hand: 2, walks: ['water'] }) },
      { stats: () => ({ hand: 1, armor: 1, noDamage: true }) },
    ]);
    expect(m.stats!(q, 1, {} as never)).toEqual({ hand: 3, armor: 1, walks: ['water'], noDamage: true });
  });

  it('chains event handlers in order and runs onCast/onExpire in sequence', () => {
    const log: string[] = [];
    const m = mergeFragments([
      { on: { 'turn:start': () => { log.push('a'); } }, onCast: () => { log.push('cast-a'); } },
      { on: { 'turn:start': () => { log.push('b'); }, 'combat:end': () => { log.push('end'); } }, onCast: () => { log.push('cast-b'); } },
    ]);
    m.on!['turn:start']!(c, ev);
    m.on!['combat:end']!(c, ev);
    m.onCast!(c, { kind: 'globe' });
    expect(log).toEqual(['a', 'b', 'end', 'cast-a', 'cast-b']);
  });

  it('ANDs canCast and persistent, ORs blocksCast', () => {
    const yes = () => true;
    const no = () => false;
    expect(mergeFragments([{ canCast: yes }, { canCast: no }]).canCast!(q, { kind: 'globe' })).toBe(false);
    expect(mergeFragments([{ canCast: yes }, { canCast: yes }]).canCast!(q, { kind: 'globe' })).toBe(true);
    expect(mergeFragments([{ persistent: yes }, { persistent: no }]).persistent!(q, { kind: 'globe' })).toBe(false);
    const att = {} as never;
    expect(mergeFragments([{ blocksCast: no }, { blocksCast: yes }]).blocksCast!(q, {} as never, att)).toBe(true);
    expect(mergeFragments([{ blocksCast: no }, { blocksCast: no }]).blocksCast!(q, {} as never, att)).toBe(false);
  });

  it('takes the last duration; exclusive:false and visible:false win; helper and bot pass through', () => {
    const m = mergeFragments([
      { duration: { turns: 2 }, exclusive: false },
      { duration: { turns: 5 }, visible: false, helper: true },
      {},
    ]);
    expect(m.duration).toEqual({ turns: 5 });
    expect(m.exclusive).toBe(false);
    expect(m.visible).toBe(false);
    expect(m.helper).toBe(true);
    expect(mergeFragments([{}]).exclusive).toBeUndefined();
  });
});

describe('registry', () => {
  const noop = { term: 'T', tier: 'oneoff' as const, gloss: 'g', print: () => null, compile: () => ({}) };
  it('rejects duplicate kinds and unknown lookups', () => {
    defineKeyword({ kind: 'core-test-kw', ...noop });
    expect(() => defineKeyword({ kind: 'core-test-kw', ...noop })).toThrow(/duplicate keyword/);
    expect(keywordDef('core-test-kw').term).toBe('T');
    expect(() => keywordDef('nope')).toThrow(/unknown keyword "nope"/);
  });
});

describe('Target', () => {
  it('builds immutable specs', () => {
    const base = Target.recruitGroup;
    const friendly = base.friendly;
    expect(toTargetSpec(base)).toEqual({ type: 'recruitGroup' });
    expect(toTargetSpec(friendly)).toEqual({ type: 'recruitGroup', friendly: true });
  });

  it('prints the target line', () => {
    const p = (t: Parameters<typeof toTargetSpec>[0]) => printTarget(toTargetSpec(t));
    expect(p(Target.swordsman)).toBe('Swordsman.');
    expect(p(Target.archer)).toBe('Archer.');
    expect(p(Target.recruit.friendly)).toBe('Friendly recruit.');
    expect(p(Target.recruitGroup.friendly)).toBe('Friendly recruit group.');
    expect(p(Target.recruitGroup.with('archers'))).toBe('Recruit group with archers.');
    expect(p(Target.swordsman.alone)).toBe('Swordsman alone in its group.');
    expect(p(Target.group.nonFriendly)).toBe('Non-friendly group.');
    expect(p(Target.square.on('forest'))).toBe('Forest square.');
    expect(p(Target.square.on('mountain', 'volcano'))).toBe('Mountain or volcano square.');
    expect(p(Target.square)).toBe('Square.');
    expect(p(Target.structure)).toBe('Town or colony.');
    expect(p(Target.structure.friendly)).toBe('Friendly town or colony.');
    expect(p(Target.globe)).toBe('Globe.');
  });
});

describe('card() and target checks in the real engine', () => {
  const frag = (id: string, target: Parameters<typeof card>[0]['target']) =>
    card({ id, name: id, house: 'war', cost: {}, type: 'manifestation', target, keywords: [] });

  it('enforces friendly, class, contains-class, alone and terrain checks', () => {
    const e = mini([
      frag('f-recruit', Target.recruit.friendly),
      frag('sw', Target.swordsman),
      frag('grp-archers', Target.recruitGroup.with('archers')),
      frag('alone', Target.swordsman.alone),
      frag('forest', Target.square.on('forest')),
      frag('nonf', Target.group.nonFriendly),
    ]);
    e.state.terrain['6,6'] = 'forest';
    const red = put(e, 'red', { x: 4, y: 4 }, ['swordsman', 'archer']);
    const blue = put(e, 'blue', { x: 3, y: 3 }, ['swordsman']);
    const [sw, ar] = red.minionIds;
    expect(castMini(e, 'red', 'f-recruit', { kind: 'minion', id: sw })).toBe('cast');
    expect(castMini(e, 'red', 'f-recruit', { kind: 'minion', id: blue.minionIds[0] })).toBe('squandered');
    expect(castMini(e, 'red', 'sw', { kind: 'minion', id: sw })).toBe('cast');
    expect(castMini(e, 'red', 'sw', { kind: 'minion', id: ar })).toBe('squandered');
    expect(castMini(e, 'red', 'grp-archers', { kind: 'group', id: red.id })).toBe('cast');
    expect(castMini(e, 'blue', 'grp-archers', { kind: 'group', id: blue.id })).toBe('squandered');
    expect(castMini(e, 'red', 'alone', { kind: 'minion', id: sw })).toBe('squandered');
    expect(castMini(e, 'blue', 'alone', { kind: 'minion', id: blue.minionIds[0] })).toBe('cast');
    expect(castMini(e, 'red', 'forest', { kind: 'square', pos: { x: 6, y: 6 } })).toBe('cast');
    expect(castMini(e, 'red', 'forest', { kind: 'square', pos: { x: 7, y: 5 } })).toBe('squandered');
    expect(castMini(e, 'red', 'nonf', { kind: 'group', id: red.id })).toBe('squandered');
    expect(castMini(e, 'red', 'nonf', { kind: 'group', id: blue.id })).toBe('cast');
  });

  it('returns a plain CardDef and registers a spec', () => {
    const d = card({ id: 'plain', name: 'Plain', house: 'life', cost: { clarity: 1 }, type: 'alteration', target: Target.globe, keywords: [] });
    expect(d).toMatchObject({ id: 'plain', name: 'Plain', house: 'life', cost: { clarity: 1 }, type: 'alteration', target: 'globe' });
    expect(specOf('plain')?.target).toEqual({ type: 'globe' });
  });

  it('flags helper cards', () => {
    const d = card({ id: 'help', name: 'Help', house: 'war', cost: {}, type: 'alteration', target: Target.recruit, helper: true, keywords: [] });
    expect(d.helper).toBe(true);
  });
});

describe('renderSpec', () => {
  interface Dummy extends Keyword {
    text: string;
    layout: 'inline' | 'line';
  }
  defineKeyword<Dummy>({
    kind: 'render-dummy', term: 'Dummy', tier: 'oneoff', gloss: 'test keyword',
    print: (k) => ({ layout: k.layout, text: k.text }),
    compile: () => ({}),
  });
  defineKeyword({ kind: 'render-silent', term: 'Silent', tier: 'oneoff', gloss: 'prints nothing', print: () => null, compile: () => ({}) });
  const d = (text: string, layout: 'inline' | 'line'): Dummy => ({ kind: 'render-dummy', text, layout });

  it('prints target, then inline keywords joined, then line keywords in order', () => {
    card({
      id: 'render-card', name: 'Render', house: 'war', cost: {}, type: 'alteration', target: Target.swordsman,
      keywords: [d('Line one', 'line'), d('Alpha', 'inline'), d('Line two', 'line'), d('Beta', 'inline')],
    });
    expect(renderSpec(specOf('render-card')!).lines).toEqual(['Swordsman.', 'Alpha, Beta.', 'Line one', 'Line two']);
  });

  it('omits keywords whose print returns null', () => {
    card({
      id: 'silent', name: 'Silent', house: 'war', cost: {}, type: 'alteration', target: Target.globe,
      keywords: [{ kind: 'render-silent' }],
    });
    expect(renderSpec(specOf('silent')!).lines).toEqual(['Globe.']);
  });
});
