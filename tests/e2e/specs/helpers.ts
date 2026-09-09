import { type Page, type Locator } from '@playwright/test';

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Drags a node from the NodePalette onto the React Flow canvas.
 *
 * The palette uses native HTML5 drag-and-drop (dataTransfer.setData /
 * getData), which Playwright's locator.dragTo() does not reliably trigger
 * because it simulates mouse events rather than real DragEvents. This
 * dispatches real dragstart/dragover/drop events sharing one DataTransfer
 * object, which is the approach Playwright's own docs recommend for native
 * HTML5 DnD: https://playwright.dev/docs/input#drag-and-drop
 */
export async function dragNodeFromPalette(
  page: Page,
  paletteLabel: string,
  dropPoint: { x: number; y: number }
): Promise<void> {
  // Scoped to the palette sidebar — once a node is dropped, the canvas node
  // carries the same label text, which would otherwise make this ambiguous.
  const source = page.getByRole('complementary').getByText(paletteLabel, { exact: true });
  const canvas = page.locator('.react-flow__pane');

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());

  await source.dispatchEvent('dragstart', { dataTransfer });
  await canvas.dispatchEvent('dragenter', { dataTransfer });
  await canvas.dispatchEvent('dragover', {
    dataTransfer,
    clientX: dropPoint.x,
    clientY: dropPoint.y,
  });
  await canvas.dispatchEvent('drop', {
    dataTransfer,
    clientX: dropPoint.x,
    clientY: dropPoint.y,
  });
  await source.dispatchEvent('dragend', { dataTransfer });
}

/** The React Flow node whose visible label matches `label`. */
export function canvasNode(page: Page, label: string): Locator {
  return page.locator('.react-flow__node').filter({ hasText: label });
}

/** Drags a connection from one node's output handle to another's input handle. */
export async function connectNodes(page: Page, fromLabel: string, toLabel: string): Promise<void> {
  const fromHandle = canvasNode(page, fromLabel).locator('.react-flow__handle-right, .react-flow__handle-bottom').first();
  const toHandle = canvasNode(page, toLabel).locator('.react-flow__handle-left, .react-flow__handle-top').first();
  await fromHandle.dragTo(toHandle);
}
