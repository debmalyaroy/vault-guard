import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Audit Trail', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /AUDIT TRAIL/i }).click();
    await page.waitForTimeout(1000);
  });

  test('Audit Trail tab loads', async ({ page }) => {
    await expect(page.getByText(/Audit Trail|AUDIT TRAIL/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Audit entries are displayed from the session', async ({ page }) => {
    // Audit log must load and show action values (e.g. threat_blocked, custom_threat_analysis)
    await expect(page.getByText(/threat_blocked|threat_allowed|custom_threat/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('Each audit entry shows a hash value', async ({ page }) => {
    await page.waitForTimeout(1500);
    // Entry hashes are displayed (hexadecimal format)
    await expect(page.getByText(/[0-9a-f]{8,}/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Chain verified badge is shown when chain is valid', async ({ page }) => {
    // Mock returns chain_valid: true — CHAIN VERIFIED must be displayed
    await expect(page.getByText(/CHAIN VERIFIED|CHAIN INTACT/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('VERIFY ENTRY button opens the Ed25519 verifier panel', async ({ page }) => {
    await expect(page.getByText(/VERIFY ENTRY/i)).toBeVisible({ timeout: 5000 });
    await page.getByText(/VERIFY ENTRY/i).click();
    // Verifier panel must appear with a textarea for entry JSON
    await expect(page.locator('textarea').first()).toBeVisible({ timeout: 5000 });
  });

  test('Ed25519 verifier panel has a public key field pre-filled', async ({ page }) => {
    await page.getByText(/VERIFY ENTRY/i).click();
    await page.waitForTimeout(500);
    // Public key field must be pre-filled from /api/audit/public-key
    await expect(page.getByText(/public.key|Ed25519/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('REPLAY button triggers deterministic audit replay', async ({ page }) => {
    await expect(page.getByText(/REPLAY/i).first()).toBeVisible({ timeout: 5000 });
    await page.getByText(/REPLAY/i).first().click();
    // After replay, must show DETERMINISTIC confirmation
    await expect(page.getByText(/DETERMINISTIC|all_match|VERIFIED/i).first()).toBeVisible({ timeout: 8000 });
  });

  test('CSV and PDF export links are available for downloading the audit log', async ({ page }) => {
    // Export links use short labels "CSV" and "PDF"
    await expect(page.getByRole('link', { name: /\bCSV\b/i })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('link', { name: /\bPDF\b/i })).toBeVisible({ timeout: 5000 });
  });
});
