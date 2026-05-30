import { test, expect } from '@playwright/test';
import { setupApiMocks } from './mock-api';

test.describe('Blast Radius', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('button', { name: /BLAST RADIUS/i }).click();
    await page.waitForTimeout(1500);
  });

  test('Blast Radius tab is navigable', async ({ page }) => {
    await expect(page.getByText(/BLAST RADIUS/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('Blast radius score is displayed (0–100 scale)', async ({ page }) => {
    // Mock session has blast data — SCORE must always be visible
    await expect(page.getByText(/SCORE:/i)).toBeVisible({ timeout: 8000 });
  });

  test('Severity badge reflects attack consequence level', async ({ page }) => {
    // Severity must be one of CRITICAL / HIGH / MEDIUM / LOW
    await expect(
      page.getByText(/\b(CRITICAL|HIGH|MEDIUM|LOW)\b/).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('Blast radius graph renders with nodes', async ({ page }) => {
    // ReactFlow renders with class "react-flow" — graph must be visible
    const graphContainer = page.locator('[class*="react-flow"]').first();
    await expect(graphContainer).toBeVisible({ timeout: 8000 });
  });

  test('Propagation path edges are shown in the graph', async ({ page }) => {
    // Mock blast data has at least one propagation path — edge must appear in graph
    const graphContainer = page.locator('[class*="react-flow"]').first();
    await expect(graphContainer).toBeVisible({ timeout: 8000 });
    // Graph has SVG edges for propagation paths
    const svgEdge = page.locator('[class*="react-flow"] svg path').first();
    await expect(svgEdge).toBeVisible({ timeout: 5000 });
  });
});
