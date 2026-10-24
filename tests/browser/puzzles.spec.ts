import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function move(page: Page, from: string, to: string, final = false) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  await expect(page.getByRole('heading', { name: final ? '¡Puzzle completado!' : '¡Correcto! Seguí así', exact: true })).toBeVisible();
}
const piano = [['f1','c4'], ['c2','c3'], ['d2','d4'], ['c3','d4'], ['c1','d2'], ['b1','d2']];

test('default puzzle completes a whole line, schedules cards once, and advances', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Puzzles de aperturas.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Juegan blancas' })).toBeVisible();
  for (const [i, squares] of piano.entries()) await move(page, squares[0], squares[1], i === piano.length - 1);
  await expect(page.getByText('Toda la línea, sin ayuda. Bien jugado.')).toBeVisible();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!));
  expect(progress.events).toHaveLength(5);
  expect(progress.events.every((e: { recalled: boolean }) => e.recalled)).toBeTruthy();
  await page.getByRole('button', { name: 'Siguiente puzzle', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Variante del puzzle' })).toHaveValue('pianissimo');
  await expect(page.getByText('0 / 5 jugadas')).toBeVisible();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!).events.length)).toBe(5);
});

test('wrong alternatives stay on the same position with a visible retry marker', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-square="d2"]').click();
  await page.locator('[data-square="d3"]').click();
  await expect(page.getByRole('heading', { name: 'Probá otra vez' })).toBeVisible();
  await expect(page.getByText(/d3 es legal, pero no es la jugada de esta línea/)).toBeVisible();
  await expect(page.locator('[data-square="d3"] .incorrect')).toBeVisible();
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /peón blanco/);
  await move(page, 'f1', 'c4');
  await expect(page.getByText('1 / 6 jugadas')).toBeVisible();
});

test('puzzle hints show the origin and then an arrow, including a flipped board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Pedir una pista' }).click();
  await expect(page.locator('[data-square="f1"]')).toHaveClass(/hint-square/);
  await page.getByRole('button', { name: 'Mostrar destino' }).click();
  await expect(page.locator('.board-arrow')).toBeVisible();
  const before = await page.locator('.board-arrow line').getAttribute('x1');
  await page.getByRole('button', { name: 'Girar tablero', exact: true }).click();
  expect(await page.locator('.board-arrow line').getAttribute('x1')).not.toBe(before);
});

test('revealing is not a success and retry clears the solution state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver solución', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Esta es la solución' })).toBeVisible();
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!));
  expect(progress.events).toHaveLength(5);
  expect(progress.events.every((e: { recalled: boolean; rating: string }) => !e.recalled && e.rating === 'again')).toBeTruthy();
  await page.getByRole('button', { name: 'Volver a intentarlo' }).click();
  await expect(page.getByRole('heading', { name: 'Juegan blancas' })).toBeVisible();
  await expect(page.getByText('0 / 6 jugadas')).toBeVisible();
});

test('castling works in the continuous Pianissimo line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Variante del puzzle' }).selectOption('pianissimo');
  await move(page, 'd2', 'd3');
  await move(page, 'c2', 'c3');
  await move(page, 'e1', 'g1');
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute('aria-label', /rey blanco/);
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /torre blanco/);
  await move(page, 'f1', 'e1');
  await move(page, 'c4', 'b3', true);
});

test('switching variants cancels a pending opponent reply', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.locator('[data-square="f1"]').click();
  await page.locator('[data-square="c4"]').click();
  await page.getByRole('combobox', { name: 'Variante del puzzle' }).selectOption('pianissimo');
  await page.clock.runFor(800);
  await expect(page.getByText('0 / 5 jugadas')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Juegan blancas' })).toBeVisible();
  await expect(page.locator('[data-square="g8"]')).toHaveAttribute('aria-label', /caballo negro/);
});

test('review queue updates with actual due cards and handles no pending reviews', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cavallo.progress.v1', JSON.stringify({ version: 1, reviews: { 'piano-1': { due: Date.now() - 1000, interval: 300000, repetitions: 1, lapses: 1 } }, events: [] })));
  await page.goto('/');
  await page.getByRole('button', { name: 'Mis repasos 1', exact: true }).click();
  for (const [i, squares] of piano.entries()) await move(page, squares[0], squares[1], i === piano.length - 1);
  await page.getByRole('button', { name: 'Siguiente puzzle', exact: true }).click();
  await expect(page.getByRole('heading', { name: '¡Estás al día!' })).toBeVisible();
});

test('portable puzzle works offline and fits phone screens', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await context.setOffline(true);
  const url = 'http://127.0.0.1:54839/';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('dist-offline/index.html', 'utf8') }));
  const requests: string[] = [];
  page.on('request', r => { if (/^https?:/.test(r.url()) && r.url() !== url) requests.push(r.url()); });
  await page.goto(url);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await move(page, 'f1', 'c4');
  await expect(page.getByText('1 / 6 jugadas')).toBeVisible();
  await page.screenshot({ path: '/tmp/cavallo-puzzles-mobile.png', fullPage: true });
  expect(requests).toEqual([]);
  for (const width of [320, 768]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  }
});
