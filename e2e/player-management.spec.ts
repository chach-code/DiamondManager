import { test, expect } from '@playwright/test';

test.describe('Player Management', () => {
  const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
  const BASE_PATH = BASE_URL.includes('github.io') ? '/DiamondManager' : '';

  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for team switcher (ensures we're authenticated and have a team)
    await page.waitForSelector('button:has-text("Team"), button:has-text("No Team")', { 
      timeout: 10000,
      state: 'visible'
    }).catch(() => {
      // If not authenticated, tests will handle it
    });
  });

  test('should display roster tab with empty state when no players', async ({ page }) => {
    // Navigate to roster tab if not already there
    const rosterTab = page.locator('[data-testid="tab-roster"]');
    if (await rosterTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rosterTab.click();
    }

    // Wait for content to load
    await page.waitForTimeout(1000);

    // Check for either empty state or player list
    const emptyState = page.locator('text=No Players Yet');
    const playerCards = page.locator('[data-testid^="card-player-"]');
    
    const hasPlayers = await playerCards.count() > 0;
    const isEmpty = await emptyState.isVisible({ timeout: 2000 }).catch(() => false);

    // Should show either empty state or players
    expect(hasPlayers || isEmpty).toBeTruthy();
  });

  test('should add a new player', async ({ page }) => {
    // Click "Add Player" button
    const addPlayerButton = page.locator('[data-testid="button-add-player"], button:has-text("Add Player")').first();
    
    // Wait for button to be visible (might need to wait for team to load)
    await addPlayerButton.waitFor({ state: 'visible', timeout: 10000 }).catch(() => {
      // If button not found, might be on empty state
      const addFirstPlayer = page.locator('[data-testid="button-add-first-player"]');
      return addFirstPlayer.waitFor({ state: 'visible', timeout: 5000 });
    });

    await addPlayerButton.click({ timeout: 5000 }).catch(async () => {
      // Try alternative button
      await page.locator('[data-testid="button-add-first-player"]').click({ timeout: 5000 });
    });

    // Fill in player form
    await page.waitForSelector('[data-testid="dialog-player-form"], input[id="name"]', { timeout: 5000 });
    
    const playerName = `Test Player ${Date.now()}`;
    await page.fill('input[id="name"], input[placeholder*="player name" i]', playerName);
    await page.fill('input[id="number"], input[type="number"]', '99');
    
    // Select a position
    await page.click('[data-testid^="badge-position-P"]').catch(() => {
      // If badge doesn't exist, try clicking the position directly
      return page.locator('text=P').first().click();
    });

    // Submit form
    await page.click('[data-testid="button-save"], button:has-text("Add Player"), button:has-text("Update Player")');

    // Wait for player to appear
    await expect(page.locator(`text=${playerName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should edit an existing player', async ({ page }) => {
    // First, ensure we have at least one player
    const playerCards = page.locator('[data-testid^="card-player-"]');
    const playerCount = await playerCards.count();

    if (playerCount === 0) {
      // Create a player first
      await page.locator('[data-testid="button-add-player"], button:has-text("Add Player")').first().click({ timeout: 5000 });
      await page.waitForSelector('[data-testid="dialog-player-form"]', { timeout: 5000 });
      
      await page.fill('input[id="name"]', 'Player To Edit');
      await page.fill('input[id="number"]', '50');
      await page.click('[data-testid="badge-position-P"]').catch(() => {});
      await page.click('[data-testid="button-save"]');
      await page.waitForTimeout(1000);
    }

    // Click edit on first player
    const firstPlayerCard = playerCards.first();
    const editButton = firstPlayerCard.locator('[data-testid^="button-edit-"]');
    await editButton.click({ timeout: 5000 });

    // Update the player name
    await page.waitForSelector('[data-testid="dialog-player-form"]', { timeout: 5000 });
    const nameInput = page.locator('input[id="name"]');
    await nameInput.clear();
    const updatedName = `Updated Player ${Date.now()}`;
    await nameInput.fill(updatedName);

    // Save changes
    await page.click('[data-testid="button-save"], button:has-text("Update Player")');

    // Verify the name was updated
    await expect(page.locator(`text=${updatedName}`).first()).toBeVisible({ timeout: 10000 });
  });

  test('should delete a player', async ({ page }) => {
    // Ensure we have at least one player
    const playerCards = page.locator('[data-testid^="card-player-"]');
    let playerCount = await playerCards.count();

    if (playerCount === 0) {
      // Create a player first
      await page.locator('[data-testid="button-add-player"]').first().click({ timeout: 5000 });
      await page.waitForSelector('[data-testid="dialog-player-form"]', { timeout: 5000 });
      
      await page.fill('input[id="name"]', 'Player To Delete');
      await page.fill('input[id="number"]', '88');
      await page.click('[data-testid="badge-position-C"]').catch(() => {});
      await page.click('[data-testid="button-save"]');
      await page.waitForTimeout(1000);
      playerCount = await playerCards.count();
    }

    // Accept confirmation dialog
    page.on('dialog', dialog => dialog.accept());

    // Click delete on first player
    const firstPlayerCard = playerCards.first();
    const deleteButton = firstPlayerCard.locator('[data-testid^="button-delete-"]');
    await deleteButton.click({ timeout: 5000 });

    // Wait for deletion
    await page.waitForTimeout(1000);

    // Verify player count decreased
    const newCount = await playerCards.count();
    expect(newCount).toBe(playerCount - 1);
  });

  test('should validate player form fields', async ({ page }) => {
    // Open add player dialog
    await page.locator('[data-testid="button-add-player"], button:has-text("Add Player")').first().click({ timeout: 5000 });
    await page.waitForSelector('[data-testid="dialog-player-form"]', { timeout: 5000 });

    // Try to submit without filling required fields
    const saveButton = page.locator('[data-testid="button-save"]');
    
    // Check if HTML5 validation prevents submission
    const nameInput = page.locator('input[id="name"]');
    const numberInput = page.locator('input[id="number"]');

    // HTML5 validation should prevent submission
    const nameRequired = await nameInput.getAttribute('required');
    const numberRequired = await numberInput.getAttribute('required');

    expect(nameRequired !== null || numberRequired !== null).toBeTruthy();
  });

  test('should display player information correctly', async ({ page }) => {
    // Wait for players to load
    await page.waitForTimeout(2000);
    
    const playerCards = page.locator('[data-testid^="card-player-"]');
    const count = await playerCards.count();

    if (count > 0) {
      const firstCard = playerCards.first();
      
      // Check for player name
      const nameElement = firstCard.locator('[data-testid^="text-name-"]');
      await expect(nameElement).toBeVisible();
      
      // Check for jersey number
      const numberElement = firstCard.locator('[data-testid^="text-jersey-"]');
      await expect(numberElement).toBeVisible();
      
      // Check for position badges
      const positionBadges = firstCard.locator('[data-testid^="badge-position-"]');
      const positionCount = await positionBadges.count();
      expect(positionCount).toBeGreaterThan(0);
    }
  });
});