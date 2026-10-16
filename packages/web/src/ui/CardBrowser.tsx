import { useState } from 'preact/hooks';
import { cardData, cardFace, cardIndex, keywordGlossary } from '@sanctum/cards';
import { Face, ManaChips, cap } from './format';

export function CardBrowser() {
  const [house, setHouse] = useState<'all' | 'war' | 'life'>('all');
  const [typed, setTyped] = useState('');
  const q = typed.trim().toLowerCase();
  const shown = cardData.filter((d) => {
    if (house !== 'all' && d.house !== house) return false;
    if (!q) return true;
    const hay = `${d.name} ${d.text} ${(cardFace(d.slug)?.lines ?? []).join(' ')}`.toLowerCase();
    return hay.includes(q);
  });
  return (
    <div class="browser">
      <h1>Card browser</h1>
      <div class="btnrow">
        {(['all', 'war', 'life'] as const).map((h) => (
          <button key={h} type="button" aria-pressed={house === h} onClick={() => setHouse(h)}>{h === 'all' ? 'All houses' : cap(h)}</button>
        ))}
        <input type="search" placeholder="Search name or text" aria-label="Search cards" value={typed} onInput={(e) => setTyped((e.target as HTMLInputElement).value)} />
        <span class="muted">{shown.length} of {cardData.length} cards</span>
      </div>
      <div class="browser-grid">
        {shown.map((d) => (
          <article key={d.slug} class="browser-card">
            <header><h3>{d.name}</h3><ManaChips cost={d.cost} /></header>
            <p class="muted">{cap(d.house)} · {d.rarity}</p>
            {cardIndex[d.slug] ? <Face id={d.slug} /> : <p class="muted">Not converted to keywords yet.</p>}
            <details><summary>Original text</summary><p class="muted">{d.text}</p></details>
          </article>
        ))}
      </div>
      <h2>Keywords</h2>
      <div class="browser-grid">
        {keywordGlossary().map((e) => (
          <article key={e.kind} class="browser-card">
            <header><h3>{e.term}</h3><span class="tag">{e.tier}</span></header>
            <p class="muted">{e.gloss}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
