Branch protection and CI/CD policy

Goal
- Prevent direct pushes to `main`.
- Require all branches to run the `CI` workflow and pass tests before merging to `main`.
- Keep GitHub Pages and Render deploys working: Pages and Render deploys should run only after CI succeeds.

Summary of configuration steps (UI)
1. In GitHub, open the repository → Settings → Branches → Branch protection rules → Add rule.
2. Target branch name pattern: `main`.
3. Check **Require a pull request before merging**.
4. Enable **Require status checks to pass before merging** and select the `CI` workflow (it appears as the status check named `CI`).
   - Enable **Require branches to be up to date before merging** (this ensures the branch is tested against the latest `main`).
5. (Optional) Require pull request reviews: set **Require approving reviews** to `1`.
6. (Optional) Restrict who can push to matching branches: enable **Restrict who can push to matching branches** and add only administrators or a small team.
7. Save changes.

Why this works with our workflows
- We configured the `CI` workflow to run tests and typecheck on push/PR. By requiring the `CI` status check, GitHub will block merges until the tests pass.
- We added two deploy workflows that run only after `CI` completes successfully (`workflow_run` triggers). That ensures Pages and Render deploy steps only run when `CI` passes.
- If Render is still configured to auto-deploy on every push to `main`, it will run after merges to `main` (which are now gated by CI). If you prefer strict gating (no auto-deploy), disable Render auto-deploy and use the `deploy-render` workflow instead.

Automated script (gh CLI)
- You can apply the branch protection rule using the GitHub CLI (`gh`). The script below creates a branch protection rule for `main` that requires the `CI` status check and one approving review. Run this locally (you must be a repo admin and have `gh` authenticated):

```bash
#!/usr/bin/env bash
set -euo pipefail

OWNER="$(gh repo view --json nameWithOwner -q .nameWithOwner | cut -d'/' -f1)" || OWNER="YOUR_OWNER"
REPO="$(gh repo view --json nameWithOwner -q .nameWithOwner | cut -d'/' -f2)" || REPO="DiamondManager"
BRANCH="main"

cat > /tmp/protection.json <<EOF
{
  "required_status_checks": { "strict": true, "contexts": ["CI"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "dismiss_stale_reviews": true, "required_approving_review_count": 1 },
  "restrictions": null
}
EOF

echo "Applying branch protection to ${OWNER}/${REPO}:${BRANCH}"
gh api --method PUT /repos/${OWNER}/${REPO}/branches/${BRANCH}/protection --input /tmp/protection.json

echo "Done"
```

Notes
- Replace `OWNER` and `REPO` if the `gh` detection fails.
- The `contexts` array must list the exact status check names; GitHub shows available check names after the workflow has run at least once. If the `CI` job hasn't run yet, you may need to run it once or add the check name later.

If you'd like, I can:
- (A) Convert `deploy-render.yml` to `workflow_dispatch` (manual) so Render auto-deploy can remain enabled but CI won't automatically call the Render API.
- (B) Add a small README section that shows the exact UI steps with screenshots (text only here).
- (C) Run the `gh` script for you (I can't execute it against your GitHub account; you'll need to run it locally since it requires admin credentials).

Which of these do you want next?
