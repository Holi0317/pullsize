import { App } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";
import { genDiffSummary } from "./diff";

/**
 * Find PR comment number to edit, if we have already left a comment there.
 *
 * If this is a new PR we haven't touched before, this will return `null`,
 * suggesting we should create a new comment.
 */
async function findPRComment(app: App, pr: PullRequest) {
  const appInfo = await app.octokit.request("GET /app");

  // Only listing the first page for pr comments. This endpoint sorts comments
  // in ascending order of comment number (which means commenting order/creation
  // time). Assuming we are fast and be the first few bots leaving comments in
  // the PR.
  const comments = await app.octokit.request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      issue_number: pr.number,
    },
  );

  for (const comment of comments.data) {
    if (comment.user?.id === appInfo.data.id) {
      return comment.id;
    }
  }

  return null;
}

async function handle(pr: PullRequest, app: App) {
  console.log(`Handling PR ${pr.base.repo.full_name}#${pr.number}`);

  if (pr.state === "closed") {
    console.info("PR is closed. Ignoring the webhook");
    return;
  }

  console.log("Fetching diff for the PR");
  const response = await app.octokit.request(
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

  const summary = genDiffSummary(diffFile);

  console.log("Finding existing PR comment");
  const commentID = await findPRComment(app, pr);

  if (commentID == null) {
    console.info("Cannot find existing PR. Leaving new comment");
    await app.octokit.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        issue_number: pr.number,
        body: summary,
      },
    );
  } else {
    console.info(`Updating PR comment ${commentID}`);
    await app.octokit.request(
      "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
      {
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        comment_id: commentID,
        body: summary,
      },
    );
  }
}

export function useOctoApp(env: Env) {
  const app = new App({
    appId: env.GH_APP_ID,
    privateKey: env.GH_PRIVATE_KEY,
    webhooks: { secret: env.GH_WEBHOOK_SECRET },
  });

  app.webhooks.on("pull_request.edited", (event) =>
    handle(event.payload.pull_request, app),
  );
  app.webhooks.on("pull_request.synchronize", (event) =>
    handle(event.payload.pull_request, app),
  );
  app.webhooks.on("pull_request.opened", (event) =>
    handle(event.payload.pull_request, app),
  );
  app.webhooks.on("pull_request.reopened", (event) =>
    handle(event.payload.pull_request, app),
  );

  return app;
}
