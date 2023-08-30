const core = require('@actions/core');
const github = require('@actions/github');
// const stringify = require('json-stringify-safe');

async function run() {
  // Attempt to load credentials from the GitHub OIDC provider.
  const githubSecretAccessToken = core.getInput('github_token');
  if (!githubSecretAccessToken || githubSecretAccessToken === '{{ secrets.GITHUB_TOKEN }}') {
    core.setFailed("Missing use with configuration in the github action, please add to the github workflow: 'github_token: ${{ secrets.GITHUB_TOKEN }}'");
    core.getInput('github_token', { required: true });
    throw Error('InvalidInput');
  }

  // https://docs.github.com/en/actions/learn-github-actions/contexts#example-contents-of-the-github-contex
  const currentRef = github.context.payload.ref;
  const [owner, repo] = github.context.payload.repository.full_name.split('/');

  const octokit = github.getOctokit(githubSecretAccessToken);
  const branches = await octokit.rest.repos.listBranches({
    owner: owner,
    repo: repo
  });
  // https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#create-a-workflow-dispatch-event
  const filteredBranches = branches.data.filter(branch => branch.name !== currentRef);

  const workflowRuns = await octokit.rest.actions.listWorkflowRuns({
    owner, repo, workflow_id: github.workflow, branch: currentRef, event: 'pull_request', created: '<= '
  });
  workflowRuns.data.workflow_runs.filter(run => run.event)
  await Promise.all(filteredBranches.map(async branch => {
    try {
      await octokit.rest.actions.reRunWorkflow({
        owner, repo, run_id: runID
      });
      // await octokit.rest.actions
      await octokit.rest.repos.createDispatchEvent({
        owner: owner,
        repo: repo,
        workflow_id: github.workflow,
        ref: branch
      });
    } catch (error) {
      core.error(`Failed to automatically trigger branch ${branch}: ${error.code} - ${error.message}`);
    }
  }));
}

exports.run = run;

if (require.main === module) {
  run();
}
