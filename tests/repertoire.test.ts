import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { cards, decks } from '../src/data/repertoire.ts';
import { emptyProgress, parseProgress, rateCard, intervalFor, streak } from '../src/progress.ts';
import { puzzles, startPuzzle, puzzleReducer, puzzleGame, buildStudyPuzzles, parseCatalogue } from '../src/puzzles.ts';
import { ensureDailyBatch, finishOpening, migrateLegacyProgress, reviewId, studyBatches } from '../src/study.ts';

const study = buildStudyPuzzles(parseCatalogue(readFileSync(new URL('../public/data/lichess-c.tsv', import.meta.url), 'utf8')));

test('all 15 exercise positions, answers, and opponent replies are legal', () => {
  assert.equal(cards.length, 15);
  assert.equal(new Set(cards.map(c => c.id)).size, cards.length);
  for (const card of cards) {
    const game = new Chess();
    card.before.forEach(m => assert.ok(game.move(m), `${card.id}: ${m}`));
    assert.equal(game.turn(), 'w', card.id);
    assert.equal(game.move(card.answer).san, card.answer, card.id);
    assert.ok(game.move(card.reply), `${card.id}: opponent reply`);
  }
  for (const deck of decks) assert.equal(cards.filter(c => c.deck === deck.id).length, 5);
});

test('all puzzle lines can be completed, including castling and the final check', () => {
  for (const puzzle of puzzles) {
    let state = startPuzzle(puzzle);
    const replay = new Chess();
    puzzle.before.forEach(move => replay.move(move));
    for (const step of puzzle.steps) {
      const expected = replay.move(step.answer);
      state = puzzleReducer(state, { type: 'move', from: expected.from, to: expected.to });
      if (step.reply) {
        assert.equal(state.phase, 'opponent');
        // Clicking again while the opponent is replying must not advance the line.
        assert.equal(puzzleReducer(state, { type: 'move', from: 'a2', to: 'a3' }), state);
        replay.move(step.reply);
        state = puzzleReducer(state, { type: 'opponent' });
      }
      assert.equal(puzzleGame(state).fen(), replay.fen(), puzzle.id);
    }
    assert.equal(state.phase, 'solved');
    assert.equal(state.step, puzzle.steps.length);
    assert.equal(puzzleGame(state).isCheck(), false, `${puzzle.id} does not end in check`);
  }
});

test('puzzles preserve the position on alternatives and track help and solution separately', () => {
  const initial = startPuzzle(puzzles[0]);
  const wrong = puzzleReducer(initial, { type: 'move', from: 'd2', to: 'd3' });
  assert.equal(puzzleGame(wrong).fen(), puzzleGame(initial).fen());
  assert.match(wrong.message, /es legal/);
  assert.deepEqual(wrong.failed, [0]);
  const hint = puzzleReducer(wrong, { type: 'reveal' });
  assert.equal(hint.hintLevel, 2);
  assert.deepEqual(hint.assisted, [0]);
  const solution = puzzleReducer(hint, { type: 'reveal' });
  assert.equal(solution.phase, 'playing');
  assert.equal(solution.step, 0);
  assert.deepEqual(solution.assisted, [0]);
  assert.equal(puzzleGame(solution).fen(), puzzleGame(initial).fen());
  const reset = puzzleReducer(solution, { type: 'reset', puzzle: puzzles[1] });
  assert.equal(reset.run, 1);
  assert.equal(reset.phase, 'playing');
  assert.deepEqual(reset.failed, []);
  assert.equal(puzzleReducer(reset, { type: 'opponent' }), reset);
});

test('the pinned local database contains 187 Italian entries with legal PGNs', () => {
  const data = readFileSync(new URL('../public/data/lichess-c.tsv', import.meta.url), 'utf8');
  const rows = data.trim().split(/\r?\n/).slice(1).map(r => r.split('\t')).filter(r => r[1].startsWith('Italian Game'));
  assert.equal(rows.length, 187);
  for (const [eco, name, pgn] of rows) {
    const game = new Chess(); game.loadPgn(pgn);
    assert.ok(game.history().length >= 5, `${eco}: ${name}`);
    // The catalogue also includes transpositions reached through a Scotch move order.
    assert.ok(game.history().includes('Bc4'), `${eco}: ${name} develops the Italian bishop`);
  }
});

test('reviews persist scheduling, recall, and lapses without mutating previous state', () => {
  const now = Date.now();
  const initial = emptyProgress();
  const good = rateCard(initial, 'piano-1', 'good', true, now);
  assert.equal(good.reviews['piano-1'].due, now + 3 * 86400000);
  assert.equal(good.events[0].recalled, true);
  assert.deepEqual(initial, emptyProgress());
  const again = rateCard(good, 'piano-1', 'again', false, now);
  assert.equal(again.reviews['piano-1'].due, now + 300000);
  assert.equal(again.reviews['piano-1'].lapses, 1);
  assert.equal(again.reviews['piano-1'].repetitions, 2);
  assert.ok(intervalFor(good.reviews['piano-1'], 'good') > good.reviews['piano-1'].interval);
  assert.deepEqual(parseProgress(JSON.stringify(again)), again);
});

