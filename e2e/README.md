# Playwright E2E Tests

This directory contains end-to-end tests for the DiamondManager application using Playwright.

## Setup

1. Install Playwright browsers:
   ```bash
   npm run playwright:install
   ```

2. The tests are configured to run against production by default:
   - Production: `https://chach-code.github.io/DiamondManager/`

3. To test against localhost, set the environment variable:
   ```bash
   PLAYWRIGHT_BASE_URL=http://localhost:5000 npm run test:e2e
   ```

## Running Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run tests with UI (interactive mode)
npm run test:e2e:ui

# Run only Chrome desktop tests
npm run test:e2e:chrome

# Run only Safari mobile tests
npm run test:e2e:safari

# Run tests in headed mode (see the browser)
npm run test:e2e:headed

# Debug tests
npm run test:e2e:debug

# Run all tests (unit + E2E)
npm run test:all
```

## Test Structure

- `basic-loading.spec.ts`: Basic smoke tests that verify:
  - Landing page loads in Chrome desktop
  - Landing page loads in Safari mobile
  - Navigation to app page works
  - 404 pages are handled gracefully

## CI/CD

The tests are designed to work in CI environments. They will:
- Run against production by default
- Take screenshots on failure
- Generate HTML reports
- Retry failed tests automatically

## Configuration

See `playwright.config.ts` for:
- Browser configurations (Chrome desktop, Safari mobile)
- Timeouts and retries
- Screenshot and trace settings
