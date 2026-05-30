import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Campaign Mode', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /CAMPAIGNS/i }).click();
    await page.waitForTimeout(1000);
  });

  test('Campaigns tab shows OWASP campaign list', async ({ page }) => {
    await expect(page.getByText(/CAMPAIGNS|Campaigns/i).first()).toBeVisible({ timeout: 5000 });
    // Must show OWASP campaign identifiers
    await expect(page.getByText(/OAT-01|OAT-0/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('All 10 OWASP Agentic Top 10 campaigns are listed', async ({ page }) => {
    const count = await page.getByText(/OAT-/i).count();
    expect(count).toBeGreaterThanOrEqual(10);
  });

  test('Campaign card has an enabled RUN button', async ({ page }) => {
    const runBtn = page.getByRole('button', { name: /RUN|LAUNCH/i }).first();
    await expect(runBtn).toBeVisible({ timeout: 5000 });
    await expect(runBtn).toBeEnabled();
  });

  test('Clicking RUN starts the campaign and shows running state', async ({ page }) => {
    await page.getByRole('button', { name: /RUN|LAUNCH/i }).first().click();
    // Must show in-progress indicator or completion — campaign must not silently do nothing
    await expect(
      page.getByText(/RUNNING|PROGRESS|COMPLETE|started|step/i).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Campaigns show OWASP category description', async ({ page }) => {
    // Each campaign card should describe its OWASP category
    await expect(page.getByText(/OAT-01|prompt injection|Prompt Injection/i).first()).toBeVisible({ timeout: 5000 });
  });
});
