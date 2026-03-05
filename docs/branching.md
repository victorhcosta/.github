# Branch Prefixes

Objective: make branch purpose obvious from its name.

## Recommended prefixes
- `feat/` - new feature
- `fix/` - bug fix
- `chore/` - maintenance (deps, tooling, CI, config)
- `docs/` - documentation
- `refactor/` - internal change without behavior change
- `test/` - tests
- `perf/` - performance
- `ci/` - CI/CD
- `build/` - build system
- `hotfix/` - urgent production fix (avoid whenever possible)

### Rule for `test/`
Use `test/` when the change is focused only on automated tests:
- add new tests
- fix broken tests
- refactor test structure (mocks, fixtures, helpers)

If production code changes and tests are included, keep the main prefix:
- `fix/` for bug fixes
- `feat/` for new features

### Rule for `perf/`
Use `perf/` when the main goal is performance:
- reduce latency
- optimize queries or cache usage
- reduce CPU or memory usage

If there is no clear performance goal, use `chore/` or `refactor/`.

### Rule for `ci/`
Use `ci/` when the main change is in the integration/delivery pipeline:
- GitHub Actions workflow updates
- lint/test/build/deploy jobs
- runner configuration and execution strategy

If the change is in the local project build system, use `build/`.

### Rule for `build/`
Use `build/` when the main change is in build/packaging:
- build scripts
- compiler plugins and tooling
- packaging and artifact adjustments

If the change is only in CI pipeline configuration, use `ci/`.

## Examples
- `feat/auth-login`
- `fix/token-expiration`
- `chore/sync-templates`
- `docs/release-process`
- `refactor/user-permissions`
- `test/auth-service-unit-tests`
- `perf/reduce-query-n-plus-one`
- `ci/add-e2e-job`
- `build/upgrade-gradle-wrapper`
- `hotfix/remove-hardcoded-jwt-secret-env`
