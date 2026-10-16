import { card, On, Target, Terraform, When } from '../lang';

export default card({ id: 'ngozis-blight', name: "Ngozi's Blight", house: 'war', cost: {}, type: 'alteration', helper: true,
  target: Target.recruit,
  keywords: [
    On(When.beforeMovement, Terraform('barren', 'aroundGroup')),
    On(When.moves, Terraform('barren', 'aroundGroup')),
  ] });
