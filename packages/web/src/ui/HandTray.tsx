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
        const isArmed = armed === i;
        // State is spelled out in a badge, not only by the border colour.
        const badge = isArmed ? 'Choosing target' : queued ? 'Queued' : discarded ? 'Discarding' : null;
        return (
          <article key={`${id}-${i}`} class={`hand-card${isArmed ? ' armed' : ''}${queued ? ' queued' : ''}${discarded ? ' discarded' : ''}`}>
            <header>
              <h3>{card.name}</h3>
              {badge ? <span class="badge">{badge}</span> : null}
              <ManaChips cost={card.cost} />
            </header>
            <Face id={id} />
            <footer>
              {/* The accessible name is the visible verb plus the card name ("Retarget Warlord"). */}
              <button type="button" onClick={() => onArm(isArmed ? null : i)} disabled={discarded}>
                {isArmed ? 'Cancel' : queued ? 'Retarget' : 'Play'}<span class="sr-only"> {card.name}</span>
              </button>
              <button type="button" onClick={() => onDiscard(discarded ? null : i)} disabled={queued}>
                {discarded ? 'Keep' : 'Discard'}<span class="sr-only"> {card.name}</span>
              </button>
            </footer>
          </article>
        );
      })}
    </div>
  );
}
