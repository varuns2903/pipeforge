import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

// Stops at the redirect boundary rather than completing a real Stripe
// Checkout payment — this repo's Stripe account requires India-specific
// recurring-payment authentication (see the billing feature's commit
// message) that a generic test card can't satisfy non-interactively, so a
// full purchase flow isn't something to assert on in an automated suite.
// The webhook-driven plan sync itself is covered by apps/api's own test
// suite (signed-event tests, no network dependency).
test.describe('Billing', () => {
  test('shows Free/Pro plans and redirects to a real Stripe Checkout session on upgrade', async ({ page }) => {
    const email = uniqueEmail('e2e-billing');
    await page.goto('/register');
    await page.getByPlaceholder('Ada Lovelace').fill('Billing Tester');
    await page.getByPlaceholder('developer@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/billing');
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Free' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Pro' })).toBeVisible();
    await expect(page.getByText('Current plan')).toBeVisible(); // Free, for a brand-new account
    await expect(page.getByText('5,000 MB storage')).toBeVisible();
    await expect(page.getByText('25 concurrent executions')).toBeVisible();

    // Clicking Upgrade creates a real Checkout session and redirects there —
    // confirms the frontend->backend->Stripe wiring end to end without
    // needing to fill out a card.
    await page.getByRole('button', { name: 'Upgrade to Pro' }).click();
    await page.waitForURL(/^https:\/\/checkout\.stripe\.com\//, { timeout: 15000 });
    await expect(page.getByText('PipeForge Pro')).toBeVisible();
  });
});
