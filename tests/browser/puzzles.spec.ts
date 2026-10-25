import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildStudyPuzzles, parseCatalogue } from '../../src/puzzles';

const all = buildStudyPuzzles(parseCatalogue(readFileSync('public/data/lichess-c.tsv', 'utf8')));
const piano = [['f1','c4'], ['c2','c3'], ['d2','d4'], ['c3','d4'], ['c1','d2'], ['b1','d2']];
async function move(page: Page, from: string, to: string, final = false) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  await expect(page.locator('.board-turn > span').first()).toHaveText(final ? 'Variante completada' : 'Tu turno');
}
async function finishPiano(page: Page) {
  for (const [i, squares] of piano.entries()) await move(page, squares[0], squares[1], i === piano.length - 1);
}
async function seed(page: Page, mastered: string[] = [], dueIds: string[] = []) {
  await page.addInitScript(({ mastered, dueIds, ids }) => {
    if (localStorage.getItem('cavallo.progress.v1')) return;
    const now = Date.now(); const d = new Date(now);
    const date = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const reviews = Object.fromEntries([...new Set([...mastered,...dueIds])].map(id => [`line:${id}`, { due: dueIds.includes(id) ? now-1000 : now+86400000, interval: 86400000, repetitions: 1, lapses: 0, mastered: mastered.includes(id) }]));
    localStorage.setItem('cavallo.progress.v1', JSON.stringify({ version:1, reviews, events:[], daily:{date,ids} }));
  }, { mastered, dueIds, ids: all.slice(0,10).map(p => p.id) });
}

test('jane has a minimal screen and schedules a completed variant once', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('jane');
  await expect(page.getByRole('link', { name: 'jane, inicio' })).toBeVisible();
  await expect(page.getByText(/TU PRÓXIMA BUENA JUGADA|Reconocé el patrón|Una buena jugada al día|Las ideas se entienden/)).toHaveCount(0);
  await expect(page.locator('.study-batch-count')).toHaveText('0/10 variantes');
  await finishPiano(page);
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!));
  expect(progress.events).toHaveLength(1);
  expect(progress.reviews['line:piano'].mastered).toBe(true);
  await page.getByRole('button', { name: 'Siguiente', exact:true }).click();
  await expect(page.getByRole('combobox', { name:'Variante del lote' })).toHaveValue('pianissimo');
  await expect(page.locator('.study-batch-count')).toHaveText('1/10 variantes');
  await page.reload();
  await expect(page.getByRole('combobox', { name:'Variante del lote' })).toHaveValue('pianissimo');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!).events.length)).toBe(1);
});

test('wrong alternatives leave the position unchanged', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-square="d2"]').click(); await page.locator('[data-square="d3"]').click();
  await expect(page.getByRole('heading', { name:'Probá otra vez' })).toBeVisible();
  await expect(page.getByText(/d3 es legal/)).toBeVisible();
  await expect(page.locator('[data-square="d3"] .incorrect')).toBeVisible();
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /peón blanco/);
  await move(page,'f1','c4');
  await expect(page.locator('.board-turn > span').last()).toHaveText('1/6 jugadas');
});

test('show solution reveals only the current step and does not move any pieces', async ({ page }) => {
  await page.goto('/');
  const before = await page.locator('.chessboard').innerHTML();
  await page.getByRole('button', { name:'Ver solución', exact:true }).click();
  await expect(page.locator('.current-answer')).toHaveText('Bc4f1 → c4');
  await expect(page.locator('.board-arrow')).toBeVisible();
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await expect(page.locator('[data-square="c4"]')).toHaveAttribute('aria-label', /vacía/);
  await expect(page.locator('.board-turn > span').last()).toHaveText('0/6 jugadas');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!).events.length)).toBe(0);
  await expect(page.locator('.puzzle-line')).toHaveCount(0);
  await move(page,'f1','c4');
  await expect(page.locator('.current-answer')).toHaveCount(0);
  await expect(page.locator('.board-arrow')).toHaveCount(0);
  await expect(page.getByRole('button', { name:'Ver solución', exact:true })).toBeEnabled();
  expect(before).toContain('f1');
  for (const [i, squares] of piano.slice(1).entries()) await move(page,squares[0],squares[1],i===4);
  const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!));
  expect(progress.reviews['line:piano'].mastered).toBe(false);
  expect(progress.events[0].recalled).toBe(false);
  await expect(page.locator('.study-batch-count')).toHaveText('0/10 variantes');
});

