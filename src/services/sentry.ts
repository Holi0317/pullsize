import * as Sentry from "@sentry/cloudflare";
import type { PullRequest } from "./webhook_schema";
import { getPRInfo } from "./prinfo";

export function setSentry(pr: PullRequest) {
  const { owner, repo, issue_number } = getPRInfo(pr);

  Sentry.setTags({
    repo: `${owner}/${repo}`,
    issue_number: issue_number,
  });
}
