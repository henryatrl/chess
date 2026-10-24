import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCheck, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleHelp, Clock3, ExternalLink, Flame, GraduationCap, Layers3, Lightbulb, Search, ShieldCheck, Sparkles, Target, TrendingUp, X, Rotate3d, Upload } from 'lucide-react';
import Board from './Board';
import PuzzleTrainer from './PuzzleTrainer';
import type { PuzzleState } from './puzzles';
import { cards, decks, type DeckId } from './data/repertoire';
import { STORAGE_KEY, dayKey, emptyProgress, intervalFor, intervalLabel, parseProgress, rateCard, streak, type Progress, type Rating } from './progress';
import openingsTsv from '../public/data/lichess-c.tsv?raw';
import licenseText from '../public/data/LICHESS-CC0.txt?raw';
import thirdPartyLicenses from '../public/data/THIRD_PARTY_LICENSES.txt?raw';

type Page = 'train' | 'library' | 'progress';
type Opening = { eco: string; name: string; pgn: string };
const catalogue: Opening[] = openingsTsv.trim().split(/\r?\n/).slice(1).map(row => {
  const [eco, name, pgn] = row.split('\t');
  return { eco, name, pgn };
}).filter(o => o.name.startsWith('Italian Game'));
const ratings: { id: Rating; label: string }[] = [{ id: 'again', label: 'Otra vez' }, { id: 'hard', label: 'Difícil' }, { id: 'good', label: 'Bien' }, { id: 'easy', label: 'Fácil' }];
function position(moves: string[]) { const game = new Chess(); moves.forEach(move => game.move(move)); return game; }
function loadProgress() { try { return parseProgress(localStorage.getItem(STORAGE_KEY)); } catch { return emptyProgress(); } }
function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [page, setPage] = useState<Page>('train');
  const [trainingStyle, setTrainingStyle] = useState<'puzzle' | 'cards'>('puzzle');
  const [deckId, setDeckId] = useState<DeckId>('piano');
  const [mode, setMode] = useState<'learn' | 'review'>('learn');
  const [cardId, setCardId] = useState<string | null>(() => cards.find(c => c.deck === 'piano' && !loadProgress().reviews[c.id])?.id ?? null);
  const [solved, setSolved] = useState(false);
  const [assisted, setAssisted] = useState(false);
  const [mistake, setMistake] = useState(false);
  const [hint, setHint] = useState(false);
  const [message, setMessage] = useState('');
  const [flipped, setFlipped] = useState(false);
  const [help, setHelp] = useState(false);
  const [storageError, setStorageError] = useState('');
  const [now, setNow] = useState(Date.now);
  const openings = catalogue;
  const [search, setSearch] = useState('');
  const [opening, setOpening] = useState<Opening | null>(catalogue[0] ?? null);
  const [ply, setPly] = useState(5);
  const importRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLElement>(null);
  const deck = decks.find(d => d.id === deckId)!;
  const card = cards.find(c => c.id === cardId);
  const game = useMemo(() => card ? position([...card.before, ...(solved ? [card.answer, card.reply] : [])]) : new Chess(), [card, solved]);
  const expected = useMemo(() => card ? position(card.before).move(card.answer) : undefined, [card]);
  const learned = cards.filter(c => progress.reviews[c.id]).length;
  const due = cards.filter(c => progress.reviews[c.id] && progress.reviews[c.id].due <= now);
  const todayEvents = progress.events.filter(e => dayKey(e.time) === dayKey(now));
  const accuracy = progress.events.length ? Math.round(progress.events.filter(e => e.recalled).length / progress.events.length * 100) : null;
  const filtered = useMemo(() => openings.filter(o => `${o.name} ${o.eco} ${o.pgn}`.toLowerCase().includes(search.toLowerCase())), [openings, search]);
  const openingMoves = useMemo(() => { if (!opening) return []; const g = new Chess(); g.loadPgn(opening.pgn); return g.history(); }, [opening]);
  const libraryGame = useMemo(() => position(openingMoves.slice(0, ply)), [openingMoves, ply]);
  const isPuzzle = page === 'train' && trainingStyle === 'puzzle';
  function savePuzzle(state: PuzzleState) {
    const time = Date.now();
    setProgress(previous => state.puzzle.steps.reduce((next, step, i) => {
      if (!step.cardId) return next;
      const recalled = state.phase === 'solved' && !state.failed.includes(i) && !state.assisted.includes(i);
      return rateCard(next, step.cardId, state.phase === 'solution' ? 'again' : recalled ? 'good' : 'hard', recalled, time);
    }, previous));
    setNow(time);
  }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); setStorageError(''); }
    catch { setStorageError('No se pudo guardar en este navegador. Exportá tu progreso antes de salir.'); }
  }, [progress]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    function close(e: KeyboardEvent) {
      if (e.key === 'Escape') setHelp(false);
      if (e.key === 'Tab') {
        const nodes = modalRef.current?.querySelectorAll<HTMLElement>('button, a[href]');
        if (!nodes?.length) return;
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', close);
    return () => { window.removeEventListener('keydown', close); document.body.style.overflow = overflow; previous?.focus(); };
  }, [help]);

  function resetCard(id: string | null) { setCardId(id); setSolved(false); setAssisted(false); setMistake(false); setHint(false); setMessage(''); }
  function queue(id: DeckId, m: 'learn' | 'review', p = progress, time = Date.now()) {
    return cards.filter(c => c.deck === id && (m === 'review' ? p.reviews[c.id] && p.reviews[c.id].due <= time : !p.reviews[c.id])).sort((a, b) => (p.reviews[a.id]?.due ?? 0) - (p.reviews[b.id]?.due ?? 0));
  }
  function selectDeck(id: DeckId) { setDeckId(id); resetCard(queue(id, mode)[0]?.id ?? null); setPage('train'); }
  function selectMode(m: 'learn' | 'review') { setMode(m); resetCard(queue(deckId, m)[0]?.id ?? null); }
  function move(from: Square, to: Square) {
    if (!card || solved) return;
    try {
      const trial = position(card.before).move({ from, to, promotion: 'q' });
      if (trial.san === card.answer) { setSolved(true); setMessage(''); }
      else { setMistake(true); setMessage(`${trial.san} es legal, pero no es la jugada de esta línea. La posición se reinició: probá otra vez.`); }
    } catch { setMistake(true); setMessage('Esa jugada no es legal en esta posición. Elegí uno de los destinos marcados.'); }
  }
  function showAnswer() { setAssisted(true); setSolved(true); setMessage(''); }
  function rate(rating: Rating) {
    if (!card || !solved) return;
    const time = Date.now();
    const next = rateCard(progress, card.id, rating, !assisted && !mistake && rating !== 'again', time);
    setProgress(next); setNow(time); resetCard(queue(deckId, mode, next, time)[0]?.id ?? null);
  }
  function startReview() {
    setTrainingStyle('cards');
    const first = due[0]; setMode('review'); setPage('train');
    if (first) { setDeckId(first.deck); resetCard(first.id); } else resetCard(null);
  }
  function restore(file: File) {
    file.text().then(raw => {
      const parsed = parseProgress(raw);
      const original = JSON.parse(raw);
      if (JSON.stringify(parsed) !== JSON.stringify(original)) throw new Error();
      if (!window.confirm('¿Reemplazar el progreso de este navegador por el archivo seleccionado?')) return;
      setProgress(parsed); resetCard(queue(deckId, mode, parsed)[0]?.id ?? null); setMessage('Progreso importado.');
    }).catch(() => setMessage('El archivo no es una copia de progreso válida de Cavallo.'));
  }

  return <div className={`app-shell ${isPuzzle ? 'puzzle-active' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setPage('train'); }} aria-label="Cavallo, inicio"><span className="brand-icon">♞</span> cavallo<span className="brand-period">.</span></a>
      <span className="side-label">TU ESPACIO DE AJEDREZ</span>
      <nav aria-label="Navegación principal">
        <button className={page === 'train' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('train')}><GraduationCap size={19}/> Entrenar <span className="nav-dot"/></button>
        <button className={page === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('library')}><BookOpen size={18}/> Biblioteca <span className="nav-count">{openings.length || '…'}</span></button>
        <button className={page === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('progress')}><TrendingUp size={18}/> Mi progreso</button>
      </nav>
      <div className="sidebar-repertoire"><span className="side-label">MI REPERTORIO</span><div className="repertoire-name"><span>♗</span><div>La italiana<small>Jugás con blancas</small></div><span className="green-dot"/></div><div className="mini-progress"><span style={{ width: `${learned / cards.length * 100}%` }}/></div><p>{learned} de {cards.length} posiciones aprendidas</p></div>
      <div className="side-bottom"><div className="daily-note"><Sparkles size={18}/><strong>Una buena jugada al día.</strong><p>Las ideas se entienden.<br/>Los patrones se recuerdan.</p></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> Cómo funciona <ArrowRight size={15}/></button><div className="local-badge"><ShieldCheck size={14}/> Tu progreso vive en este navegador</div></div>
    </aside>

    <main>
      <header className="topbar"><div className="breadcrumb">Mi repertorio <ChevronRight size={13}/><span>{page === 'train' ? 'Entrenamiento' : page === 'library' ? 'Biblioteca' : 'Mi progreso'}</span></div><div className="topbar-right">{page === 'train' && <div className="training-style-switch" aria-label="Formato de entrenamiento"><button className={trainingStyle === 'puzzle' ? 'active' : ''} onClick={() => setTrainingStyle('puzzle')}>Puzzles</button><button className={trainingStyle === 'cards' ? 'active' : ''} onClick={() => setTrainingStyle('cards')}>Tarjetas</button></div>}<span className="local-pill"><span/> Modo local</span><button className="avatar" onClick={() => setPage('progress')} aria-label="Ver mi progreso">♙</button></div></header>
      <div className="main-content">
        {storageError && <div className="notice error" role="alert">{storageError}</div>}
        {!isPuzzle && <><div className="page-heading"><div><div className="eyebrow"><span/> APRENDÉ. RECORDÁ. JUGÁ.</div><h1>{page === 'train' ? <>La italiana, <em>jugada a jugada.</em></> : page === 'library' ? <>Un repertorio <em>por descubrir.</em></> : <>Cada repaso <em>deja huella.</em></>}</h1><p>{page === 'train' ? 'Entendé las ideas. Reconocé los patrones. Hacelos parte de tu juego.' : page === 'library' ? 'Explorá las líneas de la italiana y recorré sus posiciones en el tablero.' : 'Tu constancia convierte posiciones nuevas en patrones familiares.'}</p></div><span className="opening-tag"><span>♔</span> REPERTORIO CON BLANCAS</span></div>

        <section className="stats-row" aria-label="Estadísticas">
          <button className="stat-card" onClick={startReview}><span className="stat-icon coral"><Layers3 size={20}/></span><div><span className="stat-label">Para repasar</span><div className="stat-value">{due.length}<small>{due.length ? 'posiciones pendientes' : 'todo al día'}</small></div></div><ArrowRight className="stat-arrow" size={17}/></button>
          <div className="stat-card"><span className="stat-icon amber"><Flame size={20}/></span><div><span className="stat-label">Tu constancia</span><div className="stat-value">{streak(progress.events, now)}<small>{streak(progress.events, now) === 1 ? 'día de racha' : 'días de racha'}</small></div></div></div>
          <div className="stat-card"><span className="stat-icon green"><Target size={20}/></span><div><span className="stat-label">Sin ayuda</span><div className="stat-value">{accuracy === null ? '—' : `${accuracy}%`}<small>{progress.events.length ? `${progress.events.length} repasos registrados` : 'tu primer paso cuenta'}</small></div></div></div>
        </section>

        </>}
        {isPuzzle && <PuzzleTrainer progress={progress} onComplete={savePuzzle} onLibrary={() => setPage('library')}/>}
        {page === 'train' && trainingStyle === 'cards' && <>
          <div className="section-top"><div className="section-heading"><span className="section-dot"/><h2>Tu sesión de hoy</h2><span className="muted-label">A tu ritmo, sin reloj.</span></div><div className="segmented" aria-label="Tipo de entrenamiento"><button className={mode === 'learn' ? 'selected' : ''} onClick={() => selectMode('learn')}>Aprender <span>{cards.filter(c => !progress.reviews[c.id]).length}</span></button><button className={mode === 'review' ? 'selected' : ''} onClick={() => selectMode('review')}>Repasar <span>{due.length}</span></button></div></div>
          <section className="training-layout">
            <div className="board-card"><div className="board-card-header"><div><span className="player-dot black"/><strong>Las negras</strong><span className="muted-label">Tu compañero de práctica</span></div><span className="eco-badge">{deck.eco}</span></div>
              <Board game={game} onMove={move} disabled={!card || solved} flipped={flipped} hint={hint && !solved ? expected?.from : undefined}/>
              <div className="board-card-footer"><div><span className="player-dot white"/><strong>Vos</strong><span className="muted-label">Blancas</span></div><div className="board-tools"><span>{card ? solved ? 'Posición completada' : 'Tu turno' : 'Sesión completa'}<span className="green-dot"/></span><button onClick={() => setFlipped(!flipped)} aria-label="Girar tablero" title="Girar tablero"><Rotate3d size={17}/></button></div></div>
            </div>
            <div className="lesson-card">
              <div className="lesson-meta"><span className="pill">{mode === 'learn' ? 'APRENDER UNA POSICIÓN' : 'REPETICIÓN ESPACIADA'}</span><span className="lesson-number">{cards.filter(c => c.deck === deckId && progress.reviews[c.id]).length} / 5</span></div>
              {card ? <><div className="lesson-title"><span className="tiny-label">{deck.name}</span><h2>{card.title}</h2><p>{card.goal}</p></div>
                <div className="move-line" aria-label="Jugadas de la posición">{card.before.map((m, i) => <span key={i}>{i % 2 === 0 && <small>{Math.floor(i / 2) + 1}.</small>}{m}</span>)}<span className="next-move">{Math.floor(card.before.length / 2) + 1}. {solved ? card.answer : '?'}</span>{solved && <span>{card.reply}</span>}</div>
                {!solved ? <><div className="your-move"><div className="move-icon">♗</div><div><strong>¿Cuál es tu jugada?</strong><p>Seleccioná una pieza y su destino.<br/>También podés arrastrarla.</p></div></div>
                  <div className="feedback-space" aria-live="polite">{message && <div className="notice">{message}</div>}{hint && <div className="hint-box"><Lightbulb size={17}/><p>{card.hint}</p></div>}</div>
                  <div className="lesson-actions"><button className="secondary-button" onClick={() => { setHint(true); setAssisted(true); }} disabled={hint}><Lightbulb size={16}/>{hint ? 'Pista activada' : 'Una pista'}</button><button className="text-button" onClick={showAnswer}>Ver respuesta <ArrowRight size={15}/></button></div>
                  <div className="lesson-footnote"><ShieldCheck size={14}/> Equivocarte también es parte de aprender.</div>
                </> : <><div className={`success-heading ${assisted || mistake ? 'assisted' : ''}`} role="status"><span><Check size={18}/></span><div><strong>{assisted ? 'Ahora conocés la idea.' : mistake ? 'La encontraste. Seguí practicando.' : '¡Esa es la jugada!'}</strong><p>{card.answer} · Las negras responden {card.reply}</p></div></div><div className="idea-box"><div><Lightbulb size={16}/><strong>La idea detrás de la jugada</strong></div><p>{card.idea}</p></div><div className="rating-section"><strong>¿Cuánto te costó recordarla?</strong><p>Tu respuesta decide cuándo vuelve esta posición.</p><div className="rating-buttons">{ratings.map(r => <button key={r.id} className={`rating ${r.id}`} onClick={() => rate(r.id)}><strong>{r.label}</strong><span>{intervalLabel(intervalFor(progress.reviews[card.id], r.id))}</span></button>)}</div></div></>}
              </> : <div className="empty-session"><span className="complete-icon"><CheckCheck size={34}/></span><h2>{mode === 'learn' ? 'Un paso más en tu repertorio.' : 'Todo al día por aquí.'}</h2><p>{mode === 'learn' ? 'Ya conocés las cinco posiciones de esta variante. Elegí otra para seguir aprendiendo.' : 'No hay posiciones pendientes en esta variante. Las que marques «Otra vez» vuelven en cinco minutos.'}</p><button className="primary-button" onClick={() => { const next = decks.find(d => queue(d.id, mode).length); if (next) selectDeck(next.id); else setPage('library'); }}>{decks.some(d => queue(d.id, mode).length) ? 'Continuar con otra variante' : 'Explorar la biblioteca'}<ArrowRight size={16}/></button>{mode === 'review' && queue(deckId, 'review').length > 0 && <button className="text-button" onClick={() => resetCard(queue(deckId, 'review')[0].id)}>Empezar repaso</button>}</div>}
            </div>
          </section>
          <div className="repertoire-section"><div className="section-top"><div className="section-heading"><BookOpen size={17}/><h2>Las ramas de tu italiana</h2></div><span className="muted-label">3 variantes · 15 posiciones guiadas</span></div><div className="deck-grid">{decks.map((d, i) => {
            const known = cards.filter(c => c.deck === d.id && progress.reviews[c.id]).length;
            return <button key={d.id} className={`deck-card ${deckId === d.id ? 'active' : ''}`} onClick={() => selectDeck(d.id)}><div className="deck-top"><span className={`deck-symbol symbol-${i}`}>{['♗', '♙', '♞'][i]}</span><span className="deck-eco">{d.eco}</span>{deckId === d.id && <span className="active-deck"><Check size={11}/> EN PRÁCTICA</span>}</div><h3>{d.name}</h3><p>{d.subtitle}</p><div className="deck-progress"><div><span style={{ width: `${known * 20}%` }}/></div><span>{known}/5</span><ArrowRight size={16}/></div></button>;
          })}</div></div>
        </>}

        {page === 'library' && <><div className="library-intro"><div><span className="pill">DATOS ABIERTOS · CC0</span><h2>{openings.length || '…'} caminos para conocer la italiana.</h2><p>Este catálogo nombra aperturas y muestra sus jugadas. Las 15 posiciones de entrenamiento son una selección guiada aparte.</p></div><button className="secondary-button" onClick={() => setHelp(true)}>Sobre la base de datos <ExternalLink size={15}/></button></div><section className="library-layout"><div className="opening-list-panel"><label className="search-field"><Search size={18}/><input placeholder="Buscar variante, ECO o jugadas…" aria-label="Buscar aperturas" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="list-count">{filtered.length} variantes encontradas</div><div className="opening-list">{filtered.map((o, i) => <button key={`${o.name}-${i}`} className={opening === o ? 'active' : ''} onClick={() => { setOpening(o); const g = new Chess(); g.loadPgn(o.pgn); setPly(g.history().length); }}><span className="eco-badge">{o.eco}</span><div><strong>{o.name.replace('Italian Game: ', '').replace('Italian Game', 'Apertura italiana')}</strong><small>{o.pgn}</small></div><ChevronRight size={14}/></button>)}{filtered.length === 0 && <p className="no-results">No hay coincidencias. Probá con «Piano» o «C55».</p>}</div></div><div className="library-board"><div className="board-card-header"><strong>{opening?.name.replace('Italian Game: ', '') || 'Cargando catálogo…'}</strong><button className="icon-button" onClick={() => setFlipped(!flipped)} aria-label="Girar tablero de biblioteca"><Rotate3d size={17}/></button></div><Board game={libraryGame} flipped={flipped}/><div className="playback"><button onClick={() => setPly(0)} disabled={ply === 0} aria-label="Posición inicial"><ChevronsLeft size={20}/></button><button onClick={() => setPly(Math.max(0, ply - 1))} disabled={ply === 0} aria-label="Jugada anterior"><ChevronLeft size={20}/></button><span>{ply} / {openingMoves.length}</span><button onClick={() => setPly(Math.min(openingMoves.length, ply + 1))} disabled={ply === openingMoves.length} aria-label="Jugada siguiente"><ChevronRight size={20}/></button><button onClick={() => setPly(openingMoves.length)} disabled={ply === openingMoves.length} aria-label="Última posición"><ChevronsRight size={20}/></button></div><div className="library-moves">{openingMoves.map((m, i) => <button key={i} className={ply === i + 1 ? 'active' : ''} onClick={() => setPly(i + 1)}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{m}</button>)}</div><button className="text-button pgn-download" disabled={!opening} onClick={() => opening && download('italiana.pgn', `[Event "${opening.name}"]\n[Source "lichess-org/chess-openings"]\n\n${opening.pgn} *\n`, 'application/x-chess-pgn')}><ArrowDownToLine size={15}/> Descargar esta línea en PGN</button></div></section></>}

        {page === 'progress' && <><section className="progress-layout"><div className="progress-panel"><div className="section-heading"><TrendingUp size={19}/><h2>Tu repertorio crece con vos</h2></div><p className="panel-description">Una posición aprendida es una posición que ya practicaste y programaste para repasar.</p>{decks.map(d => { const known = cards.filter(c => c.deck === d.id && progress.reviews[c.id]).length; return <div className="progress-deck" key={d.id}><div><strong>{d.name}</strong><span>{known} de 5 posiciones</span></div><div className="mini-progress"><span style={{ width: `${known * 20}%` }}/></div></div>; })}<div className="progress-summary"><span><strong>{learned}</strong> aprendidas</span><span><strong>{todayEvents.length}</strong> repasos hoy</span><span><strong>{due.length}</strong> pendientes</span></div><button className="primary-button" onClick={startReview}>Ir a mis repasos <ArrowRight size={16}/></button></div><div className="progress-panel"><div className="section-heading"><Clock3 size={19}/><h2>Próximos repasos</h2></div><div className="upcoming-list">{cards.filter(c => progress.reviews[c.id]).sort((a, b) => progress.reviews[a.id].due - progress.reviews[b.id].due).map(c => <div key={c.id}><span><strong>{c.title}</strong><small>{decks.find(d => d.id === c.deck)?.name}</small></span><span className="due-label">{progress.reviews[c.id].due <= now ? 'Ahora' : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(progress.reviews[c.id].due)}</span></div>)}{learned === 0 && <div className="empty-progress"><Layers3 size={32}/><p>Todavía no hay repasos programados.<br/>Tu primera posición empieza la historia.</p><button className="text-button" onClick={() => setPage('train')}>Aprender una posición <ArrowRight size={15}/></button></div>}</div></div></section><div className="backup-panel"><div><h3>Tu progreso, siempre con vos.</h3><p>Se guarda en este navegador. Exportá una copia para conservarlo o llevarlo a otra computadora.</p></div><div><button className="secondary-button" onClick={() => download('cavallo-progreso.json', JSON.stringify(progress, null, 2))}><ArrowDownToLine size={16}/> Exportar</button><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload size={16}/> Importar</button><input type="file" accept="application/json,.json" ref={importRef} hidden onChange={e => { if (e.target.files?.[0]) restore(e.target.files[0]); e.target.value = ''; }}/></div></div>{message && <div className="notice" role="status">{message}</div>}</>}

        <footer><span><span className="footer-knight">♞</span> Menos memorizar por memorizar. Más entender el tablero.</span><button onClick={() => setHelp(true)}>Hecho para aprender <span>↗</span></button></footer>
      </div>
    </main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section ref={modalRef} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button autoFocus className="modal-close icon-button" onClick={() => setHelp(false)} aria-label="Cerrar ayuda"><X size={20}/></button><span className="brand-icon">♞</span><h2 id="help-title">Entender hoy.<br/>Recordar en tu próxima partida.</h2><p>En <strong>Puzzles</strong> completás una variante seguida, con respuestas automáticas del rival y un repaso programado al terminar. En <strong>Tarjetas → Aprender</strong> descubrís 15 posiciones con un objetivo concreto. Jugá, leé la idea y elegí cuánto te costó. En <strong>Repasar</strong> vuelven cuando les toca: desde 5 minutos hasta varios días.</p><h3>¿De dónde salen las aperturas?</h3><p>La biblioteca incluye 187 entradas de italiana de <a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noreferrer">lichess-org/chess-openings</a>, bajo <a href={"data:text/plain;charset=utf-8," + encodeURIComponent(licenseText)} download="LICHESS-CC0.txt">CC0</a>. La copia local está fijada a la revisión <code>a6189a3</code>.</p><p>Las posiciones guiadas y sus explicaciones son una selección editorial de esta app. Sus jugadas se validan con chess.js; no son evaluaciones de un motor ni un curso oficial de Lichess. Una jugada legal fuera de la línea no se califica como un error ajedrecístico.</p><p><a href={"data:text/plain;charset=utf-8," + encodeURIComponent(thirdPartyLicenses)} download="CAVALLO-LICENCIAS.txt">Licencias de los componentes</a></p><div className="help-local"><ShieldCheck size={19}/><p>Sin cuenta ni servicios externos. El progreso se guarda en este navegador; podés exportarlo desde «Mi progreso».</p></div><button className="primary-button" onClick={() => setHelp(false)}>Vamos al tablero <ArrowRight size={16}/></button></section></div>}
  </div>;
}
