const core = require('@actions/core');
const github = require('@actions/github');
const { DateTime } = require('luxon');

async function runAction() {
  // Attempt to load credentials from the GitHub OIDC provider.
  const githubSecretAccessToken = core.getInput('github_token');
  if (!githubSecretAccessToken || githubSecretAccessToken === '{{ secrets.GITHUB_TOKEN }}') {
    // GitHub core library has a critical failure if we don't escape the $, seems like a malicious attack vector they aren't handling correctly
    // eslint-disable-next-line no-useless-escape
    core.setFailed("Missing use with configuration in the github action, please add to the github workflow: 'github_token: ${{ secrets.GITHUB_TOKEN }}'");
    core.getInput('github_token', { required: true });
    throw Error('InvalidInput');
  }

  // https://docs.github.com/en/actions/learn-github-actions/contexts#example-contents-of-the-github-contex
  if (!github.context.payload.ref) {
    core.info('Brand is not part of repository, skipping check.');
    return;
  }
  const currentRef = github.context.payload.ref.replace(/^refs\/heads\//, '');
  const workflowTarget = github.context.workflow;
  core.info(`Branch Ref: ${currentRef}, Workflow: ${workflowTarget}`);
  const [owner, repo] = github.context.payload.repository.full_name.split('/');

  const octokit = github.getOctokit(githubSecretAccessToken);

  const openPullRequestsResponse = await octokit.rest.pulls.list({ owner, repo, state: 'open', base: currentRef, per_page: 100 });
  core.info(`Relevant open pull requests: [${openPullRequestsResponse.data.map(pr => pr.number).join(', ')}]`);

  const prMap = openPullRequestsResponse.data.reduce((acc, pr) => { acc[pr.number] = true; return acc; }, {});

  const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: workflowTarget, event: 'pull_request', created: `>= ${DateTime.utc().minus({ month: 1 }).toISODate()}`, per_page: 100
  });

  const workflowRunsForAffectedPrs = workflowRuns.data.workflow_runs.filter(run => run.pull_requests?.some(pr => prMap[pr.number]));

  const latestRunPerPullRequestMap = {};
  workflowRunsForAffectedPrs.map(workflowRun => {
    workflowRun.pull_requests?.map(pr => {
      latestRunPerPullRequestMap[pr.number] = Math.max(latestRunPerPullRequestMap[pr.number], latestRunPerPullRequestMap[pr.number] || 0);
    });
  });

  const latestWorkflowRuns = Object.values(latestRunPerPullRequestMap);

  await Promise.all(latestWorkflowRuns.map(async runId => {
    try {
      await core.info(`Attempting to rerun: ${runId}`);
      await octokit.rest.actions.reRunWorkflow({
        owner, repo, run_id: runId
      });
    } catch (error) {
      const workflowRun = workflowRunsForAffectedPrs.find(run => run.id === runId);
      core.error(`Failed to automatically retrigger pull request: ${workflowRun.pull_requests?.map(pr => pr.number).join(',')}: ${error.status} - ${error.message}`);
    }
  }));
}

exports.run = runAction;

if (require.main === module) {
  runAction();
}
