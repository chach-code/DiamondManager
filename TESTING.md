# Testing Documentation

This document describes the testing strategy and test suites for the DiamondManager application.

## Test Structure

### Jest Tests (Unit/Integration)

Jest tests are located in `server/__tests__/` and `client/__tests__/` directories.

#### Server Tests

- **`routes.teams.test.ts`**: Tests for team CRUD API endpoints
- **`routes.players.test.ts`**: Tests for player CRUD API endpoints
- **`routes.auth.test.ts`**: Tests for authentication endpoints
- **`googleAuth.test.ts`**: Tests for Google OAuth configuration
- **`session.test.ts`**: Tests for session middleware

#### Running Jest Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- routes.teams

# Run in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Playwright Tests (E2E)

Playwright tests are located in the `e2e/` directory.

- **`basic-loading.spec.ts`**: Basic smoke tests for site loading and navigation
- **`team-management.spec.ts`**: Team creation, switching, and deletion workflows
- **`player-management.spec.ts`**: Player CRUD operations

#### Running Playwright Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run specific test file
npm run test:e2e -- e2e/team-management.spec.ts

# Run with UI
npm run test:e2e:ui

# Run in headed mode (see browser)
npm run test:e2e:headed

# Run only Chrome desktop
npm run test:e2e:chrome

# Run only Safari mobile
npm run test:e2e:safari
```

## Test Coverage

### API Routes (Jest)

✅ Teams API
- GET /api/teams - Fetch user's teams
- POST /api/teams - Create new team
- PATCH /api/teams/:id - Update team
- DELETE /api/teams/:id - Delete team
- Authentication requirements
- Error handling

✅ Players API
- GET /api/teams/:teamId/players - Fetch team players
- POST /api/teams/:teamId/players - Create player
- PATCH /api/players/:id - Update player
- DELETE /api/players/:id - Delete player
- Validation
- Error handling

✅ Auth API
- GET /api/auth/user - Get current user
- Graceful handling of unauthenticated requests

### E2E Tests (Playwright)

✅ Basic Functionality
- Landing page loads
- App page navigation
- 404 page handling
- Cross-browser compatibility (Chrome, Safari)

✅ Team Management
- Create new team
- Switch between teams
- Delete teams
- Last selected team persistence
- Prevent deleting last team

✅ Player Management
- Add players
- Edit players
- Delete players
- Form validation
- Display player information

## Testing Best Practices

### Jest Tests

1. **Mock external dependencies**: Use Jest mocks for database, auth, and external services
2. **Test edge cases**: Include tests for error conditions, invalid input, and boundary cases
3. **Isolate tests**: Each test should be independent and not rely on other tests
4. **Use descriptive test names**: Test names should clearly describe what is being tested
5. **Test behavior, not implementation**: Focus on what the code does, not how it does it

### Playwright Tests

1. **Use data-testid attributes**: Prefer `data-testid` over CSS selectors for stability
2. **Wait for elements**: Always wait for elements to be visible/interactive before interacting
3. **Test user workflows**: Focus on complete user journeys rather than isolated actions
4. **Handle async operations**: Account for loading states and API calls
5. **Use page object pattern**: Consider creating page objects for complex pages

### Test Data

- Use unique test data (timestamps, UUIDs) to avoid conflicts
- Clean up test data after tests when possible
- Use factories or builders for creating test data

## Known Issues / TODO

1. **Storage layer tests**: Need to add integration tests for the storage layer with a test database
2. **React hooks tests**: Need to add tests for useTeams, useTeamPlayers, and useAuth hooks
3. **Authentication flow E2E**: Need comprehensive E2E tests for Google OAuth flow
4. **Error boundary tests**: Need to test error boundary component
5. **Component tests**: Add React Testing Library tests for components

## Continuous Integration

Tests run automatically in CI/CD pipeline:
- Jest tests run on every push
- Playwright tests run on pull requests
- Both must pass before merging

## Debugging Tests

### Jest

```bash
# Run with verbose output
npm test -- --verbose

# Run single test
npm test -- -t "should create a new team"

# Debug mode (Node debugger)
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Playwright

```bash
# Debug mode (opens Playwright Inspector)
npm run test:e2e:debug

# Run with trace
npm run test:e2e -- --trace on

# View trace
npx playwright show-trace trace.zip
```

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass
3. Maintain or improve test coverage
4. Update this document if adding new test categories