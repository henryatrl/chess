import type { Color, PieceSymbol } from 'chess.js';

// Original, traditional Staunton silhouettes. No remote images or proprietary assets.
export default function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  const white = color === 'w';
  const fill = white ? '#f8f8f5' : '#454442';
  const shade = white ? '#d1d1cb' : '#2a2927';
  const shine = white ? '#ffffff' : '#74726f';
  const stroke = white ? '#333330' : '#1b1b19';
  return <svg className={`piece ${white ? 'white-piece' : ''}`} viewBox="0 0 64 64" aria-hidden="true" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {type === 'p' && <>
      <path d="M25 26h14l-3 8c0 6 3 10 9 14H19c6-4 9-8 9-14z"/>
      <circle cx="32" cy="19" r="9"/>
      <path d="M20 47h24l3 6H17zM17 53h30l3 6H14z"/>
      <path d="M22 50h20M18 56h28" stroke={shade} strokeWidth="2.5"/>
      <path d="M27 17c1-3 3-4 5-4" fill="none" stroke={shine} strokeWidth="2"/>
    </>}
    {type === 'r' && <>
      <path d="M15 10h9v7h5v-7h7v7h5v-7h9v18l-7 5H22l-7-5z"/>
      <path d="M23 32h18l-2 16H25zM21 47h22l4 6H17zM16 53h32l3 6H13z"/>
      <path d="M18 25h29M25 35h14M20 50h24M17 56h30" stroke={shade} strokeWidth="2.7"/>
      <path d="M26 36v9" stroke={shine} strokeWidth="2"/>
    </>}
    {type === 'b' && <>
      <path d="M28 37h8l3 11H25z"/>
      <path d="M32 11c-3 4-13 13-13 21 0 7 7 10 13 10s13-3 13-10c0-8-10-17-13-21z"/>
      <path d="m35 20-9 11" fill="none" strokeWidth="3.4"/>
      <circle cx="32" cy="9" r="3.5"/>
      <path d="M22 46h20l4 7H18zM17 53h30l4 6H13z"/>
      <path d="M23 49h18M18 56h28" stroke={shade} strokeWidth="2.7"/>
      <path d="M24 30c-1 3 0 6 3 7" stroke={shine} fill="none" strokeWidth="2"/>
    </>}
    {type === 'n' && <>
      <path d="m24 8 9 4c16 4 23 19 19 39H22c-1-7 2-13 9-20l-10 7-10-3 2-11 9-8z"/>
      <path d="m25 9 1 10-12 10M35 19c10 5 13 14 12 25" fill="none" stroke={shade} strokeWidth="3"/>
      <path d="m15 34 8-1 10-11" fill="none" strokeWidth="1.6"/>
      <path d="M18 50h33l2 9H14z"/>
      <path d="M20 55h29" stroke={shade} strokeWidth="2.7"/>
      <circle cx="27" cy="23" r="2" fill={stroke} stroke="none"/>
      <path d="m15 28 1 2" stroke={stroke} strokeWidth="2"/>
      <path d="M33 15c9 3 14 10 16 17" fill="none" stroke={shine} strokeWidth="1.7"/>
    </>}
    {type === 'q' && <>
      <path d="m12 20 8 22h24l8-22-13 12-7-19-7 19z"/>
      <circle cx="11" cy="18" r="3.5"/><circle cx="21" cy="14" r="3"/>
      <circle cx="32" cy="10" r="3.5"/><circle cx="43" cy="14" r="3"/><circle cx="53" cy="18" r="3.5"/>
      <path d="M22 39h20l-3 9H25zM21 47h22l4 6H17zM16 53h32l3 6H13z"/>
      <path d="M23 42h18M22 50h20M17 56h30" stroke={shade} strokeWidth="2.6"/>
    </>}
    {type === 'k' && <>
      <path d="M29 5h6v5h5v5h-5v7h-6v-7h-5v-5h5z"/>
      <path d="M32 25c-7-12-22-7-19 5 1 5 7 10 11 15h16c4-5 10-10 11-15 3-12-12-17-19-5z"/>
      <path d="M32 25v16" fill="none"/>
      <path d="M22 43h20l3 8H19zM17 51h30l4 8H13z"/>
      <path d="M24 47h16M18 55h28" stroke={shade} strokeWidth="2.7"/>
      <path d="M18 28c-1-4 4-7 7-4" fill="none" stroke={shine} strokeWidth="2"/>
    </>}
  </svg>;
}
