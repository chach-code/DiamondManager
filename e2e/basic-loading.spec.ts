import { test, expect } from '@playwright/test';

// Allow testing against localhost or production
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
// Base path is only needed for GitHub Pages production
const BASE_PATH = BASE_URL.includes('github.io') ? '/DiamondManager' : '';

test.describe('Basic Site Loading', () => {
  test('should load landing page in Chrome desktop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome desktop test only');
    
    // Use baseURL from config, which handles the path correctly
    await page.goto(BASE_PATH || '/', { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load (use domcontentloaded for local dev with HMR)
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for React to hydrate - wait for the heading or any content
    await page.waitForSelector('h1, #root', { timeout: 10000 });
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/Baseball Team Manager/i);
    
    // Check that the main heading appears (this confirms React has rendered)
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    
    // Check console for critical errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any console errors
    await page.waitForTimeout(1000);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('404') &&
      !err.includes('Failed to load resource') &&
      !err.includes('React DevTools') &&
      !err.includes('apple-mobile-web-app')
    );
    
    // Fail test if there are critical React errors
    expect(criticalErrors.length).toBe(0);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/chrome-desktop-landing.png', fullPage: true });
  });

  test('should load landing page in Safari mobile', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari mobile test only');
    
    await page.goto(BASE_PATH || '/', { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load (use domcontentloaded for local dev with HMR)
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for React to hydrate - wait for the heading or any content
    await page.waitForSelector('h1, #root', { timeout: 10000 });
    
    // Check that the page title is correct
    await expect(page).toHaveTitle(/Baseball Team Manager/i);
    
    // Check that the main heading appears (this confirms React has rendered)
    const heading = page.locator('h1').first();
    await expect(heading).toBeVisible({ timeout: 10000 });
    
    // Verify mobile viewport
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(390); // iPhone 13 Pro width
    
    // Check console for critical errors
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Wait a bit to catch any console errors
    await page.waitForTimeout(1000);
    
    // Filter out known non-critical errors
    const criticalErrors = errors.filter(err => 
      !err.includes('favicon') && 
      !err.includes('404') &&
      !err.includes('Failed to load resource') &&
      !err.includes('React DevTools') &&
      !err.includes('apple-mobile-web-app')
    );
    
    // Fail test if there are critical React errors
    expect(criticalErrors.length).toBe(0);
    
    // Take a screenshot for visual verification
    await page.screenshot({ path: 'test-results/safari-mobile-landing.png', fullPage: true });
  });

  test('should navigate to app page in Chrome desktop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome desktop test only');
    
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for React to hydrate - use domcontentloaded instead of networkidle for local dev
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for any content to render (could be landing page or app page)
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for React to hydrate
    await page.waitForSelector('h1, button, [role="button"], #root', { timeout: 10000 });
    
    // Check that page loaded (URL should be either /app or landing page if not authenticated)
    const url = page.url();
    const isLocalhost = url.includes('localhost');
    const isProduction = url.includes('github.io');
    
    // For localhost, just verify we're on the site
    // For production, check for DiamondManager path
    if (isProduction) {
      expect(url).toContain('DiamondManager');
    } else {
      expect(url).toContain('localhost:5173');
    }
    
    // Check that some content is visible (either landing or app page)
    const hasContent = await page.locator('h1, button, [role="button"], #root').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/chrome-desktop-app.png', fullPage: true });
  });

  test('should navigate to app page in Safari mobile', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari mobile test only');
    
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load (use domcontentloaded for local dev with HMR)
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for any content to render (could be landing page or app page)
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for React to hydrate
    await page.waitForSelector('h1, button, [role="button"], #root', { timeout: 10000 });
    
    // Check that page loaded (URL should be either /app or landing page if not authenticated)
    const url = page.url();
    const isLocalhost = url.includes('localhost');
    const isProduction = url.includes('github.io');
    
    // For localhost, just verify we're on the site
    // For production, check for DiamondManager path
    if (isProduction) {
      expect(url).toContain('DiamondManager');
    } else {
      expect(url).toContain('localhost:5173');
    }
    
    // Check that some content is visible (either landing or app page)
    const hasContent = await page.locator('h1, button, [role="button"], #root').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/safari-mobile-app.png', fullPage: true });
  });

  test('should handle 404 pages gracefully in Chrome desktop', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'Chrome desktop test only');
    
    await page.goto(`${BASE_PATH}/non-existent-page`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load (use domcontentloaded for local dev with HMR)
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for any content to render (could be 404 page or redirect)
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for React to hydrate
    await page.waitForSelector('h1, #root', { timeout: 10000 });
    
    // Should either show 404 page or redirect - just check that page loaded
    const url = page.url();
    const isProduction = url.includes('github.io');
    
    if (isProduction) {
      expect(url).toContain('DiamondManager');
    } else {
      expect(url).toContain('localhost:5173');
    }
    
    // Check that page has some content (404 message or redirect to landing)
    const hasContent = await page.locator('body, #root').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/chrome-desktop-404.png', fullPage: true });
  });

  test('should handle 404 pages gracefully in Safari mobile', async ({ page, browserName }) => {
    test.skip(browserName !== 'webkit', 'Safari mobile test only');
    
    await page.goto(`${BASE_PATH}/non-existent-page`, { waitUntil: 'domcontentloaded' });
    
    // Wait for the page to load (use domcontentloaded for local dev with HMR)
    await page.waitForLoadState('domcontentloaded');
    
    // Wait for any content to render (could be 404 page or redirect)
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Wait for React to hydrate
    await page.waitForSelector('h1, #root', { timeout: 10000 });
    
    // Should either show 404 page or redirect - just check that page loaded
    const url = page.url();
    const isProduction = url.includes('github.io');
    
    if (isProduction) {
      expect(url).toContain('DiamondManager');
    } else {
      expect(url).toContain('localhost:5173');
    }
    
    // Check that page has some content (404 message or redirect to landing)
    const hasContent = await page.locator('body, #root').first().isVisible().catch(() => false);
    expect(hasContent).toBeTruthy();
    
    await page.screenshot({ path: 'test-results/safari-mobile-404.png', fullPage: true });
  });
});
