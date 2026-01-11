import { test, expect } from '@playwright/test';

test.describe('Console Error Checks', () => {
  test('no console errors on page load', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
    
    await page.goto('/');
    await page.waitForTimeout(2000);
    
    console.log('Console Errors:', consoleErrors.length ? consoleErrors : 'None');
    console.log('Console Warnings:', consoleWarnings.length ? consoleWarnings : 'None');
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('no console errors during interactions', async ({ page }) => {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      consoleErrors.push(error.message);
    });
    
    await page.goto('/');
    
    // Click help button
    const helpButton = page.getByRole('button', { name: /help/i });
    if (await helpButton.isVisible()) {
      await helpButton.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Click settings button  
    const settingsButton = page.getByRole('button', { name: /settings/i });
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
    
    // Try drag and drop simulation
    const dropZone = page.getByTestId('drop-zone');
    if (await dropZone.isVisible()) {
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
      await page.waitForTimeout(500);
    }
    
    console.log('Console Errors during interactions:', consoleErrors.length ? consoleErrors : 'None');
    expect(consoleErrors).toHaveLength(0);
  });
});
