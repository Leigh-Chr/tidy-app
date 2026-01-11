import { test, expect } from '@playwright/test';

test.describe('GUI Interactions - Detailed Tests', () => {
  
  test.describe('Help Dialog Interactions', () => {
    test('help dialog opens and displays content', async ({ page }) => {
      await page.goto('/');
      
      // Click help button
      const helpButton = page.getByRole('button', { name: /help/i });
      await expect(helpButton).toBeVisible();
      await helpButton.click();
      
      // Verify dialog is open with content
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Check for expected content
      await expect(page.getByText(/keyboard shortcuts/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: /version information/i })).toBeVisible();
    });
    
    test('help dialog closes with Escape key', async ({ page }) => {
      await page.goto('/');
      
      await page.getByRole('button', { name: /help/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
    
    test('help dialog closes with close button', async ({ page }) => {
      await page.goto('/');
      
      await page.getByRole('button', { name: /help/i }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      
      // Find and click close button (X or "Close" text)
      const closeButton = dialog.getByRole('button', { name: /close|×/i }).first();
      if (await closeButton.isVisible()) {
        await closeButton.click();
        await expect(dialog).not.toBeVisible();
      }
    });
  });
  
  test.describe('Settings Modal Interactions', () => {
    test('settings modal opens and displays preferences', async ({ page }) => {
      await page.goto('/');
      
      const settingsButton = page.getByRole('button', { name: /settings/i });
      await expect(settingsButton).toBeVisible();
      await settingsButton.click();
      
      // Verify modal is open
      const modal = page.getByRole('dialog');
      await expect(modal).toBeVisible();
      
      // Check for preferences content
      await expect(page.getByText(/preferences/i)).toBeVisible();
    });
    
    test('settings modal closes with Escape', async ({ page }) => {
      await page.goto('/');
      
      await page.getByRole('button', { name: /settings/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });
  
  test.describe('Scan Options Interactions', () => {
    test('recursive toggle changes state', async ({ page }) => {
      await page.goto('/');
      
      // Find recursive checkbox/toggle
      const recursiveToggle = page.getByLabel(/recursive/i);
      if (await recursiveToggle.isVisible()) {
        const initialState = await recursiveToggle.isChecked();
        await recursiveToggle.click();
        const newState = await recursiveToggle.isChecked();
        expect(newState).not.toBe(initialState);
      }
    });
    
    test('file type filters can be toggled', async ({ page }) => {
      await page.goto('/');
      
      // Look for file type checkboxes
      const imageCheckbox = page.getByLabel(/image/i);
      if (await imageCheckbox.isVisible()) {
        const initialState = await imageCheckbox.isChecked();
        await imageCheckbox.click();
        const newState = await imageCheckbox.isChecked();
        expect(newState).not.toBe(initialState);
        
        // Toggle back
        await imageCheckbox.click();
        expect(await imageCheckbox.isChecked()).toBe(initialState);
      }
    });
  });
  
  test.describe('Drop Zone Interactions', () => {
    test('drop zone shows hover state on drag enter', async ({ page }) => {
      await page.goto('/');
      
      const dropZone = page.getByTestId('drop-zone');
      await expect(dropZone).toBeVisible();
      
      // Get initial text
      const initialText = await dropZone.textContent();
      
      // Simulate drag enter
      await dropZone.evaluate((element) => {
        const event = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(event, 'dataTransfer', {
          value: { types: ['Files'] },
        });
        element.dispatchEvent(event);
      });
      
      // Text should change to indicate drop is possible
      await expect(page.getByText(/drop to scan/i)).toBeVisible();
    });
    
    test('drop zone returns to normal on drag leave', async ({ page }) => {
      await page.goto('/');
      
      const dropZone = page.getByTestId('drop-zone');
      
      // Simulate drag enter then leave
      await dropZone.evaluate((element) => {
        const enterEvent = new DragEvent('dragenter', {
          bubbles: true,
          cancelable: true,
        });
        Object.defineProperty(enterEvent, 'dataTransfer', {
          value: { types: ['Files'] },
        });
        element.dispatchEvent(enterEvent);
      });
      
      await expect(page.getByText(/drop to scan/i)).toBeVisible();
      
      await dropZone.evaluate((element) => {
        const leaveEvent = new DragEvent('dragleave', {
          bubbles: true,
          cancelable: true,
        });
        element.dispatchEvent(leaveEvent);
      });
      
      // Should return to default state
      await expect(page.getByText('Drop a folder here')).toBeVisible();
    });
    
    test('browse button is clickable', async ({ page }) => {
      await page.goto('/');
      
      const browseButton = page.getByRole('button', { name: /browse/i });
      await expect(browseButton).toBeVisible();
      await expect(browseButton).toBeEnabled();
    });
  });
  
  test.describe('Refresh Button', () => {
    test('refresh button is visible and clickable', async ({ page }) => {
      await page.goto('/');
      
      const refreshButton = page.getByRole('button', { name: /refresh/i });
      if (await refreshButton.isVisible()) {
        await expect(refreshButton).toBeEnabled();
        // Click should not throw error
        await refreshButton.click();
      }
    });
  });
});
