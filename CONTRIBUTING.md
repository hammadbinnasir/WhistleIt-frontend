# Contributing

## Branch model

```
main      production-ready, protected. Only the team lead merges Development -> main.
  └─ Development   integration branch. EVERYONE branches from here and PRs back into here.
       ├─ feature/auth-login
       ├─ feature/channels-create-channel
       └─ feature/messages-reactions
```

Rules (from the team plan):

- **No direct pushes to `main` or `Development`.** Everything goes through a pull request.
- One branch per task, named `feature/<area>-<task>` (lowercase, hyphens).
- Every PR needs **lead review** and a **passing CI build** before merge.
- Small PRs, merged daily, to avoid last-week conflicts.

Other prefixes: `fix/<area>-<bug>`, `chore/<what>`, `docs/<what>`.

### Area names to use in branch names

`auth`, `account`, `shell`, `channels`, `dms`, `messages`, `composer`, `media`, `search`

## Daily workflow (copy-paste)

```bash
# 1. Start of day / start of a task: sync Development
git checkout Development
git pull origin Development

# 2. Create your branch from Development
git checkout -b feature/channels-create-channel

# 3. Work, then commit small and often
git add .
git commit -m "feat(channels): add create channel modal"

# 4. Before pushing, bring in the latest Development to catch conflicts early
git fetch origin
git merge origin/Development        # (or: git rebase origin/Development)

# 5. Check locally
npm run lint && npm test && npm run build

# 6. Push and open a PR targeting Development
git push -u origin feature/channels-create-channel
```

Then on GitHub: **Compare & pull request** → base: `Development` → fill in the template → request review from the lead.

After your PR is merged: delete the branch, then `git checkout Development && git pull` and start the next task from fresh `Development`.

## Commit messages

`type(area): short description`, where type is one of `feat`, `fix`, `refactor`, `style`, `test`, `docs`, `chore`.

Examples: `feat(auth): add login form`, `fix(messages): dedupe socket messages by id`.

## Code rules

- Vue 3 Composition API with `<script setup>`.
- Your code lives in `src/features/<your-area>/`. Only put things in `src/components/` if at least two areas use them.
- **Never call `fetch` in a component.** Use `src/lib/api`.
- Pinia stores hold UI/client state. Name them `use<Name>Store`, file `stores/<name>.js`.
- Touching shared files (`router/index.js`, `stores/ui.js`, `lib/*`, `main.js`)? Keep the change tiny and tell the lead in the PR, since these cause most merge conflicts.
- Every feature: loading, empty and error states; no console errors.
- Don't commit `.env` files, tokens or secrets.

## Resolving merge conflicts

```bash
git checkout feature/your-branch
git fetch origin
git merge origin/Development
# fix conflict markers in the files, then
git add <files>
git commit
git push
```

If unsure, ask the lead before force-pushing anything. Never force-push `Development` or `main`.

## Lead checklist (one-time repo setup)

On GitHub: **Settings → Branches → Add branch ruleset** for `main` and `Development`:
require a pull request, require 1 approval, require the `CI / check` status to pass, block force pushes.
Also set **Development** as the default branch (Settings → General) so new clones and PRs target it.
