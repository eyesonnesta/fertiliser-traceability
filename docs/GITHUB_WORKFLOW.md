# GitHub Workflow

## Branches

- `main` stores the stable final version.
- `develop` is the shared integration branch.
- No extra feature branches are used in this workflow.

## Repository Roles

- Obino's repository: `https://github.com/nyam0s1/fertiliser-traceability.git`
- Robert's repository: `https://github.com/eyesonnesta/fertiliser-traceability.git`

## Robert Backend Flow

```powershell
git checkout develop
git fetch upstream
git pull upstream develop
git status --short --branch
```

Stage only backend files for each backend commit:

```powershell
git add backend/<module-files>
git diff --cached --name-status
git commit -m "module backend: clear action message"
git push origin develop
```

## Obino Frontend Flow

```powershell
git checkout develop
git pull origin develop
git status --short --branch
```

Stage only frontend files for each frontend commit:

```powershell
git add frontend/<module-files>
git diff --cached --name-status
git commit -m "module frontend: clear action message"
git push origin develop
```

## Commit Discipline

Good commit messages name the module, side, and action:

```text
auth backend: add login security and password recovery workflow
stock frontend: migrate stock registration and QR inspection screens
reports backend: add custody audit reports and CSV export
```

Avoid vague messages such as `update`, `changes`, or `work done`.

## Final Merge

After verification:

```powershell
git checkout main
git pull origin main
git merge develop
git push origin main
```

Suggested merge message:

```text
merge: promote verified develop build to main
```
