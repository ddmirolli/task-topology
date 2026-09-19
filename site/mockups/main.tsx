import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Hybrid } from './E_Hybrid.tsx';
import { useMockState } from './shared.tsx';
import './mockups.css';

function Review() {
  const state = useMockState();
  return (
    <div data-direction="e">
      <Hybrid state={state} />
      {/* Review chrome. It is not part of the design. */}
      <p className="fixed right-3 bottom-3 z-50 rounded-full bg-[#111] px-3 py-1.5 font-sans text-[12px] text-white">Notional data</p>
    </div>
  );
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<StrictMode><Review /></StrictMode>);
