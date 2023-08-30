const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  // Attempt to load credentials from the GitHub OIDC provider.
  const githubSecretAccessToken = core.getInput('github_token');
  if (!githubSecretAccessToken) {
    core.setFailed("Missing use with configuration in the github action, please add to the github workflow: 'github_token: ${{ secrets.GITHUB_TOKEN }}'");
    core.getInput('github_token', { required: true });
    throw Error('InvalidInput');
  }

  // https://docs.github.com/en/actions/learn-github-actions/contexts#example-contents-of-the-github-contex
  const { repository, repository_owner: owner, ref_name: currentRef, ref_type: triggerType } = github.context;
  if (triggerType !== 'branch') {
    core.info(`Skipping check because trigger type is not branch. Trigger Type: ${triggerType}, Ref: ${currentRef}`);
    return;
  }

  const octokit = github.getOctokit(githubSecretAccessToken);
  const branches = await octokit.rest.repos.listBranches({
    owner: owner,
    repo: repository
  });
  // https://docs.github.com/en/rest/actions/workflows?apiVersion=2022-11-28#create-a-workflow-dispatch-event
  const filteredBranches = branches.data.filter(branch => branch.name !== currentRef);
  await Promise.all(filteredBranches.map(async branch => {
    try {
      await octokit.rest.repos.createDispatchEvent({
        owner: owner,
        repo: repository,
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
