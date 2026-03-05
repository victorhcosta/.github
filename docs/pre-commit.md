# pre-commit (hooks) - usage

## Install (WSL)
Recommended via pipx:

```bash
pipx install pre-commit
```

## Enable in repository
Inside the repository:

```bash
pre-commit install
pre-commit install --hook-type commit-msg
```

## Run manually
```bash
pre-commit run --all-files
```

## Notes
`pre-commit` is configured through `.pre-commit-config.yaml`.

Useful hook examples:
- generic hooks (whitespace, EOF, YAML)
- stack-specific hooks (for example: `npm test`, `mix test`, `mvn test`)
