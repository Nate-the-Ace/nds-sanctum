import { card, On, Target, Terraform, Undispellable, When } from '../lang';

// RULING: non-dispellable identity helper (see decoyRuse.ts).

export default card({ id: 'ngozis-blight', name: "Ngozi's Blight", house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    Undispellable(),
    On(When.beforeMovement, Terraform('barren', 'aroundGroup')),
    On(When.moves, Terraform('barren', 'aroundGroup')),
  ] });
