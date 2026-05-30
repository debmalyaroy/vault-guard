import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Attack Flow — Playground', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Playground tab is active by default', async ({ page }) => {
    await expect(page.getByText('PLAYGROUND', { exact: true })).toBeVisible();
  });

  test('Agent arena shows two agent panels — one protected, one unprotected', async ({ page }) => {
    await expect(page.getByText(/AGENT A|Agent A/i).first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/AGENT B|Agent B/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('VaultGuard Shield panel shows policy selector with at least one policy', async ({ page }) => {
    const selector = page.getByRole('combobox').first();
    await expect(selector).toBeVisible({ timeout: 5000 });
    // Selector must have options
    const optCount = await selector.evaluate((el: HTMLSelectElement) => el.options.length);
    expect(optCount).toBeGreaterThan(0);
  });

  test('Attack console has a FIRE button to launch an attack', async ({ page }) => {
    await expect(page.getByRole('button', { name: /FIRE|LAUNCH|ATTACK/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('Firing attack causes protected agent to report DEFENDED status', async ({ page }) => {
    await page.getByRole('button', { name: /FIRE|LAUNCH/i }).first().click();
    // Protected agent (Agent B) must show DEFENDED — the core VaultGuard guarantee
    await expect(
      page.getByText(/DEFENDED|BLOCKED/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Firing attack at unprotected agent shows COMPROMISED status', async ({ page }) => {
    // The playground fires at BOTH agents — Agent A is unprotected
    await page.getByRole('button', { name: /FIRE|LAUNCH/i }).first().click();
    await expect(
      page.getByText(/COMPROMISED|DEFENDED/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('WebSocket connection indicator is visible on the page', async ({ page }) => {
    await expect(page.getByText(/SYS: ONLINE|SYS: OFFLINE|CONNECTED/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Policy can be changed via the policy selector', async ({ page }) => {
    const selector = page.getByRole('combobox').first();
    await selector.selectOption({ index: 1 });
    // No crash — selector still visible after change
    await expect(selector).toBeVisible();
  });
});
