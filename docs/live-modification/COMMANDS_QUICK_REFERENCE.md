# ProbashiCare Command Quick Reference

Run these commands from the repository root unless a section says otherwise.

~~~powershell
Set-Location F:\cse471-project\probashicare
Get-Location
~~~

## 1. Check tools and repository

~~~powershell
node --version
npm.cmd --version
git --version
git status --short --branch
git remote -v
~~~

List files or search code:

~~~powershell
Get-ChildItem
rg --files backend frontend/src
rg -n "functionName" backend frontend/src
rg -n "Visible page text" frontend/src
rg -n "api/route-part" backend/routes frontend/src/services
~~~

## 2. Install dependencies

Install root development tools:

~~~powershell
npm.cmd install
~~~

Install backend and frontend dependencies:

~~~powershell
npm.cmd install --prefix backend
npm.cmd install --prefix frontend
~~~

Check whether a dependency is installed:

~~~powershell
npm.cmd ls stripe --prefix backend
npm.cmd ls axios --prefix frontend
~~~

Install one missing dependency only when it belongs in the project:

~~~powershell
npm.cmd install stripe --prefix backend
npm.cmd install axios --prefix frontend
~~~

Inspect package changes after installing:

~~~powershell
git diff -- backend/package.json backend/package-lock.json
git diff -- frontend/package.json frontend/package-lock.json
~~~

## 3. Start ProbashiCare

Stable backend without automatic restarts:

~~~powershell
npm.cmd start --prefix backend
~~~

Backend watch mode:

~~~powershell
npm.cmd run dev --prefix backend
~~~

Frontend development server:

~~~powershell
npm.cmd run dev --prefix frontend
~~~

Run both through the root script after installing root dependencies:

~~~powershell
npm.cmd run dev
~~~

For a demonstration, two terminals are easier to diagnose:

~~~text
Terminal 1: npm.cmd start --prefix backend
Terminal 2: npm.cmd run dev --prefix frontend
~~~

Stop a running terminal process:

~~~text
Ctrl+C
~~~

## 4. Check the API and ports

Backend health check:

~~~powershell
Invoke-RestMethod http://localhost:5034/api/health
~~~

See whether port 5034 is already used:

~~~powershell
Get-NetTCPConnection -LocalPort 5034 -State Listen
~~~

Inspect the process using the returned `OwningProcess` number:

~~~powershell
Get-Process -Id PROCESS_NUMBER
~~~

Stop only that process when you have confirmed it is the unwanted backend:

~~~powershell
Stop-Process -Id PROCESS_NUMBER
~~~

If backend watch mode loops, run stable mode and read the first error:

~~~powershell
npm.cmd start --prefix backend
~~~

## 5. Syntax and build verification

Check each changed backend JavaScript file:

~~~powershell
node --check backend/models/ChangedModel.js
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
node --check backend/services/changedService.js
~~~

Build the frontend:

~~~powershell
npm.cmd run build --prefix frontend
~~~

Check whitespace and Git status:

~~~powershell
git diff --check
git status --short --branch
~~~

Inspect changes:

~~~powershell
git diff --stat
git diff
git diff -- path/to/file.js
~~~

Inspect staged changes:

~~~powershell
git diff --cached --stat
git diff --cached
~~~

## 6. Backend tests available in this repository

Unit/focused tests:

~~~powershell
npm.cmd run test:bookings --prefix backend
npm.cmd run test:subscriptions --prefix backend
npm.cmd run test:stripe --prefix backend
npm.cmd run test:wellness-insights --prefix backend
npm.cmd run test:notifications --prefix backend
npm.cmd run test:auth --prefix backend
npm.cmd run test:calendar-service --prefix backend
~~~

Authenticated MongoDB smoke tests:

~~~powershell
npm.cmd run test:elderly-profiles --prefix backend
npm.cmd run test:bookings:integration --prefix backend
npm.cmd run test:subscriptions:integration --prefix backend
npm.cmd run test:wellness-reports --prefix backend
npm.cmd run test:notifications:integration --prefix backend
npm.cmd run test:groceries --prefix backend
npm.cmd run test:family-account --prefix backend
~~~

