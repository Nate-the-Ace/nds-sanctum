import { playableCards } from '@sanctum/cards';

export function App() {
  return (
    <main class="shell">
      <h1>Sanctum</h1>
      <p>{playableCards.length} cards ready to play.</p>
    </main>
  );
}
