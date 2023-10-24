# GitHub Action - Automatically Rebuild Pull Requests
This is a GitHub Action to automatically rebuild pull requests when the pull request target changes.

This is an open source project managed by the [Authress Engineering team](https://authress.io).

<p align="center">
  <a href="https://authress.io" alt="Authress Engineering">
    <img src="https://img.shields.io/static/v1?label=Authress+Engineering&message=GitHub%20Action&color=%23FBAF0B&logo=androidauto&logoColor=%23FBAF0B"></a>
  <a href="https://github.com/Rhosys/github-action-rebuild-pull-requests/actions/workflows/release.yml" alt="GitHub Marketplace Link">
    <img src="https://github.com/Rhosys/github-action-rebuild-pull-requests/actions/workflows/release.yml/badge.svg"></a>
</p>

Review the GitHub action in the marketplace: [GitHub Rebuild Pull Requests](https://github.com/marketplace/actions/rebuild-stale-pullrequests)

## How does this GitHub action work?
When a branch in your GitHub repository is updated, this GitHub action automatically finds open pull requests that target that branch and forces a rebuild for them.

## Why?
This GitHub action exists because GitHub will not re-trigger builds. That means when a PR targets a branch and that branch changes, that PR is now out of date. That meas tests are not rerun, validations are not rechecked. Breaking changes will be present and not validated. By adding in this action, those PR will be automatically rerun.

## Usage
In your GitHub action workflow add the follow step.

```yaml
# Important! This is required: https://docs.github.com/en/rest/actions/workflow-jobs?apiVersion=2022-11-28
permissions:
  contents: read
  actions: write

jobs:
  build:
    steps:
    - uses: actions/checkout@v3
    # Put this action anywhere in your GitHub action workflow
    - uses: rhosys/github-action-rebuild-pull-requests@v1.0
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
```
