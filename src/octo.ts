import { App, type Octokit } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";
import parseGitDiff from "parse-git-diff";

async function handle(pr: PullRequest, octokit: Octokit) {
  console.log(`Handling PR ${pr.base.repo.full_name}#${pr.number}`);

  if (pr.state === "closed") {
    console.info("PR is closed. Ignoring the webhook");
    return;
  }

  console.log("Fetching diff for the PR");
  const response = await octokit.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      pull_number: pr.number,
      mediaType: {
        format: "diff",
      },
    },
  );
  // The cast is suggested here. Cast is necessary coz octokit does not support
  // mediaType in typing.
  // https://github.com/octokit/request.js/issues/463#issuecomment-1164800888
  const diffFile = response.data as unknown as string;

  parseGitDiff(diffFile);
}

export function useOctoApp(env: Env) {
  const app = new App({
    appId: env.GH_APP_ID,
    privateKey: env.GH_PRIVATE_KEY,
    webhooks: { secret: env.GH_WEBHOOK_SECRET },
  });

  app.webhooks.on("pull_request.edited", (event) =>
    handle(event.payload.pull_request, app.octokit),
  );
  app.webhooks.on("pull_request.synchronize", (event) =>
    handle(event.payload.pull_request, app.octokit),
  );
  app.webhooks.on("pull_request.opened", (event) =>
    handle(event.payload.pull_request, app.octokit),
  );
  app.webhooks.on("pull_request.reopened", (event) =>
    handle(event.payload.pull_request, app.octokit),
  );

  return app;
}
