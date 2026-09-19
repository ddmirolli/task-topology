import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Instrument } from './A_Instrument.tsx';
import { Canvas } from './B_Canvas.tsx';
import { Ledger } from './C_Ledger.tsx';
import { Atlas } from './D_Atlas.tsx';
import { Hybrid } from './E_Hybrid.tsx';
import { useMockState } from './shared.tsx';
import './mockups.css';

const DIRECTIONS = [
  { id: 'a', name: 'Instrument', view: Instrument },
  { id: 'b', name: 'Canvas', view: Canvas },
  { id: 'c', name: 'Ledger', view: Ledger },
  { id: 'd', name: 'Atlas', view: Atlas },
  { id: 'e', name: 'Hybrid', view: Hybrid },
] as const;
type Id = (typeof DIRECTIONS)[number]['id'];
const fromHash = (): Id => DIRECTIONS.find(direction => direction.id === location.hash.slice(1))?.id ?? 'a';

function Review() {
  const [id, setId] = useState<Id>(fromHash);
  const state = useMockState();
  useEffect(() => {
    const onHash = () => setId(fromHash());
    const onKey = (event: KeyboardEvent) => {
      const target = DIRECTIONS[Number(event.key) - 1];
      if (target && !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) location.hash = target.id;
    };
    addEventListener('hashchange', onHash); addEventListener('keydown', onKey);
    return () => { removeEventListener('hashchange', onHash); removeEventListener('keydown', onKey); };
  }, []);
  const View = DIRECTIONS.find(direction => direction.id === id)?.view ?? Instrument;
  return (
    <div data-direction={id} className="max-lg:pb-10 max-lg:[--review-bar:2.5rem]">
      <View state={state} />
      {/* Review chrome. It is not part of any design. */}
      <nav aria-label="Design directions" className="fixed top-1/2 left-0 z-50 flex -translate-y-1/2 flex-col overflow-hidden rounded-r-lg bg-[#111] font-sans text-[12px] text-white shadow-lg max-lg:inset-x-0 max-lg:top-auto max-lg:bottom-0 max-lg:h-10 max-lg:translate-y-0 max-lg:flex-row max-lg:rounded-none">
        {DIRECTIONS.map((direction, index) => (
          <a key={direction.id} href={`#${direction.id}`} aria-current={direction.id === id} title={`${direction.name}, key ${index + 1}`}
            className={`grid w-9 place-items-center py-2.5 text-[14px] uppercase max-lg:w-auto max-lg:flex-1 max-lg:py-0 ${direction.id === id ? 'bg-white font-semibold text-black' : 'hover:bg-white/15'}`}>
            {direction.id}<span className="ml-1.5 text-[12px] normal-case lg:hidden">{direction.name}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<StrictMode><Review /></StrictMode>);
