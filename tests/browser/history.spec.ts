import { test, expect, type Page } from '@playwright/test';

async function move(page: Page, from: string, to: string, final = false) {
  await page.locator(`[data-square="${from}"]`).click();
  await page.locator(`[data-square="${to}"]`).click();
  await expect(page.locator('.board-turn > span').first()).toHaveText(final ? 'Variante completada' : 'Tu turno');
}

test('arrow keys traverse known opening positions and clamp at both ends', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
  await expect(page.getByRole('button', { name: 'Jugada siguiente', exact: true })).toBeDisabled();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-square="b8"]')).toHaveAttribute('aria-label', /caballo negro/);
  await expect(page.locator('[data-square="c6"]')).toHaveAttribute('aria-label', /vacía/);
  await expect(page.getByRole('heading', { name: 'Historial', exact: true })).toBeVisible();
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Posición del historial')).toHaveText('Inicio');
  await expect(page.getByRole('button', { name: 'Jugada anterior', exact: true })).toBeDisabled();
  await expect(page.locator('[data-square="e2"]')).toHaveAttribute('aria-label', /peón blanco/);
  for (let i = 0; i < 8; i++) await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await expect(page.locator('[data-square="c4"]')).toHaveAttribute('aria-label', /vacía/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!).events.length)).toBe(0);
});

test('history follows individual white and black moves, blocks play, then resumes', async ({ page }) => {
  await page.goto('/');
  await move(page, 'f1', 'c4');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-square="c4"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await expect(page.locator('[data-square="f8"]')).toHaveAttribute('aria-label', /alfil negro/);
  await expect(page.locator('[data-square="c2"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.getByRole('button', { name: 'Ver solución', exact: true })).toHaveCount(0);
  // Playwright normally refuses aria-disabled elements. Dispatch the actual clicks
  // to verify the application ignores attempts to play on a historical position.
  await page.locator('[data-square="c2"]').click({ force: true });
  await page.locator('[data-square="c3"]').click({ force: true });
  await expect(page.locator('[data-square="c3"]')).toHaveAttribute('aria-label', /vacía/);
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-square="c4"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await page.getByRole('button', { name: 'Volver a la actual', exact: true }).click();
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute('aria-label', /alfil negro/);
  await expect(page.getByRole('button', { name: 'Jugada siguiente', exact: true })).toBeDisabled();
  await move(page, 'c2', 'c3');
  await expect(page.locator('[data-square="f6"]')).toHaveAttribute('aria-label', /caballo negro/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /peón blanco/);
  await move(page, 'd2', 'd4');
  await move(page, 'c3', 'd4');
  await move(page, 'c1', 'd2');
  await move(page, 'b1', 'd2', true);
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem('cavallo.progress.v1')!).events);
  expect(events).toHaveLength(1);
  expect(events[0].recalled).toBe(true);
});

test('an automatic reply does not jump a history cursor back to the current position', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.locator('[data-square="f1"]').click();
  await page.locator('[data-square="c4"]').click();
  await page.keyboard.press('ArrowLeft');
  await page.clock.runFor(500);
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
  await expect(page.locator('[data-square="f1"]')).toHaveAttribute('aria-label', /alfil blanco/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Posición del historial')).toHaveText('3. Bc4');
  await expect(page.locator('[data-square="f8"]')).toHaveAttribute('aria-label', /alfil negro/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByLabel('Posición del historial')).toHaveText('3… Bc5');
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute('aria-label', /alfil negro/);
  await expect(page.locator('.board-turn > span').first()).toHaveText('Tu turno');
});

test('changing or restarting a variant resets history to its current position', async ({ page }) => {
  await page.goto('/');
  await move(page, 'f1', 'c4');
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('combobox', { name: 'Variante del lote' }).selectOption('pianissimo');
  await expect(page.getByLabel('Posición del historial')).toHaveText('3… Bc5');
  await expect(page.getByRole('button', { name: 'Volver a la actual', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Jugada siguiente', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Jugada anterior', exact: true }).click();
  await expect(page.locator('[data-square="f8"]')).toHaveAttribute('aria-label', /alfil negro/);
  await page.getByRole('button', { name: 'Reiniciar variante', exact: true }).click();
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute('aria-label', /alfil negro/);
  await expect(page.getByRole('button', { name: 'Jugada siguiente', exact: true })).toBeDisabled();
});

test('arrow shortcuts leave form fields and the help dialog alone', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('combobox', { name: 'Variante del lote' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
  await page.evaluate(() => {
    const input = document.createElement('input');
    input.setAttribute('aria-label', 'Campo de prueba');
    document.querySelector('.puzzle-workspace')!.append(input);
  });
  const field = page.getByRole('textbox', { name: 'Campo de prueba' });
  await field.fill('abcd');
  await page.keyboard.press('ArrowLeft');
  expect(await field.evaluate((input: HTMLInputElement) => input.selectionStart)).toBe(3);
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
  await page.getByRole('button', { name: 'Ayuda', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Escape');
  await expect(page.getByLabel('Posición del historial')).toHaveText('2… Nc6');
});

test('reviewing a completed line does not register another result and next resets the cursor', async ({ page }) => {
  await page.goto('/');
  const line = [['f1','c4'], ['c2','c3'], ['d2','d4'], ['c3','d4'], ['c1','d2'], ['b1','d2']];
  for (const [i, squares] of line.entries()) await move(page, squares[0], squares[1], i === line.length - 1);
  const saved = await page.evaluate(() => localStorage.getItem('cavallo.progress.v1'));
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /alfil negro/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-square="d2"]')).toHaveAttribute('aria-label', /caballo blanco/);
  expect(await page.evaluate(() => localStorage.getItem('cavallo.progress.v1'))).toBe(saved);
  await page.keyboard.press('ArrowLeft');
  await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
  await expect(page.getByLabel('Posición del historial')).toHaveText('3… Bc5');
  await expect(page.getByRole('button', { name: 'Volver a la actual', exact: true })).toHaveCount(0);
});

test('history buttons work on phones without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/');
  await move(page, 'f1', 'c4');
  await page.getByRole('button', { name: 'Jugada anterior', exact: true }).click();
  await expect(page.locator('[data-square="f8"]')).toHaveAttribute('aria-label', /alfil negro/);
  await page.getByRole('button', { name: 'Jugada siguiente', exact: true }).click();
  await expect(page.locator('[data-square="c5"]')).toHaveAttribute('aria-label', /alfil negro/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
});