Other integration checks:

~~~powershell
npm.cmd run test:email --prefix backend
npm.cmd run test:calendar --prefix backend
~~~

Smoke tests can write to MongoDB. Run them only against a database you are allowed to modify.

## 7. Database maintenance scripts

Synchronize indexes:

~~~powershell
npm.cmd run db:sync-indexes --prefix backend
~~~

Synchronize subscription plans:

~~~powershell
npm.cmd run db:sync-subscription-plans --prefix backend
~~~

Migrate legacy bookings:

~~~powershell
npm.cmd run db:migrate-bookings --prefix backend
~~~

These commands modify the configured MongoDB database. Confirm the environment first.

## 8. Environment-file checks

Confirm files exist without printing secrets:

~~~powershell
Test-Path backend/.env
Test-Path frontend/.env
~~~

Never commit `.env` files or paste secrets into documentation.

## 9. Basic Git inspection

~~~powershell
git status --short --branch
git branch --all --no-color
git branch -vv --no-color
git log --oneline --graph --decorate --max-count=15
git show --stat --oneline HEAD
~~~

See which files differ:

~~~powershell
git diff --name-only
git diff --cached --name-only
git ls-files --others --exclude-standard
~~~

## 10. Download remote updates and switch branches

Download branch information without modifying current files:

~~~powershell
git fetch origin
~~~

Switch to a remote branch for the first time:

~~~powershell
git switch --track origin/practice/live-modification
~~~

Switch when the local branch already exists:

~~~powershell
git switch practice/live-modification
git pull --ff-only origin practice/live-modification
~~~

Create a new branch from the current commit:

~~~powershell
git switch -c practice/my-new-drill
~~~

Create a branch from updated main:

~~~powershell
git fetch origin
git switch main
git pull --ff-only origin main
git switch -c feature/my-feature
~~~

## 11. Commit only intended files

Inspect first:

~~~powershell
git status --short
git diff
~~~

Stage exact files instead of automatically staging everything:

~~~powershell
git add path/to/first-file.js path/to/second-file.jsx
git diff --cached --stat
git diff --cached
~~~

Commit:

~~~powershell
git commit -m "feat: describe the modification"
~~~

Push a new branch and set its upstream:

~~~powershell
git push -u origin CURRENT_BRANCH_NAME
~~~

Push later commits:

~~~powershell
git push
~~~

## 12. Undo local changes safely

Unstage a file without discarding its contents:

~~~powershell
git restore --staged -- path/to/file.js
~~~

Discard an unstaged tracked-file change only when it is definitely unwanted:

~~~powershell
git restore -- path/to/file.js
~~~

Discard a staged and working-tree change:

~~~powershell
git restore --staged -- path/to/file.js
git restore --source=HEAD --worktree -- path/to/file.js
~~~

Preview untracked files before removal:

~~~powershell
git clean -nd
~~~

Remove only the previewed untracked files when all are unwanted:

~~~powershell
git clean -fd
~~~

`git clean -fd` is destructive. It does not normally remove ignored `.env` files, but always inspect the preview first.

## 13. Merge and conflict commands

Update the branch that will receive the merge:

~~~powershell
git switch TARGET_BRANCH
git pull --ff-only origin TARGET_BRANCH
git merge SOURCE_BRANCH
~~~

During a conflict:

~~~powershell
git status
~~~

After manually resolving each conflict:

~~~powershell
git add path/to/resolved-file.js
git diff --cached
git merge --continue
~~~

Cancel an unfinished merge only when you intend to abandon it:

~~~powershell
git merge --abort
~~~

Cherry-pick one commit:

~~~powershell
git cherry-pick COMMIT_HASH
~~~

Continue after resolving a cherry-pick conflict:

~~~powershell
git add path/to/resolved-file.js
git cherry-pick --continue
~~~

Cancel the cherry-pick:

~~~powershell
git cherry-pick --abort
~~~

## 14. Stripe commands: package versus CLI

Install/check the Node package used by the backend:

~~~powershell
npm.cmd install --prefix backend
npm.cmd ls stripe --prefix backend
~~~

