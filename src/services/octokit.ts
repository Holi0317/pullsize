import { Octokit } from "@octokit/core";
import { paginateRest } from "@octokit/plugin-paginate-rest";

export const MyOctokit = Octokit.plugin(paginateRest);

export type MyOctokitInstance = InstanceType<typeof MyOctokit>;
