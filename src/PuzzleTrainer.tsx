import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Eye, History, Layers3, RotateCcw, Rotate3d, X } from 'lucide-react';
import { Chess } from 'chess.js';
import Board from './Board';
import { puzzleGame, puzzleReducer, startPuzzle, type Puzzle, type PuzzleState } from './puzzles';
import { batches, studyPuzzles } from './data/study-puzzles';
import { reviewId } from './study';
import type { Progress } from './progress';
import './puzzles.css';

type Props = {
  progress: Progress;
  batchIndex: number | null;
  onComplete: (state: PuzzleState) => void;
  onBatches: () => void;
};

export default function PuzzleTrainer({ progress, batchIndex, onComplete, onBatches }: Props) {
  const [reviewOnly, setReviewOnly] = useState(false);
  const [practiceAll, setPracticeAll] = useState(false);
  const [roundDone, setRoundDone] = useState<string[]>([]);
  const [flipped, setFlipped] = useState(false);
  const [now, setNow] = useState(Date.now);
  const dailyIds = progress.daily?.ids ?? [];
  const batch = batchIndex === null
    ? dailyIds.map(id => studyPuzzles.find(p => p.id === id)).filter((p): p is Puzzle => !!p)
    : batches[batchIndex] ?? [];
  const number = (batchIndex ?? batches.findIndex(group => group[0]?.id === dailyIds[0])) + 1;
  const first = batch.find(p => !progress.reviews[reviewId(p.id)]?.mastered) ?? batch[0] ?? studyPuzzles[0];
  const [state, dispatch] = useReducer(puzzleReducer, first, startPuzzle);
  // A separate cursor previews known positions without changing the exercise state.
  // Associate it with the run so switching/restarting a variant returns to live play.
  const [historyView, setHistoryView] = useState<{ run: number; ply: number | null }>({ run: -1, ply: null });
  const recorded = useRef(-1);
  const boardRef = useRef<HTMLDivElement>(null);
  const game = useMemo(() => puzzleGame(state), [state]);
  const knownMoves = useMemo(() => game.history(), [game]);
  const livePly = knownMoves.length;
  const viewPly = historyView.run === state.run && historyView.ply !== null ? Math.min(historyView.ply, livePly) : livePly;
  const browsing = viewPly < livePly;
  const displayedGame = useMemo(() => {
    if (!browsing) return game;
    const previous = new Chess();
    knownMoves.slice(0, viewPly).forEach(move => previous.move(move));
    return previous;
  }, [game, knownMoves, viewPly, browsing]);
  const moveLabel = viewPly === 0 ? 'Inicio' : `${Math.ceil(viewPly / 2)}${viewPly % 2 ? '.' : '…'} ${knownMoves[viewPly - 1]}`;
  const done = state.phase === 'solved';
  const due = studyPuzzles.filter(p => progress.reviews[reviewId(p.id)]?.due <= now);
  const pending = batch.filter(p => !progress.reviews[reviewId(p.id)]?.mastered);
  const available = reviewOnly ? due : practiceAll ? batch.filter(p => !roundDone.includes(p.id)) : pending;
  const empty = available.length === 0 && !done;
  const completed = practiceAll ? roundDone.length : batch.length - pending.length;
  const current = state.puzzle.steps[state.step];
  const expected = useMemo(() => {
    if (state.phase !== 'playing') return undefined;
    return new Chess(game.fen()).move(current.answer);
  }, [game, current, state.phase]);
  const options = reviewOnly
    ? [state.puzzle, ...due.filter(p => p.id !== state.puzzle.id)]
    : batch;

  const navigateHistory = useCallback((direction: number) => {
    setHistoryView(previous => {
      const current = previous.run === state.run && previous.ply !== null ? Math.min(previous.ply, livePly) : livePly;
      const ply = Math.max(0, Math.min(livePly, current + direction));
      return { run: state.run, ply: ply === livePly ? null : ply };
    });
  }, [state.run, livePly]);
  function returnToLive() { setHistoryView({ run: state.run, ply: null }); }

  useEffect(() => {
    if (empty) return;
    function handleArrow(event: KeyboardEvent) {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="slider"], [role="listbox"], [role="menu"]')) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      event.preventDefault();
      navigateHistory(event.key === 'ArrowLeft' ? -1 : 1);
    }
    window.addEventListener('keydown', handleArrow);
    return () => window.removeEventListener('keydown', handleArrow);
  }, [empty, navigateHistory]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (state.phase !== 'opponent') return;
    const timer = setTimeout(() => dispatch({ type: 'opponent' }), 360);
    return () => clearTimeout(timer);
  }, [state.phase, state.run, state.step]);
  useEffect(() => {
    if (!done || recorded.current === state.run) return;
    recorded.current = state.run;
    onComplete(state);
    if (!reviewOnly && practiceAll) setRoundDone(ids => [...new Set([...ids, state.puzzle.id])]);
  }, [state, done, onComplete]);
  // A midnight rollover updates the daily batch without replacing an active move.
  const batchKey = batch.map(p => p.id).join(',');
  useEffect(() => {
    if (!reviewOnly && batch.length && !batch.some(p => p.id === state.puzzle.id)) {
      dispatch({ type: 'reset', puzzle: first });
    }
  }, [batchKey, reviewOnly]);

  function reset(puzzle = state.puzzle) { dispatch({ type: 'reset', puzzle }); }
  function next() {
    let nextPuzzle: Puzzle | undefined;
    if (reviewOnly) nextPuzzle = due[0];
    else {
      const i = batch.findIndex(p => p.id === state.puzzle.id);
      nextPuzzle = [...batch.slice(i + 1), ...batch.slice(0, i + 1)]
        .find(p => available.some(candidate => candidate.id === p.id));
    }
    reset(nextPuzzle ?? state.puzzle);
    if (window.innerWidth < 800) boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectMode(review: boolean) {
    setReviewOnly(review);
    setPracticeAll(false); setRoundDone([]);
    reset((review ? due[0] : pending[0]) ?? batch[0] ?? state.puzzle);
  }
  const status = browsing ? 'Historial' : state.errorSquare ? 'Probá otra vez' : done ? 'Variante completada' : state.phase === 'opponent' ? 'Responden las negras' : 'Tu turno';

  return <section className="puzzle-workspace" aria-label="Práctica de variantes">
    <div className="study-header">
      <button className="study-batch-link" onClick={onBatches}><Layers3 size={17}/> Lotes <ChevronRight size={14}/> {number > 0 ? `Lote ${number}` : 'Hoy'}</button>
      <span className="study-batch-count" aria-label="Progreso del lote">{completed}/{batch.length} variantes</span>
    </div>
    {empty ? <div className="study-empty" role="status">
      <Check size={30}/>
      <h1>{reviewOnly ? 'Sin repasos pendientes' : batch.length ? 'Lote completado' : 'Todas las variantes completadas'}</h1>
      <p>{reviewOnly ? 'Los próximos repasos aparecerán cuando les toque.' : `${completed}/${batch.length} variantes recordadas sin ayuda.`}</p>
      <button className="puzzle-primary" onClick={onBatches}>Ver lotes <ArrowRight size={18}/></button>
      {!reviewOnly && batch.length > 0 && <button className="puzzle-secondary" onClick={() => { setPracticeAll(true); setRoundDone([]); reset(batch[0]); }}>Repetir lote</button>}
      {!reviewOnly && <button className="puzzle-secondary" onClick={() => selectMode(true)}>Repasos ({due.length})</button>}
    </div> : <div className="puzzle-layout">
      <div className="puzzle-board-column" ref={boardRef}>
        <div className="board-turn"><span>{status}</span><span>{state.step}/{state.puzzle.steps.length} jugadas</span></div>
        <div className={`puzzle-board ${done && !browsing ? 'is-solved' : ''}`}>
          <Board key={`${state.run}:${viewPly}`} game={displayedGame} onMove={(from, to) => { if (!browsing) dispatch({ type: 'move', from, to }); }}
            disabled={browsing || state.phase !== 'playing'} flipped={flipped}
            hint={!browsing && state.hintLevel ? expected?.from : undefined} hintTo={!browsing && state.hintLevel ? expected?.to : undefined}
            errorSquare={browsing ? undefined : state.errorSquare}
            successSquare={!browsing && (state.phase === 'opponent' || done) ? game.history({ verbose: true }).filter(m => m.color === 'w').at(-1)?.to : undefined}/>
        </div>
        <div className="puzzle-board-toolbar"><span>Blancas</span>
          <div className="move-navigation" role="group" aria-label="Historial de jugadas">
            <button onClick={() => navigateHistory(-1)} disabled={viewPly === 0} aria-label="Jugada anterior" title="Jugada anterior (←)"><ChevronLeft size={20}/></button>
            <span className="history-position" aria-live="polite" aria-label="Posición del historial">{moveLabel}</span>
            <button onClick={() => navigateHistory(1)} disabled={!browsing} aria-label="Jugada siguiente" title="Jugada siguiente (→)"><ChevronRight size={20}/></button>
          </div>
          <div>
          <button onClick={() => setFlipped(f => !f)} aria-label="Girar tablero" title="Girar tablero"><Rotate3d size={18}/></button>
          <button onClick={() => reset()} aria-label="Reiniciar variante" title="Reiniciar variante"><RotateCcw size={17}/></button>
        </div></div>
        {done && <button className="puzzle-primary mobile-next" onClick={next}>{available.length ? 'Siguiente' : 'Terminar lote'}<ArrowRight size={18}/></button>}
      </div>
      <div className="puzzle-panel">
        <div className="puzzle-mode-tabs" role="group" aria-label="Cola de práctica">
          <button className={!reviewOnly ? 'active' : ''} onClick={() => selectMode(false)}>Lote {number || ''}</button>
          <button className={reviewOnly ? 'active' : ''} onClick={() => selectMode(true)}>Repasos <span>{due.length}</span></button>
        </div>
        <div className="puzzle-panel-content">
          <label className="variant-select"><select aria-label="Variante del lote" value={state.puzzle.id} onChange={e => reset(studyPuzzles.find(p => p.id === e.target.value)!)}>
            {options.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select></label>
          <div className={`puzzle-status ${!browsing && state.errorSquare ? 'error' : done && !browsing ? 'finished' : ''}`} role="status" aria-live="polite">
            <span className="puzzle-status-icon">{browsing ? <History size={21}/> : state.errorSquare ? <X size={22}/> : done ? <Check size={24}/> : '♔'}</span>
            <div><h1>{status}</h1>{!browsing && state.errorSquare && <p>{state.message}</p>}</div>
          </div>
          <div className="study-line-progress" aria-label="Jugadas completadas"><span style={{ width: `${state.step / state.puzzle.steps.length * 100}%` }}/></div>
          {browsing && <button className="puzzle-secondary return-to-live" onClick={returnToLive}>Volver a la actual <ArrowRight size={17}/></button>}
          {done ? <div className="puzzle-result">
            {(state.assisted.length > 0 || state.failed.length > 0) && <p>Pendiente de repetir sin ayuda.</p>}
            <button className="puzzle-primary desktop-next" onClick={next}>{available.length ? 'Siguiente' : 'Terminar lote'}<ArrowRight size={18}/></button>
            <button className="puzzle-retry" onClick={() => reset()}><RotateCcw size={15}/> Repetir</button>
            <details><summary>Jugadas <ChevronRight size={15}/></summary><div className="puzzle-line">{state.puzzle.steps.map((step, i) => <span key={i}>{state.puzzle.before.length / 2 + i + 1}. {step.answer} {step.reply}</span>)}</div>
              {state.puzzle.description && <p>{state.puzzle.description}</p>}
              {state.puzzle.steps.filter(step => step.idea).map((step, i) => <p key={i}><strong>{step.answer}.</strong> {step.idea}</p>)}
            </details>
          </div> : !browsing && <div className="next-step-solution">
            <button className="puzzle-secondary" onClick={() => dispatch({ type: 'reveal' })} disabled={state.phase !== 'playing' || !!state.hintLevel}><Eye size={17}/> Ver solución</button>
            {state.hintLevel > 0 && <div className="current-answer" role="note"><strong>{current.answer}</strong><span>{expected?.from} → {expected?.to}</span></div>}
          </div>}
          <details className="batch-contents"><summary>Variantes del lote <ChevronRight size={15}/></summary><ol>{batch.map(p => <li key={p.id}><button onClick={() => { setReviewOnly(false); reset(p); }} className={state.puzzle.id === p.id ? 'active' : ''}><span>{p.title}</span>{progress.reviews[reviewId(p.id)]?.mastered && <Check size={14}/>}</button></li>)}</ol></details>
        </div>
      </div>
    </div>}
  </section>;
}
