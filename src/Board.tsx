import { useId, useState } from 'react';
import { Chess, type Square, type PieceSymbol } from 'chess.js';
import Piece from './Piece';

const names: Record<PieceSymbol, string> = { p: 'peón', n: 'caballo', b: 'alfil', r: 'torre', q: 'dama', k: 'rey' };

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
