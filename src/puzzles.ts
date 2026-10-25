import { Chess, type Square } from 'chess.js';
import { cards, decks, type DeckId } from './data/repertoire.ts';

export type PuzzleStep = { answer: string; reply?: string; idea: string; hint: string; cardId?: string };
export type Opening = { eco: string; name: string; pgn: string };
export type Puzzle = { id: string; title: string; eco: string; description: string; before: string[]; steps: PuzzleStep[] };
export const puzzles: Puzzle[] = decks.map(deck => {
  const line = cards.filter(card => card.deck === deck.id);
  const steps: PuzzleStep[] = line.map(card => ({ answer: card.answer, reply: card.reply, idea: card.idea, hint: card.hint, cardId: card.id }));
  // Resolve the final check in the open Piano instead of ending with our king in check.
  if (deck.id === 'piano') steps.push({ answer: 'Nbxd2', hint: 'El caballo de b1 puede recuperar el alfil que da jaque en d2.', idea: 'Nbxd2 recupera el alfil y resuelve el jaque desarrollando el caballo de dama.' });
  return { id: deck.id, title: deck.name, eco: deck.eco, description: deck.description, before: line[0].before, steps };
});
export function parseCatalogue(text: string): Opening[] {
  return text.trim().split(/\r?\n/).slice(1).map(row => {
    const [eco, name, pgn] = row.split('\t'); return { eco, name, pgn };
  }).filter(row => row.name.startsWith('Italian Game'));
}
function lineId(moves: string[]): string {
  let hash = 2166136261;
  for (const char of moves.join(' ')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return `catalogue-${(hash >>> 0).toString(16)}`;
}
export function buildStudyPuzzles(openings: Opening[]): Puzzle[] {
  const seen = new Set<string>();
  const additional: Puzzle[] = [];
  for (const opening of openings) {
    const game = new Chess(); game.loadPgn(opening.pgn);
    const moves = game.history();
    // Short names without a next white move are reference entries, not exercises.
    // Do not stop with the learner in check and no supplied response.
    if (moves.length < 7 || (game.turn() === 'w' && game.isCheck())) continue;
    const id = lineId(moves);
    if (seen.has(id)) continue;
    seen.add(id);
    const steps: PuzzleStep[] = [];
    for (let i = 6; i < moves.length; i += 2) steps.push({ answer: moves[i], reply: moves[i + 1], idea: '', hint: '' });
    additional.push({ id, title: opening.name.replace(/^Italian Game:?\s*/, ''), eco: opening.eco, description: '', before: moves.slice(0, 6), steps });
  }
  const first = [
    'Giuoco Pianissimo, Canal Variation', 'Evans Gambit', 'Evans Gambit Declined',
    'Two Knights Defense, Knight Attack', 'Scotch Gambit',
    'Hungarian Defense, Tartakower Variation', 'Two Knights Defense, Fried Liver Attack',
  ];
  additional.sort((a, b) => a.steps.length - b.steps.length || a.id.localeCompare(b.id));
  const featured = first.flatMap(title => { const p = additional.find(puzzle => puzzle.title === title); return p ? [p] : []; });
  const featuredIds = new Set(featured.map(p => p.id));
  return [...puzzles, ...featured, ...additional.filter(p => !featuredIds.has(p.id))];
}

export type PuzzleState = {
  puzzle: Puzzle; step: number; moves: string[]; phase: 'playing' | 'opponent' | 'solved';
  failed: number[]; assisted: number[]; hintLevel: number; errorSquare?: Square; message: string; run: number;
};
export type PuzzleAction = { type: 'move'; from: Square; to: Square } | { type: 'opponent' } | { type: 'reveal' } | { type: 'reset'; puzzle: Puzzle };
export function startPuzzle(puzzle: Puzzle, run = 0): PuzzleState {
  return { puzzle, step: 0, moves: [], phase: 'playing', failed: [], assisted: [], hintLevel: 0, message: '', run };
}
export function puzzleGame(state: PuzzleState): Chess {
  const game = new Chess();
  [...state.puzzle.before, ...state.moves].forEach(move => game.move(move));
  return game;
}
function advance(state: PuzzleState): PuzzleState {
  const step = state.step + 1;
  return { ...state, step, hintLevel: 0, errorSquare: undefined, phase: step === state.puzzle.steps.length ? 'solved' : 'playing', message: step === state.puzzle.steps.length ? '¡Puzzle completado!' : '¡Correcto! Seguí con la siguiente jugada.' };
}
export function puzzleReducer(state: PuzzleState, action: PuzzleAction): PuzzleState {
  if (action.type === 'reset') return startPuzzle(action.puzzle, state.run + 1);
  const current = state.puzzle.steps[state.step];
  if (action.type === 'opponent') {
    if (state.phase !== 'opponent') return state;
    return advance({ ...state, moves: [...state.moves, current.reply!] });
  }
  if (state.phase !== 'playing') return state;
  if (action.type === 'reveal') return { ...state, hintLevel: 2, errorSquare: undefined, assisted: [...new Set([...state.assisted, state.step])], message: current.answer };
  if (action.type === 'move') {
    const game = puzzleGame(state);
    let san: string;
    try { san = game.move({ from: action.from, to: action.to, promotion: 'q' }).san; }
    catch { return { ...state, errorSquare: action.to, message: 'Movimiento ilegal. Probá uno de los destinos marcados.' }; }
    if (san !== current.answer) return { ...state, errorSquare: action.to, failed: [...new Set([...state.failed, state.step])], message: `${san} es legal, pero no es la jugada de esta línea. Probá otra vez.` };
    const next = { ...state, moves: [...state.moves, san], errorSquare: undefined, message: '¡Correcto! Las negras responden…' };
    return current.reply ? { ...next, phase: 'opponent' } : advance(next);
  }
  return state;
}
