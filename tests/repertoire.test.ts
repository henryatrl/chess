import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { cards, decks } from '../src/data/repertoire.ts';
import { emptyProgress, parseProgress, rateCard, intervalFor, streak } from '../src/progress.ts';
import { puzzles, startPuzzle, puzzleReducer, puzzleGame } from '../src/puzzles.ts';

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
  const hint = puzzleReducer(puzzleReducer(wrong, { type: 'hint' }), { type: 'hint' });
  assert.equal(hint.hintLevel, 2);
  assert.deepEqual(hint.assisted, [0]);
  const solution = puzzleReducer(hint, { type: 'reveal' });
  assert.equal(solution.phase, 'solution');
  assert.equal(solution.step, 0);
  assert.equal(solution.assisted.length, puzzles[0].steps.length);
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
