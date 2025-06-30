import type { PullRequest } from "@octokit/webhooks-types";

export function getPRInfo(pr: PullRequest) {
  // FIXME: Use pr.head instead.
  // We actually want to get the target PR, not the base PR.

  return {
    owner: pr.base.repo.owner.login,
    repo: pr.base.repo.name,
    issue_number: pr.number,
  };
}
