/**
 * Shim down schema for webhook event.
 *
 * This only contains info we are reading in this project. Compare to pulling in
 * octokit webhook package, this is a bit slimmer and will do schema validation
 * on runtime.
 *
 * @module
 */

import z from "zod";

export const pullRequestActions = z.enum([
  "assigned",
  "auto_merge_disabled",
  "auto_merge_enabled",
  "closed",
  "converted_to_draft",
  "demilestoned",
  "dequeued",
  "edited",
  "enqueued",
  "labeled",
  "locked",
  "milestoned",
  "opened",
  "ready_for_review",
  "reopened",
  "review_request_removed",
  "review_requested",
  "synchronize",
  "unassigned",
  "unlabeled",
  "unlocked",
]);

/**
 * Set of actions we actually handle.
 */
export const allowActions = new Set<z.infer<typeof pullRequestActions>>([
  "edited",
  "synchronize",
  "opened",
  "reopened",
]);

export const PullRequestSchema = z.object({
  number: z.number(),
  state: z.enum(["open", "closed"]),
  head: z.object({
    repo: z.object({
      name: z.string(),
      owner: z.object({
        login: z.string(),
      }),
    }),
  }),
  base: z.object({
    ref: z.string(),
    repo: z.object({
      name: z.string(),
      owner: z.object({
        login: z.string(),
      }),
    }),
  }),
  labels: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      color: z.string(),
    }),
  ),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

export const EventSchema = z.object({
  action: pullRequestActions,
  installation: z.object({
    id: z.number(),
    node_id: z.string(),
  }),
  pull_request: PullRequestSchema,
});
