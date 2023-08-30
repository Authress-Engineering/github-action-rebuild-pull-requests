const core = require('@actions/core');
const github = require('@actions/github');
const stringify = require('json-stringify-safe');
const { DateTime } = require('luxon');

async function runAction() {
  // Attempt to load credentials from the GitHub OIDC provider.
  const githubSecretAccessToken = core.getInput('github_token');
  if (!githubSecretAccessToken || githubSecretAccessToken === '{{ secrets.GITHUB_TOKEN }}') {
    core.setFailed("Missing use with configuration in the github action, please add to the github workflow: 'github_token: ${{ secrets.GITHUB_TOKEN }}'");
    core.getInput('github_token', { required: true });
    throw Error('InvalidInput');
  }

  // https://docs.github.com/en/actions/learn-github-actions/contexts#example-contents-of-the-github-contex
  const currentRef = github.context.payload.ref;
  core.info(`Branch Ref: ${currentRef}`);
  const [owner, repo] = github.context.payload.repository.full_name.split('/');

  const octokit = github.getOctokit(githubSecretAccessToken);
  // const branches = await octokit.rest.repos.listBranches({
  //   owner: owner,
  //   repo: repo
  // });
  // // https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#create-a-workflow-dispatch-event
  // const filteredBranches = branches.data.filter(branch => branch.name !== currentRef);

  const openPullRequests = await octokit.rest.pulls.list({ owner, repo, state: 'open' });
  core.info(`Open pull requests: ${openPullRequests.data.map(pr => pr.number)}`);

  // openPullRequests.data.filter(pr => pr.base.ref === currentRef).map(pr => pr.)
  core.info(`Open PRs: ${stringify(openPullRequests.data)}`);

  const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: github.workflow, branch: currentRef, event: 'pull_request', created: `>= ${DateTime.utc().minus({ month: 1 }).toISODate()}`
  });

  const workflowRunsForAffectedPrs = workflowRuns.data.workflow_runs;
  core.info(stringify(workflowRunsForAffectedPrs));
  await Promise.all(workflowRunsForAffectedPrs.map(async run => {
    try {
      await core.info(`Attempting to rerun: ${run.run_id}`);
      // await octokit.rest.actions.reRunWorkflow({
      //   owner, repo, run_id: run.run_id
      // });
    } catch (error) {
      core.error(`Failed to automatically trigger branch ${run.pull_requests?.map(pr => pr.number).join(',')}: ${error.code} - ${error.message}`);
    }
  }));
}

exports.run = runAction;

if (require.main === module) {
  runAction();
}
