#!/bin/bash
# Pre-commit check script
# Run type checking and tests before commit

set -e

echo "🔍 Running pre-commit checks..."

# Run type checking
echo "📝 Checking TypeScript types..."
npm run check

# Run tests
echo "🧪 Running tests..."
npm test --silent

echo "✅ All pre-commit checks passed!"
exit 0
