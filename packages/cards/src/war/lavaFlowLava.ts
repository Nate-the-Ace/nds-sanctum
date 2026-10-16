import { card, Lasts, Script, Target } from '../lang';

/** Lava Flow helper on each erupted square: "lava for current turn +2, then barren". */
export default card({ id: 'lava-flow-lava', name: 'Lava Flow (lava)', house: 'war', cost: {}, type: 'conjuration', helper: true,
  target: Target.square,
  keywords: [
    Lasts(3),
    Script('When it ends, lava here becomes barren.', {
      onExpire: (c) => {
        if (c.host.kind === 'square' && c.terrainAt(c.host.pos) === 'lava') c.setTerrain(c.host.pos, 'barren');
      },
    }),
  ] });
