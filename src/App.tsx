import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { ArrowDownToLine, ArrowRight, BookOpen, Check, CheckCheck, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CircleHelp, GraduationCap, Layers3, Eye, Lightbulb, Search, ShieldCheck, TrendingUp, X, Rotate3d, Upload } from 'lucide-react';
import Board from './Board';
import PuzzleTrainer from './PuzzleTrainer';
import type { Opening, PuzzleState } from './puzzles';
import { catalogue } from './data/catalogue';
import { studyPuzzles, batches } from './data/study-puzzles';
import { ensureDailyBatch, finishOpening, migrateLegacyProgress, reviewId } from './study';
import { cards, decks, type DeckId } from './data/repertoire';
import { STORAGE_KEY, emptyProgress, intervalFor, intervalLabel, parseProgress, rateCard, type Progress, type Rating } from './progress';
import licenseText from '../public/data/LICHESS-CC0.txt?raw';
import thirdPartyLicenses from '../public/data/THIRD_PARTY_LICENSES.txt?raw';

type Page = 'train' | 'batches' | 'library' | 'progress';
const ratings: { id: Rating; label: string }[] = [{ id: 'again', label: 'Otra vez' }, { id: 'hard', label: 'Difícil' }, { id: 'good', label: 'Bien' }, { id: 'easy', label: 'Fácil' }];
function position(moves: string[]) { const game = new Chess(); moves.forEach(move => game.move(move)); return game; }
function loadProgress() {
  let progress = emptyProgress();
  try { progress = parseProgress(localStorage.getItem(STORAGE_KEY)); } catch {}
  return ensureDailyBatch(migrateLegacyProgress(progress), studyPuzzles, Date.now());
}
function download(name: string, text: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress);
  const [page, setPage] = useState<Page>('train');
  const [batchIndex, setBatchIndex] = useState<number | null>(null);
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
  const learned = studyPuzzles.filter(p => progress.reviews[reviewId(p.id)]?.mastered).length;
  const studyDue = studyPuzzles.filter(p => progress.reviews[reviewId(p.id)]?.due <= now);
  const reviewItems = [
    ...studyPuzzles.map(p => ({ id: reviewId(p.id), title: p.title, kind: 'Variante' })),
    ...cards.filter(c => !progress.reviews[reviewId(c.deck)]).map(c => ({ id: c.id, title: c.title, kind: 'Posición' })),
  ].filter(item => progress.reviews[item.id]).sort((a, b) => progress.reviews[a.id].due - progress.reviews[b.id].due);
  const due = cards.filter(c => progress.reviews[c.id] && progress.reviews[c.id].due <= now);
  const filtered = useMemo(() => openings.filter(o => `${o.name} ${o.eco} ${o.pgn}`.toLowerCase().includes(search.toLowerCase())), [openings, search]);
  const openingMoves = useMemo(() => { if (!opening) return []; const g = new Chess(); g.loadPgn(opening.pgn); return g.history(); }, [opening]);
  const libraryGame = useMemo(() => position(openingMoves.slice(0, ply)), [openingMoves, ply]);
  const isPuzzle = page === 'train' && trainingStyle === 'puzzle';
  function savePuzzle(state: PuzzleState) {
    const time = Date.now();
    setProgress(previous => finishOpening(previous, state, time));
    setNow(time);
  }

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); setStorageError(''); }
    catch { setStorageError('No se pudo guardar en este navegador. Exportá tu progreso antes de salir.'); }
  }, [progress]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  useEffect(() => { setProgress(previous => ensureDailyBatch(previous, studyPuzzles, now)); }, [now]);
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
  function rate(rating: Rating) {
    if (!card || !solved) return;
    const time = Date.now();
    const next = rateCard(progress, card.id, rating, !assisted && !mistake && rating !== 'again', time);
    setProgress(next); setNow(time); resetCard(queue(deckId, mode, next, time)[0]?.id ?? null);
  }
  function restore(file: File) {
    file.text().then(raw => {
      const parsed = parseProgress(raw);
      const original = JSON.parse(raw);
      if (JSON.stringify(parsed) !== JSON.stringify(original)) throw new Error();
      if (!window.confirm('¿Reemplazar el progreso de este navegador por el archivo seleccionado?')) return;
      setProgress(ensureDailyBatch(migrateLegacyProgress(parsed), studyPuzzles, Date.now())); resetCard(queue(deckId, mode, parsed)[0]?.id ?? null); setMessage('Progreso importado.');
    }).catch(() => setMessage('El archivo no es una copia de progreso válida de jane.'));
  }

  return <div className={`app-shell ${isPuzzle || page === 'batches' ? 'puzzle-active' : ''}`}>
    <aside className="sidebar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setBatchIndex(null); setPage('train'); }} aria-label="jane, inicio"><span className="brand-icon">♞</span> jane</a>
      <nav aria-label="Navegación principal">
        <button className={page === 'train' ? 'nav-item active' : 'nav-item'} onClick={() => { setBatchIndex(null); setPage('train'); }}><GraduationCap size={19}/> Entrenar <span className="nav-dot"/></button>
        <button className={page === 'batches' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('batches')}><Layers3 size={18}/> Lotes</button>
        <button className={page === 'library' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('library')}><BookOpen size={18}/> Biblioteca <span className="nav-count">{openings.length || '…'}</span></button>
        <button className={page === 'progress' ? 'nav-item active' : 'nav-item'} onClick={() => setPage('progress')}><TrendingUp size={18}/> Mi progreso</button>
      </nav>
      <div className="side-bottom"><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17}/> Ayuda</button></div>
    </aside>

    <main>
      <header className="topbar"><div className="breadcrumb">{page === 'train' ? 'Italiana' : page === 'batches' ? 'Lotes' : page === 'library' ? 'Biblioteca' : 'Progreso'}</div><div className="topbar-right">{page === 'train' && <div className="training-style-switch" aria-label="Formato de entrenamiento"><button className={trainingStyle === 'puzzle' ? 'active' : ''} onClick={() => setTrainingStyle('puzzle')}>Puzzles</button><button className={trainingStyle === 'cards' ? 'active' : ''} onClick={() => setTrainingStyle('cards')}>Tarjetas</button></div>}</div></header>
      <div className="main-content">
        {storageError && <div className="notice error" role="alert">{storageError}</div>}
        {page === 'train' && trainingStyle === 'cards' && <div className="page-heading"><h1>Posiciones</h1></div>}
        {page === 'batches' && <section className="batch-library"><h1>Lotes</h1><div className="batch-grid">{batches.map((batch, i) => {
          const known = batch.filter(p => progress.reviews[reviewId(p.id)]?.mastered).length;
          const today = batch[0]?.id === progress.daily?.ids[0];
          return <button key={i} className="batch-card" onClick={() => { setBatchIndex(i); setTrainingStyle('puzzle'); setPage('train'); }}>
            <div><strong>Lote {i + 1}</strong>{today && <span className="batch-today">Hoy</span>}</div>
            <span>{known}/{batch.length} variantes</span><div className="batch-meter"><span style={{ width: `${known / batch.length * 100}%` }}/></div>
          </button>;
        })}</div></section>}
        {isPuzzle && <PuzzleTrainer key={batchIndex ?? 'today'} progress={progress} batchIndex={batchIndex} onComplete={savePuzzle} onBatches={() => setPage('batches')}/>}
        {page === 'train' && trainingStyle === 'cards' && <>
          <div className="section-top"><div className="section-heading"><span className="section-dot"/><h2>Tu sesión de hoy</h2></div><div className="segmented" aria-label="Tipo de entrenamiento"><button className={mode === 'learn' ? 'selected' : ''} onClick={() => selectMode('learn')}>Aprender <span>{cards.filter(c => !progress.reviews[c.id]).length}</span></button><button className={mode === 'review' ? 'selected' : ''} onClick={() => selectMode('review')}>Repasar <span>{due.length}</span></button></div></div>
          <section className="training-layout">
            <div className="board-card"><div className="board-card-header"><div><span className="player-dot black"/><strong>Las negras</strong></div><span className="eco-badge">{deck.eco}</span></div>
              <Board game={game} onMove={move} disabled={!card || solved} flipped={flipped} hint={hint && !solved ? expected?.from : undefined} hintTo={hint && !solved ? expected?.to : undefined}/>
              <div className="board-card-footer"><div><span className="player-dot white"/><strong>Vos</strong><span className="muted-label">Blancas</span></div><div className="board-tools"><span>{card ? solved ? 'Posición completada' : 'Tu turno' : 'Sesión completa'}<span className="green-dot"/></span><button onClick={() => setFlipped(!flipped)} aria-label="Girar tablero" title="Girar tablero"><Rotate3d size={17}/></button></div></div>
            </div>
            <div className="lesson-card">
              <div className="lesson-meta"><span className="pill">{mode === 'learn' ? 'APRENDER UNA POSICIÓN' : 'REPETICIÓN ESPACIADA'}</span><span className="lesson-number">{cards.filter(c => c.deck === deckId && progress.reviews[c.id]).length} / 5</span></div>
              {card ? <><div className="lesson-title"><span className="tiny-label">{deck.name}</span><h2>{card.title}</h2><p>{card.goal}</p></div>
                <div className="move-line" aria-label="Jugadas de la posición">{card.before.map((m, i) => <span key={i}>{i % 2 === 0 && <small>{Math.floor(i / 2) + 1}.</small>}{m}</span>)}<span className="next-move">{Math.floor(card.before.length / 2) + 1}. {solved ? card.answer : '?'}</span>{solved && <span>{card.reply}</span>}</div>
                {!solved ? <><div className="your-move"><div className="move-icon">♗</div><div><strong>¿Cuál es tu jugada?</strong><p>Seleccioná una pieza y su destino.<br/>También podés arrastrarla.</p></div></div>
                  <div className="feedback-space" aria-live="polite">{message && <div className="notice">{message}</div>}{hint && <div className="hint-box"><Lightbulb size={17}/><p>{card.answer}: {expected?.from} → {expected?.to}</p></div>}</div>
                  <div className="lesson-actions"><button className="secondary-button" onClick={() => { setHint(true); setAssisted(true); }} disabled={hint}><Eye size={16}/>Ver solución</button></div>
                </> : <><div className={`success-heading ${assisted || mistake ? 'assisted' : ''}`} role="status"><span><Check size={18}/></span><div><strong>{assisted ? 'Correcto con ayuda' : mistake ? 'Correcto tras un reintento' : 'Correcto'}</strong><p>{card.answer} · Las negras responden {card.reply}</p></div></div><div className="idea-box"><div><Lightbulb size={16}/><strong>La idea detrás de la jugada</strong></div><p>{card.idea}</p></div><div className="rating-section"><strong>¿Cuánto te costó recordarla?</strong><p>Tu respuesta decide cuándo vuelve esta posición.</p><div className="rating-buttons">{ratings.map(r => <button key={r.id} className={`rating ${r.id}`} onClick={() => rate(r.id)}><strong>{r.label}</strong><span>{intervalLabel(intervalFor(progress.reviews[card.id], r.id))}</span></button>)}</div></div></>}
              </> : <div className="empty-session"><span className="complete-icon"><CheckCheck size={34}/></span><h2>{mode === 'learn' ? 'Posiciones completadas' : 'Sin posiciones pendientes'}</h2><p>{mode === 'learn' ? 'Ya conocés las cinco posiciones de esta variante. Elegí otra para seguir aprendiendo.' : 'No hay posiciones pendientes en esta variante. Las que marques «Otra vez» vuelven en cinco minutos.'}</p><button className="primary-button" onClick={() => { const next = decks.find(d => queue(d.id, mode).length); if (next) selectDeck(next.id); else setPage('library'); }}>{decks.some(d => queue(d.id, mode).length) ? 'Continuar con otra variante' : 'Explorar la biblioteca'}<ArrowRight size={16}/></button>{mode === 'review' && queue(deckId, 'review').length > 0 && <button className="text-button" onClick={() => resetCard(queue(deckId, 'review')[0].id)}>Empezar repaso</button>}</div>}
            </div>
          </section>
          <div className="repertoire-section"><div className="section-top"><div className="section-heading"><BookOpen size={17}/><h2>Las ramas de tu italiana</h2></div><span className="muted-label">3 variantes · 15 posiciones guiadas</span></div><div className="deck-grid">{decks.map((d, i) => {
            const known = cards.filter(c => c.deck === d.id && progress.reviews[c.id]).length;
            return <button key={d.id} className={`deck-card ${deckId === d.id ? 'active' : ''}`} onClick={() => selectDeck(d.id)}><div className="deck-top"><span className={`deck-symbol symbol-${i}`}>{['♗', '♙', '♞'][i]}</span><span className="deck-eco">{d.eco}</span>{deckId === d.id && <span className="active-deck"><Check size={11}/> EN PRÁCTICA</span>}</div><h3>{d.name}</h3><div className="deck-progress"><div><span style={{ width: `${known * 20}%` }}/></div><span>{known}/5</span><ArrowRight size={16}/></div></button>;
          })}</div></div>
        </>}

        {page === 'library' && <><div className="library-intro"><h1>{openings.length} variantes</h1></div><section className="library-layout"><div className="opening-list-panel"><label className="search-field"><Search size={18}/><input placeholder="Buscar variante, ECO o jugadas…" aria-label="Buscar aperturas" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="list-count">{filtered.length} variantes encontradas</div><div className="opening-list">{filtered.map((o, i) => <button key={`${o.name}-${i}`} className={opening === o ? 'active' : ''} onClick={() => { setOpening(o); const g = new Chess(); g.loadPgn(o.pgn); setPly(g.history().length); }}><span className="eco-badge">{o.eco}</span><div><strong>{o.name.replace('Italian Game: ', '').replace('Italian Game', 'Apertura italiana')}</strong><small>{o.pgn}</small></div><ChevronRight size={14}/></button>)}{filtered.length === 0 && <p className="no-results">No hay coincidencias. Probá con «Piano» o «C55».</p>}</div></div><div className="library-board"><div className="board-card-header"><strong>{opening?.name.replace('Italian Game: ', '') || 'Cargando catálogo…'}</strong><button className="icon-button" onClick={() => setFlipped(!flipped)} aria-label="Girar tablero de biblioteca"><Rotate3d size={17}/></button></div><Board game={libraryGame} flipped={flipped}/><div className="playback"><button onClick={() => setPly(0)} disabled={ply === 0} aria-label="Posición inicial"><ChevronsLeft size={20}/></button><button onClick={() => setPly(Math.max(0, ply - 1))} disabled={ply === 0} aria-label="Jugada anterior"><ChevronLeft size={20}/></button><span>{ply} / {openingMoves.length}</span><button onClick={() => setPly(Math.min(openingMoves.length, ply + 1))} disabled={ply === openingMoves.length} aria-label="Jugada siguiente"><ChevronRight size={20}/></button><button onClick={() => setPly(openingMoves.length)} disabled={ply === openingMoves.length} aria-label="Última posición"><ChevronsRight size={20}/></button></div><div className="library-moves">{openingMoves.map((m, i) => <button key={i} className={ply === i + 1 ? 'active' : ''} onClick={() => setPly(i + 1)}>{i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ` : ''}{m}</button>)}</div><button className="text-button pgn-download" disabled={!opening} onClick={() => opening && download('italiana.pgn', `[Event "${opening.name}"]\n[Source "lichess-org/chess-openings"]\n\n${opening.pgn} *\n`, 'application/x-chess-pgn')}><ArrowDownToLine size={15}/> Descargar esta línea en PGN</button></div></section></>}

        {page === 'progress' && <>
          <div className="page-heading"><h1>Progreso</h1></div>
          <section className="study-summary"><span><strong>{learned}</strong> variantes aprendidas</span><span><strong>{studyDue.length}</strong> pendientes</span></section>
          <div className="progress-panel"><h2>Próximos repasos</h2><div className="upcoming-list">{reviewItems.map(item => <div key={item.id}><span><strong>{item.title}</strong><small>{item.kind}</small></span><span className="due-label">{progress.reviews[item.id].due <= now ? 'Ahora' : new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(progress.reviews[item.id].due)}</span></div>)}{reviewItems.length === 0 && <p>Sin repasos programados.</p>}</div></div>
          <div className="backup-panel"><p>Progreso guardado en este navegador.</p><div><button className="secondary-button" onClick={() => download('jane-progreso.json', JSON.stringify(progress, null, 2))}><ArrowDownToLine size={16}/> Exportar</button><button className="secondary-button" onClick={() => importRef.current?.click()}><Upload size={16}/> Importar</button><input type="file" accept="application/json,.json" ref={importRef} hidden onChange={e => { if (e.target.files?.[0]) restore(e.target.files[0]); e.target.value = ''; }}/></div></div>
          {message && <div className="notice" role="status">{message}</div>}
        </>}

      </div>
    </main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section ref={modalRef} className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button autoFocus className="modal-close icon-button" onClick={() => setHelp(false)} aria-label="Cerrar ayuda"><X size={20}/></button><span className="brand-icon">♞</span><h2 id="help-title">Ayuda</h2><p>En <strong>Lotes</strong> elegís un grupo de 10 variantes. El acceso <strong>Entrenar</strong> abre el lote de hoy. Una variante se marca como aprendida al completarla sin ayuda. <strong>Ver solución</strong> muestra solo la próxima jugada; después la hacés vos. Los repasos pendientes van por separado. En <strong>Tarjetas → Aprender</strong> descubrís 15 posiciones con un objetivo concreto. Jugá, leé la idea y elegí cuánto te costó. En <strong>Repasar</strong> vuelven cuando les toca: desde 5 minutos hasta varios días.</p><h3>¿De dónde salen las aperturas?</h3><p>La biblioteca incluye 187 entradas de italiana de <a href="https://github.com/lichess-org/chess-openings" target="_blank" rel="noreferrer">lichess-org/chess-openings</a>, bajo <a href={"data:text/plain;charset=utf-8," + encodeURIComponent(licenseText)} download="LICHESS-CC0.txt">CC0</a>. La copia local está fijada a la revisión <code>a6189a3</code>.</p><p>Las posiciones guiadas y sus explicaciones son una selección editorial de esta app. Sus jugadas se validan con chess.js; no son evaluaciones de un motor ni un curso oficial de Lichess. Una jugada legal fuera de la línea no se califica como un error ajedrecístico.</p><p><a href={"data:text/plain;charset=utf-8," + encodeURIComponent(thirdPartyLicenses)} download="JANE-LICENCIAS.txt">Licencias de los componentes</a></p><div className="help-local"><ShieldCheck size={19}/><p>Sin cuenta ni servicios externos. El progreso se guarda en este navegador; podés exportarlo desde «Mi progreso».</p></div><button className="primary-button" onClick={() => setHelp(false)}>Cerrar <ArrowRight size={16}/></button></section></div>}
  </div>;
}
