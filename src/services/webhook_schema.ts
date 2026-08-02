/**
 * Shim down schema for webhook event.
 *
 * This only contains info we are reading in this project. Compare to pulling in
 * octokit webhook package, this is a bit slimmer and will do schema validation
 * on runtime.
 *
 * @module
 */

import * as z from "zod";

/**
 * Set of actions we actually handle.
 */
export const allowActions = new Set<string>([
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
      id: z.number(),
      name: z.string(),
      color: z.string(),
    }),
  ),
});

export type PullRequest = z.infer<typeof PullRequestSchema>;

export const EventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    node_id: z.string(),
  }),
  pull_request: PullRequestSchema,
});
