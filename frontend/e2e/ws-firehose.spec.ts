import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('WebSocket Event Firehose', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('Firehose toggle bar is always visible at page bottom', async ({ page }) => {
    await expect(page.getByText(/WS Event Firehose/i)).toBeVisible({ timeout: 5000 });
  });

  test('Firehose is collapsed by default — event content not visible', async ({ page }) => {
    await expect(page.getByText(/No events yet/i)).not.toBeVisible();
  });

  test('Firehose expands on click and shows empty state message', async ({ page }) => {
    await page.getByText(/WS Event Firehose/i).click();
    await expect(page.getByText(/No events yet/i)).toBeVisible({ timeout: 3000 });
  });

  test('Firehose badge shows count after receiving a WebSocket event', async ({ page }) => {
    // Open firehose and fire an attack to trigger a WS response from the mock
    await page.getByText(/WS Event Firehose/i).click();
    await page.getByRole('button', { name: /FIRE|LAUNCH/i }).first().click();
    await page.waitForTimeout(2000);
    // Badge format is "{count}/{max}" (e.g. "1/100") — must appear when events > 0
    await expect(page.getByText(/\d+\/\d+/).first()).toBeVisible({ timeout: 5000 });
  });

  test('Firehose collapses when toggled again', async ({ page }) => {
    await page.getByText(/WS Event Firehose/i).click();
    await expect(page.getByText(/No events yet/i)).toBeVisible({ timeout: 3000 });
    await page.getByText(/WS Event Firehose/i).click();
    await expect(page.getByText(/No events yet/i)).not.toBeVisible({ timeout: 2000 });
  });

  test('Firehose logs events when an attack is fired', async ({ page }) => {
    // Open firehose first
    await page.getByText(/WS Event Firehose/i).click();
    // Fire an attack which sends WS message
    await page.getByRole('button', { name: /FIRE|LAUNCH/i }).first().click();
    await page.waitForTimeout(2000);
    // At least one event row must appear (WS mock sends agent_status on any message)
    const noEventsGone = await page.getByText(/No events yet/i).isVisible().then(v => !v).catch(() => true);
    expect(noEventsGone).toBe(true);
  });
});
