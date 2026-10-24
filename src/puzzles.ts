import { Chess, type Square } from 'chess.js';
import { cards, decks, type DeckId } from './data/repertoire.ts';

export type PuzzleStep = { answer: string; reply?: string; idea: string; hint: string; cardId?: string };
export type Puzzle = { id: DeckId; title: string; eco: string; description: string; before: string[]; steps: PuzzleStep[] };
export const puzzles: Puzzle[] = decks.map(deck => {
  const line = cards.filter(card => card.deck === deck.id);
  const steps: PuzzleStep[] = line.map(card => ({ answer: card.answer, reply: card.reply, idea: card.idea, hint: card.hint, cardId: card.id }));
  // Resolve the final check in the open Piano instead of ending with our king in check.
  if (deck.id === 'piano') steps.push({ answer: 'Nbxd2', hint: 'El caballo de b1 puede recuperar el alfil que da jaque en d2.', idea: 'Nbxd2 recupera el alfil y resuelve el jaque desarrollando el caballo de dama.' });
  return { id: deck.id, title: deck.name, eco: deck.eco, description: deck.description, before: line[0].before, steps };
});
export type PuzzleState = {
  puzzle: Puzzle; step: number; moves: string[]; phase: 'playing' | 'opponent' | 'solved' | 'solution';
  failed: number[]; assisted: number[]; hintLevel: number; errorSquare?: Square; message: string; run: number;
};
export type PuzzleAction = { type: 'move'; from: Square; to: Square } | { type: 'opponent' } | { type: 'hint' } | { type: 'reveal' } | { type: 'reset'; puzzle: Puzzle };
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
  if (action.type === 'hint') return { ...state, hintLevel: Math.min(2, state.hintLevel + 1), assisted: [...new Set([...state.assisted, state.step])] };
  if (action.type === 'reveal') return { ...state, phase: 'solution', moves: state.puzzle.steps.flatMap(step => [step.answer, ...(step.reply ? [step.reply] : [])]), assisted: state.puzzle.steps.map((_, i) => i), message: 'Solución revelada. Reintentá la línea para recordarla.' };
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
