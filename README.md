# Approved third-party GitHub Actions for D2L

All third-party authored GitHub Actions at D2L have to be approved.
We mirror the repos into independent branches of [Brightspace/third-party-actions](https://github.com/brightspace/third-party-actions).

## Usage

Instead of using third-party actions directly, like this:

```yaml
uses: actions/checkout@v2
```

Use the mirrors from this repo, like this:

```yaml
- uses: Brightspace/third-party-actions@actions/checkout
```

There is no `@v2` (etc.) when using this repo.
We try to stick to a consistent version of each action across our org (configured and maintained by Dependabot in [third-party-actions-config](https://github.com/Brightspace/third-party-actions-config).

## Available actions

Here's what's available so far:

Repository | Description
-----------|------------
[actions/checkout](https://github.com/Brightspace/third-party-actions/tree/actions/checkout) | Checkout a Git repository at a particular version
[actions/github-script](https://github.com/Brightspace/third-party-actions/tree/actions/github-script) | Run simple scripts using the GitHub client
[actions/labeler](https://github.com/Brightspace/third-party-actions/tree/actions/labeler) | Label pull requests by files altered
[actions/setup-dotnet](https://github.com/Brightspace/third-party-actions/tree/actions/setup-dotnet) | Set up a specific version of the .NET Core CLI in the PATH and set up authentication to a private NuGet repository
[actions/setup-node](https://github.com/Brightspace/third-party-actions/tree/actions/setup-node) | Setup a Node.js environment and add it to the PATH, additionally providing proxy support
[actions/stale](https://github.com/Brightspace/third-party-actions/tree/geertvdc/stale) | Close issues and pull requests with no recent activity
[aws-actions/amazon-ecs-deploy-task-definition](https://github.com/Brightspace/third-party-actions/tree/aws-actions/amazon-ecs-deploy-task-definition) | Registers an Amazon ECS task definition, and deploys it to an ECS service
[aws-actions/amazon-ecs-render-task-definition](https://github.com/Brightspace/third-party-actions/tree/aws-actions/amazon-ecs-render-task-definition) | Inserts a container image URI into a container definition in an Amazon ECS task definition JSON file, creating a new file.
[aws-actions/configure-aws-credentials](https://github.com/Brightspace/third-party-actions/tree/aws-actions/configure-aws-credentials) | Configure AWS credential and region environment variables for use with the AWS CLI and AWS SDKs
[coverallsapp/github-action](https://github.com/Brightspace/third-party-actions/tree/coverallsapp/github-action) | Posts your test suite's LCOV coverage data to coveralls.io for analysis, change tracking, and notifications
[geertvdc/setup-hub](https://github.com/Brightspace/third-party-actions/tree/geertvdc/setup-hub) | Setup your Github Actions runner with Hub CLI
[hashicorp/setup-terraform](https://github.com/Brightspace/third-party-actions/tree/hashicorp/setup-terraform) | Sets up Terraform CLI in your GitHub Actions workflow.
[hashicorp/terraform-github-actions](https://github.com/Brightspace/third-party-actions/tree/hashicorp/terraform-github-actions) | **DEPRECATED** Runs Terraform commands via GitHub Actions.
[jakejarvis/hugo-build-action](https://github.com/Brightspace/third-party-actions/tree/jakejarvis/hugo-build-action) | Hugo as an action, with extended support and legacy versions
[micnncim/action-label-syncer](https://github.com/Brightspace/third-party-actions/tree/micnncim/action-label-syncer) | Sync GitHub labels in the declarative way.
[omsmith/actions-tasklists](https://github.com/Brightspace/third-party-actions/tree/omsmith/actions-tasklists) | Turn Pull Request tasklists into actionable PR statuses

## Adding more

This repo is generated and maintained by [Brightspace/third-party-actions-config](https://github.com/Brightspace/third-party-actions-config).

## Why two repos?

The third-party actions we mirror in this repo often have their own workflows.
We don't want to run them, because that could cause security problems (e.g. via self-hosted runners, etc.)
So we've disabled actions in this repo.

However, the automatic syncing is itself built on actions.
There is no way to whitelist particular workflows, so we went with a split repo setup.