test('solution arrows flip with the board', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name:'Ver solución', exact:true }).click();
  const x = await page.locator('.board-arrow line').getAttribute('x1');
  await page.getByRole('button', { name:'Girar tablero', exact:true }).click();
  expect(await page.locator('.board-arrow line').getAttribute('x1')).not.toBe(x);
});

test('all lots are visible and opening a lot limits the selector to ten variants', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name:'Lotes', exact:true }).click();
  await expect(page.locator('.batch-card')).toHaveCount(18);
  await page.locator('.batch-card').nth(1).click();
  await expect(page.getByRole('button', { name:/Lotes Lote 2/ })).toBeVisible();
  const ids = await page.locator('.variant-select option').evaluateAll(nodes => nodes.map(n => (n as HTMLOptionElement).value));
  expect(ids).toEqual(all.slice(10,20).map(p => p.id));
  await page.getByRole('button', { name:'Entrenar', exact:true }).click();
  await expect(page.getByRole('button', { name:/Lotes Lote 1/ })).toBeVisible();
});

test('finishing the tenth variant ends the lot instead of introducing an eleventh', async ({ page }) => {
  await seed(page, all.slice(1,10).map(p=>p.id));
  await page.goto('/');
  await expect(page.locator('.study-batch-count')).toHaveText('9/10 variantes');
  await finishPiano(page);
  await page.getByRole('button', { name:'Terminar lote', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Lote completado' })).toBeVisible();
  await expect(page.locator('.chessboard')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name:'Lote completado' })).toBeVisible();
  await page.getByRole('button', { name:'Repetir lote', exact:true }).click();
  await expect(page.getByRole('combobox', { name:'Variante del lote' })).toHaveValue('piano');
  await finishPiano(page);
  await expect(page.locator('.study-batch-count')).toHaveText('1/10 variantes');
  await page.getByRole('button', { name:'Siguiente', exact:true }).click();
  await expect(page.getByRole('combobox', { name:'Variante del lote' })).toHaveValue('pianissimo');
});

test('castling works through a full Pianissimo sequence', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name:'Variante del lote' }).selectOption('pianissimo');
  await move(page,'d2','d3'); await move(page,'c2','c3'); await move(page,'e1','g1');
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute('aria-label', /rey blanco/);
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /torre blanco/);
  await move(page,'f1','e1'); await move(page,'c4','b3',true);
});

test('switching variant cancels an unfinished reply', async ({ page }) => {
  await page.clock.install(); await page.goto('/');
  await page.locator('[data-square="f1"]').click(); await page.locator('[data-square="c4"]').click();
  await page.getByRole('combobox', { name:'Variante del lote' }).selectOption('pianissimo');
  await page.clock.runFor(800);
  await expect(page.locator('.board-turn > span').last()).toHaveText('0/5 jugadas');
  await expect(page.locator('[data-square="g8"]')).toHaveAttribute('aria-label', /caballo negro/);
});

test('reviews are separate from today and clear after a successful review', async ({ page }) => {
  await seed(page,['piano'],['piano']); await page.goto('/');
  await page.getByRole('button', { name:'Repasos 1', exact:true }).click();
  await finishPiano(page);
  await page.getByRole('button', { name:'Terminar lote', exact:true }).click();
  await expect(page.getByRole('heading', { name:'Sin repasos pendientes' })).toBeVisible();
});

test('the offline file includes ten-variant lots and fits small screens', async ({ page, context }) => {
  await page.setViewportSize({width:390,height:844}); await context.setOffline(true);
  const url='http://127.0.0.1:54839/';
  await page.route(url,route=>route.fulfill({contentType:'text/html',body:readFileSync('dist-offline/index.html','utf8')}));
  const requests:string[]=[];
  page.on('request',r=>{if(/^https?:/.test(r.url())&&r.url()!==url)requests.push(r.url())});
  await page.goto(url); await move(page,'f1','c4');
  await page.getByRole('button',{name:'Ver solución',exact:true}).click();
  await page.screenshot({path:'/tmp/jane-mobile.png',fullPage:true});
  for(const width of[320,390,768]){
    await page.setViewportSize({width,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  }
  await page.getByRole('button',{name:'Lotes',exact:true}).click();
  await expect(page.locator('.batch-card')).toHaveCount(18);
  expect(requests).toEqual([]);
});
