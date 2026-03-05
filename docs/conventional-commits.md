# Conventional Commits

Conventional Commits is a standard for commit messages.
Using this standard enables:
- automatic version calculation (SemVer)
- more organized changelog/release notes
- a consistent history

## Format

```text
type(scope)?: subject

body (optional)

footer (optional)
```

Where:
- `type`: `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `ci`, `build`, `perf`, and others
- `scope`: optional (for example: `auth`, `api`, `ui`)
- `subject`: short, imperative, no period

## Example (multi-line)
Command (opens editor):
```bash
git commit
```

Message:
```text
feat(auth): add refresh-token rotation

- add session refresh endpoint
- invalidate old refresh token after use
- add service tests for rotation flow
```

## Typical mapping -> SemVer
- `fix:` -> PATCH
- `feat:` -> MINOR
- `feat!:` or footer `BREAKING CHANGE:` -> MAJOR

## When to use `BREAKING CHANGE`
Use `BREAKING CHANGE` when compatibility is broken and consumers must take action, for example:
- API contract changes (request/response)
- public endpoint removal or rename
- default behavior changes that impact existing clients
- mandatory configuration changes required to run the application

If consumers do not need to adapt, do not use `BREAKING CHANGE`.

## Example with breaking change
```text
feat!: change auth response format

BREAKING CHANGE: clients must read tokens from `data.tokens`
```
