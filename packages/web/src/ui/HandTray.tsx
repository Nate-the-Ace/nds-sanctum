import type { CardIndex, Orders } from '@sanctum/engine';
import { Face, ManaChips } from './format';

export interface HandTrayProps {
  hand: string[];
  cards: CardIndex;
  draft: Orders;
  armed: number | null;
  onArm: (index: number | null) => void;
  onDiscard: (index: number | null) => void;
}

export function HandTray({ hand, cards, draft, armed, onArm, onDiscard }: HandTrayProps) {
  return (
    <div class="hand" role="group" aria-label="Your hand">
      {hand.map((id, i) => {
        const card = cards[id];
        const queued = draft.cast.some((c) => c.handIndex === i);
        const discarded = draft.discard === i;
        return (
          <article key={`${id}-${i}`} class={`hand-card${armed === i ? ' armed' : ''}${queued ? ' queued' : ''}${discarded ? ' discarded' : ''}`}>
            <header>
              <h3>{card.name}</h3>
              <ManaChips cost={card.cost} />
            </header>
            <Face id={id} />
            <footer>
              <button type="button" aria-label={`Play ${card.name}`} onClick={() => onArm(armed === i ? null : i)} disabled={discarded}>
                {armed === i ? 'Cancel' : queued ? 'Retarget' : 'Play'}
              </button>
              <button type="button" aria-label={`Discard ${card.name}`} onClick={() => onDiscard(discarded ? null : i)} disabled={queued}>
                {discarded ? 'Keep' : 'Discard'}
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
