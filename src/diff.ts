import parseGitDiff from "parse-git-diff";

export function genDiffSummary(diffFile: string) {
  const diff = parseGitDiff(diffFile);

  return "```json\n" + +JSON.stringify(diff) + "\n```";
}
