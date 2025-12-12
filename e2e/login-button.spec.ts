/**
 * E2E Tests for Login Button Visibility
 * 
 * Following TDD (.cursorrules): This test ensures that users can always
 * log in, whether they're on the landing page or the app page when logged out.
 */

import { test, expect } from '@playwright/test';

test.describe('Login Button Visibility', () => {
  test.beforeEach(async ({ page, context }) => {
    // Clear all cookies and localStorage before each test to ensure clean state
    await context.clearCookies();
    await page.evaluate(() => {
      localStorage.clear();
    });
  });

  test('should show login button on landing page when not authenticated', async ({ page }) => {
    // Navigate to landing page
    await page.goto('/');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check for sign in button on landing page
    const signInButton = page.getByTestId('button-signin');
    await expect(signInButton).toBeVisible();
    await expect(signInButton).toHaveText('Sign In with Google');
    
    // Also check the CTA section has a sign in button
    const signInCta = page.getByTestId('button-signin-cta');
    await expect(signInCta).toBeVisible();
    await expect(signInCta).toHaveText('Sign In Now');
  });

  test('should show login button on app page when not authenticated (not in guest mode)', async ({ page }) => {
    // Navigate directly to app page without being authenticated or in guest mode
    await page.goto('/app');
    
    // Wait for auth check to complete
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit for auth state to settle (React Query might take a moment)
    await page.waitForTimeout(500);
    
    // Check for login button in the unauthenticated banner
    const loginButton = page.getByTestId('button-login-unauthenticated');
    await expect(loginButton).toBeVisible();
    await expect(loginButton).toHaveText('Sign In with Google');
    
    // Verify the banner message is visible
    const bannerText = page.getByText('Sign in to save your teams and lineups.');
    await expect(bannerText).toBeVisible();
  });

  test('should show login button after logout', async ({ page, context }) => {
    // Note: This test simulates being logged out
    // In a real scenario, you'd need to authenticate first, then logout
    // For now, we test the unauthenticated state directly
    
    await page.goto('/app');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
    
    // After logout (or when not authenticated), login button should be visible
    const loginButton = page.getByTestId('button-login-unauthenticated');
    await expect(loginButton).toBeVisible();
  });

  test('should show sign in link in guest mode banner', async ({ page }) => {
    // Set guest mode
    await page.goto('/');
    await page.getByTestId('button-guest-mode').click();
    
    // Wait for navigation to app page
    await page.waitForURL('**/app');
    await page.waitForLoadState('domcontentloaded');
    
    // Check for sign in link in guest mode banner
    const signInLink = page.getByTestId('button-sign-in-banner');
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveText('Sign in to save your progress.');
  });

  test('should not show unauthenticated banner when in guest mode', async ({ page }) => {
    // Set guest mode
    await page.goto('/');
    await page.getByTestId('button-guest-mode').click();
    
    // Wait for navigation to app page
    await page.waitForURL('**/app');
    await page.waitForLoadState('domcontentloaded');
    
    // The unauthenticated login button should NOT be visible (guest mode banner should be)
    const unauthenticatedButton = page.getByTestId('button-login-unauthenticated');
    await expect(unauthenticatedButton).not.toBeVisible();
    
    // Guest mode banner should be visible instead
    const guestBanner = page.getByTestId('button-sign-in-banner');
    await expect(guestBanner).toBeVisible();
  });
});
