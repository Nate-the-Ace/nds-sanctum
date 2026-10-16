import { useMemo, useState } from 'preact/hooks';
import {
  checkOrders, emptyOrders, houseMana, key, legalTargets, step, DIR_LIST,
  type Dir, type GameState, type Orders, type Pos, type Ref, type Side, type TrainOrder,
} from '@sanctum/engine';
import { addCast, addTrain, poolPreview, removeCast, removeTrain, setDiscard, setMove } from '../model/drafts';
import { dirBetween } from '../model/geometry';
import { refLabel } from '../model/report';
import type { Session } from '../model/session';
import { Board, type Arrow } from './Board';
import { HandTray } from './HandTray';
import { ManaChips, cap, manaLabel } from './format';
import { Sidebar } from './Sidebar';

/** Which board square a target sits on (null for the globe). */
export function cellOf(s: GameState, r: Ref): Pos | null {
  switch (r.kind) {
    case 'square': return r.pos;
    case 'group': return s.groups[r.id]?.pos ?? null;
    case 'structure': return s.structures[r.id]?.pos ?? null;
    case 'minion': return s.groups[s.minions[r.id]?.groupId]?.pos ?? null;
    default: return null;
  }
}

/** Labels for a target list; identical labels (two red swordsmen) are numbered so the buttons can be told apart. */
export function choiceLabels(refs: Ref[], s: GameState): string[] {
  const labels = refs.map((r) => refLabel(r, s));
  return labels.map((l, i) => {
    const same = labels.filter((x) => x === l).length;
    return same > 1 ? `${l} ${labels.slice(0, i + 1).filter((x) => x === l).length}` : l;
  });
}

const at = (p: Pos) => `(${p.x + 1},${p.y + 1})`;

/** "Move group (3,3) to (4,3)": compass letters mean little on a diamond board. */
export function moveLabel(s: GameState, groupId: number, dir: Dir): string {
  const g = s.groups[groupId];
  return g?.pos ? `Move group ${at(g.pos)} to ${at(step(g.pos, dir))}` : `Move group ${dir.toUpperCase()}`;
}

export interface OrdersScreenProps {
  session: Session;
  side: Side;
  /** Lock the orders. Returns the engine's error text, or null when the orders were accepted. */
  onLock: (o: Orders) => string | null;
}