The Stripe CLI is a separate `stripe.exe`. From its extracted directory:

~~~powershell
.\stripe.exe login
.\stripe.exe listen --events checkout.session.completed,checkout.session.expired,checkout.session.async_payment_failed --forward-to http://localhost:5034/api/subscriptions/stripe/webhook
~~~

The webhook secret printed by `stripe listen` is temporary for that local listener session and belongs in the local backend environment only.

## 15. Fast live-test sequences

Frontend-only change:

~~~powershell
git status --short --branch
rg -n "Visible text or component name" frontend/src
npm.cmd run build --prefix frontend
git diff --check
git status --short
~~~

Backend-only change:

~~~powershell
git status --short --branch
rg -n "route-or-controller-name" backend
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
git diff --check
~~~

Full-stack change:

~~~powershell
git status --short --branch
rg -n "existing-related-feature" backend frontend/src
node --check backend/models/ChangedModel.js
node --check backend/controllers/changedController.js
node --check backend/routes/changedRoutes.js
npm.cmd run build --prefix frontend
git diff --check
git status --short --branch
~~~

## 16. Commands to avoid under pressure

Do not use these without understanding their impact:

~~~text
git reset --hard
git clean -fdx
git push --force
Remove-Item -Recurse on a broad directory
~~~

Prefer exact file paths, inspect `git status`, and preview destructive actions first.

## 17. VS Code and Copilot shortcuts

These shortcuts reduce searching and typing time during a live modification test.

| Shortcut | Purpose |
| --- | --- |
| `Ctrl+Shift+F` | Search for text, endpoint URLs, field names, or function names across the project. |
| `Ctrl+P` | Open a file quickly by typing part of its filename. |
| `Ctrl+Space` | Open normal JavaScript, React, import, and property suggestions. |
| `Tab` | Accept the visible grey Copilot inline suggestion. |
| `Esc` | Reject the current inline suggestion. |
| `F12` | Go to the definition of a function, component, variable, or imported value. |
| `Shift+F12` | Find every place where the selected function or value is used. |
| `Alt+F12` | Preview a definition without leaving the current file. |
| `F2` | Rename a variable or function and update its known references safely. |
| `Ctrl+.` | Open available fixes, imports, and code actions for the current error. |
| `Ctrl+Shift+Space` | Show the parameters expected by the current function call. |
| `Shift+Alt+F` | Format the current file with its configured formatter. |
| `Ctrl+S` | Save intentionally and trigger Vite or Nodemon only when ready. |
| `Ctrl+Shift+M` | Open the Problems panel and inspect JavaScript, ESLint, and import errors. |
| `F8` / `Shift+F8` | Move to the next or previous reported problem. |
| <kbd>Ctrl</kbd> + <kbd>&#96;</kbd> | Open or close the integrated terminal. |
| `Ctrl+Shift+V` | Open the rendered preview of the current Markdown guide. |
| `Ctrl+K`, then `V` | Open Markdown source and rendered preview side by side. |

Use Copilot as a syntax assistant, not as the source of truth. Before accepting a suggestion, verify that its model name, schema fields, imports, endpoint URL, request body, and response shape match this repository.

Fast navigation for a frontend-only change:

~~~text
Search visible page text with Ctrl+Shift+F
    -> open the matching React page
    -> copy a nearby button or handler pattern
    -> use F12 on imported components and service functions
    -> use Ctrl+. to repair a missing import
    -> save and inspect the browser console
~~~

Fast navigation for a full-stack change:

~~~text
React page or component
    -> frontend service function
    -> API endpoint URL
    -> Express route
    -> controller function
    -> Mongoose model
    -> MongoDB document
~~~

Search the endpoint URL or field name with `Ctrl+Shift+F` when you do not know which file to open first. Copy the structure of the closest existing feature, then change only the required fields and behavior.

For a calmer test environment, consider disabling one-second auto-save and save manually:

~~~json
{
  "files.autoSave": "off",
  "editor.inlineSuggest.enabled": true,
  "editor.inlayHints.enabled": "on"
}
~~~
