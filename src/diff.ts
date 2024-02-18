import parseGitDiff from "parse-git-diff";

export function genDiffSummary(diffFile: string) {
  const diff = parseGitDiff(diffFile);

  // TODO: Implement diff summary and return label as well
  return "```json\n" + JSON.stringify(diff) + "\n```";
}
