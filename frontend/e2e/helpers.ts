import { type Page } from '@playwright/test';

const API_BASE = 'http://localhost:8080';

export async function createSession(page: Page): Promise<string> {
  const res = await page.request.post(`${API_BASE}/api/session`);
  if (res.ok()) {
    const data = await res.json();
    return data.session_id ?? data.id ?? `vg-${Date.now().toString(36)}`;
  }
  return `vg-${Date.now().toString(36)}`;
}

export async function navigateToTab(page: Page, tabLabel: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(tabLabel, 'i') }).click();
  await page.waitForTimeout(300);
}
