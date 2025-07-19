import type { Octokit } from "@octokit/core";
import { RequestError } from "@octokit/request-error";
import { z } from "zod";
import { parse } from "@std/toml";
import { getPRInfo } from "./prinfo";
import type { PullRequest } from "./webhook_schema";

const ConfigSchema = z.object({
  /**
   * List of labels for pr size.
   */
  labels: z
    .array(
      z.object({
        name: z.string(),
        color: z.string(),
        threshold: z.number().gte(0),
      }),
    )
    .refine(
      (labels) => {
        const set = new Set(labels.map((label) => label.name));
        return set.size === labels.length;
      },
      { message: "Label name should be unique" },
    )
    .transform((labels) => {
      // Make sure all labels are ordered in descending order of threshold.
      // Size logic depends on this property.
      const clone = [...labels];
      clone.sort((a, b) => b.threshold - a.threshold);
      return clone;
    }),
  /**
   * Array of glob pattern to match against the file. If match, the file will
   * get ignored in pr size calculation
   */
  ignore: z.array(z.string()).default(() => []),
});

export type ConfigType = z.infer<typeof ConfigSchema>;

const CONFIG_PATH = ".github/prsize.toml";

const DEFAULT_CONFIG: ConfigType = {
  labels: [
    { name: "size/x-large", color: "FF0000", threshold: 1000 },
    { name: "size/large", color: "FF0000", threshold: 500 },
    { name: "size/medium", color: "FFFF00", threshold: 200 },
    { name: "size/small", color: "008000", threshold: 100 },
    { name: "size/x-small", color: "008000", threshold: 0 },
  ],
  ignore: ["package-lock.json", ".yarn/*", "yarn.lock", "pnpm-lock.yaml"],
};

export async function readConfig(
  octo: Octokit,
  pr: PullRequest,
): Promise<ConfigType> {
  let content: unknown;

  const { owner, repo } = getPRInfo(pr);

  try {
    const resp = await octo.request(
      "GET /repos/{owner}/{repo}/contents/{path}",
      {
        owner,
        repo,
        path: CONFIG_PATH,
        ref: pr.base.ref,
        mediaType: {
          format: "raw",
        },
      },
    );

    content = resp.data as unknown;
  } catch (error) {
    if (error instanceof RequestError && error.status === 404) {
      console.info("Config not found. Using default config");
      return DEFAULT_CONFIG;
    }

    throw error;
  }

  if (typeof content !== "string") {
    throw new Error(
      `Config path ${CONFIG_PATH} seems to be a directory. Cannot read config content`,
    );
  }

  const tom = parse(content);
  return ConfigSchema.parse(tom);
}
