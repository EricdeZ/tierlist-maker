# /ship

Commit, push, and deploy the current changes in one go.

## Steps

1. Run `git status` and `git diff --staged` and `git diff` to see all changes
2. Run `git log --oneline -5` to match commit message style
3. Stage all relevant changed files (NOT .env or credentials)
4. Create a concise commit message summarizing the changes
5. Commit with `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
6. Push to the current branch
7. Run `npm run deploy` to build and deploy to Cloudflare Pages
8. Report the result: commit hash, branch, and deploy status
