/**
 * GitHub comment related function.
 *
 * Main assumption here is this bot will at most leave a single comment to the
 * PR thread for unexpected error. In normal operation, this bot should not
 * leave any comment.
 *
 * @module
 */

import * as z from "zod";
import type { Octokit } from "@octokit/core";
import { getPRInfo } from "./prinfo";
import type { PullRequest } from "./webhook_schema";

const ViewerSchema = z.object({
  viewer: z.object({
    databaseId: z.number(),
  }),
});

/**
 * Find PR comment number to edit, if we have already left a comment there.
 *
 * If this is a new PR we haven't touched before, this will return `null`,
 * suggesting we should create a new comment.
 *
 * @returns Comment id number if this bot has left a comment before, null
 * otherwise.
 */
async function findPRComment(octo: Octokit, pr: PullRequest) {
  const { owner, repo, issue_number } = getPRInfo(pr);

  // IDK how to get the app's user ID with rest API. But this is trivial with
  // graphQL
  const viewerQuery = await octo.graphql(`query { viewer { databaseId } }`);
  const viewer = ViewerSchema.parse(viewerQuery);

  // Only listing the first page for pr comments. This endpoint sorts comments
  // in ascending order of comment number (which means commenting order/creation
  // time). Assuming we are fast and be the first few bots leaving comments in
  // the PR.
  const comments = await octo.request(
    "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
    {
      owner,
      repo,
      issue_number,
    },
  );

  for (const comment of comments.data) {
    if (comment.user?.id === viewer.viewer.databaseId) {
      return comment.id;
    }
  }

  return null;
}

/**
 * Delete comment left by this bot in the PR.
 *
 * If comment is not found, this will do nothing.
 */
export async function deleteComment(octo: Octokit, pr: PullRequest) {
  const commentID = await findPRComment(octo, pr);
  const { owner, repo } = getPRInfo(pr);

  if (commentID == null) {
    console.log(
      "Don't have comment and no comment reuqired. Skipping comment update",
    );
    return;
  }

  console.log("Deleting comment", commentID);

  await octo.request(
    "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
    {
      owner,
      repo,
      comment_id: commentID,
    },
  );
}

/**
 * Create or update comment from this bot.
 */
export async function updateComment(
  octo: Octokit,
  pr: PullRequest,
  comment: string,
) {
  const commentID = await findPRComment(octo, pr);
  const { owner, repo, issue_number } = getPRInfo(pr);

  if (commentID == null) {
    console.info("Cannot find existing PR comment. Leaving new comment");
    await octo.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner,
        repo,
        issue_number,
        body: comment,
      },
    );
  } else {
    console.info(`Updating PR comment ${commentID}`);
    await octo.request(
      "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
      {
        owner,
        repo,
        comment_id: commentID,
        body: comment,
      },
    );
  }
}
