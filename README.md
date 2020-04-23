# Approved third-party GitHub Actions for D2L

All third-party authored GitHub Actions at D2L have to be approved.
We mirror the repos into independent branches of [Brightspace/third-party-actions](https://github.com/brightspace/third-party-actions).
Here's what's available so far:

(Note that this list is maintained manually for the time being)

* [actions/checkout](https://github.com/Brightspace/third-party-actions/tree/actions/checkout): clone your code
* [actions/labeler](https://github.com/Brightspace/third-party-actions/tree/actions/labeler): label your PRs based on files touched
* [actions/setup-dotnet](https://github.com/Brightspace/third-party-actions/tree/actions/setup-dotnet): install and configure the .NET SDK
* [actions/setup-node](https://github.com/Brightspace/third-party-actions/tree/actions/setup-node): install and configure NodeJS
* [actions/stale](https://github.com/Brightspace/third-party-actions/tree/geertvdc/stale): automatically close inactive issues and PRs
* [aws-actions/amazon-ecs-deploy-task-definition](https://github.com/Brightspace/third-party-actions/tree/aws-actions/amazon-ecs-deploy-task-definition): Registers an Amazon ECS task definition, and deploys it to an ECS service
* [geertvdc/setup-hub](https://github.com/Brightspace/third-party-actions/tree/geertvdc/setup-hub): configures the hub CLI for GitHub automations
* [hashicorp/terraform-github-actions](https://github.com/Brightspace/third-party-actions/tree/hashicorp/terraform-github-actions): everything you need for Terraform
* [jakejarvis/hugo-build-action](https://github.com/Brightspace/third-party-actions/tree/jakejarvis/hugo-build-action): Hugo is a static site generator
* [omsmith/actions-tasklists](https://github.com/Brightspace/third-party-actions/tree/omsmith/actions-tasklists): creates build statuses for tasks in PRs

The configuration lives in [Brightspace/third-party-actions-config](https://github.com/Brightspace/third-party-actions-config) so that we can disable (other peoples) actions in the this repo.
