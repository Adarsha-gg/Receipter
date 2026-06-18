# TenderBoard Worktree Map

The main repo is kept clean. Use separate Git worktrees for focused AI tasks.

## Main worktree

```text
C:\Users\adars\Coding\hackathon
```

Branch:

```text
main
```

Use for:

- stable reviewed code
- final README/submission state
- merging finished worktree branches
- pushing release-ready commits

Do not do risky feature work directly here unless it is tiny.

## Live CROO worktree

```text
C:\Users\adars\Coding\hackathon-worktrees\tenderboard-live-croo
```

Branch:

```text
work/tenderboard-live-croo
```

Use for:

- real CROO credentials setup testing
- live preflight fixes
- first real funded `payOrder` run
- receipt/tx proof fixes

## Submission polish worktree

```text
C:\Users\adars\Coding\hackathon-worktrees\tenderboard-submission-polish
```

Branch:

```text
work/tenderboard-submission-polish
```

Use for:

- README polish
- DoraHacks copy
- screenshots
- demo video script
- final judge-facing proof bundle

## Worker scout worktree

```text
C:\Users\adars\Coding\hackathon-worktrees\tenderboard-worker-scout
```

Branch:

```text
work/tenderboard-worker-scout
```

Use for:

- better real-world worker behavior
- public-source search improvements
- ranking/scoring improvements
- worker output quality

## Rules

1. One task per worktree.
2. Commit inside the worktree where the task happened.
3. Merge finished branches back into `main` from the main worktree.
4. Never put `.env`, SDK keys, receipts, generated proof files, or `node_modules` in Git.
5. Before switching tasks, run:

```bash
git status --short
```

If it prints changes, commit or intentionally discard them first.

## Helpful commands

List worktrees:

```bash
cd C:\Users\adars\Coding\hackathon
git worktree list
```

Check one worktree:

```bash
cd C:\Users\adars\Coding\hackathon-worktrees\tenderboard-live-croo
git status --short
```

Merge a finished branch into main:

```bash
cd C:\Users\adars\Coding\hackathon
git checkout main
git pull
git merge work/tenderboard-live-croo
git push
```
