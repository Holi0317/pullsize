import { z } from "zod";
import type { ConfigType } from "./config";
import type { Context } from "./context";

const ViewerSchema = z.object({
  viewer: z.object({
    databaseId: z.number(),
  }),
});

export class CommentUpdater {
  public constructor(private readonly ctx: Context) {}

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

      await this.ctx.octo.request(
        "DELETE /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: this.ctx.owner,
          repo: this.ctx.repo,
          comment_id: commentID,
        },
      );

      return;
    }

    if (commentID == null) {
      console.info("Cannot find existing PR comment. Leaving new comment");
      await this.ctx.octo.request(
        "POST /repos/{owner}/{repo}/issues/{issue_number}/comments",
        {
          owner: this.ctx.owner,
          repo: this.ctx.repo,
          issue_number: this.ctx.prNum,
          body: comment,
        },
      );
    } else {
      console.info(`Updating PR comment ${commentID}`);
      await this.ctx.octo.request(
        "PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}",
        {
          owner: this.ctx.owner,
          repo: this.ctx.repo,
          comment_id: commentID,
          body: comment,
        },
      );
    }
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
    const viewerQuery = await this.ctx.octo.graphql(
      `query { viewer { databaseId } }`,
    );
    const viewer = ViewerSchema.parse(viewerQuery);

    // Only listing the first page for pr comments. This endpoint sorts comments
    // in ascending order of comment number (which means commenting order/creation
    // time). Assuming we are fast and be the first few bots leaving comments in
    // the PR.
    const comments = await this.ctx.octo.request(
      "GET /repos/{owner}/{repo}/issues/{issue_number}/comments",
      {
        owner: this.ctx.owner,
        repo: this.ctx.repo,
        issue_number: this.ctx.prNum,
      },
    );

    for (const comment of comments.data) {
      if (comment.user?.id === viewer.viewer.databaseId) {
        return comment.id;
      }
    }

    return null;
  }
}

export class LabelUpdater {
  public constructor(
    private readonly ctx: Context,
    private readonly config: ConfigType,
  ) {}

  public async createLabels() {
    const labels = await this.ctx.octo.request(
      "GET /repos/{owner}/{repo}/labels",
      {
        owner: this.ctx.owner,
        repo: this.ctx.repo,
      },
    );

    const labelMap = new Map(labels.data.map((l) => [l.name, l]));

    const promises = this.config.labels.map(async (preset) => {
      const match = labelMap.get(preset.name);
      if (match == null) {
        console.info("Label does not exist. Creating the label.");
        await this.ctx.octo.request("POST /repos/{owner}/{repo}/labels", {
          owner: this.ctx.owner,
          repo: this.ctx.repo,
          name: preset.name,
          color: preset.color,
        });

        return;
      }

      if (match.color !== preset.color) {
        console.info("Updating label color", preset.name);

        await this.ctx.octo.request(
          "PATCH /repos/{owner}/{repo}/labels/{name}",
          {
            owner: this.ctx.owner,
            repo: this.ctx.repo,
            name: preset.name,
            color: preset.color,
          },
        );
      }
    });

    await Promise.all(promises);
  }

  public async updateLabel(label: string | null) {
    if (label == null) {
      return await this.removeLabels();
    }

    const labelSet = new Set(this.ctx.pr.labels.map((l) => l.name));

    if (labelSet.has(label)) {
      console.info("Label already applied. Skipping label update", label);
      return;
    }

    await this.removeLabels();

    console.info("Adding label to issue", label);
    await this.ctx.octo.request(
      "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
      {
        owner: this.ctx.owner,
        repo: this.ctx.repo,
        issue_number: this.ctx.prNum,
        labels: [label],
      },
    );
  }

  private async removeLabels() {
    const labelSet = new Set(this.ctx.pr.labels.map((l) => l.name));

    const promises = this.config.labels.map(async (l) => {
      if (!labelSet.has(l.name)) {
        return;
      }

      console.info("Removing label from PR", l.name);
      await this.ctx.octo.request(
        "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
        {
          owner: this.ctx.owner,
          repo: this.ctx.repo,
          issue_number: this.ctx.prNum,
          name: l.name,
        },
      );
    });

    await Promise.all(promises);
  }
}
