import { test, expect } from '@playwright/test';

// Allow testing against localhost or production
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
// Base path is only needed for GitHub Pages production
const BASE_PATH = BASE_URL.includes('github.io') ? '/DiamondManager' : '';

test.describe('Authentication Loop Prevention', () => {
  test('should not make repeated API requests when unauthenticated', async ({ page, browserName }) => {
    // Track all network requests to /api/teams
    const apiRequests: { url: string; status: number }[] = [];
    
    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/teams')) {
        apiRequests.push({
          url,
          status: response.status(),
        });
      }
    });

    // Navigate to the app page while unauthenticated
    // This simulates the bug scenario where useTeams was making repeated requests
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for React to render
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit to see if any API requests are made
    // We need to wait long enough to detect if there's a loop, but not too long
    await page.waitForTimeout(3000); // 3 seconds should be enough to detect a loop
    
    // Filter requests to just GET /api/teams (the problematic endpoint)
    const teamsRequests = apiRequests.filter(req => 
      req.url.includes('/api/teams') && 
      !req.url.includes('/api/teams/') // Only base /api/teams, not team-specific endpoints
    );
    
    // The bug was that useTeams would make repeated requests even when unauthenticated
    // With the fix, useTeams should NOT make any requests when isAuthenticated is false
    // So we expect 0 requests to /api/teams when unauthenticated
    // 
    // However, we might get 1 request if the query initially tries before auth check completes
    // So we allow 0-1 requests, but definitely not multiple (which would indicate a loop)
    expect(teamsRequests.length).toBeLessThanOrEqual(1);
    
    // If there were any requests, they should be 401 (Unauthorized)
    // But ideally there should be 0 requests because the query is disabled when not authenticated
    if (teamsRequests.length > 0) {
      // All requests should be 401 (not authenticated)
      teamsRequests.forEach(req => {
        expect(req.status).toBe(401);
      });
    }
    
    console.log(`Found ${teamsRequests.length} requests to /api/teams (expected 0-1)`);
  });

  test('should not make API requests to /api/teams immediately after page load when unauthenticated', async ({ page }) => {
    // More aggressive test: check immediately after load, before any potential loops start
    const apiRequests: { url: string; status: number }[] = [];
    
    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/api/teams') && !url.includes('/api/teams/')) {
        apiRequests.push({
          url,
          status: response.status(),
        });
      }
    });

    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for initial render, but not too long
    await page.waitForLoadState('domcontentloaded');
    
    // Check immediately - if the fix is working, no requests should be made
    // because useTeams checks isAuthenticated before enabling the query
    await page.waitForTimeout(1000); // 1 second should be enough for initial render
    
    // With the fix, we expect 0 requests because the query is disabled when not authenticated
    // Before the fix, this would have been multiple requests (the loop)
    expect(apiRequests.length).toBe(0);
    
    console.log('No requests to /api/teams made (as expected when unauthenticated)');
  });
});
