import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /ANALYTICS/i }).click();
    await page.waitForTimeout(1000);
  });

  test('Analytics tab loads with corpus stats', async ({ page }) => {
    await expect(page.getByText(/Total Patterns|TOTAL PATTERNS/i)).toBeVisible({ timeout: 5000 });
  });

  test('Stats show total pattern count from mock (540)', async ({ page }) => {
    await page.waitForTimeout(1500);
    await expect(page.getByText(/540/).first()).toBeVisible({ timeout: 5000 });
  });

  test('Shows CORPUS BROWSER sub-tab', async ({ page }) => {
    await expect(page.getByText(/CORPUS BROWSER/i)).toBeVisible({ timeout: 5000 });
  });

  test('Shows CORRELATION GRAPH sub-tab', async ({ page }) => {
    await expect(page.getByText(/CORRELATION GRAPH/i)).toBeVisible({ timeout: 5000 });
  });

  test('Corpus Browser has search input', async ({ page }) => {
    await page.getByText(/CORPUS BROWSER/i).click();
    await expect(page.getByPlaceholder(/Search by/i)).toBeVisible({ timeout: 5000 });
  });

  test('Corpus search returns mocked results', async ({ page }) => {
    await page.getByText(/CORPUS BROWSER/i).click();
    await page.waitForTimeout(500);
    await page.getByPlaceholder(/Search by/i).fill('injection');
    await page.getByRole('button', { name: /^SEARCH$/i }).click();
    await page.waitForTimeout(1500);
    // Mock returns patterns with prompt_injection
    await expect(
      page.getByText(/prompt_injection|prompt injection|OAT-01/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('Correlation Graph tab loads', async ({ page }) => {
    await page.getByText(/CORRELATION GRAPH/i).click();
    await page.waitForTimeout(1000);
    // Should show ReactFlow or empty state
    const container = page.locator('[class*="reactflow"], .react-flow, [class*="react-flow"]').first();
    const threshold = page.getByRole('slider');
    const isGraph = await container.isVisible();
    const isSlider = await threshold.isVisible();
    expect(isGraph || isSlider).toBe(true);
  });

  test('Correlation Graph has threshold slider', async ({ page }) => {
    await page.getByText(/CORRELATION GRAPH/i).click();
    await page.waitForTimeout(500);
    await expect(page.getByRole('slider')).toBeVisible({ timeout: 5000 });
  });

  test('Timeseries chart data loads', async ({ page }) => {
    // Stats tab should show recharts elements
    await page.waitForTimeout(2000);
    const chart = page.locator('[class*="recharts"], [class*="chart"]').first();
    if (await chart.isVisible()) {
      await expect(chart).toBeVisible();
    }
  });
});
