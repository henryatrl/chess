import { rateCard, type Progress } from './progress.ts';
import { puzzles, type Puzzle, type PuzzleState } from './puzzles.ts';

export const DAILY_LIMIT = 10;
export const reviewId = (id: string) => `line:${id}`;
export function studyBatches(all: Puzzle[]): Puzzle[][] {
  return Array.from({ length: Math.ceil(all.length / DAILY_LIMIT) }, (_, i) => all.slice(i * DAILY_LIMIT, (i + 1) * DAILY_LIMIT));
}
export function studyDay(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function ensureDailyBatch(progress: Progress, all: Puzzle[], now: number): Progress {
  const date = studyDay(now);
  const validIds = new Set(all.map(p => p.id));
  if (progress.daily?.date === date && progress.daily.ids.every(id => validIds.has(id))) return progress;
  const batch = studyBatches(all).find(group => group.some(p => !progress.reviews[reviewId(p.id)]?.mastered));
  const ids = batch?.map(p => p.id) ?? [];
  return { ...progress, daily: { date, ids } };
}
export function finishOpening(progress: Progress, state: PuzzleState, now: number): Progress {
  if (state.phase !== 'solved') return progress;
  const id = reviewId(state.puzzle.id);
  const recalled = state.failed.length === 0 && state.assisted.length === 0;
  const next = rateCard(progress, id, recalled ? 'good' : 'again', recalled, now);
  next.reviews[id].mastered = progress.reviews[id]?.mastered === true || recalled;
  return next;
}
export function migrateLegacyProgress(progress: Progress): Progress {
  let next = progress;
  const lastEvents = new Map(progress.events.map(event => [event.cardId, event]));
  for (const puzzle of puzzles) {
    const id = reviewId(puzzle.id);
    const ids = puzzle.steps.flatMap(step => step.cardId ? [step.cardId] : []);
    if (progress.reviews[id] || !ids.every(key => progress.reviews[key])) continue;
    if (next === progress) next = { ...progress, reviews: { ...progress.reviews } };
    const reviews = ids.map(key => progress.reviews[key]);
    next.reviews[id] = {
      due: Math.min(...reviews.map(r => r.due)), interval: Math.min(...reviews.map(r => r.interval)),
      repetitions: Math.min(...reviews.map(r => r.repetitions)), lapses: Math.max(...reviews.map(r => r.lapses)),
      mastered: ids.every(key => lastEvents.get(key)?.recalled === true),
    };
  }
  return next;
}
