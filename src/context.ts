import type { Octokit } from "octokit";
import type { PullRequest } from "@octokit/webhooks-types";

export class Context {
  public constructor(
    public readonly octo: Octokit,
    public readonly pr: PullRequest,
  ) {}

  public get owner() {
    return this.pr.base.repo.owner.login;
  }

  public get repo() {
    return this.pr.base.repo.name;
  }

  public get prNum() {
    return this.pr.number;
  }
}
