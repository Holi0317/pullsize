import type { Octokit } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";
import { z } from "zod";
import { Config } from "./config";

const ViewerSchema = z.object({
  viewer: z.object({
    databaseId: z.number(),
  }),
});

export class Updater {
  public constructor(
    private readonly octo: Octokit,
    private readonly pr: PullRequest,
  ) {}

  private get owner() {
    return this.pr.base.repo.owner.login;
  }

  private get repo() {
    return this.pr.base.repo.name;
  }

  private get prNum() {
    return this.pr.number;
  }

  /**
   * Find PR comment number to edit, if we have already left a comment there.
   *
   * If this is a new PR we haven't touched before, this will return `null`,
   * suggesting we should create a new comment.
   */
  private async findPRComment() {
    // IDK how to get the app's user ID with rest API. But this is trivial with
    // graphQL
    const viewerQuery = await this.octo.graphql(
      `query { viewer { databaseId } }`,
    );
    const viewer = ViewerSchema.parse(viewerQuery);

    // Only listing the first page for pr comments. This endpoint sorts comments
    // in ascending order of comment number (which means commenting order/creation
    // time). Assuming we are fast and be the first few bots leaving comments in
    // the PR.
    const comments = await this.octo.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNum,
      },
    );

    for (const comment of comments.data) {
      if (comment.user?.id === viewer.viewer.databaseId) {
        return comment.id;
      }
    }

    return null;
  }

  public async updateComment(comment: string | null) {
    const commentID = await this.findPRComment();

    if (comment == null) {
      if (commentID == null) {
        console.log(
          "Don't have comment and no comment reuqired. Skipping comment update",
        );
        return;
      }

      console.log("Deleting comment", commentID);

      await this.octo.request(
        "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: this.owner,
          repo: this.repo,
          comment_id: commentID,
        },
      );

      return;
    }

    if (commentID == null) {
      console.info("Cannot find existing PR comment. Leaving new comment");
      await this.octo.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: this.owner,
          repo: this.repo,
          issue_number: this.prNum,
          body: comment,
        },
      );
    } else {
      console.info(`Updating PR comment ${commentID}`);
      await this.octo.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: this.owner,
          repo: this.repo,
          comment_id: commentID,
          body: comment,
        },
      );
    }
  }

  public async createLabels() {
    const labels = await this.octo.request("GET /repos/{owner}/{repo}/labels", {
      owner: this.owner,
      repo: this.repo,
    });

    const labelMap = new Map(labels.data.map((l) => [l.name, l]));

    const promises = Config.labels.map(async (preset) => {
      const match = labelMap.get(preset.name);
      if (match == null) {
        console.info("Label does not exist. Creating the label.");
        await this.octo.request("POST /repos/{owner}/{repo}/labels", {
          owner: this.owner,
          repo: this.repo,
          name: preset.name,
          color: preset.color,
        });

        return;
      }

      if (match.color !== preset.color) {
        console.info("Updating label color", preset.name);

        await this.octo.request("PATCH /repos/{owner}/{repo}/labels/{name}", {
          owner: this.owner,
          repo: this.repo,
          name: preset.name,
          color: preset.color,
        });
      }
    });

    await Promise.all(promises);
  }

  public async updateLabel(label: string | null) {
    if (label == null) {
      return await this.removeLabels();
    }

    const labelSet = new Set(this.pr.labels.map((l) => l.name));

    if (labelSet.has(label)) {
      console.info("Label already applied. Skipping label update", label);
      return;
    }

    await this.removeLabels();

    console.info("Adding label to issue", label);
    await this.octo.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: this.prNum,
        labels: [label],
      },
    );
  }

  private async removeLabels() {
    const labelSet = new Set(this.pr.labels.map((l) => l.name));

    const promises = Config.labels.map(async (l) => {
      if (!labelSet.has(l.name)) {
        return;
      }

      console.info("Removing label from PR", l.name);
      await this.octo.request(
        "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
        {
          owner: this.owner,
          repo: this.repo,
          issue_number: this.prNum,
          name: l.name,
        },
      );
    });

    await Promise.all(promises);
  }
}
