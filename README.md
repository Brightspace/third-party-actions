# Upload Code Coverage

Upload a Cobertura XML coverage report to GitHub's code coverage API.

## Usage

```yaml
- uses: actions/upload-code-coverage@v1
  with:
    file: cobertura.xml
    language: Java
    label: code-coverage/jacoco
```

The action handles everything else automatically: gzip/base64 encoding, resolving the correct commit SHA and ref, detecting PR number (from both `pull_request` and `push` events), and calling the upload API.

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| `file` | Yes | Path to the Cobertura XML coverage report |
| `language` | Yes | Linguist language name (e.g. `Java`, `Go`, `Python`) |
| `label` | Yes | Label for the report (e.g. `code-coverage/jacoco`) |
| `token` | No | GitHub token (defaults to `github.token`) |

## Permissions

The calling workflow or job must grant `code-quality: write`. The action cannot declare this itself.

```yaml
permissions:
  contents: read
  code-quality: write
```

For push-only workflows where the action looks up PR numbers via `gh pr list`, also add `pull-requests: read`.

## Event handling

The action auto-detects the event type and resolves the correct values:

- **`pull_request` / `pull_request_target`**: Uses the PR head SHA and ref (not the merge commit), and includes the PR number.
- **`push`**: Uses `github.sha` and `github.ref`, and looks up whether the branch has an open PR via `gh pr list`.

This means it works with both patterns — workflows triggered by `pull_request` and push-only workflows that serve PRs via branch pushes.

## Full example (separate upload job)

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha || github.sha }}

      # ... build and generate cobertura.xml ...

      - uses: actions/upload-artifact@v4
        if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository
        with:
          name: cobertura-report
          path: cobertura.xml

  upload-coverage:
    needs: build
    if: ${{ !cancelled() && needs.build.result == 'success' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}
    runs-on: ubuntu-latest
    permissions:
      contents: read
      code-quality: write
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: cobertura-report

      - uses: actions/upload-code-coverage@v1
        with:
          file: cobertura.xml
          language: Java
          label: code-coverage/jacoco
```

## Caveats

- **Fork PRs are not supported.** Pull requests from forks don't have write access to the base repository, so the action cannot upload coverage. When a fork PR is detected, the action exits gracefully with a notice — it won't fail your CI.
- **Merge queue runs are skipped.** Coverage should be uploaded for PRs and the default branch, making merge queue uploads unnecessary. The action logs a warning and exits successfully.
