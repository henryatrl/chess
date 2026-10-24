import { useId, useState } from 'react';
import { Chess, type Square, type PieceSymbol, type Color } from 'chess.js';

const names: Record<PieceSymbol, string> = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };
function Piece({ type, color }: { type: PieceSymbol; color: Color }) {
  const fill = color === 'w' ? '#fffdf3' : '#263c36';
  const stroke = color === 'w' ? '#35483d' : '#101e19';
  return <svg className={`piece ${color === 'w' ? 'white-piece' : ''}`} viewBox="0 0 48 48" aria-hidden="true" fill={fill} stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
    {type === 'p' && <><circle cx="24" cy="13" r="6"/><path d="M19 20h10l-2 6c0 5 3 7 6 10H15c3-3 6-5 6-10z"/><path d="M14 36h20v5H14z"/></>}
    {type === 'r' && <><path d="M13 9h6v5h3V9h5v5h3V9h6v13H13z"/><path d="M17 22h15l-2 12H19z"/><path d="M15 34h19v4H15zM12 38h25v4H12z"/><path d="M17 20h15"/></>}
    {type === 'b' && <><circle cx="24" cy="7" r="2.5"/><path d="M24 9c-4 4-10 9-10 14 0 5 5 7 10 7s10-2 10-7c0-5-6-10-10-14z"/><path d="m27 13-6 9" fill="none"/><path d="M20 30h8l3 6H17zM15 36h18v3H15zM12 39h24v3H12z"/></>}
    {type === 'n' && <><path d="m18 7 8 3c11 4 14 17 10 27H16c0-7 4-11 9-16l-9 6-7-3 2-8 7-5z"/><path d="m18 7 1 8-8 6M28 17c5 5 5 11 4 15" fill="none"/><circle cx="21" cy="16" r="1.3" fill={stroke}/><path d="M13 37h25v5H13z"/></>}
    {type === 'q' && <><path d="m12 16 5 16h15l5-16-9 7-4-13-5 13z"/><circle cx="11" cy="13" r="3"/><circle cx="24" cy="8" r="3"/><circle cx="38" cy="13" r="3"/><path d="M16 32h17v4H16zM13 36h23v6H13z"/></>}
    {type === 'k' && <><path d="M24 3v10M20 7h8" fill="none" strokeWidth="2.8"/><path d="M24 16c-7-9-16-1-11 8l5 8h12l5-8c5-9-4-17-11-8z"/><path d="M24 16v13" fill="none"/><path d="M17 32h14v4H17zM13 36h22v6H13z"/></>}
  </svg>;
}

export default function Board({ game, onMove, flipped = false, hint, hintTo, errorSquare, successSquare, disabled = false }: { game: Chess; onMove?: (from: Square, to: Square) => void; flipped?: boolean; hint?: Square; hintTo?: Square; errorSquare?: Square; successSquare?: Square; disabled?: boolean }) {
  const arrowId = useId().replace(/:/g, '');
  const [selected, setSelected] = useState<Square | null>(null);
  const [selectedFen, setSelectedFen] = useState('');
  const fen = game.fen();
  const active = selectedFen === fen ? selected : null;
  const targets = active ? game.moves({ square: active, verbose: true }).map(m => m.to) : [];
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  const last = game.history({ verbose: true }).at(-1);
  function center(square: Square) { return { x: (files.indexOf(square[0]) + .5) * 100, y: (ranks.indexOf(square[1]) + .5) * 100 }; }
  function choose(square: Square) {
    if (disabled || !onMove) return;
    if (active === square) { setSelected(null); return; }
    const p = game.get(square);
    if (p?.color === game.turn()) { setSelected(square); setSelectedFen(fen); return; }
    if (active) { onMove(active, square); setSelected(null); }
  }
  return <div className="board-frame"><div className="chessboard-wrap"><div className="chessboard" role="group" aria-label="Tablero de ajedrez. Seleccioná una pieza y después su destino.">
    {[...ranks].flatMap((rank, row) => [...files].map((file, col) => {
      const square = `${file}${rank}` as Square;
      const piece = game.get(square);
      const isTarget = targets.includes(square);
      const isLast = last?.from === square || last?.to === square;
      return <button key={square} type="button" data-square={square} className={`square ${(row + col) % 2 ? 'dark' : 'light'} ${active === square ? 'selected' : ''} ${isLast ? 'last-move' : ''} ${hint === square ? 'hint-square' : ''} ${isTarget ? 'target' : ''}`}
        aria-label={`${square}${piece ? `, ${names[piece.type]} ${piece.color === 'w' ? 'blanco' : 'negro'}` : ', vacía'}`}
        aria-disabled={disabled || !onMove} onClick={() => choose(square)}
        onDragOver={e => { if (!disabled && onMove) e.preventDefault(); }}
        onDrop={e => { e.preventDefault(); const from = e.dataTransfer.getData('text/plain') as Square; if (onMove && !disabled && /^[a-h][1-8]$/.test(from)) onMove(from, square); setSelected(null); }}>
        {col === 0 && <span className="rank-label">{rank}</span>}
        {row === 7 && <span className="file-label">{file}</span>}
        {isTarget && <span className={piece ? 'capture-ring' : 'move-dot'}/>}
        {piece && <span className="piece-wrap" draggable={!!onMove && !disabled && piece.color === game.turn()} onDragStart={e => { e.dataTransfer.setData('text/plain', square); setSelected(square); setSelectedFen(fen); }}><Piece type={piece.type} color={piece.color}/></span>}
        {errorSquare === square && <span className="square-feedback incorrect" aria-hidden="true">×</span>}
        {successSquare === square && errorSquare !== square && <span className="square-feedback correct" aria-hidden="true">✓</span>}
      </button>;
    }))}
  </div>{hint && hintTo && <svg className="board-arrow" viewBox="0 0 800 800" aria-hidden="true"><defs><marker id={arrowId} markerWidth="3" markerHeight="3" refX="2" refY="1.5" orient="auto"><path d="M0 0L3 1.5L0 3Z" fill="#f9a834"/></marker></defs><line x1={center(hint).x} y1={center(hint).y} x2={center(hintTo).x} y2={center(hintTo).y} stroke="#f9a834" strokeWidth="15" strokeLinecap="round" markerEnd={`url(#${arrowId})`} opacity=".9"/></svg>}</div></div>;
}
