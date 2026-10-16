import { useState } from 'preact/hooks';
import type { Mana, Orders } from '@sanctum/engine';
import { afterReport, begin, lock, newSession, pickMana, type Session } from './model/session';
import { CardBrowser } from './ui/CardBrowser';
import { OrdersScreen } from './ui/OrdersScreen';
import { Handoff, ManaChoice, Over, ReportScreen, Setup } from './ui/Screens';

export function App() {
  const [tab, setTab] = useState<'play' | 'cards'>('play');
  const [session, setSession] = useState<Session | null>(null);

  const play = () => {
    if (!session) return <Setup onStart={(seed, houses) => setSession(newSession(seed, houses))} />;
    const sc = session.screen;
    switch (sc.kind) {
      case 'handoff':
        return <Handoff to={sc.to} turn={session.state.turn} onReady={() => setSession(begin(session, sc.to))} />;
      case 'orders':
        return (
          <OrdersScreen key={`${session.state.turn}-${sc.side}`} session={session} side={sc.side}
            onLock={(o: Orders) => {
              const r = lock(session, sc.side, o);
              if (!r.ok) return r.error;
              setSession(r.session);
              return null;
            }} />
        );
      case 'mana':
        return <ManaChoice session={session} side={sc.side} onPick={(id: number, m: Mana) => setSession(pickMana(session, sc.side, id, m))} />;
      case 'report':
        return <ReportScreen session={session} report={session.report!} onNext={() => setSession(afterReport(session))} />;
      case 'over':
        return <Over winner={session.state.winner} onNew={() => setSession(null)} />;
    }
  };

  return (
    <div class="frame">
      <nav class="tabs" aria-label="Sections">
        <button type="button" aria-current={tab === 'play' ? 'page' : undefined} onClick={() => setTab('play')}>Play</button>
        <button type="button" aria-current={tab === 'cards' ? 'page' : undefined} onClick={() => setTab('cards')}>Cards</button>
      </nav>
      <div class="view">{tab === 'play' ? play() : <CardBrowser />}</div>
    </div>
  );
}
