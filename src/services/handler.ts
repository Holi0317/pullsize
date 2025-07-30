import type z from "zod";
import type { Context } from "hono";
import { App } from "@octokit/app";
import { allowActions, type EventSchema } from "./webhook_schema";
import { getPRInfo } from "./prinfo";
import { readConfig, type ConfigType } from "./config";
import { deleteComment, updateComment } from "./comment";
import { diffSize, getLabel } from "./summary";
import { createLabels, removePRLabels, setPRLabel } from "./label";

export async function handle(
  c: Context,
  event: z.infer<typeof EventSchema>,
): Promise<Response> {
  const pr = event.pull_request;
  const { owner, repo } = getPRInfo(pr);

  console.log(
    `Handling PR ${owner}/${repo}#${pr.number}. Installation ID = ${event.installation.id}, Action = ${event.action}`,
  );

  if (!allowActions.has(event.action)) {
    return c.text("pr action not handled", 200);
  }

  const app = new App({
    appId: c.env.GH_APP_ID,
    privateKey: c.env.GH_PRIVATE_KEY,
  });
  const octo = await app.getInstallationOctokit(event.installation.id);

  if (pr.state === "closed") {
    console.info("PR is closed. Ignoring the webhook");
    return c.text("ok", 202);
  }

  console.log("Fetching config");

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

  console.log("Fetching diff size");
  const size = await diffSize(octo, pr, config);
  const label = getLabel(config, size);
  console.log(
    `Diff size = ${size}. Label = ${label}. Updating PR comment and label`,
  );

  // Delete comment if there is any. We should not leave any comment on
  // successful run.
  await deleteComment(octo, pr);

  await createLabels(octo, pr, config);

  if (label == null) {
    await removePRLabels(octo, pr, config);
  } else {
    await setPRLabel(octo, pr, config, label);
  }

  return c.text("ok", 202);
}
