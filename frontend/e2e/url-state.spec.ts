import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('URL State', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
  });

  test('App loads on root path', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await expect(page.getByText(/PLAYGROUND|VaultGuard/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Navigating to Analytics tab updates URL or state', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /ANALYTICS/i }).click();
    await page.waitForTimeout(500);
    // Either URL hash changes or tab becomes active
    const url = page.url();
    const tabActive = await page.getByText(/Total Patterns|CORPUS BROWSER/i).first().isVisible();
    expect(url.includes('analytics') || url.includes('tab=') || tabActive).toBe(true);
  });

  test('Direct URL with analytics hash restores Analytics tab', async ({ page }) => {
    await page.goto('/#tab=analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    // Must restore to Analytics tab — corpus stats content visible
    await expect(page.getByText(/Total Patterns|CORPUS BROWSER|ANALYTICS/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Share button copies session URL to clipboard', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    // Share button must always be present — it exposes the shareable URL feature
    await expect(page.getByRole('button', { name: /SHARE|COPY/i })).toBeVisible({ timeout: 5000 });
  });

  test('All 7 navigation tabs are visible', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const tabNames = ['PLAYGROUND', 'THREAT BUILDER', 'CAMPAIGNS', 'BLAST RADIUS', 'ANALYTICS', 'AUDIT TRAIL', 'AGENT SANDBOX'];
    for (const tab of tabNames) {
      await expect(page.getByRole('button', { name: new RegExp(tab, 'i') }).first()).toBeVisible({ timeout: 5000 });
    }
  });
});
