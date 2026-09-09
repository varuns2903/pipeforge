import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

test.describe('Authentication', () => {
  test('register, land on dashboard, logout, then log back in', async ({ page }) => {
    const email = uniqueEmail('e2e-auth');

    await page.goto('/register');
    await page.getByPlaceholder('Ada Lovelace').fill('E2E Test User');
    await page.getByPlaceholder('developer@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: 'Sign up' }).click();

    // Registration redirects to the dashboard once the httpOnly cookie is set.
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();

    // Logout clears the cookie server-side and drops us back at /login.
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL('/login');

    // Log back in with the same credentials.
    await page.getByPlaceholder('developer@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
  });

  test('shows an error for invalid login credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByPlaceholder('developer@example.com').fill(uniqueEmail('nobody'));
    await page.getByPlaceholder('••••••••').fill('wrongpassword123');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('redirects an unauthenticated visitor away from a protected route', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
