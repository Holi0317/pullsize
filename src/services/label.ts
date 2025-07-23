import type { Octokit } from "@octokit/core";
import type { ConfigType } from "./config";
import { getPRInfo } from "./prinfo";
import type { PullRequest } from "./webhook_schema";
import type { MyOctokitInstance } from "./octokit";

/**
 * Create configured issue labels from config.
 *
 * This does not track and purge deleted labels. That is just too hard for us to
 * do so while keeping this app stateless.
 *
 * This function will update the color for labels if that has been changed.
 */
export async function createLabels(
  octo: MyOctokitInstance,
  pr: PullRequest,
  config: ConfigType,
) {
  const { owner, repo } = getPRInfo(pr);

  const labels = await octo.paginate("GET /repos/{owner}/{repo}/labels", {
    owner,
    repo,
  });

  const labelMap = new Map(labels.map((l) => [l.name, l]));

  for (const preset of config.labels) {
    const match = labelMap.get(preset.name);
    if (match == null) {
      console.info("Label does not exist. Creating the label.");
      await octo.request("POST /repos/{owner}/{repo}/labels", {
        owner,
        repo,
        name: preset.name,
        color: preset.color,
      });

      continue;
    }

    if (match.color !== preset.color) {
      console.info("Updating label color", preset.name);

      await octo.request("PATCH /repos/{owner}/{repo}/labels/{name}", {
        owner,
        repo,
        name: preset.name,
        color: preset.color,
      });
    }
  }
}

/**
 * Set PR label to given label.
 *
 * The label must exist in the configuration. Use {@link removePRLabels} to
 * remove labels.
 *
 * @param label Label to add to PR. If this label name does not exist in
 * configuration, this function will raise error.
 */
export async function setPRLabel(
  octo: Octokit,
  pr: PullRequest,
  config: ConfigType,
  label: string,
) {
  const confLabels = new Set(config.labels.map((l) => l.name));
  const labelSet = new Set(
    pr.labels.map((l) => l.name).filter((l) => confLabels.has(l)),
  );

  // Make sure this is the only label we got. Otherwise do the delete-then-set
  // logic
  if (labelSet.size === 1 && labelSet.has(label)) {
    console.info("Label already applied. Skipping label update", label);
    return;
  }

  await removePRLabels(octo, pr, config);

  const { owner, repo, issue_number } = getPRInfo(pr);

  console.info("Adding label to issue", label);
  await octo.request(
    "POST /repos/{owner}/{repo}/issues/{issue_number}/labels",
    {
      owner,
      repo,
      issue_number,
      labels: [label],
    },
  );
}

/**
 * Remove labels on the PR.
 *
 * Labels here means the labels configured in pullsize. Labels not in the config
 * file won't be touched.
 */
export async function removePRLabels(
  octo: Octokit,
  pr: PullRequest,
  config: ConfigType,
) {
  const { owner, repo, issue_number } = getPRInfo(pr);
  const labelSet = new Set(pr.labels.map((l) => l.name));

  // Assuming we don't have much labels. Workers seems to have issue with
  // `Promise.all([])`?
  for (const label of config.labels) {
    if (!labelSet.has(label.name)) {
      continue;
    }

    console.info("Removing label from PR", label.name);
    await octo.request(
      "DELETE /repos/{owner}/{repo}/issues/{issue_number}/labels/{name}",
      {
        owner,
        repo,
        issue_number,
        name: label.name,
      },
    );
  }
}
