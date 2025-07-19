import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { captureError } from "@cfworker/sentry";
import z from "zod";
import { App } from "@octokit/app";
import { webhookSignatureMiddleware } from "./services/webhook";
import { getPRInfo } from "./services/prinfo";
import { readConfig, type ConfigType } from "./services/config";
import { deleteComment, updateComment } from "./services/comment";
import { summarizeDiff } from "./services/summary";
import { createLabels, removePRLabels, setPRLabel } from "./services/label";
import { allowActions, EventSchema } from "./services/webhook_schema";

const app = new Hono<{ Bindings: Env }>();

app.post(
  "/github/webhook",
  zValidator(
    "header",
    z.object({
      "x-github-hook-id": z.string(),
      "x-github-event": z.string(),
      "x-hub-signature-256": z.string(),
    }),
  ),
  webhookSignatureMiddleware,
  async (c) => {
    const headers = c.req.valid("header");
    const name = headers["x-github-event"];

    if (name === "ping") {
      return c.text("pong", 202);
    }

    if (name !== "pull_request") {
      return c.text(`unknown event name ${name}`, 400);
    }

    const event = EventSchema.parse(await c.req.json());

    if (!allowActions.has(event.action)) {
      return c.text("pr action not handled", 200);
    }

    const pr = event.pull_request;
    const { owner, repo, issue_number } = getPRInfo(pr);

    console.log(
      `Handling PR ${owner}/${repo}#${pr.number}. Installation ID = ${event.installation.id}`,
    );

    const app = new App({
      appId: c.env.GH_APP_ID,
      privateKey: c.env.GH_PRIVATE_KEY,
    });
    const octo = await app.getInstallationOctokit(event.installation.id);

    if (pr.state === "closed") {
      console.info("PR is closed. Ignoring the webhook");
      return c.text("ok", 202);
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
      return c.text("Bad config", 400);
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

    return c.text("ok", 202);
  },
);

app.notFound((c) => {
  return c.text("Not found", 404);
});

app.onError((err, c) => {
  console.error("Router raised exception", err);

  if (c.env.SENTRY_DSN) {
    const { posted } = captureError({
      sentryDsn: c.env.SENTRY_DSN,
      environment: "prod",
      release: "release",
      err,
      request: c.req.raw,
      user: "",
    });

    c.executionCtx.waitUntil(posted);
  }

  return c.text("Internal server error", { status: 500 });
});

export default app;
