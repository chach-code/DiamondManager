# Contributing Guidelines

## Before You Commit

**Always run verification before committing:**

```bash
npm run verify
```

This runs:
- ✅ TypeScript type checking (`npm run check`)
- ✅ All unit tests (`npm test`)

## Development Workflow

1. **Make your changes**
2. **Run verification**: `npm run verify`
3. **Fix any errors** that appear
4. **Commit and push**

## Build Scripts

All build commands include type checking and will fail if there are TypeScript errors:

- `npm run build` - Full build (includes typecheck)
- `npm run build:frontend` - Frontend build (includes typecheck)
- `npm run build:pages` - GitHub Pages build (includes typecheck)

## Type Checking

Type checking is mandatory. The CI pipeline will fail if TypeScript errors exist.

```bash
# Check types
npm run check

# Watch mode (useful during development)
npm run check:watch
```

## Testing

Write tests for new features:

```bash
# Run tests
npm test

# Run specific test file
npm test -- routes.teams

# Run with coverage
npm test -- --coverage
```

## Pre-commit Hooks (Optional)

If you want automatic checks before committing:

```bash
# Install husky
npm install --save-dev husky

# Initialize (if needed)
npx husky init

# The pre-commit hook is already set up in .husky/pre-commit
```

Or manually create a git hook:
```bash
# .git/hooks/pre-commit
#!/bin/sh
npm run verify
```

## CI/CD

The CI pipeline runs:
1. Type checking
2. Unit tests
3. Build verification

All must pass before PRs can be merged.

## Common Mistakes to Avoid

❌ **Don't** commit without running `npm run verify`
❌ **Don't** ignore TypeScript errors
❌ **Don't** skip tests when adding features
✅ **Do** run verification before pushing
✅ **Do** fix TypeScript errors immediately
✅ **Do** write tests for new functionality

## Getting Help

If you see errors you don't understand:
1. Run `npm run check` to see TypeScript errors
2. Check the error messages carefully
3. Review [DEVELOPMENT.md](./DEVELOPMENT.md) for common issues
4. Check [TESTING.md](./TESTING.md) for testing help