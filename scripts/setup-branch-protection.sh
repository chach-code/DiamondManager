#!/usr/bin/env bash
set -euo pipefail

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI is required. Install from https://cli.github.com/"
  exit 1
fi

OWNER_REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner)
if [ -z "$OWNER_REPO" ]; then
  echo "Unable to detect owner/repo. Set OWNER and REPO in the script or run 'gh auth login'"
  exit 1
fi

BRANCH=main

cat > /tmp/protection.json <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["CI"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 1 },
  "restrictions": null
}
JSON

echo "Applying branch protection to ${OWNER_REPO}:${BRANCH}"
gh api --method PUT /repos/${OWNER_REPO}/branches/${BRANCH}/protection --input /tmp/protection.json

echo "Branch protection applied."
