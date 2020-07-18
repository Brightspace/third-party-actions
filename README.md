# gh-action-node-bump-version-pr

Bumps Node version and creates a pull request. Can be paired with
[publish-me-maybe](https://www.npmjs.com/package/publish-me-maybe).

## Example usage

```yaml
name: Scheduled dependencies update
on:
  workflow_dispatch:
    inputs:
      version-type:
        default: patch
        description: Bumps the package version based on value (e.g. patch)
        required: true
jobs:
  update-deps:
    name: Bump Node version
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v2
      - uses: neverendingqs/gh-action-node-bump-version-pr@v1.0.0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          version-type: ${{ github.event.inputs.version-type }}
```
