import { isSanctumArea } from '@sanctum/engine';
import type { EventContext, Pos } from '@sanctum/engine';
import { ADJACENT } from '../helpers';
import { Bound, card, OnCast, Script, Target, Terraform } from '../lang';

function erupt(c: EventContext): void {
  if (c.host.kind !== 'square' || c.random() >= 1 / 3) return;
  const here = c.host.pos;
  const spots: Pos[] = ADJACENT.map((d) => ({ x: here.x + d.x, y: here.y + d.y })).filter((p) => {
    const t = c.terrainAt(p);
    return c.state.cells.includes(`${p.x},${p.y}`) && !isSanctumArea(p) && !c.structureAt(p) && t !== 'mountain' && t !== 'volcano';
  });
  const n = Math.min(spots.length, 1 + Math.floor(c.random() * 2));
  for (let i = 0; i < n; i++) {
    const [p] = spots.splice(Math.floor(c.random() * spots.length), 1);
    c.setTerrain(p, 'lava');
    c.createSpell('lava-flow-lava', { kind: 'square', pos: p });
  }
}

// RULING: Lava Flow lives on its square while it is volcano (Bound). Sanctum squares never change terrain, so they are
// never picked. A lava square already holding a lava helper gets a second one; the first to expire cools it.
export default card({ id: 'lava-flow', name: 'Lava Flow', house: 'war', cost: { strife: 3, clarity: 2 }, type: 'alteration',
  target: Target.square.on('mountain', 'volcano'),
  keywords: [
    Bound('volcano'),
    Script('Start of turn: one chance in three to erupt into 1-2 random adjacent squares (not structures, mountains or volcanoes), which become lava for this turn and the next two, then barren.', {
      on: { 'turn:start': erupt },
    }),
    OnCast(Terraform('volcano')),
  ] });
