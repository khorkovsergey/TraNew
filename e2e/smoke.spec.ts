import { test, expect } from '@playwright/test';

test('главная загружается', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/./); // title не пустой
});

test('четыре поверхности открываются', async ({ page }) => {
  for (const path of ['/', '/market', '/symbols', '/economy']) {
    const response = await page.goto(path);
    expect(response?.status()).toBeLessThan(400);
  }
});