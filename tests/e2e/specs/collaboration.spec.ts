import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

async function registerUser(page: import('@playwright/test').Page, name: string, email: string) {
  await page.goto('/register');
  await page.getByPlaceholder('Ada Lovelace').fill(name);
  await page.getByPlaceholder('developer@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill('password123');
  await page.getByRole('button', { name: 'Sign up' }).click();
  await expect(page).toHaveURL('/');
}

test.describe('Team collaboration', () => {
  test('owner invites an editor, who can see and create pipelines in the shared project', async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const editorCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const editorPage = await editorCtx.newPage();

    const editorEmail = uniqueEmail('e2e-collab-editor');
    await registerUser(editorPage, 'Editor Teammate', editorEmail);

    await registerUser(ownerPage, 'Project Owner', uniqueEmail('e2e-collab-owner'));
    await ownerPage.getByRole('button', { name: 'New Project' }).click();
    await ownerPage.getByPlaceholder('e.g. Customer ETL Pipeline').fill('E2E Collab Project');
    await ownerPage.getByRole('button', { name: 'Create', exact: true }).click();
    await ownerPage.getByText('E2E Collab Project').click();
    await expect(ownerPage).toHaveURL(/\/projects\/.+/);

    // --- Owner invites the editor by email ---
    await ownerPage.getByRole('button', { name: 'Members' }).click();
    await ownerPage.getByPlaceholder('teammate@example.com').fill(editorEmail);
    await ownerPage.getByRole('button', { name: 'Invite' }).click();
    await expect(ownerPage.getByText('Editor Teammate')).toBeVisible();

    // --- The editor now sees the shared project on their own dashboard ---
    await editorPage.goto('/');
    await editorPage.getByText('E2E Collab Project').click();
    await expect(editorPage).toHaveURL(/\/projects\/.+/);
    // Non-owner role badge next to the project name in the header.
    await expect(editorPage.getByText('editor', { exact: true })).toBeVisible();

    // --- The editor creates a pipeline in the shared project ---
    await editorPage.getByRole('button', { name: 'New Pipeline' }).click();
    await editorPage.getByPlaceholder('e.g. Daily Data Dump').fill('Editor-created Pipeline');
    await editorPage.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(editorPage.getByText('Editor-created Pipeline')).toBeVisible();

    // --- The owner sees the editor's pipeline too, without reloading state from scratch ---
    await ownerPage.reload();
    await expect(ownerPage.getByText('Editor-created Pipeline')).toBeVisible();

    await ownerCtx.close();
    await editorCtx.close();
  });

  test('a viewer can see a shared project but cannot create pipelines or see project management controls', async ({ browser }) => {
    const ownerCtx = await browser.newContext();
    const viewerCtx = await browser.newContext();
    const ownerPage = await ownerCtx.newPage();
    const viewerPage = await viewerCtx.newPage();

    const viewerEmail = uniqueEmail('e2e-collab-viewer');
    await registerUser(viewerPage, 'Viewer Teammate', viewerEmail);

    await registerUser(ownerPage, 'Project Owner', uniqueEmail('e2e-collab-owner2'));
    await ownerPage.getByRole('button', { name: 'New Project' }).click();
    await ownerPage.getByPlaceholder('e.g. Customer ETL Pipeline').fill('E2E Viewer Project');
    await ownerPage.getByRole('button', { name: 'Create', exact: true }).click();
    await ownerPage.getByText('E2E Viewer Project').click();

    await ownerPage.getByRole('button', { name: 'Members' }).click();
    await ownerPage.getByPlaceholder('teammate@example.com').fill(viewerEmail);
    await ownerPage.getByRole('combobox').selectOption('viewer');
    await ownerPage.getByRole('button', { name: 'Invite' }).click();
    await expect(ownerPage.getByText('Viewer Teammate')).toBeVisible();

    await viewerPage.goto('/');
    await viewerPage.getByText('E2E Viewer Project').click();
    await expect(viewerPage).toHaveURL(/\/projects\/.+/);

    // A viewer gets no "New Pipeline" button and no "Trash" (owner-only) button.
    await expect(viewerPage.getByRole('button', { name: 'New Pipeline' })).toHaveCount(0);
    await expect(viewerPage.getByRole('button', { name: 'Trash' })).toHaveCount(0);
    // Members is still visible (any role can view the member list).
    await expect(viewerPage.getByRole('button', { name: 'Members' })).toBeVisible();

    await ownerCtx.close();
    await viewerCtx.close();
  });
});
