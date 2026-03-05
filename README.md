# `.github` (personal) - standards and scripts

This repository is my **source of truth** for:
- Issue / PR / Release templates
- branch and commit conventions
- release process (SemVer + tags)
- `pre-commit` hooks
- utility scripts (`gitsync`, `setup-env-branches`, `release`)

## Requirements (WSL)
- Node 18+
- git
- GitHub CLI (`gh`) with login: `gh auth login`
- `pre-commit`

`pre-commit` installation:
```bash
pipx install pre-commit
```

If `pipx` is not available:
```bash
python3 -m pip install --user --upgrade --break-system-packages pre-commit
```

## Install commands with symlink
From the repository root:

```bash
ln -sf ./scripts/gitsync.js ~/.local/bin/gitsync
ln -sf ./scripts/setup-env-branches.js ~/.local/bin/setup-env-branches
ln -sf ./scripts/release.js ~/.local/bin/release

chmod +x ./scripts/gitsync.js \
  ./scripts/setup-env-branches.js \
  ./scripts/release.js
```

Ensure `~/.local/bin` is in PATH (zsh):
```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

This keeps documentation aligned with local usage in this repository.

## Optional aliases (zsh)
```bash
echo 'alias gs="gitsync --sync --base main --branch chore/sync-standards"' >> ~/.zshrc
echo 'alias sebs="setup-env-branches --base main --env dev --env staging --env prod"' >> ~/.zshrc
echo 'alias rprep="release prepare --type auto --base main"' >> ~/.zshrc
echo 'alias rpub="release publish --type auto --base main"' >> ~/.zshrc
source ~/.zshrc
```

## Configure template source
Per repository (local):
```bash
gitsync config set --source OWNER/.github --ref main
```

Global (all repositories):
```bash
gitsync config set --global --source OWNER/.github --ref main
```

Future switch to organization:
```bash
gitsync config set --global --source MYORG/.github --ref main
```

## `gitsync` commands
Configuration:
```bash
gitsync config get
gitsync config get --global
gitsync config set --source OWNER/.github --ref main
gitsync config set --global --source OWNER/.github --ref main
```

Synchronization:
```bash
gitsync --sync
gitsync --sync --base main --branch chore/sync-standards
gitsync --sync --source OWNER/.github --ref main
```

`gitsync --sync` now auto-applies:
- `.pre-commit-config.yaml` based on detected stack
- `.github/workflows/ci.yml` based on detected stack, with Docker, docker-compose, and k8s validation jobs
- `.github/ISSUE_TEMPLATE/config.yml` `contact_links` based on current `origin` (`owner/repo`)

## Sync templates in target repository
Inside the target repository:

```bash
gitsync --sync --base main --branch chore/sync-standards
```

Prerequisite: target repository must have a valid `origin` remote configured and reachable.

## Create environment branches (`dev`, `staging`, `prod`)
Inside the repository:

```bash
setup-env-branches --base main --env dev --env staging --env prod
```

## Release (version bump + tag + GitHub Release)
```bash
release prepare --type auto --base main
release publish --type auto --base main
```

## Promotion flow
Required flow:
1. work branch -> `dev`
2. `dev` -> `staging`
3. `staging` -> `prod`
4. `prod` -> `main`
5. on `main`: tag + GitHub Release

Protection rule:
- no direct commits to `dev`, `staging`, `prod`, or `main`

## Docs
- `docs/branching.md`
- `docs/conventional-commits.md`
- `docs/pre-commit.md`
- `docs/release-and-tags.md`
