import { test, expect, type Page } from '@playwright/test';

async function move(page: Page, from: string, to: string) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
}

test('learn a position, schedule it, and preserve progress after reloading', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La firma de la italiana' })).toBeVisible();
  await move(page, 'f1', 'c4');
  await expect(page.getByText('¡Esa es la jugada!')).toBeVisible();
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute('aria-label', /alfil negro/);
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prepará el centro' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prepará el centro' })).toBeVisible();
  await page.getByRole('button', { name: 'Mi progreso', exact: true }).click();
  await expect(page.getByText('La firma de la italiana', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('legal alternatives are identified without calling them chess errors', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await move(page, 'd2', 'd3');
  await expect(page.getByText(/d3 es legal, pero no es la jugada de esta línea/)).toBeVisible();
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /peón blanco/);
  await move(page, 'f1', 'c4');
  await expect(page.getByText('La encontraste. Seguí practicando.')).toBeVisible();
});

test('hints, answer reveal, and a due review work', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.getByRole('button', { name: 'Una pista', exact: true }).click();
  await expect(page.locator('[data-square="f1"]')).toHaveClass(/hint-square/);
  await page.getByRole('button', { name: 'Ver respuesta' }).click();
  await expect(page.getByText('Ahora conocés la idea.')).toBeVisible();
  await page.getByRole('button', { name: 'Otra vez 5 min', exact: true }).click();
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('cavallo.progress.v1')!);
    state.reviews['piano-1'].due = Date.now() - 1000;
    localStorage.setItem('cavallo.progress.v1', JSON.stringify(state));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.getByRole('button', { name: /Para repasar/ }).click();
  await expect(page.getByRole('heading', { name: 'La firma de la italiana' })).toBeVisible();
  await move(page, 'f1', 'c4');
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Todo al día por aquí.' })).toBeVisible();
});

test('select a deck and castle by moving the king', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.getByRole('button', { name: /Giuoco Pianissimo Sin prisa/ }).click();
  await expect(page.getByRole('heading', { name: 'Un centro paciente' })).toBeVisible();
  await move(page, 'd2', 'd3');
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  await move(page, 'c2', 'c3');
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Primero, tu rey' })).toBeVisible();
  await move(page, 'e1', 'g1');
  await expect(page.getByText('¡Esa es la jugada!')).toBeVisible();
  await expect(page.locator('[data-square="g1"]')).toHaveAttribute('aria-label', /rey blanco/);
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /torre blanco/);
});

test('browse the real database, search, and step through a line', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.getByRole('button', { name: /Biblioteca/ }).first().click();
  await expect(page.getByRole('heading', { name: '187 caminos para conocer la italiana.' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar aperturas' }).fill('Canal');
  await page.locator('.opening-list > button').first().click();
  await expect(page.locator('.board-card-header')).toContainText('Canal');
  await page.getByRole('button', { name: 'Posición inicial', exact: true }).click();
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute('aria-label', /peón blanco/);
  await page.getByRole('button', { name: 'Jugada siguiente', exact: true }).click();
  await expect(page.locator('[data-square="e4"]')).toHaveAttribute('aria-label', /peón blanco/);
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Descargar esta línea en PGN' }).click();
  expect((await download).suggestedFilename()).toBe('italiana.pgn');
});

test('phone layout is usable without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  await move(page, 'f1', 'c4');
  await expect(page.getByText('¡Esa es la jugada!')).toBeVisible();
  await page.screenshot({ path: '/tmp/cavallo-mobile.png', fullPage: true });
});

test('all five exercises complete a deck and another deck can be started', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  for (const [from, to] of [['f1','c4'], ['c2','c3'], ['d2','d4'], ['c3','d4'], ['c1','d2']]) {
    await move(page, from, to);
    await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Un paso más en tu repertorio.' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar con otra variante' }).click();
  await expect(page.getByRole('heading', { name: 'Un centro paciente' })).toBeVisible();
});

test('export and import restore a real progress backup', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await move(page, 'f1', 'c4');
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  const backup = await page.evaluate(() => localStorage.getItem('cavallo.progress.v1')!);
  await page.getByRole('button', { name: 'Mi progreso', exact: true }).click();
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('cavallo-progreso.json');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await page.getByRole('button', { name: 'Mi progreso', exact: true }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('input[type="file"]').setInputFiles({ name: 'copia.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await expect(page.getByText('Progreso importado.')).toBeVisible();
  await expect(page.getByText('La firma de la italiana', { exact: true })).toBeVisible();
});

test('no third-party requests are needed and malformed saved data recovers', async ({ page }) => {
  const outside: string[] = [];
  page.on('request', r => { if (!new URL(r.url()).hostname.match(/^(127\.0\.0\.1|localhost)$/)) outside.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('cavallo.progress.v1', '{bad json'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La firma de la italiana' })).toBeVisible();
  await page.getByRole('button', { name: 'Cómo funciona' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  expect(outside).toEqual([]);
});
