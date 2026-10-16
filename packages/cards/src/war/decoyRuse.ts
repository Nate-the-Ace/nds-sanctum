import { card, Grant, Pacified, Target, Taunt, Undispellable } from '../lang';

// RULING: the helpers that make a created creature what it is (Decoy Ruse, Warlord Command, Bard Song, Ngozi's
// Blight, Lienna's Presence) are part of the creature, not enchantments on it: they are Undispellable, so Cleansing
// Light cannot strip them, and being non-visible they do not count as enchantments (Warded). Veteran and Rite of
// Growth stay ordinary visible spells, as printed.
// RULING: "one Decoy per group" is checked only when Decoy is cast; a Decoy that later joins a group that already
// has one (by merging or moving) is allowed.

export default card({ id: 'decoy-ruse', name: 'Decoy Ruse', house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit, keywords: [Undispellable(), Grant({ armor: 2 }), Pacified(), Taunt()] });
