import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, Eye, Flame, Lightbulb, RotateCcw, Rotate3d, Target, Trophy, X } from 'lucide-react';
import { Chess } from 'chess.js';
import Board from './Board';
import { cards } from './data/repertoire';
import { puzzleGame, puzzleReducer, puzzles, startPuzzle, type PuzzleState } from './puzzles';
import type { Progress } from './progress';
import './puzzles.css';

export default function PuzzleTrainer({ progress, onComplete, onLibrary }: { progress: Progress; onComplete: (state: PuzzleState) => void; onLibrary: () => void }) {
  const [state, dispatch] = useReducer(puzzleReducer, puzzles[0], startPuzzle);
  const [flipped, setFlipped] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [cleanStreak, setCleanStreak] = useState(0);
  const [now, setNow] = useState(Date.now);
  const recorded = useRef(-1);
  const boardRef = useRef<HTMLDivElement>(null);
  const game = useMemo(() => puzzleGame(state), [state]);
  const current = state.puzzle.steps[state.step];
  const expected = useMemo(() => {
    if (state.phase !== 'playing') return undefined;
    const trial = new Chess(game.fen());
    return trial.move(current.answer);
  }, [game, current, state.phase]);
  const reviewPuzzles = puzzles.filter(puzzle => cards.some(card => card.deck === puzzle.id && progress.reviews[card.id]?.due <= now));
  const available = reviewOnly ? reviewPuzzles : puzzles;
  const done = state.phase === 'solved' || state.phase === 'solution';
  const empty = reviewOnly && available.length === 0 && !done;
  const correctCount = state.phase === 'solution' ? 0 : state.step;
  const positionInQueue = available.findIndex(p => p.id === state.puzzle.id);

  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer); }, []);
  useEffect(() => {
    if (state.phase !== 'opponent') return;
    const timer = setTimeout(() => dispatch({ type: 'opponent' }), 420);
    return () => clearTimeout(timer);
  }, [state.phase, state.run, state.step]);
  useEffect(() => {
    if (!done || recorded.current === state.run) return;
    recorded.current = state.run;
    onComplete(state);
    if (state.phase === 'solved') {
      setCompleted(n => n + 1);
      setCleanStreak(n => state.failed.length || state.assisted.length ? 0 : n + 1);
    } else setCleanStreak(0);
  }, [state, done, onComplete]);

  function reset(puzzle = state.puzzle) { dispatch({ type: 'reset', puzzle }); }
  function next() {
    if (!available.length) { reset(); return; }
    const nextPuzzle = available[(positionInQueue + 1) % available.length];
    if (nextPuzzle) reset(nextPuzzle);
    if (window.innerWidth < 800) boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function selectReview(review: boolean) {
    setReviewOnly(review);
    reset(review ? reviewPuzzles[0] ?? state.puzzle : puzzles[0]);
  }

  return <section className="puzzle-workspace" aria-label="Puzzles de apertura">
    <div className="puzzle-heading"><div><span className="puzzle-eyebrow">TU PRÓXIMA BUENA JUGADA</span><h1>Puzzles de aperturas<span>.</span></h1><p>Reconocé el patrón. Completá la línea.</p></div><div className="puzzle-session-stats"><span><Trophy size={18}/><strong>{completed}</strong> resueltos</span><span><Flame size={18}/><strong>{cleanStreak}</strong> sin ayuda seguidos</span></div></div>
    <div className="puzzle-layout">
      <div className="puzzle-board-column" ref={boardRef}>
        <div className="puzzle-opponent"><span className="puzzle-player-icon">♟</span><div><strong>Tu compañero de práctica</strong><small>La italiana · {state.puzzle.eco}</small></div><span className="opponent-label">NEGRAS</span></div>
        <div className={`puzzle-mobile-status ${state.errorSquare ? 'error' : done ? 'complete' : ''}`}><span>{empty ? 'Sin repasos pendientes' : state.errorSquare ? '↻ Probá otra vez' : state.phase === 'solved' ? '✓ ¡Línea completada!' : state.phase === 'solution' ? 'Solución revelada' : state.phase === 'opponent' ? '✓ Correcto · Responden las negras…' : state.step ? '✓ Correcto · Tu turno' : '♔ Tu turno · Juegan blancas'}</span><strong>{correctCount}/{state.puzzle.steps.length}</strong></div>
        <div className={`puzzle-board ${state.errorSquare ? 'has-error' : ''} ${state.phase === 'solved' ? 'is-solved' : ''}`}>
          <Board key={state.run} game={game} onMove={(from, to) => dispatch({ type: 'move', from, to })} disabled={empty || state.phase !== 'playing'} flipped={flipped} hint={state.hintLevel ? expected?.from : undefined} hintTo={state.hintLevel === 2 ? expected?.to : undefined} errorSquare={state.errorSquare} successSquare={state.phase === 'opponent' || state.phase === 'solved' ? game.history({ verbose: true }).filter(m => m.color === 'w').at(-1)?.to : undefined}/>
        </div>
        <div className="puzzle-board-toolbar"><div className="puzzle-you"><span className="puzzle-player-icon">♙</span><div><strong>Vos</strong><small>Jugás con blancas</small></div></div><div><button onClick={() => setFlipped(f => !f)} aria-label="Girar tablero" title="Girar tablero"><Rotate3d size={19}/></button><button onClick={() => reset()} aria-label="Reiniciar puzzle" title="Reiniciar puzzle"><RotateCcw size={18}/></button></div></div>
        {done && <button className="puzzle-primary puzzle-mobile-next" onClick={next}>Siguiente puzzle <ArrowRight size={20}/></button>}
      </div>

      <div className="puzzle-panel">
        <div className="puzzle-mode-tabs" role="group" aria-label="Cola de puzzles"><button className={!reviewOnly ? 'active' : ''} onClick={() => selectReview(false)}>Practicar</button><button className={reviewOnly ? 'active' : ''} onClick={() => selectReview(true)}>Mis repasos <span>{reviewPuzzles.length}</span></button></div>
        <div className="puzzle-panel-content">
          <div className="puzzle-chapter"><span className="puzzle-chapter-icon">♞</span><div><span>APERTURA ITALIANA</span><label><select aria-label="Variante del puzzle" value={state.puzzle.id} disabled={empty} onChange={e => reset(puzzles.find(p => p.id === e.target.value)!)}>{(empty ? puzzles : available).map(puzzle => <option key={puzzle.id} value={puzzle.id}>{puzzle.title}</option>)}</select></label></div></div>

          {empty ? <div className="puzzle-empty"><Check size={38}/><h2>¡Estás al día!</h2><p>No tenés variantes pendientes. Podés seguir practicando libremente o volver cuando toque un repaso.</p><button className="puzzle-primary" onClick={() => selectReview(false)}>Seguir practicando <ArrowRight size={19}/></button></div> : <>
            <div className={`puzzle-status ${state.errorSquare ? 'error' : done ? 'finished' : ''}`} role="status" aria-live="polite">
              <span className="puzzle-status-icon">{state.errorSquare ? <X size={25}/> : done ? state.phase === 'solved' ? <Check size={27}/> : <Eye size={25}/> : state.phase === 'opponent' ? <Check size={24}/> : '♔'}</span>
              <div><h2>{state.errorSquare ? 'Probá otra vez' : state.phase === 'solved' ? '¡Puzzle completado!' : state.phase === 'solution' ? 'Esta es la solución' : state.phase === 'opponent' ? '¡Buena jugada!' : state.step > 0 ? '¡Correcto! Seguí así' : 'Juegan blancas'}</h2><p>{state.errorSquare ? state.message : done ? state.phase === 'solution' ? 'Reintentá para fijar la secuencia.' : state.failed.length || state.assisted.length ? 'Completaste la línea. Cada intento cuenta.' : 'Toda la línea, sin ayuda. Bien jugado.' : state.phase === 'opponent' ? 'Ahora responde tu rival…' : 'Encontrá la siguiente jugada de esta línea.'}</p></div>
            </div>

            <div className="puzzle-steps"><div><span>Tu recorrido</span><strong>{Math.min(correctCount, state.puzzle.steps.length)} / {state.puzzle.steps.length} jugadas</strong></div><div className="puzzle-step-dots">{state.puzzle.steps.map((_, i) => <span key={i} className={i < correctCount ? 'complete' : i === state.step && !done ? 'current' : ''} aria-label={`Jugada ${i + 1}${i < correctCount ? ', completada' : ''}`}>{i < correctCount ? <Check size={13}/> : i + 1}</span>)}</div></div>

            {state.hintLevel > 0 && !done && <div className="puzzle-hint" role="note"><Lightbulb size={19}/><p>{current?.hint}{state.hintLevel === 2 && <strong> Seguí la flecha del tablero.</strong>}</p></div>}
            {state.phase === 'playing' && state.step > 0 && !state.errorSquare && <p className="puzzle-correct-note"><Check size={15}/> La jugada anterior pertenece a la línea.</p>}

            {done ? <div className="puzzle-result"><div className="puzzle-explanation"><span><Lightbulb size={17}/> El plan de esta variante</span><p>{state.puzzle.description}</p></div><div className="puzzle-line" aria-label="Solución de la línea">{state.puzzle.steps.map((step, i) => <span key={i}><b>{(state.puzzle.before.length / 2) + i + 1}.</b> {step.answer} {step.reply}</span>)}</div><details><summary>Entender cada jugada <ChevronRight size={16}/></summary>{state.puzzle.steps.map((step, i) => <p key={i}><strong>{step.answer}.</strong> {step.idea}</p>)}</details><button className="puzzle-primary" onClick={next}>Siguiente puzzle <ArrowRight size={20}/></button><button className="puzzle-retry" onClick={() => reset()}><RotateCcw size={15}/> Volver a intentarlo</button><p className="puzzle-save-note">{state.phase === 'solution' ? 'Programado para repasar en 5 minutos.' : state.failed.length || state.assisted.length ? 'Las posiciones que costaron vuelven antes.' : 'Progreso guardado. Próximo repaso en 3 días.'}</p></div> : <div className="puzzle-thinking"><div className="puzzle-focus-icon"><Target size={28}/></div><p>Las buenas aperturas se aprenden<br/>jugándolas, una y otra vez.</p><div className="puzzle-actions"><button onClick={() => dispatch({ type: 'hint' })} disabled={state.phase !== 'playing' || state.hintLevel === 2}><Lightbulb size={18}/>{state.hintLevel ? 'Mostrar destino' : 'Pedir una pista'}</button><button onClick={() => dispatch({ type: 'reveal' })} disabled={state.phase !== 'playing'}><Eye size={18}/> Ver solución</button></div><span className="puzzle-instruction">Hacé clic o arrastrá las piezas para mover.</span></div>}
          </>}
        </div>
        <button className="puzzle-library-link" onClick={onLibrary}><BookOpen size={17}/><span>Explorá las 187 líneas de la italiana</span><ChevronRight size={16}/></button>
      </div>
    </div>
    <div className="puzzle-bottom-note"><span><span/> Repertorio con blancas · 3 recorridos completos</span><p>Practicás una línea elegida. Otras jugadas también pueden ser buenas.</p></div>
  </section>;
}
