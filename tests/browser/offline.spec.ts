import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('the standalone HTML needs no network resources, including its library and saved progress', async ({ page, context }) => {
  await context.setOffline(true);
  const failures: string[] = [];
  const network: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  // This managed browser blocks file: navigation. Fulfil only the document in memory;
  // every dependency must be inlined and work with the network disabled.
  const url = 'http://127.0.0.1:54839/';
  await page.route(url, route => route.fulfill({ contentType: 'text/html', body: readFileSync('dist-offline/index.html', 'utf8') }));
  page.on('request', request => { if (/^https?:/.test(request.url()) && request.url() !== url) network.push(request.url()); });
  await page.goto(url);
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'La firma de la italiana' })).toBeVisible();
  await page.locator('[data-square="f1"]').click();
  await page.locator('[data-square="c4"]').click();
  await expect(page.getByText('Correcto', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Bien 3 días', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Tarjetas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Prepará el centro' })).toBeVisible();
  await page.getByRole('button', { name: /Biblioteca/ }).first().click();
  await expect(page.getByRole('heading', { name: '187 variantes' })).toBeVisible();
  await page.getByRole('textbox', { name: 'Buscar aperturas' }).fill('Canal');
  await page.locator('.opening-list > button').first().click();
  await expect(page.locator('.board-card-header')).toContainText('Canal');
  expect(network).toEqual([]);
  expect(failures).toEqual([]);
});
