import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

test.describe('Pipeline webhook configuration', () => {
  test('set a webhook, see its signing secret, regenerate it, then remove it', async ({ page }) => {
    const email = uniqueEmail('e2e-webhook');
    await page.goto('/register');
    await page.getByPlaceholder('Ada Lovelace').fill('Webhook Tester');
    await page.getByPlaceholder('developer@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/');

    await page.getByRole('button', { name: 'New Project' }).click();
    await page.getByPlaceholder('e.g. Customer ETL Pipeline').fill('E2E Webhook Project');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('E2E Webhook Project').click();

    await page.getByRole('button', { name: 'New Pipeline' }).click();
    await page.getByPlaceholder('e.g. Daily Data Dump').fill('E2E Webhook Pipeline');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('E2E Webhook Pipeline').click();
    await expect(page).toHaveURL(/\/pipelines\/.+/);

    // --- Set a webhook ---
    await page.getByRole('button', { name: 'Webhook' }).click();
    await page.getByPlaceholder('https://your-server.example.com/webhooks/pipeforge').fill('https://example.com/hooks/pipeforge-e2e');
    await page.getByRole('button', { name: 'Save Webhook' }).click();

    // A signing secret is generated and shown back once the webhook is saved.
    const secretBox = page.locator('code');
    await expect(secretBox).toBeVisible();
    const firstSecret = await secretBox.textContent();
    expect(firstSecret).toMatch(/^[0-9a-f]{48}$/); // 24 random bytes, hex-encoded

    // --- Regenerating changes the secret but keeps the URL ---
    await page.getByTitle('Regenerate secret').click();
    await expect(async () => {
      const newSecret = await secretBox.textContent();
      expect(newSecret).not.toBe(firstSecret);
      expect(newSecret).toMatch(/^[0-9a-f]{48}$/);
    }).toPass();

    // --- Remove the webhook (still in the same open modal) ---
    await page.getByRole('button', { name: 'Remove webhook' }).click();
    // Removing closes the modal (see WebhookModal's remove mutation) — reopen
    // it to confirm the webhook is genuinely gone, not just visually cleared.
    await expect(page.getByPlaceholder('https://your-server.example.com/webhooks/pipeforge')).toHaveCount(0);
    await page.getByRole('button', { name: 'Webhook' }).click();
    await expect(page.getByPlaceholder('https://your-server.example.com/webhooks/pipeforge')).toHaveValue('');
    await expect(page.locator('code')).toHaveCount(0);
  });
});
