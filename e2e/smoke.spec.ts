import { test, expect } from '@playwright/test';

// Smoke test: the app boots and shows the unauthenticated login screen.
// This needs only the web dev server (no backend), so it is safe to run in CI.
test('login screen renders', async ({ page }) => {
  await page.goto('/');

  // Brand heading
  await expect(page.getByRole('heading', { name: 'FitPick' })).toBeVisible();

  // Email + password inputs and the primary CTA
  await expect(page.getByPlaceholder('Email Address')).toBeVisible();
  await expect(page.getByPlaceholder('Password')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
});

test('can switch to the create-account view', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Need an account/i }).click();
  await expect(page.getByRole('heading', { name: 'Create Account' })).toBeVisible();
});
