import { MANA_TYPES, type CardIndex, type Dir, type Mana, type ManaPool, type Orders, type Ref, type TrainOrder } from '@sanctum/engine';

/** Orders are plain data; every helper returns a new value. */
export const setMove = (o: Orders, groupId: number, dir: Dir | null): Orders => ({
  ...o,
  move: [...o.move.filter((m) => m.groupId !== groupId), ...(dir ? [{ groupId, dir }] : [])],
});

export const addTrain = (o: Orders, structureId: number, as: TrainOrder['as']): Orders => ({
  ...o,
  train: [...o.train, { structureId, as }],
});

export const removeTrain = (o: Orders, index: number): Orders => ({ ...o, train: o.train.filter((_, i) => i !== index) });

/** One cast per hand slot: casting the same slot again replaces its target. */
export const addCast = (o: Orders, handIndex: number, target: Ref): Orders => ({
  ...o,
  cast: [...o.cast.filter((c) => c.handIndex !== handIndex), { handIndex, target }],
});

export const removeCast = (o: Orders, handIndex: number): Orders => ({ ...o, cast: o.cast.filter((c) => c.handIndex !== handIndex) });

export const setDiscard = (o: Orders, handIndex: number | null): Orders => ({ ...o, discard: handIndex });

/** The mana pool after the planned mana training and spell costs; `over` is true when any type is negative. */
export function poolPreview(
  base: ManaPool, hand: string[], cards: CardIndex, o: Orders,
): { pool: ManaPool; over: boolean } {
  const pool = { ...base };
  for (const t of o.train) if ((MANA_TYPES as string[]).includes(t.as)) pool[t.as as Mana] += 1;
  for (const c of o.cast) {
    const card = cards[hand[c.handIndex]];
    if (!card) continue;
    for (const [m, n] of Object.entries(card.cost) as Array<[Mana, number]>) pool[m] -= n;
  }
  return { pool, over: MANA_TYPES.some((m) => pool[m] < 0) };
}