export function OrdersScreen({ session, side, onLock }: OrdersScreenProps) {
  const { state, cards } = session;
  const me = state.players[side];
  const [draft, setDraft] = useState<Orders>(emptyOrders());
  const [sel, setSel] = useState<Ref | null>(null);
  const [armed, setArmed] = useState<number | null>(null);
  const [choices, setChoices] = useState<Ref[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  const targets = useMemo(() => (armed === null ? [] : legalTargets(state, cards, side, me.hand[armed])), [armed, state]);
  const preview = poolPreview(me.mana, me.hand, cards, draft);
  // Over-spending blocks locking; say why in the engine's own words.
  const overError = preview.over ? checkOrders(state, cards, side, draft) : null;

  const ownGroup = sel?.kind === 'group' && state.groups[sel.id]?.owner === side && state.groups[sel.id].control === 'player' ? state.groups[sel.id] : null;
  // Your structure on the selected square: a group standing on its own Sanctum still offers training there.
  const selPos = sel ? cellOf(state, sel) : null;
  const ownStructure = selPos
    ? Object.values(state.structures).find((x) => x.owner === side && x.pos.x === selPos.x && x.pos.y === selPos.y) ?? null
    : null;

  const highlights = new Set<string>();
  if (armed !== null) {
    for (const t of targets) {
      const c = cellOf(state, t);
      if (c) highlights.add(key(c));
    }
  } else if (ownGroup?.pos) {
    for (const d of DIR_LIST) {
      const p = step(ownGroup.pos, d);
      if (state.cells.includes(key(p)) && checkOrders(state, cards, side, setMove(draft, ownGroup.id, d)) === null) highlights.add(key(p));
    }
  }

  const arrows: Arrow[] = draft.move.flatMap((m) => {
    const g = state.groups[m.groupId];
    return g?.pos ? [{ from: g.pos, to: step(g.pos, m.dir), owner: side }] : [];
  });

  const commitCast = (r: Ref) => {
    if (armed === null) return;
    setDraft(addCast(draft, armed, r));
    setArmed(null);
    setChoices([]);
    setMessage(null);
  };

  const onCell = (pos: Pos) => {
    setMessage(null);
    if (armed !== null) {
      const here = targets.filter((t) => {
        const c = cellOf(state, t);
        return c && c.x === pos.x && c.y === pos.y;
      });
      if (here.length === 1) commitCast(here[0]);
      else if (here.length > 1) setChoices(here);
      return;
    }
    if (ownGroup?.pos) {
      const dir = dirBetween(ownGroup.pos, pos);
      if (dir) {
        const current = draft.move.find((m) => m.groupId === ownGroup.id);
        const next = setMove(draft, ownGroup.id, current?.dir === dir ? null : dir);
        const err = checkOrders(state, cards, side, next);
        if (err) setMessage(err);
        else setDraft(next);
        return;
      }
    }
    // A second click on the selected group lets go of it, so a neighbouring square can be picked instead of moved to.
    if (ownGroup?.pos && ownGroup.pos.x === pos.x && ownGroup.pos.y === pos.y) {
      setSel(null);
      return;
    }
    const g = Object.values(state.groups).find((x) => x.pos && x.pos.x === pos.x && x.pos.y === pos.y);
    const st = Object.values(state.structures).find((x) => x.pos.x === pos.x && x.pos.y === pos.y);
    setSel(g ? { kind: 'group', id: g.id } : st ? { kind: 'structure', id: st.id } : { kind: 'square', pos });
  };

  const trainedAt = (id: number) => draft.train.filter((t) => t.structureId === id).length;
  // Training is checked like a move: the engine says whether this extra novice is allowed.
  const train = (as: TrainOrder['as']) => {
    if (!ownStructure) return;
    const next = addTrain(draft, ownStructure.id, as);
    // Casts are left out so an unaffordable spell already queued does not mask (or cause) the answer.
    const err = checkOrders(state, cards, side, { ...next, cast: [] });
    if (err) {
      setMessage(err);
      return;
    }
    setMessage(null);
    setDraft(next);
  };
  const trainOptions: Array<TrainOrder['as']> = ownStructure
    ? ['swordsman', 'archer', ...(ownStructure.kind === 'sanctum' ? houseMana(me.house) : [])]
    : [];

  const lock = () => setMessage(onLock(draft));
  const initiative = state.initiative === side ? 'You have initiative' : `${cap(state.initiative)} has initiative`;

  return (
    <div class={`orders side-${side}`}>
      <header class="topbar">
        <h2>{cap(side)}'s orders · Turn {state.turn}</h2>
        <span class="muted">{initiative}</span>
        <span class="pool" aria-label="Mana pool after your orders"><span class="muted" title="Unspent mana is lost at the end of the turn">Mana this turn</span> <ManaChips cost={preview.pool} empty="no mana" /></span>
        <button type="button" class="primary" onClick={lock} disabled={preview.over}>Lock orders</button>
      </header>
      {message ? <p class="banner bad" role="alert">{message}</p> : null}
      {preview.over ? <p class="banner bad" role="alert">{overError ?? 'Not enough mana for these spells.'}</p> : null}
      <div class="stage">
        <Board state={state} selected={sel} highlights={highlights} arrows={arrows} onCell={onCell} />
        <Sidebar state={state} cards={cards} selected={sel}>
          {ownStructure ? (
            <section>
              <h3>Train at the {ownStructure.kind}</h3>
              <p class="muted">{ownStructure.novices - trainedAt(ownStructure.id)} novice(s) left here</p>
              <div class="btnrow">
                {trainOptions.map((as) => (
                  <button key={as} type="button" disabled={trainedAt(ownStructure.id) >= ownStructure.novices} onClick={() => train(as)}>
                    Train {as === 'swordsman' || as === 'archer' ? as : `as ${manaLabel(as)} mana`}
                  </button>
                ))}
              </div>
            </section>
          ) : null}
          {armed !== null ? (
            <section>
              <h3>Cast {cards[me.hand[armed]].name}</h3>
              {cards[me.hand[armed]].target === 'globe' ? (
                <button type="button" class="primary" onClick={() => commitCast({ kind: 'globe' })}>Cast on the globe</button>
              ) : <p class="muted">{targets.length ? 'Click a highlighted square.' : 'No legal target right now.'}</p>}
              {choices.length > 0 ? (
                <ul class="choices">
                  {choiceLabels(choices, state).map((label, i) => <li key={i}><button type="button" onClick={() => commitCast(choices[i])}>{label}</button></li>)}
                </ul>
              ) : null}
            </section>
          ) : null}
          <section>
            <h3>Orders</h3>
            <ul class="orders-list">
              {draft.train.map((t, i) => (
                <li key={`t${i}`}>Train {t.as === 'swordsman' || t.as === 'archer' ? t.as : `as ${manaLabel(t.as)} mana`} <button type="button" aria-label="Remove training" onClick={() => setDraft(removeTrain(draft, i))}>×</button></li>
              ))}
              {draft.move.map((m) => (
                <li key={`m${m.groupId}`}>{moveLabel(state, m.groupId, m.dir)} <button type="button" aria-label="Remove move" onClick={() => setDraft(setMove(draft, m.groupId, null))}>×</button></li>
              ))}
              {draft.cast.map((c) => (
                <li key={`c${c.handIndex}`}>Cast {cards[me.hand[c.handIndex]].name} on {refLabel(c.target, state)} <button type="button" aria-label="Remove cast" onClick={() => setDraft(removeCast(draft, c.handIndex))}>×</button></li>
              ))}
              {draft.discard !== null ? <li>Discard {cards[me.hand[draft.discard]].name}</li> : null}
              {draft.train.length + draft.move.length + draft.cast.length === 0 && draft.discard === null ? <li class="muted">No orders yet.</li> : null}
            </ul>
          </section>
        </Sidebar>
      </div>
      <HandTray hand={me.hand} cards={cards} draft={draft} armed={armed}
        onArm={(i) => { setArmed(i); setChoices([]); setMessage(null); }}
        onDiscard={(i) => setDraft(setDiscard(draft, i))} />
    </div>
  );
}
