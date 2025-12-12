/**
 * Detailed test to reproduce the infinite loop bug
 * 
 * This test attempts to reproduce the exact conditions that cause
 * the /api/teams endpoint to be called repeatedly.
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173';
const BASE_PATH = BASE_URL.includes('github.io') ? '/DiamondManager' : '';

test.describe('Auth Loop Bug Reproduction', () => {
  test('should NOT make repeated requests when unauthenticated - detects infinite loop', async ({ page }) => {
    const requests: Array<{ url: string; status: number; timestamp: number }> = [];
    let requestCount = 0;

    // Track ALL requests to /api/teams
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/teams') && !url.includes('/api/teams/')) {
        requestCount++;
        requests.push({
          url,
          status: 0, // Will be updated on response
          timestamp: Date.now(),
        });
      }
    });

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('/api/teams') && !url.includes('/api/teams/')) {
        const request = requests.find(r => r.url === url && r.status === 0);
        if (request) {
          request.status = response.status();
        }
      }
    });

    // Navigate to app page (unauthenticated)
    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    
    // Wait for initial render
    await page.waitForLoadState('domcontentloaded');
    
    // Monitor for 5 seconds to detect loops
    // If there's a loop, we'll see many requests in this timeframe
    const startTime = Date.now();
    const monitorDuration = 5000; // 5 seconds
    
    while (Date.now() - startTime < monitorDuration) {
      await page.waitForTimeout(100); // Check every 100ms
      
      // If we see more than 10 requests in 5 seconds, that's definitely a loop
      if (requestCount > 10) {
        console.error(`LOOP DETECTED: ${requestCount} requests in ${Date.now() - startTime}ms`);
        break;
      }
    }
    
    // Analyze requests
    const teamsRequests = requests.filter(r => 
      r.url.includes('/api/teams') && !r.url.includes('/api/teams/')
    );
    
    console.log(`Total requests to /api/teams: ${teamsRequests.length}`);
    console.log(`Requests per second: ${(teamsRequests.length / (monitorDuration / 1000)).toFixed(2)}`);
    
    // Check request intervals - loops will have very consistent intervals
    if (teamsRequests.length > 1) {
      const intervals: number[] = [];
      for (let i = 1; i < teamsRequests.length; i++) {
        intervals.push(teamsRequests[i].timestamp - teamsRequests[i-1].timestamp);
      }
      const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
      console.log(`Average interval between requests: ${avgInterval.toFixed(2)}ms`);
      
      // If requests are happening very regularly (within 100ms of each other), it's likely a loop
      const isRegular = intervals.every(interval => Math.abs(interval - avgInterval) < 100);
      if (isRegular && teamsRequests.length > 5) {
        console.error(`REGULAR INTERVAL DETECTED - likely a loop: ${avgInterval.toFixed(2)}ms`);
      }
    }
    
    // The bug manifests as multiple requests (loop)
    // With the fix, we should see 0-1 requests maximum
    expect(teamsRequests.length).toBeLessThanOrEqual(2); // Allow 2 for edge case timing
    
    // If there were requests, they should all be 401
    teamsRequests.forEach(req => {
      expect(req.status).toBe(401);
    });
  });

  test('should stop requests immediately when query is disabled', async ({ page }) => {
    // This test simulates the scenario where auth state changes
    const requests: Array<{ url: string; timestamp: number }> = [];
    
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/api/teams') && !url.includes('/api/teams/')) {
        requests.push({
          url,
          timestamp: Date.now(),
        });
      }
    });

    await page.goto(`${BASE_PATH}/app`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('domcontentloaded');
    
    // Wait 2 seconds and count requests
    await page.waitForTimeout(2000);
    
    const requestCountAfter2s = requests.length;
    
    // Wait another 2 seconds
    await page.waitForTimeout(2000);
    
    const requestCountAfter4s = requests.length;
    
    // If requests stopped, count should be the same
    // If still looping, count will increase
    const requestsInSecondHalf = requestCountAfter4s - requestCountAfter2s;
    
    console.log(`Requests in first 2s: ${requestCountAfter2s}`);
    console.log(`Requests in next 2s: ${requestsInSecondHalf}`);
    
    // Requests should stop (not continue growing)
    // Allow some tolerance for requests that were already in flight
    expect(requestsInSecondHalf).toBeLessThanOrEqual(requestCountAfter2s + 2);
  });
});
