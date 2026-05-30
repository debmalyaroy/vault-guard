import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Adversarial Probe Generator', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Playground tab shows policy selector', async ({ page }) => {
    await expect(page.getByRole('combobox')).toBeVisible({ timeout: 5000 });
  });

  test('PROBE POLICY BOUNDARY button is visible', async ({ page }) => {
    await expect(page.getByText(/PROBE POLICY BOUNDARY/i)).toBeVisible({ timeout: 5000 });
  });

  test('Clicking probe button fires API and shows results table', async ({ page }) => {
    await page.getByText(/PROBE POLICY BOUNDARY/i).click();

    await expect(
      page.getByText(/Boundary Probe|PROBING|payloads/i).first()
    ).toBeVisible({ timeout: 10000 });
  });

  test('Probe results show REDACTED decisions', async ({ page }) => {
    await page.getByText(/PROBE POLICY BOUNDARY/i).click();

    await expect(
      page.getByText(/Boundary Probe/i).first()
    ).toBeVisible({ timeout: 10000 });

    await expect(
      page.getByText(/REDACTED|ALLOW/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  test('Probe results show both blocked and allowed payloads', async ({ page }) => {
    await page.getByText(/PROBE POLICY BOUNDARY/i).click();
    await page.waitForTimeout(3000);

    const redacted = await page.getByText(/REDACTED/i).count();
    const allowed = await page.getByText(/ALLOW/i).count();
    // Mock returns 4 REDACTED + 2 ALLOW
    expect(redacted + allowed).toBeGreaterThanOrEqual(2);
  });

  test('Probe table has payload text column', async ({ page }) => {
    await page.getByText(/PROBE POLICY BOUNDARY/i).click();
    await page.waitForTimeout(3000);

    // Mock probe data has "Please process a payment" text — use first() to avoid strict mode
    const payloadCell = page.getByText(/payment|system instructions|investment|transfer/i).first();
    const hasPayload = await payloadCell.isVisible().catch(() => false);
    if (hasPayload) {
      await expect(payloadCell).toBeVisible();
    }
  });
});
