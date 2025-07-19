import type { PullRequest } from "./webhook_schema";

/**
 * Convenient reader for some common properties from a PR object.
 *
 * Also consolidate reading of these properties so I won't mix up head and base
 * (happened in the past).
 */
export function getPRInfo(pr: PullRequest) {
  return {
    owner: pr.head.repo.owner.login,
    repo: pr.head.repo.name,
    issue_number: pr.number,
  };
}
