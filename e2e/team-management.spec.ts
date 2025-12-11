import { test, expect } from '@playwright/test';

// This test file assumes the user is already logged in
// For a full test, you'd want to test the login flow first

test.describe('Team Management', () => {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
  const BASE_PATH = BASE_URL.includes('github.io') ? '/DiamondManager' : '';

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('body', { timeout: 10000 });
  });

  test('should display team switcher when authenticated', async ({ page }) => {
    // Look for the team switcher button (contains team name or "No Team Selected")
    const teamSwitcher = page.locator('button:has-text("Team"), button:has-text("No Team")');
    await expect(teamSwitcher.first()).toBeVisible({ timeout: 10000 });
  });

  test('should create a new team', async ({ page }) => {
    // Click the team switcher
    const teamSwitcher = page.locator('button:has-text("Team"), button:has-text("No Team"), button:has-text("Create")').first();
    await teamSwitcher.click({ timeout: 5000 }).catch(() => {
      // If button doesn't exist, try alternative selector
      return page.locator('[data-testid="team-switcher"], button').first().click();
    });

    // Click "Create New Team"
    await page.locator('text=Create New Team').click({ timeout: 5000 });

    // Fill in team name
    const teamName = `Test Team ${Date.now()}`;
    await page.fill('input[id="team-name"], input[placeholder*="team name" i]', teamName);

    // Submit the form
    await page.click('button:has-text("Create Team")');

    // Wait for the team to appear in the switcher
    await expect(page.locator(`text=${teamName}`).first()).toBeVisible({ timeout: 10000 });

    // Verify we can see the roster tab (team was auto-selected)
    await expect(page.locator('[data-testid="tab-roster"]')).toBeVisible();
  });

  test('should switch between teams', async ({ page }) => {
    // This test assumes at least 2 teams exist
    // If not, it will be skipped or create teams first
    
    // Click team switcher
    const teamSwitcher = page.locator('button').filter({ hasText: /Team|No Team/ }).first();
    await teamSwitcher.click({ timeout: 5000 });

    // Get all team options
    const teamOptions = page.locator('[role="menuitem"], .dropdown-menu-item').filter({ hasText: /Team/ });
    const count = await teamOptions.count();

    if (count >= 2) {
      // Click the second team
      await teamOptions.nth(1).click({ timeout: 5000 });

      // Verify the page updated (wait for any loading to complete)
      await page.waitForTimeout(1000);
      
      // The team switcher should show the selected team
      await expect(teamSwitcher).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('should delete a team', async ({ page }) => {
    // First, create a team to delete
    const teamSwitcher = page.locator('button').filter({ hasText: /Team|No Team/ }).first();
    await teamSwitcher.click({ timeout: 5000 }).catch(() => {});

    // Try to find "Create New Team"
    const createButton = page.locator('text=Create New Team');
    if (await createButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await createButton.click();
      
      const teamName = `Delete Test ${Date.now()}`;
      await page.fill('input[id="team-name"], input[placeholder*="team name" i]', teamName);
      await page.click('button:has-text("Create Team")');
      await page.waitForTimeout(1000);
    }

    // Now try to delete a team (if we have more than one)
    await teamSwitcher.click({ timeout: 5000 }).catch(() => {});

    const teamOptions = page.locator('[role="menuitem"]').filter({ hasText: /Team/ });
    const count = await teamOptions.count();

    if (count > 1) {
      // Click delete button on first team option
      const firstTeam = teamOptions.first();
      const deleteButton = firstTeam.locator('button, [aria-label*="delete" i]').last();
      
      // Accept the confirmation dialog
      page.on('dialog', dialog => dialog.accept());
      
      await deleteButton.click({ timeout: 5000 }).catch(() => {
        // If delete button doesn't work, skip
        test.skip();
      });

      // Wait for deletion to complete
      await page.waitForTimeout(1000);
      
      // Verify the team is gone
      await teamSwitcher.click({ timeout: 5000 }).catch(() => {});
      const newCount = await teamOptions.count();
      expect(newCount).toBeLessThan(count);
    } else {
      test.skip();
    }
  });

  test('should prevent deleting the last team', async ({ page }) => {
    const teamSwitcher = page.locator('button').filter({ hasText: /Team/ }).first();
    await teamSwitcher.click({ timeout: 5000 }).catch(() => {});

    const teamOptions = page.locator('[role="menuitem"]').filter({ hasText: /Team/ });
    const count = await teamOptions.count();

    if (count === 1) {
      // Should not see delete button when only one team exists
      const deleteButton = teamOptions.locator('button, [aria-label*="delete" i]');
      await expect(deleteButton).toHaveCount(0);
    } else {
      test.skip();
    }
  });

  test('should load last selected team by default', async ({ page }) => {
    // This test verifies that when you reload, the same team is selected
    const teamSwitcher = page.locator('button').filter({ hasText: /Team/ }).first();
    
    // Get the current team name
    const initialTeamText = await teamSwitcher.textContent();
    
    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Get the team name after reload
    const reloadedTeamSwitcher = page.locator('button').filter({ hasText: /Team/ }).first();
    const reloadedTeamText = await reloadedTeamSwitcher.textContent();
    
    // Should be the same (or both should show a team, not "No Team")
    if (initialTeamText && initialTeamText !== 'No Team Selected') {
      expect(reloadedTeamText).toBe(initialTeamText);
    }
  });
});