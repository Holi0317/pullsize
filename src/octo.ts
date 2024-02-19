import { App } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";
import { Handler } from "./handler";
import { unwrap } from "./utils";
import { CommentUpdater, LabelUpdater } from "./updater";
import { ConfigType, readConfig } from "./config";
import { Context } from "./context";

async function handle(app: App, installation_id: number, pr: PullRequest) {
  console.log(
    `Handling PR ${pr.base.repo.full_name}#${pr.number}. Installation ID = ${installation_id}`,
  );

  const octo = await app.getInstallationOctokit(installation_id);
  const ctx = new Context(octo, pr);

  if (ctx.pr.state === "closed") {
    console.info("PR is closed. Ignoring the webhook");
    return;
  }

  console.log("Fetching diff for the PR");
  const response = await ctx.octo.request(
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

  const commentUpdater = new CommentUpdater(ctx);

  let config: ConfigType;
  try {
    config = await readConfig(ctx);
  } catch (error) {
    console.error("Failed to read config", error);
    await commentUpdater.updateComment(`Failed to read config. Pullsize bot is not operating!

Exception detail:
\`\`\`
${error}
\`\`\`
`);
    return;
  }

  const handler = new Handler(config);
  const resp = await handler.run(diffFile);

  console.log("Ran handler. Updating PR comment and label", resp);

  const labelUpdater = new LabelUpdater(ctx, config);
  await commentUpdater.updateComment(resp.comment);
  await labelUpdater.createLabels();
  await labelUpdater.updateLabel(resp.label);
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
