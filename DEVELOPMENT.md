# Development Guide

This guide outlines best practices for developing on DiamondManager.

## Pre-Commit Checklist

Before committing, always run:

```bash
npm run verify
```

This runs:
- ✅ TypeScript type checking (`npm run check`)
- ✅ All Jest unit tests (`npm test`)

## Build Scripts

All build scripts now include type checking:

- `npm run build` - Full build (frontend + backend) with typecheck
- `npm run build:frontend` - Frontend build with typecheck
- `npm run build:pages` - GitHub Pages build with typecheck

If type checking fails, the build will fail immediately.

## Type Checking

```bash
# Run type checking
npm run check

# Run type checking in watch mode (for development)
npm run check:watch
```

## Preventing Type Errors in CI

### Automatic Checks

1. **CI Pipeline**: The GitHub Actions CI workflow runs `npm run check` before tests
2. **Build Scripts**: All build commands include type checking
3. **Pre-commit Hook** (optional): If you set up Husky, it will run checks before each commit

### Manual Checks

Before pushing:
```bash
# Quick verification (typecheck + tests)
npm run verify

# Or individually
npm run check  # Type checking
npm test       # Unit tests
npm run build  # Verify build works
```

## Common Issues

### Type Errors in CI

If you see type errors in CI:
1. Run `npm run check` locally - it should show the same errors
2. Fix the TypeScript errors
3. Verify with `npm run verify`
4. Push again

### Build Failing in CI

If builds fail in CI:
1. Run `npm run build` locally - it should fail the same way
2. Fix the issues
3. Verify the build succeeds locally
4. Push again

## VS Code Integration

The repository includes `.vscode/settings.json` with:
- TypeScript workspace SDK enabled
- Format on save
- Auto-fix on save

This helps catch type errors in your editor before committing.

## Git Hooks (Optional)

To set up pre-commit hooks:

```bash
# Install husky (if not already installed)
npm install --save-dev husky

# Initialize husky
npx husky init

# The pre-commit hook will run npm run verify before each commit
```

Or manually create `.git/hooks/pre-commit`:
```bash
#!/bin/sh
npm run verify
```

## CI/CD Pipeline

The CI workflow (`.github/workflows/ci.yml`) runs:
1. Type checking (`npm run check`)
2. Unit tests (`npm test`)
3. Frontend build verification
4. Backend build verification

All must pass before merging PRs (if branch protection is enabled).