test('corrupted storage recovers safely and streaks use calendar days', () => {
  for (const value of ['oops', '{}', '{"version":1,"reviews":[],"events":[]}', '{"version":1,"reviews":{"a":{"due":"oops"}},"events":[]}']) assert.deepEqual(parseProgress(value), emptyProgress());
  const now = new Date(2026, 9, 23, 14).getTime();
  const yesterday = new Date(2026, 9, 22, 23).getTime();
  const p = rateCard(rateCard(emptyProgress(), 'piano-1', 'good', true, yesterday), 'piano-2', 'good', true, now);
  assert.equal(streak(p.events, now), 2);
  assert.equal(streak([], now), 0);
  assert.deepEqual(parseProgress(JSON.stringify({ version: 1, reviews: { 'piano-1': { due: 1e100, interval: 0, repetitions: 1, lapses: 0 } }, events: [] })), emptyProgress());
  assert.equal(intervalFor({ due: 0, interval: 365 * 86400000, repetitions: 50, lapses: 0 }, 'easy'), 365 * 86400000);
});

test('the catalogue produces 18 stable batches of ten legal, complete variants', () => {
  assert.equal(study.length, 180);
  assert.equal(new Set(study.map(p => p.id)).size, 180);
  const batches = studyBatches(study);
  assert.equal(batches.length, 18);
  assert.ok(batches.every(batch => batch.length === 10));
  for (const puzzle of study) {
    let state = startPuzzle(puzzle);
    for (const step of puzzle.steps) {
      const move = puzzleGame(state).move(step.answer);
      state = puzzleReducer(state, { type: 'move', from: move.from, to: move.to });
      if (step.reply) state = puzzleReducer(state, { type: 'opponent' });
    }
    assert.equal(state.phase, 'solved', puzzle.id);
    assert.equal(puzzleGame(state).turn() === 'w' && puzzleGame(state).isCheck(), false, puzzle.id);
  }
  const reversed = buildStudyPuzzles(parseCatalogue(readFileSync(new URL('../public/data/lichess-c.tsv', import.meta.url), 'utf8')).reverse());
  assert.deepEqual(reversed.map(p => p.id), study.map(p => p.id));
});

test('today keeps a fixed batch on reload and after completion, then advances the next day', () => {
  const now = new Date(2026, 9, 24, 12).getTime();
  let progress = ensureDailyBatch(emptyProgress(), study, now);
  const firstIds = progress.daily!.ids;
  assert.equal(firstIds.length, 10);
  for (const puzzle of study.slice(0, 10)) {
    progress = finishOpening(progress, { ...startPuzzle(puzzle), phase: 'solved', step: puzzle.steps.length }, now);
  }
  assert.deepEqual(ensureDailyBatch(parseProgress(JSON.stringify(progress)), study, now).daily!.ids, firstIds);
  assert.equal(ensureDailyBatch(progress, study, now), progress);
  const tomorrow = new Date(2026, 9, 25, 12).getTime();
  assert.deepEqual(ensureDailyBatch(progress, study, tomorrow).daily!.ids, study.slice(10, 20).map(p => p.id));
});

test('partial batches carry over and help schedules only the variant being practiced', () => {
  const now = new Date(2026, 9, 24, 12).getTime();
  const initial = ensureDailyBatch(emptyProgress(), study, now);
  const assisted = { ...startPuzzle(study[0]), phase: 'solved' as const, assisted: [0] };
  const helped = finishOpening(initial, assisted, now);
  assert.equal(helped.reviews[reviewId(study[0].id)].mastered, false);
  assert.equal(helped.reviews[reviewId(study[0].id)].due, now + 300000);
  assert.equal(Object.keys(helped.reviews).length, 1);
  const clean = finishOpening(helped, { ...startPuzzle(study[0]), phase: 'solved' }, now);
  assert.equal(clean.reviews[reviewId(study[0].id)].mastered, true);
  const tomorrow = ensureDailyBatch(clean, study, new Date(2026, 9, 25, 12).getTime());
  assert.deepEqual(tomorrow.daily!.ids, initial.daily!.ids);
  const relearn = finishOpening(clean, assisted, now);
  assert.equal(relearn.reviews[reviewId(study[0].id)].mastered, true);
  assert.deepEqual(initial.reviews, {});
});

test('legacy card progress migrates without losing records or changing storage format', () => {
  let legacy = emptyProgress();
  for (const step of puzzles[0].steps) if (step.cardId) legacy = rateCard(legacy, step.cardId, 'good', true, Date.now());
  const migrated = migrateLegacyProgress(legacy);
  assert.equal(migrated.reviews['line:piano'].mastered, true);
  assert.deepEqual(migrated.events, legacy.events);
  for (const id of Object.keys(legacy.reviews)) assert.deepEqual(migrated.reviews[id], legacy.reviews[id]);
  assert.equal(migrateLegacyProgress(migrated), migrated);
  const withDaily = ensureDailyBatch(migrated, study, Date.now());
  assert.deepEqual(parseProgress(JSON.stringify(withDaily)), withDaily);
  const malformed = { ...withDaily, daily: { date: 'invalid', ids: [] } };
  assert.deepEqual(parseProgress(JSON.stringify(malformed)).reviews, migrated.reviews);
  const unknownIds = { ...withDaily, daily: { date: withDaily.daily!.date, ids: ['removed-entry'] } };
  assert.equal(ensureDailyBatch(unknownIds, study, Date.now()).daily!.ids.length, 10);
});
