import { test, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

test('full wizard: pick A1, drop fixture, merge, download', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'A1', exact: true }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const fixture = path.resolve('src/test/fixtures/a1_stage1.gcode');
  await page.locator('input[type=file]').setInputFiles(fixture);
  await expect(page.getByText('a1_stage1.gcode')).toBeVisible();

  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Next' }).click();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download merged/ }).click()
  ]);

  const tmp = await download.path();
  expect(tmp).toBeTruthy();
  const body = fs.readFileSync(tmp!, 'utf8');
  expect(body).toContain('EXECUTABLE_BLOCK_START');
  expect(body).toMatch(/farm portal · stage 1 detachment/);
});
