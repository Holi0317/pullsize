import { App } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";
import { unwrap } from "./utils";
import { readConfig, type ConfigType } from "./services/config";
import { summarizeDiff } from "./services/summary";
import { deleteComment, updateComment } from "./services/comment";
import { createLabels, removePRLabels, setPRLabel } from "./services/label";
import { getPRInfo } from "./services/prinfo";

async function handle(app: App, installation_id: number, pr: PullRequest) {
  const { owner, repo, issue_number } = getPRInfo(pr);

  console.log(
    `Handling PR ${owner}/${repo}#${pr.number}. Installation ID = ${installation_id}`,
  );

  const octo = await app.getInstallationOctokit(installation_id);

  if (pr.state === "closed") {
    console.info("PR is closed. Ignoring the webhook");
    return;
  }

  console.log("Fetching diff for the PR");
  const response = await octo.request(
    "GET /repos/{owner}/{repo}/pulls/{pull_number}",
    {
      owner,
      repo,
      pull_number: issue_number,
      mediaType: {
        format: "diff",
      },
    },
  );
  // The cast is suggested here. Cast is necessary coz octokit does not support
  // mediaType in typing.
  // https://github.com/octokit/request.js/issues/463#issuecomment-1164800888
  const diffFile = response.data as unknown as string;

  let config: ConfigType;
  try {
    config = await readConfig(octo, pr);
  } catch (error) {
    console.error("Failed to read config", error);
    await updateComment(
      octo,
      pr,
      `Failed to read config. Pullsize bot is not operating!

Exception detail:
\`\`\`
${error}
\`\`\`
`,
    );
    return;
  }

  const resp = summarizeDiff(config, diffFile);

  console.log("Ran handler. Updating PR comment and label", resp);

  // Delete comment if there is any. We should not leave any comment on
  // successful run.
  await deleteComment(octo, pr);

  await createLabels(octo, pr, config);

  if (resp.label == null) {
    await removePRLabels(octo, pr, config);
  } else {
    await setPRLabel(octo, pr, config, resp.label);
  }
}

export function useOctoApp(env: Env) {
  const app = new App({
    appId: env.GH_APP_ID,
    privateKey: env.GH_PRIVATE_KEY,
    webhooks: { secret: env.GH_WEBHOOK_SECRET },
  });

  app.webhooks.on("pull_request.edited", (event) =>
    handle(
      app,
      unwrap(
        event.payload.installation?.id,
        "Missing installation.id in webhook payload",
      ),
      event.payload.pull_request,
    ),
  );
  app.webhooks.on("pull_request.synchronize", (event) =>
    handle(
      app,
      unwrap(
        event.payload.installation?.id,
        "Missing installation.id in webhook payload",
      ),
      event.payload.pull_request,
    ),
  );
  app.webhooks.on("pull_request.opened", (event) =>
    handle(
      app,
      unwrap(
        event.payload.installation?.id,
        "Missing installation.id in webhook payload",
      ),
      event.payload.pull_request,
    ),
  );
  app.webhooks.on("pull_request.reopened", (event) =>
    handle(
      app,
      unwrap(
        event.payload.installation?.id,
        "Missing installation.id in webhook payload",
      ),
      event.payload.pull_request,
    ),
  );

  return app;
}
