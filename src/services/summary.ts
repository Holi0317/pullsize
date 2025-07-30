import picomatch from "picomatch";
import { composePaginateRest } from "@octokit/plugin-paginate-rest";
import type { Octokit } from "@octokit/core";
import type { ConfigType } from "./config";
import type { PullRequest } from "./webhook_schema";
import { getPRInfo } from "./prinfo";

/**
 * Base on config, get label text from PR size
 */
export function getLabel(config: ConfigType, size: number): string | null {
  for (const preset of config.labels) {
    if (size >= preset.threshold) {
      return preset.name;
    }
  }

  return null;
}

/**
 * Get size (number of lines added plus deleted) of the PR.
 *
 * This will ignore files/glob matching `ignore` in config.
 */
export async function diffSize(
  octo: Octokit,
  pr: PullRequest,
  config: ConfigType,
): Promise<number> {
  const { owner, repo, issue_number } = getPRInfo(pr);

  const matcher = picomatch(config.ignore);

  let size = 0;

  const iter = composePaginateRest.iterator(
    octo,
    "GET /repos/{owner}/{repo}/pulls/{pull_number}/files",
    {
      owner,
      repo,
      pull_number: issue_number,
    },
  );

  for await (const resp of iter) {
    for (const chunk of resp.data) {
      if (matcher(chunk.filename)) {
        continue;
      }

      size += chunk.changes;
    }
  }

  return size;
}
