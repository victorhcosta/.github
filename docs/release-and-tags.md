# Releases, Tags, and SemVer

## SemVer
Format: `MAJOR.MINOR.PATCH`

- PATCH: bug fix (`1.3.3 -> 1.3.4`)
- MINOR: backward-compatible feature (`1.3.3 -> 1.4.0`)
- MAJOR: breaking change (`1.3.3 -> 2.0.0`)

## Tags vs branches
- Branch: moving pointer (`main`, `dev`, `staging`, `prod`)
- Tag: immutable milestone (`v1.4.0`)

For rollback, prefer the previous tag.

## When to create a Release
Recommended: **tag + GitHub Release after merge into `main`**.

## Environment promotion flow

Protected branch rules:
- no direct commits to `dev`, `staging`, `prod`, or `main`
- every change starts in a work branch (`feat/*`, `fix/*`, and so on) and moves up through pull requests

Required flow:
1. `work branch` -> `dev`
2. `dev` -> `staging`
3. `staging` -> `prod`
4. `prod` -> `main`
5. on `main`: tag + GitHub Release

## Practical flow with scripts
1. Run `release prepare`:
1. creates a branch from `origin/main`
1. bumps version in the proper project file (Node/Elixir/Java)
1. commits, pushes, and opens a PR to `main`
1. After merge, run `release publish`:
1. creates an annotated tag
1. creates a GitHub Release with generated notes
