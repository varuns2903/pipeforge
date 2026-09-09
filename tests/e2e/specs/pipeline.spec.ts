import { test, expect } from '@playwright/test';
import { uniqueEmail, dragNodeFromPalette, canvasNode, connectNodes } from './helpers';

test.describe('Pipeline: build, run, and view results', () => {
  test('drag-and-drop a filter pipeline, run it, and see filtered results in history', async ({ page }) => {
    // --- Register a fresh user (each test run needs its own account) ---
    const email = uniqueEmail('e2e-pipeline');
    await page.goto('/register');
    await page.getByPlaceholder('Ada Lovelace').fill('Pipeline Tester');
    await page.getByPlaceholder('developer@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('password123');
    await page.getByRole('button', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/');

    // --- Create a project ---
    await page.getByRole('button', { name: 'New Project' }).click();
    await page.getByPlaceholder('e.g. Customer ETL Pipeline').fill('E2E Project');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('E2E Project').click();
    await expect(page).toHaveURL(/\/projects\/.+/);

    // --- Create a pipeline and open the editor ---
    await page.getByRole('button', { name: 'New Pipeline' }).click();
    await page.getByPlaceholder('e.g. Daily Data Dump').fill('E2E Filter Pipeline');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await page.getByText('E2E Filter Pipeline').click();
    await expect(page).toHaveURL(/\/pipelines\/.+/);
    await expect(page.locator('.react-flow__pane')).toBeVisible();

    // --- Build: CSV Upload (mock data) -> Filter Rows (adults only) -> Export CSV ---
    await dragNodeFromPalette(page, 'CSV Upload', { x: 450, y: 150 });

    // React Flow's fitView auto-zooms in tightly around the first node (often
    // to ~2x). Left alone, later drops at the same screen coordinates land
    // very close together in flow space and overlap. Zooming back out first
    // gives enough room for the remaining drops to land visibly apart.
    const zoomOut = page.getByRole('button', { name: 'Zoom Out' });
    for (let i = 0; i < 6; i++) await zoomOut.click();

    await dragNodeFromPalette(page, 'Filter Rows', { x: 450, y: 320 });
    await dragNodeFromPalette(page, 'Export CSV', { x: 450, y: 490 });

    await expect(canvasNode(page, 'CSV Upload')).toBeVisible();
    await expect(canvasNode(page, 'Filter Rows')).toBeVisible();
    await expect(canvasNode(page, 'Export CSV')).toBeVisible();

    await connectNodes(page, 'CSV Upload', 'Filter Rows');
    await connectNodes(page, 'Filter Rows', 'Export CSV');
    await expect(page.locator('.react-flow__edge')).toHaveCount(2);

    // Configure CSV Upload to use the engine's built-in mock dataset.
    await canvasNode(page, 'CSV Upload').click();
    await page.getByPlaceholder("/uploads/my-file.csv or 'mock'").fill('mock');

    // Configure the filter: mock data is Alice(28), Bob(17), Charlie(34), David(15).
    await canvasNode(page, 'Filter Rows').click();
    await page.getByPlaceholder('row.age > 18').fill('row.age >= 18');

    // --- Run ---
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(page.getByText('Pipeline execution completed successfully.')).toBeVisible({ timeout: 15000 });

    // --- Verify results via History ---
    await page.getByRole('button', { name: 'History' }).click();
    // Execution IDs are a 6-char Mongo ObjectId slice — distinct from the
    // longer node ids (e.g. "filter-1788973068531") shown in the config
    // panel's metadata, which also starts with "ID: " and would otherwise
    // be matched first.
    await page.locator('li').filter({ hasText: /ID: [0-9a-f]{6}/ }).first().click();
    await expect(page.getByText('Final Output Data')).toBeVisible();

    // Only Alice and Charlie are >= 18.
    await expect(page.getByRole('cell', { name: 'Alice' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Charlie' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Bob' })).not.toBeVisible();
    await expect(page.getByRole('cell', { name: 'David' })).not.toBeVisible();

    // --- Export downloads an actual .csv (the pipeline ends in csv-output) ---
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
  });
});
